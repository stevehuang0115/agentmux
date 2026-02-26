/**
 * User Routes Tests
 *
 * Tests for the user API routes (list, get by id, create/update).
 *
 * @module user-routes.test
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockListUsers = jest.fn();
const mockGetUserById = jest.fn();
const mockCreateOrUpdateUser = jest.fn();

jest.mock('../../services/user/user-identity.service.js', () => ({
  UserIdentityService: {
    getInstance: jest.fn(() => ({
      listUsers: mockListUsers,
      getUserById: mockGetUserById,
      createOrUpdateUser: mockCreateOrUpdateUser,
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

import { createUserRouter } from './user.routes.js';

describe('User Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should export a createUserRouter function', () => {
    expect(typeof createUserRouter).toBe('function');
  });

  it('should return a router with expected routes', () => {
    const router = createUserRouter();
    const routes = (router as any).stack
      ?.map((layer: any) => ({
        path: layer.route?.path,
        methods: layer.route?.methods,
      }))
      .filter((r: any) => r.path);

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/' }),
        expect.objectContaining({ path: '/:id' }),
      ])
    );

    // Verify HTTP methods on root route(s)
    const rootRoutes = routes.filter((r: any) => r.path === '/');
    const rootMethods = rootRoutes.reduce((acc: Record<string, boolean>, r: any) => ({ ...acc, ...r.methods }), {});
    expect(rootMethods.get).toBe(true);
    expect(rootMethods.post).toBe(true);

    const idRoute = routes.find((r: any) => r.path === '/:id');
    expect(idRoute?.methods?.get).toBe(true);
  });
});
