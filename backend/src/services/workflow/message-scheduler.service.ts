import { EventEmitter } from 'events';
import { ScheduledMessage, MessageDeliveryLog } from '../../types/index.js';
import { TmuxService } from '../agent/tmux.service.js';
import { StorageService } from '../core/storage.service.js';
import { LoggerService } from '../core/logger.service.js';
import { MessageDeliveryLogModel } from '../../models/ScheduledMessage.js';
import { AGENTMUX_CONSTANTS, TERMINAL_PATTERNS } from '../../constants.js';
import { getSessionBackendSync } from '../session/index.js';
import { SessionCommandHelper } from '../session/session-command-helper.js';

export class MessageSchedulerService extends EventEmitter {
  private activeTimers: Map<string, NodeJS.Timeout> = new Map();
  private _legacyTmuxService: TmuxService; // DORMANT: kept for backward compatibility
  private storageService: StorageService;
  private logger = LoggerService.getInstance().createComponentLogger('MessageSchedulerService');
  private messageQueue: Array<{ message: ScheduledMessage; resolve: () => void; reject: (error: Error) => void }> = [];
  private isProcessingQueue = false;

  constructor(tmuxService: TmuxService, storageService: StorageService) {
    super();
    this._legacyTmuxService = tmuxService; // DORMANT: kept for backward compatibility
    this.storageService = storageService;
  }

  /**
   * Start the scheduler - load all active messages and schedule them
   */
  async start(): Promise<void> {
    this.logger.info('Starting message scheduler service...');
    await this.loadAndScheduleAllMessages();
    this.logger.info('Message scheduler service started');
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
    this.logger.info('Scheduled message', {
      name: message.name,
      targetProject: message.targetProject || undefined,
      delay: `${message.delayAmount} ${message.delayUnit}`,
      recurring: message.isRecurring
    });
  }

  /**
   * Cancel a scheduled message
   */
  cancelMessage(messageId: string): void {
    const timer = this.activeTimers.get(messageId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(messageId);
      this.logger.info('Cancelled scheduled message', { messageId });
    }
  }

  /**
   * Reschedule all active messages (used when messages are updated)
   */
  async rescheduleAllMessages(): Promise<void> {
    this.logger.info('Rescheduling all messages...');
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
    this.logger.info('Cancelled all scheduled messages');
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

      // Use PTY session backend via SessionCommandHelper (proven two-step write pattern)
      const backend = getSessionBackendSync();
      if (!backend) {
        throw new Error('Session backend not initialized');
      }

      const commandHelper = new SessionCommandHelper(backend);

      if (!commandHelper.sessionExists(sessionName)) {
        throw new Error(`Target session "${sessionName}" does not exist`);
      }

      // Check if Claude is at a prompt before sending - skip if busy
      const terminalOutput = commandHelper.capturePane(sessionName);
      if (!this.isClaudeAtPrompt(terminalOutput)) {
        this.logger.info('Skipping scheduled message - agent is busy', {
          name: message.name,
          targetTeam: message.targetTeam,
        });
        // Don't count as failure - just skip this cycle; recurring messages will try again
        return;
      }

      // Enhance message with continuation instructions to handle interruptions gracefully
      enhancedMessage = this.addContinuationInstructions(message.message);

      // Use SessionCommandHelper.sendMessage() which handles bracketed paste mode correctly:
      // 1. Writes message text (triggers bracketed paste)
      // 2. Waits scaled delay for paste processing
      // 3. Sends Enter (\r) separately so it's not swallowed by paste mode
      await commandHelper.sendMessage(sessionName, enhancedMessage);

      success = true;

      this.logger.info('Executed scheduled message', {
        name: message.name,
        targetTeam: message.targetTeam,
        targetProject: message.targetProject || undefined
      });

    } catch (sendError) {
      success = false;
      error = sendError instanceof Error ? sendError.message : 'Failed to send message';

      if (shouldDeactivateMessage) {
        this.logger.warn('Deactivating orphaned scheduled message', { name: message.name, error });
      } else {
        this.logger.error('Error executing scheduled message', { name: message.name, error });
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
    } catch (logError) {
      this.logger.error('Error saving delivery log', { error: logError instanceof Error ? logError.message : String(logError) });
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
          this.logger.info('Orphaned message has been deactivated and removed from scheduler', { name: message.name });
        } else if (!message.isRecurring) {
          this.logger.info('One-off message has been deactivated after execution', { name: message.name });
        }
      }
    } catch (updateError) {
      this.logger.error('Error updating message last run time', { error: updateError instanceof Error ? updateError.message : String(updateError) });
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
        this.logger.info('Processing scheduled message', {
          name: message.name,
          targetProject: message.targetProject || undefined,
          queueLength: this.messageQueue.length
        });

        // Execute the message
        await this.executeMessage(message);

        // Wait a short delay between executions to prevent overwhelming the system and race conditions
        await new Promise(resolve => setTimeout(resolve, 1000));

        resolve();
      } catch (error) {
        this.logger.error('Error processing queued message', { name: message.name, error: error instanceof Error ? error.message : String(error) });
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.isProcessingQueue = false;
    this.logger.info('Finished processing message queue');
  }

  /**
   * Load all active messages from storage and schedule them
   */
  private async loadAndScheduleAllMessages(): Promise<void> {
    try {
      const messages = await this.storageService.getScheduledMessages();
      const activeMessages = messages.filter(msg => msg.isActive);

      this.logger.info('Found active scheduled messages to schedule', { count: activeMessages.length });

      for (const message of activeMessages) {
        this.scheduleMessage(message);
      }
    } catch (error) {
      this.logger.error('Error loading scheduled messages', { error: error instanceof Error ? error.message : String(error) });
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
   * Validate that a project still exists in the system
   */
  private async validateProjectExists(projectId: string): Promise<boolean> {
    try {
      const projects = await this.storageService.getProjects();
      return projects.some(project => project.id === projectId);
    } catch (error) {
      this.logger.error('Error validating project existence', { error: error instanceof Error ? error.message : String(error) });
      return false; // Assume project doesn't exist if we can't verify
    }
  }

  /**
   * Check if Claude Code appears to be at an input prompt.
   * Uses TERMINAL_PATTERNS.PROMPT_STREAM to detect prompt characters on their own line,
   * with fallback to checking last 10 lines for exact prompt char matches.
   *
   * @param terminalOutput - The captured terminal output to check
   * @returns true if Claude Code appears to be at a prompt
   */
  private isClaudeAtPrompt(terminalOutput: string): boolean {
    if (!terminalOutput || typeof terminalOutput !== 'string') {
      return true; // Assume at prompt if no output (safer for delivery)
    }

    // Primary: regex matches a prompt character alone on a line
    if (TERMINAL_PATTERNS.PROMPT_STREAM.test(terminalOutput)) {
      return true;
    }

    // Fallback: check last 10 non-empty lines for prompt indicators
    const lines = terminalOutput.split('\n').filter((line) => line.trim().length > 0);
    const linesToCheck = lines.slice(-10);
    return linesToCheck.some((line) => {
      const trimmed = line.trim();
      // Exact match for single-char prompts (❯, >, ⏵, $)
      if (TERMINAL_PATTERNS.PROMPT_CHARS.some((indicator) => trimmed === indicator)) {
        return true;
      }
      // Bypass permissions mode: line starts with ❯❯ followed by space
      if (trimmed.startsWith('❯❯ ')) {
        return true;
      }
      return false;
    });
  }

  /**
   * Add continuation instructions to scheduled messages to handle interruptions gracefully
   */
  private addContinuationInstructions(originalMessage: string): string {
    return `🔄 [SCHEDULED CHECK-IN - Please continue previous work after this]

${originalMessage}

⚡ IMPORTANT: After responding to this check-in, IMMEDIATELY CONTINUE your previous work without waiting for further instructions. If you were implementing, coding, testing, or working on any task when this message arrived, resume that exact work now. Do not stop your development workflow - this is just a quick status update. Continue where you left off.`;
  }

  /**
   * Clean up orphaned scheduled messages for non-existent projects
   */
  async cleanupOrphanedMessages(): Promise<{
    found: number;
    deactivated: number;
    errors: string[];
  }> {
    const result = {
      found: 0,
      deactivated: 0,
      errors: [] as string[]
    };

    try {
      this.logger.info('Starting orphaned message cleanup...');

      const messages = await this.storageService.getScheduledMessages();
      const projectMessages = messages.filter(msg => msg.targetProject && msg.isActive);

      result.found = projectMessages.length;
      this.logger.info('Found project-targeted messages to validate', { count: result.found });

      if (result.found === 0) {
        this.logger.info('No project-targeted messages found');
        return result;
      }

      // Get all existing projects for validation
      const projects = await this.storageService.getProjects();
      const projectIds = new Set(projects.map(p => p.id));

      for (const message of projectMessages) {
        try {
          if (!projectIds.has(message.targetProject!)) {
            this.logger.info('Deactivating orphaned message for non-existent project', {
              name: message.name,
              targetProject: message.targetProject
            });

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
        } catch (error) {
          const errorMsg = `Failed to process message ${message.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          this.logger.error('Failed to process message during cleanup', { messageId: message.id, error: error instanceof Error ? error.message : String(error) });
        }
      }

      this.logger.info('Orphaned message cleanup complete', { deactivated: result.deactivated, total: result.found });

      if (result.errors.length > 0) {
        this.logger.warn('Errors occurred during cleanup', { errorCount: result.errors.length });
      }

    } catch (error) {
      const errorMsg = `Failed to cleanup orphaned messages: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      this.logger.error('Failed to cleanup orphaned messages', { error: error instanceof Error ? error.message : String(error) });
    }

    return result;
  }

  /**
   * Clean up all timers
   */
  cleanup(): void {
    this.cancelAllMessages();
    this.logger.info('Message scheduler service cleaned up');
  }
}
