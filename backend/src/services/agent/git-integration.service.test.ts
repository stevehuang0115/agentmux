import { GitIntegrationService } from './git-integration.service';

describe('GitIntegrationService', () => {
  let gitService: GitIntegrationService;
  let testProjectPath: string;

  beforeEach(() => {
    testProjectPath = '/test/project/path';
    gitService = new GitIntegrationService(testProjectPath);
  });

  afterEach(() => {
    (gitService as any).cleanup();
  });

  describe('Configuration', () => {
    test('should initialize with correct project path and interval', () => {
      expect(gitService).toBeDefined();
      expect((gitService as any).projectPath).toBe(testProjectPath);
      expect((gitService as any).defaultCommitConfig.intervalMinutes).toBe(30);
    });

    test('should use default interval when not specified', () => {
      const defaultService = new GitIntegrationService(testProjectPath);
      expect((defaultService as any).defaultCommitConfig.intervalMinutes).toBe(30);
      (defaultService as any).cleanup();
    });
  });

  describe('Timer Management', () => {
    test('should start and stop auto-commit timer', async () => {
      jest.useFakeTimers();
      const loggerSpy = jest.spyOn((gitService as any).logger, 'info').mockImplementation();

      await gitService.startAutoCommitTimer(1);
      expect(loggerSpy).toHaveBeenCalledWith('Started scheduled commits', {
        projectPath: testProjectPath,
        intervalMinutes: 1
      });

      gitService.stopScheduledCommits(testProjectPath);
      expect(loggerSpy).toHaveBeenCalledWith('Stopped scheduled commits', { projectPath: testProjectPath });

      jest.useRealTimers();
      loggerSpy.mockRestore();
    });

    test('should clear existing timer when starting new one', async () => {
      jest.useFakeTimers();
      const loggerSpy = jest.spyOn((gitService as any).logger, 'info').mockImplementation();

      await gitService.startAutoCommitTimer(1);
      await gitService.startAutoCommitTimer(2); // Should clear the first timer

      expect(loggerSpy).toHaveBeenCalledWith('Started scheduled commits', {
        projectPath: testProjectPath,
        intervalMinutes: 2
      });

      jest.useRealTimers();
      loggerSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    test('should clean up resources on destroy', async () => {
      const loggerSpy = jest.spyOn((gitService as any).logger, 'info').mockImplementation();
      
      await gitService.startAutoCommitTimer(1);
      (gitService as any).cleanup();
      
      expect(loggerSpy).toHaveBeenCalledWith('Git integration cleanup complete');
      
      loggerSpy.mockRestore();
    });
  });
});