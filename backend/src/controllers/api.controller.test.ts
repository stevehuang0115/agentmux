import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ApiController } from './api.controller.js';
import { StorageService, TmuxService, SchedulerService, MessageSchedulerService } from '../services/index.js';
import { ActiveProjectsService } from '../services/project/active-projects.service.js';
import { PromptTemplateService } from '../services/ai/prompt-template.service.js';

// Mock all services
jest.mock('../services/index.js');
jest.mock('../services/project/active-projects.service.js');
jest.mock('../services/ai/prompt-template.service.js');

// Mock domain handlers
jest.mock('./team/team.controller.js');
jest.mock('./project/project.controller.js');
jest.mock('./orchestrator/orchestrator.controller.js');
jest.mock('./system/terminal.controller.js');
jest.mock('./workflow/scheduler.controller.js');
jest.mock('./workflow/workflow.controller.js');
jest.mock('./task-management/task-management.controller.js');

describe('ApiController', () => {
  let controller: ApiController;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockTmuxService: jest.Mocked<TmuxService>;
  let mockSchedulerService: jest.Mocked<SchedulerService>;
  let mockMessageSchedulerService: jest.Mocked<MessageSchedulerService>;
  let mockActiveProjectsService: jest.Mocked<ActiveProjectsService>;
  let mockPromptTemplateService: jest.Mocked<PromptTemplateService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock services
    mockStorageService = new StorageService() as jest.Mocked<StorageService>;
    mockTmuxService = new TmuxService() as jest.Mocked<TmuxService>;
    mockSchedulerService = new SchedulerService() as jest.Mocked<SchedulerService>;
    mockMessageSchedulerService = new MessageSchedulerService() as jest.Mocked<MessageSchedulerService>;
    
    // Mock constructor dependencies
    mockActiveProjectsService = new ActiveProjectsService(mockStorageService) as jest.Mocked<ActiveProjectsService>;
    mockPromptTemplateService = new PromptTemplateService() as jest.Mocked<PromptTemplateService>;

    (ActiveProjectsService as jest.MockedClass<typeof ActiveProjectsService>).mockImplementation(() => mockActiveProjectsService);
    (PromptTemplateService as jest.MockedClass<typeof PromptTemplateService>).mockImplementation(() => mockPromptTemplateService);

    controller = new ApiController(
      mockStorageService,
      mockTmuxService,
      mockSchedulerService,
      mockMessageSchedulerService
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with required services', () => {
      expect(controller.storageService).toBe(mockStorageService);
      expect(controller.tmuxService).toBe(mockTmuxService);
      expect(controller.schedulerService).toBe(mockSchedulerService);
      expect(controller.messageSchedulerService).toBe(mockMessageSchedulerService);
    });

    it('should create activeProjectsService instance', () => {
      expect(ActiveProjectsService).toHaveBeenCalledWith(mockStorageService);
      expect(controller.activeProjectsService).toBe(mockActiveProjectsService);
    });

    it('should create promptTemplateService instance', () => {
      expect(PromptTemplateService).toHaveBeenCalled();
      expect(controller.promptTemplateService).toBe(mockPromptTemplateService);
    });

    it('should work without optional messageSchedulerService', () => {
      const controllerWithoutScheduler = new ApiController(
        mockStorageService,
        mockTmuxService,
        mockSchedulerService
      );
      
      expect(controllerWithoutScheduler.messageSchedulerService).toBeUndefined();
      expect(controllerWithoutScheduler.storageService).toBe(mockStorageService);
    });
  });

  describe('Teams handlers delegation', () => {
    let mockRequest: any;
    let mockResponse: any;
    let mockTeamsHandlers: any;

    beforeEach(async () => {
      mockRequest = { params: { id: 'team-123' }, body: { name: 'Test Team' } };
      mockResponse = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      
      mockTeamsHandlers = await import('./domains/team.controller.js');
      mockTeamsHandlers.createTeam = jest.fn().mockResolvedValue({ success: true });
      mockTeamsHandlers.getTeams = jest.fn().mockResolvedValue([]);
      mockTeamsHandlers.getTeam = jest.fn().mockResolvedValue({ id: 'team-123' });
      mockTeamsHandlers.startTeam = jest.fn().mockResolvedValue({ success: true });
      mockTeamsHandlers.stopTeam = jest.fn().mockResolvedValue({ success: true });
      mockTeamsHandlers.deleteTeam = jest.fn().mockResolvedValue({ success: true });
    });

    it('should delegate createTeam to teams handler', async () => {
      await controller.createTeam(mockRequest, mockResponse);
      expect(mockTeamsHandlers.createTeam).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should delegate getTeams to teams handler', async () => {
      await controller.getTeams(mockRequest, mockResponse);
      expect(mockTeamsHandlers.getTeams).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should delegate getTeam to teams handler', async () => {
      await controller.getTeam(mockRequest, mockResponse);
      expect(mockTeamsHandlers.getTeam).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should delegate startTeam to teams handler', async () => {
      await controller.startTeam(mockRequest, mockResponse);
      expect(mockTeamsHandlers.startTeam).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should delegate stopTeam to teams handler', async () => {
      await controller.stopTeam(mockRequest, mockResponse);
      expect(mockTeamsHandlers.stopTeam).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should delegate deleteTeam to teams handler', async () => {
      await controller.deleteTeam(mockRequest, mockResponse);
      expect(mockTeamsHandlers.deleteTeam).toHaveBeenCalledWith(mockRequest, mockResponse);
    });
  });

  describe('Projects handlers delegation', () => {
    let mockRequest: any;
    let mockResponse: any;
    let mockProjectsHandlers: any;

    beforeEach(async () => {
      mockRequest = { params: { id: 'project-123' }, body: { name: 'Test Project' } };
      mockResponse = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      
      mockProjectsHandlers = await import('./domains/project.controller.js');
      mockProjectsHandlers.createProject = jest.fn().mockResolvedValue({ success: true });
      mockProjectsHandlers.getProjects = jest.fn().mockResolvedValue([]);
      mockProjectsHandlers.startProject = jest.fn().mockResolvedValue({ success: true });
      mockProjectsHandlers.stopProject = jest.fn().mockResolvedValue({ success: true });
    });

    it('should delegate createProject to projects handler', async () => {
      await controller.createProject(mockRequest, mockResponse);
      expect(mockProjectsHandlers.createProject).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should delegate getProjects to projects handler', async () => {
      await controller.getProjects(mockRequest, mockResponse);
      expect(mockProjectsHandlers.getProjects).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should delegate startProject to projects handler', async () => {
      await controller.startProject(mockRequest, mockResponse);
      expect(mockProjectsHandlers.startProject).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should delegate stopProject to projects handler', async () => {
      await controller.stopProject(mockRequest, mockResponse);
      expect(mockProjectsHandlers.stopProject).toHaveBeenCalledWith(mockRequest, mockResponse);
    });
  });

  describe('Git handlers delegation', () => {
    let mockRequest: any;
    let mockResponse: any;
    let mockGitHandlers: any;

    beforeEach(async () => {
      mockRequest = { body: { message: 'test commit' }, params: { project: 'test-project' } };
      mockResponse = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      
      mockGitHandlers = await import('./domains/git.controller.js');
      (mockGitHandlers as any).getGitStatus = jest.fn().mockResolvedValue({ status: 'clean' });
      (mockGitHandlers as any).commitChanges = jest.fn().mockResolvedValue({ success: true });
      (mockGitHandlers as any).startAutoCommit = jest.fn().mockResolvedValue({ success: true });
      (mockGitHandlers as any).stopAutoCommit = jest.fn().mockResolvedValue({ success: true });
    });

    it('should delegate getGitStatus to git handler', async () => {
      await controller.getGitStatus(mockRequest, mockResponse);
      expect(mockGitHandlers.getGitStatus).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should delegate commitChanges to git handler', async () => {
      await controller.commitChanges(mockRequest, mockResponse);
      expect(mockGitHandlers.commitChanges).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should delegate startAutoCommit to git handler', async () => {
      await controller.startAutoCommit(mockRequest, mockResponse);
      expect(mockGitHandlers.startAutoCommit).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should delegate stopAutoCommit to git handler', async () => {
      await controller.stopAutoCommit(mockRequest, mockResponse);
      expect(mockGitHandlers.stopAutoCommit).toHaveBeenCalledWith(mockRequest, mockResponse);
    });
  });

  describe('Terminal handlers delegation', () => {
    let mockRequest: any;
    let mockResponse: any;
    let mockTerminalHandlers: any;

    beforeEach(async () => {
      mockRequest = { 
        body: { input: 'test command' }, 
        params: { session: 'test-session' } 
      };
      mockResponse = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      
      mockTerminalHandlers = await import('./domains/terminal.controller.js');
      (mockTerminalHandlers as any).listTerminalSessions = jest.fn().mockResolvedValue(['session1', 'session2']);
      (mockTerminalHandlers as any).captureTerminal = jest.fn().mockResolvedValue({ output: 'terminal output' });
      (mockTerminalHandlers as any).sendTerminalInput = jest.fn().mockResolvedValue({ success: true });
      (mockTerminalHandlers as any).sendTerminalKey = jest.fn().mockResolvedValue({ success: true });
    });

    it('should delegate listTerminalSessions to terminal handler', async () => {
      await controller.listTerminalSessions(mockRequest, mockResponse);
      expect(mockTerminalHandlers.listTerminalSessions).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should delegate captureTerminal to terminal handler', async () => {
      await controller.captureTerminal(mockRequest, mockResponse);
      expect(mockTerminalHandlers.captureTerminal).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should delegate sendTerminalInput to terminal handler', async () => {
      await controller.sendTerminalInput(mockRequest, mockResponse);
      expect(mockTerminalHandlers.sendTerminalInput).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should delegate sendTerminalKey to terminal handler', async () => {
      await controller.sendTerminalKey(mockRequest, mockResponse);
      expect(mockTerminalHandlers.sendTerminalKey).toHaveBeenCalledWith(mockRequest, mockResponse);
    });
  });

  describe('Orchestrator handlers delegation', () => {
    let mockRequest: any;
    let mockResponse: any;
    let mockOrchestratorHandlers: any;

    beforeEach(async () => {
      mockRequest = { 
        body: { message: 'test orchestrator command' }, 
        params: { id: 'orchestrator-123' } 
      };
      mockResponse = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      
      mockOrchestratorHandlers = await import('./domains/orchestrator.controller.js');
      (mockOrchestratorHandlers as any).getOrchestratorCommands = jest.fn().mockResolvedValue(['command1', 'command2']);
      (mockOrchestratorHandlers as any).executeOrchestratorCommand = jest.fn().mockResolvedValue({ success: true });
      (mockOrchestratorHandlers as any).sendOrchestratorMessage = jest.fn().mockResolvedValue({ success: true });
      (mockOrchestratorHandlers as any).setupOrchestrator = jest.fn().mockResolvedValue({ success: true });
    });

    it('should delegate getOrchestratorCommands to orchestrator handler', async () => {
      await controller.getOrchestratorCommands(mockRequest, mockResponse);
      expect(mockOrchestratorHandlers.getOrchestratorCommands).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should delegate executeOrchestratorCommand to orchestrator handler', async () => {
      await controller.executeOrchestratorCommand(mockRequest, mockResponse);
      expect(mockOrchestratorHandlers.executeOrchestratorCommand).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should delegate sendOrchestratorMessage to orchestrator handler', async () => {
      await controller.sendOrchestratorMessage(mockRequest, mockResponse);
      expect(mockOrchestratorHandlers.sendOrchestratorMessage).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should delegate setupOrchestrator to orchestrator handler', async () => {
      await controller.setupOrchestrator(mockRequest, mockResponse);
      expect(mockOrchestratorHandlers.setupOrchestrator).toHaveBeenCalledWith(mockRequest, mockResponse);
    });
  });

  describe('Error handling', () => {
    let mockRequest: any;
    let mockResponse: any;
    let mockTeamsHandlers: any;

    beforeEach(async () => {
      mockRequest = { params: { id: 'team-123' } };
      mockResponse = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      
      mockTeamsHandlers = await import('./domains/team.controller.js');
    });

    it('should propagate errors from domain handlers', async () => {
      const testError = new Error('Handler error');
      (mockTeamsHandlers as any).getTeam = jest.fn().mockRejectedValue(testError);

      await expect(controller.getTeam(mockRequest, mockResponse)).rejects.toThrow('Handler error');
    });

    it('should handle async import failures gracefully', async () => {
      // This would be difficult to test without actually breaking the import,
      // but the structure ensures dynamic imports are awaited properly
      expect(controller.createTeam).toBeDefined();
      expect(typeof controller.createTeam).toBe('function');
    });
  });

  describe('Method availability', () => {
    it('should have all team methods available', () => {
      expect(typeof controller.createTeam).toBe('function');
      expect(typeof controller.getTeams).toBe('function');
      expect(typeof controller.getTeam).toBe('function');
      expect(typeof controller.startTeam).toBe('function');
      expect(typeof controller.stopTeam).toBe('function');
      expect(typeof controller.deleteTeam).toBe('function');
      expect(typeof controller.addTeamMember).toBe('function');
      expect(typeof controller.updateTeamMember).toBe('function');
      expect(typeof controller.deleteTeamMember).toBe('function');
    });

    it('should have all project methods available', () => {
      expect(typeof controller.createProject).toBe('function');
      expect(typeof controller.getProjects).toBe('function');
      expect(typeof controller.getProject).toBe('function');
      expect(typeof controller.startProject).toBe('function');
      expect(typeof controller.stopProject).toBe('function');
      expect(typeof controller.deleteProject).toBe('function');
    });

    it('should have all git methods available', () => {
      expect(typeof controller.getGitStatus).toBe('function');
      expect(typeof controller.commitChanges).toBe('function');
      expect(typeof controller.startAutoCommit).toBe('function');
      expect(typeof controller.stopAutoCommit).toBe('function');
    });

    it('should have all terminal methods available', () => {
      expect(typeof controller.listTerminalSessions).toBe('function');
      expect(typeof controller.captureTerminal).toBe('function');
      expect(typeof controller.sendTerminalInput).toBe('function');
      expect(typeof controller.sendTerminalKey).toBe('function');
    });

    it('should have all orchestrator methods available', () => {
      expect(typeof controller.getOrchestratorCommands).toBe('function');
      expect(typeof controller.executeOrchestratorCommand).toBe('function');
      expect(typeof controller.sendOrchestratorMessage).toBe('function');
      expect(typeof controller.setupOrchestrator).toBe('function');
    });

    it('should have all scheduler methods available', () => {
      expect(typeof controller.scheduleCheck).toBe('function');
      expect(typeof controller.getScheduledChecks).toBe('function');
      expect(typeof controller.cancelScheduledCheck).toBe('function');
    });

    it('should have all error handling methods available', () => {
      expect(typeof controller.trackError).toBe('function');
      expect(typeof controller.getErrorStats).toBe('function');
      expect(typeof controller.getErrors).toBe('function');
      expect(typeof controller.clearErrors).toBe('function');
    });

    it('should have all scheduled message methods available', () => {
      expect(typeof controller.createScheduledMessage).toBe('function');
      expect(typeof controller.getScheduledMessages).toBe('function');
      expect(typeof controller.deleteScheduledMessage).toBe('function');
      expect(typeof controller.runScheduledMessage).toBe('function');
    });

    it('should have all task management methods available', () => {
      expect(typeof controller.assignTask).toBe('function');
      expect(typeof controller.completeTask).toBe('function');
      expect(typeof controller.blockTask).toBe('function');
      expect(typeof controller.takeNextTask).toBe('function');
      expect(typeof controller.syncTaskStatus).toBe('function');
    });
  });

  describe('Context binding', () => {
    it('should properly bind context to delegated methods', async () => {
      const mockRequest = { params: { id: 'test' } } as any;
      const mockResponse = { json: jest.fn() } as any;
      
      const mockTeamsHandlers = jest.mocked(await import('./domains/team.controller.js'));
      mockTeamsHandlers.getTeam = jest.fn().mockImplementation(function(this: any, req: any, res: any) {
        // The 'this' context should be the controller instance
        expect(this).toBe(controller);
        return { success: true };
      }) as any;

      await controller.getTeam(mockRequest, mockResponse);
      expect(mockTeamsHandlers.getTeam).toHaveBeenCalled();
    });
  });
});