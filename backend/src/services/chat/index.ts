/**
 * Chat Service Module
 *
 * Exports the chat service for managing conversations and messages
 * in the chat-based dashboard.
 *
 * @module services/chat
 */

export {
  ChatService,
  ChatServiceOptions,
  getChatService,
  resetChatService,
  ConversationNotFoundError,
  MessageValidationError,
} from './chat.service.js';
