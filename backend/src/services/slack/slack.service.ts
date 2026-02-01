/**
 * Slack Service
 *
 * Manages Slack bot connection and messaging using Bolt SDK.
 * Enables bidirectional communication between Slack and AgentMux.
 *
 * @module services/slack
 */

import { EventEmitter } from 'events';
import type {
  SlackConfig,
  SlackIncomingMessage,
  SlackOutgoingMessage,
  SlackServiceStatus,
  SlackConversationContext,
  SlackNotification,
  SlackBlock,
  SlackTextObject,
} from '../../types/slack.types.js';
import { isUserAllowed } from '../../types/slack.types.js';

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
 * Slack App interface (subset of Bolt App)
 */
interface SlackApp {
  client: SlackWebClient;
  message: (handler: (args: MessageEventArgs) => Promise<void>) => void;
  event: (
    eventType: string,
    handler: (args: AppMentionEventArgs) => Promise<void>
  ) => void;
  error: (handler: (error: Error) => Promise<void>) => void;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * Slack Web Client interface
 */
interface SlackWebClient {
  chat: {
    postMessage: (args: PostMessageArgs) => Promise<{ ts?: string }>;
    update: (args: UpdateMessageArgs) => Promise<void>;
  };
  reactions: {
    add: (args: AddReactionArgs) => Promise<void>;
  };
  users: {
    info: (args: { user: string }) => Promise<{
      user?: {
        name?: string;
        real_name?: string;
        profile?: { email?: string };
      };
    }>;
  };
}

interface PostMessageArgs {
  channel: string;
  text: string;
  thread_ts?: string;
  blocks?: unknown[];
  attachments?: unknown[];
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}

interface UpdateMessageArgs {
  channel: string;
  ts: string;
  text: string;
  blocks?: unknown[];
}

interface AddReactionArgs {
  channel: string;
  timestamp: string;
  name: string;
}

interface MessageEventArgs {
  message: {
    ts?: string;
    text?: string;
    user?: string;
    channel: string;
    thread_ts?: string;
    team?: string;
  };
  say: (text: string) => Promise<void>;
}

interface AppMentionEventArgs {
  event: {
    ts: string;
    text: string;
    user: string;
    channel: string;
    thread_ts?: string;
    team?: string;
    event_ts: string;
  };
}

/**
 * Slack Service singleton instance
 */
let slackServiceInstance: SlackService | null = null;

/**
 * SlackService class for managing Slack bot operations
 */
export class SlackService extends EventEmitter {
  private app: SlackApp | null = null;
  private client: SlackWebClient | null = null;
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
      // Dynamic import of @slack/bolt to handle optional dependency
      // @ts-expect-error - @slack/bolt is an optional dependency
      const { App, LogLevel } = await import('@slack/bolt');

      this.app = new App({
        token: config.botToken,
        appToken: config.appToken,
        signingSecret: config.signingSecret,
        socketMode: config.socketMode,
        logLevel: LogLevel.INFO,
      }) as unknown as SlackApp;

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

    const config = this.config;

    // Handle direct messages
    this.app.message(async ({ message }) => {
      // Type guard for message with text
      if (!message.text) return;
      if (!message.user) return;

      // Check user permissions
      if (!isUserAllowed(message.user, config)) {
        console.log(`[SlackService] Unauthorized user: ${message.user}`);
        return;
      }

      const incomingMessage: SlackIncomingMessage = {
        id: message.ts || '',
        type: 'message',
        text: message.text,
        userId: message.user,
        channelId: message.channel,
        threadTs: message.thread_ts,
        ts: message.ts || '',
        teamId: message.team || '',
        eventTs: message.ts || '',
      };

      this.status.messagesReceived++;
      this.status.lastEventAt = new Date().toISOString();
      this.emit('message', incomingMessage);
    });

    // Handle @mentions
    this.app.event('app_mention', async ({ event }) => {
      if (!isUserAllowed(event.user, config)) {
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
        blocks: message.blocks,
        attachments: message.attachments,
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
   *
   * @param notification - Notification to format
   * @returns Slack blocks for the notification
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
      const fields: SlackTextObject[] = [];
      if (notification.metadata.projectId) {
        fields.push({
          type: 'mrkdwn',
          text: `*Project:* ${notification.metadata.projectId}`,
        });
      }
      if (notification.metadata.teamId) {
        fields.push({
          type: 'mrkdwn',
          text: `*Team:* ${notification.metadata.teamId}`,
        });
      }
      if (notification.metadata.agentId) {
        fields.push({
          type: 'mrkdwn',
          text: `*Agent:* ${notification.metadata.agentId}`,
        });
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
          text: {
            type: 'mrkdwn',
            text: `Sent at ${new Date(notification.timestamp).toLocaleString()}`,
          },
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
      blocks,
    });
  }

  /**
   * Add a reaction to a message
   *
   * @param channelId - Channel ID
   * @param messageTs - Message timestamp
   * @param emoji - Emoji name (without colons)
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
   * Get or create conversation context for a thread
   *
   * @param threadTs - Thread timestamp
   * @param channelId - Channel ID
   * @param userId - User ID
   * @returns Conversation context
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
   *
   * @returns Current service status
   */
  getStatus(): SlackServiceStatus {
    return { ...this.status };
  }

  /**
   * Check if service is connected
   *
   * @returns True if connected
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
   * Get user info from Slack
   *
   * @param userId - Slack user ID
   * @returns User info object
   */
  async getUserInfo(
    userId: string
  ): Promise<{ name: string; realName: string; email?: string }> {
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
 *
 * @returns SlackService instance
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
