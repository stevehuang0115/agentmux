import { Router } from 'express';
import { ApiController } from '../../controllers/api.controller.js';
import * as scheduledHandlers from '../../controllers/messaging/scheduled-messages.controller.js';

export function registerScheduledMessageRoutes(router: Router, apiController: ApiController): void {
  // Scheduled Messages Routes
  router.post('/scheduled-messages', (req, res) => scheduledHandlers.createScheduledMessage.call(apiController, req, res));
  router.get('/scheduled-messages', (req, res) => scheduledHandlers.getScheduledMessages.call(apiController, req, res));
  router.get('/scheduled-messages/:id', (req, res) => scheduledHandlers.getScheduledMessage.call(apiController, req, res));
  router.put('/scheduled-messages/:id', (req, res) => scheduledHandlers.updateScheduledMessage.call(apiController, req, res));
  router.delete('/scheduled-messages/:id', (req, res) => scheduledHandlers.deleteScheduledMessage.call(apiController, req, res));
  router.post('/scheduled-messages/:id/toggle', (req, res) => scheduledHandlers.toggleScheduledMessage.call(apiController, req, res));
  router.post('/scheduled-messages/:id/run', (req, res) => scheduledHandlers.runScheduledMessage.call(apiController, req, res));
}
