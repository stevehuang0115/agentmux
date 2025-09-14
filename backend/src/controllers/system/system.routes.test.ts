import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Router } from 'express';
import { createSystemRouter } from './system.routes.js';
import type { ApiContext } from '../types.js';

describe('System Routes', () => {
  let mockContext: ApiContext;
  let router: Router;

  beforeEach(() => {
    mockContext = {
      storageService: {},
      tmuxService: {},
      schedulerService: {},
      activeProjectsService: {},
      promptTemplateService: {},
      taskAssignmentMonitor: {},
      taskTrackingService: {}
    } as any;

    router = createSystemRouter(mockContext);
  });

  it('should create router with system routes', () => {
    expect(router).toBeDefined();
    expect(router.stack).toBeDefined();
    expect(router.stack.length).toBeGreaterThan(0);
  });

  it('should have GET route for health check', () => {
    const healthRoute = router.stack.find(layer => 
      layer.route && layer.route.path === '/health' && layer.route.methods.get
    );
    expect(healthRoute).toBeDefined();
  });

  it('should have GET route for metrics', () => {
    const metricsRoute = router.stack.find(layer => 
      layer.route && layer.route.path === '/metrics' && layer.route.methods.get
    );
    expect(metricsRoute).toBeDefined();
  });

  it('should have GET route for configuration', () => {
    const configRoute = router.stack.find(layer => 
      layer.route && layer.route.path === '/configuration' && layer.route.methods.get
    );
    expect(configRoute).toBeDefined();
  });
});