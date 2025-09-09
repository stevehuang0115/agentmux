import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import * as gitHandlers from './git.handlers.js';
import type { ApiContext } from '../types.js';
import { StorageService, TmuxService, SchedulerService, MessageSchedulerService } from '../../services/index.js';
import { ActiveProjectsService } from '../../services/active-projects.service.js';
import { PromptTemplateService } from '../../services/prompt-template.service.js';
import { GitIntegrationService } from '../../services/git-integration.service.js';

// Mock dependencies
jest.mock('../../services/index.js');
jest.mock('../../services/active-projects.service.js');
jest.mock('../../services/prompt-template.service.js');
jest.mock('../../services/git-integration.service.js');

describe('Git Handlers', () => {
  let mockApiContext: ApiContext;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockGitIntegrationService: jest.Mocked<GitIntegrationService>;
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

    // Mock services
    mockStorageService = new StorageService() as jest.Mocked<StorageService>;
    mockGitIntegrationService = new GitIntegrationService('/mock/path') as jest.Mocked<GitIntegrationService>;

    // Mock GitIntegrationService constructor
    (GitIntegrationService as jest.MockedClass<typeof GitIntegrationService>).mockImplementation(() => mockGitIntegrationService);

    // Setup API context
    mockApiContext = {
      storageService: mockStorageService,
      tmuxService: new TmuxService() as jest.Mocked<TmuxService>,
      schedulerService: new SchedulerService() as jest.Mocked<SchedulerService>,
      messageSchedulerService: new MessageSchedulerService() as jest.Mocked<MessageSchedulerService>,
      activeProjectsService: new ActiveProjectsService() as jest.Mocked<ActiveProjectsService>,
      promptTemplateService: new PromptTemplateService() as jest.Mocked<PromptTemplateService>,
    };

    mockRequest = {};
    mockResponse = responseMock as any;

    // Setup default mock returns
    mockStorageService.getProjects.mockResolvedValue([
      {
        id: 'project-123',
        name: 'Test Project',
        path: '/test/project/path',
        description: 'Test project description',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);

    mockGitIntegrationService.isGitRepository.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getGitStatus', () => {
    it('should return git status successfully', async () => {
      const mockStatus = {
        hasChanges: true,
        branch: 'main',
        ahead: 0,
        behind: 0,
        staged: ['file1.js'],
        unstaged: ['file2.js'],
        untracked: ['file3.js']
      };
      const mockStats = {
        totalCommits: 42,
        contributors: 3,
        lastCommitDate: '2024-01-01T00:00:00.000Z'
      };
      const mockLastCommit = {
        hash: 'abc123',
        message: 'Last commit message',
        author: 'Test Author',
        date: '2024-01-01T00:00:00.000Z'
      };

      mockRequest.params = { projectId: 'project-123' };
      mockGitIntegrationService.getGitStatus.mockResolvedValue(mockStatus);
      mockGitIntegrationService.getRepositoryStats.mockResolvedValue(mockStats);
      mockGitIntegrationService.getLastCommitInfo.mockResolvedValue(mockLastCommit);

      await gitHandlers.getGitStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getProjects).toHaveBeenCalled();
      expect(GitIntegrationService).toHaveBeenCalledWith('/test/project/path');
      expect(mockGitIntegrationService.isGitRepository).toHaveBeenCalled();
      expect(mockGitIntegrationService.getGitStatus).toHaveBeenCalled();
      expect(mockGitIntegrationService.getRepositoryStats).toHaveBeenCalled();
      expect(mockGitIntegrationService.getLastCommitInfo).toHaveBeenCalled();

      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: {
          status: mockStatus,
          stats: mockStats,
          lastCommit: mockLastCommit
        }
      });
    });

    it('should return 404 when project not found', async () => {
      mockRequest.params = { projectId: 'nonexistent-project' };

      await gitHandlers.getGitStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(404);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Project not found'
      });
    });

    it('should return 400 when project is not a git repository', async () => {
      mockRequest.params = { projectId: 'project-123' };
      mockGitIntegrationService.isGitRepository.mockResolvedValue(false);

      await gitHandlers.getGitStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(400);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not a git repository'
      });
    });

    it('should handle git service errors', async () => {
      mockRequest.params = { projectId: 'project-123' };
      mockGitIntegrationService.getGitStatus.mockRejectedValue(new Error('Git command failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await gitHandlers.getGitStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error getting git status:', expect.any(Error));
      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get git status'
      });

      consoleSpy.mockRestore();
    });
  });

  describe('commitChanges', () => {
    it('should commit changes successfully', async () => {
      const mockCommitResult = {
        hash: 'abc123',
        message: 'Test commit',
        filesChanged: 2,
        insertions: 10,
        deletions: 5
      };

      mockRequest.params = { projectId: 'project-123' };
      mockRequest.body = {
        message: 'Test commit message',
        includeUntracked: true,
        dryRun: false
      };

      mockGitIntegrationService.commit.mockResolvedValue(mockCommitResult);

      await gitHandlers.commitChanges.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockGitIntegrationService.commit).toHaveBeenCalledWith({
        message: 'Test commit message',
        includeUntracked: true,
        dryRun: false
      });

      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: mockCommitResult
      });
    });

    it('should handle dry run commits', async () => {
      const mockDryRunResult = {
        wouldCommit: true,
        filesToCommit: ['file1.js', 'file2.js'],
        message: 'Dry run commit'
      };

      mockRequest.params = { projectId: 'project-123' };
      mockRequest.body = {
        message: 'Dry run test',
        dryRun: true
      };

      mockGitIntegrationService.commit.mockResolvedValue(mockDryRunResult);

      await gitHandlers.commitChanges.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockGitIntegrationService.commit).toHaveBeenCalledWith({
        message: 'Dry run test',
        dryRun: true
      });

      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: mockDryRunResult
      });
    });

    it('should return 404 when project not found for commit', async () => {
      mockRequest.params = { projectId: 'nonexistent-project' };
      mockRequest.body = { message: 'Test commit' };

      await gitHandlers.commitChanges.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(404);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Project not found'
      });
    });

    it('should return 400 when project is not a git repository for commit', async () => {
      mockRequest.params = { projectId: 'project-123' };
      mockRequest.body = { message: 'Test commit' };
      mockGitIntegrationService.isGitRepository.mockResolvedValue(false);

      await gitHandlers.commitChanges.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(400);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not a git repository'
      });
    });

    it('should handle commit errors', async () => {
      mockRequest.params = { projectId: 'project-123' };
      mockRequest.body = { message: 'Test commit' };
      mockGitIntegrationService.commit.mockRejectedValue(new Error('Nothing to commit'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await gitHandlers.commitChanges.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error committing changes:', expect.any(Error));
      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to commit changes'
      });

      consoleSpy.mockRestore();
    });
  });

  describe('startAutoCommit', () => {
    it('should start auto commit successfully', async () => {
      mockRequest.params = { projectId: 'project-123' };
      mockRequest.body = { intervalMinutes: 30 };

      mockGitIntegrationService.startAutoCommit.mockResolvedValue(true);

      await gitHandlers.startAutoCommit.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockGitIntegrationService.startAutoCommit).toHaveBeenCalledWith(30);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: { autoCommitEnabled: true, intervalMinutes: 30 }
      });
    });

    it('should return 404 when project not found for auto commit', async () => {
      mockRequest.params = { projectId: 'nonexistent-project' };
      mockRequest.body = { intervalMinutes: 30 };

      await gitHandlers.startAutoCommit.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(404);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Project not found'
      });
    });

    it('should handle auto commit start errors', async () => {
      mockRequest.params = { projectId: 'project-123' };
      mockRequest.body = { intervalMinutes: 30 };
      mockGitIntegrationService.startAutoCommit.mockRejectedValue(new Error('Auto commit setup failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await gitHandlers.startAutoCommit.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error starting auto commit:', expect.any(Error));
      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to start auto commit'
      });

      consoleSpy.mockRestore();
    });
  });

  describe('stopAutoCommit', () => {
    it('should stop auto commit successfully', async () => {
      mockRequest.params = { projectId: 'project-123' };

      mockGitIntegrationService.stopAutoCommit.mockResolvedValue(true);

      await gitHandlers.stopAutoCommit.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockGitIntegrationService.stopAutoCommit).toHaveBeenCalled();
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: { autoCommitEnabled: false }
      });
    });

    it('should return 404 when project not found for stopping auto commit', async () => {
      mockRequest.params = { projectId: 'nonexistent-project' };

      await gitHandlers.stopAutoCommit.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(404);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Project not found'
      });
    });
  });

  describe('Error handling', () => {
    it('should handle storage service errors when getting projects', async () => {
      mockRequest.params = { projectId: 'project-123' };
      mockStorageService.getProjects.mockRejectedValue(new Error('Database connection failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await gitHandlers.getGitStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error getting git status:', expect.any(Error));
      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get git status'
      });

      consoleSpy.mockRestore();
    });

    it('should handle invalid parameters gracefully', async () => {
      mockRequest.params = {}; // Missing projectId

      await gitHandlers.getGitStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(404);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Project not found'
      });
    });
  });

  describe('Integration', () => {
    it('should properly initialize GitIntegrationService with project path', async () => {
      mockRequest.params = { projectId: 'project-123' };

      await gitHandlers.getGitStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(GitIntegrationService).toHaveBeenCalledWith('/test/project/path');
    });

    it('should call all required git operations for status', async () => {
      mockRequest.params = { projectId: 'project-123' };
      
      // Mock all the promises to resolve
      mockGitIntegrationService.getGitStatus.mockResolvedValue({} as any);
      mockGitIntegrationService.getRepositoryStats.mockResolvedValue({} as any);
      mockGitIntegrationService.getLastCommitInfo.mockResolvedValue({} as any);

      await gitHandlers.getGitStatus.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockGitIntegrationService.getGitStatus).toHaveBeenCalled();
      expect(mockGitIntegrationService.getRepositoryStats).toHaveBeenCalled();
      expect(mockGitIntegrationService.getLastCommitInfo).toHaveBeenCalled();
    });
  });
});