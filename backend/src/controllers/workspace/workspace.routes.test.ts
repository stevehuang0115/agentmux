/**
 * Tests for Google Workspace routes.
 *
 * Validates router creation and route mounting.
 */

// Mock dependencies before import
jest.mock('../../services/user/user-identity.service.js', () => ({
  UserIdentityService: {
    getInstance: () => ({
      getUserById: jest.fn(),
      decryptToken: jest.fn(),
    }),
  },
}));

jest.mock('../../services/core/logger.service.js', () => ({
  LoggerService: {
    getInstance: () => ({
      createComponentLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }),
    }),
  },
}));

import { createWorkspaceRouter } from './workspace.routes.js';

describe('Workspace Routes', () => {
  it('should export a createWorkspaceRouter function', () => {
    expect(typeof createWorkspaceRouter).toBe('function');
  });

  it('should return a router with token and scopes routes', () => {
    const router = createWorkspaceRouter();
    const routes = (router as any).stack
      ?.map((layer: any) => ({
        path: layer.route?.path,
        methods: layer.route?.methods,
      }))
      .filter((r: any) => r.path);

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/token', methods: expect.objectContaining({ get: true }) }),
        expect.objectContaining({ path: '/scopes', methods: expect.objectContaining({ get: true }) }),
      ]),
    );
  });
});
