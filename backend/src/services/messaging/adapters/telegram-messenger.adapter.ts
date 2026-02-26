import { MessengerAdapter, MessengerPlatform } from '../messenger-adapter.interface.js';

export class TelegramMessengerAdapter implements MessengerAdapter {
  readonly platform: MessengerPlatform = 'telegram';
  private token: string | null = null;

  async initialize(config: Record<string, unknown>): Promise<void> {
    const token = String(config.token || '');
    if (!token) {
      throw new Error('Telegram token is required');
    }

    const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    if (!resp.ok) {
      throw new Error(`Telegram validation failed (${resp.status})`);
    }
    const data = await resp.json() as { ok?: boolean; description?: string };
    if (!data.ok) {
      throw new Error(data.description || 'Telegram validation failed');
    }
    this.token = token;
  }

  async sendMessage(channel: string, text: string): Promise<void> {
    if (!this.token) {
      throw new Error('Telegram adapter is not initialized');
    }

    const resp = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: channel, text }),
    });

    if (!resp.ok) {
      const details = await resp.text();
      throw new Error(`Telegram send failed: ${details}`);
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
