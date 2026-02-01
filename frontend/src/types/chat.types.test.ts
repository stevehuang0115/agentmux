/**
 * Chat Types Tests
 *
 * Tests for chat type definitions.
 *
 * @module types/chat.test
 */

import { describe, it, expect } from 'vitest';
import type {
  ChatSenderType,
  ChatContentType,
  ChatMessageStatus,
  ChatSender,
  ChatMessage,
  ChatConversation,
  SendMessageInput,
  SendMessageResult,
  ChatMessageEventData,
  ChatTypingEventData,
  ConversationUpdatedEventData,
  ChatWebSocketEventData,
} from './chat.types';

describe('Chat Types', () => {
  describe('ChatSender', () => {
    it('should allow valid user sender', () => {
      const sender: ChatSender = { type: 'user' };
      expect(sender.type).toBe('user');
    });

    it('should allow sender with all fields', () => {
      const sender: ChatSender = {
        type: 'agent',
        id: 'agent-1',
        name: 'Developer',
        role: 'developer',
      };
      expect(sender.type).toBe('agent');
      expect(sender.id).toBe('agent-1');
      expect(sender.name).toBe('Developer');
      expect(sender.role).toBe('developer');
    });
  });

  describe('ChatMessage', () => {
    it('should allow valid message', () => {
      const message: ChatMessage = {
        id: 'msg-1',
        conversationId: 'conv-1',
        from: { type: 'user' },
        content: 'Hello!',
        contentType: 'text',
        status: 'sent',
        timestamp: new Date().toISOString(),
      };

      expect(message.id).toBe('msg-1');
      expect(message.content).toBe('Hello!');
    });

    it('should allow message with metadata', () => {
      const message: ChatMessage = {
        id: 'msg-1',
        conversationId: 'conv-1',
        from: { type: 'orchestrator' },
        content: 'Task created',
        contentType: 'text',
        status: 'delivered',
        timestamp: new Date().toISOString(),
        metadata: {
          taskCreated: 'task-123',
          rawOutput: 'terminal output',
        },
      };

      expect(message.metadata?.taskCreated).toBe('task-123');
    });
  });

  describe('ChatConversation', () => {
    it('should allow valid conversation', () => {
      const conv: ChatConversation = {
        id: 'conv-1',
        participantIds: ['user'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isArchived: false,
        messageCount: 0,
      };

      expect(conv.id).toBe('conv-1');
      expect(conv.isArchived).toBe(false);
    });

    it('should allow conversation with title and last message', () => {
      const conv: ChatConversation = {
        id: 'conv-1',
        title: 'Project Discussion',
        participantIds: ['user', 'orchestrator'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isArchived: false,
        messageCount: 5,
        lastMessage: {
          content: 'Last message preview',
          timestamp: new Date().toISOString(),
          from: { type: 'user' },
        },
      };

      expect(conv.title).toBe('Project Discussion');
      expect(conv.lastMessage?.content).toBe('Last message preview');
    });
  });

  describe('SendMessageInput', () => {
    it('should allow minimal input', () => {
      const input: SendMessageInput = {
        content: 'Hello!',
      };
      expect(input.content).toBe('Hello!');
    });

    it('should allow input with all fields', () => {
      const input: SendMessageInput = {
        content: 'Hello!',
        conversationId: 'conv-1',
        metadata: { source: 'test' },
      };
      expect(input.conversationId).toBe('conv-1');
    });
  });

  describe('SendMessageResult', () => {
    it('should contain message and conversation', () => {
      const result: SendMessageResult = {
        message: {
          id: 'msg-1',
          conversationId: 'conv-1',
          from: { type: 'user' },
          content: 'Hello!',
          contentType: 'text',
          status: 'sent',
          timestamp: new Date().toISOString(),
        },
        conversation: {
          id: 'conv-1',
          participantIds: ['user'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isArchived: false,
          messageCount: 1,
        },
      };

      expect(result.message.id).toBe('msg-1');
      expect(result.conversation.id).toBe('conv-1');
    });
  });

  describe('WebSocket Event Data Types', () => {
    it('should allow chat message event', () => {
      const event: ChatMessageEventData = {
        type: 'chat_message',
        data: {
          id: 'msg-1',
          conversationId: 'conv-1',
          from: { type: 'user' },
          content: 'Hello!',
          contentType: 'text',
          status: 'sent',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
      expect(event.type).toBe('chat_message');
    });

    it('should allow chat typing event', () => {
      const event: ChatTypingEventData = {
        type: 'chat_typing',
        data: {
          conversationId: 'conv-1',
          sender: { type: 'orchestrator' },
          isTyping: true,
        },
        timestamp: new Date().toISOString(),
      };
      expect(event.type).toBe('chat_typing');
      expect(event.data.isTyping).toBe(true);
    });

    it('should allow conversation updated event', () => {
      const event: ConversationUpdatedEventData = {
        type: 'conversation_updated',
        data: {
          id: 'conv-1',
          participantIds: ['user'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isArchived: false,
          messageCount: 0,
        },
        timestamp: new Date().toISOString(),
      };
      expect(event.type).toBe('conversation_updated');
    });

    it('should allow union type for chat events', () => {
      const events: ChatWebSocketEventData[] = [
        {
          type: 'chat_message',
          data: {
            id: 'msg-1',
            conversationId: 'conv-1',
            from: { type: 'user' },
            content: 'Test',
            contentType: 'text',
            status: 'sent',
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        },
        {
          type: 'chat_typing',
          data: {
            conversationId: 'conv-1',
            sender: { type: 'orchestrator' },
            isTyping: true,
          },
          timestamp: new Date().toISOString(),
        },
      ];

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('chat_message');
      expect(events[1].type).toBe('chat_typing');
    });
  });
});
