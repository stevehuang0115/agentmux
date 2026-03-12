/**
 * Messenger Routes Tests
 *
 * Tests for the messenger API routes (status, connect, disconnect, send).
 *
 * @module messenger-routes.test
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';

const mockList = jest.fn();
const mockGet = jest.fn();
const mockRegister = jest.fn();

jest.mock('../../services/messaging/messenger-registry.service.js', () => ({
  MessengerRegistryService: {
    getInstance: jest.fn(() => ({
      list: mockList,
      get: mockGet,
      register: mockRegister,
    })),
  },
}));

jest.mock('../../services/messaging/adapters/slack-messenger.adapter.js', () => ({
  SlackMessengerAdapter: jest.fn(),
}));

jest.mock('../../services/messaging/adapters/telegram-messenger.adapter.js', () => ({
  TelegramMessengerAdapter: jest.fn(),
}));

jest.mock('../../services/messaging/adapters/discord-messenger.adapter.js', () => ({
  DiscordMessengerAdapter: jest.fn(),
}));

jest.mock('../../services/messaging/adapters/google-chat-messenger.adapter.js', () => ({
  GoogleChatMessengerAdapter: jest.fn(),
}));

jest.mock('../../services/messaging/google-chat-initializer.js', () => ({
  createIncomingCallback: jest.fn(() => jest.fn()),
}));

const mockAddDirectMessage = jest.fn().mockResolvedValue({} as never);
jest.mock('../../services/chat/chat.service.js', () => ({
  getChatService: jest.fn(() => ({
    addDirectMessage: mockAddDirectMessage,
  })),
}));

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined as never),
    writeFile: jest.fn().mockResolvedValue(undefined as never),
    rm: jest.fn().mockResolvedValue(undefined as never),
  },
}));

import { createMessengerRouter } from './messenger.routes.js';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    params: {},
    body: {},
    query: {},
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res) as any;
  res.json = jest.fn().mockReturnValue(res) as any;
  return res as Response;
}

describe('Messenger Routes', () => {
  let router: ReturnType<typeof createMessengerRouter>;

  beforeEach(() => {
    jest.clearAllMocks();
    router = createMessengerRouter();
  });

  it('should export a createMessengerRouter function', () => {
    expect(typeof createMessengerRouter).toBe('function');
  });

  it('should return a router with expected routes', () => {
    // Router should have route layers
    const routes = (router as any).stack
      ?.map((layer: any) => ({
        path: layer.route?.path,
        methods: layer.route?.methods,
      }))
      .filter((r: any) => r.path);

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/status' }),
        expect.objectContaining({ path: '/:platform/connect' }),
        expect.objectContaining({ path: '/:platform/disconnect' }),
        expect.objectContaining({ path: '/google-chat/status' }),
        expect.objectContaining({ path: '/google-chat/test-send' }),
        expect.objectContaining({ path: '/google-chat/send' }),
        expect.objectContaining({ path: '/google-chat/pull' }),
        expect.objectContaining({ path: '/:platform/send' }),
      ])
    );
  });

  describe('GET /google-chat/status', () => {
    it('should return adapter status details', () => {
      const mockAdapter = {
        getStatus: jest.fn().mockReturnValue({
          connected: true,
          platform: 'google-chat',
          details: { mode: 'pubsub', pullActive: true, lastPullAt: null },
        }),
      };
      mockGet.mockReturnValue(mockAdapter);

      // Find the status route handler
      const layer = (router as any).stack.find(
        (l: any) => l.route?.path === '/google-chat/status' && l.route?.methods?.get,
      );
      expect(layer).toBeDefined();

      const res = mockRes();
      layer.route.stack[0].handle(mockReq(), res, jest.fn());

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { mode: 'pubsub', pullActive: true, lastPullAt: null },
      });
    });

    it('should return 404 when adapter not found', () => {
      mockGet.mockReturnValue(undefined);

      const layer = (router as any).stack.find(
        (l: any) => l.route?.path === '/google-chat/status' && l.route?.methods?.get,
      );

      const res = mockRes();
      layer.route.stack[0].handle(mockReq(), res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('POST /google-chat/test-send', () => {
    it('should send test message successfully', async () => {
      const mockAdapter = {
        getStatus: jest.fn().mockReturnValue({
          connected: true,
          platform: 'google-chat',
          details: { mode: 'pubsub' },
        }),
        sendMessage: jest.fn<any>().mockResolvedValue(undefined),
      };
      mockGet.mockReturnValue(mockAdapter);

      const layer = (router as any).stack.find(
        (l: any) => l.route?.path === '/google-chat/test-send' && l.route?.methods?.post,
      );
      expect(layer).toBeDefined();

      const res = mockRes();
      await layer.route.stack[0].handle(
        mockReq({ body: { space: 'spaces/AAAA', text: 'hello' } }),
        res,
        jest.fn(),
      );

      expect(mockAdapter.sendMessage).toHaveBeenCalledWith('spaces/AAAA', 'hello');
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Test message sent' });
    });

    it('should return 400 when space is missing', async () => {
      const mockAdapter = {
        getStatus: jest.fn().mockReturnValue({
          connected: true,
          platform: 'google-chat',
          details: { mode: 'pubsub' },
        }),
      };
      mockGet.mockReturnValue(mockAdapter);

      const layer = (router as any).stack.find(
        (l: any) => l.route?.path === '/google-chat/test-send' && l.route?.methods?.post,
      );

      const res = mockRes();
      await layer.route.stack[0].handle(mockReq({ body: {} }), res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('space is required') }),
      );
    });

    it('should return 400 in webhook mode', async () => {
      const mockAdapter = {
        getStatus: jest.fn().mockReturnValue({
          connected: true,
          platform: 'google-chat',
          details: { mode: 'webhook' },
        }),
      };
      mockGet.mockReturnValue(mockAdapter);

      const layer = (router as any).stack.find(
        (l: any) => l.route?.path === '/google-chat/test-send' && l.route?.methods?.post,
      );

      const res = mockRes();
      await layer.route.stack[0].handle(
        mockReq({ body: { space: 'spaces/AAAA' } }),
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when adapter not found', async () => {
      mockGet.mockReturnValue(undefined);

      const layer = (router as any).stack.find(
        (l: any) => l.route?.path === '/google-chat/test-send' && l.route?.methods?.post,
      );

      const res = mockRes();
      await layer.route.stack[0].handle(mockReq(), res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('POST /google-chat/send', () => {
    it('should signal via chatService.addDirectMessage with threadName', async () => {
      const mockAdapter = {
        getStatus: jest.fn().mockReturnValue({
          connected: true,
          platform: 'google-chat',
          details: { mode: 'pubsub' },
        }),
      };
      mockGet.mockReturnValue(mockAdapter);
      mockAddDirectMessage.mockClear();

      const layer = (router as any).stack.find(
        (l: any) => l.route?.path === '/google-chat/send' && l.route?.methods?.post,
      );
      expect(layer).toBeDefined();

      const res = mockRes();
      await layer.route.stack[0].handle(
        mockReq({ body: { space: 'spaces/AAAA', text: 'hello', threadName: 'spaces/AAAA/threads/BBB' } }),
        res,
        jest.fn(),
      );

      // Should NOT call adapter.sendMessage directly (avoids duplicate delivery)
      // Instead signals via ChatMessage so waitForResponse resolves → googleChatResolve sends
      expect(mockAddDirectMessage).toHaveBeenCalledWith(
        'spaces/AAAA thread=spaces/AAAA/threads/BBB',
        'hello',
        { type: 'orchestrator', name: 'Orchestrator' },
        expect.objectContaining({ source: 'reply-gchat', space: 'spaces/AAAA' }),
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should signal via chatService.addDirectMessage without threadName', async () => {
      const mockAdapter = {
        getStatus: jest.fn().mockReturnValue({
          connected: true,
          platform: 'google-chat',
          details: { mode: 'pubsub' },
        }),
      };
      mockGet.mockReturnValue(mockAdapter);
      mockAddDirectMessage.mockClear();

      const layer = (router as any).stack.find(
        (l: any) => l.route?.path === '/google-chat/send' && l.route?.methods?.post,
      );

      const res = mockRes();
      await layer.route.stack[0].handle(
        mockReq({ body: { space: 'spaces/AAAA', text: 'hello' } }),
        res,
        jest.fn(),
      );

      // conversationId should be just the space when no thread
      expect(mockAddDirectMessage).toHaveBeenCalledWith(
        'spaces/AAAA',
        'hello',
        { type: 'orchestrator', name: 'Orchestrator' },
        expect.objectContaining({ source: 'reply-gchat', space: 'spaces/AAAA' }),
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should return 400 when space is missing', async () => {
      const mockAdapter = {
        getStatus: jest.fn().mockReturnValue({
          connected: true,
          platform: 'google-chat',
          details: { mode: 'pubsub' },
        }),
      };
      mockGet.mockReturnValue(mockAdapter);

      const layer = (router as any).stack.find(
        (l: any) => l.route?.path === '/google-chat/send' && l.route?.methods?.post,
      );

      const res = mockRes();
      await layer.route.stack[0].handle(
        mockReq({ body: { text: 'hello' } }),
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'space is required' }));
    });

    it('should return 400 when text is missing', async () => {
      const mockAdapter = {
        getStatus: jest.fn().mockReturnValue({
          connected: true,
          platform: 'google-chat',
          details: { mode: 'pubsub' },
        }),
      };
      mockGet.mockReturnValue(mockAdapter);

      const layer = (router as any).stack.find(
        (l: any) => l.route?.path === '/google-chat/send' && l.route?.methods?.post,
      );

      const res = mockRes();
      await layer.route.stack[0].handle(
        mockReq({ body: { space: 'spaces/AAAA' } }),
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'text is required' }));
    });

    it('should return 400 when not connected', async () => {
      const mockAdapter = {
        getStatus: jest.fn().mockReturnValue({
          connected: false,
          platform: 'google-chat',
        }),
      };
      mockGet.mockReturnValue(mockAdapter);

      const layer = (router as any).stack.find(
        (l: any) => l.route?.path === '/google-chat/send' && l.route?.methods?.post,
      );

      const res = mockRes();
      await layer.route.stack[0].handle(
        mockReq({ body: { space: 'spaces/AAAA', text: 'hello' } }),
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when adapter not found', async () => {
      mockGet.mockReturnValue(undefined);

      const layer = (router as any).stack.find(
        (l: any) => l.route?.path === '/google-chat/send' && l.route?.methods?.post,
      );

      const res = mockRes();
      await layer.route.stack[0].handle(mockReq(), res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('POST /google-chat/pull', () => {
    it('should return messagesReceived on success', async () => {
      const mockAdapter = {
        getStatus: jest.fn().mockReturnValue({
          connected: true,
          platform: 'google-chat',
          details: { mode: 'pubsub' },
        }),
        pullMessages: jest.fn<any>().mockResolvedValue(3),
      };
      mockGet.mockReturnValue(mockAdapter);

      const layer = (router as any).stack.find(
        (l: any) => l.route?.path === '/google-chat/pull' && l.route?.methods?.post,
      );
      expect(layer).toBeDefined();

      const res = mockRes();
      const next = jest.fn();
      await layer.route.stack[0].handle(mockReq(), res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, messagesReceived: 3 });
    });

    it('should return error when not in pubsub mode', async () => {
      const mockAdapter = {
        getStatus: jest.fn().mockReturnValue({
          connected: true,
          platform: 'google-chat',
          details: { mode: 'webhook' },
        }),
      };
      mockGet.mockReturnValue(mockAdapter);

      const layer = (router as any).stack.find(
        (l: any) => l.route?.path === '/google-chat/pull' && l.route?.methods?.post,
      );

      const res = mockRes();
      await layer.route.stack[0].handle(mockReq(), res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Not in Pub/Sub mode' }),
      );
    });

    it('should return 404 when adapter not found', async () => {
      mockGet.mockReturnValue(undefined);

      const layer = (router as any).stack.find(
        (l: any) => l.route?.path === '/google-chat/pull' && l.route?.methods?.post,
      );

      const res = mockRes();
      await layer.route.stack[0].handle(mockReq(), res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
