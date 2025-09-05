import { WorkflowService } from '../../backend/src/services/workflow.service.js';
import { TmuxService } from '../../backend/src/services/tmux.service.js';
import { StorageService } from '../../backend/src/services/storage.service.js';

// Mock dependencies
jest.mock('../../backend/src/services/tmux.service.js');
jest.mock('../../backend/src/services/storage.service.js');
jest.mock('../../backend/src/services/logger.service.js', () => ({
  LoggerService: {
    getInstance: jest.fn(() => ({
      createComponentLogger: jest.fn(() => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      }))
    }))
  }
}));

describe('WorkflowService', () => {
  let workflowService: WorkflowService;
  let mockTmuxService: jest.Mocked<TmuxService>;
  let mockStorageService: jest.Mocked<StorageService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the WorkflowService singleton for each test
    (WorkflowService as any).instance = undefined;
    
    // Get the mock constructors
    const MockedTmuxService = TmuxService as jest.MockedClass<typeof TmuxService>;
    const MockedStorageService = StorageService as jest.MockedClass<typeof StorageService>;
    
    // Create mock instances
    mockTmuxService = {
      sessionExists: jest.fn(),
      createOrchestratorSession: jest.fn(),
      initializeOrchestrator: jest.fn(),
      sendProjectStartPrompt: jest.fn(),
      createSession: jest.fn(),
      killSession: jest.fn(),
      sendCommand: jest.fn(),
      captureOutput: jest.fn(),
      resize: jest.fn(),
    } as unknown as jest.Mocked<TmuxService>;

    mockStorageService = {
      getProjects: jest.fn(),
      getTeams: jest.fn(),
      saveProject: jest.fn(),
      saveTeam: jest.fn(),
    } as unknown as jest.Mocked<StorageService>;
    
    // Mock the constructors to return our mock instances
    MockedTmuxService.mockImplementation(() => mockTmuxService);
    MockedStorageService.mockImplementation(() => mockStorageService);
    
    workflowService = WorkflowService.getInstance();
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance', () => {
      const instance1 = WorkflowService.getInstance();
      const instance2 = WorkflowService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Project Start Workflow', () => {
    const mockProject = {
      id: 'project-1',
      name: 'Test Project',
      path: '/test/project',
      teams: {},
      status: 'active' as const,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    const mockTeam = {
      id: 'team-1',
      name: 'Frontend Team',
      members: [
        {
          id: 'member-1',
          name: 'John Doe',
          sessionName: 'john_doe',
          role: 'developer' as const,
          systemPrompt: 'You are a frontend developer',
          status: 'idle' as const,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ],
      status: 'idle' as const,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    beforeEach(() => {
      mockStorageService.getProjects.mockResolvedValue([mockProject]);
      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
    });

    test('should successfully start project workflow', async () => {
      // Mock tmux service responses
      mockTmuxService.sessionExists.mockResolvedValue(false);
      mockTmuxService.createOrchestratorSession.mockResolvedValue({
        success: true,
        sessionName: 'agentmux-orc',
        message: 'Session created'
      });
      mockTmuxService.initializeOrchestrator.mockResolvedValue({
        success: true,
        message: 'Claude initialized'
      });
      mockTmuxService.sendProjectStartPrompt.mockResolvedValue({
        success: true,
        message: 'Prompt sent'
      });

      const result = await workflowService.startProject({
        projectId: 'project-1',
        teamId: 'team-1'
      });

      expect(result.success).toBe(true);
      expect(result.executionId).toBeDefined();
      expect(result.message).toBe('Project start workflow initiated');

      // Verify execution is tracked
      const execution = workflowService.getExecution(result.executionId);
      expect(execution).toBeDefined();
      expect(execution?.projectId).toBe('project-1');
      expect(execution?.teamId).toBe('team-1');
    });

    test('should fail when project not found', async () => {
      mockStorageService.getProjects.mockResolvedValue([]);

      const result = await workflowService.startProject({
        projectId: 'nonexistent',
        teamId: 'team-1'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found: nonexistent');
    });

    test('should fail when team not found', async () => {
      mockStorageService.getTeams.mockResolvedValue([]);

      const result = await workflowService.startProject({
        projectId: 'project-1',
        teamId: 'nonexistent'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Team not found: nonexistent');
    });

    test('should handle orchestrator session creation failure', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(false);
      mockTmuxService.createOrchestratorSession.mockResolvedValue({
        success: false,
        sessionName: 'agentmux-orc',
        error: 'Failed to create session'
      });

      const result = await workflowService.startProject({
        projectId: 'project-1',
        teamId: 'team-1'
      });

      expect(result.success).toBe(true); // Workflow starts but will fail during execution
      
      // Wait for workflow to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const execution = workflowService.getExecution(result.executionId);
      expect(execution?.status).toBe('failed');
    });

    test('should handle Claude initialization timeout', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(false);
      mockTmuxService.createOrchestratorSession.mockResolvedValue({
        success: true,
        sessionName: 'agentmux-orc',
        message: 'Session created'
      });
      mockTmuxService.initializeOrchestrator.mockResolvedValue({
        success: false,
        error: 'Timeout waiting for Claude to initialize (45000ms)'
      });

      const result = await workflowService.startProject({
        projectId: 'project-1',
        teamId: 'team-1'
      });

      expect(result.success).toBe(true);
      
      // Wait for workflow to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const execution = workflowService.getExecution(result.executionId);
      expect(execution?.status).toBe('failed');
      
      const failedStep = execution?.steps.find(s => s.id === 'initialize_claude');
      expect(failedStep?.status).toBe('failed');
      expect(failedStep?.error).toContain('Timeout waiting for Claude');
    });
  });

  describe('Workflow Execution Management', () => {
    test('should track active executions', () => {
      const executions = workflowService.getActiveExecutions();
      expect(Array.isArray(executions)).toBe(true);
    });

    test('should return null for non-existent execution', () => {
      const execution = workflowService.getExecution('nonexistent');
      expect(execution).toBe(null);
    });

    test('should cancel running workflow', async () => {
      // Start a workflow first
      mockStorageService.getProjects.mockResolvedValue([{
        id: 'project-1',
        name: 'Test Project',
        path: '/test/project',
        teams: {},
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }]);
      mockStorageService.getTeams.mockResolvedValue([{
        id: 'team-1',
        name: 'Test Team',
        members: [],
        status: 'idle',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }]);
      
      mockTmuxService.sessionExists.mockResolvedValue(false);
      mockTmuxService.createOrchestratorSession.mockResolvedValue({
        success: true,
        sessionName: 'agentmux-orc',
        message: 'Session created'
      });

      const startResult = await workflowService.startProject({
        projectId: 'project-1',
        teamId: 'team-1'
      });

      expect(startResult.success).toBe(true);

      // Cancel the workflow
      const cancelResult = await workflowService.cancelExecution(startResult.executionId);
      expect(cancelResult).toBe(true);

      // Verify execution is marked as failed
      const execution = workflowService.getExecution(startResult.executionId);
      expect(execution?.status).toBe('failed');
    });

    test('should return false when cancelling non-existent workflow', async () => {
      const result = await workflowService.cancelExecution('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('Workflow Steps', () => {
    test('should create proper workflow steps', async () => {
      mockStorageService.getProjects.mockResolvedValue([{
        id: 'project-1',
        name: 'Test Project',
        path: '/test/project',
        teams: {},
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }]);
      mockStorageService.getTeams.mockResolvedValue([{
        id: 'team-1',
        name: 'Test Team',
        members: [],
        status: 'idle',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }]);

      mockTmuxService.sessionExists.mockResolvedValue(false);

      const result = await workflowService.startProject({
        projectId: 'project-1',
        teamId: 'team-1'
      });

      const execution = workflowService.getExecution(result.executionId);
      expect(execution?.steps).toHaveLength(6);

      const stepIds = execution?.steps.map(s => s.id);
      expect(stepIds).toEqual([
        'check_orchestrator',
        'create_orchestrator', 
        'initialize_claude',
        'create_team_sessions',
        'send_project_prompt',
        'monitor_setup'
      ]);

      // Steps should have proper timestamps and status (first step may be running if workflow started)
      execution?.steps.forEach(step => {
        expect(step.status).toMatch(/^(pending|running)$/);
        expect(step.timestamp).toBeInstanceOf(Date);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle storage service errors gracefully', async () => {
      mockStorageService.getProjects.mockRejectedValue(new Error('Storage error'));

      const result = await workflowService.startProject({
        projectId: 'project-1',
        teamId: 'team-1'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage error');
    });

    test('should handle tmux service errors during workflow execution', async () => {
      mockStorageService.getProjects.mockResolvedValue([{
        id: 'project-1',
        name: 'Test Project',
        path: '/test/project',
        teams: {},
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }]);
      mockStorageService.getTeams.mockResolvedValue([{
        id: 'team-1',
        name: 'Test Team',
        members: [],
        status: 'idle',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }]);

      mockTmuxService.sessionExists.mockRejectedValue(new Error('Tmux not available'));

      const result = await workflowService.startProject({
        projectId: 'project-1',
        teamId: 'team-1'
      });

      expect(result.success).toBe(true); // Workflow starts
      
      // Wait for workflow to fail
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const execution = workflowService.getExecution(result.executionId);
      expect(execution?.status).toBe('failed');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources on shutdown', () => {
      expect(() => workflowService.shutdown()).not.toThrow();
    });
  });
});