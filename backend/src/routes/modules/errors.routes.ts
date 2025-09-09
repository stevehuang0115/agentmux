import { Router } from 'express';
import { ApiController } from '../../controllers/api.controller.js';
import * as errorHandlers from '../../controllers/domains/errors.handlers.js';

export function registerErrorRoutes(router: Router, apiController: ApiController): void {
  // Error Tracking Routes
  router.post('/errors', (req, res) => errorHandlers.trackError.call(apiController, req, res));
  router.get('/errors/stats', (req, res) => errorHandlers.getErrorStats.call(apiController, req, res));
  router.get('/errors', (req, res) => errorHandlers.getErrors.call(apiController, req, res));
  router.get('/errors/:errorId', (req, res) => errorHandlers.getError.call(apiController, req, res));
  router.delete('/errors', (req, res) => errorHandlers.clearErrors.call(apiController, req, res));
}
