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
} from '../../types/slack.types.js';
import { isUserAllowed } from '../../types/slack.types.js';
import { SLACK_IMAGE_CONSTANTS } from '../../constants.js';

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
  files: {
    uploadV2: (args: UploadFileArgs) => Promise<{ files?: Array<{ id: string }> }>;
  };
}

/**
 * Arguments for files.uploadV2 API call
 */
interface UploadFileArgs {
  channel_id: string;
  file: Buffer | NodeJS.ReadableStream;
  filename: string;
  title?: string;
  initial_comment?: string;
  thread_ts?: string;
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
    files?: Array<{
      id: string;
      name: string;
      mimetype: string;
      filetype: string;
      size: number;
      url_private: string;
      url_private_download: string;
      thumb_360?: string;
      original_w?: number;
      original_h?: number;
      permalink: string;
    }>;
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
      // Dynamic import of @slack/bolt
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
      // Allow messages with text or images (or both)
      if (!message.text && (!message.files || message.files.length === 0)) return;
      if (!message.user) return;

      // Check user permissions
      if (!isUserAllowed(message.user, config)) {
        console.log(`[SlackService] Unauthorized user: ${message.user}`);
        return;
      }

      // Extract image files from the event payload
      const imageFiles = (message.files || []).filter(f => f.mimetype?.startsWith('image/'));

      const incomingMessage: SlackIncomingMessage = {
        id: message.ts || '',
        type: 'message',
        text: message.text || '',
        userId: message.user,
        channelId: message.channel,
        threadTs: message.thread_ts,
        ts: message.ts || '',
        teamId: message.team || '',
        eventTs: message.ts || '',
        files: imageFiles.length > 0 ? imageFiles : undefined,
        hasImages: imageFiles.length > 0,
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
    const targetChannelId = notification.channelId || this.config?.defaultChannelId;
    if (!targetChannelId) {
      console.warn('[SlackService] No channel configured for notification');
      return;
    }

    const blocks = this.formatNotificationBlocks(notification);

    await this.sendMessage({
      channelId: targetChannelId,
      text: `${notification.title}: ${notification.message}`,
      blocks,
      threadTs: notification.threadTs,
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

    // Context block elements are text objects where `text` is a plain string.
    // Using type assertion because SlackElement.text is typed as SlackTextObject
    // but Slack API context elements use text objects directly as elements.
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Sent at ${new Date(notification.timestamp).toLocaleString()}`,
        } as unknown as import('../../types/slack.types.js').SlackElement,
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
    const conversationId = `slack-${channelId}-${threadTs}`.replace(/[^A-Za-z0-9_-]/g, '-');
    let context = this.conversationContexts.get(key);

    if (!context) {
      context = {
        threadTs,
        channelId,
        userId,
        conversationId,
        startedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        messageCount: 0,
      };
      this.conversationContexts.set(key, context);
    } else if (context.conversationId !== conversationId) {
      context.conversationId = conversationId;
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
   * Get the bot token used to initialize the Slack client.
   * Required for downloading private files from Slack.
   *
   * @returns The bot token string, or null if not initialized
   */
  getBotToken(): string | null {
    return this.config?.botToken || null;
  }

  /**
   * Upload an image file to a Slack channel.
   *
   * Reads the file from the local filesystem and uploads it
   * using the Slack files.uploadV2 API.
   *
   * @param options - Upload configuration
   * @returns Object with the uploaded file ID
   * @throws Error if the client is not initialized or upload fails
   */
  async uploadImage(options: {
    channelId: string;
    filePath: string;
    filename?: string;
    title?: string;
    initialComment?: string;
    threadTs?: string;
  }): Promise<{ fileId?: string }> {
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }

    const { createReadStream } = await import('fs');
    const { basename } = await import('path');

    const filename = options.filename || basename(options.filePath);
    const maxRetries = SLACK_IMAGE_CONSTANTS.UPLOAD_MAX_RETRIES;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const fileStream = createReadStream(options.filePath);

      try {
        const result = await this.client.files.uploadV2({
          channel_id: options.channelId,
          file: fileStream,
          filename,
          title: options.title,
          initial_comment: options.initialComment,
          thread_ts: options.threadTs,
        });

        this.status.messagesSent++;
        return { fileId: result.files?.[0]?.id };
      } catch (error: unknown) {
        // Handle Slack 429 rate limit with retry-after backoff
        const isRateLimit = this.isRateLimitError(error);
        if (isRateLimit && attempt < maxRetries) {
          const retryAfterMs = this.extractRetryAfterMs(error) || SLACK_IMAGE_CONSTANTS.UPLOAD_DEFAULT_BACKOFF_MS;
          console.warn(`[SlackService] Upload rate-limited (429), retrying in ${retryAfterMs}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, retryAfterMs));
          continue;
        }

        console.error('[SlackService] Upload image error:', error);
        throw error;
      }
    }

    // Should not reach here, but satisfy TypeScript
    throw new Error('Upload failed after maximum retries');
  }

  /**
   * Check if an error is a Slack 429 rate limit error.
   *
   * @param error - The caught error
   * @returns True if the error represents a 429 rate limit response
   */
  private isRateLimitError(error: unknown): boolean {
    if (error && typeof error === 'object') {
      const err = error as Record<string, unknown>;
      // @slack/web-api throws errors with code 'slack_webapi_rate_limited_error'
      if (err.code === 'slack_webapi_rate_limited_error') return true;
      // Also check for status 429 in case of raw HTTP errors
      if (err.statusCode === 429 || err.status === 429) return true;
    }
    return false;
  }

  /**
   * Extract the retry-after delay from a Slack rate limit error.
   *
   * @param error - The caught error
   * @returns Retry delay in milliseconds, or null if not found
   */
  private extractRetryAfterMs(error: unknown): number | null {
    if (error && typeof error === 'object') {
      const err = error as Record<string, unknown>;
      // @slack/web-api attaches retryAfter (seconds) to the error
      if (typeof err.retryAfter === 'number') {
        return err.retryAfter * 1000;
      }
      // Check headers in case of raw response
      const headers = err.headers as Record<string, string> | undefined;
      if (headers?.['retry-after']) {
        const seconds = parseInt(headers['retry-after'], 10);
        if (!isNaN(seconds)) return seconds * 1000;
      }
    }
    return null;
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
