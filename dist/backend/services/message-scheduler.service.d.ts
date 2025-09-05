import { EventEmitter } from 'events';
import { ScheduledMessage } from '../types/index.js';
import { TmuxService } from './tmux.service.js';
import { StorageService } from './storage.service.js';
export declare class MessageSchedulerService extends EventEmitter {
    private activeTimers;
    private tmuxService;
    private storageService;
    constructor(tmuxService: TmuxService, storageService: StorageService);
    /**
     * Start the scheduler - load all active messages and schedule them
     */
    start(): Promise<void>;
    /**
     * Schedule a new message
     */
    scheduleMessage(message: ScheduledMessage): void;
    /**
     * Cancel a scheduled message
     */
    cancelMessage(messageId: string): void;
    /**
     * Reschedule all active messages (used when messages are updated)
     */
    rescheduleAllMessages(): Promise<void>;
    /**
     * Cancel all scheduled messages
     */
    cancelAllMessages(): void;
    /**
     * Get statistics about active schedules
     */
    getStats(): {
        activeSchedules: number;
        scheduledMessageIds: string[];
    };
    /**
     * Execute a scheduled message
     */
    private executeMessage;
    /**
     * Load all active messages from storage and schedule them
     */
    private loadAndScheduleAllMessages;
    /**
     * Convert delay amount and unit to milliseconds
     */
    private getDelayInMilliseconds;
    /**
     * Clean up all timers
     */
    cleanup(): void;
}
//# sourceMappingURL=message-scheduler.service.d.ts.map