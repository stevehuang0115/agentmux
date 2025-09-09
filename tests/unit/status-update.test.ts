import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import * as teamsHandlers from '../../backend/src/controllers/domains/teams.handlers.js';
import type { ApiContext } from '../../backend/src/controllers/types.js';
import { Team, TeamMember } from '../../backend/src/types/index.js';

// Mock the services with proper typing
const mockStorageService = {
  getTeams: jest.fn<() => Promise<Team[]>>(),
  getProjects: jest.fn<() => Promise<any[]>>(),
  saveTeam: jest.fn<(team: Team) => Promise<void>>(),
  updateOrchestratorStatus: jest.fn<(status: string) => Promise<void>>()
};

const mockTmuxService = {
  createSession: jest.fn<() => Promise<void>>(),
  listSessions: jest.fn<() => Promise<{ sessionName: string }[]>>(),
  capturePane: jest.fn<(sessionName: string, lines?: number) => Promise<string>>(),
  killSession: jest.fn<(sessionName: string) => Promise<void>>(),
  createTeamMemberSession: jest.fn<(config: any, sessionName: string) => Promise<{ success: boolean; error?: string }>>()
};

const mockPromptTemplateService = {
  loadSystemPrompt: jest.fn<() => Promise<string>>()
};

describe('Team Status Update Tests', () => {
  let mockApiContext: ApiContext;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
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

    mockApiContext = {
      storageService: mockStorageService,
      tmuxService: mockTmuxService,
      promptTemplateService: mockPromptTemplateService
    } as any;

    mockRequest = {};
    mockResponse = responseMock as any;
  });

  describe('startTeam Status Updates', () => {
    it('should set team members agentStatus to activating when starting team', async () => {
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
      mockRequest.body = { projectId: 'project-123' };
      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
      mockStorageService.getProjects.mockResolvedValue([{ id: 'project-123', name: 'Test Project' }]);
      mockTmuxService.createSession.mockResolvedValue(undefined);
      mockTmuxService.listSessions.mockResolvedValue([]);
      mockTmuxService.capturePane.mockResolvedValue('agent output');
      mockTmuxService.killSession.mockResolvedValue(undefined);
      mockTmuxService.createTeamMemberSession.mockResolvedValue({ success: true });
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

      // Verify member status was updated to 'activating'
      expect(savedTeam!.members[0].agentStatus).toBe('activating');
      expect(savedTeam!.members[0].workingStatus).toBe('idle');
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

      let savedTeam: Team;
      mockStorageService.saveTeam.mockImplementation((team: Team) => {
        savedTeam = team;
        return Promise.resolve();
      });

      await teamsHandlers.registerMemberStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify member status was updated to 'active'
      expect(savedTeam!.members[0].agentStatus).toBe('active');
      expect(savedTeam!.members[0].readyAt).toBeDefined();
      expect(responseMock.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Agent agentmux_alice registered as active with role developer'
        })
      );
    });

    it('should handle orchestrator registration correctly', async () => {
      mockRequest.body = {
        sessionName: 'agentmux-orc',
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
        message: 'Orchestrator agentmux-orc registered as active',
        sessionName: 'agentmux-orc'
      });
    });
  });

  describe('Status Lifecycle Integration', () => {
    it('should complete full status lifecycle: inactive → activating → active', async () => {
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
      mockRequest.body = { projectId: 'project-123' };
      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
      mockStorageService.getProjects.mockResolvedValue([{ id: 'project-123', name: 'Test Project' }]);
      mockTmuxService.createSession.mockResolvedValue(undefined);
      mockTmuxService.listSessions.mockResolvedValue([]);
      mockTmuxService.capturePane.mockResolvedValue('agent output');
      mockTmuxService.killSession.mockResolvedValue(undefined);
      mockTmuxService.createTeamMemberSession.mockResolvedValue({ success: true });
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
      mockRequest.params = undefined;

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

    it('should not contain deprecated status field in team member objects', async () => {
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
      mockRequest.body = { projectId: 'project-123' };
      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
      mockStorageService.getProjects.mockResolvedValue([{ id: 'project-123', name: 'Test Project' }]);
      mockTmuxService.createSession.mockResolvedValue(undefined);
      mockTmuxService.listSessions.mockResolvedValue([]);
      mockTmuxService.capturePane.mockResolvedValue('agent output');
      mockTmuxService.killSession.mockResolvedValue(undefined);
      mockTmuxService.createTeamMemberSession.mockResolvedValue({ success: true });
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
});