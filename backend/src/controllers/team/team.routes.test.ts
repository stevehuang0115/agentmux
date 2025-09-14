import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Router } from 'express';
import { createTeamRouter } from './team.routes.js';
import type { ApiContext } from '../types.js';

describe('Team Routes', () => {
  let mockContext: ApiContext;
  let router: Router;

  beforeEach(() => {
    mockContext = {
      storageService: {
        getTeams: jest.fn(),
        saveTeam: jest.fn(),
        deleteTeam: jest.fn(),
        getProjects: jest.fn(),
        getTickets: jest.fn(),
        getOrchestratorStatus: jest.fn(),
        updateOrchestratorStatus: jest.fn()
      },
      tmuxService: {
        sessionExists: jest.fn(),
        createTeamMemberSession: jest.fn(),
        killSession: jest.fn(),
        listSessions: jest.fn(),
        capturePane: jest.fn(),
        sendMessage: jest.fn(),
        sendKey: jest.fn(),
        createOrchestratorSession: jest.fn(),
        initializeOrchestrator: jest.fn()
      },
      schedulerService: {
        scheduleDefaultCheckins: jest.fn(),
        cancelAllChecksForSession: jest.fn()
      },
      messageSchedulerService: {
        scheduleMessage: jest.fn(),
        cancelMessage: jest.fn()
      },
      activeProjectsService: {
        startProject: jest.fn(),
        stopProject: jest.fn(),
        restartProject: jest.fn()
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

    router = createTeamRouter(mockContext);
  });

  it('should create router with team routes', () => {
    expect(router).toBeDefined();
    expect(router.stack).toBeDefined();
    expect(router.stack.length).toBeGreaterThan(0);
  });

  it('should have POST route for creating teams', () => {
    const postRoutes = router.stack.filter(layer => 
      layer.route && layer.route.methods.post
    );
    expect(postRoutes.length).toBeGreaterThan(0);
  });

  it('should have GET routes for retrieving teams', () => {
    const getRoutes = router.stack.filter(layer => 
      layer.route && layer.route.methods.get
    );
    expect(getRoutes.length).toBeGreaterThan(0);
  });

  it('should have DELETE route for team deletion', () => {
    const deleteRoutes = router.stack.filter(layer => 
      layer.route && layer.route.methods.delete
    );
    expect(deleteRoutes.length).toBeGreaterThan(0);
  });

  it('should have PUT route for updating team members', () => {
    const putRoutes = router.stack.filter(layer => 
      layer.route && layer.route.methods.put
    );
    expect(putRoutes.length).toBeGreaterThan(0);
  });
});