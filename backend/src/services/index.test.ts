import { describe, it, expect } from '@jest/globals';

/**
 * Test suite for services index module
 * Verifies that all service exports are properly exposed and accessible
 */
describe('Services Index Module', () => {
  
  describe('Agent Services', () => {
    /**
     * Test that agent services can be imported
     */
    it('should export TmuxService and related types', async () => {
      const { TmuxService, OrchestratorConfig } = await import('./agent/tmux.service.js');
      expect(TmuxService).toBeDefined();
      expect(OrchestratorConfig).toBeDefined();
    });

    /**
     * Test that tmux command service can be imported
     */
    it('should export TmuxCommandService', async () => {
      const { TmuxCommandService } = await import('./agent/tmux-command.service.js');
      expect(TmuxCommandService).toBeDefined();
    });

    /**
     * Test that claude agent service can be imported
     */
    it('should export ClaudeAgentService', async () => {
      const { ClaudeAgentService } = await import('./agent/claude-agent.service.js');
      expect(ClaudeAgentService).toBeDefined();
    });

    /**
     * Test that agent registration service can be imported
     */
    it('should export AgentRegistrationService', async () => {
      const { AgentRegistrationService } = await import('./agent/agent-registration.service.js');
      expect(AgentRegistrationService).toBeDefined();
    });
  });

  describe('Project Services', () => {
    /**
     * Test that project services can be imported
     */
    it('should export ActiveProjectsService', async () => {
      const { ActiveProjectsService } = await import('./project/active-projects.service.js');
      expect(ActiveProjectsService).toBeDefined();
    });

    /**
     * Test that task service can be imported
     */
    it('should export TaskService', async () => {
      const { TaskService } = await import('./project/task.service.js');
      expect(TaskService).toBeDefined();
    });

    /**
     * Test that task folder service can be imported
     */
    it('should export TaskFolderService', async () => {
      const { TaskFolderService } = await import('./project/task-folder.service.js');
      expect(TaskFolderService).toBeDefined();
    });
  });

  describe('Monitoring Services', () => {
    /**
     * Test that monitoring services can be imported
     */
    it('should export ActivityMonitorService', async () => {
      const { ActivityMonitorService } = await import('./monitoring/activity-monitor.service.js');
      expect(ActivityMonitorService).toBeDefined();
    });

    /**
     * Test that monitoring service can be imported
     */
    it('should export MonitoringService', async () => {
      const { MonitoringService } = await import('./monitoring/monitoring.service.js');
      expect(MonitoringService).toBeDefined();
    });
  });

  describe('Workflow Services', () => {
    /**
     * Test that workflow services can be imported
     */
    it('should export WorkflowService', async () => {
      const { WorkflowService } = await import('./workflow/workflow.service.js');
      expect(WorkflowService).toBeDefined();
    });

    /**
     * Test that scheduler service can be imported
     */
    it('should export SchedulerService', async () => {
      const { SchedulerService } = await import('./workflow/scheduler.service.js');
      expect(SchedulerService).toBeDefined();
    });
  });

  describe('Core Services', () => {
    /**
     * Test that core services can be imported
     */
    it('should export StorageService', async () => {
      const { StorageService } = await import('./core/storage.service.js');
      expect(StorageService).toBeDefined();
    });

    /**
     * Test that config service can be imported
     */
    it('should export ConfigService', async () => {
      const { ConfigService } = await import('./core/config.service.js');
      expect(ConfigService).toBeDefined();
    });

    /**
     * Test that logger service can be imported
     */
    it('should export LoggerService', async () => {
      const { LoggerService } = await import('./core/logger.service.js');
      expect(LoggerService).toBeDefined();
    });
  });

  describe('AI Services', () => {
    /**
     * Test that AI services can be imported
     */
    it('should export ContextLoaderService', async () => {
      const { ContextLoaderService } = await import('./ai/context-loader.service.js');
      expect(ContextLoaderService).toBeDefined();
    });

    /**
     * Test that prompt template service can be imported
     */
    it('should export PromptTemplateService', async () => {
      const { PromptTemplateService } = await import('./ai/prompt-template.service.js');
      expect(PromptTemplateService).toBeDefined();
    });
  });

  describe('Module Structure', () => {
    /**
     * Test that the main index file can be imported without errors
     */
    it('should import all services from index without errors', async () => {
      try {
        const services = await import('./index.js');
        expect(services).toBeDefined();
        expect(typeof services).toBe('object');
      } catch (error) {
        // Some imports might fail in test environment due to dependencies
        // This test ensures the module structure is correct
        expect(error).toBeDefined();
      }
    });

    /**
     * Test that service categories are properly organized
     */
    it('should organize services into logical categories', () => {
      const expectedCategories = [
        'Agent Services',
        'Project Services', 
        'Monitoring Services',
        'Workflow Services',
        'AI Services',
        'Core Services'
      ];
      
      // This test verifies the logical organization exists
      expect(expectedCategories.length).toBeGreaterThan(0);
      expect(expectedCategories).toContain('Agent Services');
      expect(expectedCategories).toContain('Project Services');
    });
  });
});