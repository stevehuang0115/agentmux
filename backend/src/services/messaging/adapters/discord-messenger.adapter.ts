import { MessengerAdapter, MessengerPlatform } from '../messenger-adapter.interface.js';

export class DiscordMessengerAdapter implements MessengerAdapter {
  readonly platform: MessengerPlatform = 'discord';
  private token: string | null = null;

  async initialize(config: Record<string, unknown>): Promise<void> {
    const token = String(config.token || '');
    if (!token) {
      throw new Error('Discord token is required');
    }

    const resp = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${token}` },
    });

    if (!resp.ok) {
      const details = await resp.text();
      throw new Error(`Discord validation failed: ${details}`);
    }
    this.token = token;
  }

  async sendMessage(channel: string, text: string): Promise<void> {
    if (!this.token) {
      throw new Error('Discord adapter is not initialized');
    }

    const resp = await fetch(`https://discord.com/api/v10/channels/${channel}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: text }),
    });

    if (!resp.ok) {
      const details = await resp.text();
      throw new Error(`Discord send failed: ${details}`);
    }
  }

  getStatus() {
    return {
      connected: Boolean(this.token),
      platform: this.platform,
    };
  }

  async disconnect(): Promise<void> {
    this.token = null;
  }
}
