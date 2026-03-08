/**
 * Tests for Auth Routes
 *
 * Validates that all auth endpoints are registered on the router
 * with the correct HTTP methods and middleware chain.
 *
 * @module controllers/cloud/auth/auth.routes.test
 */

import { Router } from 'express';
import { createAuthRouter } from './auth.routes.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('./auth.controller.js', () => ({
  register: jest.fn((_req, res) => res.status(200).json({ success: true })),
  login: jest.fn((_req, res) => res.status(200).json({ success: true })),
  refresh: jest.fn((_req, res) => res.status(200).json({ success: true })),
  getProfile: jest.fn((_req, res) => res.status(200).json({ success: true })),
  updateProfile: jest.fn((_req, res) => res.status(200).json({ success: true })),
  getLicense: jest.fn((_req, res) => res.status(200).json({ success: true })),
}));

jest.mock('../../../services/cloud/auth/supabase-auth.middleware.js', () => ({
  requireSupabaseAuth: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RouteEntry {
  method: string;
  path: string;
  middlewareCount: number;
}

/** Extract registered routes from an Express Router. */
function getRegisteredRoutes(router: Router): RouteEntry[] {
  const routes: RouteEntry[] = [];
  const stack = (router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: unknown[] } }> }).stack;

  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods);
      for (const method of methods) {
        routes.push({
          method: method.toUpperCase(),
          path: layer.route.path,
          middlewareCount: layer.route.stack.length,
        });
      }
    }
  }

  return routes;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Auth Routes', () => {
  let router: Router;
  let routes: RouteEntry[];

  beforeAll(() => {
    router = createAuthRouter();
    routes = getRegisteredRoutes(router);
  });

  // Public routes (1 handler each)
  it('should register POST /register route', () => {
    expect(routes).toContainEqual(expect.objectContaining({ method: 'POST', path: '/register' }));
  });

  it('should register POST /login route', () => {
    expect(routes).toContainEqual(expect.objectContaining({ method: 'POST', path: '/login' }));
  });

  it('should register POST /refresh route', () => {
    expect(routes).toContainEqual(expect.objectContaining({ method: 'POST', path: '/refresh' }));
  });

  // Protected routes (requireSupabaseAuth middleware + handler = 2 handlers in stack)
  it('should register GET /me route with auth middleware', () => {
    const route = routes.find((r) => r.method === 'GET' && r.path === '/me');
    expect(route).toBeDefined();
    expect(route!.middlewareCount).toBe(2); // requireSupabaseAuth + getProfile
  });

  it('should register PUT /me route with auth middleware', () => {
    const route = routes.find((r) => r.method === 'PUT' && r.path === '/me');
    expect(route).toBeDefined();
    expect(route!.middlewareCount).toBe(2); // requireSupabaseAuth + updateProfile
  });

  it('should register GET /license route with auth middleware', () => {
    const route = routes.find((r) => r.method === 'GET' && r.path === '/license');
    expect(route).toBeDefined();
    expect(route!.middlewareCount).toBe(2); // requireSupabaseAuth + getLicense
  });

  it('should register exactly 6 routes', () => {
    expect(routes).toHaveLength(6);
  });
});
