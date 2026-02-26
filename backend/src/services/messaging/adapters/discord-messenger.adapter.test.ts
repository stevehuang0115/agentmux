/**
 * DiscordMessengerAdapter Tests
 *
 * Tests for the Discord messenger adapter including initialization,
 * message sending, status reporting, and disconnect behaviour.
 *
 * @module discord-messenger-adapter.test
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DiscordMessengerAdapter } from './discord-messenger.adapter.js';

// Mock global fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('DiscordMessengerAdapter', () => {
  let adapter: DiscordMessengerAdapter;

  beforeEach(() => {
    adapter = new DiscordMessengerAdapter();
    mockFetch.mockReset();
  });

  it('should have platform set to discord', () => {
    expect(adapter.platform).toBe('discord');
  });

  describe('initialize', () => {
    it('should throw when token is missing', async () => {
      await expect(adapter.initialize({})).rejects.toThrow('Discord token is required');
    });

    it('should throw when token is empty string', async () => {
      await expect(adapter.initialize({ token: '' })).rejects.toThrow('Discord token is required');
    });

    it('should throw when Discord API validation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Unauthorized',
      } as Response);
      await expect(adapter.initialize({ token: 'bad-token' })).rejects.toThrow(
        'Discord validation failed: Unauthorized'
      );
    });

    it('should initialize successfully with valid token', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      await adapter.initialize({ token: 'valid-token' });
      expect(adapter.getStatus().connected).toBe(true);
    });
  });

  describe('sendMessage', () => {
    it('should throw when not initialized', async () => {
      await expect(adapter.sendMessage('channel-1', 'hello')).rejects.toThrow(
        'Discord adapter is not initialized'
      );
    });

    it('should send message when initialized', async () => {
      // Initialize first
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      await adapter.initialize({ token: 'valid-token' });

      // Send message
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      await adapter.sendMessage('channel-1', 'hello');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const sendCall = mockFetch.mock.calls[1];
      expect(sendCall[0]).toContain('channels/channel-1/messages');
    });

    it('should throw when Discord API returns error on send', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      await adapter.initialize({ token: 'valid-token' });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Rate limited',
      } as Response);
      await expect(adapter.sendMessage('ch', 'msg')).rejects.toThrow('Discord send failed: Rate limited');
    });
  });

  describe('getStatus', () => {
    it('should report not connected before initialization', () => {
      const status = adapter.getStatus();
      expect(status).toEqual({ connected: false, platform: 'discord' });
    });

    it('should report connected after initialization', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      await adapter.initialize({ token: 'tok' });
      expect(adapter.getStatus().connected).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should clear token and report not connected', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      await adapter.initialize({ token: 'tok' });
      expect(adapter.getStatus().connected).toBe(true);

      await adapter.disconnect();
      expect(adapter.getStatus().connected).toBe(false);
    });
  });
});
