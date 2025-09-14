import { Router } from 'express';
import { getSystemHealth, getSystemMetrics, getSystemConfiguration } from './system.controller.js';
/**
 * Creates system router with all system-related endpoints
 * @param context - API context with services
 * @returns Express router configured with system routes
 */
export function createSystemRouter(context) {
    const router = Router();
    // System monitoring and status
    router.get('/health', getSystemHealth.bind(context));
    router.get('/metrics', getSystemMetrics.bind(context));
    router.get('/configuration', getSystemConfiguration.bind(context));
    return router;
}
//# sourceMappingURL=system.routes.js.map