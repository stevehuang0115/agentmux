/**
 * Tests for Relay Routes
 *
 * Validates that all relay endpoints are registered on the router,
 * and that client-side endpoints include Supabase auth middleware.
 *
 * @module controllers/cloud/relay.routes.test
 */

import { Router } from 'express';
import { createRelayRouter } from './relay.routes.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('./relay.controller.js', () => ({
  registerRelayNode: jest.fn((_req: unknown, res: { status: (s: number) => { json: (d: unknown) => void } }) => res.status(200).json({ success: true })),
  getRelayStatus: jest.fn((_req: unknown, res: { status: (s: number) => { json: (d: unknown) => void } }) => res.status(200).json({ success: true })),
  connectToRelay: jest.fn((_req: unknown, res: { status: (s: number) => { json: (d: unknown) => void } }) => res.status(200).json({ success: true })),
  disconnectFromRelay: jest.fn((_req: unknown, res: { status: (s: number) => { json: (d: unknown) => void } }) => res.status(200).json({ success: true })),
  getRelayDevices: jest.fn((_req: unknown, res: { status: (s: number) => { json: (d: unknown) => void } }) => res.status(200).json({ success: true })),
  sendRelayMessage: jest.fn((_req: unknown, res: { status: (s: number) => { json: (d: unknown) => void } }) => res.status(200).json({ success: true })),
}));

const mockPlanMiddleware = jest.fn((_req: unknown, _res: unknown, next: () => void) => next());

jest.mock('../../services/cloud/auth/supabase-auth.middleware.js', () => ({
  requireSupabaseAuth: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  requireSupabasePlan: jest.fn(() => mockPlanMiddleware),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RouteEntry {
  method: string;
  path: string;
  middlewareCount: number;
}

/** Extract registered routes from an Express Router for assertions. */
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

describe('Relay Routes', () => {
  let router: Router;
  let routes: RouteEntry[];

  beforeAll(() => {
    router = createRelayRouter();
    routes = getRegisteredRoutes(router);
  });

  // Server-side routes (public — no middleware)
  it('should register POST /register route without auth middleware', () => {
    const route = routes.find(r => r.method === 'POST' && r.path === '/register');
    expect(route).toBeDefined();
    expect(route!.middlewareCount).toBe(1); // Only the handler, no auth middleware
  });

  it('should register GET /status route without auth middleware', () => {
    const route = routes.find(r => r.method === 'GET' && r.path === '/status');
    expect(route).toBeDefined();
    expect(route!.middlewareCount).toBe(1); // Only the handler
  });

  // Client-side routes (with Supabase auth + plan middleware)
  it('should register POST /connect with auth middleware', () => {
    const route = routes.find(r => r.method === 'POST' && r.path === '/connect');
    expect(route).toBeDefined();
    expect(route!.middlewareCount).toBe(3); // requireSupabaseAuth + requireSupabasePlan + handler
  });

  it('should register POST /disconnect with auth middleware', () => {
    const route = routes.find(r => r.method === 'POST' && r.path === '/disconnect');
    expect(route).toBeDefined();
    expect(route!.middlewareCount).toBe(3);
  });

  it('should register GET /devices with auth middleware', () => {
    const route = routes.find(r => r.method === 'GET' && r.path === '/devices');
    expect(route).toBeDefined();
    expect(route!.middlewareCount).toBe(3);
  });

  it('should register POST /send with auth middleware', () => {
    const route = routes.find(r => r.method === 'POST' && r.path === '/send');
    expect(route).toBeDefined();
    expect(route!.middlewareCount).toBe(3);
  });

  it('should register exactly 6 routes', () => {
    expect(routes).toHaveLength(6);
  });

  it('should call requireSupabasePlan with "pro" for client-side routes', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requireSupabasePlan } = jest.requireMock('../../services/cloud/auth/supabase-auth.middleware.js');
    expect(requireSupabasePlan).toHaveBeenCalledWith('pro');
  });
});
