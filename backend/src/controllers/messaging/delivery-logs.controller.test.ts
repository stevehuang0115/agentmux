import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import * as deliveryLogsHandlers from './delivery-logs.controller.js';
import type { ApiContext } from '../types.js';

describe('Delivery Logs Handlers', () => {
  let mockApiContext: Partial<ApiContext>;
  let mockRequest: Partial<Request>;
  let mockResponse: any;
  let mockStorageService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStorageService = {
      getDeliveryLogs: jest.fn(),
      clearDeliveryLogs: jest.fn()
    };

    mockApiContext = {
      storageService: mockStorageService
    } as any;

    mockRequest = {
      params: {},
      body: {},
      query: {}
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    } as any;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getDeliveryLogs', () => {
    it('should return delivery logs successfully', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          scheduledMessageId: 'message-1',
          messageName: 'Test Message 1',
          targetTeam: 'dev-team',
          targetProject: 'project-1',
          message: 'Hello dev team',
          success: true,
          deliveredAt: '2024-01-01T00:00:00Z',
          error: null
        },
        {
          id: 'log-2',
          scheduledMessageId: 'message-2',
          messageName: 'Test Message 2',
          targetTeam: 'qa-team',
          targetProject: 'project-2',
          message: 'Hello QA team',
          success: false,
          deliveredAt: '2024-01-01T01:00:00Z',
          error: 'Session not found'
        }
      ];

      mockStorageService.getDeliveryLogs.mockResolvedValue(mockLogs);

      await deliveryLogsHandlers.getDeliveryLogs.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getDeliveryLogs).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockLogs,
        message: 'Delivery logs retrieved successfully'
      });
    });

    it('should return empty array when no logs exist', async () => {
      mockStorageService.getDeliveryLogs.mockResolvedValue([]);

      await deliveryLogsHandlers.getDeliveryLogs.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getDeliveryLogs).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        message: 'Delivery logs retrieved successfully'
      });
    });

    it('should handle storage service errors', async () => {
      const error = new Error('Database connection failed');
      mockStorageService.getDeliveryLogs.mockRejectedValue(error);

      await deliveryLogsHandlers.getDeliveryLogs.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getDeliveryLogs).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get delivery logs'
      });
    });

    it('should handle null return from storage service', async () => {
      mockStorageService.getDeliveryLogs.mockResolvedValue(null);

      await deliveryLogsHandlers.getDeliveryLogs.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: null,
        message: 'Delivery logs retrieved successfully'
      });
    });

    it('should handle undefined return from storage service', async () => {
      mockStorageService.getDeliveryLogs.mockResolvedValue(undefined);

      await deliveryLogsHandlers.getDeliveryLogs.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: undefined,
        message: 'Delivery logs retrieved successfully'
      });
    });

    it('should handle storage service timeout', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockStorageService.getDeliveryLogs.mockRejectedValue(timeoutError);

      await deliveryLogsHandlers.getDeliveryLogs.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get delivery logs'
      });
    });
  });

  describe('clearDeliveryLogs', () => {
    it('should clear delivery logs successfully', async () => {
      mockStorageService.clearDeliveryLogs.mockResolvedValue(undefined);

      await deliveryLogsHandlers.clearDeliveryLogs.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.clearDeliveryLogs).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Delivery logs cleared successfully'
      });
    });

    it('should handle storage service errors during clear', async () => {
      const error = new Error('Failed to clear logs');
      mockStorageService.clearDeliveryLogs.mockRejectedValue(error);

      await deliveryLogsHandlers.clearDeliveryLogs.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.clearDeliveryLogs).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to clear delivery logs'
      });
    });

    it('should handle permission errors during clear', async () => {
      const permissionError = new Error('Permission denied');
      permissionError.name = 'PermissionError';
      mockStorageService.clearDeliveryLogs.mockRejectedValue(permissionError);

      await deliveryLogsHandlers.clearDeliveryLogs.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to clear delivery logs'
      });
    });

    it('should handle storage service returning error status', async () => {
      mockStorageService.clearDeliveryLogs.mockResolvedValue({ success: false, error: 'Constraint violation' });

      // Note: The handler doesn't check the return value, it assumes success if no exception is thrown
      await deliveryLogsHandlers.clearDeliveryLogs.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Delivery logs cleared successfully'
      });
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle unexpected errors gracefully in getDeliveryLogs', async () => {
      mockStorageService.getDeliveryLogs.mockImplementation(() => {
        throw new TypeError('Unexpected type error');
      });

      await deliveryLogsHandlers.getDeliveryLogs.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get delivery logs'
      });
    });

    it('should handle unexpected errors gracefully in clearDeliveryLogs', async () => {
      mockStorageService.clearDeliveryLogs.mockImplementation(() => {
        throw new ReferenceError('Unexpected reference error');
      });

      await deliveryLogsHandlers.clearDeliveryLogs.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to clear delivery logs'
      });
    });

    it('should handle null storage service', async () => {
      mockApiContext.storageService = null as any;

      await deliveryLogsHandlers.getDeliveryLogs.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get delivery logs'
      });
    });

    it('should handle undefined storage service', async () => {
      mockApiContext.storageService = undefined as any;

      await deliveryLogsHandlers.clearDeliveryLogs.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to clear delivery logs'
      });
    });
  });

  describe('Context preservation', () => {
    it('should preserve context when handling delivery logs operations', async () => {
      const contextAwareController = {
        storageService: {
          getDeliveryLogs: jest.fn().mockResolvedValue([] as any)
        }
      } as any;

      await deliveryLogsHandlers.getDeliveryLogs.call(
        contextAwareController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(contextAwareController.storageService.getDeliveryLogs).toHaveBeenCalled();
    });

    it('should preserve context when clearing delivery logs', async () => {
      const contextAwareController = {
        storageService: {
          clearDeliveryLogs: jest.fn().mockResolvedValue(undefined as any)
        }
      } as any;

      await deliveryLogsHandlers.clearDeliveryLogs.call(
        contextAwareController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(contextAwareController.storageService.clearDeliveryLogs).toHaveBeenCalled();
    });
  });

  describe('All handlers availability', () => {
    it('should have all expected handler functions', () => {
      expect(typeof deliveryLogsHandlers.getDeliveryLogs).toBe('function');
      expect(typeof deliveryLogsHandlers.clearDeliveryLogs).toBe('function');
    });

    it('should handle async operations properly', async () => {
      mockStorageService.getDeliveryLogs.mockResolvedValue([]);

      const result = await deliveryLogsHandlers.getDeliveryLogs.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(result).toBeUndefined();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        message: 'Delivery logs retrieved successfully'
      });
    });
  });

  describe('Response format validation', () => {
    it('should return properly formatted successful response for getDeliveryLogs', async () => {
      const mockLogs = [{ id: 'log-1', success: true }];
      mockStorageService.getDeliveryLogs.mockResolvedValue(mockLogs);

      await deliveryLogsHandlers.getDeliveryLogs.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      const responseCall = mockResponse.json.mock.calls[0][0];
      expect(responseCall).toHaveProperty('success', true);
      expect(responseCall).toHaveProperty('data');
      expect(responseCall).toHaveProperty('message');
      expect(responseCall.data).toEqual(mockLogs);
      expect(typeof responseCall.message).toBe('string');
    });

    it('should return properly formatted successful response for clearDeliveryLogs', async () => {
      mockStorageService.clearDeliveryLogs.mockResolvedValue(undefined);

      await deliveryLogsHandlers.clearDeliveryLogs.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      const responseCall = mockResponse.json.mock.calls[0][0];
      expect(responseCall).toHaveProperty('success', true);
      expect(responseCall).toHaveProperty('message');
      expect(typeof responseCall.message).toBe('string');
      expect(responseCall).not.toHaveProperty('data');
    });

    it('should return properly formatted error responses', async () => {
      mockStorageService.getDeliveryLogs.mockRejectedValue(new Error('Test error'));

      await deliveryLogsHandlers.getDeliveryLogs.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      const responseCall = mockResponse.json.mock.calls[0][0];
      expect(responseCall).toHaveProperty('success', false);
      expect(responseCall).toHaveProperty('error');
      expect(typeof responseCall.error).toBe('string');
      expect(responseCall).not.toHaveProperty('data');
    });
  });

  describe('Console logging', () => {
    it('should log errors to console when getDeliveryLogs fails', async () => {
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      const error = new Error('Test storage error');
      mockStorageService.getDeliveryLogs.mockRejectedValue(error);

      await deliveryLogsHandlers.getDeliveryLogs.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(console.error).toHaveBeenCalledWith('Error getting delivery logs:', error);
      
      console.error = originalConsoleError;
    });

    it('should log errors to console when clearDeliveryLogs fails', async () => {
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      const error = new Error('Test clear error');
      mockStorageService.clearDeliveryLogs.mockRejectedValue(error);

      await deliveryLogsHandlers.clearDeliveryLogs.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(console.error).toHaveBeenCalledWith('Error clearing delivery logs:', error);
      
      console.error = originalConsoleError;
    });
  });
});