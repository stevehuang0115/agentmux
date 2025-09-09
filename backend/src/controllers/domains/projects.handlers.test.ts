import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import * as projectsHandlers from './projects.handlers.js';
import type { ApiContext } from '../types.js';
import { StorageService, TmuxService, SchedulerService } from '../../services/index.js';
import { ActiveProjectsService } from '../../services/active-projects.service.js';
import { PromptTemplateService } from '../../services/prompt-template.service.js';
import { Project } from '../../types/index.js';

// Mock dependencies
jest.mock('../../services/index.js');
jest.mock('../../services/active-projects.service.js');
jest.mock('../../services/prompt-template.service.js');
jest.mock('../../models/index.js');
jest.mock('../../services/context-loader.service.js');
jest.mock('../../services/workflow.service.js');
jest.mock('../../services/ticket-editor.service.js');
jest.mock('../../services/task.service.js');
jest.mock('../utils/file-utils.js');
jest.mock('fs/promises');
jest.mock('fs');
jest.mock('path');
jest.mock('util');
jest.mock('child_process');

describe('Projects Handlers', () => {
  let mockApiContext: ApiContext;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockActiveProjectsService: jest.Mocked<ActiveProjectsService>;
  let responseMock: {
    status: jest.Mock;
    json: jest.Mock;
    send: jest.Mock;
  };

  const mockProject: Project = {
    id: 'project-123',
    name: 'Test Project',
    path: '/test/project/path',
    description: 'Test project description',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
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
    mockActiveProjectsService = new ActiveProjectsService() as jest.Mocked<ActiveProjectsService>;

    // Setup API context
    mockApiContext = {
      storageService: mockStorageService,
      tmuxService: new TmuxService() as jest.Mocked<TmuxService>,
      schedulerService: new SchedulerService() as jest.Mocked<SchedulerService>,
      activeProjectsService: mockActiveProjectsService,
      promptTemplateService: new PromptTemplateService() as jest.Mocked<PromptTemplateService>,
    };

    mockRequest = {};
    mockResponse = responseMock as any;

    // Setup default mock returns
    mockStorageService.getProjects.mockResolvedValue([mockProject]);
    mockStorageService.getProject.mockResolvedValue(mockProject);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('createProject', () => {
    it('should create project successfully with path only', async () => {
      mockRequest.body = {
        path: '/new/project/path'
      };

      const newProject = {
        id: 'new-project-id',
        name: 'New Project',
        path: '/new/project/path',
        description: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockStorageService.addProject.mockResolvedValue(newProject);

      await projectsHandlers.createProject.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.addProject).toHaveBeenCalledWith('/new/project/path');
      expect(responseMock.status).toHaveBeenCalledWith(201);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: newProject,
        message: 'Project added successfully'
      });
    });

    it('should create project with name and description', async () => {
      mockRequest.body = {
        path: '/project/with/details',
        name: 'Detailed Project',
        description: 'A project with custom details'
      };

      const baseProject = {
        id: 'detailed-project',
        name: 'Generated Name',
        path: '/project/with/details',
        description: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const updatedProject = {
        ...baseProject,
        name: 'Detailed Project',
        description: 'A project with custom details'
      };

      mockStorageService.addProject.mockResolvedValue(baseProject);
      mockStorageService.saveProject.mockResolvedValue(updatedProject);

      const { ProjectModel } = await import('../../models/index.js');
      const mockProjectModel = {
        toJSON: jest.fn().mockReturnValue(updatedProject)
      };
      (ProjectModel.fromJSON as jest.Mock).mockReturnValue(mockProjectModel);

      await projectsHandlers.createProject.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.addProject).toHaveBeenCalledWith('/project/with/details');
      expect(ProjectModel.fromJSON).toHaveBeenCalledWith(baseProject);
      expect(mockStorageService.saveProject).toHaveBeenCalledWith(updatedProject);
      expect(responseMock.status).toHaveBeenCalledWith(201);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: updatedProject,
        message: 'Project added successfully'
      });
    });

    it('should return 400 when project path is missing', async () => {
      mockRequest.body = {
        name: 'No Path Project'
      };

      await projectsHandlers.createProject.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.addProject).not.toHaveBeenCalled();
      expect(responseMock.status).toHaveBeenCalledWith(400);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Project path is required'
      });
    });

    it('should handle storage service errors', async () => {
      mockRequest.body = {
        path: '/failing/project'
      };

      mockStorageService.addProject.mockRejectedValue(new Error('Storage failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await projectsHandlers.createProject.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error creating project:', expect.any(Error));
      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to create project'
      });

      consoleSpy.mockRestore();
    });

    it('should handle project model update errors', async () => {
      mockRequest.body = {
        path: '/project/update/fail',
        name: 'Update Fail Project'
      };

      const baseProject = {
        id: 'update-fail',
        name: 'Base Name',
        path: '/project/update/fail',
        description: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockStorageService.addProject.mockResolvedValue(baseProject);
      mockStorageService.saveProject.mockRejectedValue(new Error('Update failed'));

      const { ProjectModel } = await import('../../models/index.js');
      const mockProjectModel = {
        toJSON: jest.fn().mockReturnValue({ ...baseProject, name: 'Update Fail Project' })
      };
      (ProjectModel.fromJSON as jest.Mock).mockReturnValue(mockProjectModel);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await projectsHandlers.createProject.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error creating project:', expect.any(Error));
      expect(responseMock.status).toHaveBeenCalledWith(500);

      consoleSpy.mockRestore();
    });
  });

  describe('getProjects', () => {
    it('should return all projects successfully', async () => {
      const projects = [
        mockProject,
        {
          id: 'project-456',
          name: 'Second Project',
          path: '/second/project',
          description: 'Second test project',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      mockStorageService.getProjects.mockResolvedValue(projects);

      await projectsHandlers.getProjects.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getProjects).toHaveBeenCalled();
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: projects
      });
    });

    it('should return empty array when no projects exist', async () => {
      mockStorageService.getProjects.mockResolvedValue([]);

      await projectsHandlers.getProjects.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });

    it('should handle storage service errors when getting projects', async () => {
      mockStorageService.getProjects.mockRejectedValue(new Error('Database connection failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await projectsHandlers.getProjects.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error getting projects:', expect.any(Error));
      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve projects'
      });

      consoleSpy.mockRestore();
    });
  });

  describe('getProject', () => {
    it('should return specific project successfully', async () => {
      mockRequest.params = { id: 'project-123' };

      await projectsHandlers.getProject.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getProject).toHaveBeenCalledWith('project-123');
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: mockProject
      });
    });

    it('should return 404 when project not found', async () => {
      mockRequest.params = { id: 'nonexistent-project' };
      mockStorageService.getProject.mockResolvedValue(null);

      await projectsHandlers.getProject.call(
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

    it('should handle storage service errors when getting single project', async () => {
      mockRequest.params = { id: 'project-123' };
      mockStorageService.getProject.mockRejectedValue(new Error('Database query failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await projectsHandlers.getProject.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error getting project:', expect.any(Error));
      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve project'
      });

      consoleSpy.mockRestore();
    });
  });

  describe('startProject', () => {
    it('should start project successfully', async () => {
      mockRequest.params = { id: 'project-123' };

      const startResult = {
        checkInScheduleId: 'checkin-schedule-123',
        gitCommitScheduleId: 'commit-schedule-456'
      };

      mockActiveProjectsService.startProject.mockResolvedValue(startResult);

      await projectsHandlers.startProject.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getProject).toHaveBeenCalledWith('project-123');
      expect(mockActiveProjectsService.startProject).toHaveBeenCalledWith('project-123', undefined);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: startResult,
        message: 'Project started successfully'
      });
    });

    it('should start project with message scheduler service', async () => {
      mockApiContext.messageSchedulerService = {
        scheduleMessage: jest.fn()
      } as any;

      mockRequest.params = { id: 'project-123' };

      const startResult = {
        checkInScheduleId: 'checkin-schedule-789'
      };

      mockActiveProjectsService.startProject.mockResolvedValue(startResult);

      await projectsHandlers.startProject.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockActiveProjectsService.startProject).toHaveBeenCalledWith('project-123', mockApiContext.messageSchedulerService);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: startResult,
        message: 'Project started successfully'
      });
    });

    it('should return 404 when project not found for start', async () => {
      mockRequest.params = { id: 'nonexistent-project' };
      mockStorageService.getProject.mockResolvedValue(null);

      await projectsHandlers.startProject.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockActiveProjectsService.startProject).not.toHaveBeenCalled();
      expect(responseMock.status).toHaveBeenCalledWith(404);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Project not found'
      });
    });

    it('should handle start project errors', async () => {
      mockRequest.params = { id: 'project-123' };
      mockActiveProjectsService.startProject.mockRejectedValue(new Error('Project already running'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await projectsHandlers.startProject.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error starting project:', expect.any(Error));
      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to start project'
      });

      consoleSpy.mockRestore();
    });
  });

  describe('stopProject', () => {
    it('should stop project successfully', async () => {
      mockRequest.params = { id: 'project-123' };

      mockActiveProjectsService.stopProject.mockResolvedValue(undefined);

      await projectsHandlers.stopProject.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getProject).toHaveBeenCalledWith('project-123');
      expect(mockActiveProjectsService.stopProject).toHaveBeenCalledWith('project-123', undefined);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        message: 'Project stopped successfully'
      });
    });

    it('should stop project with message scheduler service', async () => {
      mockApiContext.messageSchedulerService = {
        deleteScheduledMessage: jest.fn()
      } as any;

      mockRequest.params = { id: 'project-123' };

      mockActiveProjectsService.stopProject.mockResolvedValue(undefined);

      await projectsHandlers.stopProject.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockActiveProjectsService.stopProject).toHaveBeenCalledWith('project-123', mockApiContext.messageSchedulerService);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        message: 'Project stopped successfully'
      });
    });

    it('should return 404 when project not found for stop', async () => {
      mockRequest.params = { id: 'nonexistent-project' };
      mockStorageService.getProject.mockResolvedValue(null);

      await projectsHandlers.stopProject.call(
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

  describe('deleteProject', () => {
    it('should delete project successfully', async () => {
      mockRequest.params = { id: 'project-123' };

      mockStorageService.deleteProject.mockResolvedValue(true);

      await projectsHandlers.deleteProject.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getProject).toHaveBeenCalledWith('project-123');
      expect(mockStorageService.deleteProject).toHaveBeenCalledWith('project-123');
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        message: 'Project deleted successfully'
      });
    });

    it('should return 404 when project not found for deletion', async () => {
      mockRequest.params = { id: 'nonexistent-project' };
      mockStorageService.getProject.mockResolvedValue(null);

      await projectsHandlers.deleteProject.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.deleteProject).not.toHaveBeenCalled();
      expect(responseMock.status).toHaveBeenCalledWith(404);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Project not found'
      });
    });

    it('should return 404 when delete operation fails', async () => {
      mockRequest.params = { id: 'project-123' };
      mockStorageService.deleteProject.mockResolvedValue(false);

      await projectsHandlers.deleteProject.call(
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

  describe('Input validation', () => {
    it('should handle missing parameters gracefully', async () => {
      mockRequest.params = {};

      await projectsHandlers.getProject.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getProject).toHaveBeenCalledWith(undefined);
    });

    it('should handle null request body', async () => {
      mockRequest.body = null;

      await projectsHandlers.createProject.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(400);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Project path is required'
      });
    });

    it('should handle empty project path', async () => {
      mockRequest.body = { path: '' };

      await projectsHandlers.createProject.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(400);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Project path is required'
      });
    });
  });

  describe('Integration', () => {
    it('should properly coordinate between storage and active projects services', async () => {
      mockRequest.params = { id: 'integration-test' };

      await projectsHandlers.startProject.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getProject).toHaveBeenCalledBefore(mockActiveProjectsService.startProject as jest.Mock);
      expect(mockActiveProjectsService.startProject).toHaveBeenCalledWith('integration-test', undefined);
    });

    it('should handle service dependencies correctly', () => {
      expect(mockApiContext.storageService).toBe(mockStorageService);
      expect(mockApiContext.activeProjectsService).toBe(mockActiveProjectsService);
    });
  });
});