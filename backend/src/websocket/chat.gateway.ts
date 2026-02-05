/**
 * Chat Gateway Module
 *
 * Integrates chat functionality with the WebSocket infrastructure.
 * Forwards chat events from ChatService to connected clients.
 *
 * @module websocket/chat.gateway
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { getChatService, ChatService } from '../services/chat/chat.service.js';
import { LoggerService, ComponentLogger } from '../services/core/logger.service.js';
import type {
  ChatMessage,
  ChatConversation,
  ChatSender,
  ChatMessageEvent,
  ChatTypingEvent,
  ConversationUpdatedEvent,
} from '../types/chat.types.js';

/**
 * Chat Gateway class for WebSocket-based chat messaging.
 *
 * Provides:
 * - Real-time chat message broadcasting
 * - Typing indicator support
 * - Conversation update notifications
 * - Terminal output to chat message processing
 */
export class ChatGateway {
  private io: SocketIOServer;
  private logger: ComponentLogger;
  private chatService: ChatService;
  private initialized = false;

  /**
   * Create a new ChatGateway.
   *
   * @param io - Socket.IO server instance
   */
  constructor(io: SocketIOServer) {
    this.io = io;
    this.logger = LoggerService.getInstance().createComponentLogger('ChatGateway');
    this.chatService = getChatService();
  }

  /**
   * Initialize the chat gateway.
   *
   * Sets up event listeners from ChatService and WebSocket handlers.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure ChatService is initialized
    if (!this.chatService.isInitialized()) {
      await this.chatService.initialize();
    }

    // Set up ChatService event listeners
    this.setupChatServiceListeners();

    // Set up WebSocket event handlers
    this.setupWebSocketHandlers();

    this.initialized = true;
    this.logger.info('ChatGateway initialized');
  }

  /**
   * Set up listeners for ChatService events to broadcast to WebSocket clients.
   */
  private setupChatServiceListeners(): void {
    // Forward chat messages to all connected clients
    this.chatService.on('chat_message', (event: ChatMessageEvent) => {
      this.logger.debug('Broadcasting chat_message', { messageId: event.data.id });
      this.broadcast('chat_message', {
        type: 'chat_message',
        data: event.data,
        timestamp: new Date().toISOString(),
      });
    });

    // Forward typing indicators
    this.chatService.on('chat_typing', (event: ChatTypingEvent) => {
      this.logger.debug('Broadcasting chat_typing', {
        conversationId: event.data.conversationId,
        isTyping: event.data.isTyping,
      });
      this.broadcast('chat_typing', {
        type: 'chat_typing',
        data: event.data,
        timestamp: new Date().toISOString(),
      });
    });

    // Forward conversation updates
    this.chatService.on('conversation_updated', (event: ConversationUpdatedEvent) => {
      this.logger.debug('Broadcasting conversation_updated', {
        conversationId: event.data.id,
      });
      this.broadcast('conversation_updated', {
        type: 'conversation_updated',
        data: event.data,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Set up WebSocket event handlers for chat-specific events.
   */
  private setupWebSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      // Handle chat conversation subscription
      socket.on('subscribe_to_chat', async (conversationId?: string) => {
        this.logger.debug('Client subscribing to chat', {
          socketId: socket.id,
          conversationId,
        });

        // Join chat room
        socket.join('chat');

        if (conversationId) {
          socket.join(`chat_${conversationId}`);
        }

        // Send current conversation if requested
        if (conversationId) {
          const conversation = await this.chatService.getConversation(conversationId);
          if (conversation) {
            socket.emit('chat_conversation', {
              type: 'chat_conversation',
              data: conversation,
              timestamp: new Date().toISOString(),
            });
          }
        }

        socket.emit('chat_subscribed', {
          type: 'chat_subscribed',
          data: { conversationId },
          timestamp: new Date().toISOString(),
        });
      });

      // Handle unsubscription from chat
      socket.on('unsubscribe_from_chat', (conversationId?: string) => {
        socket.leave('chat');
        if (conversationId) {
          socket.leave(`chat_${conversationId}`);
        }
      });

      // Handle typing indicator from client
      socket.on('chat_typing', (data: { conversationId: string; isTyping: boolean }) => {
        // User typing indicators are just echoed to other clients
        socket.to(`chat_${data.conversationId}`).emit('chat_typing', {
          type: 'chat_typing',
          data: {
            conversationId: data.conversationId,
            sender: { type: 'user' as const },
            isTyping: data.isTyping,
          },
          timestamp: new Date().toISOString(),
        });
      });
    });
  }

  /**
   * Broadcast a message to all clients in the chat room.
   *
   * @param event - Event name
   * @param message - Message to broadcast
   */
  private broadcast(event: string, message: object): void {
    this.io.to('chat').emit(event, message);
  }

  /**
   * Broadcast a message to a specific conversation room.
   *
   * @param conversationId - Conversation ID
   * @param event - Event name
   * @param message - Message to broadcast
   */
  private broadcastToConversation(
    conversationId: string,
    event: string,
    message: object
  ): void {
    this.io.to(`chat_${conversationId}`).emit(event, message);
  }

  /**
   * Process terminal output and convert to chat message if applicable.
   *
   * Checks for response markers in terminal output and creates
   * chat messages from extracted content.
   *
   * @param sessionId - The session/agent ID that produced the output
   * @param output - Raw terminal output
   * @param conversationId - Target conversation ID
   * @returns The created chat message, or null if no response marker found
   */
  async processTerminalOutput(
    sessionId: string,
    output: string,
    conversationId?: string
  ): Promise<ChatMessage | null> {
    // Only process if there's an active conversation
    if (!conversationId) return null;

    // Check if output contains response markers
    const hasResponseMarker =
      output.includes('[RESPONSE]') ||
      output.includes('[CHAT_RESPONSE]') ||
      output.includes('```response');

    if (!hasResponseMarker) return null;

    try {
      // Extract and add as chat message
      const message = await this.chatService.addAgentMessage(
        conversationId,
        output,
        {
          type: 'orchestrator',
          id: sessionId,
          name: 'Orchestrator',
        },
        { sessionId }
      );

      this.logger.debug('Added agent message to chat', {
        messageId: message.id,
        conversationId,
      });

      return message;
    } catch (error) {
      this.logger.error('Failed to process terminal output for chat', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Emit a typing indicator for the orchestrator.
   *
   * Call this when the orchestrator starts/stops processing a message.
   *
   * @param conversationId - Conversation ID
   * @param isTyping - Whether the orchestrator is typing
   */
  emitOrchestratorTyping(conversationId: string, isTyping: boolean): void {
    this.chatService.emitTypingIndicator(
      conversationId,
      {
        type: 'orchestrator',
        name: 'Orchestrator',
      },
      isTyping
    );
  }

  /**
   * Emit a typing indicator for an agent.
   *
   * @param conversationId - Conversation ID
   * @param sender - Agent sender information
   * @param isTyping - Whether the agent is typing
   */
  emitAgentTyping(conversationId: string, sender: ChatSender, isTyping: boolean): void {
    this.chatService.emitTypingIndicator(conversationId, sender, isTyping);
  }

  /**
   * Check if the gateway is initialized.
   *
   * @returns True if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let chatGatewayInstance: ChatGateway | null = null;

/**
 * Initialize the ChatGateway with a Socket.IO server.
 *
 * @param io - Socket.IO server instance
 * @returns The ChatGateway instance
 */
export async function initializeChatGateway(io: SocketIOServer): Promise<ChatGateway> {
  if (!chatGatewayInstance) {
    chatGatewayInstance = new ChatGateway(io);
    await chatGatewayInstance.initialize();
  }
  return chatGatewayInstance;
}

/**
 * Get the ChatGateway instance.
 *
 * @returns The ChatGateway instance or null if not initialized
 */
export function getChatGateway(): ChatGateway | null {
  return chatGatewayInstance;
}

/**
 * Reset the ChatGateway instance (for testing).
 */
export function resetChatGateway(): void {
  chatGatewayInstance = null;
}
