/**
 * OAuth Routes Tests
 *
 * Tests for the OAuth API routes (Google start and callback).
 *
 * @module oauth-routes.test
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockCreateOrUpdateUser = jest.fn();
const mockConnectService = jest.fn();

jest.mock('../../services/user/user-identity.service.js', () => ({
  UserIdentityService: {
    getInstance: jest.fn(() => ({
      createOrUpdateUser: mockCreateOrUpdateUser,
      connectService: mockConnectService,
    })),
  },
}));

jest.mock('../../services/core/logger.service.js', () => ({
  LoggerService: {
    getInstance: jest.fn(() => ({
      createComponentLogger: jest.fn(() => ({
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      })),
    })),
  },
}));

import { createOAuthRouter } from './oauth.routes.js';

describe('OAuth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should export a createOAuthRouter function', () => {
    expect(typeof createOAuthRouter).toBe('function');
  });

  it('should return a router with google/start and google/callback routes', () => {
    const router = createOAuthRouter();
    const routes = (router as any).stack
      ?.map((layer: any) => ({
        path: layer.route?.path,
        methods: layer.route?.methods,
      }))
      .filter((r: any) => r.path);

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/google/start' }),
        expect.objectContaining({ path: '/google/callback' }),
      ])
    );
  });
});
