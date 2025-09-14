import { ErrorTrackingService } from '../../services/index.js';
export async function trackError(req, res) {
    try {
        const { message, level, source, component, action, metadata } = req.body;
        if (!message) {
            res.status(400).json({ success: false, error: 'Error message is required' });
            return;
        }
        const errorTracker = ErrorTrackingService.getInstance();
        const errorId = errorTracker.trackError(message, { level: level || 'error', source: source || 'frontend', component, action, metadata, sessionId: req.headers['x-session-id'], userId: req.headers['x-user-id'] });
        res.status(201).json({ success: true, data: { errorId }, message: 'Error tracked successfully' });
    }
    catch (error) {
        console.error('Error tracking error:', error);
        res.status(500).json({ success: false, error: 'Failed to track error' });
    }
}
export async function getErrorStats(req, res) {
    try {
        const errorTracker = ErrorTrackingService.getInstance();
        const stats = errorTracker.getErrorStats();
        res.json({ success: true, data: stats });
    }
    catch (error) {
        console.error('Error getting error stats:', error);
        res.status(500).json({ success: false, error: 'Failed to get error statistics' });
    }
}
export async function getErrors(req, res) {
    try {
        const { level, source, component, userId, sessionId, since, limit } = req.query;
        const errorTracker = ErrorTrackingService.getInstance();
        const errors = errorTracker.getErrors({ level, source, component, userId, sessionId, since, limit: limit ? parseInt(limit) : undefined });
        res.json({ success: true, data: errors });
    }
    catch (error) {
        console.error('Error getting errors:', error);
        res.status(500).json({ success: false, error: 'Failed to get errors' });
    }
}
export async function getError(req, res) {
    try {
        const { errorId } = req.params;
        const errorTracker = ErrorTrackingService.getInstance();
        const errorEvent = errorTracker.getError(errorId);
        if (!errorEvent) {
            res.status(404).json({ success: false, error: 'Error not found' });
            return;
        }
        res.json({ success: true, data: errorEvent });
    }
    catch (error) {
        console.error('Error getting error:', error);
        res.status(500).json({ success: false, error: 'Failed to get error' });
    }
}
export async function clearErrors(req, res) {
    try {
        const { olderThan, level, source } = req.body;
        const errorTracker = ErrorTrackingService.getInstance();
        const removedCount = errorTracker.clearErrors({ olderThan, level, source });
        res.json({ success: true, data: { removedCount }, message: `Cleared ${removedCount} error records` });
    }
    catch (error) {
        console.error('Error clearing errors:', error);
        res.status(500).json({ success: false, error: 'Failed to clear errors' });
    }
}
//# sourceMappingURL=errors.controller.js.map