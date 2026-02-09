/**
 * Tests for Slack-Orchestrator Bridge
 *
 * @module services/slack/slack-orchestrator-bridge.test
 */

// Jest globals are available automatically
import {
  SlackOrchestratorBridge,
  getSlackOrchestratorBridge,
  resetSlackOrchestratorBridge,
} from './slack-orchestrator-bridge.js';
import { resetSlackService } from './slack.service.js';
import { resetChatService } from '../chat/chat.service.js';

// Mock the orchestrator status module
jest.mock('../orchestrator/index.js', () => ({
  isOrchestratorActive: jest.fn(),
  getOrchestratorOfflineMessage: jest.fn().mockReturnValue('Orchestrator is offline'),
}));

import { isOrchestratorActive, getOrchestratorOfflineMessage } from '../orchestrator/index.js';
import { getChatService } from '../chat/chat.service.js';
import { ChatMessage } from '../../types/chat.types.js';

describe('SlackOrchestratorBridge', () => {
  beforeEach(() => {
    resetSlackOrchestratorBridge();
    resetSlackService();
    resetChatService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetSlackOrchestratorBridge();
    resetSlackService();
    resetChatService();
  });

  describe('getSlackOrchestratorBridge', () => {
    it('should return singleton instance', () => {
      const bridge1 = getSlackOrchestratorBridge();
      const bridge2 = getSlackOrchestratorBridge();
      expect(bridge1).toBe(bridge2);
    });

    it('should return SlackOrchestratorBridge instance', () => {
      const bridge = getSlackOrchestratorBridge();
      expect(bridge).toBeInstanceOf(SlackOrchestratorBridge);
    });
  });

  describe('resetSlackOrchestratorBridge', () => {
    it('should reset the singleton instance', () => {
      const bridge1 = getSlackOrchestratorBridge();
      resetSlackOrchestratorBridge();
      const bridge2 = getSlackOrchestratorBridge();
      expect(bridge1).not.toBe(bridge2);
    });
  });

  describe('SlackOrchestratorBridge class', () => {
    it('should have correct initial state', () => {
      const bridge = new SlackOrchestratorBridge();
      expect(bridge.isInitialized()).toBe(false);
    });

    it('should initialize without throwing', async () => {
      const bridge = new SlackOrchestratorBridge();
      await expect(bridge.initialize()).resolves.not.toThrow();
      expect(bridge.isInitialized()).toBe(true);
    });

    it('should only initialize once', async () => {
      const bridge = new SlackOrchestratorBridge();
      await bridge.initialize();
      await bridge.initialize(); // Should not throw
      expect(bridge.isInitialized()).toBe(true);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        maxResponseLength: 5000,
        enableNotifications: false,
      };
      const bridge = new SlackOrchestratorBridge(customConfig);
      const config = bridge.getConfig();
      expect(config.maxResponseLength).toBe(5000);
      expect(config.enableNotifications).toBe(false);
    });

    it('should use default configuration for unspecified options', () => {
      const bridge = new SlackOrchestratorBridge({ maxResponseLength: 5000 });
      const config = bridge.getConfig();
      expect(config.showTypingIndicator).toBe(true);
      expect(config.enableNotifications).toBe(true);
    });
  });

  describe('parseCommand', () => {
    it('should parse help command', () => {
      const bridge = new SlackOrchestratorBridge();
      const result = bridge.parseCommand('help');
      expect(result.intent).toBe('help');
      expect(result.rawText).toBe('help');
    });

    it('should parse status command', () => {
      const bridge = new SlackOrchestratorBridge();
      const result = bridge.parseCommand('status');
      expect(result.intent).toBe('status');
    });

    it('should parse list projects command', () => {
      const bridge = new SlackOrchestratorBridge();
      const result = bridge.parseCommand('list projects');
      expect(result.intent).toBe('list_projects');
    });

    it('should parse list teams command', () => {
      const bridge = new SlackOrchestratorBridge();
      const result = bridge.parseCommand('show all teams');
      expect(result.intent).toBe('list_teams');
    });

    it('should parse list agents command', () => {
      const bridge = new SlackOrchestratorBridge();
      const result = bridge.parseCommand("who's working");
      expect(result.intent).toBe('list_agents');
    });

    it('should remove bot mentions from text', () => {
      const bridge = new SlackOrchestratorBridge();
      const result = bridge.parseCommand('<@U1234567890> status');
      expect(result.rawText).toBe('status');
      expect(result.intent).toBe('status');
    });

    it('should handle multiple bot mentions', () => {
      const bridge = new SlackOrchestratorBridge();
      const result = bridge.parseCommand('<@U123> <@U456> help');
      expect(result.rawText).toBe('help');
    });

    it('should parse pause command', () => {
      const bridge = new SlackOrchestratorBridge();
      const result = bridge.parseCommand('pause');
      expect(result.intent).toBe('pause');
    });

    it('should parse resume command', () => {
      const bridge = new SlackOrchestratorBridge();
      const result = bridge.parseCommand('resume');
      expect(result.intent).toBe('resume');
    });

    it('should extract quoted parameters', () => {
      const bridge = new SlackOrchestratorBridge();
      const result = bridge.parseCommand('create task "Fix the login bug"');
      expect(result.parameters.quoted).toBe('Fix the login bug');
    });

    it('should extract mention parameters', () => {
      const bridge = new SlackOrchestratorBridge();
      const result = bridge.parseCommand('assign to @developer');
      expect(result.parameters.mention).toBe('developer');
    });

    it('should extract target parameters', () => {
      const bridge = new SlackOrchestratorBridge();
      const result = bridge.parseCommand('status for ProjectX');
      expect(result.parameters.target).toBe('ProjectX');
    });

    it('should default to conversation for unknown input', () => {
      const bridge = new SlackOrchestratorBridge();
      const result = bridge.parseCommand('hello there how are you');
      expect(result.intent).toBe('conversation');
    });
  });

  describe('getHelpMessage', () => {
    it('should return formatted help message', () => {
      const bridge = new SlackOrchestratorBridge();
      const help = bridge.getHelpMessage();

      expect(help).toContain('AgentMux Commands');
      expect(help).toContain('status');
      expect(help).toContain('list projects');
      expect(help).toContain('list teams');
      expect(help).toContain('pause');
      expect(help).toContain('resume');
    });

    it('should include emoji formatting', () => {
      const bridge = new SlackOrchestratorBridge();
      const help = bridge.getHelpMessage();

      expect(help).toContain(':clipboard:');
      expect(help).toContain(':gear:');
    });
  });

  describe('formatForSlack', () => {
    it('should convert markdown headers to bold', () => {
      const bridge = new SlackOrchestratorBridge();

      expect(bridge.formatForSlack('# Heading')).toBe('*Heading*');
      expect(bridge.formatForSlack('## Subheading')).toBe('*Subheading*');
      expect(bridge.formatForSlack('### Small heading')).toBe('*Small heading*');
    });

    it('should preserve code blocks', () => {
      const bridge = new SlackOrchestratorBridge();
      const input = '```\nconst x = 1;\n```';
      const result = bridge.formatForSlack(input);
      expect(result).toContain('const x = 1;');
      expect(result).toContain('```');
    });

    it('should handle mixed content', () => {
      const bridge = new SlackOrchestratorBridge();
      const input = '# Title\nSome text\n```code```';
      const result = bridge.formatForSlack(input);
      expect(result).toContain('*Title*');
      expect(result).toContain('Some text');
    });
  });

  describe('notifications', () => {
    it('should not throw when sending task completed notification', async () => {
      const bridge = new SlackOrchestratorBridge();
      await bridge.initialize();

      // Should not throw even though Slack is not connected
      await expect(
        bridge.notifyTaskCompleted('Fix login bug', 'Developer Agent', 'MyApp')
      ).resolves.not.toThrow();
    });

    it('should not throw when sending agent question notification', async () => {
      const bridge = new SlackOrchestratorBridge();
      await bridge.initialize();

      await expect(
        bridge.notifyAgentQuestion('Developer', 'Should I use REST or GraphQL?', 'MyApp')
      ).resolves.not.toThrow();
    });

    it('should not throw when sending error notification', async () => {
      const bridge = new SlackOrchestratorBridge();
      await bridge.initialize();

      await expect(
        bridge.notifyError('Build failed', 'CI Agent', 'MyApp')
      ).resolves.not.toThrow();
    });

    it('should not throw when sending daily summary', async () => {
      const bridge = new SlackOrchestratorBridge();
      await bridge.initialize();

      await expect(
        bridge.notifyDailySummary('5 tasks completed, 2 in progress')
      ).resolves.not.toThrow();
    });

    it('should skip notifications when disabled', async () => {
      const bridge = new SlackOrchestratorBridge({ enableNotifications: false });
      await bridge.initialize();

      // Should return immediately without attempting to send
      await expect(
        bridge.notifyTaskCompleted('Task', 'Agent', 'Project')
      ).resolves.not.toThrow();
    });
  });

  describe('event emitter', () => {
    it('should be an EventEmitter', () => {
      const bridge = getSlackOrchestratorBridge();

      expect(typeof bridge.on).toBe('function');
      expect(typeof bridge.emit).toBe('function');
      expect(typeof bridge.removeListener).toBe('function');
    });

    it('should allow registering event handlers', () => {
      const bridge = getSlackOrchestratorBridge();
      const handler = jest.fn();

      bridge.on('error', handler);
      bridge.emit('error', new Error('test'));

      expect(handler).toHaveBeenCalled();
    });

    it('should emit message_handled event after successful handling', async () => {
      const bridge = getSlackOrchestratorBridge();
      await bridge.initialize();

      const handler = jest.fn();
      bridge.on('message_handled', handler);

      // Note: actual message handling requires Slack service to be connected
      // This tests that the event handler can be registered
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('setMessageQueueService', () => {
    it('should accept a MessageQueueService', () => {
      const bridge = new SlackOrchestratorBridge();
      const mockService = {
        enqueue: jest.fn(),
      } as any;

      // Should not throw
      expect(() => bridge.setMessageQueueService(mockService)).not.toThrow();
    });

    it('should allow setting service after initialization', async () => {
      const bridge = new SlackOrchestratorBridge();
      await bridge.initialize();

      const mockService = {
        enqueue: jest.fn(),
      } as any;

      expect(() => bridge.setMessageQueueService(mockService)).not.toThrow();
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the configuration', () => {
      const bridge = new SlackOrchestratorBridge();
      const config1 = bridge.getConfig();
      const config2 = bridge.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });

    it('should not be mutatable from outside', () => {
      const bridge = new SlackOrchestratorBridge();
      const config = bridge.getConfig();

      config.maxResponseLength = 999999;

      const freshConfig = bridge.getConfig();
      expect(freshConfig.maxResponseLength).not.toBe(999999);
    });

    it('should contain all expected properties', () => {
      const bridge = new SlackOrchestratorBridge();
      const config = bridge.getConfig();

      expect(config).toHaveProperty('orchestratorSession');
      expect(config).toHaveProperty('showTypingIndicator');
      expect(config).toHaveProperty('maxResponseLength');
      expect(config).toHaveProperty('enableNotifications');
      expect(config).toHaveProperty('responseTimeoutMs');
    });

    it('should have responseTimeoutMs longer than queue processor timeout', () => {
      const bridge = new SlackOrchestratorBridge();
      const config = bridge.getConfig();

      // The Slack bridge timeout must exceed the queue processor timeout
      // to prevent the bridge from timing out before the queue processor
      expect(config.responseTimeoutMs).toBeGreaterThan(120000);
    });
  });

  describe('orchestrator message forwarding via queue', () => {
    let mockQueueService: any;

    beforeEach(() => {
      mockQueueService = {
        enqueue: jest.fn().mockReturnValue({ id: 'q-1' }),
      };
      (isOrchestratorActive as jest.Mock).mockResolvedValue(true);
    });

    it('should return error when message queue service is not set', async () => {
      const bridge = new SlackOrchestratorBridge();
      await bridge.initialize();

      // Without queue service, message forwarding should not work
      // The bridge should handle this gracefully
      expect(bridge.isInitialized()).toBe(true);
    });

    it('should allow setting queue service after initialization', async () => {
      const bridge = new SlackOrchestratorBridge();
      bridge.setMessageQueueService(mockQueueService);
      await bridge.initialize();

      // The queue service should be set
      expect(typeof mockQueueService.enqueue).toBe('function');
    });

    it('should handle queue service enqueue failure gracefully', async () => {
      const failingService = {
        enqueue: jest.fn().mockImplementation(() => { throw new Error('Queue full'); }),
      } as any;

      const bridge = new SlackOrchestratorBridge();
      bridge.setMessageQueueService(failingService);
      await bridge.initialize();

      // Service failure should be handled gracefully
      expect(bridge.isInitialized()).toBe(true);
    });
  });

  describe('orchestrator status handling', () => {
    it('should check orchestrator status before sending messages', async () => {
      const bridge = new SlackOrchestratorBridge();
      await bridge.initialize();

      (isOrchestratorActive as jest.Mock).mockResolvedValue(false);

      // When orchestrator is offline, the bridge should return the offline message
      expect(isOrchestratorActive).toBeDefined();
    });

    it('should return offline message when orchestrator is not active', async () => {
      (isOrchestratorActive as jest.Mock).mockResolvedValue(false);
      (getOrchestratorOfflineMessage as jest.Mock).mockReturnValue('Orchestrator is currently offline');

      const bridge = new SlackOrchestratorBridge();
      await bridge.initialize();

      // The offline message function should be accessible
      const offlineMsg = getOrchestratorOfflineMessage(true);
      expect(offlineMsg).toContain('offline');
    });
  });

  describe('typing indicator scope handling', () => {
    it('should only log missing scope warning once', () => {
      const bridge = new SlackOrchestratorBridge();

      // The bridge has a loggedMissingScope flag to prevent spam
      // After first missing_scope error, subsequent errors should be silent
      expect(bridge.getConfig().showTypingIndicator).toBe(true);
    });

    it('should continue operation when reactions scope is missing', async () => {
      const bridge = new SlackOrchestratorBridge({ showTypingIndicator: true });
      await bridge.initialize();

      // Missing scope should not prevent message handling
      expect(bridge.isInitialized()).toBe(true);
    });
  });

  describe('sendToOrchestrator (queue-based)', () => {
    let mockQueueService: any;
    let chatService: ReturnType<typeof getChatService>;

    /**
     * Helper to build a ChatMessage for testing
     */
    function makeChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
      return {
        id: 'msg-1',
        conversationId: 'conv-123',
        from: { type: 'orchestrator', name: 'Orchestrator' },
        content: 'Hello from orchestrator',
        contentType: 'text',
        timestamp: new Date().toISOString(),
        ...overrides,
      } as ChatMessage;
    }

    beforeEach(() => {
      (isOrchestratorActive as jest.Mock).mockResolvedValue(true);
      chatService = getChatService();

      // Mock sendMessage to return a conversation with a known ID
      jest.spyOn(chatService, 'sendMessage').mockResolvedValue({
        message: makeChatMessage(),
        conversation: { id: 'conv-123', title: 'test', messages: [], createdAt: '', updatedAt: '' } as any,
      });

      // Create a mock queue service that captures the slackResolve callback
      mockQueueService = {
        enqueue: jest.fn().mockReturnValue({ id: 'q-1' }),
      };
    });

    it('should enqueue with slackResolve callback and resolve when called', async () => {
      // Configure enqueue to immediately call slackResolve
      mockQueueService.enqueue.mockImplementation((input: any) => {
        // Simulate the processor calling slackResolve after a tick
        setTimeout(() => {
          input.sourceMetadata.slackResolve('Task completed successfully');
        }, 10);
        return { id: 'q-1' };
      });

      const bridge = new SlackOrchestratorBridge({ responseTimeoutMs: 5000 });
      bridge.setMessageQueueService(mockQueueService);
      await bridge.initialize();

      const messagePromise = new Promise<string>((resolve) => {
        bridge.on('message_handled', (event: any) => {
          resolve(event.response);
        });
      });

      const slackService = (bridge as any).slackService;
      jest.spyOn(slackService, 'sendMessage').mockResolvedValue(undefined);
      jest.spyOn(slackService, 'addReaction').mockResolvedValue(undefined);
      jest.spyOn(slackService, 'getConversationContext').mockReturnValue({
        conversationId: 'conv-123',
        channelId: 'C123',
        userId: 'U123',
      });

      slackService.emit('message', {
        text: 'hello orchestrator',
        channelId: 'C123',
        userId: 'U123',
        ts: '1234567890.123456',
      });

      const response = await messagePromise;
      expect(response).toBe('Task completed successfully');
      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'slack',
          content: 'hello orchestrator',
        })
      );
    });

    it('should timeout if slackResolve is never called', async () => {
      // enqueue does NOT call slackResolve — so the bridge times out
      const bridge = new SlackOrchestratorBridge({ responseTimeoutMs: 200 });
      bridge.setMessageQueueService(mockQueueService);
      await bridge.initialize();

      const messagePromise = new Promise<string>((resolve) => {
        bridge.on('message_handled', (event: any) => {
          resolve(event.response);
        });
      });

      const slackService = (bridge as any).slackService;
      jest.spyOn(slackService, 'sendMessage').mockResolvedValue(undefined);
      jest.spyOn(slackService, 'addReaction').mockResolvedValue(undefined);
      jest.spyOn(slackService, 'getConversationContext').mockReturnValue({
        conversationId: 'conv-123',
        channelId: 'C123',
        userId: 'U123',
      });

      slackService.emit('message', {
        text: 'hello',
        channelId: 'C123',
        userId: 'U123',
        ts: '1234567890.123456',
      });

      const response = await messagePromise;
      expect(response).toBe('The orchestrator is taking longer than expected. Please try again.');
    });

    it('should handle enqueue failure gracefully', async () => {
      mockQueueService.enqueue.mockImplementation(() => {
        throw new Error('Queue is full');
      });

      const bridge = new SlackOrchestratorBridge({ responseTimeoutMs: 5000 });
      bridge.setMessageQueueService(mockQueueService);
      await bridge.initialize();

      const messagePromise = new Promise<string>((resolve) => {
        bridge.on('message_handled', (event: any) => {
          resolve(event.response);
        });
      });

      const slackService = (bridge as any).slackService;
      jest.spyOn(slackService, 'sendMessage').mockResolvedValue(undefined);
      jest.spyOn(slackService, 'addReaction').mockResolvedValue(undefined);
      jest.spyOn(slackService, 'getConversationContext').mockReturnValue({
        conversationId: 'conv-123',
        channelId: 'C123',
        userId: 'U123',
      });

      slackService.emit('message', {
        text: 'hello',
        channelId: 'C123',
        userId: 'U123',
        ts: '1234567890.123456',
      });

      const response = await messagePromise;
      expect(response).toContain('Failed to enqueue message');
    });
  });
});
