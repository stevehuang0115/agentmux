/**
 * MessengerAdapter Interface Tests
 *
 * Tests that the exported types and type literals are correct.
 *
 * @module messenger-adapter-interface.test
 */

import { describe, it, expect } from '@jest/globals';
import type { MessengerPlatform, IncomingMessage, SendOptions, MessengerAdapter } from './messenger-adapter.interface.js';

describe('MessengerAdapter interface types', () => {
  it('should accept valid MessengerPlatform values', () => {
    const platforms: MessengerPlatform[] = ['slack', 'telegram', 'discord'];
    expect(platforms).toHaveLength(3);
  });

  it('should allow constructing a valid IncomingMessage', () => {
    const msg: IncomingMessage = {
      platform: 'slack',
      conversationId: 'conv-1',
      channelId: 'C123',
      text: 'hello',
      timestamp: new Date().toISOString(),
    };
    expect(msg.platform).toBe('slack');
    expect(msg.userId).toBeUndefined();
    expect(msg.threadTs).toBeUndefined();
  });

  it('should allow constructing SendOptions with threadTs', () => {
    const opts: SendOptions = { threadTs: '123.456' };
    expect(opts.threadTs).toBe('123.456');
  });

  it('should allow empty SendOptions', () => {
    const opts: SendOptions = {};
    expect(opts.threadTs).toBeUndefined();
  });

  it('should allow implementing MessengerAdapter shape', () => {
    const adapter: MessengerAdapter = {
      platform: 'discord',
      initialize: async () => {},
      sendMessage: async () => {},
      getStatus: () => ({ connected: false, platform: 'discord' }),
      disconnect: async () => {},
    };
    expect(adapter.platform).toBe('discord');
    expect(adapter.getStatus().connected).toBe(false);
  });
});
