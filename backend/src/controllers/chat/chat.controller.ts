/**
 * Chat Controller
 *
 * HTTP request handlers for chat functionality. Provides endpoints for
 * sending messages, managing conversations, and retrieving chat history.
 *
 * @module controllers/chat/chat.controller
 */

import type { Request, Response, NextFunction } from 'express';
import {
  getChatService,
  MessageValidationError,
  ConversationNotFoundError,
} from '../../services/chat/chat.service.js';
import { AgentRegistrationService } from '../../services/agent/agent-registration.service.js';
import { ORCHESTRATOR_SESSION_NAME } from '../../constants.js';
import { getTerminalGateway } from '../../websocket/terminal.gateway.js';
import type {
  SendMessageInput,
  ChatMessageFilter,
  ConversationFilter,
  ChatSenderType,
  ChatContentType,
} from '../../types/chat.types.js';

// Module-level agent registration service instance
let agentRegistrationService: AgentRegistrationService | null = null;

/**
 * Set the agent registration service for forwarding messages to orchestrator.
 * Called during server initialization.
 *
 * @param service - The AgentRegistrationService instance
 */
export function setAgentRegistrationService(service: AgentRegistrationService): void {
  agentRegistrationService = service;
}

/**
 * Forward a message to the orchestrator terminal.
 *
 * @param content - Message content to send
 * @param conversationId - Conversation ID for context
 * @returns Success status and any error message
 */
async function forwardToOrchestrator(
  content: string,
  conversationId: string
): Promise<{ success: boolean; error?: string }> {
  if (!agentRegistrationService) {
    return { success: false, error: 'Agent registration service not available' };
  }

  try {
    // Set active conversation ID for response routing
    const terminalGateway = getTerminalGateway();
    if (terminalGateway) {
      terminalGateway.setActiveConversationId(conversationId);
    }

    // Format message with conversation context
    const formattedMessage = `[CHAT:${conversationId}] ${content}`;

    const result = await agentRegistrationService.sendMessageToAgent(
      ORCHESTRATOR_SESSION_NAME,
      formattedMessage
    );

    return result;
  } catch (error) {
    console.error('Failed to forward message to orchestrator:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Message Endpoints
// =============================================================================

/**
 * POST /api/chat/send
 *
 * Send a message to the orchestrator. Creates a new conversation if
 * conversationId is not provided.
 *
 * @param req - Request with body: { content: string, conversationId?: string, metadata?: object }
 * @param res - Response with sent message and conversation
 */
export async function sendMessage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { content, conversationId, metadata, forwardToOrchestrator: shouldForward = true } = req.body;

    if (!content || (typeof content === 'string' && content.trim().length === 0)) {
      res.status(400).json({
        success: false,
        error: 'Message content is required',
      });
      return;
    }

    const input: SendMessageInput = {
      content,
      conversationId,
      metadata,
    };

    const chatService = getChatService();
    const result = await chatService.sendMessage(input);

    // Forward to orchestrator if enabled (default: true)
    let orchestratorStatus: { forwarded: boolean; error?: string } = { forwarded: false };

    if (shouldForward) {
      const forwardResult = await forwardToOrchestrator(content, result.conversation.id);
      orchestratorStatus = {
        forwarded: forwardResult.success,
        error: forwardResult.error,
      };

      // Update message status if forwarding failed
      if (!forwardResult.success) {
        console.warn('Failed to forward message to orchestrator:', forwardResult.error);
      }
    }

    res.status(201).json({
      success: true,
      data: {
        ...result,
        orchestrator: orchestratorStatus,
      },
    });
  } catch (error) {
    if (error instanceof MessageValidationError) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
      return;
    }
    next(error);
  }
}

/**
 * GET /api/chat/messages
 *
 * Get messages for a conversation with optional filtering.
 *
 * @param req - Request with query params for filtering
 * @param res - Response with array of messages
 */
export async function getMessages(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { conversationId, senderType, contentType, after, before, limit, offset } = req.query;

    if (!conversationId) {
      res.status(400).json({
        success: false,
        error: 'conversationId is required',
      });
      return;
    }

    const filter: ChatMessageFilter = {
      conversationId: conversationId as string,
      senderType: senderType as ChatSenderType | undefined,
      contentType: contentType as ChatContentType | undefined,
      after: after as string | undefined,
      before: before as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    };

    const chatService = getChatService();
    const messages = await chatService.getMessages(filter);

    res.json({
      success: true,
      data: messages,
      count: messages.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/chat/messages/:conversationId/:messageId
 *
 * Get a single message by ID.
 *
 * @param req - Request with conversationId and messageId params
 * @param res - Response with the message
 */
export async function getMessage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { conversationId, messageId } = req.params;

    const chatService = getChatService();
    const message = await chatService.getMessage(conversationId, messageId);

    if (!message) {
      res.status(404).json({
        success: false,
        error: 'Message not found',
      });
      return;
    }

    res.json({
      success: true,
      data: message,
    });
  } catch (error) {
    next(error);
  }
}

// =============================================================================
// Conversation Endpoints
// =============================================================================

/**
 * GET /api/chat/conversations
 *
 * List all conversations with optional filtering.
 *
 * @param req - Request with query params for filtering
 * @param res - Response with array of conversations
 */
export async function getConversations(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { includeArchived, search, limit, offset } = req.query;

    const filter: ConversationFilter = {
      includeArchived: includeArchived === 'true',
      search: search as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    };

    const chatService = getChatService();
    const conversations = await chatService.getConversations(filter);

    res.json({
      success: true,
      data: conversations,
      count: conversations.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/chat/conversations/current
 *
 * Get the current (most recent active) conversation.
 * Creates a new conversation if none exists.
 *
 * @param req - Request
 * @param res - Response with current conversation
 */
export async function getCurrentConversation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const chatService = getChatService();
    const conversation = await chatService.getCurrentConversation();

    if (!conversation) {
      // Create a new conversation if none exists
      const newConversation = await chatService.createNewConversation('New Chat');
      res.json({
        success: true,
        data: newConversation,
        isNew: true,
      });
      return;
    }

    res.json({
      success: true,
      data: conversation,
      isNew: false,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/chat/conversations/:id
 *
 * Get a single conversation by ID.
 *
 * @param req - Request with conversation ID param
 * @param res - Response with the conversation
 */
export async function getConversation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const chatService = getChatService();
    const conversation = await chatService.getConversation(id);

    if (!conversation) {
      res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
      return;
    }

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/chat/conversations
 *
 * Create a new conversation.
 *
 * @param req - Request with body: { title?: string }
 * @param res - Response with created conversation
 */
export async function createConversation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { title } = req.body;

    const chatService = getChatService();
    const conversation = await chatService.createNewConversation(title);

    res.status(201).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/chat/conversations/:id
 *
 * Update a conversation's title.
 *
 * @param req - Request with conversation ID param and body: { title: string }
 * @param res - Response with updated conversation
 */
export async function updateConversation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title || typeof title !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Title is required',
      });
      return;
    }

    const chatService = getChatService();
    const conversation = await chatService.updateConversationTitle(id, title);

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    if (error instanceof ConversationNotFoundError) {
      res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
      return;
    }
    next(error);
  }
}

/**
 * PUT /api/chat/conversations/:id/archive
 *
 * Archive a conversation.
 *
 * @param req - Request with conversation ID param
 * @param res - Response confirming archive
 */
export async function archiveConversation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const chatService = getChatService();
    await chatService.archiveConversation(id);

    res.json({
      success: true,
      message: 'Conversation archived',
    });
  } catch (error) {
    if (error instanceof ConversationNotFoundError) {
      res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
      return;
    }
    next(error);
  }
}

/**
 * PUT /api/chat/conversations/:id/unarchive
 *
 * Unarchive a conversation.
 *
 * @param req - Request with conversation ID param
 * @param res - Response confirming unarchive
 */
export async function unarchiveConversation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const chatService = getChatService();
    await chatService.unarchiveConversation(id);

    res.json({
      success: true,
      message: 'Conversation unarchived',
    });
  } catch (error) {
    if (error instanceof ConversationNotFoundError) {
      res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
      return;
    }
    next(error);
  }
}

/**
 * DELETE /api/chat/conversations/:id
 *
 * Delete a conversation and all its messages.
 *
 * @param req - Request with conversation ID param
 * @param res - Response confirming deletion
 */
export async function deleteConversation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const chatService = getChatService();
    await chatService.deleteConversation(id);

    res.json({
      success: true,
      message: 'Conversation deleted',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/chat/conversations/:id/clear
 *
 * Clear all messages in a conversation.
 *
 * @param req - Request with conversation ID param
 * @param res - Response confirming clear
 */
export async function clearConversation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const chatService = getChatService();
    await chatService.clearConversation(id);

    res.json({
      success: true,
      message: 'Conversation cleared',
    });
  } catch (error) {
    next(error);
  }
}

// =============================================================================
// Statistics Endpoint
// =============================================================================

/**
 * GET /api/chat/statistics
 *
 * Get chat statistics.
 *
 * @param req - Request
 * @param res - Response with statistics
 */
export async function getStatistics(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const chatService = getChatService();
    const statistics = await chatService.getStatistics();

    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    next(error);
  }
}
