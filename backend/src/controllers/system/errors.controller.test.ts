import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import * as errorsHandlers from './errors.controller.js';
import type { ApiContext } from '../types.js';
import { StorageService, TmuxService, SchedulerService } from '../../services/index.js';
import { ActiveProjectsService } from '../../services/index.js';
import { PromptTemplateService } from '../../services/index.js';

// Mock dependencies
jest.mock('../../services/index.js');
jest.mock('../../services/index.js');
jest.mock('../../services/index.js');

describe('Errors Handlers', () => {
  let mockApiContext: ApiContext;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockStorageService: jest.Mocked<StorageService>;
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

    // Setup API context
    mockApiContext = {
      storageService: mockStorageService,
      tmuxService: new TmuxService() as jest.Mocked<TmuxService>,
      schedulerService: new SchedulerService() as jest.Mocked<SchedulerService>,
      activeProjectsService: new ActiveProjectsService() as jest.Mocked<ActiveProjectsService>,
      promptTemplateService: new PromptTemplateService() as jest.Mocked<PromptTemplateService>,
    };

    mockRequest = {};
    mockResponse = responseMock as any;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('trackError', () => {
    it('should track error successfully', async () => {
      const mockError = {
        id: 'error-123',
        message: 'Test error message',
        stack: 'Error stack trace',
        timestamp: new Date().toISOString(),
        context: { component: 'test' }
      };

      mockRequest.body = {
        message: 'Test error message',
        stack: 'Error stack trace',
        context: { component: 'test' }
      };

      mockStorageService.trackError.mockResolvedValue(mockError);

      await errorsHandlers.trackError.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.trackError).toHaveBeenCalledWith({
        message: 'Test error message',
        stack: 'Error stack trace',
        context: { component: 'test' }
      });

      expect(responseMock.status).toHaveBeenCalledWith(201);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        error: mockError
      });
    });

    it('should handle minimal error data', async () => {
      mockRequest.body = {
        message: 'Simple error'
      };

      const mockError = {
        id: 'error-456',
        message: 'Simple error',
        timestamp: new Date().toISOString()
      };

      mockStorageService.trackError.mockResolvedValue(mockError);

      await errorsHandlers.trackError.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.trackError).toHaveBeenCalledWith({
        message: 'Simple error'
      });
    });

    it('should handle storage service errors when tracking', async () => {
      mockRequest.body = {
        message: 'Test error'
      };

      mockStorageService.trackError.mockRejectedValue(new Error('Database error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await errorsHandlers.trackError.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error tracking error:', expect.any(Error));
      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to track error'
      });

      consoleSpy.mockRestore();
    });
  });

  describe('getErrors', () => {
    it('should return all errors successfully', async () => {
      const mockErrors = [
        {
          id: 'error-1',
          message: 'First error',
          timestamp: '2024-01-01T00:00:00.000Z',
          resolved: false
        },
        {
          id: 'error-2', 
          message: 'Second error',
          timestamp: '2024-01-01T01:00:00.000Z',
          resolved: true
        }
      ];

      mockStorageService.getErrors.mockResolvedValue(mockErrors);

      await errorsHandlers.getErrors.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getErrors).toHaveBeenCalled();
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        errors: mockErrors
      });
    });

    it('should return empty array when no errors exist', async () => {
      mockStorageService.getErrors.mockResolvedValue([]);

      await errorsHandlers.getErrors.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        errors: []
      });
    });
  });

  describe('getError', () => {
    it('should return specific error successfully', async () => {
      const mockError = {
        id: 'error-123',
        message: 'Specific error',
        stack: 'Stack trace',
        timestamp: '2024-01-01T00:00:00.000Z',
        context: { component: 'api' },
        resolved: false
      };

      mockRequest.params = { id: 'error-123' };
      mockStorageService.getError.mockResolvedValue(mockError);

      await errorsHandlers.getError.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getError).toHaveBeenCalledWith('error-123');
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        error: mockError
      });
    });

    it('should return 404 when error not found', async () => {
      mockRequest.params = { id: 'nonexistent-error' };
      mockStorageService.getError.mockResolvedValue(null);

      await errorsHandlers.getError.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(404);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Error not found'
      });
    });
  });

  describe('getErrorStats', () => {
    it('should return error statistics successfully', async () => {
      const mockStats = {
        total: 42,
        resolved: 30,
        unresolved: 12,
        byComponent: {
          api: 15,
          database: 8,
          frontend: 5
        },
        recent: 3
      };

      mockStorageService.getErrorStats.mockResolvedValue(mockStats);

      await errorsHandlers.getErrorStats.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getErrorStats).toHaveBeenCalled();
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        stats: mockStats
      });
    });

    it('should handle empty stats', async () => {
      const emptyStats = {
        total: 0,
        resolved: 0,
        unresolved: 0,
        byComponent: {},
        recent: 0
      };

      mockStorageService.getErrorStats.mockResolvedValue(emptyStats);

      await errorsHandlers.getErrorStats.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        stats: emptyStats
      });
    });
  });

  describe('clearErrors', () => {
    it('should clear all errors successfully', async () => {
      mockStorageService.clearErrors.mockResolvedValue({ cleared: 15 });

      await errorsHandlers.clearErrors.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.clearErrors).toHaveBeenCalled();
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        message: 'Errors cleared successfully',
        cleared: { cleared: 15 }
      });
    });

    it('should handle clear operation when no errors exist', async () => {
      mockStorageService.clearErrors.mockResolvedValue({ cleared: 0 });

      await errorsHandlers.clearErrors.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        message: 'Errors cleared successfully',
        cleared: { cleared: 0 }
      });
    });

    it('should handle storage service errors when clearing', async () => {
      mockStorageService.clearErrors.mockRejectedValue(new Error('Clear operation failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await errorsHandlers.clearErrors.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error clearing errors:', expect.any(Error));
      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to clear errors'
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Error handling', () => {
    it('should handle storage service errors consistently', async () => {
      const handlerTests = [
        { handler: errorsHandlers.getErrors, setup: () => mockStorageService.getErrors.mockRejectedValue(new Error('DB error')) },
        { handler: errorsHandlers.getErrorStats, setup: () => mockStorageService.getErrorStats.mockRejectedValue(new Error('Stats error')) },
        { handler: errorsHandlers.getError, setup: () => {
          mockRequest.params = { id: 'test-id' };
          mockStorageService.getError.mockRejectedValue(new Error('Get error'));
        }}
      ];

      for (const test of handlerTests) {
        jest.clearAllMocks();
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        test.setup();

        await test.handler.call(
          mockApiContext,
          mockRequest as Request,
          mockResponse as Response
        );

        expect(consoleSpy).toHaveBeenCalled();
        expect(responseMock.status).toHaveBeenCalledWith(500);
        expect(responseMock.json).toHaveBeenCalledWith({
          success: false,
          error: expect.stringContaining('Failed to')
        });

        consoleSpy.mockRestore();
      }
    });
  });

  describe('Input validation', () => {
    it('should handle missing request body in trackError', async () => {
      mockRequest.body = null;

      mockStorageService.trackError.mockResolvedValue({
        id: 'error-123',
        timestamp: new Date().toISOString()
      } as any);

      await errorsHandlers.trackError.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.trackError).toHaveBeenCalledWith(null);
    });

    it('should handle missing error ID parameter', async () => {
      mockRequest.params = {};

      await errorsHandlers.getError.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getError).toHaveBeenCalledWith(undefined);
    });
  });
});