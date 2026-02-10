/**
 * Tests for Memory Routes
 *
 * Validates the router configuration: correct paths, HTTP methods,
 * and handler registration for all memory endpoints.
 *
 * @module controllers/memory/memory.routes.test
 */

import { Router } from 'express';
import { createMemoryRouter } from './memory.routes.js';

describe('Memory Routes', () => {
  let router: Router;

  beforeEach(() => {
    router = createMemoryRouter();
  });

  it('should create a router instance', () => {
    expect(router).toBeDefined();
    expect(router.stack).toBeDefined();
    expect(router.stack.length).toBeGreaterThan(0);
  });

  it('should have POST route for /remember', () => {
    const route = (router.stack as any[]).find(
      (layer: any) => layer.route?.path === '/remember' && layer.route?.methods?.post
    );
    expect(route).toBeDefined();
  });

  it('should have POST route for /recall', () => {
    const route = (router.stack as any[]).find(
      (layer: any) => layer.route?.path === '/recall' && layer.route?.methods?.post
    );
    expect(route).toBeDefined();
  });

  it('should have POST route for /record-learning', () => {
    const route = (router.stack as any[]).find(
      (layer: any) => layer.route?.path === '/record-learning' && layer.route?.methods?.post
    );
    expect(route).toBeDefined();
  });

  it('should register exactly 3 routes', () => {
    const routes = (router.stack as any[]).filter((layer: any) => layer.route);
    expect(routes).toHaveLength(3);
  });

  it('should only register POST methods', () => {
    const routes = (router.stack as any[]).filter((layer: any) => layer.route);
    for (const route of routes) {
      expect(route.route.methods.post).toBe(true);
      expect(route.route.methods.get).toBeUndefined();
      expect(route.route.methods.delete).toBeUndefined();
      expect(route.route.methods.put).toBeUndefined();
    }
  });
});
