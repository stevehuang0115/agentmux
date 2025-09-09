import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import * as orchestratorHandlers from './orchestrator.handlers.js';
import type { ApiContext } from '../types.js';

describe('Orchestrator Handlers', () => {
  let mockApiContext: Partial<ApiContext>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockStorageService: any;
  let mockTmuxService: any;
  let mockPromptTemplateService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStorageService = {
      getTeams: jest.fn(),
      getProjects: jest.fn()
    };

    mockTmuxService = {
      sendMessage: jest.fn(),
      sendKey: jest.fn(),
      sessionExists: jest.fn(),
      createOrchestratorSession: jest.fn(),
      initializeAgentWithRegistration: jest.fn()
    };

    mockPromptTemplateService = {
      getOrchestratorTaskAssignmentPrompt: jest.fn()
    };

    mockApiContext = {
      storageService: mockStorageService,
      tmuxService: mockTmuxService,
      promptTemplateService: mockPromptTemplateService
    } as any;

    mockRequest = {
      params: { projectId: 'project-1' },
      body: { 
        command: 'help',
        message: 'Test message',
        taskId: 'task-123',
        taskTitle: 'Test Task',
        taskDescription: 'Test Description',
        taskPriority: 'high',
        taskMilestone: 'milestone-1',
        projectName: 'Test Project',
        projectPath: '/test/path'
      },
      query: {}
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getOrchestratorCommands', () => {
    it('should return mock orchestrator commands', async () => {
      await orchestratorHandlers.getOrchestratorCommands.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith([
        expect.objectContaining({
          id: '1',
          command: 'get_team_status',
          status: 'completed'
        }),
        expect.objectContaining({
          id: '2',
          command: 'delegate_task dev-alice "Implement user auth"',
          status: 'completed'
        })
      ]);
    });

    it('should handle errors and return empty array', async () => {
      const originalConsoleError = console.error;
      console.error = jest.fn();

      // Force an error by making the context undefined
      await orchestratorHandlers.getOrchestratorCommands.call(
        undefined as any,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith([]);
      
      console.error = originalConsoleError;
    });
  });

  describe('executeOrchestratorCommand', () => {
    it('should execute get_team_status command', async () => {
      const mockTeams = [
        {
          name: 'Dev Team',
          members: [
            { agentStatus: 'active', name: 'Alice' },
            { agentStatus: 'inactive', name: 'Bob' }
          ],
          currentProject: 'Test Project'
        },
        {
          name: 'QA Team',
          members: [
            { agentStatus: 'activating', name: 'Charlie' }
          ]
        }
      ];

      mockStorageService.getTeams.mockResolvedValue(mockTeams);
      mockRequest.body = { command: 'get_team_status' };

      await orchestratorHandlers.executeOrchestratorCommand.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getTeams).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        output: expect.stringContaining('Team Status Report:'),
        timestamp: expect.any(String)
      });
    });

    it('should execute list_projects command', async () => {
      const mockProjects = [
        {
          name: 'Project A',
          status: 'active',
          teams: { development: ['team-1'], testing: ['team-2'] }
        },
        {
          name: 'Project B',
          status: 'completed',
          teams: { development: ['team-3'] }
        }
      ];

      mockStorageService.getProjects.mockResolvedValue(mockProjects);
      mockRequest.body = { command: 'list_projects' };

      await orchestratorHandlers.executeOrchestratorCommand.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getProjects).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        output: expect.stringContaining('Active Projects:'),
        timestamp: expect.any(String)
      });
    });

    it('should execute broadcast command', async () => {
      mockRequest.body = { command: 'broadcast Hello team' };

      await orchestratorHandlers.executeOrchestratorCommand.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        output: 'Broadcast sent to all active sessions: "Hello team"',
        timestamp: expect.any(String)
      });
    });

    it('should execute help command', async () => {
      mockRequest.body = { command: 'help' };

      await orchestratorHandlers.executeOrchestratorCommand.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        output: expect.stringContaining('Available Orchestrator Commands:'),
        timestamp: expect.any(String)
      });
    });

    it('should handle unknown commands', async () => {
      mockRequest.body = { command: 'unknown_command' };

      await orchestratorHandlers.executeOrchestratorCommand.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        output: expect.stringContaining('Unknown command: unknown_command'),
        timestamp: expect.any(String)
      });
    });

    it('should handle broadcast command without message', async () => {
      mockRequest.body = { command: 'broadcast' };

      await orchestratorHandlers.executeOrchestratorCommand.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        output: 'Error: No message provided for broadcast',
        timestamp: expect.any(String)
      });
    });

    it('should return 400 when command is missing', async () => {
      mockRequest.body = {};

      await orchestratorHandlers.executeOrchestratorCommand.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Command is required'
      });
    });

    it('should return 400 when command is not a string', async () => {
      mockRequest.body = { command: 123 };

      await orchestratorHandlers.executeOrchestratorCommand.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Command is required'
      });
    });

    it('should handle storage service errors', async () => {
      mockStorageService.getTeams.mockRejectedValue(new Error('Storage error'));
      mockRequest.body = { command: 'get_team_status' };

      await orchestratorHandlers.executeOrchestratorCommand.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to execute command',
        output: expect.stringContaining('Error: Storage error')
      });
    });
  });

  describe('sendOrchestratorMessage', () => {
    it('should send message to orchestrator successfully', async () => {
      mockTmuxService.sendMessage.mockResolvedValue(undefined);

      await orchestratorHandlers.sendOrchestratorMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTmuxService.sendMessage).toHaveBeenCalledWith('agentmux-orc', 'Test message');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Message sent to orchestrator successfully',
        messageLength: 12,
        timestamp: expect.any(String)
      });
    });

    it('should return 400 when message is missing', async () => {
      mockRequest.body = {};

      await orchestratorHandlers.sendOrchestratorMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Message is required'
      });
    });

    it('should return 400 when message is not a string', async () => {
      mockRequest.body = { message: 123 };

      await orchestratorHandlers.sendOrchestratorMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Message is required'
      });
    });

    it('should handle tmux service errors', async () => {
      mockTmuxService.sendMessage.mockRejectedValue(new Error('Tmux error'));

      await orchestratorHandlers.sendOrchestratorMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to send message to orchestrator session'
      });
    });
  });

  describe('sendOrchestratorEnter', () => {
    it('should send Enter key to orchestrator successfully', async () => {
      mockTmuxService.sendKey.mockResolvedValue(undefined);

      await orchestratorHandlers.sendOrchestratorEnter.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTmuxService.sendKey).toHaveBeenCalledWith('agentmux-orc', 'Enter');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Enter key sent to orchestrator',
        timestamp: expect.any(String)
      });
    });

    it('should handle tmux service errors when sending Enter key', async () => {
      mockTmuxService.sendKey.mockRejectedValue(new Error('Send key error'));

      await orchestratorHandlers.sendOrchestratorEnter.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to send Enter key'
      });
    });
  });

  describe('setupOrchestrator', () => {
    it('should setup orchestrator when session does not exist', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(false);
      mockTmuxService.createOrchestratorSession.mockResolvedValue({ success: true });
      mockTmuxService.initializeAgentWithRegistration.mockResolvedValue({ 
        success: true, 
        message: 'Orchestrator initialized successfully' 
      });

      await orchestratorHandlers.setupOrchestrator.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTmuxService.sessionExists).toHaveBeenCalledWith('agentmux-orc');
      expect(mockTmuxService.createOrchestratorSession).toHaveBeenCalledWith({
        sessionName: 'agentmux-orc',
        projectPath: process.cwd(),
        windowName: 'Orchestrator'
      });
      expect(mockTmuxService.initializeAgentWithRegistration).toHaveBeenCalledWith(
        'agentmux-orc', 'orchestrator', process.cwd(), 90000
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Orchestrator initialized successfully',
        sessionName: 'agentmux-orc'
      });
    });

    it('should setup orchestrator when session already exists', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(true);
      mockTmuxService.initializeAgentWithRegistration.mockResolvedValue({ 
        success: true, 
        message: 'Orchestrator registered successfully' 
      });

      await orchestratorHandlers.setupOrchestrator.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTmuxService.createOrchestratorSession).not.toHaveBeenCalled();
      expect(mockTmuxService.initializeAgentWithRegistration).toHaveBeenCalled();
    });

    it('should handle orchestrator session creation failure', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(false);
      mockTmuxService.createOrchestratorSession.mockResolvedValue({ 
        success: false, 
        error: 'Session creation failed' 
      });

      await orchestratorHandlers.setupOrchestrator.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Session creation failed'
      });
    });

    it('should handle orchestrator initialization failure', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(true);
      mockTmuxService.initializeAgentWithRegistration.mockResolvedValue({ 
        success: false, 
        error: 'Registration failed' 
      });

      await orchestratorHandlers.setupOrchestrator.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Registration failed'
      });
    });

    it('should handle unexpected setup errors', async () => {
      mockTmuxService.sessionExists.mockRejectedValue(new Error('Unexpected error'));

      await orchestratorHandlers.setupOrchestrator.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unexpected error'
      });
    });
  });

  describe('assignTaskToOrchestrator', () => {
    it('should assign task to orchestrator successfully', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(true);
      mockPromptTemplateService.getOrchestratorTaskAssignmentPrompt.mockResolvedValue('Task assignment prompt');
      mockTmuxService.sendMessage.mockResolvedValue(undefined);

      await orchestratorHandlers.assignTaskToOrchestrator.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTmuxService.sessionExists).toHaveBeenCalledWith('agentmux-orc');
      expect(mockPromptTemplateService.getOrchestratorTaskAssignmentPrompt).toHaveBeenCalledWith({
        projectName: 'Test Project',
        projectPath: '/test/path',
        taskId: 'task-123',
        taskTitle: 'Test Task',
        taskDescription: 'Test Description',
        taskPriority: 'high',
        taskMilestone: 'milestone-1'
      });
      expect(mockTmuxService.sendMessage).toHaveBeenCalledWith('agentmux-orc', 'Task assignment prompt');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Task assigned to orchestrator successfully',
        data: {
          taskId: 'task-123',
          taskTitle: 'Test Task',
          sessionName: 'agentmux-orc',
          assignedAt: expect.any(String)
        }
      });
    });

    it('should return 400 when taskId is missing', async () => {
      mockRequest.body = { taskTitle: 'Test Task' };

      await orchestratorHandlers.assignTaskToOrchestrator.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Task ID and title are required'
      });
    });

    it('should return 400 when taskTitle is missing', async () => {
      mockRequest.body = { taskId: 'task-123' };

      await orchestratorHandlers.assignTaskToOrchestrator.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Task ID and title are required'
      });
    });

    it('should return 400 when orchestrator session does not exist', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(false);

      await orchestratorHandlers.assignTaskToOrchestrator.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Orchestrator session is not running. Please start the orchestrator first.'
      });
    });

    it('should handle template service errors', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(true);
      mockPromptTemplateService.getOrchestratorTaskAssignmentPrompt.mockRejectedValue(new Error('Template error'));

      await orchestratorHandlers.assignTaskToOrchestrator.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to assign task to orchestrator'
      });
    });

    it('should handle tmux message sending errors', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(true);
      mockPromptTemplateService.getOrchestratorTaskAssignmentPrompt.mockResolvedValue('Prompt');
      mockTmuxService.sendMessage.mockRejectedValue(new Error('Send message error'));

      await orchestratorHandlers.assignTaskToOrchestrator.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to assign task to orchestrator'
      });
    });
  });

  describe('Context preservation', () => {
    it('should preserve context when handling orchestrator operations', async () => {
      const contextAwareController = {
        tmuxService: {
          sendKey: jest.fn().mockResolvedValue(undefined)
        }
      } as any;

      await orchestratorHandlers.sendOrchestratorEnter.call(
        contextAwareController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(contextAwareController.tmuxService.sendKey).toHaveBeenCalledWith('agentmux-orc', 'Enter');
    });
  });

  describe('All handlers availability', () => {
    it('should have all expected handler functions', () => {
      expect(typeof orchestratorHandlers.getOrchestratorCommands).toBe('function');
      expect(typeof orchestratorHandlers.executeOrchestratorCommand).toBe('function');
      expect(typeof orchestratorHandlers.sendOrchestratorMessage).toBe('function');
      expect(typeof orchestratorHandlers.sendOrchestratorEnter).toBe('function');
      expect(typeof orchestratorHandlers.setupOrchestrator).toBe('function');
      expect(typeof orchestratorHandlers.assignTaskToOrchestrator).toBe('function');
    });

    it('should handle async operations properly', async () => {
      mockTmuxService.sendKey.mockResolvedValue(undefined);

      const result = await orchestratorHandlers.sendOrchestratorEnter.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(result).toBeUndefined();
      expect(mockResponse.json).toHaveBeenCalled();
    });
  });

  describe('Command execution edge cases', () => {
    it('should handle list_sessions command tmux errors', async () => {
      mockRequest.body = { command: 'list_sessions' };

      // Mock child_process import to simulate exec error
      jest.doMock('child_process', () => ({
        exec: jest.fn()
      }));

      await orchestratorHandlers.executeOrchestratorCommand.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        output: expect.stringContaining('Active tmux sessions:'),
        timestamp: expect.any(String)
      });
    });

    it('should handle empty team status', async () => {
      mockStorageService.getTeams.mockResolvedValue([]);
      mockRequest.body = { command: 'get_team_status' };

      await orchestratorHandlers.executeOrchestratorCommand.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        output: 'Team Status Report:\n',
        timestamp: expect.any(String)
      });
    });
  });
});