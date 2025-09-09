import { Router } from 'express';
import { ApiController } from '../../controllers/api.controller.js';
import * as deliveryHandlers from '../../controllers/domains/delivery-logs.handlers.js';

export function registerDeliveryLogRoutes(router: Router, apiController: ApiController): void {
  // Message Delivery Logs Routes
  router.get('/message-delivery-logs', (req, res) => deliveryHandlers.getDeliveryLogs.call(apiController, req, res));
  router.delete('/message-delivery-logs', (req, res) => deliveryHandlers.clearDeliveryLogs.call(apiController, req, res));
}
