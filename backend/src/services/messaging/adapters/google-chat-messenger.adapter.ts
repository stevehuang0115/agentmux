/**
 * Google Chat Messenger Adapter
 *
 * Messenger adapter for Google Chat supporting three connection modes:
 * 1. **Webhook mode** — post messages via an incoming webhook URL (send-only)
 * 2. **Service account mode** — send messages via the Chat API (send-only)
 * 3. **Pub/Sub mode** — pull incoming messages from a Cloud Pub/Sub subscription
 *    and reply via the Chat API (bidirectional, thread-aware)
 *
 * In Pub/Sub mode, a Google Chat App is configured to publish events to a
 * Pub/Sub topic. Crewly pulls from the subscription, processes MESSAGE events,
 * and replies in the same thread via the Chat API.
 *
 * @module services/messaging/adapters/google-chat-messenger.adapter
 */

import { MessengerAdapter, MessengerPlatform, IncomingMessage } from '../messenger-adapter.interface.js';
import { GOOGLE_CHAT_PUBSUB_CONSTANTS } from '../../../constants.js';

/** Connection mode for the adapter */
type GoogleChatMode = 'webhook' | 'service-account' | 'pubsub' | 'none';

/**
 * Shape of a Google Chat event delivered via Pub/Sub.
 * Only the fields we need are typed; the rest is ignored.
 */
interface ChatEventPayload {
  type?: string;
  eventTime?: string;
  space?: { name?: string; displayName?: string };
  message?: {
    name?: string;
    text?: string;
    thread?: { name?: string };
    sender?: { name?: string; displayName?: string };
    createTime?: string;
  };
}

/**
 * Shape of a single received Pub/Sub message from the pull response.
 */
interface PubSubReceivedMessage {
  ackId: string;
  message: {
    data?: string;
    messageId?: string;
    publishTime?: string;
    attributes?: Record<string, string>;
  };
}

/**
 * Callback type for incoming messages from Pub/Sub pull.
 */
export type GoogleChatIncomingCallback = (msg: IncomingMessage) => void;

/**
 * Messenger adapter for Google Chat with Pub/Sub support.
 *
 * Supports webhook, service-account, and pubsub modes.
 * Pub/Sub mode enables bidirectional communication with thread tracking.
 */
export class GoogleChatMessengerAdapter implements MessengerAdapter {
  readonly platform: MessengerPlatform = 'google-chat';

  /** Current connection mode */
  private mode: GoogleChatMode = 'none';

  /** Webhook URL for posting messages (webhook mode) */
  private webhookUrl: string | null = null;

  /** Service account key JSON string */
  private serviceAccountKey: string | null = null;

  /** Access token obtained from service account (cached) */
  private accessToken: string | null = null;

  /** Access token expiry timestamp */
  private tokenExpiresAt = 0;

  /** OAuth2 scopes for the current mode */
  private tokenScopes: string = GOOGLE_CHAT_PUBSUB_CONSTANTS.CHAT_SCOPE;

  /** Full Pub/Sub subscription resource name (e.g. projects/PROJECT/subscriptions/SUB) */
  private subscriptionName: string | null = null;

  /** GCP project ID (for Pub/Sub mode) */
  private projectId: string | null = null;

  /** Pub/Sub pull interval timer */
  private pullIntervalTimer: ReturnType<typeof setInterval> | null = null;

  /** Callback for incoming messages */
  private onIncomingMessage: GoogleChatIncomingCallback | null = null;

  /** Consecutive pull failure count */
  private consecutiveFailures = 0;

  /** Whether the pull loop is paused due to failures */
  private pullPaused = false;

  /**
   * Initialize the adapter with the provided credentials.
   *
   * Detects mode based on provided config fields:
   * - `webhookUrl` → webhook mode
   * - `serviceAccountKey` + `projectId` + `subscriptionName` → pubsub mode
   * - `serviceAccountKey` alone → service-account mode
   *
   * @param config - Configuration object with credentials
   * @throws Error if credentials are invalid or missing
   */
  async initialize(config: Record<string, unknown>): Promise<void> {
    const webhookUrl = config.webhookUrl;
    const serviceAccountKey = config.serviceAccountKey;
    const projectId = config.projectId;
    const subscriptionName = config.subscriptionName;
    const onIncomingMessage = config.onIncomingMessage;

    // Webhook mode
    if (typeof webhookUrl === 'string' && webhookUrl) {
      if (!webhookUrl.startsWith('https://chat.googleapis.com/')) {
        throw new Error('Invalid Google Chat webhook URL. Must start with https://chat.googleapis.com/');
      }
      this.resetState();
      this.webhookUrl = webhookUrl;
      this.mode = 'webhook';
      return;
    }

    // Pub/Sub mode or Service Account mode — both require a service account key
    if (typeof serviceAccountKey === 'string' && serviceAccountKey) {
      this.validateServiceAccountKey(serviceAccountKey);

      this.resetState();
      this.serviceAccountKey = serviceAccountKey;

      // Pub/Sub mode: requires projectId + subscriptionName
      if (typeof projectId === 'string' && projectId &&
          typeof subscriptionName === 'string' && subscriptionName) {
        this.projectId = projectId;
        this.subscriptionName = `projects/${projectId}/subscriptions/${subscriptionName}`;
        this.tokenScopes = `${GOOGLE_CHAT_PUBSUB_CONSTANTS.CHAT_SCOPE} ${GOOGLE_CHAT_PUBSUB_CONSTANTS.PUBSUB_SCOPE}`;
        this.mode = 'pubsub';

        if (typeof onIncomingMessage === 'function') {
          this.onIncomingMessage = onIncomingMessage as GoogleChatIncomingCallback;
        }

        this.startPubSubPull();
        return;
      }

      // Service account mode (send-only)
      this.mode = 'service-account';
      this.tokenScopes = GOOGLE_CHAT_PUBSUB_CONSTANTS.CHAT_SCOPE;
      return;
    }

    throw new Error('Google Chat requires either a webhookUrl or serviceAccountKey');
  }

  /**
   * Send a text message to a Google Chat space.
   *
   * In webhook mode, the `channel` parameter is ignored (webhook URL determines the space).
   * In service-account/pubsub mode, `channel` is the space name (e.g., "spaces/AAAA...").
   *
   * @param channel - Google Chat space name (used in service-account/pubsub mode)
   * @param text - Message content
   * @param options - Optional send options (threadId for threaded replies)
   * @throws Error if adapter is not initialized or send fails
   */
  async sendMessage(channel: string, text: string, options?: { threadId?: string }): Promise<void> {
    if (this.mode === 'webhook' && this.webhookUrl) {
      await this.sendViaWebhook(text, options?.threadId);
      return;
    }

    if ((this.mode === 'service-account' || this.mode === 'pubsub') && this.serviceAccountKey) {
      await this.sendViaApi(channel, text, options?.threadId);
      return;
    }

    throw new Error('Google Chat adapter is not initialized');
  }

  /**
   * Get the current connection status.
   *
   * @returns Status object with connected flag, platform, and mode details
   */
  getStatus(): { connected: boolean; platform: MessengerPlatform; details?: Record<string, unknown> } {
    return {
      connected: this.mode !== 'none',
      platform: this.platform,
      details: {
        mode: this.mode,
        ...(this.mode === 'pubsub' ? {
          subscriptionName: this.subscriptionName,
          projectId: this.projectId,
          pullActive: Boolean(this.pullIntervalTimer) && !this.pullPaused,
          pullPaused: this.pullPaused,
          consecutiveFailures: this.consecutiveFailures,
        } : {}),
      },
    };
  }

  /**
   * Disconnect by clearing stored credentials and stopping the pull loop.
   */
  async disconnect(): Promise<void> {
    this.stopPubSubPull();
    this.resetState();
  }

  // ===========================================================================
  // Pub/Sub Pull Loop
  // ===========================================================================

  /**
   * Start the Pub/Sub pull loop that periodically fetches messages.
   */
  private startPubSubPull(): void {
    this.stopPubSubPull();
    this.consecutiveFailures = 0;
    this.pullPaused = false;

    this.pullIntervalTimer = setInterval(async () => {
      if (this.pullPaused) return;
      try {
        await this.pullMessages();
        this.consecutiveFailures = 0;
      } catch {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= GOOGLE_CHAT_PUBSUB_CONSTANTS.MAX_CONSECUTIVE_FAILURES) {
          this.pullPaused = true;
        }
      }
    }, GOOGLE_CHAT_PUBSUB_CONSTANTS.PULL_INTERVAL_MS);
  }

  /**
   * Stop the Pub/Sub pull loop.
   */
  private stopPubSubPull(): void {
    if (this.pullIntervalTimer) {
      clearInterval(this.pullIntervalTimer);
      this.pullIntervalTimer = null;
    }
  }

  /**
   * Pull messages from the Pub/Sub subscription, process them, and acknowledge.
   *
   * Each message is a base64-encoded Google Chat event JSON. Only MESSAGE-type
   * events are forwarded to the incoming message callback. All messages are
   * acknowledged regardless of type to prevent redelivery.
   */
  async pullMessages(): Promise<void> {
    if (!this.subscriptionName) {
      throw new Error('Pub/Sub subscription not configured');
    }

    const token = await this.getAccessToken();
    const pullUrl = `${GOOGLE_CHAT_PUBSUB_CONSTANTS.PUBSUB_API_BASE}/${this.subscriptionName}:pull`;

    const resp = await fetch(pullUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ maxMessages: GOOGLE_CHAT_PUBSUB_CONSTANTS.MAX_MESSAGES_PER_PULL }),
      signal: AbortSignal.timeout(GOOGLE_CHAT_PUBSUB_CONSTANTS.FETCH_TIMEOUT_MS),
    });

    if (!resp.ok) {
      const details = await resp.text();
      throw new Error(`Pub/Sub pull failed (${resp.status}): ${details}`);
    }

    const data = await resp.json() as { receivedMessages?: PubSubReceivedMessage[] };

    if (!data.receivedMessages || data.receivedMessages.length === 0) {
      return;
    }

    const ackIds: string[] = [];

    for (const received of data.receivedMessages) {
      ackIds.push(received.ackId);

      if (!received.message.data) continue;

      try {
        const decoded = Buffer.from(received.message.data, 'base64').toString('utf-8');
        const event = JSON.parse(decoded) as ChatEventPayload;
        this.processChatEvent(event);
      } catch {
        // Skip malformed messages — they will still be acked
      }
    }

    // Acknowledge all messages (even non-MESSAGE types) to prevent redelivery
    if (ackIds.length > 0) {
      await this.acknowledgeMessages(ackIds);
    }
  }

  /**
   * Process a Google Chat event and forward MESSAGE events to the callback.
   *
   * Thread tracking: extracts the thread name from the event so that replies
   * can be posted back to the same thread.
   *
   * @param event - Parsed Google Chat event payload
   */
  private processChatEvent(event: ChatEventPayload): void {
    // Only process MESSAGE events (ignore ADDED_TO_SPACE, REMOVED_FROM_SPACE, etc.)
    if (event.type !== 'MESSAGE' || !event.message?.text) {
      return;
    }

    if (!this.onIncomingMessage) {
      return;
    }

    const spaceName = event.space?.name || '';
    const threadName = event.message.thread?.name || '';
    const senderName = event.message.sender?.displayName || event.message.sender?.name || '';

    const incomingMessage: IncomingMessage = {
      platform: 'google-chat',
      conversationId: spaceName,
      channelId: spaceName,
      userId: senderName,
      text: event.message.text,
      // Thread name is the full resource path (e.g. spaces/SPACE/threads/THREAD)
      // This is used to reply in the same thread via the Chat API
      threadId: threadName,
      timestamp: event.message.createTime || event.eventTime || new Date().toISOString(),
    };

    this.onIncomingMessage(incomingMessage);
  }

  /**
   * Acknowledge processed messages to prevent redelivery.
   *
   * @param ackIds - Array of ack IDs from the pull response
   */
  private async acknowledgeMessages(ackIds: string[]): Promise<void> {
    if (!this.subscriptionName) return;

    const token = await this.getAccessToken();
    const ackUrl = `${GOOGLE_CHAT_PUBSUB_CONSTANTS.PUBSUB_API_BASE}/${this.subscriptionName}:acknowledge`;

    const resp = await fetch(ackUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ackIds }),
      signal: AbortSignal.timeout(GOOGLE_CHAT_PUBSUB_CONSTANTS.FETCH_TIMEOUT_MS),
    });

    if (!resp.ok) {
      const details = await resp.text();
      throw new Error(`Pub/Sub acknowledge failed (${resp.status}): ${details}`);
    }
  }

  // ===========================================================================
  // Send Methods
  // ===========================================================================

  /**
   * Send a message via incoming webhook URL.
   *
   * @param text - Message text
   * @param threadKey - Optional thread key for threaded replies
   */
  private async sendViaWebhook(text: string, threadKey?: string): Promise<void> {
    if (!this.webhookUrl) {
      throw new Error('Webhook URL not configured');
    }

    const body: Record<string, unknown> = { text };
    if (threadKey) {
      body.thread = { threadKey };
    }

    // Append threadKey as query param if provided (Google Chat webhook threading)
    let url = this.webhookUrl;
    if (threadKey) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`;
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(GOOGLE_CHAT_PUBSUB_CONSTANTS.FETCH_TIMEOUT_MS),
    });

    if (!resp.ok) {
      const details = await resp.text();
      throw new Error(`Google Chat webhook send failed (${resp.status}): ${details}`);
    }
  }

  /**
   * Send a message via the Google Chat REST API using service account credentials.
   *
   * When a threadId (thread name) is provided, the reply is posted to the same
   * thread. This enables conversational thread tracking for Pub/Sub mode.
   *
   * @param space - Space name (e.g., "spaces/AAAA...")
   * @param text - Message text
   * @param threadName - Optional full thread name (e.g., "spaces/SPACE/threads/THREAD")
   */
  private async sendViaApi(space: string, text: string, threadName?: string): Promise<void> {
    if (!this.serviceAccountKey) {
      throw new Error('Service account key not configured');
    }

    if (!space || !space.startsWith('spaces/')) {
      throw new Error('Invalid Google Chat space name. Must start with "spaces/"');
    }

    const token = await this.getAccessToken();

    const body: Record<string, unknown> = { text };
    if (threadName) {
      // Use the full thread resource name for API-based threading
      body.thread = { name: threadName };
    }

    // Build URL with messageReplyOption to enable thread replies
    let url = `${GOOGLE_CHAT_PUBSUB_CONSTANTS.CHAT_API_BASE}/${space}/messages`;
    if (threadName) {
      url += '?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD';
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(GOOGLE_CHAT_PUBSUB_CONSTANTS.FETCH_TIMEOUT_MS),
    });

    if (!resp.ok) {
      const details = await resp.text();
      throw new Error(`Google Chat API send failed (${resp.status}): ${details}`);
    }
  }

  // ===========================================================================
  // Auth
  // ===========================================================================

  /**
   * Get a valid access token, refreshing if needed.
   *
   * Uses a JWT-based OAuth2 flow for service accounts.
   * The scope includes Pub/Sub when in pubsub mode.
   *
   * @returns Valid access token string
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    if (!this.serviceAccountKey) {
      throw new Error('Service account key not configured');
    }

    const key = JSON.parse(this.serviceAccountKey);
    const now = Math.floor(Date.now() / 1000);

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: key.client_email,
      scope: this.tokenScopes,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })).toString('base64url');

    // Sign with private key using Node.js crypto
    const { createSign } = await import('node:crypto');
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${payload}`);
    const signature = signer.sign(key.private_key, 'base64url');

    const jwt = `${header}.${payload}.${signature}`;

    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
      signal: AbortSignal.timeout(GOOGLE_CHAT_PUBSUB_CONSTANTS.FETCH_TIMEOUT_MS),
    });

    if (!resp.ok) {
      const details = await resp.text();
      throw new Error(`Google Chat token exchange failed (${resp.status}): ${details}`);
    }

    const data = await resp.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

    return this.accessToken;
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /**
   * Validate a service account key JSON string.
   *
   * @param key - JSON string of the service account key
   * @throws Error if the key is invalid
   */
  private validateServiceAccountKey(key: string): void {
    try {
      const parsed = JSON.parse(key);
      if (!parsed.client_email || !parsed.private_key) {
        throw new Error('Service account key must contain client_email and private_key');
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error('Service account key must be valid JSON');
      }
      throw err;
    }
  }

  /**
   * Reset all internal state to defaults.
   */
  private resetState(): void {
    this.stopPubSubPull();
    this.webhookUrl = null;
    this.serviceAccountKey = null;
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.tokenScopes = GOOGLE_CHAT_PUBSUB_CONSTANTS.CHAT_SCOPE;
    this.subscriptionName = null;
    this.projectId = null;
    this.onIncomingMessage = null;
    this.consecutiveFailures = 0;
    this.pullPaused = false;
    this.mode = 'none';
  }
}
