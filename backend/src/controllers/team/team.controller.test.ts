import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import * as teamsHandlers from './team.controller.js';
import { setTeamControllerEventBusService } from './team.controller.js';
import type { ApiContext } from '../types.js';
import { StorageService, TmuxService, SchedulerService, MessageSchedulerService } from '../../services/index.js';
import { ActiveProjectsService } from '../../services/index.js';
import { PromptTemplateService } from '../../services/index.js';
import { Team, TeamMember } from '../../types/index.js';
import { CREWLY_CONSTANTS } from '../../constants.js';

// Mock dependencies
jest.mock('../../services/index.js');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123')
}));
jest.mock('fs/promises');
jest.mock('fs');
jest.mock('path');

const mockUpdateSessionId = jest.fn<any>();
jest.mock('../../services/session/index.js', () => ({
  getSessionBackendSync: jest.fn(),
  getSessionStatePersistence: jest.fn(() => ({
    updateSessionId: mockUpdateSessionId,
  })),
}));

describe('Teams Handlers', () => {
  let mockApiContext: ApiContext;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockStorageService: any;
  let mockTmuxService: any;
  let mockSchedulerService: any;
  let mockMessageSchedulerService: any;
  let mockActiveProjectsService: any;
  let mockPromptTemplateService: any;
  let responseMock: {
    status: jest.Mock<any>;
    json: jest.Mock<any>;
    send: jest.Mock<any>;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Re-setup the session mock implementation after clearAllMocks
    const { getSessionStatePersistence } = require('../../services/session/index.js');
    (getSessionStatePersistence as jest.Mock).mockReturnValue({
      updateSessionId: mockUpdateSessionId,
    });

    // Create response mock
    responseMock = {
      status: jest.fn<any>().mockReturnThis(),
      json: jest.fn<any>().mockReturnThis(),
      send: jest.fn<any>().mockReturnThis(),
    };

    // Mock services using any to avoid TypeScript strict type checking
    mockStorageService = {
      getTeams: jest.fn<any>(),
      saveTeam: jest.fn<any>(),
      deleteTeam: jest.fn<any>(),
      getProjects: jest.fn<any>(),
      saveProject: jest.fn<any>(),
      getOrchestratorStatus: jest.fn<any>(),
      updateOrchestratorStatus: jest.fn<any>(),
    };

    mockTmuxService = {
      sessionExists: jest.fn<any>(),
      createTeamMemberSession: jest.fn<any>(),
      killSession: jest.fn<any>(),
      sendMessage: jest.fn<any>(),
      listSessions: jest.fn<any>(),
    };

    mockSchedulerService = {
      scheduleDefaultCheckins: jest.fn<any>(),
      cancelAllChecksForSession: jest.fn<any>()
    };

    mockMessageSchedulerService = {
      scheduleMessage: jest.fn<any>(),
      cancelMessage: jest.fn<any>()
    };

    mockActiveProjectsService = {
      startProject: jest.fn<any>()
    };

    mockPromptTemplateService = {
      getOrchestratorTaskAssignmentPrompt: jest.fn<any>()
    };

    // Setup API context
    mockApiContext = {
      storageService: mockStorageService,
      tmuxService: mockTmuxService,
      schedulerService: mockSchedulerService,
      messageSchedulerService: mockMessageSchedulerService,
      activeProjectsService: mockActiveProjectsService,
      promptTemplateService: mockPromptTemplateService,
      agentRegistrationService: { createAgentSession: jest.fn<any>() } as any,
      taskAssignmentMonitor: { monitorTask: jest.fn<any>() } as any,
      taskTrackingService: { getAllInProgressTasks: jest.fn<any>() } as any,
    };

    mockRequest = {};
    mockResponse = responseMock as any;

    // Setup default mock returns
    mockStorageService.getTeams.mockResolvedValue([]);
    mockStorageService.saveTeam.mockResolvedValue(undefined);
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
        projectIds: ['test-project']
      };

      await teamsHandlers.createTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getTeams).toHaveBeenCalled();
      expect(mockStorageService.saveTeam).toHaveBeenCalled();
      expect(responseMock.status).toHaveBeenCalledWith(201);
      expect(responseMock.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
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

    it('should return error when team name already exists', async () => {
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

      expect(responseMock.status).toHaveBeenCalledWith(409);
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
      mockStorageService.getOrchestratorStatus.mockResolvedValue(null);

      await teamsHandlers.getTeams.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getTeams).toHaveBeenCalled();
      expect(responseMock.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should handle storage service errors when getting teams', async () => {
      mockStorageService.getTeams.mockRejectedValue(new Error('Database connection failed'));

      await teamsHandlers.getTeams.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(500);
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
      mockStorageService.getTeams.mockResolvedValue([mockTeam]);

      await teamsHandlers.getTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getTeams).toHaveBeenCalled();
      expect(responseMock.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should return 404 when team not found', async () => {
      mockRequest.params = { id: 'nonexistent-team' };
      mockStorageService.getTeams.mockResolvedValue([]);

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
      mockStorageService.getTeams.mockRejectedValue(new Error('Database query failed'));

      await teamsHandlers.getTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(500);
    });
  });

  describe('deleteTeam', () => {
    it('should delete team successfully', async () => {
      const mockTeam = {
        id: 'team-123',
        name: 'Test Team',
        members: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockRequest.params = { id: 'team-123' };
      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
      mockStorageService.deleteTeam.mockResolvedValue(undefined);
      mockTmuxService.sessionExists.mockResolvedValue(false);

      await teamsHandlers.deleteTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.deleteTeam).toHaveBeenCalledWith('team-123');
      expect(responseMock.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should return 404 when trying to delete non-existent team', async () => {
      mockRequest.params = { id: 'nonexistent-team' };
      mockStorageService.getTeams.mockResolvedValue([]);

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
      const mockTeam = {
        id: 'team-123',
        name: 'Test Team',
        members: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockRequest.params = { id: 'team-123' };
      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
      mockTmuxService.sessionExists.mockResolvedValue(false);
      mockStorageService.deleteTeam.mockRejectedValue(new Error('Delete operation failed'));

      await teamsHandlers.deleteTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(500);
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
      expect(mockStorageService.saveTeam).toHaveBeenCalled();
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
      expect(mockStorageService.saveTeam).toHaveBeenCalled();
    });
  });

  describe('Input validation', () => {
    it('should handle null request body by returning 500 due to destructuring error', async () => {
      // createTeam destructures req.body directly: const { name, ... } = req.body as CreateTeamRequestBody
      // When body is null, destructuring throws, caught by catch block returning 500
      mockRequest.body = null;

      await teamsHandlers.createTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(500);
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
    it('should set team members agentStatus to starting when starting', async () => {
      const mockTeam: Team = {
        id: 'team-123',
        name: 'Test Team',
        members: [
          {
            id: 'member-1',
            name: 'Alice',
            sessionName: 'crewly_alice',
            role: 'developer',
            runtimeType: 'claude-code',
            systemPrompt: 'Test prompt',
            agentStatus: 'inactive',
            workingStatus: 'idle',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'member-2',
            name: 'Bob',
            sessionName: 'crewly_bob',
            role: 'tester',
            runtimeType: 'claude-code',
            systemPrompt: 'Test prompt',
            agentStatus: 'inactive',
            workingStatus: 'idle',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        projectIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockRequest.params = { id: 'team-123' };
      mockRequest.body = { projectId: 'project-1' };
      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
      mockStorageService.getProjects.mockResolvedValue([{
        id: 'project-1',
        path: '/test/project',
        name: 'Test Project',
      }]);
      mockTmuxService.createTeamMemberSession.mockResolvedValue({ success: true, sessionName: 'test-session' });
      mockStorageService.saveTeam.mockResolvedValue(undefined);
      // Mock agentRegistrationService for startTeam
      mockApiContext.agentRegistrationService = {
        createAgentSession: jest.fn<any>().mockResolvedValue({ success: true, sessionName: 'test-session' })
      } as any;

      await teamsHandlers.startTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify team members were saved
      expect(mockStorageService.saveTeam).toHaveBeenCalled();
      expect(responseMock.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should return 404 when team not found', async () => {
      mockRequest.params = { id: 'non-existent-team' };
      mockRequest.body = {};
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
            sessionName: 'crewly_alice',
            role: 'developer',
            runtimeType: 'claude-code',
            systemPrompt: 'Test prompt',
            agentStatus: 'activating',
            workingStatus: 'idle',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        projectIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockRequest.body = {
        sessionName: 'crewly_alice',
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
        message: 'Agent crewly_alice registered as active with role developer',
        data: expect.objectContaining({
          sessionName: 'crewly_alice',
          role: 'developer',
          status: 'active'
        })
      });
    });

    it('should handle orchestrator registration correctly', async () => {
      mockRequest.body = {
        sessionName: CREWLY_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
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
        message: `Orchestrator ${CREWLY_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME} registered as active`,
        sessionName: CREWLY_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME
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
            sessionName: 'crewly_alice',
            role: 'developer',
            runtimeType: 'claude-code',
            systemPrompt: 'Test prompt',
            agentStatus: 'activating',
            workingStatus: 'idle',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        projectIds: [],
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

      // Should find member by ID; sessionName is preserved because freshMember.sessionName
      // already has a value ('crewly_alice'), so the controller does not overwrite it
      expect(mockStorageService.saveTeam).toHaveBeenCalledWith(
        expect.objectContaining({
          members: expect.arrayContaining([
            expect.objectContaining({
              id: 'member-1',
              sessionName: 'crewly_alice',
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

    it('should return 404 when member is not found in any team', async () => {
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

      // Controller returns 404 when agent is not found in any team
      expect(responseMock.status).toHaveBeenCalledWith(404);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: "Agent with sessionName 'non_existent_session' not found in any team"
      });
    });

    it('should handle storage service errors', async () => {
      mockRequest.body = {
        sessionName: 'crewly_alice',
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
    it('should handle complete user workflow: start member (starting) then agent registers (active)', async () => {
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
            runtimeType: 'claude-code',
            systemPrompt: 'Test prompt',
            agentStatus: 'inactive',
            workingStatus: 'idle',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        projectIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const mockProjects = [
        {
          id: 'project-1',
          name: 'Test Project',
          path: '/test/project',
          teams: {},
          status: 'active' as const,
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

      // Use agentRegistrationService for starting
      (mockApiContext.agentRegistrationService as any).createAgentSession = jest.fn<any>().mockResolvedValue({
        success: true,
        sessionName: 'test-team-alice-member-1'
      });

      await teamsHandlers.startTeamMember.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify member status changed to 'starting' after starting
      // The controller sets agentStatus to STARTING (line 1054) for instant UI feedback
      expect(savedTeamAfterStart).not.toBeNull();
      expect(savedTeamAfterStart!.members[0].agentStatus).toBe('starting');
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

      // Setup for registration - return the updated team with starting status
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
    });

    it('should complete the full status lifecycle from inactive to starting to active', async () => {
      // Step 1: Create team with inactive members (empty sessionName since not yet started)
      const mockTeam: Team = {
        id: 'team-123',
        name: 'Test Team',
        members: [
          {
            id: 'member-1',
            name: 'Alice',
            sessionName: '',
            role: 'developer',
            runtimeType: 'claude-code',
            systemPrompt: 'Test prompt',
            agentStatus: 'inactive',
            workingStatus: 'idle',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        projectIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Step 2: Start team (should set to starting)
      mockRequest.params = { id: 'team-123' };
      mockRequest.body = { projectId: 'project-1' };
      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
      mockStorageService.getProjects.mockResolvedValue([{
        id: 'project-1',
        path: '/test/project',
        name: 'Test Project',
      }]);
      mockTmuxService.listSessions.mockResolvedValue([]);
      mockTmuxService.createTeamMemberSession.mockResolvedValue({ success: true, sessionName: 'test-team-alice-member-1' });
      mockApiContext.agentRegistrationService = {
        createAgentSession: jest.fn<any>().mockResolvedValue({ success: true, sessionName: 'test-team-alice-member-1' })
      } as any;

      // Track all saves to capture intermediate states
      const allSaves: Team[] = [];
      mockStorageService.saveTeam.mockImplementation((team: Team) => {
        // Deep clone to capture the state at this point in time
        allSaves.push(JSON.parse(JSON.stringify(team)));
        return Promise.resolve();
      });

      await teamsHandlers.startTeam.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // The second save (index 1) sets all members to 'starting' for instant UI feedback
      // Save 0: projectIds update, Save 1: members set to 'starting'
      expect(allSaves.length).toBeGreaterThanOrEqual(2);
      expect(allSaves[1].members[0].agentStatus).toBe(CREWLY_CONSTANTS.AGENT_STATUSES.STARTING);

      // Step 3: Agent registers (should set to active)
      jest.clearAllMocks();

      // Re-setup the session mock implementation after clearAllMocks
      const { getSessionStatePersistence } = require('../../services/session/index.js');
      (getSessionStatePersistence as jest.Mock).mockReturnValue({
        updateSessionId: mockUpdateSessionId,
      });

      mockRequest.body = {
        sessionName: 'test-team-alice-member-1',
        role: 'developer',
        status: 'active',
        memberId: 'member-1'
      };

      // Use the last saved state as the current team state
      const lastSavedTeam = allSaves[allSaves.length - 1];
      mockStorageService.getTeams.mockResolvedValue([lastSavedTeam]);

      let registeredTeam: Team;
      mockStorageService.saveTeam.mockImplementation((team: Team) => {
        registeredTeam = JSON.parse(JSON.stringify(team));
        return Promise.resolve();
      });

      await teamsHandlers.registerMemberStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify member is now 'active'
      expect(registeredTeam!.members[0].agentStatus).toBe('active');
      expect(registeredTeam!.members[0].readyAt).toBeDefined();
    });

    it('should not have deprecated status field in any operations', async () => {
      const mockTeam: Team = {
        id: 'team-123',
        name: 'Test Team',
        members: [
          {
            id: 'member-1',
            name: 'Alice',
            sessionName: '',
            role: 'developer',
            runtimeType: 'claude-code',
            systemPrompt: 'Test prompt',
            agentStatus: 'inactive',
            workingStatus: 'idle',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        projectIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockRequest.params = { id: 'team-123' };
      mockRequest.body = { projectId: 'project-1' };
      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
      mockStorageService.getProjects.mockResolvedValue([{
        id: 'project-1',
        path: '/test/project',
        name: 'Test Project',
      }]);
      mockTmuxService.listSessions.mockResolvedValue([]);
      mockTmuxService.createTeamMemberSession.mockResolvedValue({ success: true, sessionName: 'test-team-alice-member-1' });
      mockApiContext.agentRegistrationService = {
        createAgentSession: jest.fn<any>().mockResolvedValue({ success: true, sessionName: 'test-team-alice-member-1' })
      } as any;

      let savedTeam: Team;
      mockStorageService.saveTeam.mockImplementation((team: Team) => {
        savedTeam = JSON.parse(JSON.stringify(team));
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

  describe('orchestrator auto-subscription to agent events', () => {
    let mockEventBusService: {
      subscribe: jest.Mock<any>;
      unsubscribe: jest.Mock<any>;
      listSubscriptions: jest.Mock<any>;
    };

    beforeEach(() => {
      mockEventBusService = {
        subscribe: jest.fn<any>().mockReturnValue({ id: 'sub-1' }),
        unsubscribe: jest.fn<any>().mockReturnValue(true),
        listSubscriptions: jest.fn<any>().mockReturnValue([]),
      };
      setTeamControllerEventBusService(mockEventBusService as any);
    });

    afterEach(() => {
      // Reset module-level state by setting to null
      setTeamControllerEventBusService(null as any);
    });

    it('should auto-subscribe orchestrator to agent events on registration', async () => {
      mockRequest.body = {
        sessionName: CREWLY_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
        role: 'orchestrator',
        status: 'active',
        registeredAt: new Date().toISOString(),
      };

      mockStorageService.updateOrchestratorStatus = jest.fn<any>().mockResolvedValue(undefined);

      await teamsHandlers.registerMemberStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockEventBusService.listSubscriptions).toHaveBeenCalledWith(
        CREWLY_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME
      );
      expect(mockEventBusService.subscribe).toHaveBeenCalledWith({
        eventType: ['agent:status_changed', 'agent:idle', 'agent:busy', 'agent:active', 'agent:inactive'],
        filter: {},
        subscriberSession: CREWLY_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
        oneShot: false,
        ttlMinutes: 1440,
      });
    });

    it('should clear existing subscriptions before re-subscribing', async () => {
      mockEventBusService.listSubscriptions.mockReturnValue([
        { id: 'old-sub-1' },
        { id: 'old-sub-2' },
      ]);

      mockRequest.body = {
        sessionName: CREWLY_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
        role: 'orchestrator',
        status: 'active',
      };

      mockStorageService.updateOrchestratorStatus = jest.fn<any>().mockResolvedValue(undefined);

      await teamsHandlers.registerMemberStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockEventBusService.unsubscribe).toHaveBeenCalledWith('old-sub-1');
      expect(mockEventBusService.unsubscribe).toHaveBeenCalledWith('old-sub-2');
      expect(mockEventBusService.subscribe).toHaveBeenCalledTimes(1);
    });

    it('should gracefully handle missing eventBusService', async () => {
      // Reset to null
      setTeamControllerEventBusService(null as any);

      mockRequest.body = {
        sessionName: CREWLY_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
        role: 'orchestrator',
        status: 'active',
      };

      mockStorageService.updateOrchestratorStatus = jest.fn<any>().mockResolvedValue(undefined);

      // Should not throw
      await teamsHandlers.registerMemberStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
      // subscribe should not be called since eventBusService is null
      expect(mockEventBusService.subscribe).not.toHaveBeenCalled();
    });

    it('should NOT subscribe for non-orchestrator agents', async () => {
      const mockTeam: Team = {
        id: 'team-123',
        name: 'Test Team',
        members: [{
          id: 'member-1',
          name: 'Alice',
          sessionName: 'crewly_alice',
          role: 'developer',
          systemPrompt: 'Test',
          agentStatus: 'activating',
          workingStatus: 'idle',
          runtimeType: 'claude-code',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }],
        projectIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRequest.body = {
        sessionName: 'crewly_alice',
        role: 'developer',
        status: 'active',
        memberId: 'member-1',
      };

      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
      mockStorageService.saveTeam.mockResolvedValue(undefined);

      await teamsHandlers.registerMemberStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockEventBusService.subscribe).not.toHaveBeenCalled();
    });

    it('should persist claudeSessionId when provided in registration', async () => {
      const mockTeam: Team = {
        id: 'team-123',
        name: 'Test Team',
        members: [
          {
            id: 'member-1',
            name: 'Alice',
            sessionName: 'crewly_alice',
            role: 'developer',
            runtimeType: 'claude-code',
            systemPrompt: 'Test prompt',
            agentStatus: 'activating',
            workingStatus: 'idle',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        projectIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockRequest.body = {
        sessionName: 'crewly_alice',
        role: 'developer',
        status: 'active',
        registeredAt: new Date().toISOString(),
        memberId: 'member-1',
        claudeSessionId: 'abc-123-session-uuid'
      };

      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
      mockStorageService.saveTeam.mockResolvedValue(undefined);

      await teamsHandlers.registerMemberStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockUpdateSessionId).toHaveBeenCalledWith('crewly_alice', 'abc-123-session-uuid');
    });

    it('should not call updateSessionId when claudeSessionId is not provided', async () => {
      const mockTeam: Team = {
        id: 'team-123',
        name: 'Test Team',
        members: [
          {
            id: 'member-1',
            name: 'Alice',
            sessionName: 'crewly_alice',
            role: 'developer',
            runtimeType: 'claude-code',
            systemPrompt: 'Test prompt',
            agentStatus: 'activating',
            workingStatus: 'idle',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        projectIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockRequest.body = {
        sessionName: 'crewly_alice',
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

      expect(mockUpdateSessionId).not.toHaveBeenCalled();
    });
  });

  describe('startTeamMember with retry logic', () => {
    beforeEach(() => {
      mockRequest = {
        params: { teamId: 'team-1', memberId: 'member-1' },
        body: {}
      };
      mockResponse = responseMock as any;

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
        projectIds: [],
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
        createAgentSession: jest.fn<any>().mockResolvedValue(mockCreateResult)
      } as any;

      await teamsHandlers.startTeamMember.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect((mockApiContext.agentRegistrationService as any).createAgentSession).toHaveBeenCalledTimes(1);
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
        createAgentSession: jest.fn<any>().mockImplementation(() => {
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

      expect((mockApiContext.agentRegistrationService as any).createAgentSession).toHaveBeenCalledTimes(2);
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
        createAgentSession: jest.fn<any>().mockResolvedValue(mockFailResult)
      } as any;

      await teamsHandlers.startTeamMember.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // Should retry 3 times total
      expect((mockApiContext.agentRegistrationService as any).createAgentSession).toHaveBeenCalledTimes(3);
      expect(responseMock.status).toHaveBeenCalledWith(500);
      // Controller returns lastError directly (not the "after N attempts" message)
      // because lastError is set before the fallback message in the || chain
      expect(responseMock.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "can't find pane: test-session"
        })
      );
    });

    it('should reset member status to inactive after failure', async () => {
      const mockFailResult = {
        success: false,
        error: 'Session creation failed'
      };

      mockApiContext.agentRegistrationService = {
        createAgentSession: jest.fn<any>().mockResolvedValue(mockFailResult)
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
      expect(savedTeam!.members[0].agentStatus).toBe(CREWLY_CONSTANTS.AGENT_STATUSES.INACTIVE);
      expect(savedTeam!.members[0].sessionName).toBe('');
    });

    it('should handle retry with delays correctly', async () => {
      // This test verifies that the retry logic calls createAgentSession
      // the expected number of times when the first call fails and the second succeeds.
      // The controller uses real setTimeout delays between retries.
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
        createAgentSession: jest.fn<any>().mockImplementation(() => {
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

      // Verify retry happened: first call failed, second succeeded
      expect((mockApiContext.agentRegistrationService as any).createAgentSession).toHaveBeenCalledTimes(2);
      expect(responseMock.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });
  });
});
