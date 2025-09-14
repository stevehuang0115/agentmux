import { describe, it, expect, beforeEach } from '@jest/globals';
import { Router } from 'express';
import { createMonitoringRouter } from './monitoring.routes.js';
import type { ApiContext } from '../types.js';

describe('Monitoring Routes', () => {
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

    router = createMonitoringRouter(mockContext);
  });

  it('should create router for monitoring routes', () => {
    expect(router).toBeDefined();
    expect(router.stack).toBeDefined();
  });
});