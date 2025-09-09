import { Router } from 'express';
import { ApiController } from '../controllers/api.controller.js';
import { registerTeamRoutes } from './modules/teams.routes.js';
import { registerProjectRoutes } from './modules/projects.routes.js';
import { registerTaskManagementRoutes } from './modules/task-management.routes.js';
import { registerSystemRoutes } from './modules/system.routes.js';
import { registerSchedulerRoutes } from './modules/scheduler.routes.js';
import { registerTerminalRoutes } from './modules/terminal.routes.js';
import { registerAssignmentsRoutes } from './modules/assignments.routes.js';
import { registerOrchestratorRoutes } from './modules/orchestrator.routes.js';
import { registerWorkflowRoutes } from './modules/workflows.routes.js';
import { registerErrorRoutes } from './modules/errors.routes.js';
import { registerScheduledMessageRoutes } from './modules/scheduled-messages.routes.js';
import { registerDeliveryLogRoutes } from './modules/delivery-logs.routes.js';
import { registerConfigRoutes } from './modules/config.routes.js';

export function createApiRoutes(apiController: ApiController): Router {
  const router = Router();

  // Register modular routes
  registerTeamRoutes(router, apiController);
  registerProjectRoutes(router, apiController);
  registerTaskManagementRoutes(router, apiController);
  registerSystemRoutes(router, apiController);
  registerSchedulerRoutes(router, apiController);
  registerTerminalRoutes(router, apiController);
  registerAssignmentsRoutes(router, apiController);
  registerOrchestratorRoutes(router, apiController);
  registerWorkflowRoutes(router, apiController);
  registerErrorRoutes(router, apiController);
  registerScheduledMessageRoutes(router, apiController);
  registerDeliveryLogRoutes(router, apiController);
  registerConfigRoutes(router, apiController);

  return router;
}
