import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import * as workflowsHandlers from './workflows.controller.js';
import type { ApiContext } from '../types.js';

jest.mock('../../services/index.js', () => ({
  WorkflowService: {
    getInstance: jest.fn().mockReturnValue({
      getExecution: jest.fn(),
      getActiveExecutions: jest.fn(),
      cancelExecution: jest.fn()
    })
  }
}));

describe('Workflows Handlers', () => {
  let mockApiContext: Partial<ApiContext>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockWorkflowService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const { WorkflowService } = require('../../services/index.js');
    mockWorkflowService = WorkflowService.getInstance();

    mockApiContext = {} as any;

    mockRequest = {
      params: { executionId: 'execution-123' },
      body: {},
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

  describe('getWorkflowExecution', () => {
    it('should return workflow execution successfully', async () => {
      const mockExecution = {
        id: 'execution-123',
        workflowId: 'workflow-456',
        status: 'running',
        startedAt: '2024-01-01T00:00:00Z',
        currentStep: 2,
        totalSteps: 5,
        progress: 40
      };

      mockWorkflowService.getExecution.mockReturnValue(mockExecution);

      await workflowsHandlers.getWorkflowExecution.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockWorkflowService.getExecution).toHaveBeenCalledWith('execution-123');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockExecution
      });
    });

    it('should return 404 when workflow execution not found', async () => {
      mockWorkflowService.getExecution.mockReturnValue(null);

      await workflowsHandlers.getWorkflowExecution.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockWorkflowService.getExecution).toHaveBeenCalledWith('execution-123');
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Workflow execution not found'
      });
    });

    it('should return 404 when workflow execution is undefined', async () => {
      mockWorkflowService.getExecution.mockReturnValue(undefined);

      await workflowsHandlers.getWorkflowExecution.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Workflow execution not found'
      });
    });

    it('should handle workflow service errors', async () => {
      mockWorkflowService.getExecution.mockImplementation(() => {
        throw new Error('Workflow service error');
      });

      await workflowsHandlers.getWorkflowExecution.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get workflow execution'
      });
    });

    it('should handle missing execution ID parameter', async () => {
      mockRequest.params = {};
      mockWorkflowService.getExecution.mockReturnValue(null);

      await workflowsHandlers.getWorkflowExecution.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockWorkflowService.getExecution).toHaveBeenCalledWith(undefined);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Workflow execution not found'
      });
    });
  });

  describe('getActiveWorkflows', () => {
    it('should return active workflow executions successfully', async () => {
      const mockActiveExecutions = [
        {
          id: 'execution-1',
          workflowId: 'workflow-1',
          status: 'running',
          startedAt: '2024-01-01T00:00:00Z',
          progress: 25
        },
        {
          id: 'execution-2',
          workflowId: 'workflow-2',
          status: 'paused',
          startedAt: '2024-01-01T01:00:00Z',
          progress: 75
        }
      ];

      mockWorkflowService.getActiveExecutions.mockReturnValue(mockActiveExecutions);

      await workflowsHandlers.getActiveWorkflows.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockWorkflowService.getActiveExecutions).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockActiveExecutions
      });
    });

    it('should return empty array when no active workflows', async () => {
      mockWorkflowService.getActiveExecutions.mockReturnValue([]);

      await workflowsHandlers.getActiveWorkflows.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });

    it('should handle workflow service errors when getting active workflows', async () => {
      mockWorkflowService.getActiveExecutions.mockImplementation(() => {
        throw new Error('Active workflows error');
      });

      await workflowsHandlers.getActiveWorkflows.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get active workflows'
      });
    });

    it('should handle null return from workflow service', async () => {
      mockWorkflowService.getActiveExecutions.mockReturnValue(null);

      await workflowsHandlers.getActiveWorkflows.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: null
      });
    });
  });

  describe('cancelWorkflowExecution', () => {
    it('should cancel workflow execution successfully', async () => {
      mockWorkflowService.cancelExecution.mockResolvedValue(true);

      await workflowsHandlers.cancelWorkflowExecution.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockWorkflowService.cancelExecution).toHaveBeenCalledWith('execution-123');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Workflow execution cancelled successfully'
      });
    });

    it('should return 404 when workflow execution cannot be cancelled', async () => {
      mockWorkflowService.cancelExecution.mockResolvedValue(false);

      await workflowsHandlers.cancelWorkflowExecution.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockWorkflowService.cancelExecution).toHaveBeenCalledWith('execution-123');
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Workflow execution not found or cannot be cancelled'
      });
    });

    it('should return 404 when workflow execution not found (null result)', async () => {
      mockWorkflowService.cancelExecution.mockResolvedValue(null);

      await workflowsHandlers.cancelWorkflowExecution.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Workflow execution not found or cannot be cancelled'
      });
    });

    it('should return 404 when workflow execution not found (undefined result)', async () => {
      mockWorkflowService.cancelExecution.mockResolvedValue(undefined);

      await workflowsHandlers.cancelWorkflowExecution.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Workflow execution not found or cannot be cancelled'
      });
    });

    it('should handle workflow service errors during cancellation', async () => {
      mockWorkflowService.cancelExecution.mockRejectedValue(new Error('Cancellation error'));

      await workflowsHandlers.cancelWorkflowExecution.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to cancel workflow execution'
      });
    });

    it('should handle missing execution ID parameter during cancellation', async () => {
      mockRequest.params = {};
      mockWorkflowService.cancelExecution.mockResolvedValue(false);

      await workflowsHandlers.cancelWorkflowExecution.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockWorkflowService.cancelExecution).toHaveBeenCalledWith(undefined);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Workflow execution not found or cannot be cancelled'
      });
    });

    it('should handle empty string execution ID', async () => {
      mockRequest.params = { executionId: '' };
      mockWorkflowService.cancelExecution.mockResolvedValue(false);

      await workflowsHandlers.cancelWorkflowExecution.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockWorkflowService.cancelExecution).toHaveBeenCalledWith('');
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Workflow execution not found or cannot be cancelled'
      });
    });
  });

  describe('Error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      mockWorkflowService.getActiveExecutions.mockImplementation(() => {
        throw new TypeError('Unexpected error type');
      });

      await workflowsHandlers.getActiveWorkflows.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get active workflows'
      });
    });

    it('should handle workflow service being null', async () => {
      const { WorkflowService } = require('../../services/index.js');
      WorkflowService.getInstance.mockReturnValue(null);

      await workflowsHandlers.getActiveWorkflows.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get active workflows'
      });
    });
  });

  describe('Context preservation', () => {
    it('should preserve context when handling workflow operations', async () => {
      // No context dependencies in workflow handlers, but test that the call works
      mockWorkflowService.getActiveExecutions.mockReturnValue([]);

      const contextAwareController = {} as any;

      await workflowsHandlers.getActiveWorkflows.call(
        contextAwareController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockWorkflowService.getActiveExecutions).toHaveBeenCalled();
    });
  });

  describe('All handlers availability', () => {
    it('should have all expected handler functions', () => {
      expect(typeof workflowsHandlers.getWorkflowExecution).toBe('function');
      expect(typeof workflowsHandlers.getActiveWorkflows).toBe('function');
      expect(typeof workflowsHandlers.cancelWorkflowExecution).toBe('function');
    });

    it('should handle async operations properly', async () => {
      mockWorkflowService.cancelExecution.mockResolvedValue(true);

      const result = await workflowsHandlers.cancelWorkflowExecution.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(result).toBeUndefined();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Workflow execution cancelled successfully'
      });
    });
  });

  describe('Service integration', () => {
    it('should properly call workflow service singleton', async () => {
      const { WorkflowService } = require('../../services/index.js');
      mockWorkflowService.getActiveExecutions.mockReturnValue([]);

      await workflowsHandlers.getActiveWorkflows.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(WorkflowService.getInstance).toHaveBeenCalled();
      expect(mockWorkflowService.getActiveExecutions).toHaveBeenCalled();
    });

    it('should handle workflow service initialization errors', async () => {
      const { WorkflowService } = require('../../services/index.js');
      WorkflowService.getInstance.mockImplementation(() => {
        throw new Error('Service initialization error');
      });

      await workflowsHandlers.getActiveWorkflows.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get active workflows'
      });
    });
  });

  describe('Response format validation', () => {
    it('should return properly formatted successful responses', async () => {
      const mockExecution = { id: 'test', status: 'completed' };
      mockWorkflowService.getExecution.mockReturnValue(mockExecution);

      await workflowsHandlers.getWorkflowExecution.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      const responseCall = mockResponse.json.mock.calls[0][0];
      expect(responseCall).toHaveProperty('success', true);
      expect(responseCall).toHaveProperty('data');
      expect(responseCall.data).toEqual(mockExecution);
    });

    it('should return properly formatted error responses', async () => {
      mockWorkflowService.getExecution.mockReturnValue(null);

      await workflowsHandlers.getWorkflowExecution.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      const responseCall = mockResponse.json.mock.calls[0][0];
      expect(responseCall).toHaveProperty('success', false);
      expect(responseCall).toHaveProperty('error');
      expect(typeof responseCall.error).toBe('string');
    });
  });
});