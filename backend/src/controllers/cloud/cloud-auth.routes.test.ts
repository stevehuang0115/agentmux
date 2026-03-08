/**
 * Tests for Cloud Auth Routes (Supabase-backed)
 *
 * Verifies that createCloudAuthRouter() registers the correct
 * HTTP methods and paths.
 *
 * @module controllers/cloud/cloud-auth.routes.test
 */

import { createCloudAuthRouter } from './cloud-auth.routes.js';

// Mock the controller handlers so they don't execute during route registration
jest.mock('./cloud-auth.controller.js', () => ({
  cloudRegister: jest.fn(),
  cloudLogin: jest.fn(),
  cloudLogout: jest.fn(),
  cloudGetSession: jest.fn(),
  cloudGetLicense: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RouteLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
  };
}

/**
 * Extract registered routes from an Express router.
 *
 * @param router - Express router instance
 * @returns Array of { method, path } objects
 */
function extractRoutes(router: ReturnType<typeof createCloudAuthRouter>): Array<{ method: string; path: string }> {
  const stack = (router as unknown as { stack: RouteLayer[] }).stack;
  const routes: Array<{ method: string; path: string }> = [];

  for (const layer of stack) {
    if (layer.route) {
      const path = layer.route.path;
      for (const method of Object.keys(layer.route.methods)) {
        if (layer.route.methods[method]) {
          routes.push({ method: method.toUpperCase(), path });
        }
      }
    }
  }

  return routes;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Cloud Auth Routes', () => {
  it('should register POST /register', () => {
    const router = createCloudAuthRouter();
    const routes = extractRoutes(router);

    expect(routes).toContainEqual({ method: 'POST', path: '/register' });
  });

  it('should register POST /login', () => {
    const router = createCloudAuthRouter();
    const routes = extractRoutes(router);

    expect(routes).toContainEqual({ method: 'POST', path: '/login' });
  });

  it('should register POST /logout', () => {
    const router = createCloudAuthRouter();
    const routes = extractRoutes(router);

    expect(routes).toContainEqual({ method: 'POST', path: '/logout' });
  });

  it('should register GET /session', () => {
    const router = createCloudAuthRouter();
    const routes = extractRoutes(router);

    expect(routes).toContainEqual({ method: 'GET', path: '/session' });
  });

  it('should register GET /license', () => {
    const router = createCloudAuthRouter();
    const routes = extractRoutes(router);

    expect(routes).toContainEqual({ method: 'GET', path: '/license' });
  });

  it('should register exactly 5 routes', () => {
    const router = createCloudAuthRouter();
    const routes = extractRoutes(router);

    expect(routes).toHaveLength(5);
  });
});
