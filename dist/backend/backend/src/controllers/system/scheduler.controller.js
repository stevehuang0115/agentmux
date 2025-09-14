export async function scheduleCheck(req, res) {
    try {
        const { targetSession, minutes, message, isRecurring, intervalMinutes } = req.body;
        if (!targetSession || !minutes || !message) {
            res.status(400).json({ success: false, error: 'targetSession, minutes, and message are required' });
            return;
        }
        let checkId;
        if (isRecurring && intervalMinutes)
            checkId = this.schedulerService.scheduleRecurringCheck(targetSession, intervalMinutes, message);
        else
            checkId = this.schedulerService.scheduleCheck(targetSession, minutes, message);
        res.status(201).json({ success: true, data: { checkId }, message: 'Check-in scheduled successfully' });
    }
    catch (error) {
        console.error('Error scheduling check:', error);
        res.status(500).json({ success: false, error: 'Failed to schedule check-in' });
    }
}
export async function getScheduledChecks(req, res) {
    try {
        const { session } = req.query;
        const checks = session ? this.schedulerService.getChecksForSession(session) : this.schedulerService.listScheduledChecks();
        res.json({ success: true, data: checks });
    }
    catch (error) {
        console.error('Error getting scheduled checks:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve scheduled checks' });
    }
}
export async function cancelScheduledCheck(req, res) {
    try {
        const { id } = req.params;
        this.schedulerService.cancelCheck(id);
        res.json({ success: true, message: 'Check-in cancelled successfully' });
    }
    catch (error) {
        console.error('Error cancelling check:', error);
        res.status(500).json({ success: false, error: 'Failed to cancel check-in' });
    }
}
//# sourceMappingURL=scheduler.controller.js.map