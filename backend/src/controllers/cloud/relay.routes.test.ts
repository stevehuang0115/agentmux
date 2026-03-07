/**
 * Tests for Relay Routes
 *
 * @module controllers/cloud/relay.routes.test
 */

import { Router } from 'express';
import { createRelayRouter } from './relay.routes.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('./relay.controller.js', () => ({
  registerRelayNode: jest.fn((_req, res) => res.status(200).json({ success: true })),
  getRelayStatus: jest.fn((_req, res) => res.status(200).json({ success: true })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RouteEntry {
  method: string;
  path: string;
}

/** Extract registered routes from an Express Router for assertions. */
function getRegisteredRoutes(router: Router): RouteEntry[] {
  const routes: RouteEntry[] = [];
  const stack = (router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack;

  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods);
      for (const method of methods) {
        routes.push({ method: method.toUpperCase(), path: layer.route.path });
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

  it('should register POST /register route', () => {
    expect(routes).toContainEqual({ method: 'POST', path: '/register' });
  });

  it('should register GET /status route', () => {
    expect(routes).toContainEqual({ method: 'GET', path: '/status' });
  });

  it('should register exactly 2 routes', () => {
    expect(routes).toHaveLength(2);
  });
});
