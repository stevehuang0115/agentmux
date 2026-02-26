import { MessengerAdapter, MessengerPlatform } from '../messenger-adapter.interface.js';

/** Timeout for external Telegram API calls (ms). */
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Messenger adapter for Telegram using the Bot API.
 */
export class TelegramMessengerAdapter implements MessengerAdapter {
  readonly platform: MessengerPlatform = 'telegram';
  private token: string | null = null;

  /**
   * Initialize the adapter by validating the bot token against Telegram API.
   *
   * @param config - Must contain a `token` string property
   * @throws Error if token is missing or validation fails
   */
  async initialize(config: Record<string, unknown>): Promise<void> {
    if (typeof config.token !== 'string' || !config.token) {
      throw new Error('Telegram token is required');
    }

    const resp = await fetch(`https://api.telegram.org/bot${config.token}/getMe`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) {
      throw new Error(`Telegram validation failed (${resp.status})`);
    }
    const data = await resp.json() as { ok?: boolean; description?: string };
    if (!data.ok) {
      throw new Error(data.description || 'Telegram validation failed');
    }
    this.token = config.token;
  }

  /**
   * Send a text message to a Telegram chat.
   *
   * @param channel - Telegram chat ID
   * @param text - Message content
   * @throws Error if adapter is not initialized or send fails
   */
  async sendMessage(channel: string, text: string): Promise<void> {
    if (!this.token) {
      throw new Error('Telegram adapter is not initialized');
    }

    const resp = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: channel, text }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!resp.ok) {
      const details = await resp.text();
      throw new Error(`Telegram send failed: ${details}`);
    }
  }

  /** Get the current connection status. */
  getStatus(): { connected: boolean; platform: MessengerPlatform } {
    return {
      connected: Boolean(this.token),
      platform: this.platform,
    };
  }

  /** Disconnect by clearing the stored token. */
  async disconnect(): Promise<void> {
    this.token = null;
  }
}
