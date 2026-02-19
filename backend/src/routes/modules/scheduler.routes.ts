import { Router } from 'express';
import { ApiController } from '../../controllers/api.controller.js';
import * as schedulerHandlers from '../../controllers/system/scheduler.controller.js';

export function registerSchedulerRoutes(router: Router, apiController: ApiController): void {
  // Scheduler Routes
  router.post('/schedule', (req, res) => schedulerHandlers.scheduleCheck.call(apiController, req, res));
  router.get('/schedule', (req, res) => schedulerHandlers.getScheduledChecks.call(apiController, req, res));
  router.delete('/schedule/:id', (req, res) => schedulerHandlers.cancelScheduledCheck.call(apiController, req, res));
  router.post('/schedule/restore', (req, res) => schedulerHandlers.restoreScheduledChecks.call(apiController, req, res));
}
