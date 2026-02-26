export type MessengerPlatform = 'slack' | 'telegram' | 'discord';

export interface IncomingMessage {
  platform: MessengerPlatform;
  conversationId: string;
  channelId: string;
  userId?: string;
  text: string;
  threadTs?: string;
  timestamp: string;
}

export interface SendOptions {
  threadTs?: string;
}

export interface MessengerAdapter {
  readonly platform: MessengerPlatform;
  initialize(config: Record<string, unknown>): Promise<void>;
  sendMessage(channel: string, text: string, options?: SendOptions): Promise<void>;
  getStatus(): { connected: boolean; platform: MessengerPlatform; details?: Record<string, unknown> };
  disconnect(): Promise<void>;
}
