import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import * as assignmentsHandlers from './assignments.controller.js';
import type { ApiController } from '../api.controller.js';

describe('Assignments Handlers', () => {
  let mockApiController: Partial<ApiController>;
  let mockRequest: Partial<Request>;
  let mockResponse: any;
  let mockStorageService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStorageService = {
      getProjects: jest.fn<any>(),
      getTeams: jest.fn<any>()
    };

    mockApiController = {
      storageService: mockStorageService
    } as any;

    mockRequest = {
      params: { id: 'project-1-team-1' },
      body: { status: 'in-progress' }
    };

    mockResponse = {
      json: jest.fn<any>(),
      status: jest.fn<any>().mockReturnThis()
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getAssignments', () => {
    it('should return assignments for all project-team combinations', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Test Project',
          status: 'active',
          teams: { development: ['team-1'], design: ['team-2'] },
          createdAt: '2024-01-01T00:00:00Z'
        }
      ];

      const mockTeams = [
        {
          id: 'team-1',
          name: 'Dev Team',
          members: [{ name: 'Alice', role: 'developer' }]
        },
        {
          id: 'team-2',
          name: 'Design Team',
          members: [{ name: 'Bob', role: 'designer' }]
        }
      ];

      mockStorageService.getProjects.mockResolvedValue(mockProjects);
      mockStorageService.getTeams.mockResolvedValue(mockTeams);

      await assignmentsHandlers.getAssignments.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getProjects).toHaveBeenCalled();
      expect(mockStorageService.getTeams).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith([
        {
          id: 'project-1-team-1',
          title: 'Test Project - Dev Team',
          description: 'No description available',
          status: 'in-progress',
          assignedTo: 'Alice',
          priority: 'medium',
          teamId: 'team-1',
          teamName: 'Dev Team',
          createdAt: '2024-01-01T00:00:00Z',
          dueDate: undefined,
          tags: ['developer']
        },
        {
          id: 'project-1-team-2',
          title: 'Test Project - Design Team',
          description: 'No description available',
          status: 'in-progress',
          assignedTo: 'Bob',
          priority: 'medium',
          teamId: 'team-2',
          teamName: 'Design Team',
          createdAt: '2024-01-01T00:00:00Z',
          dueDate: undefined,
          tags: ['designer']
        }
      ]);
    });

    it('should handle projects with completed status', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Completed Project',
          status: 'completed',
          teams: { development: ['team-1'] },
          createdAt: '2024-01-01T00:00:00Z'
        }
      ];

      const mockTeams = [
        {
          id: 'team-1',
          name: 'Dev Team',
          members: [{ name: 'Alice', role: 'developer' }]
        }
      ];

      mockStorageService.getProjects.mockResolvedValue(mockProjects);
      mockStorageService.getTeams.mockResolvedValue(mockTeams);

      await assignmentsHandlers.getAssignments.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith([
        expect.objectContaining({
          status: 'todo'
        })
      ]);
    });

    it('should handle teams with no members', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Test Project',
          status: 'active',
          teams: { development: ['team-1'] },
          createdAt: '2024-01-01T00:00:00Z'
        }
      ];

      const mockTeams = [
        {
          id: 'team-1',
          name: 'Empty Team',
          members: []
        }
      ];

      mockStorageService.getProjects.mockResolvedValue(mockProjects);
      mockStorageService.getTeams.mockResolvedValue(mockTeams);

      await assignmentsHandlers.getAssignments.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith([
        expect.objectContaining({
          assignedTo: 'Unassigned',
          tags: ['general']
        })
      ]);
    });

    it('should skip teams that are not found', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Test Project',
          status: 'active',
          teams: { development: ['team-1', 'team-missing'] },
          createdAt: '2024-01-01T00:00:00Z'
        }
      ];

      const mockTeams = [
        {
          id: 'team-1',
          name: 'Dev Team',
          members: [{ name: 'Alice', role: 'developer' }]
        }
      ];

      mockStorageService.getProjects.mockResolvedValue(mockProjects);
      mockStorageService.getTeams.mockResolvedValue(mockTeams);

      await assignmentsHandlers.getAssignments.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'project-1-team-1'
        })
      ]);
    });

    it('should handle storage service errors', async () => {
      const error = new Error('Storage error');
      mockStorageService.getProjects.mockRejectedValue(error);

      await assignmentsHandlers.getAssignments.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch assignments'
      });
    });

    it('should handle empty projects and teams', async () => {
      mockStorageService.getProjects.mockResolvedValue([]);
      mockStorageService.getTeams.mockResolvedValue([]);

      await assignmentsHandlers.getAssignments.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith([]);
    });
  });

  describe('updateAssignment', () => {
    it('should update project status when assignment status is in-progress', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        status: 'inactive'
      };

      const mockProjects = [mockProject];
      mockStorageService.getProjects.mockResolvedValue(mockProjects);
      mockStorageService.saveProject = jest.fn<any>().mockResolvedValue(undefined);

      mockRequest.params = { id: 'project-1-team-1' };
      mockRequest.body = { status: 'in-progress' };

      await assignmentsHandlers.updateAssignment.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockProject.status).toBe('active');
      expect(mockStorageService.saveProject).toHaveBeenCalledWith(mockProject);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Assignment updated successfully'
      });
    });

    it('should update project status when assignment status is done', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        status: 'active'
      };

      const mockProjects = [mockProject];
      mockStorageService.getProjects.mockResolvedValue(mockProjects);
      mockStorageService.saveProject = jest.fn<any>().mockResolvedValue(undefined);

      mockRequest.params = { id: 'project-1-team-1' };
      mockRequest.body = { status: 'done' };

      await assignmentsHandlers.updateAssignment.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockProject.status).toBe('completed');
      expect(mockStorageService.saveProject).toHaveBeenCalledWith(mockProject);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Assignment updated successfully'
      });
    });

    it('should not update project status for invalid status values', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        status: 'active'
      };

      const mockProjects = [mockProject];
      mockStorageService.getProjects.mockResolvedValue(mockProjects);
      mockStorageService.saveProject = jest.fn<any>().mockResolvedValue(undefined);

      mockRequest.params = { id: 'project-1-team-1' };
      mockRequest.body = { status: 'invalid-status' };

      await assignmentsHandlers.updateAssignment.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockProject.status).toBe('active');
      expect(mockStorageService.saveProject).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Assignment updated successfully'
      });
    });

    it('should not update project status for review and todo statuses', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        status: 'active'
      };

      const mockProjects = [mockProject];
      mockStorageService.getProjects.mockResolvedValue(mockProjects);
      mockStorageService.saveProject = jest.fn<any>().mockResolvedValue(undefined);

      for (const status of ['review', 'todo']) {
        jest.clearAllMocks();

        mockRequest.params = { id: 'project-1-team-1' };
        mockRequest.body = { status };

        await assignmentsHandlers.updateAssignment.call(
          mockApiController as ApiController,
          mockRequest as Request,
          mockResponse as Response
        );

        expect(mockProject.status).toBe('active');
        expect(mockStorageService.saveProject).not.toHaveBeenCalled();
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'Assignment updated successfully'
        });
      }
    });

    it('should handle project not found', async () => {
      mockStorageService.getProjects.mockResolvedValue([]);

      mockRequest.params = { id: 'missing-project-team-1' };
      mockRequest.body = { status: 'in-progress' };

      await assignmentsHandlers.updateAssignment.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.saveProject).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Assignment updated successfully'
      });
    });

    it('should handle storage service errors', async () => {
      const error = new Error('Storage error');
      mockStorageService.getProjects.mockRejectedValue(error);

      await assignmentsHandlers.updateAssignment.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to update assignment'
      });
    });

    it('should handle malformed assignment IDs', async () => {
      mockStorageService.getProjects.mockResolvedValue([]);

      mockRequest.params = { id: 'malformed-id' };
      mockRequest.body = { status: 'in-progress' };

      await assignmentsHandlers.updateAssignment.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Assignment updated successfully'
      });
    });

    it('should handle missing status in request body', async () => {
      mockRequest.params = { id: 'project-1-team-1' };
      mockRequest.body = {};

      await assignmentsHandlers.updateAssignment.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Assignment updated successfully'
      });
    });
  });

  describe('Error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      mockStorageService.getProjects.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await assignmentsHandlers.getAssignments.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch assignments'
      });
    });
  });

  describe('Context preservation', () => {
    it('should preserve controller context when handling assignments', async () => {
      const contextAwareController = {
        storageService: {
          getProjects: jest.fn<any>().mockResolvedValue([]),
          getTeams: jest.fn<any>().mockResolvedValue([])
        }
      } as any;

      await assignmentsHandlers.getAssignments.call(
        contextAwareController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(contextAwareController.storageService.getProjects).toHaveBeenCalled();
      expect(contextAwareController.storageService.getTeams).toHaveBeenCalled();
    });
  });

  describe('All handlers availability', () => {
    it('should have all expected handler functions', () => {
      expect(typeof assignmentsHandlers.getAssignments).toBe('function');
      expect(typeof assignmentsHandlers.updateAssignment).toBe('function');
    });

    it('should handle async operations properly', async () => {
      mockStorageService.getProjects.mockResolvedValue([]);
      mockStorageService.getTeams.mockResolvedValue([]);

      const result = await assignmentsHandlers.getAssignments.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(result).toBeUndefined();
      expect(mockResponse.json).toHaveBeenCalledWith([]);
    });
  });
});
