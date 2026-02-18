/**
 * Tests for Messaging Controller
 *
 * @module controllers/messaging/messaging.controller.test
 */

import {
  setMessageQueueService,
  getQueueStatus,
  getPendingMessages,
  getMessageHistory,
  getMessageById,
  cancelMessage,
  clearQueue,
} from './messaging.controller.js';

// Mock LoggerService
jest.mock('../../services/core/logger.service.js', () => ({
  LoggerService: {
    getInstance: () => ({
      createComponentLogger: () => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }),
    }),
  },
}));

describe('MessagingController', () => {
  let mockRes: any;
  let mockNext: jest.Mock;
  let mockQueueService: any;

  beforeEach(() => {
    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();

    mockQueueService = {
      getStatus: jest.fn().mockReturnValue({
        pendingCount: 2,
        isProcessing: true,
        totalProcessed: 5,
        totalFailed: 1,
        historyCount: 6,
      }),
      getPendingMessages: jest.fn().mockReturnValue([
        { id: 'msg-1', content: 'Hello', status: 'pending' },
        { id: 'msg-2', content: 'World', status: 'pending' },
      ]),
      getHistory: jest.fn().mockReturnValue([
        { id: 'msg-0', content: 'Done', status: 'completed' },
      ]),
      getMessage: jest.fn(),
      cancel: jest.fn(),
      clearPending: jest.fn(),
      forceCancelCurrent: jest.fn().mockReturnValue(false),
    };

    setMessageQueueService(mockQueueService);
  });

  afterEach(() => {
    setMessageQueueService(null as any);
  });

  describe('getQueueStatus', () => {
    it('should return queue status', async () => {
      await getQueueStatus({ } as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ pendingCount: 2, isProcessing: true }),
      });
    });

    it('should return 503 when service not initialized', async () => {
      setMessageQueueService(null as any);

      await getQueueStatus({} as any, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
    });
  });

  describe('getPendingMessages', () => {
    it('should return pending messages', async () => {
      await getPendingMessages({} as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([expect.objectContaining({ id: 'msg-1' })]),
        count: 2,
      });
    });

    it('should return 503 when service not initialized', async () => {
      setMessageQueueService(null as any);

      await getPendingMessages({} as any, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
    });
  });

  describe('getMessageHistory', () => {
    it('should return message history', async () => {
      await getMessageHistory({} as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([expect.objectContaining({ id: 'msg-0' })]),
        count: 1,
      });
    });
  });

  describe('getMessageById', () => {
    it('should return message when found', async () => {
      mockQueueService.getMessage.mockReturnValue({ id: 'msg-1', content: 'Hello' });

      await getMessageById(
        { params: { messageId: 'msg-1' } } as any,
        mockRes,
        mockNext
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ id: 'msg-1' }),
      });
    });

    it('should return 404 when not found', async () => {
      mockQueueService.getMessage.mockReturnValue(undefined);

      await getMessageById(
        { params: { messageId: 'nonexistent' } } as any,
        mockRes,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('cancelMessage', () => {
    it('should cancel a pending message', async () => {
      mockQueueService.cancel.mockReturnValue(true);

      await cancelMessage(
        { params: { messageId: 'msg-1' } } as any,
        mockRes,
        mockNext
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Message cancelled',
      });
    });

    it('should return 404 when message not found', async () => {
      mockQueueService.cancel.mockReturnValue(false);

      await cancelMessage(
        { params: { messageId: 'nonexistent' } } as any,
        mockRes,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('clearQueue', () => {
    it('should clear all pending messages', async () => {
      mockQueueService.clearPending.mockReturnValue(3);
      mockQueueService.forceCancelCurrent.mockReturnValue(false);

      await clearQueue({} as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Cleared 3 pending messages',
        data: { clearedCount: 3, cancelledCurrent: false },
      });
    });

    it('should also cancel current processing message', async () => {
      mockQueueService.clearPending.mockReturnValue(2);
      mockQueueService.forceCancelCurrent.mockReturnValue(true);

      await clearQueue({} as any, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Cleared 2 pending messages and cancelled current processing message',
        data: { clearedCount: 2, cancelledCurrent: true },
      });
    });
  });
});
