import { EventEmitter } from 'events';
import { ScheduledCheck } from '../types/index.js';
import { TmuxService } from './tmux.service.js';
import { StorageService } from './storage.service.js';
export declare class SchedulerService extends EventEmitter {
    private scheduledChecks;
    private recurringChecks;
    private tmuxService;
    private storageService;
    constructor(tmuxService: TmuxService, storageService: StorageService);
    /**
     * Schedule a one-time check-in for an agent
     */
    scheduleCheck(targetSession: string, minutes: number, message: string): string;
    /**
     * Schedule recurring check-ins for an agent
     */
    scheduleRecurringCheck(targetSession: string, intervalMinutes: number, message: string): string;
    /**
     * Schedule default check-ins for a new agent
     */
    scheduleDefaultCheckins(sessionName: string): string[];
    /**
     * Cancel a scheduled check-in
     */
    cancelCheck(checkId: string): void;
    /**
     * Cancel all checks for a specific session
     */
    cancelAllChecksForSession(sessionName: string): void;
    /**
     * List all scheduled check-ins
     */
    listScheduledChecks(): ScheduledCheck[];
    /**
     * Get checks for a specific session
     */
    getChecksForSession(sessionName: string): ScheduledCheck[];
    /**
     * Execute a check-in (send message to tmux session)
     */
    private executeCheck;
    /**
     * Set up recurring execution
     */
    private scheduleRecurringExecution;
    /**
     * Clean up all scheduled checks
     */
    cleanup(): void;
    /**
     * Get scheduler statistics
     */
    getStats(): {
        oneTimeChecks: number;
        recurringChecks: number;
        totalActiveSessions: number;
    };
}
//# sourceMappingURL=scheduler.service.d.ts.map