import { FileWatcherController } from './file-watcher.controller';
import { FileWatcherService } from '../services/file-watcher.service';
import { GitIntegrationService } from '../services/git-integration.service';
import { LoggerService } from '../services/logger.service';
import { StorageService } from '../services/storage.service';
import { Request, Response } from 'express';

// Mock dependencies
jest.mock('../services/file-watcher.service');
jest.mock('../services/git-integration.service');
jest.mock('../services/logger.service');
jest.mock('../services/storage.service');

describe('FileWatcherController', () => {
  let controller: FileWatcherController;
  let mockFileWatcher: jest.Mocked<FileWatcherService>;
  let mockGitIntegration: jest.Mocked<GitIntegrationService>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockStorage: jest.Mocked<StorageService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    mockFileWatcher = {
      watchProject: jest.fn(),
      stopWatchingProject: jest.fn(),
      getStats: jest.fn(),
      getWatchedProjects: jest.fn(),
      watchAllProjects: jest.fn()
    } as any;

    mockGitIntegration = {
      getGitStatus: jest.fn(),
      commitChanges: jest.fn(),
      startScheduledCommits: jest.fn(),
      stopScheduledCommits: jest.fn(),
      getScheduledProjects: jest.fn()
    } as any;

    mockLogger = {
      error: jest.fn()
    } as any;

    mockStorage = {} as any;

    (FileWatcherService as jest.MockedClass<typeof FileWatcherService>).mockImplementation(() => mockFileWatcher);
    (GitIntegrationService as jest.MockedClass<typeof GitIntegrationService>).mockImplementation(() => mockGitIntegration);
    (LoggerService.getInstance as jest.Mock).mockReturnValue(mockLogger);
    (StorageService as jest.MockedClass<typeof StorageService>).mockImplementation(() => mockStorage);

    controller = new FileWatcherController();

    // Setup mock request and response
    mockReq = {
      params: {},
      body: {},
      query: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('constructor', () => {
    it('should initialize with required services', () => {
      expect(FileWatcherService).toHaveBeenCalled();
      expect(GitIntegrationService).toHaveBeenCalled();
      expect(LoggerService.getInstance).toHaveBeenCalled();
      expect(StorageService).toHaveBeenCalled();
    });
  });

  describe('startWatching', () => {
    beforeEach(() => {
      mockReq.params = { projectId: 'test-project' };
      mockReq.body = { projectPath: '/test/project' };
    });

    it('should start watching a project successfully', async () => {
      const mockStats = { totalWatched: 1, activeProjects: 1, eventsToday: 0, lastEvent: null };
      mockFileWatcher.watchProject.mockResolvedValue();
      mockFileWatcher.getStats.mockReturnValue(mockStats);

      await controller.startWatching(mockReq as Request, mockRes as Response);

      expect(mockFileWatcher.watchProject).toHaveBeenCalledWith('test-project', '/test/project');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Started watching project test-project',
        stats: mockStats
      });
    });

    it('should return 400 if project ID is missing', async () => {
      mockReq.params = {};

      await controller.startWatching(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Project ID and path are required'
      });
      expect(mockFileWatcher.watchProject).not.toHaveBeenCalled();
    });

    it('should return 400 if project path is missing', async () => {
      mockReq.body = {};

      await controller.startWatching(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Project ID and path are required'
      });
      expect(mockFileWatcher.watchProject).not.toHaveBeenCalled();
    });

    it('should handle errors and return 500', async () => {
      const error = new Error('Watch error');
      mockFileWatcher.watchProject.mockRejectedValue(error);

      await controller.startWatching(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to start watching project:', { error: 'Watch error' });
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to start watching project',
        details: 'Watch error'
      });
    });
  });

  describe('stopWatching', () => {
    beforeEach(() => {
      mockReq.params = { projectId: 'test-project' };
    });

    it('should stop watching a project successfully', async () => {
      const mockStats = { totalWatched: 0, activeProjects: 0, eventsToday: 5, lastEvent: null };
      mockFileWatcher.stopWatchingProject.mockResolvedValue();
      mockFileWatcher.getStats.mockReturnValue(mockStats);

      await controller.stopWatching(mockReq as Request, mockRes as Response);

      expect(mockFileWatcher.stopWatchingProject).toHaveBeenCalledWith('test-project');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Stopped watching project test-project',
        stats: mockStats
      });
    });

    it('should return 400 if project ID is missing', async () => {
      mockReq.params = {};

      await controller.stopWatching(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Project ID is required'
      });
      expect(mockFileWatcher.stopWatchingProject).not.toHaveBeenCalled();
    });

    it('should handle errors and return 500', async () => {
      const error = new Error('Stop watch error');
      mockFileWatcher.stopWatchingProject.mockRejectedValue(error);

      await controller.stopWatching(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to stop watching project:', { error: 'Stop watch error' });
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to stop watching project',
        details: 'Stop watch error'
      });
    });
  });

  describe('getStats', () => {
    it('should return file watcher statistics', async () => {
      const mockStats = { totalWatched: 3, activeProjects: 2, eventsToday: 15, lastEvent: new Date() };
      mockFileWatcher.getStats.mockReturnValue(mockStats);

      await controller.getStats(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats
      });
    });

    it('should handle errors and return 500', async () => {
      const error = new Error('Stats error');
      mockFileWatcher.getStats.mockImplementation(() => {
        throw error;
      });

      await controller.getStats(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get watcher stats:', { error: 'Stats error' });
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to get watcher stats',
        details: 'Stats error'
      });
    });
  });

  describe('getWatchedProjects', () => {
    it('should return list of watched projects', async () => {
      const mockProjects = ['project-1', 'project-2', 'project-3'];
      mockFileWatcher.getWatchedProjects.mockReturnValue(mockProjects);

      await controller.getWatchedProjects(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockProjects
      });
    });

    it('should handle errors and return 500', async () => {
      const error = new Error('Get watched projects error');
      mockFileWatcher.getWatchedProjects.mockImplementation(() => {
        throw error;
      });

      await controller.getWatchedProjects(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get watched projects:', { error: 'Get watched projects error' });
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to get watched projects',
        details: 'Get watched projects error'
      });
    });
  });

  describe('startWatchingAll', () => {
    it('should start watching all active projects', async () => {
      const mockStats = { totalWatched: 5, activeProjects: 5, eventsToday: 0, lastEvent: null };
      mockFileWatcher.watchAllProjects.mockResolvedValue();
      mockFileWatcher.getStats.mockReturnValue(mockStats);

      await controller.startWatchingAll(mockReq as Request, mockRes as Response);

      expect(mockFileWatcher.watchAllProjects).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Started watching all active projects',
        stats: mockStats
      });
    });

    it('should handle errors and return 500', async () => {
      const error = new Error('Watch all error');
      mockFileWatcher.watchAllProjects.mockRejectedValue(error);

      await controller.startWatchingAll(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to start watching all projects:', { error: 'Watch all error' });
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to start watching all projects',
        details: 'Watch all error'
      });
    });
  });

  describe('getGitStatus', () => {
    beforeEach(() => {
      mockReq.body = { projectPath: '/test/project' };
    });

    it('should get git status successfully', async () => {
      const mockGitStatus = { 
        hasChanges: true, 
        branch: 'main', 
        files: ['file1.js', 'file2.js'] 
      };
      mockGitIntegration.getGitStatus.mockResolvedValue(mockGitStatus);

      await controller.getGitStatus(mockReq as Request, mockRes as Response);

      expect(mockGitIntegration.getGitStatus).toHaveBeenCalledWith('/test/project');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockGitStatus
      });
    });

    it('should return 400 if project path is missing', async () => {
      mockReq.body = {};

      await controller.getGitStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Project path is required'
      });
      expect(mockGitIntegration.getGitStatus).not.toHaveBeenCalled();
    });

    it('should handle errors and return 500', async () => {
      const error = new Error('Git status error');
      mockGitIntegration.getGitStatus.mockRejectedValue(error);

      await controller.getGitStatus(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get git status:', { error: 'Git status error' });
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to get git status',
        details: 'Git status error'
      });
    });
  });

  describe('commitChanges', () => {
    beforeEach(() => {
      mockReq.body = { 
        projectPath: '/test/project',
        message: 'Test commit',
        autoGenerate: false,
        author: 'test@example.com'
      };
    });

    it('should commit changes successfully', async () => {
      mockGitIntegration.commitChanges.mockResolvedValue('commit-hash');

      await controller.commitChanges(mockReq as Request, mockRes as Response);

      expect(mockGitIntegration.commitChanges).toHaveBeenCalledWith('/test/project', {
        message: 'Test commit',
        autoGenerate: false,
        author: 'test@example.com'
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Changes committed successfully',
        data: { commitResult: 'commit-hash' }
      });
    });

    it('should handle no changes scenario', async () => {
      mockGitIntegration.commitChanges.mockResolvedValue('no-changes');

      await controller.commitChanges(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'No changes to commit',
        data: { commitResult: 'no-changes' }
      });
    });

    it('should return 400 if project path is missing', async () => {
      mockReq.body = { message: 'Test commit' };

      await controller.commitChanges(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Project path is required'
      });
      expect(mockGitIntegration.commitChanges).not.toHaveBeenCalled();
    });

    it('should handle errors and return 500', async () => {
      const error = new Error('Commit error');
      mockGitIntegration.commitChanges.mockRejectedValue(error);

      await controller.commitChanges(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to commit changes:', { error: 'Commit error' });
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to commit changes',
        details: 'Commit error'
      });
    });
  });

  describe('startScheduledCommits', () => {
    beforeEach(() => {
      mockReq.body = { 
        projectPath: '/test/project',
        intervalMinutes: 15,
        enabled: true,
        autoMessage: true,
        branchStrategy: 'main'
      };
    });

    it('should start scheduled commits successfully', async () => {
      mockGitIntegration.startScheduledCommits.mockResolvedValue();

      await controller.startScheduledCommits(mockReq as Request, mockRes as Response);

      expect(mockGitIntegration.startScheduledCommits).toHaveBeenCalledWith('/test/project', {
        enabled: true,
        intervalMinutes: 15,
        autoMessage: true,
        branchStrategy: 'main'
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Started scheduled commits for project',
        data: {
          projectPath: '/test/project',
          intervalMinutes: 15
        }
      });
    });

    it('should use default values when parameters missing', async () => {
      mockReq.body = { projectPath: '/test/project' };
      mockGitIntegration.startScheduledCommits.mockResolvedValue();

      await controller.startScheduledCommits(mockReq as Request, mockRes as Response);

      expect(mockGitIntegration.startScheduledCommits).toHaveBeenCalledWith('/test/project', {
        enabled: true,
        intervalMinutes: 30,
        autoMessage: true,
        branchStrategy: 'feature'
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Started scheduled commits for project',
        data: {
          projectPath: '/test/project',
          intervalMinutes: 30
        }
      });
    });

    it('should return 400 if project path is missing', async () => {
      mockReq.body = { intervalMinutes: 15 };

      await controller.startScheduledCommits(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Project path is required'
      });
      expect(mockGitIntegration.startScheduledCommits).not.toHaveBeenCalled();
    });

    it('should handle errors and return 500', async () => {
      const error = new Error('Scheduled commits error');
      mockGitIntegration.startScheduledCommits.mockRejectedValue(error);

      await controller.startScheduledCommits(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to start scheduled commits:', { error: 'Scheduled commits error' });
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to start scheduled commits',
        details: 'Scheduled commits error'
      });
    });
  });

  describe('stopScheduledCommits', () => {
    beforeEach(() => {
      mockReq.body = { projectPath: '/test/project' };
    });

    it('should stop scheduled commits successfully', async () => {
      mockGitIntegration.stopScheduledCommits.mockReturnValue();

      await controller.stopScheduledCommits(mockReq as Request, mockRes as Response);

      expect(mockGitIntegration.stopScheduledCommits).toHaveBeenCalledWith('/test/project');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Stopped scheduled commits for project',
        data: { projectPath: '/test/project' }
      });
    });

    it('should return 400 if project path is missing', async () => {
      mockReq.body = {};

      await controller.stopScheduledCommits(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Project path is required'
      });
      expect(mockGitIntegration.stopScheduledCommits).not.toHaveBeenCalled();
    });

    it('should handle errors and return 500', async () => {
      const error = new Error('Stop scheduled commits error');
      mockGitIntegration.stopScheduledCommits.mockImplementation(() => {
        throw error;
      });

      await controller.stopScheduledCommits(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to stop scheduled commits:', { error: 'Stop scheduled commits error' });
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to stop scheduled commits',
        details: 'Stop scheduled commits error'
      });
    });
  });

  describe('getScheduledProjects', () => {
    it('should return scheduled projects', async () => {
      const mockScheduledProjects = [
        { projectPath: '/project1', intervalMinutes: 30 },
        { projectPath: '/project2', intervalMinutes: 60 }
      ];
      mockGitIntegration.getScheduledProjects.mockReturnValue(mockScheduledProjects);

      await controller.getScheduledProjects(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockScheduledProjects
      });
    });

    it('should handle errors and return 500', async () => {
      const error = new Error('Get scheduled projects error');
      mockGitIntegration.getScheduledProjects.mockImplementation(() => {
        throw error;
      });

      await controller.getScheduledProjects(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get scheduled projects:', { error: 'Get scheduled projects error' });
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to get scheduled projects',
        details: 'Get scheduled projects error'
      });
    });
  });
});