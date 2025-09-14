import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import * as scheduledMessagesHandlers from './scheduled-messages.controller.js';
import type { ApiContext } from '../types.js';
import { AGENTMUX_CONSTANTS } from '../../../../config/constants.js';

jest.mock('../../models/index.js', () => ({
  ScheduledMessageModel: {
    create: jest.fn(),
    update: jest.fn(),
    updateLastRun: jest.fn()
  },
  MessageDeliveryLogModel: {
    create: jest.fn()
  }
}));

describe('Scheduled Messages Handlers', () => {
  let mockApiContext: Partial<ApiContext>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockStorageService: any;
  let mockTmuxService: any;
  let mockMessageSchedulerService: any;
  let mockScheduledMessageModel: any;
  let mockMessageDeliveryLogModel: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const { ScheduledMessageModel, MessageDeliveryLogModel } = require('../../models/index.js');
    mockScheduledMessageModel = ScheduledMessageModel;
    mockMessageDeliveryLogModel = MessageDeliveryLogModel;

    mockStorageService = {
      getScheduledMessages: jest.fn(),
      getScheduledMessage: jest.fn(),
      saveScheduledMessage: jest.fn(),
      deleteScheduledMessage: jest.fn(),
      saveDeliveryLog: jest.fn()
    };

    mockTmuxService = {
      sendMessage: jest.fn()
    };

    mockMessageSchedulerService = {
      scheduleMessage: jest.fn(),
      cancelMessage: jest.fn()
    };

    mockApiContext = {
      storageService: mockStorageService,
      tmuxService: mockTmuxService,
      messageSchedulerService: mockMessageSchedulerService
    } as any;

    mockRequest = {
      params: { id: 'message-123' },
      body: {
        name: 'Test Message',
        targetTeam: 'dev-team',
        targetProject: 'test-project',
        message: 'Test message content',
        delayAmount: '30',
        delayUnit: 'minutes',
        isRecurring: true,
        isActive: true
      },
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

  describe('createScheduledMessage', () => {
    it('should create scheduled message successfully', async () => {
      const mockScheduledMessage = {
        id: 'message-456',
        name: 'Test Message',
        targetTeam: 'dev-team',
        message: 'Test message content',
        delayAmount: 30,
        delayUnit: 'minutes',
        isRecurring: true,
        isActive: true
      };

      mockScheduledMessageModel.create.mockReturnValue(mockScheduledMessage);
      mockStorageService.saveScheduledMessage.mockResolvedValue(undefined);

      await scheduledMessagesHandlers.createScheduledMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockScheduledMessageModel.create).toHaveBeenCalledWith({
        name: 'Test Message',
        targetTeam: 'dev-team',
        targetProject: 'test-project',
        message: 'Test message content',
        delayAmount: 30,
        delayUnit: 'minutes',
        isRecurring: true,
        isActive: true
      });
      expect(mockStorageService.saveScheduledMessage).toHaveBeenCalledWith(mockScheduledMessage);
      expect(mockMessageSchedulerService.scheduleMessage).toHaveBeenCalledWith(mockScheduledMessage);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockScheduledMessage,
        message: 'Scheduled message created successfully'
      });
    });

    it('should return 400 when required fields are missing', async () => {
      const requiredFields = ['name', 'targetTeam', 'message', 'delayAmount', 'delayUnit'];
      
      for (const field of requiredFields) {
        jest.clearAllMocks();
        
        const requestBody = { ...mockRequest.body };
        delete requestBody[field];
        mockRequest.body = requestBody;

        await scheduledMessagesHandlers.createScheduledMessage.call(
          mockApiContext as ApiContext,
          mockRequest as Request,
          mockResponse as Response
        );

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: 'Missing required fields: name, targetTeam, message, delayAmount, and delayUnit'
        });
        expect(mockStorageService.saveScheduledMessage).not.toHaveBeenCalled();
      }
    });

    it('should handle missing messageSchedulerService gracefully', async () => {
      const mockScheduledMessage = { id: 'message-456' };
      mockScheduledMessageModel.create.mockReturnValue(mockScheduledMessage);
      mockStorageService.saveScheduledMessage.mockResolvedValue(undefined);
      
      mockApiContext.messageSchedulerService = undefined;

      await scheduledMessagesHandlers.createScheduledMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.saveScheduledMessage).toHaveBeenCalledWith(mockScheduledMessage);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockScheduledMessage,
        message: 'Scheduled message created successfully'
      });
    });

    it('should handle storage service errors', async () => {
      mockScheduledMessageModel.create.mockReturnValue({ id: 'message-456' });
      mockStorageService.saveScheduledMessage.mockRejectedValue(new Error('Storage error'));

      await scheduledMessagesHandlers.createScheduledMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to create scheduled message'
      });
    });
  });

  describe('getScheduledMessages', () => {
    it('should return all scheduled messages successfully', async () => {
      const mockMessages = [
        { id: 'message-1', name: 'Message 1', isActive: true },
        { id: 'message-2', name: 'Message 2', isActive: false }
      ];

      mockStorageService.getScheduledMessages.mockResolvedValue(mockMessages);

      await scheduledMessagesHandlers.getScheduledMessages.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getScheduledMessages).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockMessages
      });
    });

    it('should handle storage service errors', async () => {
      mockStorageService.getScheduledMessages.mockRejectedValue(new Error('Storage error'));

      await scheduledMessagesHandlers.getScheduledMessages.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get scheduled messages'
      });
    });
  });

  describe('getScheduledMessage', () => {
    it('should return specific scheduled message successfully', async () => {
      const mockMessage = { id: 'message-123', name: 'Test Message' };
      mockStorageService.getScheduledMessage.mockResolvedValue(mockMessage);

      await scheduledMessagesHandlers.getScheduledMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getScheduledMessage).toHaveBeenCalledWith('message-123');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockMessage
      });
    });

    it('should return 404 when scheduled message not found', async () => {
      mockStorageService.getScheduledMessage.mockResolvedValue(null);

      await scheduledMessagesHandlers.getScheduledMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Scheduled message not found'
      });
    });

    it('should handle storage service errors', async () => {
      mockStorageService.getScheduledMessage.mockRejectedValue(new Error('Storage error'));

      await scheduledMessagesHandlers.getScheduledMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get scheduled message'
      });
    });
  });

  describe('updateScheduledMessage', () => {
    it('should update scheduled message successfully', async () => {
      const mockExistingMessage = { id: 'message-123', name: 'Old Name' };
      const mockUpdatedMessage = { id: 'message-123', name: 'New Name' };

      mockStorageService.getScheduledMessage.mockResolvedValue(mockExistingMessage);
      mockScheduledMessageModel.update.mockReturnValue(mockUpdatedMessage);
      mockStorageService.saveScheduledMessage.mockResolvedValue(undefined);

      await scheduledMessagesHandlers.updateScheduledMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getScheduledMessage).toHaveBeenCalledWith('message-123');
      expect(mockScheduledMessageModel.update).toHaveBeenCalledWith(mockExistingMessage, {
        name: 'Test Message',
        targetTeam: 'dev-team',
        targetProject: 'test-project',
        message: 'Test message content',
        delayAmount: 30,
        delayUnit: 'minutes',
        isRecurring: true,
        isActive: true
      });
      expect(mockStorageService.saveScheduledMessage).toHaveBeenCalledWith(mockUpdatedMessage);
      expect(mockMessageSchedulerService.scheduleMessage).toHaveBeenCalledWith(mockUpdatedMessage);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedMessage,
        message: 'Scheduled message updated successfully'
      });
    });

    it('should return 404 when scheduled message not found for update', async () => {
      mockStorageService.getScheduledMessage.mockResolvedValue(null);

      await scheduledMessagesHandlers.updateScheduledMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Scheduled message not found'
      });
      expect(mockScheduledMessageModel.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteScheduledMessage', () => {
    it('should delete scheduled message successfully', async () => {
      mockStorageService.deleteScheduledMessage.mockResolvedValue(true);

      await scheduledMessagesHandlers.deleteScheduledMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.deleteScheduledMessage).toHaveBeenCalledWith('message-123');
      expect(mockMessageSchedulerService.cancelMessage).toHaveBeenCalledWith('message-123');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Scheduled message deleted successfully'
      });
    });

    it('should return 404 when scheduled message not found for deletion', async () => {
      mockStorageService.deleteScheduledMessage.mockResolvedValue(false);

      await scheduledMessagesHandlers.deleteScheduledMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Scheduled message not found'
      });
    });
  });

  describe('toggleScheduledMessage', () => {
    it('should activate scheduled message when isActive is true', async () => {
      const mockExistingMessage = { id: 'message-123', isActive: false };
      const mockUpdatedMessage = { id: 'message-123', isActive: true };

      mockStorageService.getScheduledMessage.mockResolvedValue(mockExistingMessage);
      mockScheduledMessageModel.update.mockReturnValue(mockUpdatedMessage);
      mockStorageService.saveScheduledMessage.mockResolvedValue(undefined);

      await scheduledMessagesHandlers.toggleScheduledMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockScheduledMessageModel.update).toHaveBeenCalledWith(mockExistingMessage, { isActive: true });
      expect(mockMessageSchedulerService.scheduleMessage).toHaveBeenCalledWith(mockUpdatedMessage);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedMessage,
        message: 'Scheduled message activated'
      });
    });

    it('should deactivate scheduled message when isActive is false', async () => {
      const mockExistingMessage = { id: 'message-123', isActive: true };
      const mockUpdatedMessage = { id: 'message-123', isActive: false };

      mockStorageService.getScheduledMessage.mockResolvedValue(mockExistingMessage);
      mockScheduledMessageModel.update.mockReturnValue(mockUpdatedMessage);
      mockStorageService.saveScheduledMessage.mockResolvedValue(undefined);

      mockRequest.body = { isActive: false };

      await scheduledMessagesHandlers.toggleScheduledMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockScheduledMessageModel.update).toHaveBeenCalledWith(mockExistingMessage, { isActive: false });
      expect(mockMessageSchedulerService.cancelMessage).toHaveBeenCalledWith('message-123');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedMessage,
        message: 'Scheduled message deactivated'
      });
    });

    it('should toggle isActive when no isActive value provided', async () => {
      const mockExistingMessage = { id: 'message-123', isActive: true };
      const mockUpdatedMessage = { id: 'message-123', isActive: false };

      mockStorageService.getScheduledMessage.mockResolvedValue(mockExistingMessage);
      mockScheduledMessageModel.update.mockReturnValue(mockUpdatedMessage);
      mockStorageService.saveScheduledMessage.mockResolvedValue(undefined);

      mockRequest.body = {};

      await scheduledMessagesHandlers.toggleScheduledMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockScheduledMessageModel.update).toHaveBeenCalledWith(mockExistingMessage, { isActive: false });
      expect(mockMessageSchedulerService.cancelMessage).toHaveBeenCalledWith('message-123');
    });

    it('should return 404 when scheduled message not found for toggle', async () => {
      mockStorageService.getScheduledMessage.mockResolvedValue(null);

      await scheduledMessagesHandlers.toggleScheduledMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Scheduled message not found'
      });
    });
  });

  describe('runScheduledMessage', () => {
    it('should run scheduled message successfully', async () => {
      const mockScheduledMessage = {
        id: 'message-123',
        name: 'Test Message',
        targetTeam: 'dev-team',
        message: 'Hello team',
        targetProject: 'test-project'
      };
      const mockDeliveryLog = {
        id: 'log-456',
        scheduledMessageId: 'message-123',
        success: true
      };
      const mockUpdatedMessage = { ...mockScheduledMessage, lastRunAt: expect.any(String) };

      mockStorageService.getScheduledMessage.mockResolvedValue(mockScheduledMessage);
      mockTmuxService.sendMessage.mockResolvedValue(undefined);
      mockMessageDeliveryLogModel.create.mockReturnValue(mockDeliveryLog);
      mockStorageService.saveDeliveryLog.mockResolvedValue(undefined);
      mockScheduledMessageModel.updateLastRun.mockReturnValue(mockUpdatedMessage);
      mockStorageService.saveScheduledMessage.mockResolvedValue(undefined);

      await scheduledMessagesHandlers.runScheduledMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTmuxService.sendMessage).toHaveBeenCalledWith('dev-team', 'Hello team');
      expect(mockMessageDeliveryLogModel.create).toHaveBeenCalledWith({
        scheduledMessageId: 'message-123',
        messageName: 'Test Message',
        targetTeam: 'dev-team',
        targetProject: 'test-project',
        message: 'Hello team',
        success: true,
        error: undefined
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { delivered: true, deliveryLog: mockDeliveryLog },
        message: 'Scheduled message sent successfully'
      });
    });

    it('should handle orchestrator target team', async () => {
      const mockScheduledMessage = {
        id: 'message-123',
        targetTeam: 'orchestrator',
        message: 'Hello orchestrator'
      };

      mockStorageService.getScheduledMessage.mockResolvedValue(mockScheduledMessage);
      mockTmuxService.sendMessage.mockResolvedValue(undefined);
      mockMessageDeliveryLogModel.create.mockReturnValue({ success: true });
      mockStorageService.saveDeliveryLog.mockResolvedValue(undefined);
      mockScheduledMessageModel.updateLastRun.mockReturnValue(mockScheduledMessage);
      mockStorageService.saveScheduledMessage.mockResolvedValue(undefined);

      await scheduledMessagesHandlers.runScheduledMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTmuxService.sendMessage).toHaveBeenCalledWith(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME, 'Hello orchestrator');
    });

    it('should handle tmux service errors during message sending', async () => {
      const mockScheduledMessage = {
        id: 'message-123',
        name: 'Test Message',
        targetTeam: 'dev-team',
        message: 'Hello team'
      };
      const sendError = new Error('Send failed');
      const mockDeliveryLog = {
        scheduledMessageId: 'message-123',
        success: false,
        error: 'Send failed'
      };

      mockStorageService.getScheduledMessage.mockResolvedValue(mockScheduledMessage);
      mockTmuxService.sendMessage.mockRejectedValue(sendError);
      mockMessageDeliveryLogModel.create.mockReturnValue(mockDeliveryLog);
      mockStorageService.saveDeliveryLog.mockResolvedValue(undefined);
      mockScheduledMessageModel.updateLastRun.mockReturnValue(mockScheduledMessage);
      mockStorageService.saveScheduledMessage.mockResolvedValue(undefined);

      await scheduledMessagesHandlers.runScheduledMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockMessageDeliveryLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Send failed'
        })
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { delivered: false, deliveryLog: mockDeliveryLog },
        message: 'Failed to send message: Send failed'
      });
    });

    it('should return 404 when scheduled message not found for running', async () => {
      mockStorageService.getScheduledMessage.mockResolvedValue(null);

      await scheduledMessagesHandlers.runScheduledMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Scheduled message not found'
      });
      expect(mockTmuxService.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle storage service errors during run', async () => {
      const mockScheduledMessage = { id: 'message-123' };
      mockStorageService.getScheduledMessage.mockResolvedValue(mockScheduledMessage);
      mockStorageService.saveDeliveryLog.mockRejectedValue(new Error('Storage error'));

      await scheduledMessagesHandlers.runScheduledMessage.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to run scheduled message'
      });
    });
  });

  describe('Context preservation', () => {
    it('should preserve context when handling scheduled messages', async () => {
      const contextAwareController = {
        storageService: {
          getScheduledMessages: jest.fn().mockResolvedValue([])
        }
      } as any;

      await scheduledMessagesHandlers.getScheduledMessages.call(
        contextAwareController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(contextAwareController.storageService.getScheduledMessages).toHaveBeenCalled();
    });
  });

  describe('All handlers availability', () => {
    it('should have all expected handler functions', () => {
      expect(typeof scheduledMessagesHandlers.createScheduledMessage).toBe('function');
      expect(typeof scheduledMessagesHandlers.getScheduledMessages).toBe('function');
      expect(typeof scheduledMessagesHandlers.getScheduledMessage).toBe('function');
      expect(typeof scheduledMessagesHandlers.updateScheduledMessage).toBe('function');
      expect(typeof scheduledMessagesHandlers.deleteScheduledMessage).toBe('function');
      expect(typeof scheduledMessagesHandlers.toggleScheduledMessage).toBe('function');
      expect(typeof scheduledMessagesHandlers.runScheduledMessage).toBe('function');
    });

    it('should handle async operations properly', async () => {
      mockStorageService.getScheduledMessages.mockResolvedValue([]);

      const result = await scheduledMessagesHandlers.getScheduledMessages.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(result).toBeUndefined();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });
  });
});