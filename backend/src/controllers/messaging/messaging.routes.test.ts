/**
 * Messaging Routes Tests
 *
 * @module controllers/messaging/messaging.routes.test
 */

import { Router } from 'express';
import { createMessagingRouter } from './messaging.routes.js';

describe('Messaging Routes', () => {
  let router: Router;

  beforeEach(() => {
    router = createMessagingRouter();
  });

  it('should create a router instance', () => {
    expect(router).toBeDefined();
    expect(router.stack).toBeDefined();
    expect(router.stack.length).toBeGreaterThan(0);
  });

  it('should have GET route for /queue/status', () => {
    const route = router.stack.find(
      (layer: any) => layer.route?.path === '/queue/status' && layer.route?.methods?.get
    );
    expect(route).toBeDefined();
  });

  it('should have GET route for /queue/messages', () => {
    const route = router.stack.find(
      (layer: any) => layer.route?.path === '/queue/messages' && layer.route?.methods?.get
    );
    expect(route).toBeDefined();
  });

  it('should have GET route for /queue/history', () => {
    const route = router.stack.find(
      (layer: any) => layer.route?.path === '/queue/history' && layer.route?.methods?.get
    );
    expect(route).toBeDefined();
  });

  it('should have GET route for /queue/messages/:messageId', () => {
    const route = router.stack.find(
      (layer: any) =>
        layer.route?.path === '/queue/messages/:messageId' && layer.route?.methods?.get
    );
    expect(route).toBeDefined();
  });

  it('should have DELETE route for /queue/messages/:messageId', () => {
    const route = router.stack.find(
      (layer: any) =>
        layer.route?.path === '/queue/messages/:messageId' && layer.route?.methods?.delete
    );
    expect(route).toBeDefined();
  });

  it('should have DELETE route for /queue', () => {
    const route = router.stack.find(
      (layer: any) => layer.route?.path === '/queue' && layer.route?.methods?.delete
    );
    expect(route).toBeDefined();
  });

  it('should register exactly 6 routes', () => {
    const routes = router.stack.filter((layer: any) => layer.route);
    expect(routes).toHaveLength(6);
  });
});
