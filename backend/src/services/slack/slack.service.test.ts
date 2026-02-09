/**
 * Tests for Slack Service
 *
 * @module services/slack/slack.service.test
 */

// Jest globals are available automatically
import { SlackService, getSlackService, resetSlackService } from './slack.service.js';
import type { SlackConfig, SlackNotification } from '../../types/slack.types.js';

describe('SlackService', () => {
  const mockConfig: SlackConfig = {
    botToken: 'xoxb-test-token',
    appToken: 'xapp-test-token',
    signingSecret: 'test-secret',
    socketMode: true,
    defaultChannelId: 'C123456',
    allowedUserIds: ['U123'],
  };

  beforeEach(() => {
    resetSlackService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetSlackService();
  });

  describe('getSlackService', () => {
    it('should return singleton instance', () => {
      const service1 = getSlackService();
      const service2 = getSlackService();
      expect(service1).toBe(service2);
    });

    it('should return SlackService instance', () => {
      const service = getSlackService();
      expect(service).toBeInstanceOf(SlackService);
    });
  });

  describe('resetSlackService', () => {
    it('should reset the singleton instance', () => {
      const service1 = getSlackService();
      resetSlackService();
      const service2 = getSlackService();
      expect(service1).not.toBe(service2);
    });
  });

  describe('SlackService class', () => {
    it('should have correct initial status', () => {
      const service = new SlackService();
      const status = service.getStatus();

      expect(status.connected).toBe(false);
      expect(status.socketMode).toBe(false);
      expect(status.messagesSent).toBe(0);
      expect(status.messagesReceived).toBe(0);
    });

    it('should report not connected when not initialized', () => {
      const service = new SlackService();
      expect(service.isConnected()).toBe(false);
    });

    it('should throw when sendMessage called without initialization', async () => {
      const service = new SlackService();

      await expect(
        service.sendMessage({ channelId: 'C123', text: 'test' })
      ).rejects.toThrow('Slack client not initialized');
    });

    it('should throw when updateMessage called without initialization', async () => {
      const service = new SlackService();

      await expect(
        service.updateMessage('C123', '123.456', 'updated text')
      ).rejects.toThrow('Slack client not initialized');
    });

    it('should throw when addReaction called without initialization', async () => {
      const service = new SlackService();

      await expect(
        service.addReaction('C123', '123.456', 'thumbsup')
      ).rejects.toThrow('Slack client not initialized');
    });

    it('should throw when getUserInfo called without initialization', async () => {
      const service = new SlackService();

      await expect(service.getUserInfo('U123')).rejects.toThrow(
        'Slack client not initialized'
      );
    });
  });

  describe('getConversationContext', () => {
    it('should create new context for new thread', () => {
      const service = getSlackService();

      const context = service.getConversationContext('thread-1', 'C123', 'U456');

      expect(context.threadTs).toBe('thread-1');
      expect(context.channelId).toBe('C123');
      expect(context.userId).toBe('U456');
      expect(context.messageCount).toBe(1);
      expect(context.conversationId).toBe('slack-C123:thread-1');
    });

    it('should return existing context and increment count', () => {
      const service = getSlackService();

      const context1 = service.getConversationContext('thread-1', 'C123', 'U456');
      const context2 = service.getConversationContext('thread-1', 'C123', 'U456');

      expect(context1).toBe(context2);
      expect(context2.messageCount).toBe(2);
    });

    it('should create separate contexts for different threads', () => {
      const service = getSlackService();

      const context1 = service.getConversationContext('thread-1', 'C123', 'U456');
      const context2 = service.getConversationContext('thread-2', 'C123', 'U456');

      expect(context1).not.toBe(context2);
      expect(context1.conversationId).not.toBe(context2.conversationId);
    });

    it('should create separate contexts for different channels', () => {
      const service = getSlackService();

      const context1 = service.getConversationContext('thread-1', 'C123', 'U456');
      const context2 = service.getConversationContext('thread-1', 'C789', 'U456');

      expect(context1).not.toBe(context2);
    });

    it('should update lastActivityAt on each access', () => {
      const service = getSlackService();

      const context1 = service.getConversationContext('thread-1', 'C123', 'U456');
      const firstStarted = context1.startedAt;

      const context2 = service.getConversationContext('thread-1', 'C123', 'U456');

      expect(context2.startedAt).toBe(firstStarted); // startedAt should not change
      expect(context2.lastActivityAt).toBeDefined();
    });
  });

  describe('getStatus', () => {
    it('should return initial status', () => {
      const service = getSlackService();
      const status = service.getStatus();

      expect(status.connected).toBe(false);
      expect(status.socketMode).toBe(false);
      expect(status.messagesSent).toBe(0);
      expect(status.messagesReceived).toBe(0);
    });

    it('should return a copy of status object', () => {
      const service = getSlackService();
      const status1 = service.getStatus();
      const status2 = service.getStatus();

      expect(status1).not.toBe(status2);
      expect(status1).toEqual(status2);
    });

    it('should not be mutatable from outside', () => {
      const service = getSlackService();
      const status = service.getStatus();

      status.messagesSent = 999;

      const freshStatus = service.getStatus();
      expect(freshStatus.messagesSent).toBe(0);
    });
  });

  describe('isConnected', () => {
    it('should return false when not initialized', () => {
      const service = getSlackService();
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should handle disconnect when not connected', async () => {
      const service = getSlackService();

      // Should not throw
      await expect(service.disconnect()).resolves.not.toThrow();
    });
  });

  describe('event emitter', () => {
    it('should be an EventEmitter', () => {
      const service = getSlackService();

      expect(typeof service.on).toBe('function');
      expect(typeof service.emit).toBe('function');
      expect(typeof service.removeListener).toBe('function');
    });

    it('should allow registering event handlers', () => {
      const service = getSlackService();
      const handler = jest.fn();

      service.on('connected', handler);
      service.emit('connected');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('initialize without @slack/bolt installed', () => {
    it('should throw error when @slack/bolt is not available', async () => {
      const service = getSlackService();

      // Since @slack/bolt is not installed, initialize should throw
      await expect(service.initialize(mockConfig)).rejects.toThrow();
    });
  });

  describe('formatNotificationBlocks', () => {
    it('should generate valid Slack blocks with plain string context text', () => {
      const service = new SlackService();

      // Access private method via any for testing
      const blocks = (service as any).formatNotificationBlocks({
        type: 'task_completed',
        title: 'Task Done',
        message: 'Agent finished work.',
        urgency: 'normal',
        timestamp: '2026-02-09T12:00:00.000Z',
      } as SlackNotification);

      // Should have header, section, and context blocks
      expect(blocks).toHaveLength(3);
      expect(blocks[0].type).toBe('header');
      expect(blocks[1].type).toBe('section');
      expect(blocks[2].type).toBe('context');

      // Context element should be a text object with type and plain string text
      const contextElement = blocks[2].elements[0];
      expect(contextElement.type).toBe('mrkdwn');
      // text should be a plain string (Slack context element format), not a nested object
      expect(typeof contextElement.text).toBe('string');
      expect(contextElement.text).toContain('Sent at');
    });
  });
});
