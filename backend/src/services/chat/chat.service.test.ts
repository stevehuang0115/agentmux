/**
 * Chat Service Tests
 *
 * Comprehensive tests for the ChatService including message management,
 * conversation management, persistence, and event emission.
 *
 * @module services/chat/chat.service.test
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ChatService,
  ChatServiceOptions,
  getChatService,
  resetChatService,
  ConversationNotFoundError,
  MessageValidationError,
} from './chat.service.js';
import { ChatMessage, ChatConversation, ChatSender } from '../../types/chat.types.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a test ChatService instance with a temporary directory
 */
async function createTestService(): Promise<{ service: ChatService; testDir: string }> {
  const testDir = path.join(os.tmpdir(), `chat-service-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(testDir, { recursive: true });
  const service = new ChatService({ chatDir: testDir });
  await service.initialize();
  return { service, testDir };
}

/**
 * Clean up test directory
 */
async function cleanupTestDir(testDir: string): Promise<void> {
  await fs.rm(testDir, { recursive: true, force: true });
}

// =============================================================================
// ChatService Tests
// =============================================================================

describe('ChatService', () => {
  let service: ChatService;
  let testDir: string;

  beforeEach(async () => {
    const result = await createTestService();
    service = result.service;
    testDir = result.testDir;
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
    resetChatService();
  });

  // ===========================================================================
  // Initialization Tests
  // ===========================================================================

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newService = new ChatService({ chatDir: testDir });
      expect(newService.isInitialized()).toBe(false);
      await newService.initialize();
      expect(newService.isInitialized()).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      const newService = new ChatService({ chatDir: testDir });
      await newService.initialize();
      await newService.initialize(); // Should not throw
      expect(newService.isInitialized()).toBe(true);
    });

    it('should create chat directory if not exists', async () => {
      const newDir = path.join(testDir, 'new-chat-dir');
      const newService = new ChatService({ chatDir: newDir });
      await newService.initialize();

      const stat = await fs.stat(newDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should load existing conversations on init', async () => {
      // Create a conversation first
      const conv = await service.createNewConversation('Test');
      await service.sendMessage({ content: 'Hello', conversationId: conv.id });

      // Create a new service instance with same directory
      const newService = new ChatService({ chatDir: testDir });
      await newService.initialize();

      const loaded = await newService.getConversation(conv.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.title).toBe('Test');
    });
  });

  // ===========================================================================
  // sendMessage Tests
  // ===========================================================================

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
      const conv = await service.createNewConversation('Test');

      const result = await service.sendMessage({
        content: 'Hello!',
        conversationId: conv.id,
      });

      expect(result.conversation.id).toBe(conv.id);
    });

    it('should create new conversation if specified one does not exist', async () => {
      const result = await service.sendMessage({
        content: 'Hello!',
        conversationId: 'non-existent-id',
      });

      // The current implementation creates a new conversation using the
      // specified conversationId as the idOverride, so the new conversation
      // retains the requested ID.
      expect(result.conversation.id).toBe('non-existent-id');
      expect(result.conversation).toBeDefined();
      expect(result.message.content).toBe('Hello!');
    });

    it('should emit chat_message event', async () => {
      const eventSpy = jest.fn();
      service.on('chat_message', eventSpy);

      await service.sendMessage({ content: 'Test' });

      expect(eventSpy).toHaveBeenCalled();
      expect(eventSpy.mock.calls[0][0].type).toBe('chat_message');
    });

    it('should emit message event', async () => {
      const eventSpy = jest.fn();
      service.on('message', eventSpy);

      await service.sendMessage({ content: 'Test' });

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should attach metadata to message', async () => {
      const result = await service.sendMessage({
        content: 'Test',
        metadata: { key: 'value', count: 42 },
      });

      expect(result.message.metadata?.key).toBe('value');
      expect(result.message.metadata?.count).toBe(42);
    });

    it('should throw MessageValidationError for empty content', async () => {
      await expect(service.sendMessage({ content: '' })).rejects.toThrow(MessageValidationError);
      await expect(service.sendMessage({ content: '   ' })).rejects.toThrow(MessageValidationError);
    });

    it('should throw MessageValidationError for invalid input', async () => {
      await expect(service.sendMessage({ content: 123 as any })).rejects.toThrow(MessageValidationError);
    });

    it('should update conversation message count', async () => {
      const result1 = await service.sendMessage({ content: 'Message 1' });
      const conv1 = await service.getConversation(result1.conversation.id);
      expect(conv1?.messageCount).toBe(1);

      await service.sendMessage({ content: 'Message 2', conversationId: result1.conversation.id });
      const conv2 = await service.getConversation(result1.conversation.id);
      expect(conv2?.messageCount).toBe(2);
    });

    it('should update last message preview', async () => {
      const result = await service.sendMessage({ content: 'Hello World' });
      const conv = await service.getConversation(result.conversation.id);

      expect(conv?.lastMessage?.content).toBe('Hello World');
      expect(conv?.lastMessage?.from.type).toBe('user');
    });
  });

  // ===========================================================================
  // addAgentMessage Tests
  // ===========================================================================

  describe('addAgentMessage', () => {
    it('should extract response from [RESPONSE] markers', async () => {
      const conv = await service.createNewConversation();

      const message = await service.addAgentMessage(
        conv.id,
        'some output [RESPONSE]Hello World[/RESPONSE] more output',
        { type: 'orchestrator', name: 'Orchestrator' }
      );

      expect(message.content).toBe('Hello World');
    });

    it('should extract from [CHAT_RESPONSE] markers', async () => {
      const conv = await service.createNewConversation();

      const message = await service.addAgentMessage(
        conv.id,
        '[CHAT_RESPONSE]\n## Title\n\nContent here\n[/CHAT_RESPONSE]',
        { type: 'orchestrator' }
      );

      expect(message.content).toContain('Title');
      expect(message.contentType).toBe('markdown');
    });

    it('should preserve raw output in metadata', async () => {
      const conv = await service.createNewConversation();
      const rawOutput = 'Raw terminal output [RESPONSE]Clean[/RESPONSE]';

      const message = await service.addAgentMessage(
        conv.id,
        rawOutput,
        { type: 'agent', name: 'Agent' }
      );

      expect(message.metadata?.rawOutput).toBe(rawOutput);
    });

    it('should detect markdown content type', async () => {
      const conv = await service.createNewConversation();

      const message = await service.addAgentMessage(
        conv.id,
        '## Heading\n\n- Item 1\n- Item 2\n\n**Bold text**',
        { type: 'orchestrator' }
      );

      expect(message.contentType).toBe('markdown');
    });

    it('should set sender information', async () => {
      const conv = await service.createNewConversation();
      const sender: ChatSender = {
        type: 'agent',
        id: 'agent-1',
        name: 'Developer Agent',
        role: 'developer',
      };

      const message = await service.addAgentMessage(conv.id, 'Test', sender);

      expect(message.from.type).toBe('agent');
      expect(message.from.id).toBe('agent-1');
      expect(message.from.name).toBe('Developer Agent');
      expect(message.from.role).toBe('developer');
    });

    it('should set status to delivered', async () => {
      const conv = await service.createNewConversation();
      const message = await service.addAgentMessage(conv.id, 'Test', { type: 'orchestrator' });

      expect(message.status).toBe('delivered');
    });

    it('should clean ANSI escape codes', async () => {
      const conv = await service.createNewConversation();

      const message = await service.addAgentMessage(
        conv.id,
        '\x1b[32m✓ Success\x1b[0m',
        { type: 'orchestrator' }
      );

      expect(message.content).toBe('✓ Success');
    });

    it('should include additional metadata', async () => {
      const conv = await service.createNewConversation();

      const message = await service.addAgentMessage(
        conv.id,
        'Test',
        { type: 'orchestrator' },
        { taskId: 'task-123', skillUsed: 'skill-456' }
      );

      expect(message.metadata?.taskId).toBe('task-123');
      expect(message.metadata?.skillUsed).toBe('skill-456');
    });
  });

  // ===========================================================================
  // addDirectMessage Tests
  // ===========================================================================

  describe('addDirectMessage', () => {
    it('should add a message with pre-extracted content', async () => {
      const conv = await service.createNewConversation();

      const message = await service.addDirectMessage(
        conv.id,
        '## Status Update\n\nEmily is working...',
        { type: 'orchestrator', name: 'Orchestrator' }
      );

      expect(message.content).toContain('Status Update');
      expect(message.content).toContain('Emily is working');
      expect(message.from.type).toBe('orchestrator');
    });

    it('should NOT run extractResponseFromOutput (no regex extraction)', async () => {
      const conv = await service.createNewConversation();

      // Pass content that would be mangled by extractResponseFromOutput
      // if it were called (i.e. content WITHOUT [RESPONSE] markers)
      const rawContent = 'Just plain markdown without markers';
      const message = await service.addDirectMessage(
        conv.id,
        rawContent,
        { type: 'orchestrator' }
      );

      // Should get the content as-is (after formatMessageContent cleaning)
      expect(message.content).toBe('Just plain markdown without markers');
    });

    it('should not store rawOutput in metadata (unlike addAgentMessage)', async () => {
      const conv = await service.createNewConversation();

      const message = await service.addDirectMessage(
        conv.id,
        'Test content',
        { type: 'orchestrator' }
      );

      expect(message.metadata?.rawOutput).toBeUndefined();
    });

    it('should emit message event (critical for QueueProcessor)', async () => {
      const conv = await service.createNewConversation();
      const eventSpy = jest.fn();
      service.on('message', eventSpy);

      await service.addDirectMessage(conv.id, 'Test', { type: 'orchestrator' });

      expect(eventSpy).toHaveBeenCalled();
      expect(eventSpy.mock.calls[0][0].conversationId).toBe(conv.id);
    });

    it('should emit chat_message event', async () => {
      const conv = await service.createNewConversation();
      const eventSpy = jest.fn();
      service.on('chat_message', eventSpy);

      await service.addDirectMessage(conv.id, 'Test', { type: 'orchestrator' });

      expect(eventSpy).toHaveBeenCalled();
      expect(eventSpy.mock.calls[0][0].type).toBe('chat_message');
    });

    it('should detect content type', async () => {
      const conv = await service.createNewConversation();

      const message = await service.addDirectMessage(
        conv.id,
        '## Heading\n\n- Item 1\n- Item 2',
        { type: 'orchestrator' }
      );

      expect(message.contentType).toBe('markdown');
    });

    it('should set status to delivered', async () => {
      const conv = await service.createNewConversation();

      const message = await service.addDirectMessage(
        conv.id,
        'Test',
        { type: 'orchestrator' }
      );

      expect(message.status).toBe('delivered');
    });

    it('should include metadata when provided', async () => {
      const conv = await service.createNewConversation();

      const message = await service.addDirectMessage(
        conv.id,
        'Test',
        { type: 'orchestrator' },
        { notifyType: 'task_completed', urgency: 'high' }
      );

      expect(message.metadata?.notifyType).toBe('task_completed');
      expect(message.metadata?.urgency).toBe('high');
    });

    it('should update conversation message count', async () => {
      const conv = await service.createNewConversation();

      await service.addDirectMessage(conv.id, 'Message 1', { type: 'orchestrator' });
      await service.addDirectMessage(conv.id, 'Message 2', { type: 'orchestrator' });

      const updated = await service.getConversation(conv.id);
      expect(updated?.messageCount).toBe(2);
    });

    it('should clean ANSI codes from content', async () => {
      const conv = await service.createNewConversation();

      const message = await service.addDirectMessage(
        conv.id,
        '\x1b[32m✓ Success\x1b[0m',
        { type: 'orchestrator' }
      );

      expect(message.content).toBe('✓ Success');
    });
  });

  // ===========================================================================
  // addSystemMessage Tests
  // ===========================================================================

  describe('addSystemMessage', () => {
    it('should create a system message', async () => {
      const conv = await service.createNewConversation();

      const message = await service.addSystemMessage(conv.id, 'System notification');

      expect(message.from.type).toBe('system');
      expect(message.from.name).toBe('System');
      expect(message.contentType).toBe('system');
      expect(message.content).toBe('System notification');
    });

    it('should emit chat_message event', async () => {
      const conv = await service.createNewConversation();
      const eventSpy = jest.fn();
      service.on('chat_message', eventSpy);

      await service.addSystemMessage(conv.id, 'Test');

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should include metadata', async () => {
      const conv = await service.createNewConversation();

      const message = await service.addSystemMessage(conv.id, 'Test', { action: 'project_created' });

      expect(message.metadata?.action).toBe('project_created');
    });
  });

  // ===========================================================================
  // getMessages Tests
  // ===========================================================================

  describe('getMessages', () => {
    it('should return messages for a conversation', async () => {
      const conv = await service.createNewConversation();
      await service.sendMessage({ content: 'Message 1', conversationId: conv.id });
      await service.sendMessage({ content: 'Message 2', conversationId: conv.id });

      const messages = await service.getMessages({ conversationId: conv.id });

      expect(messages.length).toBe(2);
    });

    it('should return empty array for no conversationId', async () => {
      const messages = await service.getMessages({});
      expect(messages).toEqual([]);
    });

    it('should return empty array for non-existent conversation', async () => {
      const messages = await service.getMessages({ conversationId: 'non-existent' });
      expect(messages).toEqual([]);
    });

    it('should filter by sender type', async () => {
      const conv = await service.createNewConversation();
      await service.sendMessage({ content: 'User message', conversationId: conv.id });
      await service.addAgentMessage(conv.id, 'Agent message', { type: 'agent' });

      const messages = await service.getMessages({
        conversationId: conv.id,
        senderType: 'user',
      });

      expect(messages.length).toBe(1);
      expect(messages[0].from.type).toBe('user');
    });

    it('should filter by content type', async () => {
      const conv = await service.createNewConversation();
      await service.sendMessage({ content: 'Text message', conversationId: conv.id });
      await service.addAgentMessage(conv.id, '## Markdown', { type: 'orchestrator' });

      const messages = await service.getMessages({
        conversationId: conv.id,
        contentType: 'markdown',
      });

      expect(messages.length).toBe(1);
      expect(messages[0].contentType).toBe('markdown');
    });

    it('should filter by timestamp after', async () => {
      const conv = await service.createNewConversation();
      await service.sendMessage({ content: 'Old message', conversationId: conv.id });

      const midTime = new Date().toISOString();
      await new Promise((resolve) => setTimeout(resolve, 10));

      await service.sendMessage({ content: 'New message', conversationId: conv.id });

      const messages = await service.getMessages({
        conversationId: conv.id,
        after: midTime,
      });

      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('New message');
    });

    it('should filter by timestamp before', async () => {
      const conv = await service.createNewConversation();
      await service.sendMessage({ content: 'Old message', conversationId: conv.id });

      await new Promise((resolve) => setTimeout(resolve, 10));
      const midTime = new Date().toISOString();

      await service.sendMessage({ content: 'New message', conversationId: conv.id });

      const messages = await service.getMessages({
        conversationId: conv.id,
        before: midTime,
      });

      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('Old message');
    });

    it('should apply pagination', async () => {
      const conv = await service.createNewConversation();
      for (let i = 0; i < 10; i++) {
        await service.sendMessage({ content: `Message ${i}`, conversationId: conv.id });
      }

      const messages = await service.getMessages({
        conversationId: conv.id,
        limit: 5,
        offset: 2,
      });

      expect(messages.length).toBe(5);
      expect(messages[0].content).toBe('Message 2');
    });

    it('should sort messages by timestamp', async () => {
      const conv = await service.createNewConversation();
      await service.sendMessage({ content: 'First', conversationId: conv.id });
      await service.sendMessage({ content: 'Second', conversationId: conv.id });
      await service.sendMessage({ content: 'Third', conversationId: conv.id });

      const messages = await service.getMessages({ conversationId: conv.id });

      expect(messages[0].content).toBe('First');
      expect(messages[2].content).toBe('Third');
    });
  });

  // ===========================================================================
  // getMessage Tests
  // ===========================================================================

  describe('getMessage', () => {
    it('should return message by ID', async () => {
      const result = await service.sendMessage({ content: 'Test' });

      const message = await service.getMessage(result.conversation.id, result.message.id);

      expect(message).not.toBeNull();
      expect(message?.id).toBe(result.message.id);
    });

    it('should return null for non-existent message', async () => {
      const conv = await service.createNewConversation();

      const message = await service.getMessage(conv.id, 'non-existent');

      expect(message).toBeNull();
    });

    it('should return null for non-existent conversation', async () => {
      const message = await service.getMessage('non-existent-conv', 'msg-id');

      expect(message).toBeNull();
    });
  });

  // ===========================================================================
  // updateMessageMetadata Tests
  // ===========================================================================

  describe('updateMessageMetadata', () => {
    it('should merge metadata into existing message', async () => {
      const conv = await service.createNewConversation();
      const message = await service.addDirectMessage(
        conv.id,
        'Test content',
        { type: 'orchestrator' },
        { slackDeliveryStatus: 'pending' }
      );

      const updated = await service.updateMessageMetadata(
        conv.id,
        message.id,
        { slackDeliveryStatus: 'delivered', slackDeliveryAttemptedAt: '2026-02-09T00:00:00Z' }
      );

      expect(updated).not.toBeNull();
      expect(updated?.metadata?.slackDeliveryStatus).toBe('delivered');
      expect(updated?.metadata?.slackDeliveryAttemptedAt).toBe('2026-02-09T00:00:00Z');
    });

    it('should return null for non-existent conversation', async () => {
      const result = await service.updateMessageMetadata(
        'non-existent-conv',
        'msg-id',
        { slackDeliveryStatus: 'delivered' }
      );

      expect(result).toBeNull();
    });

    it('should return null for non-existent message', async () => {
      const conv = await service.createNewConversation();

      const result = await service.updateMessageMetadata(
        conv.id,
        'non-existent-msg',
        { slackDeliveryStatus: 'delivered' }
      );

      expect(result).toBeNull();
    });

    it('should persist the update to disk', async () => {
      const conv = await service.createNewConversation();
      const message = await service.addDirectMessage(
        conv.id,
        'Persistent metadata test',
        { type: 'orchestrator' },
        { slackDeliveryStatus: 'pending' }
      );

      await service.updateMessageMetadata(
        conv.id,
        message.id,
        { slackDeliveryStatus: 'delivered' }
      );

      // Create a new service instance from the same directory and verify
      const newService = new ChatService({ chatDir: testDir });
      await newService.initialize();

      const reloaded = await newService.getMessage(conv.id, message.id);
      expect(reloaded).not.toBeNull();
      expect(reloaded?.metadata?.slackDeliveryStatus).toBe('delivered');
    });

    it('should preserve existing metadata fields when merging', async () => {
      const conv = await service.createNewConversation();
      const message = await service.addDirectMessage(
        conv.id,
        'Metadata merge test',
        { type: 'orchestrator' },
        {
          notifyType: 'task_completed',
          slackChannelId: 'C12345',
          slackDeliveryStatus: 'pending',
        }
      );

      const updated = await service.updateMessageMetadata(
        conv.id,
        message.id,
        { slackDeliveryStatus: 'delivered', slackDeliveryAttempts: 1 }
      );

      expect(updated).not.toBeNull();
      // Original fields preserved
      expect(updated?.metadata?.notifyType).toBe('task_completed');
      expect(updated?.metadata?.slackChannelId).toBe('C12345');
      // New/updated fields applied
      expect(updated?.metadata?.slackDeliveryStatus).toBe('delivered');
      expect(updated?.metadata?.slackDeliveryAttempts).toBe(1);
    });
  });

  // ===========================================================================
  // getMessagesWithPendingSlackDelivery Tests
  // ===========================================================================

  describe('getMessagesWithPendingSlackDelivery', () => {
    it('should return empty array when no pending messages', async () => {
      const conv = await service.createNewConversation();
      await service.addDirectMessage(
        conv.id,
        'No slack metadata',
        { type: 'orchestrator' }
      );

      const pending = await service.getMessagesWithPendingSlackDelivery(60000);

      expect(pending).toEqual([]);
    });

    it('should find messages with pending Slack delivery', async () => {
      const conv = await service.createNewConversation();
      await service.addDirectMessage(
        conv.id,
        'Pending slack message',
        { type: 'orchestrator' },
        { slackDeliveryStatus: 'pending', slackChannelId: 'C12345' }
      );

      const pending = await service.getMessagesWithPendingSlackDelivery(60000);

      expect(pending.length).toBe(1);
      expect(pending[0].content).toBe('Pending slack message');
      expect(pending[0].metadata?.slackDeliveryStatus).toBe('pending');
      expect(pending[0].metadata?.slackChannelId).toBe('C12345');
    });

    it('should not return messages older than maxAgeMs', async () => {
      const conv = await service.createNewConversation();
      await service.addDirectMessage(
        conv.id,
        'Old pending message',
        { type: 'orchestrator' },
        { slackDeliveryStatus: 'pending', slackChannelId: 'C12345' }
      );

      // Wait to ensure the message timestamp is older than the cutoff
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Use a very small maxAgeMs so the message falls outside the window
      const pending = await service.getMessagesWithPendingSlackDelivery(1);

      expect(pending).toEqual([]);
    });

    it('should not return messages without slackChannelId', async () => {
      const conv = await service.createNewConversation();
      await service.addDirectMessage(
        conv.id,
        'Pending but no channel',
        { type: 'orchestrator' },
        { slackDeliveryStatus: 'pending' }
      );

      const pending = await service.getMessagesWithPendingSlackDelivery(60000);

      expect(pending).toEqual([]);
    });

    it('should not return messages with delivered status', async () => {
      const conv = await service.createNewConversation();
      await service.addDirectMessage(
        conv.id,
        'Already delivered',
        { type: 'orchestrator' },
        { slackDeliveryStatus: 'delivered', slackChannelId: 'C12345' }
      );

      const pending = await service.getMessagesWithPendingSlackDelivery(60000);

      expect(pending).toEqual([]);
    });
  });

  // ===========================================================================
  // getConversations Tests
  // ===========================================================================

  describe('getConversations', () => {
    it('should return all non-archived conversations', async () => {
      await service.createNewConversation('Conv 1');
      await service.createNewConversation('Conv 2');

      const conversations = await service.getConversations();

      expect(conversations.length).toBe(2);
    });

    it('should exclude archived by default', async () => {
      const conv = await service.createNewConversation('Archived');
      await service.archiveConversation(conv.id);
      await service.createNewConversation('Active');

      const conversations = await service.getConversations();

      expect(conversations.length).toBe(1);
      expect(conversations[0].title).toBe('Active');
    });

    it('should include archived when requested', async () => {
      const conv = await service.createNewConversation('Archived');
      await service.archiveConversation(conv.id);
      await service.createNewConversation('Active');

      const conversations = await service.getConversations({ includeArchived: true });

      expect(conversations.length).toBe(2);
    });

    it('should search by title', async () => {
      await service.createNewConversation('Project Discussion');
      await service.createNewConversation('Bug Fixes');

      const conversations = await service.getConversations({ search: 'project' });

      expect(conversations.length).toBe(1);
      expect(conversations[0].title).toBe('Project Discussion');
    });

    it('should search by last message content', async () => {
      const conv = await service.createNewConversation('Conv 1');
      await service.sendMessage({ content: 'Unique search term here', conversationId: conv.id });
      await service.createNewConversation('Conv 2');

      const conversations = await service.getConversations({ search: 'unique search' });

      expect(conversations.length).toBe(1);
    });

    it('should sort by last update (most recent first)', async () => {
      const conv1 = await service.createNewConversation('First');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const conv2 = await service.createNewConversation('Second');

      const conversations = await service.getConversations();

      expect(conversations[0].id).toBe(conv2.id);
      expect(conversations[1].id).toBe(conv1.id);
    });

    it('should apply pagination', async () => {
      for (let i = 0; i < 10; i++) {
        await service.createNewConversation(`Conv ${i}`);
      }

      const conversations = await service.getConversations({ limit: 3, offset: 2 });

      expect(conversations.length).toBe(3);
    });
  });

  // ===========================================================================
  // getConversation Tests
  // ===========================================================================

  describe('getConversation', () => {
    it('should return conversation by ID', async () => {
      const conv = await service.createNewConversation('Test');

      const result = await service.getConversation(conv.id);

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Test');
    });

    it('should return null for non-existent ID', async () => {
      const result = await service.getConversation('non-existent');
      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // createNewConversation Tests
  // ===========================================================================

  describe('createNewConversation', () => {
    it('should create conversation with defaults', async () => {
      const conv = await service.createNewConversation();

      expect(conv.id).toBeDefined();
      expect(conv.participantIds).toEqual([]);
      expect(conv.isArchived).toBe(false);
      expect(conv.messageCount).toBe(0);
    });

    it('should create conversation with title', async () => {
      const conv = await service.createNewConversation('My Conversation');
      expect(conv.title).toBe('My Conversation');
    });

    it('should emit conversation_updated event', async () => {
      const eventSpy = jest.fn();
      service.on('conversation_updated', eventSpy);

      await service.createNewConversation('Test');

      expect(eventSpy).toHaveBeenCalled();
      expect(eventSpy.mock.calls[0][0].type).toBe('conversation_updated');
    });

    it('should persist conversation to disk', async () => {
      const conv = await service.createNewConversation('Persisted');

      const filePath = path.join(testDir, `${conv.id}.json`);
      const exists = await fs.stat(filePath).catch(() => null);

      expect(exists).not.toBeNull();
    });
  });

  // ===========================================================================
  // updateConversationTitle Tests
  // ===========================================================================

  describe('updateConversationTitle', () => {
    it('should update conversation title', async () => {
      const conv = await service.createNewConversation('Original');

      const updated = await service.updateConversationTitle(conv.id, 'Updated');

      expect(updated.title).toBe('Updated');
    });

    it('should throw ConversationNotFoundError for non-existent conversation', async () => {
      await expect(
        service.updateConversationTitle('non-existent', 'Title')
      ).rejects.toThrow(ConversationNotFoundError);
    });

    it('should emit conversation_updated event', async () => {
      const conv = await service.createNewConversation('Test');
      const eventSpy = jest.fn();
      service.on('conversation_updated', eventSpy);

      await service.updateConversationTitle(conv.id, 'Updated');

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // archiveConversation Tests
  // ===========================================================================

  describe('archiveConversation', () => {
    it('should archive conversation', async () => {
      const conv = await service.createNewConversation('Test');

      await service.archiveConversation(conv.id);

      const result = await service.getConversation(conv.id);
      expect(result?.isArchived).toBe(true);
    });

    it('should throw ConversationNotFoundError for non-existent conversation', async () => {
      await expect(service.archiveConversation('non-existent')).rejects.toThrow(
        ConversationNotFoundError
      );
    });

    it('should emit conversation_updated event', async () => {
      const conv = await service.createNewConversation('Test');
      const eventSpy = jest.fn();
      service.on('conversation_updated', eventSpy);

      await service.archiveConversation(conv.id);

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // unarchiveConversation Tests
  // ===========================================================================

  describe('unarchiveConversation', () => {
    it('should unarchive conversation', async () => {
      const conv = await service.createNewConversation('Test');
      await service.archiveConversation(conv.id);

      await service.unarchiveConversation(conv.id);

      const result = await service.getConversation(conv.id);
      expect(result?.isArchived).toBe(false);
    });

    it('should throw ConversationNotFoundError for non-existent conversation', async () => {
      await expect(service.unarchiveConversation('non-existent')).rejects.toThrow(
        ConversationNotFoundError
      );
    });
  });

  // ===========================================================================
  // deleteConversation Tests
  // ===========================================================================

  describe('deleteConversation', () => {
    it('should delete conversation and messages', async () => {
      const conv = await service.createNewConversation();
      await service.sendMessage({ content: 'Test', conversationId: conv.id });

      await service.deleteConversation(conv.id);

      const deleted = await service.getConversation(conv.id);
      expect(deleted).toBeNull();
    });

    it('should delete conversation file from disk', async () => {
      const conv = await service.createNewConversation();
      const filePath = path.join(testDir, `${conv.id}.json`);

      await service.deleteConversation(conv.id);

      const exists = await fs.stat(filePath).catch(() => null);
      expect(exists).toBeNull();
    });

    it('should not throw for non-existent conversation', async () => {
      await expect(service.deleteConversation('non-existent')).resolves.not.toThrow();
    });
  });

  // ===========================================================================
  // clearConversation Tests
  // ===========================================================================

  describe('clearConversation', () => {
    it('should clear all messages', async () => {
      const conv = await service.createNewConversation();
      await service.sendMessage({ content: 'Message 1', conversationId: conv.id });
      await service.sendMessage({ content: 'Message 2', conversationId: conv.id });

      await service.clearConversation(conv.id);

      const messages = await service.getMessages({ conversationId: conv.id });
      expect(messages.length).toBe(0);
    });

    it('should reset message count', async () => {
      const conv = await service.createNewConversation();
      await service.sendMessage({ content: 'Test', conversationId: conv.id });

      await service.clearConversation(conv.id);

      const result = await service.getConversation(conv.id);
      expect(result?.messageCount).toBe(0);
    });

    it('should clear last message preview', async () => {
      const conv = await service.createNewConversation();
      await service.sendMessage({ content: 'Test', conversationId: conv.id });

      await service.clearConversation(conv.id);

      const result = await service.getConversation(conv.id);
      expect(result?.lastMessage).toBeUndefined();
    });
  });

  // ===========================================================================
  // getCurrentConversation Tests
  // ===========================================================================

  describe('getCurrentConversation', () => {
    it('should return most recently updated conversation', async () => {
      await service.createNewConversation('First');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const recent = await service.createNewConversation('Recent');

      const current = await service.getCurrentConversation();

      expect(current?.id).toBe(recent.id);
    });

    it('should return null if no conversations exist', async () => {
      const current = await service.getCurrentConversation();
      expect(current).toBeNull();
    });

    it('should exclude archived conversations', async () => {
      const archived = await service.createNewConversation('Archived');
      await service.archiveConversation(archived.id);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const active = await service.createNewConversation('Active');

      const current = await service.getCurrentConversation();

      expect(current?.id).toBe(active.id);
    });
  });

  // ===========================================================================
  // emitTypingIndicator Tests
  // ===========================================================================

  describe('emitTypingIndicator', () => {
    it('should emit typing event', () => {
      const eventSpy = jest.fn();
      service.on('chat_typing', eventSpy);

      service.emitTypingIndicator('conv-1', { type: 'orchestrator' }, true);

      expect(eventSpy).toHaveBeenCalled();
      expect(eventSpy.mock.calls[0][0].type).toBe('chat_typing');
      expect(eventSpy.mock.calls[0][0].data.isTyping).toBe(true);
    });

    it('should include conversation ID and sender', () => {
      const eventSpy = jest.fn();
      service.on('chat_typing', eventSpy);

      service.emitTypingIndicator('conv-123', { type: 'agent', name: 'Dev' }, true);

      const event = eventSpy.mock.calls[0][0];
      expect(event.data.conversationId).toBe('conv-123');
      expect(event.data.sender.type).toBe('agent');
      expect(event.data.sender.name).toBe('Dev');
    });
  });

  // ===========================================================================
  // getStatistics Tests
  // ===========================================================================

  describe('getStatistics', () => {
    it('should return statistics', async () => {
      await service.createNewConversation('Active 1');
      const archived = await service.createNewConversation('Archived');
      await service.archiveConversation(archived.id);

      const stats = await service.getStatistics();

      expect(stats.totalConversations).toBe(2);
      expect(stats.activeConversations).toBe(1);
      expect(stats.archivedConversations).toBe(1);
    });

    it('should count total messages', async () => {
      const conv = await service.createNewConversation();
      await service.sendMessage({ content: 'Msg 1', conversationId: conv.id });
      await service.sendMessage({ content: 'Msg 2', conversationId: conv.id });
      await service.addAgentMessage(conv.id, 'Response', { type: 'orchestrator' });

      const stats = await service.getStatistics();

      expect(stats.totalMessages).toBe(3);
    });

    it('should return zeros for empty service', async () => {
      const stats = await service.getStatistics();

      expect(stats.totalConversations).toBe(0);
      expect(stats.activeConversations).toBe(0);
      expect(stats.archivedConversations).toBe(0);
      expect(stats.totalMessages).toBe(0);
    });
  });

  // ===========================================================================
  // Persistence Tests
  // ===========================================================================

  describe('persistence', () => {
    it('should persist conversations to disk', async () => {
      await service.createNewConversation('Persisted');
      await service.sendMessage({ content: 'Test message' });

      // Create new service instance
      const newService = new ChatService({ chatDir: testDir });
      await newService.initialize();

      const conversations = await newService.getConversations();
      expect(conversations.some((c) => c.title === 'Persisted')).toBe(true);
    });

    it('should persist messages to disk', async () => {
      const conv = await service.createNewConversation('Test');
      await service.sendMessage({ content: 'Persistent message', conversationId: conv.id });

      // Create new service instance
      const newService = new ChatService({ chatDir: testDir });
      await newService.initialize();

      const messages = await newService.getMessages({ conversationId: conv.id });
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('Persistent message');
    });

    it('should handle corrupted conversation files', async () => {
      // Write a corrupted file
      await fs.writeFile(path.join(testDir, 'corrupted.json'), 'not valid json');

      // Should not throw during initialization
      const newService = new ChatService({ chatDir: testDir });
      await expect(newService.initialize()).resolves.not.toThrow();
    });
  });
});

// =============================================================================
// Singleton Tests
// =============================================================================

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

describe('resetChatService', () => {
  it('should reset the singleton', () => {
    const instance1 = getChatService();
    resetChatService();
    const instance2 = getChatService();
    expect(instance1).not.toBe(instance2);
  });
});

// =============================================================================
// Error Classes Tests
// =============================================================================

describe('ConversationNotFoundError', () => {
  it('should include conversation ID', () => {
    const error = new ConversationNotFoundError('conv-123');
    expect(error.conversationId).toBe('conv-123');
    expect(error.message).toContain('conv-123');
    expect(error.name).toBe('ConversationNotFoundError');
  });
});

describe('MessageValidationError', () => {
  it('should include error message', () => {
    const error = new MessageValidationError('Invalid content');
    expect(error.message).toBe('Invalid content');
    expect(error.name).toBe('MessageValidationError');
  });
});
