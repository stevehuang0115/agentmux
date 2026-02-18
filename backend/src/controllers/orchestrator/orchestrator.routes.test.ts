import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Router } from 'express';
import { createOrchestratorRouter } from './orchestrator.routes.js';
import type { ApiContext } from '../types.js';

describe('Orchestrator Routes', () => {
  let mockContext: ApiContext;
  let router: Router;

  beforeEach(() => {
    mockContext = {
      storageService: {
        getTeams: jest.fn(),
        getProjects: jest.fn()
      },
      tmuxService: {
        sessionExists: jest.fn(),
        createOrchestratorSession: jest.fn(),
        sendMessage: jest.fn(),
        sendKey: jest.fn(),
        initializeAgentWithRegistration: jest.fn()
      },
      schedulerService: {
        scheduleDefaultCheckins: jest.fn()
      },
      messageSchedulerService: {
        scheduleMessage: jest.fn()
      },
      activeProjectsService: {
        startProject: jest.fn()
      },
      promptTemplateService: {
        getOrchestratorTaskAssignmentPrompt: jest.fn()
      },
      taskAssignmentMonitor: {
        monitorTask: jest.fn()
      },
      taskTrackingService: {
        getAllInProgressTasks: jest.fn()
      }
    } as any;

    router = createOrchestratorRouter(mockContext);
  });

  it('should create router with orchestrator routes', () => {
    expect(router).toBeDefined();
    expect(router.stack).toBeDefined();
    expect(router.stack.length).toBeGreaterThan(0);
  });

  it('should have POST route for setup', () => {
    const setupRoute = router.stack.find(layer =>
      layer.route && layer.route.path === '/setup' && (layer.route as any).methods.post
    );
    expect(setupRoute).toBeDefined();
  });

  it('should have GET route for health check', () => {
    const healthRoute = router.stack.find(layer =>
      layer.route && layer.route.path === '/health' && (layer.route as any).methods.get
    );
    expect(healthRoute).toBeDefined();
  });

  it('should have POST route for executing commands', () => {
    const commandRoute = router.stack.find(layer =>
      layer.route && layer.route.path === '/commands/execute' && (layer.route as any).methods.post
    );
    expect(commandRoute).toBeDefined();
  });

  it('should have POST route for sending messages', () => {
    const messageRoute = router.stack.find(layer =>
      layer.route && layer.route.path === '/messages' && (layer.route as any).methods.post
    );
    expect(messageRoute).toBeDefined();
  });
});
