import { getSlackService } from '../../slack/slack.service.js';
import { MessengerAdapter, MessengerPlatform, SendOptions } from '../messenger-adapter.interface.js';

export class SlackMessengerAdapter implements MessengerAdapter {
  readonly platform: MessengerPlatform = 'slack';

  async initialize(_config: Record<string, unknown>): Promise<void> {
    // Slack is initialized by existing SlackService bootstrap path.
  }

  async sendMessage(channel: string, text: string, options?: SendOptions): Promise<void> {
    const slack = getSlackService();
    if (!slack.isConnected()) {
      throw new Error('Slack is not connected');
    }
    await slack.sendMessage({ channelId: channel, text, threadTs: options?.threadId });
  }

  getStatus(): { connected: boolean; platform: MessengerPlatform; details?: Record<string, unknown> } {
    const slack = getSlackService();
    return {
      connected: slack.isConnected(),
      platform: this.platform,
      details: slack.getStatus() as unknown as Record<string, unknown>,
    };
  }

  async disconnect(): Promise<void> {
    const slack = getSlackService();
    await slack.disconnect();
  }
}
