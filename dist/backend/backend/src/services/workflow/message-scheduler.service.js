import { EventEmitter } from 'events';
import { MessageDeliveryLogModel } from '../../models/ScheduledMessage.js';
import { AGENTMUX_CONSTANTS } from '../../constants.js';
export class MessageSchedulerService extends EventEmitter {
    activeTimers = new Map();
    tmuxService;
    storageService;
    messageQueue = [];
    isProcessingQueue = false;
    constructor(tmuxService, storageService) {
        super();
        this.tmuxService = tmuxService;
        this.storageService = storageService;
    }
    /**
     * Start the scheduler - load all active messages and schedule them
     */
    async start() {
        console.log('Starting message scheduler service...');
        await this.loadAndScheduleAllMessages();
        console.log('Message scheduler service started');
    }
    /**
     * Schedule a new message
     */
    scheduleMessage(message) {
        if (!message.isActive) {
            return;
        }
        this.cancelMessage(message.id); // Cancel existing if any
        const delayMs = this.getDelayInMilliseconds(message.delayAmount, message.delayUnit);
        const executeMessage = async () => {
            // Route ALL messages through sequential queue to prevent race conditions
            await this.executeMessageSequentially(message);
            if (message.isRecurring && message.isActive) {
                // Schedule next execution for recurring messages
                const timer = setTimeout(executeMessage, delayMs);
                this.activeTimers.set(message.id, timer);
            }
            else {
                // Remove from active timers for one-time messages
                this.activeTimers.delete(message.id);
            }
        };
        const timer = setTimeout(executeMessage, delayMs);
        this.activeTimers.set(message.id, timer);
        const contextInfo = message.targetProject ? ` for project ${message.targetProject}` : '';
        console.log(`Scheduled message "${message.name}"${contextInfo} to run in ${message.delayAmount} ${message.delayUnit}${message.isRecurring ? ' (recurring)' : ''}`);
    }
    /**
     * Cancel a scheduled message
     */
    cancelMessage(messageId) {
        const timer = this.activeTimers.get(messageId);
        if (timer) {
            clearTimeout(timer);
            this.activeTimers.delete(messageId);
            console.log(`Cancelled scheduled message: ${messageId}`);
        }
    }
    /**
     * Reschedule all active messages (used when messages are updated)
     */
    async rescheduleAllMessages() {
        console.log('Rescheduling all messages...');
        this.cancelAllMessages();
        await this.loadAndScheduleAllMessages();
    }
    /**
     * Cancel all scheduled messages
     */
    cancelAllMessages() {
        for (const timer of this.activeTimers.values()) {
            clearTimeout(timer);
        }
        this.activeTimers.clear();
        console.log('Cancelled all scheduled messages');
    }
    /**
     * Get statistics about active schedules
     */
    getStats() {
        return {
            activeSchedules: this.activeTimers.size,
            scheduledMessageIds: Array.from(this.activeTimers.keys())
        };
    }
    /**
     * Execute a scheduled message
     */
    async executeMessage(message) {
        let success = false;
        let error;
        let enhancedMessage = message.message;
        let shouldDeactivateMessage = false;
        try {
            // Validate project exists if message targets a specific project
            if (message.targetProject) {
                const projectExists = await this.validateProjectExists(message.targetProject);
                if (!projectExists) {
                    shouldDeactivateMessage = true;
                    throw new Error(`Target project "${message.targetProject}" no longer exists - deactivating message`);
                }
            }
            // Determine target session name
            const sessionName = message.targetTeam === 'orchestrator'
                ? AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME
                : message.targetTeam;
            // Check if session exists
            if (!await this.tmuxService.sessionExists(sessionName)) {
                throw new Error(`Target session "${sessionName}" does not exist`);
            }
            // Enhance message with continuation instructions to handle interruptions gracefully
            enhancedMessage = this.addContinuationInstructions(message.message);
            // Send message to session (sendMessage already includes Enter key)
            await this.tmuxService.sendMessage(sessionName, enhancedMessage);
            success = true;
            const contextInfo = message.targetProject ? ` (Project: ${message.targetProject})` : '';
            console.log(`Executed scheduled message "${message.name}" for ${message.targetTeam}${contextInfo}`);
        }
        catch (sendError) {
            success = false;
            error = sendError instanceof Error ? sendError.message : 'Failed to send message';
            if (shouldDeactivateMessage) {
                console.warn(`Deactivating orphaned scheduled message "${message.name}": ${error}`);
            }
            else {
                console.error(`Error executing scheduled message "${message.name}":`, sendError);
            }
        }
        // Create delivery log
        const deliveryLog = MessageDeliveryLogModel.create({
            scheduledMessageId: message.id,
            messageName: message.name,
            targetTeam: message.targetTeam,
            targetProject: message.targetProject,
            message: enhancedMessage,
            success,
            error
        });
        try {
            await this.storageService.saveDeliveryLog(deliveryLog);
        }
        catch (logError) {
            console.error('Error saving delivery log:', logError);
        }
        // Update last run time and deactivate if one-off message or orphaned
        try {
            const updatedMessage = {
                ...message,
                lastRun: new Date().toISOString(),
                // Deactivate one-off messages after execution OR orphaned messages
                isActive: message.isRecurring && !shouldDeactivateMessage ? message.isActive : false,
                updatedAt: new Date().toISOString()
            };
            await this.storageService.saveScheduledMessage(updatedMessage);
            // If message was deactivated, cancel its timer
            if (!updatedMessage.isActive) {
                this.cancelMessage(message.id);
                if (shouldDeactivateMessage) {
                    console.log(`Orphaned message "${message.name}" has been deactivated and removed from scheduler`);
                }
                else if (!message.isRecurring) {
                    console.log(`One-off message "${message.name}" has been deactivated after execution`);
                }
            }
        }
        catch (updateError) {
            console.error('Error updating message last run time:', updateError);
        }
        // Emit event for monitoring
        this.emit('message_executed', {
            message,
            deliveryLog,
            success
        });
    }
    /**
     * Execute message through sequential queue to prevent race conditions between simultaneous messages
     */
    async executeMessageSequentially(message) {
        return new Promise((resolve, reject) => {
            // Add message to queue
            this.messageQueue.push({ message, resolve, reject });
            // Start processing queue if not already processing
            if (!this.isProcessingQueue) {
                this.processMessageQueue();
            }
        });
    }
    /**
     * Process the message queue sequentially
     */
    async processMessageQueue() {
        if (this.isProcessingQueue) {
            return; // Already processing
        }
        this.isProcessingQueue = true;
        while (this.messageQueue.length > 0) {
            const queueItem = this.messageQueue.shift();
            if (!queueItem)
                continue;
            const { message, resolve, reject } = queueItem;
            try {
                // Log queue processing for all scheduled messages
                const projectInfo = message.targetProject ? ` for project ${message.targetProject}` : '';
                console.log(`Processing scheduled message "${message.name}"${projectInfo} (queue length: ${this.messageQueue.length})`);
                // Execute the message
                await this.executeMessage(message);
                // Wait a short delay between executions to prevent overwhelming the system and race conditions
                await new Promise(resolve => setTimeout(resolve, 1000));
                resolve();
            }
            catch (error) {
                console.error(`Error processing queued message "${message.name}":`, error);
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        }
        this.isProcessingQueue = false;
        console.log('Finished processing message queue');
    }
    /**
     * Load all active messages from storage and schedule them
     */
    async loadAndScheduleAllMessages() {
        try {
            const messages = await this.storageService.getScheduledMessages();
            const activeMessages = messages.filter(msg => msg.isActive);
            console.log(`Found ${activeMessages.length} active scheduled messages to schedule`);
            for (const message of activeMessages) {
                this.scheduleMessage(message);
            }
        }
        catch (error) {
            console.error('Error loading scheduled messages:', error);
        }
    }
    /**
     * Convert delay amount and unit to milliseconds
     */
    getDelayInMilliseconds(amount, unit) {
        switch (unit) {
            case 'seconds':
                return amount * 1000;
            case 'minutes':
                return amount * 60 * 1000;
            case 'hours':
                return amount * 60 * 60 * 1000;
            default:
                throw new Error(`Invalid delay unit: ${unit}`);
        }
    }
    /**
     * Validate that a project still exists in the system
     */
    async validateProjectExists(projectId) {
        try {
            const projects = await this.storageService.getProjects();
            return projects.some(project => project.id === projectId);
        }
        catch (error) {
            console.error('Error validating project existence:', error);
            return false; // Assume project doesn't exist if we can't verify
        }
    }
    /**
     * Add continuation instructions to scheduled messages to handle interruptions gracefully
     */
    addContinuationInstructions(originalMessage) {
        return `🔄 [SCHEDULED CHECK-IN - Please continue previous work after this]

${originalMessage}

⚡ IMPORTANT: After responding to this check-in, IMMEDIATELY CONTINUE your previous work without waiting for further instructions. If you were implementing, coding, testing, or working on any task when this message arrived, resume that exact work now. Do not stop your development workflow - this is just a quick status update. Continue where you left off.`;
    }
    /**
     * Clean up orphaned scheduled messages for non-existent projects
     */
    async cleanupOrphanedMessages() {
        const result = {
            found: 0,
            deactivated: 0,
            errors: []
        };
        try {
            console.log('🧹 Starting orphaned message cleanup...');
            const messages = await this.storageService.getScheduledMessages();
            const projectMessages = messages.filter(msg => msg.targetProject && msg.isActive);
            result.found = projectMessages.length;
            console.log(`Found ${result.found} project-targeted messages to validate`);
            if (result.found === 0) {
                console.log('✅ No project-targeted messages found');
                return result;
            }
            // Get all existing projects for validation
            const projects = await this.storageService.getProjects();
            const projectIds = new Set(projects.map(p => p.id));
            for (const message of projectMessages) {
                try {
                    if (!projectIds.has(message.targetProject)) {
                        console.log(`🗑️ Deactivating orphaned message "${message.name}" for non-existent project ${message.targetProject}`);
                        // Deactivate the message
                        const updatedMessage = {
                            ...message,
                            isActive: false,
                            updatedAt: new Date().toISOString()
                        };
                        await this.storageService.saveScheduledMessage(updatedMessage);
                        this.cancelMessage(message.id);
                        result.deactivated++;
                    }
                }
                catch (error) {
                    const errorMsg = `Failed to process message ${message.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    result.errors.push(errorMsg);
                    console.error(errorMsg);
                }
            }
            console.log(`✅ Orphaned message cleanup complete: ${result.deactivated}/${result.found} messages deactivated`);
            if (result.errors.length > 0) {
                console.warn(`⚠️ ${result.errors.length} errors occurred during cleanup`);
            }
        }
        catch (error) {
            const errorMsg = `Failed to cleanup orphaned messages: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMsg);
            console.error(errorMsg);
        }
        return result;
    }
    /**
     * Clean up all timers
     */
    cleanup() {
        this.cancelAllMessages();
        console.log('Message scheduler service cleaned up');
    }
}
//# sourceMappingURL=message-scheduler.service.js.map