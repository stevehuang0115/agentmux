/**
 * Chat Routes
 *
 * Express router configuration for chat API endpoints.
 *
 * @module controllers/chat/chat.routes
 */

import { Router } from 'express';
import {
  sendMessage,
  getMessages,
  getMessage,
  getConversations,
  getCurrentConversation,
  getConversation,
  createConversation,
  updateConversation,
  archiveConversation,
  unarchiveConversation,
  deleteConversation,
  clearConversation,
  getStatistics,
} from './chat.controller.js';

/**
 * Creates chat router with all chat-related endpoints
 *
 * @returns Express router configured with chat routes
 */
export function createChatRouter(): Router {
  const router = Router();

  // Message endpoints
  router.post('/send', sendMessage);
  router.get('/messages', getMessages);
  router.get('/messages/:conversationId/:messageId', getMessage);

  // Statistics
  router.get('/statistics', getStatistics);

  // Conversation endpoints - specific routes first
  router.get('/conversations/current', getCurrentConversation);
  router.get('/conversations', getConversations);
  router.post('/conversations', createConversation);
  router.get('/conversations/:id', getConversation);
  router.put('/conversations/:id', updateConversation);
  router.delete('/conversations/:id', deleteConversation);
  router.put('/conversations/:id/archive', archiveConversation);
  router.put('/conversations/:id/unarchive', unarchiveConversation);
  router.post('/conversations/:id/clear', clearConversation);

  return router;
}
