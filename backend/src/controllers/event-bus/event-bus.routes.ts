/**
 * Event Bus Routes
 *
 * Router configuration for event subscription endpoints.
 *
 * @module controllers/event-bus/event-bus.routes
 */

import { Router } from 'express';
import {
  createSubscription,
  deleteSubscription,
  listSubscriptions,
  getSubscription,
} from './event-bus.controller.js';

/**
 * Create the event bus router with subscription management endpoints.
 *
 * @returns Express router for /api/events routes
 */
export function createEventBusRouter(): Router {
  const router = Router();

  // Create a subscription
  router.post('/subscribe', createSubscription);

  // Delete a subscription
  router.delete('/subscribe/:subscriptionId', deleteSubscription);

  // List subscriptions (optional ?subscriberSession= filter)
  router.get('/subscriptions', listSubscriptions);

  // Get single subscription by ID
  router.get('/subscriptions/:subscriptionId', getSubscription);

  return router;
}
