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
        try {
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
            console.error(`Error executing scheduled message "${message.name}":`, sendError);
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
        // Update last run time and deactivate if one-off message
        try {
            const updatedMessage = {
                ...message,
                lastRun: new Date().toISOString(),
                // Deactivate one-off messages after execution
                isActive: message.isRecurring ? message.isActive : false,
                updatedAt: new Date().toISOString()
            };
            await this.storageService.saveScheduledMessage(updatedMessage);
            // If it's a one-off message, log that it has been deactivated
            if (!message.isRecurring) {
                console.log(`One-off message "${message.name}" has been deactivated after execution`);
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
     * Add continuation instructions to scheduled messages to handle interruptions gracefully
     */
    addContinuationInstructions(originalMessage) {
        return `🔄 [SCHEDULED CHECK-IN - Please continue previous work after this]

${originalMessage}

⚡ IMPORTANT: After responding to this check-in, IMMEDIATELY CONTINUE your previous work without waiting for further instructions. If you were implementing, coding, testing, or working on any task when this message arrived, resume that exact work now. Do not stop your development workflow - this is just a quick status update. Continue where you left off.`;
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