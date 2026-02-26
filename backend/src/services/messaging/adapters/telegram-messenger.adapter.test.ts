/**
 * TelegramMessengerAdapter Tests
 *
 * Tests for the Telegram messenger adapter including initialization,
 * message sending, status reporting, and disconnect behaviour.
 *
 * @module telegram-messenger-adapter.test
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TelegramMessengerAdapter } from './telegram-messenger.adapter.js';

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('TelegramMessengerAdapter', () => {
  let adapter: TelegramMessengerAdapter;

  beforeEach(() => {
    adapter = new TelegramMessengerAdapter();
    mockFetch.mockReset();
  });

  it('should have platform set to telegram', () => {
    expect(adapter.platform).toBe('telegram');
  });

  describe('initialize', () => {
    it('should throw when token is missing', async () => {
      await expect(adapter.initialize({})).rejects.toThrow('Telegram token is required');
    });

    it('should throw when API response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 } as Response);
      await expect(adapter.initialize({ token: 'bad' })).rejects.toThrow('Telegram validation failed (401)');
    });

    it('should throw when API returns ok=false in body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, description: 'Bot token invalid' }),
      } as unknown as Response);
      await expect(adapter.initialize({ token: 'bad' })).rejects.toThrow('Bot token invalid');
    });

    it('should initialize successfully with valid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, result: { id: 123 } }),
      } as unknown as Response);
      await adapter.initialize({ token: 'good-token' });
      expect(adapter.getStatus().connected).toBe(true);
    });
  });

  describe('sendMessage', () => {
    it('should throw when not initialized', async () => {
      await expect(adapter.sendMessage('123', 'hi')).rejects.toThrow(
        'Telegram adapter is not initialized'
      );
    });

    it('should send message when initialized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as unknown as Response);
      await adapter.initialize({ token: 'tok' });

      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      await adapter.sendMessage('chat-1', 'hello');

      const sendCall = mockFetch.mock.calls[1];
      expect(sendCall[0]).toContain('/sendMessage');
      const body = JSON.parse(sendCall[1]?.body as string);
      expect(body.chat_id).toBe('chat-1');
      expect(body.text).toBe('hello');
    });

    it('should throw when send fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as unknown as Response);
      await adapter.initialize({ token: 'tok' });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Chat not found',
      } as Response);
      await expect(adapter.sendMessage('bad', 'msg')).rejects.toThrow('Telegram send failed: Chat not found');
    });
  });

  describe('getStatus', () => {
    it('should report not connected before init', () => {
      expect(adapter.getStatus()).toEqual({ connected: false, platform: 'telegram' });
    });
  });

  describe('disconnect', () => {
    it('should clear token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as unknown as Response);
      await adapter.initialize({ token: 'tok' });
      await adapter.disconnect();
      expect(adapter.getStatus().connected).toBe(false);
    });
  });
});
