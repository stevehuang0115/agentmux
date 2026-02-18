/**
 * Chat Service
 *
 * Manages chat conversations and messages for the conversational dashboard.
 * Handles message persistence, conversation management, and real-time updates
 * via event emission.
 *
 * @module services/chat/chat.service
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { atomicWriteJson, safeReadJson } from '../../utils/file-io.utils.js';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import {
  ChatMessage,
  ChatConversation,
  ChatSender,
  SendMessageInput,
  SendMessageResult,
  ChatMessageFilter,
  ConversationFilter,
  ChatContentType,
  ChatStorageFormat,
  ChatMessageEvent,
  ChatTypingEvent,
  ConversationUpdatedEvent,
  createChatMessage,
  createConversation,
  createLastMessagePreview,
  formatMessageContent,
  extractResponseFromOutput,
  detectContentType,
  validateSendMessageInput,
  CHAT_CONSTANTS,
} from '../../types/chat.types.js';

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Error thrown when a conversation is not found
 */
export class ConversationNotFoundError extends Error {
  constructor(public readonly conversationId: string) {
    super(`Conversation not found: ${conversationId}`);
    this.name = 'ConversationNotFoundError';
  }
}

/**
 * Error thrown when message validation fails
 */
export class MessageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MessageValidationError';
  }
}

// =============================================================================
// Service Options
// =============================================================================

/**
 * Configuration options for the ChatService
 */
export interface ChatServiceOptions {
  /** Directory to store chat data (default: ~/.agentmux/chat) */
  chatDir?: string;
}

// =============================================================================
// Chat Service
// =============================================================================

/**
 * Service for managing chat conversations and messages
 *
 * Handles:
 * - Message persistence to ~/.agentmux/chat/
 * - Conversation management
 * - Message formatting (raw terminal → clean chat)
 * - WebSocket event emission for real-time updates
 *
 * @example
 * ```typescript
 * const chatService = getChatService();
 * await chatService.initialize();
 *
 * // Send a message
 * const result = await chatService.sendMessage({
 *   content: 'Hello, Orchestrator!',
 * });
 *
 * // Get messages
 * const messages = await chatService.getMessages({
 *   conversationId: result.conversation.id,
 * });
 * ```
 */
export class ChatService extends EventEmitter {
  private readonly chatDir: string;
  private readonly logger: ComponentLogger;
  private conversations: Map<string, ChatConversation> = new Map();
  private messages: Map<string, ChatMessage[]> = new Map();
  private initialized = false;
  /** Per-conversation save serialization to prevent concurrent write corruption */
  private savePromises: Map<string, Promise<void>> = new Map();

  /**
   * Create a new ChatService instance
   *
   * @param options - Configuration options
   */
  constructor(options?: ChatServiceOptions) {
    super();
    this.chatDir =
      options?.chatDir ?? path.join(process.env.HOME || '~', '.agentmux', 'chat');
    this.logger = LoggerService.getInstance().createComponentLogger('ChatService');
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Initialize the chat service
   *
   * Creates the chat directory if it doesn't exist and loads
   * existing conversations from disk.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await fs.mkdir(this.chatDir, { recursive: true });
    await this.loadConversations();
    this.initialized = true;
  }

  /**
   * Check if the service is initialized
   *
   * @returns True if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Ensure the service is initialized before performing operations
   *
   * @throws Error if not initialized and auto-initialize fails
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // ===========================================================================
  // Message Operations
  // ===========================================================================

  /**
   * Send a message (from user to orchestrator)
   *
   * @param input - Message input
   * @returns The sent message and conversation
   * @throws MessageValidationError if input is invalid
   *
   * @example
   * ```typescript
   * const result = await chatService.sendMessage({
   *   content: 'Start the project analysis',
   * });
   * console.log(result.message.id);
   * ```
   */
  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    await this.ensureInitialized();

    // Validate input
    const validation = validateSendMessageInput(input);
    if (!validation.valid) {
      throw new MessageValidationError(validation.error || 'Invalid input');
    }

    let conversation: ChatConversation;

    if (input.conversationId) {
      const existing = this.conversations.get(input.conversationId);
      if (existing) {
        conversation = existing;
      } else {
        conversation = await this.createNewConversation(undefined, input.conversationId);
      }
    } else {
      conversation = await this.createNewConversation();
    }

    const message = createChatMessage({
      conversationId: conversation.id,
      content: input.content,
      from: { type: 'user', name: 'You' },
      contentType: 'text',
      status: 'sent',
      metadata: input.metadata as Record<string, unknown> | undefined,
    });

    await this.saveMessage(message);
    await this.updateConversationWithMessage(conversation.id, message);

    this.emit('message', message);
    this.emitChatMessageEvent(message);

    return { message, conversation: this.conversations.get(conversation.id)! };
  }

  /**
   * Add a message from an agent or orchestrator
   *
   * Typically called when processing terminal output. Extracts and
   * formats the response content.
   *
   * @param conversationId - Conversation to add the message to
   * @param rawOutput - Raw terminal output
   * @param sender - Sender information
   * @param metadata - Optional metadata
   * @returns The created message
   *
   * @example
   * ```typescript
   * const message = await chatService.addAgentMessage(
   *   'conv-123',
   *   '[RESPONSE]Task completed successfully[/RESPONSE]',
   *   { type: 'orchestrator', name: 'Orchestrator' }
   * );
   * ```
   */
  async addAgentMessage(
    conversationId: string,
    rawOutput: string,
    sender: ChatSender,
    metadata?: Record<string, unknown>
  ): Promise<ChatMessage> {
    await this.ensureInitialized();

    // Extract and format the response
    const extractedContent = extractResponseFromOutput(rawOutput);
    const formattedContent = formatMessageContent(extractedContent);

    // Determine content type
    const contentType = detectContentType(formattedContent);

    const message = createChatMessage({
      conversationId,
      content: formattedContent,
      from: sender,
      contentType,
      status: 'delivered',
      metadata: {
        ...metadata,
        rawOutput,
      },
    });

    await this.saveMessage(message);
    await this.updateConversationWithMessage(conversationId, message);

    this.emit('message', message);
    this.emitChatMessageEvent(message);

    return message;
  }

  /**
   * Add a message with pre-extracted content (no regex extraction).
   *
   * Unlike `addAgentMessage`, this method skips `extractResponseFromOutput()`
   * and takes already-cleaned content directly. Used by the unified [NOTIFY]
   * marker handler where content is extracted from JSON payload.
   *
   * Emits the `'message'` event that QueueProcessor's `waitForResponse()` depends on.
   *
   * @param conversationId - Conversation to add the message to
   * @param content - Pre-extracted markdown content
   * @param sender - Sender information
   * @param metadata - Optional metadata
   * @returns The created message
   *
   * @example
   * ```typescript
   * const message = await chatService.addDirectMessage(
   *   'conv-123',
   *   '## Status Update\n\nEmily is working...',
   *   { type: 'orchestrator', name: 'Orchestrator' }
   * );
   * ```
   */
  async addDirectMessage(
    conversationId: string,
    content: string,
    sender: ChatSender,
    metadata?: Record<string, unknown>
  ): Promise<ChatMessage> {
    await this.ensureInitialized();

    const formattedContent = formatMessageContent(content);
    const contentType = detectContentType(formattedContent);

    const message = createChatMessage({
      conversationId,
      content: formattedContent,
      from: sender,
      contentType,
      status: 'delivered',
      metadata,
    });

    await this.saveMessage(message);
    await this.updateConversationWithMessage(conversationId, message);

    this.emit('message', message);
    this.emitChatMessageEvent(message);

    return message;
  }

  /**
   * Add a system message to a conversation
   *
   * @param conversationId - Conversation to add the message to
   * @param content - Message content
   * @param metadata - Optional metadata
   * @returns The created message
   */
  async addSystemMessage(
    conversationId: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<ChatMessage> {
    await this.ensureInitialized();

    const message = createChatMessage({
      conversationId,
      content,
      from: { type: 'system', name: 'System' },
      contentType: 'system',
      status: 'delivered',
      metadata,
    });

    await this.saveMessage(message);
    this.emitChatMessageEvent(message);

    return message;
  }

  /**
   * Get messages for a conversation
   *
   * @param filter - Message filter options
   * @returns Array of messages matching the filter
   *
   * @example
   * ```typescript
   * const messages = await chatService.getMessages({
   *   conversationId: 'conv-123',
   *   limit: 50,
   *   senderType: 'user',
   * });
   * ```
   */
  async getMessages(filter: ChatMessageFilter): Promise<ChatMessage[]> {
    await this.ensureInitialized();

    if (!filter.conversationId) {
      return [];
    }

    let messages = this.messages.get(filter.conversationId) ?? [];

    // Apply filters
    if (filter.senderType) {
      messages = messages.filter((m) => m.from.type === filter.senderType);
    }

    if (filter.contentType) {
      messages = messages.filter((m) => m.contentType === filter.contentType);
    }

    if (filter.after) {
      messages = messages.filter((m) => m.timestamp > filter.after!);
    }

    if (filter.before) {
      messages = messages.filter((m) => m.timestamp < filter.before!);
    }

    // Sort by timestamp
    messages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Apply pagination
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? CHAT_CONSTANTS.DEFAULTS.MESSAGE_LIMIT;

    return messages.slice(offset, offset + limit);
  }

  /**
   * Get a single message by ID
   *
   * @param conversationId - Conversation ID
   * @param messageId - Message ID
   * @returns The message or null if not found
   */
  async getMessage(conversationId: string, messageId: string): Promise<ChatMessage | null> {
    await this.ensureInitialized();

    const messages = this.messages.get(conversationId);
    if (!messages) return null;

    return messages.find((m) => m.id === messageId) ?? null;
  }

  /**
   * Update metadata on an existing message (partial merge).
   *
   * Merges the provided metadata fields into the message's existing metadata
   * and persists the change to disk. Used by the NOTIFY reconciliation system
   * to track Slack delivery status on chat messages.
   *
   * @param conversationId - Conversation the message belongs to
   * @param messageId - ID of the message to update
   * @param metadataPatch - Partial metadata to merge into existing metadata
   * @returns The updated message, or null if message not found
   */
  async updateMessageMetadata(
    conversationId: string,
    messageId: string,
    metadataPatch: Record<string, unknown>
  ): Promise<ChatMessage | null> {
    await this.ensureInitialized();

    const messages = this.messages.get(conversationId);
    if (!messages) return null;

    const message = messages.find((m) => m.id === messageId);
    if (!message) return null;

    message.metadata = { ...message.metadata, ...metadataPatch };

    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      await this.saveConversation(conversation);
    }

    return message;
  }

  /**
   * Find all messages with pending Slack delivery within a time window.
   *
   * Scans all conversations for messages where `slackDeliveryStatus === 'pending'`
   * and `slackChannelId` is present, filtering out messages older than `maxAgeMs`.
   * Used by NotifyReconciliationService to find messages that need retry.
   *
   * @param maxAgeMs - Maximum message age in milliseconds
   * @returns Array of messages with pending Slack delivery
   */
  async getMessagesWithPendingSlackDelivery(maxAgeMs: number): Promise<ChatMessage[]> {
    await this.ensureInitialized();

    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
    const pending: ChatMessage[] = [];

    for (const messages of this.messages.values()) {
      for (const msg of messages) {
        if (
          msg.metadata?.slackDeliveryStatus === 'pending' &&
          msg.metadata?.slackChannelId &&
          msg.timestamp >= cutoff
        ) {
          pending.push(msg);
        }
      }
    }

    return pending;
  }

  // ===========================================================================
  // Conversation Operations
  // ===========================================================================

  /**
   * Get all conversations
   *
   * @param filter - Optional filter options
   * @returns Array of conversations
   *
   * @example
   * ```typescript
   * const conversations = await chatService.getConversations({
   *   includeArchived: false,
   *   search: 'project',
   * });
   * ```
   */
  async getConversations(filter?: ConversationFilter): Promise<ChatConversation[]> {
    await this.ensureInitialized();

    let conversations = Array.from(this.conversations.values());

    // Filter archived
    if (!filter?.includeArchived) {
      conversations = conversations.filter((c) => !c.isArchived);
    }

    // Search
    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      conversations = conversations.filter(
        (c) =>
          c.title?.toLowerCase().includes(searchLower) ||
          c.lastMessage?.content.toLowerCase().includes(searchLower)
      );
    }

    // Sort by last update (most recent first)
    conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    // Apply pagination
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? CHAT_CONSTANTS.DEFAULTS.CONVERSATION_LIMIT;

    return conversations.slice(offset, offset + limit);
  }

  /**
   * Get a single conversation by ID
   *
   * @param id - Conversation ID
   * @returns The conversation or null if not found
   */
  async getConversation(id: string): Promise<ChatConversation | null> {
    await this.ensureInitialized();
    return this.conversations.get(id) ?? null;
  }

  /**
   * Create a new conversation
   *
   * @param title - Optional title for the conversation
   * @returns The created conversation
   *
   * @example
   * ```typescript
   * const conversation = await chatService.createNewConversation('Project Discussion');
   * ```
   */
  async createNewConversation(title?: string, idOverride?: string): Promise<ChatConversation> {
    await this.ensureInitialized();

    const conversation = createConversation(title, idOverride);

    this.conversations.set(conversation.id, conversation);
    this.messages.set(conversation.id, []);

    await this.saveConversation(conversation);

    this.emitConversationUpdatedEvent(conversation);

    return conversation;
  }

  /**
   * Update a conversation's title
   *
   * @param id - Conversation ID
   * @param title - New title
   * @returns The updated conversation
   * @throws ConversationNotFoundError if conversation doesn't exist
   */
  async updateConversationTitle(id: string, title: string): Promise<ChatConversation> {
    await this.ensureInitialized();

    const conversation = this.conversations.get(id);
    if (!conversation) {
      throw new ConversationNotFoundError(id);
    }

    conversation.title = title;
    conversation.updatedAt = new Date().toISOString();

    await this.saveConversation(conversation);
    this.emitConversationUpdatedEvent(conversation);

    return conversation;
  }

  /**
   * Archive a conversation
   *
   * @param id - Conversation ID
   * @throws ConversationNotFoundError if conversation doesn't exist
   */
  async archiveConversation(id: string): Promise<void> {
    await this.ensureInitialized();

    const conversation = this.conversations.get(id);
    if (!conversation) {
      throw new ConversationNotFoundError(id);
    }

    conversation.isArchived = true;
    conversation.updatedAt = new Date().toISOString();

    await this.saveConversation(conversation);
    this.emitConversationUpdatedEvent(conversation);
  }

  /**
   * Unarchive a conversation
   *
   * @param id - Conversation ID
   * @throws ConversationNotFoundError if conversation doesn't exist
   */
  async unarchiveConversation(id: string): Promise<void> {
    await this.ensureInitialized();

    const conversation = this.conversations.get(id);
    if (!conversation) {
      throw new ConversationNotFoundError(id);
    }

    conversation.isArchived = false;
    conversation.updatedAt = new Date().toISOString();

    await this.saveConversation(conversation);
    this.emitConversationUpdatedEvent(conversation);
  }

  /**
   * Delete a conversation and all its messages
   *
   * @param id - Conversation ID
   */
  async deleteConversation(id: string): Promise<void> {
    await this.ensureInitialized();

    this.conversations.delete(id);
    this.messages.delete(id);

    // Wait for any pending save to finish before deleting the file
    const pending = this.savePromises.get(id);
    if (pending) {
      await pending.catch(() => {});
      this.savePromises.delete(id);
    }

    const conversationFile = path.join(this.chatDir, `${id}.json`);
    await fs.rm(conversationFile, { force: true });
  }

  /**
   * Clear all messages from a conversation
   *
   * @param id - Conversation ID
   */
  async clearConversation(id: string): Promise<void> {
    await this.ensureInitialized();

    this.messages.set(id, []);

    const conversation = this.conversations.get(id);
    if (conversation) {
      conversation.messageCount = 0;
      conversation.lastMessage = undefined;
      conversation.updatedAt = new Date().toISOString();
      await this.saveConversation(conversation);
      this.emitConversationUpdatedEvent(conversation);
    }
  }

  /**
   * Get the current/active conversation (most recently updated non-archived)
   *
   * @returns The most recent active conversation or null
   */
  async getCurrentConversation(): Promise<ChatConversation | null> {
    const conversations = await this.getConversations({ limit: 1 });
    return conversations[0] ?? null;
  }

  // ===========================================================================
  // Real-time Events
  // ===========================================================================

  /**
   * Emit typing indicator event
   *
   * @param conversationId - Conversation ID
   * @param sender - Sender information
   * @param isTyping - Whether the sender is typing
   */
  emitTypingIndicator(conversationId: string, sender: ChatSender, isTyping: boolean): void {
    const event: ChatTypingEvent = {
      type: 'chat_typing',
      data: { conversationId, sender, isTyping },
    };
    this.emit('chat_typing', event);
  }

  /**
   * Emit a chat message event
   *
   * @param message - The message to emit
   */
  private emitChatMessageEvent(message: ChatMessage): void {
    const event: ChatMessageEvent = {
      type: 'chat_message',
      data: message,
    };
    this.emit('chat_message', event);
  }

  /**
   * Emit a conversation updated event
   *
   * @param conversation - The updated conversation
   */
  private emitConversationUpdatedEvent(conversation: ChatConversation): void {
    const event: ConversationUpdatedEvent = {
      type: 'conversation_updated',
      data: conversation,
    };
    this.emit('conversation_updated', event);
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get statistics about chat usage
   *
   * @returns Statistics object
   */
  async getStatistics(): Promise<{
    totalConversations: number;
    activeConversations: number;
    archivedConversations: number;
    totalMessages: number;
  }> {
    await this.ensureInitialized();

    const conversations = Array.from(this.conversations.values());
    const activeConversations = conversations.filter((c) => !c.isArchived);
    const archivedConversations = conversations.filter((c) => c.isArchived);

    let totalMessages = 0;
    for (const messages of this.messages.values()) {
      totalMessages += messages.length;
    }

    return {
      totalConversations: conversations.length,
      activeConversations: activeConversations.length,
      archivedConversations: archivedConversations.length,
      totalMessages,
    };
  }

  // ===========================================================================
  // Persistence
  // ===========================================================================

  /**
   * Load all conversations from disk
   */
  private async loadConversations(): Promise<void> {
    try {
      const files = await fs.readdir(this.chatDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      for (const file of jsonFiles) {
        const filePath = path.join(this.chatDir, file);
        const data = await safeReadJson<ChatStorageFormat | null>(filePath, null);

        if (data?.conversation) {
          this.conversations.set(data.conversation.id, data.conversation);
          this.messages.set(data.conversation.id, data.messages ?? []);
        }
      }
    } catch (error) {
      // Directory might not exist yet, which is fine
      this.logger.debug('Failed to load conversations', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Save a conversation and its messages to disk using atomic write (write-to-tmp + rename).
   * Serialized per conversation to prevent concurrent writes from corrupting the file.
   *
   * @param conversation - Conversation to save
   */
  private async saveConversation(conversation: ChatConversation): Promise<void> {
    const id = conversation.id;
    const prev = this.savePromises.get(id) ?? Promise.resolve();
    const next = prev
      .catch(() => {})
      .then(() => this.doSaveConversation(conversation));
    this.savePromises.set(id, next);
    await next;
  }

  /**
   * Perform the actual atomic file write for a conversation.
   * Writes to a temporary file first, then renames to the final path to prevent corruption.
   *
   * @param conversation - Conversation to save
   */
  private async doSaveConversation(conversation: ChatConversation): Promise<void> {
    const messages = this.messages.get(conversation.id) ?? [];
    const storage: ChatStorageFormat = { conversation, messages };
    const filePath = path.join(this.chatDir, `${conversation.id}.json`);
    await atomicWriteJson(filePath, storage);
  }

  /**
   * Save a message to the in-memory store and persist to disk
   *
   * @param message - Message to save
   */
  private async saveMessage(message: ChatMessage): Promise<void> {
    const messages = this.messages.get(message.conversationId) ?? [];
    messages.push(message);
    this.messages.set(message.conversationId, messages);

    const conversation = this.conversations.get(message.conversationId);
    if (conversation) {
      await this.saveConversation(conversation);
    }
  }

  /**
   * Update a conversation's metadata after adding a message
   *
   * @param conversationId - Conversation ID
   * @param message - The added message
   */
  private async updateConversationWithMessage(
    conversationId: string,
    message: ChatMessage
  ): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;

    conversation.messageCount += 1;
    conversation.lastMessage = createLastMessagePreview(message);
    conversation.updatedAt = new Date().toISOString();

    // Add participant if new
    const senderId = message.from.id ?? message.from.type;
    if (!conversation.participantIds.includes(senderId)) {
      conversation.participantIds.push(senderId);
    }

    await this.saveConversation(conversation);
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let chatServiceInstance: ChatService | null = null;

/**
 * Get the singleton ChatService instance
 *
 * @returns The ChatService instance
 */
export function getChatService(): ChatService {
  if (!chatServiceInstance) {
    chatServiceInstance = new ChatService();
  }
  return chatServiceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetChatService(): void {
  chatServiceInstance = null;
}
