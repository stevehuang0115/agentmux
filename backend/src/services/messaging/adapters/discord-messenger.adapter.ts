import { MessengerAdapter, MessengerPlatform } from '../messenger-adapter.interface.js';

/** Timeout for external Discord API calls (ms). */
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Messenger adapter for Discord using the Bot API.
 */
export class DiscordMessengerAdapter implements MessengerAdapter {
  readonly platform: MessengerPlatform = 'discord';
  private token: string | null = null;

  /**
   * Initialize the adapter by validating the bot token against Discord API.
   *
   * @param config - Must contain a `token` string property
   * @throws Error if token is missing or validation fails
   */
  async initialize(config: Record<string, unknown>): Promise<void> {
    if (typeof config.token !== 'string' || !config.token) {
      throw new Error('Discord token is required');
    }

    const resp = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${config.token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!resp.ok) {
      const details = await resp.text();
      throw new Error(`Discord validation failed: ${details}`);
    }
    this.token = config.token;
  }

  /**
   * Send a text message to a Discord channel.
   *
   * @param channel - Discord channel ID (numeric string)
   * @param text - Message content
   * @throws Error if adapter is not initialized or send fails
   */
  async sendMessage(channel: string, text: string): Promise<void> {
    if (!this.token) {
      throw new Error('Discord adapter is not initialized');
    }

    if (!/^\d+$/.test(channel)) {
      throw new Error('Invalid Discord channel ID');
    }

    const resp = await fetch(`https://discord.com/api/v10/channels/${channel}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: text }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!resp.ok) {
      const details = await resp.text();
      throw new Error(`Discord send failed: ${details}`);
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
