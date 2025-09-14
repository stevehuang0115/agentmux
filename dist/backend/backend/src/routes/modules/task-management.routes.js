import * as taskMgmtHandlers from '../../controllers/task-management/task-management.controller.js';
export function registerTaskManagementRoutes(router, apiController) {
    // Task Management Routes (for MCP tools)
    router.post('/task-management/assign', (req, res) => taskMgmtHandlers.assignTask.call(apiController, req, res));
    router.post('/task-management/complete', (req, res) => taskMgmtHandlers.completeTask.call(apiController, req, res));
    router.post('/task-management/block', (req, res) => taskMgmtHandlers.blockTask.call(apiController, req, res));
    router.post('/task-management/read-task', (req, res) => taskMgmtHandlers.readTask.call(apiController, req, res));
    router.post('/task-management/take-next', (req, res) => taskMgmtHandlers.takeNextTask.call(apiController, req, res));
    router.post('/task-management/sync', (req, res) => taskMgmtHandlers.syncTaskStatus.call(apiController, req, res));
    router.get('/task-management/team-progress', (req, res) => taskMgmtHandlers.getTeamProgress.call(apiController, req, res));
    // Task Execution Routes (for UI)  
    router.post('/task-management/start-execution', (req, res) => taskMgmtHandlers.startTaskExecution.call(apiController, req, res));
    // Task Creation Routes
    router.post('/tasks/create-from-config', (req, res) => taskMgmtHandlers.createTasksFromConfig.call(apiController, req, res));
}
//# sourceMappingURL=task-management.routes.js.map