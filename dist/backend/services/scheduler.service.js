import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { MessageDeliveryLogModel } from '../models/ScheduledMessage.js';
export class SchedulerService extends EventEmitter {
    scheduledChecks = new Map();
    recurringChecks = new Map();
    tmuxService;
    storageService;
    constructor(tmuxService, storageService) {
        super();
        this.tmuxService = tmuxService;
        this.storageService = storageService;
    }
    /**
     * Schedule a one-time check-in for an agent
     */
    scheduleCheck(targetSession, minutes, message) {
        const checkId = uuidv4();
        const scheduledFor = new Date(Date.now() + minutes * 60 * 1000);
        const scheduledCheck = {
            id: checkId,
            targetSession,
            message,
            scheduledFor: scheduledFor.toISOString(),
            isRecurring: false,
            createdAt: new Date().toISOString(),
        };
        // Schedule the execution
        const timeout = setTimeout(() => {
            this.executeCheck(targetSession, message);
            this.scheduledChecks.delete(checkId);
            this.emit('check_executed', scheduledCheck);
        }, minutes * 60 * 1000);
        this.scheduledChecks.set(checkId, timeout);
        this.emit('check_scheduled', scheduledCheck);
        console.log(`Scheduled check-in for ${targetSession} in ${minutes} minutes: "${message}"`);
        return checkId;
    }
    /**
     * Schedule recurring check-ins for an agent
     */
    scheduleRecurringCheck(targetSession, intervalMinutes, message) {
        const checkId = uuidv4();
        const firstExecution = new Date(Date.now() + intervalMinutes * 60 * 1000);
        const scheduledCheck = {
            id: checkId,
            targetSession,
            message,
            scheduledFor: firstExecution.toISOString(),
            intervalMinutes,
            isRecurring: true,
            createdAt: new Date().toISOString(),
        };
        this.recurringChecks.set(checkId, scheduledCheck);
        // Schedule the first execution and set up recurring
        this.scheduleRecurringExecution(checkId, intervalMinutes, targetSession, message);
        this.emit('recurring_check_scheduled', scheduledCheck);
        console.log(`Scheduled recurring check-in for ${targetSession} every ${intervalMinutes} minutes: "${message}"`);
        return checkId;
    }
    /**
     * Schedule default check-ins for a new agent
     */
    scheduleDefaultCheckins(sessionName) {
        const checkIds = [];
        // Initial check-in after 5 minutes
        checkIds.push(this.scheduleCheck(sessionName, 5, 'Initial check-in: How are you getting started? Any immediate questions or blockers?'));
        // Progress check every 30 minutes
        checkIds.push(this.scheduleRecurringCheck(sessionName, 30, 'Regular check-in: Please provide a status update. What have you accomplished? What are you working on next? Any blockers?'));
        // Commit reminder every 25 minutes (before 30-min limit)
        checkIds.push(this.scheduleRecurringCheck(sessionName, 25, 'Git reminder: Please ensure you commit your changes. Remember our 30-minute commit discipline.'));
        return checkIds;
    }
    /**
     * Cancel a scheduled check-in
     */
    cancelCheck(checkId) {
        // Cancel one-time check
        const timeout = this.scheduledChecks.get(checkId);
        if (timeout) {
            clearTimeout(timeout);
            this.scheduledChecks.delete(checkId);
            this.emit('check_cancelled', { checkId, type: 'one-time' });
            console.log(`Cancelled one-time check-in: ${checkId}`);
            return;
        }
        // Cancel recurring check
        const recurringCheck = this.recurringChecks.get(checkId);
        if (recurringCheck) {
            this.recurringChecks.delete(checkId);
            // The actual timeout will be cleaned up in the next iteration
            this.emit('check_cancelled', { checkId, type: 'recurring' });
            console.log(`Cancelled recurring check-in: ${checkId}`);
            return;
        }
        console.log(`Check-in not found: ${checkId}`);
    }
    /**
     * Cancel all checks for a specific session
     */
    cancelAllChecksForSession(sessionName) {
        // Cancel one-time checks
        for (const [checkId, timeout] of this.scheduledChecks.entries()) {
            // We don't have session info in scheduledChecks, so we need a different approach
            clearTimeout(timeout);
            this.scheduledChecks.delete(checkId);
        }
        // Cancel recurring checks
        for (const [checkId, check] of this.recurringChecks.entries()) {
            if (check.targetSession === sessionName) {
                this.recurringChecks.delete(checkId);
                this.emit('session_checks_cancelled', { sessionName, checkId });
            }
        }
        console.log(`Cancelled all check-ins for session: ${sessionName}`);
    }
    /**
     * List all scheduled check-ins
     */
    listScheduledChecks() {
        const checks = [];
        // Add recurring checks
        for (const check of this.recurringChecks.values()) {
            checks.push(check);
        }
        // Note: We don't store one-time check details after scheduling
        // In a production system, you'd want to persist this information
        return checks.sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
    }
    /**
     * Get checks for a specific session
     */
    getChecksForSession(sessionName) {
        return this.listScheduledChecks().filter(check => check.targetSession === sessionName);
    }
    /**
     * Execute a check-in (send message to tmux session)
     */
    async executeCheck(targetSession, message) {
        let success = false;
        let error;
        try {
            // Check if session still exists
            if (!await this.tmuxService.sessionExists(targetSession)) {
                console.log(`Session ${targetSession} no longer exists, skipping check-in`);
                return;
            }
            // Send the check-in message
            await this.tmuxService.sendMessage(targetSession, message);
            success = true;
            console.log(`Check-in executed for ${targetSession}: "${message}"`);
            this.emit('check_executed', {
                targetSession,
                message,
                executedAt: new Date().toISOString(),
            });
        }
        catch (sendError) {
            success = false;
            error = sendError instanceof Error ? sendError.message : 'Unknown error';
            console.error(`Error executing check-in for ${targetSession}:`, sendError);
            this.emit('check_execution_failed', {
                targetSession,
                message,
                error,
            });
        }
        // Create delivery log for scheduler messages
        const deliveryLog = MessageDeliveryLogModel.create({
            scheduledMessageId: `scheduler-${uuidv4()}`, // Generate a unique ID for scheduler messages
            messageName: message.includes('Git reminder') ? 'Scheduled Git Reminder' : 'Scheduled Status Check-in',
            targetTeam: targetSession,
            targetProject: '', // We don't have project context for scheduler messages
            message: message,
            success,
            error
        });
        try {
            await this.storageService.saveDeliveryLog(deliveryLog);
        }
        catch (logError) {
            console.error('Error saving scheduler delivery log:', logError);
        }
    }
    /**
     * Set up recurring execution
     */
    scheduleRecurringExecution(checkId, intervalMinutes, targetSession, message) {
        const executeRecurring = () => {
            // Check if this recurring check is still active
            if (!this.recurringChecks.has(checkId)) {
                return; // Check was cancelled
            }
            this.executeCheck(targetSession, message);
            // Schedule next execution
            setTimeout(executeRecurring, intervalMinutes * 60 * 1000);
        };
        // Schedule first execution
        setTimeout(executeRecurring, intervalMinutes * 60 * 1000);
    }
    /**
     * Clean up all scheduled checks
     */
    cleanup() {
        // Clear all one-time checks
        for (const timeout of this.scheduledChecks.values()) {
            clearTimeout(timeout);
        }
        this.scheduledChecks.clear();
        // Clear all recurring checks
        this.recurringChecks.clear();
        console.log('Scheduler service cleaned up');
    }
    /**
     * Get scheduler statistics
     */
    getStats() {
        const activeSessions = new Set();
        // Count sessions from recurring checks
        for (const check of this.recurringChecks.values()) {
            activeSessions.add(check.targetSession);
        }
        return {
            oneTimeChecks: this.scheduledChecks.size,
            recurringChecks: this.recurringChecks.size,
            totalActiveSessions: activeSessions.size,
        };
    }
}
//# sourceMappingURL=scheduler.service.js.map