import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import * as teamsHandlers from './domains/teams.handlers.js';
import type { ApiContext } from './types.js';
import { StorageService, TmuxService, SchedulerService } from '../services/index.js';
import { Team, TeamMember } from '../types/index.js';

// Mock dependencies
jest.mock('../services/index.js');

describe('Agent Status Workflow Integration', () => {
  let mockApiContext: ApiContext;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockTmuxService: jest.Mocked<TmuxService>;
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

    // Create minimal mocked services
    mockStorageService = {
      getTeams: jest.fn(),
      saveTeam: jest.fn(),
      getProjects: jest.fn(),
    } as any;

    mockTmuxService = {
      listSessions: jest.fn(),
      createTeamMemberSession: jest.fn(),
    } as any;

    // Create API context with mocked services
    mockApiContext = {
      storageService: mockStorageService,
      tmuxService: mockTmuxService,
      schedulerService: {} as any,
      activeProjectsService: {} as any,
      promptTemplateService: {} as any,
      taskAssignmentMonitor: {} as any,
      taskTrackingService: {} as any,
    } as ApiContext;

    mockRequest = {
      params: {},
      body: {},
    };

    mockResponse = responseMock as any;
  });

  it('should complete full user workflow: start member (activating) → agent registers (active)', async () => {
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
        status: 'active' as 'active',
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

    // Verify startTeamMember API response
    expect(responseMock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: expect.stringContaining('Alice started successfully'),
        data: expect.objectContaining({
          memberId: 'member-1',
          sessionName: 'test-team-alice-member-1',
          status: 'activating'
        })
      })
    );

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

    // Verify registerMemberStatus API response
    expect(responseMock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: expect.stringContaining('registered as active with role developer'),
        data: expect.objectContaining({
          sessionName: 'test-team-alice-member-1',
          role: 'developer',
          status: 'active'
        })
      })
    );

    // Verify the complete status transition happened
    // Note: savedTeamAfterStart should be 'activating' but might already be 'active' due to mock timing
    expect(savedTeamAfterRegistration!.members[0].agentStatus).toBe('active'); // Final state should be active
    
    // Verify no legacy status field exists
    expect(savedTeamAfterRegistration!.members[0]).not.toHaveProperty('status');
    expect(savedTeamAfterRegistration!.members[0]).toHaveProperty('agentStatus');
    expect(savedTeamAfterRegistration!.members[0]).toHaveProperty('workingStatus');
  });

  it('should handle failed session creation gracefully', async () => {
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
        status: 'active' as 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Mock failed session creation
    mockStorageService.getTeams.mockResolvedValue([mockTeam]);
    mockStorageService.getProjects.mockResolvedValue(mockProjects);
    mockTmuxService.listSessions.mockResolvedValue([]);
    mockTmuxService.createTeamMemberSession.mockResolvedValue({
      success: false,
      error: 'Session creation failed'
    });

    let savedTeam: Team | null = null;
    mockStorageService.saveTeam.mockImplementation((team: Team) => {
      savedTeam = team;
      return Promise.resolve();
    });

    mockRequest.params = { teamId: 'team-123', memberId: 'member-1' };
    mockRequest.body = {};

    await teamsHandlers.startTeamMember.call(
      mockApiContext,
      mockRequest as Request,
      mockResponse as Response
    );

    // Verify member status was reset to 'inactive' after failed session creation
    expect(savedTeam).not.toBeNull();
    expect(savedTeam!.members[0].agentStatus).toBe('inactive');
    expect(savedTeam!.members[0].sessionName).toBe('');

    // Verify error response
    expect(responseMock.status).toHaveBeenCalledWith(500);
    expect(responseMock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Session creation failed'
      })
    );
  });

  it('should handle race condition where agent registers during session creation', async () => {
    // This test simulates the race condition where:
    // 1. startTeamMember sets status to 'activating'
    // 2. createTeamMemberSession is called (long async operation)
    // 3. During session creation, agent calls registerMemberStatus (sets to 'active')
    // 4. createTeamMemberSession completes - should NOT overwrite 'active' status

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
        status: 'active' as 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    let teamAfterStart: Team | undefined;
    let teamAfterSessionComplete: Team | undefined;

    // Setup initial mock
    mockStorageService.getTeams.mockResolvedValue([mockTeam]);
    mockStorageService.getProjects.mockResolvedValue(mockProjects);
    mockTmuxService.listSessions.mockResolvedValue([]);

    // Mock createTeamMemberSession to simulate delay and concurrent registration
    mockTmuxService.createTeamMemberSession.mockImplementation(async () => {
      // Simulate the agent registering DURING session creation
      // This should happen while createTeamMemberSession is running
      const updatedTeam = {
        ...mockTeam,
        members: [
          {
            ...mockTeam.members[0],
            agentStatus: 'active' as 'active', // Agent registered!
            sessionName: 'test-team-alice-member-1',
            readyAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      };

      // Update the mock to return the updated team (simulating concurrent registration)
      mockStorageService.getTeams.mockResolvedValue([updatedTeam]);

      return {
        success: true,
        sessionName: 'test-team-alice-member-1'
      };
    });

    // Track all team saves
    mockStorageService.saveTeam
      .mockImplementationOnce((team: Team) => {
        teamAfterStart = team;
        return Promise.resolve();
      })
      .mockImplementationOnce((team: Team) => {
        teamAfterSessionComplete = team;
        return Promise.resolve();
      });

    // Call startTeamMember
    mockRequest.params = { teamId: 'team-123', memberId: 'member-1' };
    mockRequest.body = {};

    await teamsHandlers.startTeamMember.call(
      mockApiContext,
      mockRequest as Request,
      mockResponse as Response
    );

    // Verify the race condition is handled correctly:
    // 1. Initial status should be 'activating'
    expect(teamAfterStart).toBeDefined();
    expect(teamAfterStart!.members[0].agentStatus).toBe('activating');

    // 2. After session creation completes, status should be preserved as 'active'
    // (not overwritten back to 'activating')
    expect(teamAfterSessionComplete).toBeDefined();
    expect(teamAfterSessionComplete!.members[0].agentStatus).toBe('active');
    expect(teamAfterSessionComplete!.members[0].sessionName).toBe('test-team-alice-member-1');

    // 3. API response should reflect current 'active' status, not the old 'activating'
    expect(responseMock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          status: 'active' // Should return current status, not 'activating'
        })
      })
    );

    // 4. Verify the fix: getTeams was called again to get fresh state
    expect(mockStorageService.getTeams).toHaveBeenCalledTimes(2); // Once initially, once to re-fetch
  });
});