import { Router } from 'express';
import { createMonitoringRouter } from './monitoring.routes.js';
import { ApiContext } from '../types.js';

describe('Monitoring Routes', () => {
  let mockContext: any;
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
    } as ApiContext;

    router = createMonitoringRouter(mockContext);
  });

  it('should create router for monitoring routes', () => {
    expect(router).toBeDefined();
    expect(router.stack).toBeDefined();
  });
});
