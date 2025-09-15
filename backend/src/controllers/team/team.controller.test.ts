import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import * as teamsHandlers from './team.controller.js';
import type { ApiContext } from '../types.js';
import { StorageService, TmuxService, SchedulerService, MessageSchedulerService } from '../../services/index.js';
import { ActiveProjectsService } from '../../services/index.js';
import { PromptTemplateService } from '../../services/index.js';
import { Team, TeamMember } from '../../types/index.js';
import { AGENTMUX_CONSTANTS } from '../../constants.js';

// Mock dependencies
jest.mock('../../services/index.js');
jest.mock('../../services/index.js');
jest.mock('../../services/index.js');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123')
}));
jest.mock('fs/promises');
jest.mock('fs');
jest.mock('path');

describe('Teams Handlers', () => {
  let mockApiContext: ApiContext;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockTmuxService: jest.Mocked<TmuxService>;
  let mockSchedulerService: jest.Mocked<SchedulerService>;
  let mockMessageSchedulerService: jest.Mocked<MessageSchedulerService>;
  let mockActiveProjectsService: jest.Mocked<ActiveProjectsService>;
  let mockPromptTemplateService: jest.Mocked<PromptTemplateService>;
  let responseMock: {
    status: jest.Mock;
    json: jest.Mock;
    send: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create response mock
    responseMock = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    // Mock services using any to avoid TypeScript strict type checking
    mockStorageService = {
      getTeams: jest.fn(),
      saveTeam: jest.fn(),
      getProjects: jest.fn(),
      saveProject: jest.fn()
    } as any;
    
    mockTmuxService = {
      sessionExists: jest.fn(),
      createTeamMemberSession: jest.fn(),
      killSession: jest.fn(),
      sendMessage: jest.fn()
    } as any;
    
    mockSchedulerService = {
      scheduleDefaultCheckins: jest.fn(),
      cancelAllChecksForSession: jest.fn()
    } as any;
    
    mockMessageSchedulerService = {
      scheduleMessage: jest.fn(),
      cancelMessage: jest.fn()
    } as any;
    
    mockActiveProjectsService = {
      startProject: jest.fn()
    } as any;
    
    mockPromptTemplateService = {
      getOrchestratorTaskAssignmentPrompt: jest.fn()
    } as any;

    // Setup API context
    mockApiContext = {
      storageService: mockStorageService,
      tmuxService: mockTmuxService,
      schedulerService: mockSchedulerService,
      messageSchedulerService: mockMessageSchedulerService,
      activeProjectsService: mockActiveProjectsService,
      promptTemplateService: mockPromptTemplateService,
      taskAssignmentMonitor: { monitorTask: jest.fn() } as any,
      taskTrackingService: { getAllInProgressTasks: jest.fn() } as any,
    };

    mockRequest = {};
    mockResponse = responseMock as any;

    // Setup default mock returns
    mockStorageService.getTeams.mockResolvedValue([]);
    mockStorageService.createTeam.mockResolvedValue({ id: 'mock-uuid-123' } as Team);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('createTeam', () => {
    it('should create a team successfully with valid data', async () => {
      mockRequest.body = {
        name: 'Test Team',
        description: 'Test team description',
        members: [
          {
            name: 'John Doe',
            role: 'developer',
            systemPrompt: 'You are a developer'
          },
          {
            name: 'Jane Smith',
            role: 'tester',
            systemPrompt: 'You are a tester'
          }
        ],
        projectPath: '/test/project',
        currentProject: 'test-project'
      };

      await teamsHandlers.createTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getTeams).toHaveBeenCalled();
      expect(mockStorageService.createTeam).toHaveBeenCalled();
      expect(responseMock.status).toHaveBeenCalledWith(201);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        team: expect.objectContaining({
          id: 'mock-uuid-123'
        })
      });
    });

    it('should return 400 error when name is missing', async () => {
      mockRequest.body = {
        members: [
          {
            name: 'John Doe',
            role: 'developer',
            systemPrompt: 'You are a developer'
          }
        ]
      };

      await teamsHandlers.createTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(400);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required fields: name and members array'
      });
    });

    it('should return 400 error when members array is empty', async () => {
      mockRequest.body = {
        name: 'Test Team',
        members: []
      };

      await teamsHandlers.createTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(400);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required fields: name and members array'
      });
    });

    it('should return 400 error when member data is incomplete', async () => {
      mockRequest.body = {
        name: 'Test Team',
        members: [
          {
            name: 'John Doe',
            role: 'developer'
            // missing systemPrompt
          }
        ]
      };

      await teamsHandlers.createTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(400);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'All team members must have name, role, and systemPrompt'
      });
    });

    it('should return 500 error when team name already exists', async () => {
      const existingTeam = {
        id: 'existing-team-id',
        name: 'Test Team',
        description: 'Existing team',
        members: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockStorageService.getTeams.mockResolvedValue([existingTeam]);

      mockRequest.body = {
        name: 'Test Team',
        members: [
          {
            name: 'John Doe',
            role: 'developer',
            systemPrompt: 'You are a developer'
          }
        ]
      };

      await teamsHandlers.createTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Team with name "Test Team" already exists'
      });
    });

    it('should handle storage service errors', async () => {
      mockStorageService.getTeams.mockRejectedValue(new Error('Database error'));

      mockRequest.body = {
        name: 'Test Team',
        members: [
          {
            name: 'John Doe',
            role: 'developer',
            systemPrompt: 'You are a developer'
          }
        ]
      };

      await teamsHandlers.createTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Database error'
      });
    });
  });

  describe('getTeams', () => {
    it('should return all teams successfully', async () => {
      const mockTeams = [
        {
          id: 'team-1',
          name: 'Team 1',
          description: 'First team',
          members: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'team-2',
          name: 'Team 2',
          description: 'Second team',
          members: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      mockStorageService.getTeams.mockResolvedValue(mockTeams);

      await teamsHandlers.getTeams.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getTeams).toHaveBeenCalled();
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        teams: mockTeams
      });
    });

    it('should handle storage service errors when getting teams', async () => {
      mockStorageService.getTeams.mockRejectedValue(new Error('Database connection failed'));

      await teamsHandlers.getTeams.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Database connection failed'
      });
    });
  });

  describe('getTeam', () => {
    it('should return specific team successfully', async () => {
      const mockTeam = {
        id: 'team-123',
        name: 'Test Team',
        description: 'Test description',
        members: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockRequest.params = { id: 'team-123' };
      mockStorageService.getTeam.mockResolvedValue(mockTeam);

      await teamsHandlers.getTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getTeam).toHaveBeenCalledWith('team-123');
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        team: mockTeam
      });
    });

    it('should return 404 when team not found', async () => {
      mockRequest.params = { id: 'nonexistent-team' };
      mockStorageService.getTeam.mockResolvedValue(null);

      await teamsHandlers.getTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(404);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Team not found'
      });
    });

    it('should handle storage service errors when getting single team', async () => {
      mockRequest.params = { id: 'team-123' };
      mockStorageService.getTeam.mockRejectedValue(new Error('Database query failed'));

      await teamsHandlers.getTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Database query failed'
      });
    });
  });

  describe('deleteTeam', () => {
    it('should delete team successfully', async () => {
      mockRequest.params = { id: 'team-123' };
      mockStorageService.deleteTeam.mockResolvedValue(true);

      await teamsHandlers.deleteTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.deleteTeam).toHaveBeenCalledWith('team-123');
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        message: 'Team deleted successfully'
      });
    });

    it('should return 404 when trying to delete non-existent team', async () => {
      mockRequest.params = { id: 'nonexistent-team' };
      mockStorageService.deleteTeam.mockResolvedValue(false);

      await teamsHandlers.deleteTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(404);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Team not found'
      });
    });

    it('should handle storage service errors when deleting team', async () => {
      mockRequest.params = { id: 'team-123' };
      mockStorageService.deleteTeam.mockRejectedValue(new Error('Delete operation failed'));

      await teamsHandlers.deleteTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Delete operation failed'
      });
    });
  });

  describe('Context binding', () => {
    it('should have access to all services through context', async () => {
      mockRequest.body = {
        name: 'Context Test Team',
        members: [
          {
            name: 'Test Member',
            role: 'developer',
            systemPrompt: 'Test prompt'
          }
        ]
      };

      await teamsHandlers.createTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify that the handler can access all context services
      expect(mockStorageService.getTeams).toHaveBeenCalled();
      expect(mockStorageService.createTeam).toHaveBeenCalled();
    });

    it('should work with optional messageSchedulerService when available', async () => {
      // Test that handlers can work with or without optional services
      const contextWithoutScheduler = {
        ...mockApiContext,
        messageSchedulerService: undefined
      };

      mockRequest.body = {
        name: 'Test Team',
        members: [
          {
            name: 'Test Member',
            role: 'developer',
            systemPrompt: 'Test prompt'
          }
        ]
      };

      await teamsHandlers.createTeam.call(
        contextWithoutScheduler,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(201);
      expect(mockStorageService.createTeam).toHaveBeenCalled();
    });
  });

  describe('Input validation', () => {
    it('should handle null/undefined request body', async () => {
      mockRequest.body = null;

      await teamsHandlers.createTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(400);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required fields: name and members array'
      });
    });

    it('should handle members that is not an array', async () => {
      mockRequest.body = {
        name: 'Test Team',
        members: 'not an array'
      };

      await teamsHandlers.createTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(400);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required fields: name and members array'
      });
    });

    it('should validate each member in the array', async () => {
      mockRequest.body = {
        name: 'Test Team',
        members: [
          {
            name: 'Valid Member',
            role: 'developer',
            systemPrompt: 'Valid prompt'
          },
          {
            name: 'Invalid Member',
            role: 'tester'
            // missing systemPrompt
          }
        ]
      };

      await teamsHandlers.createTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(400);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'All team members must have name, role, and systemPrompt'
      });
    });
  });

  describe('startTeam', () => {
    it('should set team members agentStatus to activating when starting', async () => {
      const mockTeam: Team = {
        id: 'team-123',
        name: 'Test Team',
        members: [
          {
            id: 'member-1',
            name: 'Alice',
            sessionName: 'agentmux_alice',
            role: 'developer',
            systemPrompt: 'Test prompt',
            agentStatus: 'inactive',
            workingStatus: 'idle',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'member-2',
            name: 'Bob',
            sessionName: 'agentmux_bob',
            role: 'tester',
            systemPrompt: 'Test prompt',
            agentStatus: 'inactive',
            workingStatus: 'idle',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockRequest.params = { id: 'team-123' };
      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
      mockTmuxService.createSession.mockResolvedValue(undefined);
      mockPromptTemplateService.loadSystemPrompt.mockResolvedValue('Test system prompt');
      mockStorageService.saveTeam.mockResolvedValue(undefined);

      await teamsHandlers.startTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify team members were set to 'activating' status
      expect(mockStorageService.saveTeam).toHaveBeenCalledWith(
        expect.objectContaining({
          members: expect.arrayContaining([
            expect.objectContaining({
              id: 'member-1',
              agentStatus: 'activating',
              workingStatus: 'idle'
            }),
            expect.objectContaining({
              id: 'member-2',
              agentStatus: 'activating',
              workingStatus: 'idle'
            })
          ])
        })
      );

      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        message: 'Team started successfully',
        data: expect.objectContaining({
          startupResults: expect.arrayContaining([
            expect.objectContaining({ memberId: 'member-1', success: true }),
            expect.objectContaining({ memberId: 'member-2', success: true })
          ])
        })
      });
    });

    it('should handle tmux session creation failures gracefully', async () => {
      const mockTeam: Team = {
        id: 'team-123',
        name: 'Test Team',
        members: [
          {
            id: 'member-1',
            name: 'Alice',
            sessionName: 'agentmux_alice',
            role: 'developer',
            systemPrompt: 'Test prompt',
            agentStatus: 'inactive',
            workingStatus: 'idle',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockRequest.params = { id: 'team-123' };
      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
      mockTmuxService.createSession.mockRejectedValue(new Error('tmux failed'));
      mockPromptTemplateService.loadSystemPrompt.mockResolvedValue('Test system prompt');
      mockStorageService.saveTeam.mockResolvedValue(undefined);

      await teamsHandlers.startTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // Even if tmux fails, member status should still be set to activating
      expect(mockStorageService.saveTeam).toHaveBeenCalledWith(
        expect.objectContaining({
          members: expect.arrayContaining([
            expect.objectContaining({
              id: 'member-1',
              agentStatus: 'activating',
              workingStatus: 'idle'
            })
          ])
        })
      );

      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        message: 'Team started with some failures: 0/1 agents started successfully',
        data: expect.objectContaining({
          startupResults: expect.arrayContaining([
            expect.objectContaining({
              memberId: 'member-1',
              success: false,
              error: 'tmux failed'
            })
          ])
        })
      });
    });

    it('should return 404 when team not found', async () => {
      mockRequest.params = { id: 'non-existent-team' };
      mockStorageService.getTeams.mockResolvedValue([]);

      await teamsHandlers.startTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(404);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Team not found'
      });
    });
  });

  describe('registerMemberStatus', () => {
    it('should update team member agentStatus to active when agent registers', async () => {
      const mockTeam: Team = {
        id: 'team-123',
        name: 'Test Team',
        members: [
          {
            id: 'member-1',
            name: 'Alice',
            sessionName: 'agentmux_alice',
            role: 'developer',
            systemPrompt: 'Test prompt',
            agentStatus: 'activating',
            workingStatus: 'idle',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockRequest.body = {
        sessionName: 'agentmux_alice',
        role: 'developer',
        status: 'active',
        registeredAt: new Date().toISOString(),
        memberId: 'member-1'
      };

      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
      mockStorageService.saveTeam.mockResolvedValue(undefined);

      await teamsHandlers.registerMemberStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify member status was updated to 'active'
      expect(mockStorageService.saveTeam).toHaveBeenCalledWith(
        expect.objectContaining({
          members: expect.arrayContaining([
            expect.objectContaining({
              id: 'member-1',
              agentStatus: 'active',
              workingStatus: 'idle',
              readyAt: expect.any(String)
            })
          ])
        })
      );

      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        message: 'Agent agentmux_alice registered as active with role developer',
        data: expect.objectContaining({
          sessionName: 'agentmux_alice',
          role: 'developer',
          status: 'active'
        })
      });
    });

    it('should handle orchestrator registration correctly', async () => {
      mockRequest.body = {
        sessionName: AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
        role: 'orchestrator',
        status: 'active',
        registeredAt: new Date().toISOString()
      };

      mockStorageService.updateOrchestratorStatus.mockResolvedValue(undefined);

      await teamsHandlers.registerMemberStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.updateOrchestratorStatus).toHaveBeenCalledWith('active');
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        message: `Orchestrator ${AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME} registered as active`,
        sessionName: AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME
      });
    });

    it('should find member by memberId when provided', async () => {
      const mockTeam: Team = {
        id: 'team-123',
        name: 'Test Team',
        members: [
          {
            id: 'member-1',
            name: 'Alice',
            sessionName: 'agentmux_alice',
            role: 'developer',
            systemPrompt: 'Test prompt',
            agentStatus: 'activating',
            workingStatus: 'idle',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockRequest.body = {
        sessionName: 'different_session_name',
        role: 'developer',
        status: 'active',
        memberId: 'member-1'
      };

      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
      mockStorageService.saveTeam.mockResolvedValue(undefined);

      await teamsHandlers.registerMemberStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // Should find member by ID and update sessionName
      expect(mockStorageService.saveTeam).toHaveBeenCalledWith(
        expect.objectContaining({
          members: expect.arrayContaining([
            expect.objectContaining({
              id: 'member-1',
              sessionName: 'different_session_name',
              agentStatus: 'active'
            })
          ])
        })
      );
    });

    it('should return 400 when sessionName or role is missing', async () => {
      mockRequest.body = {
        role: 'developer'
        // missing sessionName
      };

      await teamsHandlers.registerMemberStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(400);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'sessionName and role are required'
      });
    });

    it('should handle case when member is not found but still return success', async () => {
      mockRequest.body = {
        sessionName: 'non_existent_session',
        role: 'developer',
        status: 'active'
      };

      mockStorageService.getTeams.mockResolvedValue([]);

      await teamsHandlers.registerMemberStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // Should still return success even if member not found
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        message: 'Agent non_existent_session registered as active with role developer',
        data: expect.objectContaining({
          sessionName: 'non_existent_session',
          role: 'developer',
          status: 'active'
        })
      });
    });

    it('should handle storage service errors', async () => {
      mockRequest.body = {
        sessionName: 'agentmux_alice',
        role: 'developer',
        status: 'active'
      };

      mockStorageService.getTeams.mockRejectedValue(new Error('Storage error'));

      await teamsHandlers.registerMemberStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to register member status'
      });
    });
  });

  describe('Status Update Workflow Integration', () => {
    it('should handle complete user workflow: start member (activating) → agent registers (active)', async () => {
      // Setup: Create a team with an inactive member
      const mockTeam: Team = {
        id: 'team-123',
        name: 'Test Team',
        members: [
          {
            id: 'member-1',
            name: 'Alice',
            sessionName: '',
            role: 'developer',
            systemPrompt: 'Test prompt',
            agentStatus: 'inactive',
            workingStatus: 'idle',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const mockProjects = [
        {
          id: 'project-1',
          name: 'Test Project',
          path: '/test/project',
          teams: {},
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      // Mock services for startTeamMember
      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
      mockStorageService.getProjects.mockResolvedValue(mockProjects);
      mockTmuxService.listSessions.mockResolvedValue([]);
      mockTmuxService.createTeamMemberSession.mockResolvedValue({
        success: true,
        sessionName: 'test-team-alice-member-1'
      });

      let savedTeamAfterStart: Team | null = null;
      let savedTeamAfterRegistration: Team | null = null;

      // Track team saves to verify state transitions
      mockStorageService.saveTeam
        .mockImplementationOnce((team: Team) => {
          savedTeamAfterStart = team;
          return Promise.resolve();
        })
        .mockImplementationOnce((team: Team) => {
          savedTeamAfterRegistration = team;
          return Promise.resolve();
        });

      // STEP 1: User starts the team member
      mockRequest.params = { teamId: 'team-123', memberId: 'member-1' };
      mockRequest.body = {};

      await teamsHandlers.startTeamMember.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify member status changed to 'activating' after starting
      expect(savedTeamAfterStart).not.toBeNull();
      expect(savedTeamAfterStart!.members[0].agentStatus).toBe('activating');
      expect(savedTeamAfterStart!.members[0].workingStatus).toBe('idle');
      expect(savedTeamAfterStart!.members[0].sessionName).toBe('test-team-alice-member-1');

      // STEP 2: Agent calls MCP registration
      mockRequest.params = {};
      mockRequest.body = {
        sessionName: 'test-team-alice-member-1',
        role: 'developer',
        status: 'active',
        memberId: 'member-1',
        registeredAt: new Date().toISOString()
      };

      // Setup for registration - return the updated team with activating status
      mockStorageService.getTeams.mockResolvedValue([savedTeamAfterStart!]);

      await teamsHandlers.registerMemberStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify member status changed to 'active' after registration
      expect(savedTeamAfterRegistration).not.toBeNull();
      expect(savedTeamAfterRegistration!.members[0].agentStatus).toBe('active');
      expect(savedTeamAfterRegistration!.members[0].workingStatus).toBe('idle');
      expect(savedTeamAfterRegistration!.members[0].sessionName).toBe('test-team-alice-member-1');
      expect(savedTeamAfterRegistration!.members[0].readyAt).toBeDefined();

      // Verify API responses
      expect(responseMock.json).toHaveBeenCalledTimes(2);
      
      // First call (startTeamMember) should indicate success
      expect(responseMock.json).toHaveBeenNthCalledWith(1, 
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('Alice started successfully')
        })
      );

      // Second call (registerMemberStatus) should confirm registration
      expect(responseMock.json).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('registered as active with role developer')
        })
      );
    });

    it('should complete the full status lifecycle from inactive → activating → active', async () => {
      // Step 1: Create team with inactive members
      const mockTeam: Team = {
        id: 'team-123',
        name: 'Test Team',
        members: [
          {
            id: 'member-1',
            name: 'Alice',
            sessionName: 'agentmux_alice',
            role: 'developer',
            systemPrompt: 'Test prompt',
            agentStatus: 'inactive',
            workingStatus: 'idle',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Step 2: Start team (should set to activating)
      mockRequest.params = { id: 'team-123' };
      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
      mockTmuxService.createSession.mockResolvedValue(undefined);
      mockPromptTemplateService.loadSystemPrompt.mockResolvedValue('Test system prompt');

      let savedTeam: Team;
      mockStorageService.saveTeam.mockImplementation((team: Team) => {
        savedTeam = team;
        return Promise.resolve();
      });

      await teamsHandlers.startTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify member is now 'activating'
      expect(savedTeam!.members[0].agentStatus).toBe('activating');

      // Step 3: Agent registers (should set to active)
      jest.clearAllMocks();
      mockRequest.body = {
        sessionName: 'agentmux_alice',
        role: 'developer',
        status: 'active',
        memberId: 'member-1'
      };

      mockStorageService.getTeams.mockResolvedValue([savedTeam!]);
      mockStorageService.saveTeam.mockImplementation((team: Team) => {
        savedTeam = team;
        return Promise.resolve();
      });

      await teamsHandlers.registerMemberStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify member is now 'active'
      expect(savedTeam!.members[0].agentStatus).toBe('active');
      expect(savedTeam!.members[0].readyAt).toBeDefined();
    });

    it('should not have deprecated status field in any operations', async () => {
      const mockTeam: Team = {
        id: 'team-123',
        name: 'Test Team',
        members: [
          {
            id: 'member-1',
            name: 'Alice',
            sessionName: 'agentmux_alice',
            role: 'developer',
            systemPrompt: 'Test prompt',
            agentStatus: 'inactive',
            workingStatus: 'idle',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockRequest.params = { id: 'team-123' };
      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
      mockTmuxService.createSession.mockResolvedValue(undefined);
      mockPromptTemplateService.loadSystemPrompt.mockResolvedValue('Test system prompt');

      let savedTeam: Team;
      mockStorageService.saveTeam.mockImplementation((team: Team) => {
        savedTeam = team;
        return Promise.resolve();
      });

      await teamsHandlers.startTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify no deprecated 'status' field exists
      expect(savedTeam!.members[0]).not.toHaveProperty('status');
      expect(savedTeam!.members[0]).toHaveProperty('agentStatus');
      expect(savedTeam!.members[0]).toHaveProperty('workingStatus');
    });
  });

  describe('startTeamMember with retry logic', () => {
    beforeEach(() => {
      mockRequest = {
        params: { teamId: 'team-1', memberId: 'member-1' },
        body: {}
      };
      mockResponse = responseMock;

      const mockTeam: Team = {
        id: 'team-1',
        name: 'Test Team',
        description: 'Test Description',
        members: [{
          id: 'member-1',
          name: 'Test Member',
          sessionName: '',
          role: 'tpm',
          systemPrompt: 'Test prompt',
          agentStatus: 'inactive',
          workingStatus: 'idle',
          runtimeType: 'claude-code',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
      mockStorageService.getProjects.mockResolvedValue([]);
    });

    it('should succeed on first attempt', async () => {
      const mockCreateResult = {
        success: true,
        sessionName: 'test-session',
        message: 'Session created successfully'
      };

      // Mock agentRegistrationService
      mockApiContext.agentRegistrationService = {
        createAgentSession: jest.fn().mockResolvedValue(mockCreateResult)
      } as any;

      await teamsHandlers.startTeamMember.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockApiContext.agentRegistrationService.createAgentSession).toHaveBeenCalledTimes(1);
      expect(responseMock.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            memberId: 'member-1',
            sessionName: 'test-session'
          })
        })
      );
    });

    it('should retry on failure and succeed on second attempt', async () => {
      const mockFailResult = {
        success: false,
        error: 'can\'t find pane: test-session'
      };
      const mockSuccessResult = {
        success: true,
        sessionName: 'test-session',
        message: 'Session created successfully'
      };

      // Mock agentRegistrationService to fail first, succeed second
      let callCount = 0;
      mockApiContext.agentRegistrationService = {
        createAgentSession: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve(mockFailResult);
          } else {
            return Promise.resolve(mockSuccessResult);
          }
        })
      } as any;

      await teamsHandlers.startTeamMember.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockApiContext.agentRegistrationService.createAgentSession).toHaveBeenCalledTimes(2);
      expect(responseMock.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            memberId: 'member-1',
            sessionName: 'test-session'
          })
        })
      );
    });

    it('should fail after all retry attempts', async () => {
      const mockFailResult = {
        success: false,
        error: 'can\'t find pane: test-session'
      };

      // Mock agentRegistrationService to always fail
      mockApiContext.agentRegistrationService = {
        createAgentSession: jest.fn().mockResolvedValue(mockFailResult)
      } as any;

      await teamsHandlers.startTeamMember.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // Should retry 3 times total
      expect(mockApiContext.agentRegistrationService.createAgentSession).toHaveBeenCalledTimes(3);
      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('after 3 attempts')
        })
      );
    });

    it('should reset member status to inactive after failure', async () => {
      const mockFailResult = {
        success: false,
        error: 'Session creation failed'
      };

      mockApiContext.agentRegistrationService = {
        createAgentSession: jest.fn().mockResolvedValue(mockFailResult)
      } as any;

      let savedTeam: Team;
      mockStorageService.saveTeam.mockImplementation((team: Team) => {
        savedTeam = team;
        return Promise.resolve();
      });

      await teamsHandlers.startTeamMember.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify member status was reset to inactive
      expect(savedTeam!.members[0].agentStatus).toBe(AGENTMUX_CONSTANTS.AGENT_STATUSES.INACTIVE);
      expect(savedTeam!.members[0].sessionName).toBe('');
    });

    it('should handle race condition timing properly', async () => {
      jest.useFakeTimers();
      const startTime = Date.now();

      const mockFailResult = {
        success: false,
        error: 'can\'t find pane: test-session'
      };
      const mockSuccessResult = {
        success: true,
        sessionName: 'test-session',
        message: 'Session created successfully'
      };

      let callCount = 0;
      mockApiContext.agentRegistrationService = {
        createAgentSession: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve(mockFailResult);
          } else {
            return Promise.resolve(mockSuccessResult);
          }
        })
      } as any;

      const startPromise = teamsHandlers.startTeamMember.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // Fast-forward through the retry delay
      jest.advanceTimersByTime(1000); // Should wait 1000ms before retry
      await startPromise;

      expect(mockApiContext.agentRegistrationService.createAgentSession).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });
  });
});