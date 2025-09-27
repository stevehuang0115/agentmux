import { Router } from 'express';
import { ApiController } from '../../controllers/api.controller.js';
import * as taskMgmtHandlers from '../../controllers/task-management/task-management.controller.js';
import * as inProgressHandlers from '../../controllers/task-management/in-progress-tasks.controller.js';

export function registerTaskManagementRoutes(router: Router, apiController: ApiController): void {
  // Task Management Routes (for MCP tools)
  router.post('/task-management/assign', (req, res) => taskMgmtHandlers.assignTask.call(apiController, req, res));
  router.post('/task-management/complete', (req, res) => taskMgmtHandlers.completeTask.call(apiController, req, res));
  router.post('/task-management/block', (req, res) => taskMgmtHandlers.blockTask.call(apiController, req, res));
  router.post('/task-management/unblock', (req, res) => taskMgmtHandlers.unblockTask.call(apiController, req, res));
  router.post('/task-management/read-task', (req, res) => taskMgmtHandlers.readTask.call(apiController, req, res));
  router.post('/task-management/take-next', (req, res) => taskMgmtHandlers.takeNextTask.call(apiController, req, res));
  router.post('/task-management/sync', (req, res) => taskMgmtHandlers.syncTaskStatus.call(apiController, req, res));
  router.get('/task-management/team-progress', (req, res) => taskMgmtHandlers.getTeamProgress.call(apiController, req, res));

  // Task Execution Routes (for UI)
  router.post('/task-management/start-execution', (req, res) => taskMgmtHandlers.startTaskExecution.call(apiController, req, res));

  // Task Recovery Routes (for orchestrator startup)
  router.post('/task-management/recover-abandoned-tasks', (req, res) => taskMgmtHandlers.recoverAbandonedTasks.call(apiController, req, res));

  // Task Creation Routes
  router.post('/tasks/create-from-config', (req, res) => taskMgmtHandlers.createTasksFromConfig.call(apiController, req, res));

  // In-Progress Tasks Routes
  router.get('/in-progress-tasks', (req, res) => inProgressHandlers.getInProgressTasks.call(apiController, req, res));
}
