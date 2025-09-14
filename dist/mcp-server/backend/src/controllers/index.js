import { Router } from 'express';
// Import route creators
import { createProjectRouter } from './project/project.routes.js';
import { createTeamRouter } from './team/team.routes.js';
import { createOrchestratorRouter } from './orchestrator/orchestrator.routes.js';
import { createMonitoringRouter } from './monitoring/monitoring.routes.js';
import { createSystemRouter } from './system/system.routes.js';
/**
 * Creates the main API router that aggregates all feature routers
 * @param context - API context with services
 * @returns Express router configured with all API routes
 */
export function createApiRouter(context) {
    const router = Router();
    // Mount feature routers
    router.use('/projects', createProjectRouter(context));
    router.use('/teams', createTeamRouter(context));
    router.use('/orchestrator', createOrchestratorRouter(context));
    router.use('/monitoring', createMonitoringRouter(context));
    router.use('/system', createSystemRouter(context));
    return router;
}
//# sourceMappingURL=index.js.map