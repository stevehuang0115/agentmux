# Task: Create Slack Service

## Overview

Create the core Slack service that manages the bot connection, sends messages, and handles authentication. This service uses Slack's Bolt SDK for reliable real-time communication.

## Priority

**High** - Core Slack integration component

## Dependencies

- `43-slack-types.md` - Slack types must exist

## Files to Create

### 1. Create `backend/src/services/slack/slack.service.ts`

```typescript
/**
 * Slack Service
 *
 * Manages Slack bot connection and messaging using Bolt SDK.
 * Enables bidirectional communication between Slack and AgentMux.
 *
 * @module services/slack
 */

import { App, LogLevel } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import {
  SlackConfig,
  SlackIncomingMessage,
  SlackOutgoingMessage,
  SlackServiceStatus,
  SlackConversationContext,
  SlackNotification,
  SlackBlock,
  isUserAllowed,
} from '../../types/slack.types.js';
import { EventEmitter } from 'events';

/**
 * Events emitted by SlackService
 */
export interface SlackServiceEvents {
  message: (message: SlackIncomingMessage) => void;
  connected: () => void;
  disconnected: (error?: Error) => void;
  error: (error: Error) => void;
}

/**
 * Slack Service singleton instance
 */
let slackServiceInstance: SlackService | null = null;

/**
 * SlackService class for managing Slack bot operations
 */
export class SlackService extends EventEmitter {
  private app: App | null = null;
  private client: WebClient | null = null;
  private config: SlackConfig | null = null;
  private status: SlackServiceStatus = {
    connected: false,
    socketMode: false,
    messagesSent: 0,
    messagesReceived: 0,
  };
  private conversationContexts: Map<string, SlackConversationContext> = new Map();

  /**
   * Initialize the Slack service with configuration
   *
   * @param config - Slack bot configuration
   * @returns Promise that resolves when connected
   */
  async initialize(config: SlackConfig): Promise<void> {
    this.config = config;

    try {
      this.app = new App({
        token: config.botToken,
        appToken: config.appToken,
        signingSecret: config.signingSecret,
        socketMode: config.socketMode,
        logLevel: LogLevel.INFO,
      });

      this.client = this.app.client;

      // Set up event handlers
      this.setupEventHandlers();

      // Start the app
      if (config.socketMode) {
        await this.app.start();
        this.status.connected = true;
        this.status.socketMode = true;
        this.emit('connected');
        console.log('[SlackService] Connected in Socket Mode');
      }
    } catch (error) {
      this.status.lastError = (error as Error).message;
      this.status.lastErrorAt = new Date().toISOString();
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Set up Slack event handlers
   */
  private setupEventHandlers(): void {
    if (!this.app || !this.config) return;

    // Handle direct messages
    this.app.message(async ({ message, say }) => {
      if (!this.config) return;

      // Type guard for message with text
      if (!('text' in message) || !message.text) return;
      if (!('user' in message) || !message.user) return;

      // Check user permissions
      if (!isUserAllowed(message.user, this.config)) {
        console.log(`[SlackService] Unauthorized user: ${message.user}`);
        return;
      }

      const incomingMessage: SlackIncomingMessage = {
        id: message.ts || '',
        type: 'message',
        text: message.text,
        userId: message.user,
        channelId: message.channel,
        threadTs: 'thread_ts' in message ? message.thread_ts : undefined,
        ts: message.ts || '',
        teamId: 'team' in message ? (message.team as string) : '',
        eventTs: message.ts || '',
      };

      this.status.messagesReceived++;
      this.status.lastEventAt = new Date().toISOString();
      this.emit('message', incomingMessage);
    });

    // Handle @mentions
    this.app.event('app_mention', async ({ event }) => {
      if (!this.config) return;

      if (!isUserAllowed(event.user, this.config)) {
        console.log(`[SlackService] Unauthorized user mention: ${event.user}`);
        return;
      }

      const incomingMessage: SlackIncomingMessage = {
        id: event.ts,
        type: 'app_mention',
        text: event.text,
        userId: event.user,
        channelId: event.channel,
        threadTs: event.thread_ts,
        ts: event.ts,
        teamId: event.team || '',
        eventTs: event.event_ts,
      };

      this.status.messagesReceived++;
      this.status.lastEventAt = new Date().toISOString();
      this.emit('message', incomingMessage);
    });

    // Handle errors
    this.app.error(async (error) => {
      console.error('[SlackService] Error:', error);
      this.status.lastError = error.message;
      this.status.lastErrorAt = new Date().toISOString();
      this.emit('error', error);
    });
  }

  /**
   * Send a message to Slack
   *
   * @param message - Message to send
   * @returns Promise with message timestamp
   */
  async sendMessage(message: SlackOutgoingMessage): Promise<string> {
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }

    try {
      const result = await this.client.chat.postMessage({
        channel: message.channelId,
        text: message.text,
        thread_ts: message.threadTs,
        blocks: message.blocks as any,
        attachments: message.attachments as any,
        unfurl_links: message.unfurlLinks,
        unfurl_media: message.unfurlMedia,
      });

      this.status.messagesSent++;
      return result.ts || '';
    } catch (error) {
      console.error('[SlackService] Send message error:', error);
      throw error;
    }
  }

  /**
   * Send a notification to the default channel
   *
   * @param notification - Notification to send
   */
  async sendNotification(notification: SlackNotification): Promise<void> {
    if (!this.config?.defaultChannelId) {
      console.warn('[SlackService] No default channel configured for notifications');
      return;
    }

    const blocks = this.formatNotificationBlocks(notification);

    await this.sendMessage({
      channelId: this.config.defaultChannelId,
      text: `${notification.title}: ${notification.message}`,
      blocks,
    });
  }

  /**
   * Format notification as Slack blocks
   */
  private formatNotificationBlocks(notification: SlackNotification): SlackBlock[] {
    const urgencyEmoji: Record<string, string> = {
      low: ':white_circle:',
      normal: ':large_blue_circle:',
      high: ':large_orange_circle:',
      critical: ':red_circle:',
    };

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${urgencyEmoji[notification.urgency]} ${notification.title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: notification.message,
        },
      },
    ];

    // Add metadata fields if present
    if (notification.metadata) {
      const fields: Array<{ type: 'mrkdwn'; text: string }> = [];
      if (notification.metadata.projectId) {
        fields.push({ type: 'mrkdwn', text: `*Project:* ${notification.metadata.projectId}` });
      }
      if (notification.metadata.teamId) {
        fields.push({ type: 'mrkdwn', text: `*Team:* ${notification.metadata.teamId}` });
      }
      if (notification.metadata.agentId) {
        fields.push({ type: 'mrkdwn', text: `*Agent:* ${notification.metadata.agentId}` });
      }

      if (fields.length > 0) {
        blocks.push({
          type: 'section',
          fields,
        });
      }
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Sent at ${new Date(notification.timestamp).toLocaleString()}`,
        },
      ],
    });

    return blocks;
  }

  /**
   * Update a message
   *
   * @param channelId - Channel ID
   * @param messageTs - Message timestamp
   * @param text - New text
   * @param blocks - Optional new blocks
   */
  async updateMessage(
    channelId: string,
    messageTs: string,
    text: string,
    blocks?: SlackBlock[]
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }

    await this.client.chat.update({
      channel: channelId,
      ts: messageTs,
      text,
      blocks: blocks as any,
    });
  }

  /**
   * Add a reaction to a message
   */
  async addReaction(channelId: string, messageTs: string, emoji: string): Promise<void> {
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }

    await this.client.reactions.add({
      channel: channelId,
      timestamp: messageTs,
      name: emoji,
    });
  }

  /**
   * Get or create conversation context
   */
  getConversationContext(
    threadTs: string,
    channelId: string,
    userId: string
  ): SlackConversationContext {
    const key = `${channelId}:${threadTs}`;
    let context = this.conversationContexts.get(key);

    if (!context) {
      context = {
        threadTs,
        channelId,
        userId,
        conversationId: `slack-${key}`,
        startedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        messageCount: 0,
      };
      this.conversationContexts.set(key, context);
    }

    context.lastActivityAt = new Date().toISOString();
    context.messageCount++;
    return context;
  }

  /**
   * Get service status
   */
  getStatus(): SlackServiceStatus {
    return { ...this.status };
  }

  /**
   * Check if service is connected
   */
  isConnected(): boolean {
    return this.status.connected;
  }

  /**
   * Disconnect from Slack
   */
  async disconnect(): Promise<void> {
    if (this.app) {
      await this.app.stop();
      this.status.connected = false;
      this.emit('disconnected');
      console.log('[SlackService] Disconnected');
    }
  }

  /**
   * Get user info
   */
  async getUserInfo(userId: string): Promise<{ name: string; realName: string; email?: string }> {
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }

    const result = await this.client.users.info({ user: userId });
    return {
      name: result.user?.name || userId,
      realName: result.user?.real_name || userId,
      email: result.user?.profile?.email,
    };
  }
}

/**
 * Get the SlackService singleton instance
 */
export function getSlackService(): SlackService {
  if (!slackServiceInstance) {
    slackServiceInstance = new SlackService();
  }
  return slackServiceInstance;
}

/**
 * Reset the SlackService instance (for testing)
 */
export function resetSlackService(): void {
  if (slackServiceInstance) {
    slackServiceInstance.disconnect().catch(() => {});
    slackServiceInstance = null;
  }
}
```

### 2. Create `backend/src/services/slack/index.ts`

```typescript
export { SlackService, getSlackService, resetSlackService } from './slack.service.js';
```

### 3. Create `backend/src/services/slack/slack.service.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SlackService, getSlackService, resetSlackService } from './slack.service.js';
import { SlackConfig, SlackNotification } from '../../types/slack.types.js';

// Mock @slack/bolt
vi.mock('@slack/bolt', () => ({
  App: vi.fn().mockImplementation(() => ({
    client: {
      chat: {
        postMessage: vi.fn().mockResolvedValue({ ts: '1234567890.123456' }),
        update: vi.fn().mockResolvedValue({}),
      },
      reactions: {
        add: vi.fn().mockResolvedValue({}),
      },
      users: {
        info: vi.fn().mockResolvedValue({
          user: { name: 'testuser', real_name: 'Test User', profile: { email: 'test@example.com' } },
        }),
      },
    },
    message: vi.fn(),
    event: vi.fn(),
    error: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  })),
  LogLevel: { INFO: 'info' },
}));

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
  });

  describe('initialize', () => {
    it('should initialize and connect in socket mode', async () => {
      const service = getSlackService();
      await service.initialize(mockConfig);

      expect(service.isConnected()).toBe(true);
      expect(service.getStatus().socketMode).toBe(true);
    });
  });

  describe('sendMessage', () => {
    it('should send a message', async () => {
      const service = getSlackService();
      await service.initialize(mockConfig);

      const ts = await service.sendMessage({
        channelId: 'C123456',
        text: 'Hello world',
      });

      expect(ts).toBe('1234567890.123456');
      expect(service.getStatus().messagesSent).toBe(1);
    });

    it('should throw if not initialized', async () => {
      const service = new SlackService();

      await expect(
        service.sendMessage({ channelId: 'C123', text: 'test' })
      ).rejects.toThrow('Slack client not initialized');
    });
  });

  describe('sendNotification', () => {
    it('should send notification with blocks', async () => {
      const service = getSlackService();
      await service.initialize(mockConfig);

      const notification: SlackNotification = {
        type: 'task_completed',
        title: 'Task Completed',
        message: 'The feature has been implemented',
        urgency: 'normal',
        timestamp: new Date().toISOString(),
        metadata: {
          projectId: 'proj-123',
          agentId: 'agent-456',
        },
      };

      await service.sendNotification(notification);

      expect(service.getStatus().messagesSent).toBe(1);
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
    });

    it('should return existing context and increment count', () => {
      const service = getSlackService();

      const context1 = service.getConversationContext('thread-1', 'C123', 'U456');
      const context2 = service.getConversationContext('thread-1', 'C123', 'U456');

      expect(context1).toBe(context2);
      expect(context2.messageCount).toBe(2);
    });
  });

  describe('getUserInfo', () => {
    it('should return user info', async () => {
      const service = getSlackService();
      await service.initialize(mockConfig);

      const info = await service.getUserInfo('U123');

      expect(info.name).toBe('testuser');
      expect(info.realName).toBe('Test User');
      expect(info.email).toBe('test@example.com');
    });
  });
});
```

## Package Dependencies

Add to `backend/package.json`:

```json
{
  "dependencies": {
    "@slack/bolt": "^3.17.0",
    "@slack/web-api": "^6.11.0"
  }
}
```

## Environment Variables

Add to `.env` or environment:

```bash
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_DEFAULT_CHANNEL=C0123456789
SLACK_ALLOWED_USERS=U0123456789,U9876543210  # Optional
```

## Acceptance Criteria

- [ ] `backend/src/services/slack/slack.service.ts` created
- [ ] `backend/src/services/slack/index.ts` created
- [ ] `backend/src/services/slack/slack.service.test.ts` created
- [ ] Service connects to Slack in Socket Mode
- [ ] Service emits events for incoming messages
- [ ] Service can send messages and notifications
- [ ] Conversation context tracking works
- [ ] User permission checking works
- [ ] TypeScript compilation passes
- [ ] All tests pass

## Testing Requirements

- Unit tests with mocked Slack SDK
- Connection/disconnection tests
- Message sending tests
- Notification formatting tests
- Context tracking tests

## Estimated Effort

30 minutes

## Notes

- Uses Slack Bolt SDK for simplicity
- Socket Mode avoids need for public webhook endpoint
- Event emitter pattern allows loose coupling with orchestrator
- Consider adding rate limiting for outgoing messages
