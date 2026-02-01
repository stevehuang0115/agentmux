# Task: Create Chat Types and Service

## Overview

Create the type definitions and backend service for the chat-based dashboard. This provides a conversational interface with the Orchestrator, transforming raw terminal output into clean, formatted chat messages.

## Priority

**Sprint 3** - Chat System Backend

## Dependencies

- None (can be developed in parallel)

## Files to Create

### 1. `backend/src/types/chat.types.ts`

```typescript
/**
 * Sender type for chat messages
 */
export type ChatSenderType = 'user' | 'orchestrator' | 'agent' | 'system';

/**
 * Message content type
 */
export type ChatContentType = 'text' | 'status' | 'task' | 'error' | 'system' | 'code' | 'markdown';

/**
 * Message delivery status
 */
export type ChatMessageStatus = 'sending' | 'sent' | 'delivered' | 'error';

/**
 * Sender information for a chat message
 */
export interface ChatSender {
  /** Type of sender */
  type: ChatSenderType;

  /** ID of the agent/session if applicable */
  id?: string;

  /** Display name */
  name?: string;

  /** Role name if sender is an agent */
  role?: string;
}

/**
 * Metadata attached to a chat message
 */
export interface ChatMessageMetadata {
  /** ID of skill used to generate this response */
  skillUsed?: string;

  /** ID of task created as a result of this message */
  taskCreated?: string;

  /** ID of project created */
  projectCreated?: string;

  /** Original raw terminal output (for debugging) */
  rawOutput?: string;

  /** Agent session ID that generated this message */
  sessionId?: string;

  /** Time taken to generate response in ms */
  responseTimeMs?: number;

  /** Additional custom metadata */
  [key: string]: unknown;
}

/**
 * A single chat message
 */
export interface ChatMessage {
  /** Unique message ID */
  id: string;

  /** Conversation this message belongs to */
  conversationId: string;

  /** Sender information */
  from: ChatSender;

  /** Message content (may be markdown formatted) */
  content: string;

  /** Type of content */
  contentType: ChatContentType;

  /** Optional metadata */
  metadata?: ChatMessageMetadata;

  /** Delivery status */
  status: ChatMessageStatus;

  /** ISO timestamp */
  timestamp: string;

  /** Parent message ID for threading (optional) */
  parentId?: string;
}

/**
 * A chat conversation (collection of messages)
 */
export interface ChatConversation {
  /** Unique conversation ID */
  id: string;

  /** Conversation title (auto-generated or user-set) */
  title?: string;

  /** IDs of participants (user, orchestrator, agents) */
  participantIds: string[];

  /** ISO timestamp of creation */
  createdAt: string;

  /** ISO timestamp of last update */
  updatedAt: string;

  /** Whether this conversation is archived */
  isArchived: boolean;

  /** Number of messages in conversation */
  messageCount: number;

  /** Last message preview */
  lastMessage?: {
    content: string;
    timestamp: string;
    from: ChatSender;
  };
}

/**
 * Input for sending a new message
 */
export interface SendMessageInput {
  /** Message content */
  content: string;

  /** Conversation ID (creates new if not provided) */
  conversationId?: string;

  /** Optional metadata to attach */
  metadata?: Record<string, unknown>;
}

/**
 * Response from sending a message
 */
export interface SendMessageResult {
  /** The sent message */
  message: ChatMessage;

  /** The conversation (may be newly created) */
  conversation: ChatConversation;
}

/**
 * Filter options for listing messages
 */
export interface ChatMessageFilter {
  /** Filter by conversation */
  conversationId?: string;

  /** Filter by sender type */
  senderType?: ChatSenderType;

  /** Filter by content type */
  contentType?: ChatContentType;

  /** Messages after this timestamp */
  after?: string;

  /** Messages before this timestamp */
  before?: string;

  /** Maximum number of messages to return */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * Filter options for listing conversations
 */
export interface ConversationFilter {
  /** Include archived conversations */
  includeArchived?: boolean;

  /** Search in title and messages */
  search?: string;

  /** Limit number of results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * Response extraction pattern
 */
export interface ResponsePattern {
  /** Pattern name for identification */
  name: string;

  /** Regex pattern to match */
  pattern: RegExp;

  /** Extraction group index (default 1) */
  groupIndex?: number;
}

/**
 * WebSocket event for chat
 */
export type ChatWebSocketEvent =
  | { type: 'chat_message'; data: ChatMessage }
  | { type: 'chat_typing'; data: { conversationId: string; sender: ChatSender; isTyping: boolean } }
  | { type: 'chat_status'; data: { messageId: string; status: ChatMessageStatus } }
  | { type: 'conversation_updated'; data: ChatConversation };
```

### 2. `backend/src/types/chat.types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  ChatMessage,
  ChatConversation,
  SendMessageInput,
  createChatMessage,
  createConversation,
  extractResponseFromOutput,
  formatMessageContent,
  isValidSenderType,
  isValidContentType,
} from './chat.types.js';

describe('Chat Types', () => {
  describe('isValidSenderType', () => {
    it('should return true for valid sender types', () => {
      expect(isValidSenderType('user')).toBe(true);
      expect(isValidSenderType('orchestrator')).toBe(true);
      expect(isValidSenderType('agent')).toBe(true);
      expect(isValidSenderType('system')).toBe(true);
    });

    it('should return false for invalid types', () => {
      expect(isValidSenderType('invalid')).toBe(false);
    });
  });

  describe('isValidContentType', () => {
    it('should return true for valid content types', () => {
      expect(isValidContentType('text')).toBe(true);
      expect(isValidContentType('markdown')).toBe(true);
      expect(isValidContentType('code')).toBe(true);
    });
  });

  describe('createChatMessage', () => {
    it('should create a message with defaults', () => {
      const message = createChatMessage({
        conversationId: 'conv-1',
        content: 'Hello!',
        from: { type: 'user' },
      });

      expect(message.id).toBeDefined();
      expect(message.content).toBe('Hello!');
      expect(message.status).toBe('sent');
      expect(message.contentType).toBe('text');
      expect(message.timestamp).toBeDefined();
    });
  });

  describe('createConversation', () => {
    it('should create a conversation with defaults', () => {
      const conversation = createConversation();

      expect(conversation.id).toBeDefined();
      expect(conversation.participantIds).toEqual([]);
      expect(conversation.isArchived).toBe(false);
      expect(conversation.messageCount).toBe(0);
    });
  });

  describe('extractResponseFromOutput', () => {
    it('should extract response from [RESPONSE] markers', () => {
      const output = 'some text [RESPONSE]Hello World[/RESPONSE] more text';
      const extracted = extractResponseFromOutput(output);

      expect(extracted).toBe('Hello World');
    });

    it('should extract from code block format', () => {
      const output = '```response\nFormatted response here\n```';
      const extracted = extractResponseFromOutput(output);

      expect(extracted).toBe('Formatted response here');
    });

    it('should extract from [CHAT_RESPONSE] markers', () => {
      const output = '[CHAT_RESPONSE]\n## Project Created\n\nDetails here\n[/CHAT_RESPONSE]';
      const extracted = extractResponseFromOutput(output);

      expect(extracted).toContain('Project Created');
    });

    it('should return original if no pattern matches', () => {
      const output = 'Just plain text output';
      const extracted = extractResponseFromOutput(output);

      expect(extracted).toBe('Just plain text output');
    });
  });

  describe('formatMessageContent', () => {
    it('should clean up terminal escape codes', () => {
      const content = '\x1b[32mGreen text\x1b[0m';
      const formatted = formatMessageContent(content);

      expect(formatted).toBe('Green text');
    });

    it('should trim whitespace', () => {
      const content = '  \n  Hello  \n  ';
      const formatted = formatMessageContent(content);

      expect(formatted).toBe('Hello');
    });
  });
});
```

### 3. `backend/src/services/chat/chat.service.ts`

```typescript
import { promises as fs } from 'fs';
import path from 'path';
import {
  ChatMessage,
  ChatConversation,
  SendMessageInput,
  SendMessageResult,
  ChatMessageFilter,
  ConversationFilter,
  ChatSender,
  createChatMessage,
  createConversation,
  extractResponseFromOutput,
  formatMessageContent,
} from '../../types/chat.types.js';
import { EventEmitter } from 'events';

/**
 * Service for managing chat conversations and messages
 *
 * Handles:
 * - Message persistence to ~/.agentmux/chat/
 * - Conversation management
 * - Message formatting (raw terminal → clean chat)
 * - WebSocket event emission for real-time updates
 */
export class ChatService extends EventEmitter {
  private readonly chatDir: string;
  private conversations: Map<string, ChatConversation> = new Map();
  private messages: Map<string, ChatMessage[]> = new Map();
  private initialized = false;

  // Response extraction patterns
  private readonly responsePatterns = [
    { name: 'explicit', pattern: /\[RESPONSE\]([\s\S]*?)\[\/RESPONSE\]/i },
    { name: 'chat', pattern: /\[CHAT_RESPONSE\]([\s\S]*?)\[\/CHAT_RESPONSE\]/i },
    { name: 'codeblock', pattern: /```response\n([\s\S]*?)```/i },
  ];

  constructor(options?: { chatDir?: string }) {
    super();
    this.chatDir = options?.chatDir ??
      path.join(process.env.HOME || '~', '.agentmux', 'chat');
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await fs.mkdir(this.chatDir, { recursive: true });
    await this.loadConversations();
    this.initialized = true;
  }

  /**
   * Send a message (from user to orchestrator)
   */
  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    await this.ensureInitialized();

    let conversation: ChatConversation;

    if (input.conversationId) {
      conversation = this.conversations.get(input.conversationId) ??
        await this.createConversation();
    } else {
      conversation = await this.createConversation();
    }

    const message = createChatMessage({
      conversationId: conversation.id,
      content: input.content,
      from: { type: 'user', name: 'You' },
      contentType: 'text',
      status: 'sent',
      metadata: input.metadata,
    });

    await this.saveMessage(message);
    await this.updateConversation(conversation.id, message);

    this.emit('message', message);
    this.emit('chat_message', { type: 'chat_message', data: message });

    return { message, conversation };
  }

  /**
   * Add a message from an agent or orchestrator
   * Typically called when processing terminal output
   */
  async addAgentMessage(
    conversationId: string,
    rawOutput: string,
    sender: ChatSender,
    metadata?: Record<string, unknown>
  ): Promise<ChatMessage> {
    await this.ensureInitialized();

    // Extract and format the response
    const extractedContent = this.extractResponse(rawOutput);
    const formattedContent = formatMessageContent(extractedContent);

    // Determine content type
    const contentType = this.detectContentType(formattedContent);

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
    await this.updateConversation(conversationId, message);

    this.emit('message', message);
    this.emit('chat_message', { type: 'chat_message', data: message });

    return message;
  }

  /**
   * Add a system message
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
    this.emit('chat_message', { type: 'chat_message', data: message });

    return message;
  }

  /**
   * Get messages for a conversation
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
    const limit = filter.limit ?? 100;

    return messages.slice(offset, offset + limit);
  }

  /**
   * Get all conversations
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
      conversations = conversations.filter((c) =>
        c.title?.toLowerCase().includes(searchLower) ||
        c.lastMessage?.content.toLowerCase().includes(searchLower)
      );
    }

    // Sort by last update
    conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    // Apply pagination
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? 50;

    return conversations.slice(offset, offset + limit);
  }

  /**
   * Get a single conversation
   */
  async getConversation(id: string): Promise<ChatConversation | null> {
    await this.ensureInitialized();
    return this.conversations.get(id) ?? null;
  }

  /**
   * Create a new conversation
   */
  async createConversation(title?: string): Promise<ChatConversation> {
    await this.ensureInitialized();

    const conversation = createConversation();
    if (title) {
      conversation.title = title;
    }

    this.conversations.set(conversation.id, conversation);
    this.messages.set(conversation.id, []);

    await this.saveConversation(conversation);

    this.emit('conversation_updated', { type: 'conversation_updated', data: conversation });

    return conversation;
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(id: string): Promise<void> {
    await this.ensureInitialized();

    const conversation = this.conversations.get(id);
    if (!conversation) return;

    conversation.isArchived = true;
    conversation.updatedAt = new Date().toISOString();

    await this.saveConversation(conversation);
    this.emit('conversation_updated', { type: 'conversation_updated', data: conversation });
  }

  /**
   * Delete a conversation and its messages
   */
  async deleteConversation(id: string): Promise<void> {
    await this.ensureInitialized();

    this.conversations.delete(id);
    this.messages.delete(id);

    const conversationFile = path.join(this.chatDir, `${id}.json`);
    await fs.rm(conversationFile, { force: true });
  }

  /**
   * Emit typing indicator
   */
  emitTypingIndicator(conversationId: string, sender: ChatSender, isTyping: boolean): void {
    this.emit('chat_typing', {
      type: 'chat_typing',
      data: { conversationId, sender, isTyping },
    });
  }

  /**
   * Get the current/active conversation (most recently updated non-archived)
   */
  async getCurrentConversation(): Promise<ChatConversation | null> {
    const conversations = await this.getConversations({ limit: 1 });
    return conversations[0] ?? null;
  }

  /**
   * Clear all messages from a conversation
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
    }
  }

  // Private methods

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async loadConversations(): Promise<void> {
    try {
      const files = await fs.readdir(this.chatDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(
            path.join(this.chatDir, file),
            'utf-8'
          );
          const data = JSON.parse(content);

          if (data.conversation) {
            this.conversations.set(data.conversation.id, data.conversation);
            this.messages.set(data.conversation.id, data.messages ?? []);
          }
        } catch (error) {
          console.warn(`Failed to load conversation from ${file}:`, error);
        }
      }
    } catch (error) {
      console.warn('Failed to load conversations:', error);
    }
  }

  private async saveConversation(conversation: ChatConversation): Promise<void> {
    const messages = this.messages.get(conversation.id) ?? [];
    const content = JSON.stringify({ conversation, messages }, null, 2);
    const filePath = path.join(this.chatDir, `${conversation.id}.json`);
    await fs.writeFile(filePath, content);
  }

  private async saveMessage(message: ChatMessage): Promise<void> {
    const messages = this.messages.get(message.conversationId) ?? [];
    messages.push(message);
    this.messages.set(message.conversationId, messages);

    const conversation = this.conversations.get(message.conversationId);
    if (conversation) {
      await this.saveConversation(conversation);
    }
  }

  private async updateConversation(
    conversationId: string,
    message: ChatMessage
  ): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;

    conversation.messageCount += 1;
    conversation.lastMessage = {
      content: message.content.slice(0, 100),
      timestamp: message.timestamp,
      from: message.from,
    };
    conversation.updatedAt = new Date().toISOString();

    // Add participant if new
    const senderId = message.from.id ?? message.from.type;
    if (!conversation.participantIds.includes(senderId)) {
      conversation.participantIds.push(senderId);
    }

    await this.saveConversation(conversation);
  }

  private extractResponse(rawOutput: string): string {
    for (const { pattern } of this.responsePatterns) {
      const match = rawOutput.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // No pattern matched, return cleaned output
    return rawOutput;
  }

  private detectContentType(content: string): 'text' | 'markdown' | 'code' {
    // Check for markdown indicators
    if (content.includes('```') ||
        content.includes('##') ||
        content.includes('**') ||
        content.includes('- ')) {
      return 'markdown';
    }

    // Check for code patterns
    if (content.includes('function ') ||
        content.includes('const ') ||
        content.includes('import ')) {
      return 'code';
    }

    return 'text';
  }
}

// Singleton
let chatServiceInstance: ChatService | null = null;

export function getChatService(): ChatService {
  if (!chatServiceInstance) {
    chatServiceInstance = new ChatService();
  }
  return chatServiceInstance;
}

export function resetChatService(): void {
  chatServiceInstance = null;
}
```

### 4. `backend/src/services/chat/chat.service.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { ChatService, getChatService, resetChatService } from './chat.service.js';

describe('ChatService', () => {
  let service: ChatService;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `chat-service-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    service = new ChatService({ chatDir: testDir });
    await service.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    resetChatService();
  });

  describe('sendMessage', () => {
    it('should create a new conversation if none specified', async () => {
      const result = await service.sendMessage({
        content: 'Hello!',
      });

      expect(result.message.content).toBe('Hello!');
      expect(result.message.from.type).toBe('user');
      expect(result.conversation).toBeDefined();
      expect(result.conversation.id).toBeDefined();
    });

    it('should use existing conversation if specified', async () => {
      const conv = await service.createConversation('Test');

      const result = await service.sendMessage({
        content: 'Hello!',
        conversationId: conv.id,
      });

      expect(result.conversation.id).toBe(conv.id);
    });

    it('should emit chat_message event', async () => {
      const eventSpy = vi.fn();
      service.on('chat_message', eventSpy);

      await service.sendMessage({ content: 'Test' });

      expect(eventSpy).toHaveBeenCalled();
      expect(eventSpy.mock.calls[0][0].type).toBe('chat_message');
    });
  });

  describe('addAgentMessage', () => {
    it('should extract response from [RESPONSE] markers', async () => {
      const conv = await service.createConversation();

      const message = await service.addAgentMessage(
        conv.id,
        'some output [RESPONSE]Hello World[/RESPONSE] more output',
        { type: 'orchestrator', name: 'Orchestrator' }
      );

      expect(message.content).toBe('Hello World');
    });

    it('should extract from [CHAT_RESPONSE] markers', async () => {
      const conv = await service.createConversation();

      const message = await service.addAgentMessage(
        conv.id,
        '[CHAT_RESPONSE]\n## Title\n\nContent here\n[/CHAT_RESPONSE]',
        { type: 'orchestrator' }
      );

      expect(message.content).toContain('Title');
      expect(message.contentType).toBe('markdown');
    });

    it('should preserve raw output in metadata', async () => {
      const conv = await service.createConversation();
      const rawOutput = 'Raw terminal output [RESPONSE]Clean[/RESPONSE]';

      const message = await service.addAgentMessage(
        conv.id,
        rawOutput,
        { type: 'agent', name: 'Agent' }
      );

      expect(message.metadata?.rawOutput).toBe(rawOutput);
    });

    it('should detect markdown content type', async () => {
      const conv = await service.createConversation();

      const message = await service.addAgentMessage(
        conv.id,
        '## Heading\n\n- Item 1\n- Item 2\n\n**Bold text**',
        { type: 'orchestrator' }
      );

      expect(message.contentType).toBe('markdown');
    });
  });

  describe('getMessages', () => {
    it('should return messages for a conversation', async () => {
      const conv = await service.createConversation();
      await service.sendMessage({ content: 'Message 1', conversationId: conv.id });
      await service.sendMessage({ content: 'Message 2', conversationId: conv.id });

      const messages = await service.getMessages({ conversationId: conv.id });

      expect(messages.length).toBe(2);
    });

    it('should filter by sender type', async () => {
      const conv = await service.createConversation();
      await service.sendMessage({ content: 'User', conversationId: conv.id });
      await service.addAgentMessage(conv.id, 'Agent', { type: 'agent' });

      const messages = await service.getMessages({
        conversationId: conv.id,
        senderType: 'user',
      });

      expect(messages.length).toBe(1);
      expect(messages[0].from.type).toBe('user');
    });

    it('should apply pagination', async () => {
      const conv = await service.createConversation();
      for (let i = 0; i < 10; i++) {
        await service.sendMessage({ content: `Message ${i}`, conversationId: conv.id });
      }

      const messages = await service.getMessages({
        conversationId: conv.id,
        limit: 5,
        offset: 2,
      });

      expect(messages.length).toBe(5);
    });
  });

  describe('getConversations', () => {
    it('should return all non-archived conversations', async () => {
      await service.createConversation('Conv 1');
      await service.createConversation('Conv 2');

      const conversations = await service.getConversations();

      expect(conversations.length).toBe(2);
    });

    it('should exclude archived by default', async () => {
      const conv = await service.createConversation('Archived');
      await service.archiveConversation(conv.id);
      await service.createConversation('Active');

      const conversations = await service.getConversations();

      expect(conversations.length).toBe(1);
      expect(conversations[0].title).toBe('Active');
    });

    it('should include archived when requested', async () => {
      await service.createConversation('Archived');
      const [conv] = await service.getConversations();
      await service.archiveConversation(conv.id);
      await service.createConversation('Active');

      const conversations = await service.getConversations({ includeArchived: true });

      expect(conversations.length).toBe(2);
    });
  });

  describe('deleteConversation', () => {
    it('should delete conversation and messages', async () => {
      const conv = await service.createConversation();
      await service.sendMessage({ content: 'Test', conversationId: conv.id });

      await service.deleteConversation(conv.id);

      const deleted = await service.getConversation(conv.id);
      expect(deleted).toBeNull();
    });
  });

  describe('persistence', () => {
    it('should persist conversations to disk', async () => {
      await service.createConversation('Persisted');
      await service.sendMessage({ content: 'Test' });

      // Create new service instance
      const newService = new ChatService({ chatDir: testDir });
      await newService.initialize();

      const conversations = await newService.getConversations();
      expect(conversations.some((c) => c.title === 'Persisted')).toBe(true);
    });
  });

  describe('emitTypingIndicator', () => {
    it('should emit typing event', () => {
      const eventSpy = vi.fn();
      service.on('chat_typing', eventSpy);

      service.emitTypingIndicator('conv-1', { type: 'orchestrator' }, true);

      expect(eventSpy).toHaveBeenCalled();
      expect(eventSpy.mock.calls[0][0].data.isTyping).toBe(true);
    });
  });
});

describe('getChatService', () => {
  afterEach(() => {
    resetChatService();
  });

  it('should return singleton instance', () => {
    const instance1 = getChatService();
    const instance2 = getChatService();
    expect(instance1).toBe(instance2);
  });
});
```

## Utility Functions to Add to chat.types.ts

```typescript
/**
 * Check if a value is a valid sender type
 */
export function isValidSenderType(value: string): value is ChatSenderType {
  return ['user', 'orchestrator', 'agent', 'system'].includes(value);
}

/**
 * Check if a value is a valid content type
 */
export function isValidContentType(value: string): value is ChatContentType {
  return ['text', 'status', 'task', 'error', 'system', 'code', 'markdown'].includes(value);
}

/**
 * Create a chat message with defaults
 */
export function createChatMessage(
  input: Partial<ChatMessage> & Pick<ChatMessage, 'conversationId' | 'content' | 'from'>
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    conversationId: input.conversationId,
    from: input.from,
    content: input.content,
    contentType: input.contentType ?? 'text',
    status: input.status ?? 'sent',
    timestamp: input.timestamp ?? new Date().toISOString(),
    metadata: input.metadata,
    parentId: input.parentId,
  };
}

/**
 * Create a conversation with defaults
 */
export function createConversation(): ChatConversation {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    participantIds: [],
    createdAt: now,
    updatedAt: now,
    isArchived: false,
    messageCount: 0,
  };
}

/**
 * Format message content (clean terminal output)
 */
export function formatMessageContent(content: string): string {
  // Remove ANSI escape codes
  let cleaned = content.replace(/\x1b\[[0-9;]*m/g, '');

  // Remove other escape sequences
  cleaned = cleaned.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

  // Trim whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Extract response from raw output using patterns
 */
export function extractResponseFromOutput(rawOutput: string): string {
  const patterns = [
    /\[RESPONSE\]([\s\S]*?)\[\/RESPONSE\]/i,
    /\[CHAT_RESPONSE\]([\s\S]*?)\[\/CHAT_RESPONSE\]/i,
    /```response\n([\s\S]*?)```/i,
  ];

  for (const pattern of patterns) {
    const match = rawOutput.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return rawOutput;
}
```

## Acceptance Criteria

- [ ] All chat type definitions complete with JSDoc
- [ ] ChatService handles message sending and receiving
- [ ] Response extraction from terminal output works
- [ ] Messages persist to ~/.agentmux/chat/
- [ ] Conversation management (create, archive, delete)
- [ ] WebSocket event emission for real-time updates
- [ ] Message filtering and pagination work
- [ ] Content type detection works (text, markdown, code)
- [ ] Comprehensive test coverage (>80%)

## Testing Requirements

1. Unit tests for type utility functions
2. Integration tests for message persistence
3. Response extraction tests with various patterns
4. Event emission tests
5. Edge case tests (empty content, large messages)

## Notes

- Messages are stored per-conversation in JSON files
- Consider implementing message cleanup for old conversations
- Response patterns can be extended for different agent formats
- EventEmitter enables WebSocket integration
