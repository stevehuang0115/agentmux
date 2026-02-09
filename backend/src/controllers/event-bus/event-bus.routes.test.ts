/**
 * Event Bus Routes Tests
 *
 * @module controllers/event-bus/event-bus.routes.test
 */

import { Router } from 'express';
import { createEventBusRouter } from './event-bus.routes.js';

describe('Event Bus Routes', () => {
  let router: Router;

  beforeEach(() => {
    router = createEventBusRouter();
  });

  it('should create a router instance', () => {
    expect(router).toBeDefined();
    expect(router.stack).toBeDefined();
    expect(router.stack.length).toBeGreaterThan(0);
  });

  it('should have POST route for /subscribe', () => {
    const route = router.stack.find(
      (layer: any) => layer.route?.path === '/subscribe' && layer.route?.methods?.post
    );
    expect(route).toBeDefined();
  });

  it('should have DELETE route for /subscribe/:subscriptionId', () => {
    const route = router.stack.find(
      (layer: any) =>
        layer.route?.path === '/subscribe/:subscriptionId' && layer.route?.methods?.delete
    );
    expect(route).toBeDefined();
  });

  it('should have GET route for /subscriptions', () => {
    const route = router.stack.find(
      (layer: any) => layer.route?.path === '/subscriptions' && layer.route?.methods?.get
    );
    expect(route).toBeDefined();
  });

  it('should have GET route for /subscriptions/:subscriptionId', () => {
    const route = router.stack.find(
      (layer: any) =>
        layer.route?.path === '/subscriptions/:subscriptionId' && layer.route?.methods?.get
    );
    expect(route).toBeDefined();
  });

  it('should register exactly 4 routes', () => {
    const routes = router.stack.filter((layer: any) => layer.route);
    expect(routes).toHaveLength(4);
  });
});
