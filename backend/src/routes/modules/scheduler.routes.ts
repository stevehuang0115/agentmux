import { Router } from 'express';
import { ApiController } from '../../controllers/api.controller.js';
import * as schedulerHandlers from '../../controllers/domains/scheduler.handlers.js';

export function registerSchedulerRoutes(router: Router, apiController: ApiController): void {
  // Scheduler Routes
  router.post('/schedule', (req, res) => schedulerHandlers.scheduleCheck.call(apiController, req, res));
  router.get('/schedule', (req, res) => schedulerHandlers.getScheduledChecks.call(apiController, req, res));
  router.delete('/schedule/:id', (req, res) => schedulerHandlers.cancelScheduledCheck.call(apiController, req, res));
}
