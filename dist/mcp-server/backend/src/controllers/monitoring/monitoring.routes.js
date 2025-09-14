import { Router } from 'express';
/**
 * Creates monitoring router with all monitoring-related endpoints
 * @param context - API context with services
 * @returns Express router configured with monitoring routes
 */
export function createMonitoringRouter(context) {
    const router = Router();
    // File watcher endpoints (if needed, can be added later)
    // router.get('/file-changes', getFileChanges.bind(context));
    // router.post('/watch-file', startWatchingFile.bind(context));
    // router.delete('/watch-file', stopWatchingFile.bind(context));
    return router;
}
//# sourceMappingURL=monitoring.routes.js.map