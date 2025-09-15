import { Router } from 'express';
import { ApiController } from '../controllers/api.controller.js';
import { createApiRouter, type ApiContext } from '../controllers/index.js';
import { registerTaskManagementRoutes } from './modules/task-management.routes.js';
import { registerSystemRoutes } from './modules/system.routes.js';
import { registerSchedulerRoutes } from './modules/scheduler.routes.js';
import { registerTerminalRoutes } from './modules/terminal.routes.js';
import { registerAssignmentsRoutes } from './modules/assignments.routes.js';
import { registerWorkflowRoutes } from './modules/workflows.routes.js';
import { registerErrorRoutes } from './modules/errors.routes.js';
import { registerScheduledMessageRoutes } from './modules/scheduled-messages.routes.js';
import { registerDeliveryLogRoutes } from './modules/delivery-logs.routes.js';
import { registerConfigRoutes } from './modules/config.routes.js';

/**
 * Creates API routes using the new organized controller structure
 * @param apiController - Legacy API controller (for backward compatibility)
 * @returns Express router configured with all API routes
 */
export function createApiRoutes(apiController: ApiController): Router {
  const router = Router();

  // Create context from ApiController for new organized controllers
  const context: ApiContext = {
    storageService: apiController.storageService,
    tmuxService: apiController.tmuxService,
    agentRegistrationService: apiController.agentRegistrationService,
    schedulerService: apiController.schedulerService,
    messageSchedulerService: apiController.messageSchedulerService,
    activeProjectsService: apiController.activeProjectsService,
    promptTemplateService: apiController.promptTemplateService,
    taskAssignmentMonitor: apiController.taskAssignmentMonitor,
    taskTrackingService: apiController.taskTrackingService
  };

  // Use the new organized controller structure
  router.use('/', createApiRouter(context));

  // Keep legacy modular routes for handlers not yet migrated (for backward compatibility)
  // Note: Project routes consolidated into new architecture - no longer needed here
  registerTaskManagementRoutes(router, apiController);
  registerSchedulerRoutes(router, apiController);
  registerTerminalRoutes(router, apiController);
  registerAssignmentsRoutes(router, apiController);
  registerWorkflowRoutes(router, apiController);
  registerErrorRoutes(router, apiController);
  registerScheduledMessageRoutes(router, apiController);
  registerDeliveryLogRoutes(router, apiController);
  registerConfigRoutes(router, apiController);

  return router;
}
