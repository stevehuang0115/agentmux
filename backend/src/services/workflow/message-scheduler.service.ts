import { EventEmitter } from 'events';
import { ScheduledMessage, MessageDeliveryLog } from '../../types/index.js';
import { TmuxService } from '../agent/tmux.service.js';
import { StorageService } from '../core/storage.service.js';
import { MessageDeliveryLogModel } from '../../models/ScheduledMessage.js';
import { AGENTMUX_CONSTANTS } from '../../constants.js';

export class MessageSchedulerService extends EventEmitter {
  private activeTimers: Map<string, NodeJS.Timeout> = new Map();
  private tmuxService: TmuxService;
  private storageService: StorageService;
  private messageQueue: Array<{ message: ScheduledMessage; resolve: () => void; reject: (error: Error) => void }> = [];
  private isProcessingQueue = false;

  constructor(tmuxService: TmuxService, storageService: StorageService) {
    super();
    this.tmuxService = tmuxService;
    this.storageService = storageService;
  }

  /**
   * Start the scheduler - load all active messages and schedule them
   */
  async start(): Promise<void> {
    console.log('Starting message scheduler service...');
    await this.loadAndScheduleAllMessages();
    console.log('Message scheduler service started');
  }

  /**
   * Schedule a new message
   */
  scheduleMessage(message: ScheduledMessage): void {
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
      } else {
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
  cancelMessage(messageId: string): void {
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
  async rescheduleAllMessages(): Promise<void> {
    console.log('Rescheduling all messages...');
    this.cancelAllMessages();
    await this.loadAndScheduleAllMessages();
  }

  /**
   * Cancel all scheduled messages
   */
  cancelAllMessages(): void {
    for (const timer of this.activeTimers.values()) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
    console.log('Cancelled all scheduled messages');
  }

  /**
   * Get statistics about active schedules
   */
  getStats(): {
    activeSchedules: number;
    scheduledMessageIds: string[];
  } {
    return {
      activeSchedules: this.activeTimers.size,
      scheduledMessageIds: Array.from(this.activeTimers.keys())
    };
  }

  /**
   * Execute a scheduled message
   */
  private async executeMessage(message: ScheduledMessage): Promise<void> {
    let success = false;
    let error: string | undefined;
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

    } catch (sendError) {
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
    } catch (logError) {
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
    } catch (updateError) {
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
  private async executeMessageSequentially(message: ScheduledMessage): Promise<void> {
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
  private async processMessageQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return; // Already processing
    }

    this.isProcessingQueue = true;

    while (this.messageQueue.length > 0) {
      const queueItem = this.messageQueue.shift();
      if (!queueItem) continue;

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
      } catch (error) {
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
  private async loadAndScheduleAllMessages(): Promise<void> {
    try {
      const messages = await this.storageService.getScheduledMessages();
      const activeMessages = messages.filter(msg => msg.isActive);
      
      console.log(`Found ${activeMessages.length} active scheduled messages to schedule`);
      
      for (const message of activeMessages) {
        this.scheduleMessage(message);
      }
    } catch (error) {
      console.error('Error loading scheduled messages:', error);
    }
  }

  /**
   * Convert delay amount and unit to milliseconds
   */
  private getDelayInMilliseconds(amount: number, unit: 'seconds' | 'minutes' | 'hours'): number {
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
  private addContinuationInstructions(originalMessage: string): string {
    return `🔄 [SCHEDULED CHECK-IN - Please continue previous work after this]

${originalMessage}

[CONTINUE] If you were working on something when this arrived, please resume that work now.`;
  }

  /**
   * Clean up all timers
   */
  cleanup(): void {
    this.cancelAllMessages();
    console.log('Message scheduler service cleaned up');
  }
}