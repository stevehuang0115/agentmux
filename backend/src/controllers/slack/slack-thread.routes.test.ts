/**
 * Slack Thread Routes Tests
 *
 * @module controllers/slack/slack-thread.routes.test
 */

import { Router } from 'express';
import { createSlackThreadRouter } from './slack-thread.routes.js';

describe('Slack Thread Routes', () => {
  let router: Router;

  beforeEach(() => {
    router = createSlackThreadRouter();
  });

  it('should create a router instance', () => {
    expect(router).toBeDefined();
    expect(router.stack).toBeDefined();
    expect(router.stack.length).toBeGreaterThan(0);
  });

  it('should have POST route for /register-agent', () => {
    const route = router.stack.find(
      (layer: any) => layer.route?.path === '/register-agent' && layer.route?.methods?.post
    );
    expect(route).toBeDefined();
  });

  it('should register exactly 1 route', () => {
    const routes = router.stack.filter((layer: any) => layer.route);
    expect(routes).toHaveLength(1);
  });
});
