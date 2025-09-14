import * as workflowsHandlers from '../../controllers/workflow/workflow.controller.js';
export function registerWorkflowRoutes(router, apiController) {
    // Workflow Management Routes
    router.get('/workflows/executions/:executionId', (req, res) => workflowsHandlers.getWorkflowExecution.call(apiController, req, res));
    router.get('/workflows/active', (req, res) => workflowsHandlers.getActiveWorkflows.call(apiController, req, res));
    router.delete('/workflows/executions/:executionId', (req, res) => workflowsHandlers.cancelWorkflowExecution.call(apiController, req, res));
}
//# sourceMappingURL=workflows.routes.js.map