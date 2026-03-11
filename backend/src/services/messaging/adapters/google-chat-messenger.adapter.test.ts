/**
 * GoogleChatMessengerAdapter Tests
 *
 * Tests for the Google Chat messenger adapter including initialization,
 * message sending, Pub/Sub pull loop, thread tracking, status reporting,
 * and disconnect behaviour.
 *
 * @module google-chat-messenger-adapter.test
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { GoogleChatMessengerAdapter } from './google-chat-messenger.adapter.js';

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

/** Valid service account key for tests */
const VALID_SA_KEY = JSON.stringify({
  client_email: 'bot@project.iam.gserviceaccount.com',
  private_key: '-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n',
});

describe('GoogleChatMessengerAdapter', () => {
  let adapter: GoogleChatMessengerAdapter;

  beforeEach(() => {
    adapter = new GoogleChatMessengerAdapter();
    mockFetch.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should have platform set to google-chat', () => {
    expect(adapter.platform).toBe('google-chat');
  });

  // ===========================================================================
  // initialize
  // ===========================================================================

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

    it('should initialize with valid service account key (service-account mode)', async () => {
      await adapter.initialize({ serviceAccountKey: VALID_SA_KEY });
      expect(adapter.getStatus().connected).toBe(true);
      expect(adapter.getStatus().details?.mode).toBe('service-account');
    });

    it('should initialize in pubsub mode with projectId + subscriptionName + serviceAccountKey', async () => {
      await adapter.initialize({
        serviceAccountKey: VALID_SA_KEY,
        projectId: 'my-project',
        subscriptionName: 'chat-events-sub',
      });
      const status = adapter.getStatus();
      expect(status.connected).toBe(true);
      expect(status.details?.mode).toBe('pubsub');
      expect(status.details?.subscriptionName).toBe('projects/my-project/subscriptions/chat-events-sub');
      expect(status.details?.projectId).toBe('my-project');
      expect(status.details?.pullActive).toBe(true);
      expect(status.details?.pullPaused).toBe(false);
    });

    it('should fall back to service-account mode if projectId is missing', async () => {
      await adapter.initialize({
        serviceAccountKey: VALID_SA_KEY,
        subscriptionName: 'chat-events-sub',
      });
      expect(adapter.getStatus().details?.mode).toBe('service-account');
    });

    it('should fall back to service-account mode if subscriptionName is missing', async () => {
      await adapter.initialize({
        serviceAccountKey: VALID_SA_KEY,
        projectId: 'my-project',
      });
      expect(adapter.getStatus().details?.mode).toBe('service-account');
    });
  });

  // ===========================================================================
  // sendMessage (webhook mode)
  // ===========================================================================

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

  // ===========================================================================
  // sendMessage (service-account / pubsub mode)
  // ===========================================================================

  describe('sendMessage (service-account mode)', () => {
    beforeEach(async () => {
      await adapter.initialize({ serviceAccountKey: VALID_SA_KEY });
      // Mock getAccessToken to skip real JWT signing
      jest.spyOn(adapter, 'getAccessToken').mockResolvedValue('test-token');
      mockFetch.mockReset();
    });

    it('should throw for invalid space name', async () => {
      await expect(adapter.sendMessage('invalid', 'hello')).rejects.toThrow(
        'Invalid Google Chat space name'
      );
    });

    it('should send message via API', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      await adapter.sendMessage('spaces/AAAA', 'hello');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(String(url)).toContain('chat.googleapis.com/v1/spaces/AAAA/messages');
      const body = JSON.parse(options?.body as string);
      expect(body.text).toBe('hello');
    });

    it('should include thread name and messageReplyOption when threadId is provided', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      await adapter.sendMessage('spaces/AAAA', 'reply', { threadId: 'spaces/AAAA/threads/BBB' });

      const [url, options] = mockFetch.mock.calls[0];
      expect(String(url)).toContain('messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD');
      const body = JSON.parse(options?.body as string);
      expect(body.thread.name).toBe('spaces/AAAA/threads/BBB');
    });
  });

  // ===========================================================================
  // sendMessage (not initialized)
  // ===========================================================================

  describe('sendMessage (not initialized)', () => {
    it('should throw when not initialized', async () => {
      await expect(adapter.sendMessage('ch', 'hi')).rejects.toThrow(
        'Google Chat adapter is not initialized'
      );
    });
  });

  // ===========================================================================
  // Pub/Sub pull
  // ===========================================================================

  describe('pullMessages', () => {
    const mockCallback = jest.fn();

    beforeEach(async () => {
      await adapter.initialize({
        serviceAccountKey: VALID_SA_KEY,
        projectId: 'my-project',
        subscriptionName: 'chat-sub',
        onIncomingMessage: mockCallback,
      });
      // Mock getAccessToken to skip real JWT signing with dummy key
      jest.spyOn(adapter, 'getAccessToken').mockResolvedValue('test-token');
      mockCallback.mockReset();
      mockFetch.mockReset();
    });

    it('should pull and process MESSAGE events', async () => {
      const chatEvent = {
        type: 'MESSAGE',
        eventTime: '2026-03-11T10:00:00Z',
        space: { name: 'spaces/AAAA', displayName: 'General' },
        message: {
          name: 'spaces/AAAA/messages/123',
          text: 'Hello from Google Chat',
          thread: { name: 'spaces/AAAA/threads/THREAD1' },
          sender: { name: 'users/12345', displayName: 'Alice' },
          createTime: '2026-03-11T10:00:00Z',
        },
      };

      // Pull response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          receivedMessages: [{
            ackId: 'ack-1',
            message: {
              data: Buffer.from(JSON.stringify(chatEvent)).toString('base64'),
              messageId: 'msg-1',
            },
          }],
        }),
      } as Response);
      // Acknowledge
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);

      await adapter.pullMessages();

      expect(mockCallback).toHaveBeenCalledTimes(1);
      const msg = mockCallback.mock.calls[0][0] as Record<string, unknown>;
      expect(msg.platform).toBe('google-chat');
      expect(msg.conversationId).toBe('spaces/AAAA');
      expect(msg.channelId).toBe('spaces/AAAA');
      expect(msg.text).toBe('Hello from Google Chat');
      expect(msg.threadId).toBe('spaces/AAAA/threads/THREAD1');
      expect(msg.userId).toBe('Alice');
    });

    it('should skip non-MESSAGE events but still acknowledge them', async () => {
      const addedToSpaceEvent = {
        type: 'ADDED_TO_SPACE',
        space: { name: 'spaces/AAAA' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          receivedMessages: [{
            ackId: 'ack-2',
            message: {
              data: Buffer.from(JSON.stringify(addedToSpaceEvent)).toString('base64'),
            },
          }],
        }),
      } as Response);
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);

      await adapter.pullMessages();

      // Callback should NOT be invoked for ADDED_TO_SPACE
      expect(mockCallback).not.toHaveBeenCalled();

      // Acknowledge should still be called
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [ackUrl, ackOptions] = mockFetch.mock.calls[1];
      expect(String(ackUrl)).toContain(':acknowledge');
      const ackBody = JSON.parse(ackOptions?.body as string);
      expect(ackBody.ackIds).toEqual(['ack-2']);
    });

    it('should handle empty pull response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await adapter.pullMessages();

      expect(mockCallback).not.toHaveBeenCalled();
      // Only 1 call: pull (no ack needed)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle malformed message data gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          receivedMessages: [{
            ackId: 'ack-bad',
            message: { data: Buffer.from('not-valid-json').toString('base64') },
          }],
        }),
      } as Response);
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);

      // Should not throw
      await adapter.pullMessages();
      expect(mockCallback).not.toHaveBeenCalled();
      // Should still acknowledge
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw when pull API returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Permission denied',
      } as Response);

      await expect(adapter.pullMessages()).rejects.toThrow(
        'Pub/Sub pull failed (403): Permission denied'
      );
    });
  });

  // ===========================================================================
  // Pull loop pause/resume on consecutive failures
  // ===========================================================================

  describe('pull loop failure handling', () => {
    it('should pause pull after max consecutive failures', async () => {
      await adapter.initialize({
        serviceAccountKey: VALID_SA_KEY,
        projectId: 'my-project',
        subscriptionName: 'chat-sub',
      });
      // Mock getAccessToken to return a valid token
      jest.spyOn(adapter, 'getAccessToken').mockResolvedValue('test-token');
      mockFetch.mockReset();

      // Each pull will fail with a server error
      for (let i = 0; i < 6; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Server error',
        } as Response);
      }

      // Advance timers to trigger pull intervals
      for (let i = 0; i < 6; i++) {
        jest.advanceTimersByTime(5_000);
        // Allow async pull to complete
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      }

      const status = adapter.getStatus();
      expect(status.details?.pullPaused).toBe(true);
    });
  });

  // ===========================================================================
  // getStatus
  // ===========================================================================

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

    it('should report pubsub mode with subscription details', async () => {
      await adapter.initialize({
        serviceAccountKey: VALID_SA_KEY,
        projectId: 'my-project',
        subscriptionName: 'chat-sub',
      });
      const status = adapter.getStatus();
      expect(status.details?.mode).toBe('pubsub');
      expect(status.details?.subscriptionName).toBe('projects/my-project/subscriptions/chat-sub');
    });
  });

  // ===========================================================================
  // disconnect
  // ===========================================================================

  describe('disconnect', () => {
    it('should clear credentials', async () => {
      await adapter.initialize({
        webhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=xxx',
      });
      expect(adapter.getStatus().connected).toBe(true);

      await adapter.disconnect();
      expect(adapter.getStatus().connected).toBe(false);
    });

    it('should stop the pull loop on disconnect', async () => {
      await adapter.initialize({
        serviceAccountKey: VALID_SA_KEY,
        projectId: 'my-project',
        subscriptionName: 'chat-sub',
      });
      expect(adapter.getStatus().details?.pullActive).toBe(true);

      await adapter.disconnect();
      expect(adapter.getStatus().connected).toBe(false);
      expect(adapter.getStatus().details?.mode).toBe('none');
    });
  });

  // ===========================================================================
  // getAccessToken
  // ===========================================================================

  describe('getAccessToken', () => {
    it('should throw when service account key is not set', async () => {
      await expect(adapter.getAccessToken()).rejects.toThrow(
        'Service account key not configured'
      );
    });
  });
});
