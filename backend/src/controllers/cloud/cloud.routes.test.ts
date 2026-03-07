/**
 * Tests for Cloud Routes
 *
 * @module controllers/cloud/cloud.routes.test
 */

import { Router } from 'express';
import { createCloudRouter } from './cloud.routes.js';

// ---------------------------------------------------------------------------
// Mocks — stub out controller handlers before importing routes
// ---------------------------------------------------------------------------

jest.mock('./cloud.controller.js', () => ({
  connectToCloud: jest.fn((_req, res) => res.status(200).json({ success: true })),
  disconnectFromCloud: jest.fn((_req, res) => res.status(200).json({ success: true })),
  getCloudStatus: jest.fn((_req, res) => res.status(200).json({ success: true })),
  getCloudTemplates: jest.fn((_req, res) => res.status(200).json({ success: true })),
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

  // Express stores routes in router.stack as Layer objects
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

describe('Cloud Routes', () => {
  let router: Router;
  let routes: RouteEntry[];

  beforeAll(() => {
    router = createCloudRouter();
    routes = getRegisteredRoutes(router);
  });

  it('should register POST /connect route', () => {
    expect(routes).toContainEqual({ method: 'POST', path: '/connect' });
  });

  it('should register POST /disconnect route', () => {
    expect(routes).toContainEqual({ method: 'POST', path: '/disconnect' });
  });

  it('should register GET /status route', () => {
    expect(routes).toContainEqual({ method: 'GET', path: '/status' });
  });

  it('should register GET /templates route', () => {
    expect(routes).toContainEqual({ method: 'GET', path: '/templates' });
  });

  it('should register exactly 4 routes', () => {
    expect(routes).toHaveLength(4);
  });
});
