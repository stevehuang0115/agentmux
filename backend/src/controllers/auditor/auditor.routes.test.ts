import { describe, it, expect } from '@jest/globals';
import { createAuditorRouter } from './auditor.routes';

describe('Auditor Routes', () => {
  it('should create a router instance', () => {
    const router = createAuditorRouter();
    expect(router).toBeDefined();
  });

  it('should register POST /trigger route', () => {
    const router = createAuditorRouter();

    const routes = router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    expect(routes).toContainEqual({ path: '/trigger', methods: ['post'] });
  });

  it('should register GET /status route', () => {
    const router = createAuditorRouter();

    const routes = router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    expect(routes).toContainEqual({ path: '/status', methods: ['get'] });
  });

  it('should register exactly two routes', () => {
    const router = createAuditorRouter();

    const routes = router.stack.filter((layer: any) => layer.route);
    expect(routes).toHaveLength(2);
  });

  it('should not register any other HTTP methods on /trigger', () => {
    const router = createAuditorRouter();

    const triggerRoute = router.stack
      .filter((layer: any) => layer.route)
      .find((layer: any) => layer.route.path === '/trigger');

    expect(triggerRoute).toBeDefined();
    const methods = Object.keys(triggerRoute!.route.methods);
    expect(methods).toEqual(['post']);
  });

  it('should not register any other HTTP methods on /status', () => {
    const router = createAuditorRouter();

    const statusRoute = router.stack
      .filter((layer: any) => layer.route)
      .find((layer: any) => layer.route.path === '/status');

    expect(statusRoute).toBeDefined();
    const methods = Object.keys(statusRoute!.route.methods);
    expect(methods).toEqual(['get']);
  });

  it('should return a new router instance on each call', () => {
    const router1 = createAuditorRouter();
    const router2 = createAuditorRouter();
    expect(router1).not.toBe(router2);
  });
});
