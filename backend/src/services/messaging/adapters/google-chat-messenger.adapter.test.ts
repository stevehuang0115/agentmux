/**
 * GoogleChatMessengerAdapter Tests
 *
 * Tests for the Google Chat messenger adapter including initialization,
 * message sending, status reporting, and disconnect behaviour.
 *
 * @module google-chat-messenger-adapter.test
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GoogleChatMessengerAdapter } from './google-chat-messenger.adapter.js';

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('GoogleChatMessengerAdapter', () => {
  let adapter: GoogleChatMessengerAdapter;

  beforeEach(() => {
    adapter = new GoogleChatMessengerAdapter();
    mockFetch.mockReset();
  });

  it('should have platform set to google-chat', () => {
    expect(adapter.platform).toBe('google-chat');
  });

  describe('initialize', () => {
    it('should throw when neither webhookUrl nor serviceAccountKey is provided', async () => {
      await expect(adapter.initialize({})).rejects.toThrow(
        'Google Chat requires either a webhookUrl or serviceAccountKey'
      );
    });

    it('should throw when webhookUrl has invalid domain', async () => {
      await expect(
        adapter.initialize({ webhookUrl: 'https://example.com/webhook' })
      ).rejects.toThrow('Invalid Google Chat webhook URL');
    });

    it('should initialize with valid webhook URL', async () => {
      await adapter.initialize({
        webhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=xxx&token=yyy',
      });
      expect(adapter.getStatus().connected).toBe(true);
      expect(adapter.getStatus().details?.mode).toBe('webhook');
    });

    it('should throw when serviceAccountKey is not valid JSON', async () => {
      await expect(
        adapter.initialize({ serviceAccountKey: 'not-json' })
      ).rejects.toThrow('Service account key must be valid JSON');
    });

    it('should throw when serviceAccountKey is missing required fields', async () => {
      await expect(
        adapter.initialize({ serviceAccountKey: JSON.stringify({ foo: 'bar' }) })
      ).rejects.toThrow('Service account key must contain client_email and private_key');
    });

    it('should initialize with valid service account key', async () => {
      await adapter.initialize({
        serviceAccountKey: JSON.stringify({
          client_email: 'bot@project.iam.gserviceaccount.com',
          private_key: '-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n',
        }),
      });
      expect(adapter.getStatus().connected).toBe(true);
      expect(adapter.getStatus().details?.mode).toBe('service-account');
    });
  });

  describe('sendMessage (webhook mode)', () => {
    beforeEach(async () => {
      await adapter.initialize({
        webhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=xxx',
      });
    });

    it('should send message via webhook', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      await adapter.sendMessage('ignored-in-webhook-mode', 'hello');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('chat.googleapis.com');
      const body = JSON.parse(options?.body as string);
      expect(body.text).toBe('hello');
    });

    it('should throw when webhook send fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      } as Response);

      await expect(adapter.sendMessage('ch', 'msg')).rejects.toThrow(
        'Google Chat webhook send failed (403): Forbidden'
      );
    });

    it('should include thread info when threadId is provided', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      await adapter.sendMessage('ch', 'reply', { threadId: 'thread-123' });

      const [url, options] = mockFetch.mock.calls[0];
      expect(String(url)).toContain('messageReplyOption');
      const body = JSON.parse(options?.body as string);
      expect(body.thread.threadKey).toBe('thread-123');
    });
  });

  describe('sendMessage (not initialized)', () => {
    it('should throw when not initialized', async () => {
      await expect(adapter.sendMessage('ch', 'hi')).rejects.toThrow(
        'Google Chat adapter is not initialized'
      );
    });
  });

  describe('getStatus', () => {
    it('should report not connected before init', () => {
      expect(adapter.getStatus()).toEqual({
        connected: false,
        platform: 'google-chat',
        details: { mode: 'none' },
      });
    });

    it('should report webhook mode after webhook init', async () => {
      await adapter.initialize({
        webhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=xxx',
      });
      expect(adapter.getStatus().details?.mode).toBe('webhook');
    });
  });

  describe('disconnect', () => {
    it('should clear credentials', async () => {
      await adapter.initialize({
        webhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=xxx',
      });
      expect(adapter.getStatus().connected).toBe(true);

      await adapter.disconnect();
      expect(adapter.getStatus().connected).toBe(false);
    });
  });
});
