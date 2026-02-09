/**
 * Messaging Routes
 *
 * Router configuration for message queue endpoints.
 *
 * @module controllers/messaging/messaging.routes
 */

import { Router } from 'express';
import {
  getQueueStatus,
  getPendingMessages,
  getMessageHistory,
  getMessageById,
  cancelMessage,
  clearQueue,
} from './messaging.controller.js';

/**
 * Create the messaging router with queue management endpoints.
 *
 * @returns Express router for /api/messaging routes
 */
export function createMessagingRouter(): Router {
  const router = Router();

  // Queue status
  router.get('/queue/status', getQueueStatus);

  // Pending messages
  router.get('/queue/messages', getPendingMessages);

  // Message history
  router.get('/queue/history', getMessageHistory);

  // Single message by ID
  router.get('/queue/messages/:messageId', getMessageById);

  // Cancel a pending message
  router.delete('/queue/messages/:messageId', cancelMessage);

  // Clear all pending messages
  router.delete('/queue', clearQueue);

  return router;
}
