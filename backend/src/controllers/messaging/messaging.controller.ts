/**
 * Messaging Controller
 *
 * HTTP request handlers for the message queue system. Provides endpoints
 * for monitoring queue status, viewing messages, and managing the queue.
 *
 * @module controllers/messaging/messaging.controller
 */

import type { Request, Response, NextFunction } from 'express';
import { LoggerService, ComponentLogger } from '../../services/core/logger.service.js';
import type { MessageQueueService } from '../../services/messaging/message-queue.service.js';

/** Module-level reference to the queue service */
let messageQueueService: MessageQueueService | null = null;

/** Logger instance */
const logger: ComponentLogger = LoggerService.getInstance().createComponentLogger('MessagingController');

/**
 * Set the message queue service instance.
 * Called during server initialization.
 *
 * @param service - The MessageQueueService instance
 */
export function setMessageQueueService(service: MessageQueueService): void {
  messageQueueService = service;
}

/**
 * GET /api/messaging/queue/status
 *
 * Get the current queue status summary.
 *
 * @param req - Request
 * @param res - Response with QueueStatus
 */
export async function getQueueStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!messageQueueService) {
      res.status(503).json({ success: false, error: 'Message queue not initialized' });
      return;
    }

    const status = messageQueueService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/messaging/queue/messages
 *
 * Get all pending messages in the queue.
 *
 * @param req - Request
 * @param res - Response with pending messages
 */
export async function getPendingMessages(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!messageQueueService) {
      res.status(503).json({ success: false, error: 'Message queue not initialized' });
      return;
    }

    const messages = messageQueueService.getPendingMessages();
    res.json({ success: true, data: messages, count: messages.length });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/messaging/queue/history
 *
 * Get processed message history.
 *
 * @param req - Request
 * @param res - Response with message history
 */
export async function getMessageHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!messageQueueService) {
      res.status(503).json({ success: false, error: 'Message queue not initialized' });
      return;
    }

    const history = messageQueueService.getHistory();
    res.json({ success: true, data: history, count: history.length });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/messaging/queue/messages/:messageId
 *
 * Get a specific message by ID.
 *
 * @param req - Request with messageId param
 * @param res - Response with the message
 */
export async function getMessageById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!messageQueueService) {
      res.status(503).json({ success: false, error: 'Message queue not initialized' });
      return;
    }

    const { messageId } = req.params;
    const message = messageQueueService.getMessage(messageId);

    if (!message) {
      res.status(404).json({ success: false, error: 'Message not found' });
      return;
    }

    res.json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/messaging/queue/messages/:messageId
 *
 * Cancel a pending message.
 *
 * @param req - Request with messageId param
 * @param res - Response confirming cancellation
 */
export async function cancelMessage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!messageQueueService) {
      res.status(503).json({ success: false, error: 'Message queue not initialized' });
      return;
    }

    const { messageId } = req.params;
    const cancelled = messageQueueService.cancel(messageId);

    if (!cancelled) {
      res.status(404).json({
        success: false,
        error: 'Message not found or not in pending state',
      });
      return;
    }

    res.json({ success: true, message: 'Message cancelled' });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/messaging/queue
 *
 * Clear all pending messages from the queue.
 *
 * @param req - Request
 * @param res - Response with count of cleared messages
 */
export async function clearQueue(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!messageQueueService) {
      res.status(503).json({ success: false, error: 'Message queue not initialized' });
      return;
    }

    const count = messageQueueService.clearPending();

    res.json({
      success: true,
      message: `Cleared ${count} pending messages`,
      data: { clearedCount: count },
    });
  } catch (error) {
    next(error);
  }
}
