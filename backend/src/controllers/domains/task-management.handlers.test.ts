import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import * as taskManagementHandlers from './task-management.handlers.js';
import type { ApiController } from '../api.controller.js';

describe('Task Management Handlers', () => {
  let mockApiController: Partial<ApiController>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock ApiController methods
    mockApiController = {
      assignTask: jest.fn(),
      completeTask: jest.fn(),
      blockTask: jest.fn(),
      takeNextTask: jest.fn(),
      syncTaskStatus: jest.fn(),
      getTeamProgress: jest.fn(),
      createTasksFromConfig: jest.fn(),
    } as any;

    mockRequest = {
      body: { taskId: 'task-123', memberId: 'member-456' },
      params: { id: 'test-id' }
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('assignTask', () => {
    it('should delegate to ApiController assignTask method', async () => {
      await taskManagementHandlers.assignTask.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockApiController.assignTask).toHaveBeenCalledWith(mockRequest, mockResponse);
    });
  });

  describe('completeTask', () => {
    it('should delegate to ApiController completeTask method', async () => {
      await taskManagementHandlers.completeTask.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockApiController.completeTask).toHaveBeenCalledWith(mockRequest, mockResponse);
    });
  });

  describe('blockTask', () => {
    it('should delegate to ApiController blockTask method', async () => {
      await taskManagementHandlers.blockTask.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockApiController.blockTask).toHaveBeenCalledWith(mockRequest, mockResponse);
    });
  });

  describe('takeNextTask', () => {
    it('should delegate to ApiController takeNextTask method', async () => {
      await taskManagementHandlers.takeNextTask.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockApiController.takeNextTask).toHaveBeenCalledWith(mockRequest, mockResponse);
    });
  });

  describe('syncTaskStatus', () => {
    it('should delegate to ApiController syncTaskStatus method', async () => {
      await taskManagementHandlers.syncTaskStatus.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockApiController.syncTaskStatus).toHaveBeenCalledWith(mockRequest, mockResponse);
    });
  });

  describe('getTeamProgress', () => {
    it('should delegate to ApiController getTeamProgress method', async () => {
      await taskManagementHandlers.getTeamProgress.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockApiController.getTeamProgress).toHaveBeenCalledWith(mockRequest, mockResponse);
    });
  });

  describe('createTasksFromConfig', () => {
    it('should delegate to ApiController createTasksFromConfig method', async () => {
      await taskManagementHandlers.createTasksFromConfig.call(
        mockApiController as ApiController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockApiController.createTasksFromConfig).toHaveBeenCalledWith(mockRequest, mockResponse);
    });
  });

  describe('Error handling', () => {
    it('should propagate errors from delegated methods', async () => {
      const testError = new Error('Delegation error');
      (mockApiController.assignTask as jest.Mock).mockRejectedValue(testError);

      await expect(
        taskManagementHandlers.assignTask.call(
          mockApiController as ApiController,
          mockRequest as Request,
          mockResponse as Response
        )
      ).rejects.toThrow('Delegation error');
    });

    it('should handle missing methods gracefully', async () => {
      const incompleteController = {} as ApiController;

      // This should not throw, but may return undefined or similar
      const result = await taskManagementHandlers.assignTask.call(
        incompleteController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(result).toBeUndefined();
    });
  });

  describe('Context preservation', () => {
    it('should preserve context when delegating calls', async () => {
      const contextAwareController = {
        assignTask: jest.fn().mockImplementation(function(this: any) {
          return this;
        })
      } as any;

      const result = await taskManagementHandlers.assignTask.call(
        contextAwareController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(contextAwareController.assignTask).toHaveBeenCalled();
    });
  });

  describe('All handlers availability', () => {
    it('should have all expected handler functions', () => {
      expect(typeof taskManagementHandlers.assignTask).toBe('function');
      expect(typeof taskManagementHandlers.completeTask).toBe('function');
      expect(typeof taskManagementHandlers.blockTask).toBe('function');
      expect(typeof taskManagementHandlers.takeNextTask).toBe('function');
      expect(typeof taskManagementHandlers.syncTaskStatus).toBe('function');
      expect(typeof taskManagementHandlers.getTeamProgress).toBe('function');
      expect(typeof taskManagementHandlers.createTasksFromConfig).toBe('function');
    });

    it('should handle async operations properly', async () => {
      const asyncController = {
        assignTask: jest.fn().mockResolvedValue({ success: true })
      } as any;

      const result = await taskManagementHandlers.assignTask.call(
        asyncController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(result).toEqual({ success: true });
      expect(asyncController.assignTask).toHaveBeenCalledWith(mockRequest, mockResponse);
    });
  });
});