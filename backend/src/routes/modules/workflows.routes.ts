import { Router } from 'express';
import { ApiController } from '../../controllers/api.controller.js';
import * as workflowsHandlers from '../../controllers/domains/workflows.handlers.js';

export function registerWorkflowRoutes(router: Router, apiController: ApiController): void {
  // Workflow Management Routes
  router.get('/workflows/executions/:executionId', (req, res) => workflowsHandlers.getWorkflowExecution.call(apiController, req, res));
  router.get('/workflows/active', (req, res) => workflowsHandlers.getActiveWorkflows.call(apiController, req, res));
  router.delete('/workflows/executions/:executionId', (req, res) => workflowsHandlers.cancelWorkflowExecution.call(apiController, req, res));
}
