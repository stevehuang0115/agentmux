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
        expect.objectContaining({ path: '/:platform/send' }),
      ])
    );
  });
});
