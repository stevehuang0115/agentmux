import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { setAuditorSchedulerService, triggerAudit, getAuditorStatus } from './auditor.controller';

describe('Auditor Controller', () => {
  let mockReq: Partial<Request>;
  let mockRes: {
    status: jest.Mock;
    json: jest.Mock;
  };
  let mockNext: jest.Mock;
  let mockScheduler: Record<string, jest.Mock<any>>;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn<any>().mockReturnThis(),
      json: jest.fn<any>(),
    };
    mockNext = jest.fn<any>();

    mockScheduler = {
      trigger: jest.fn<any>(),
      getStatus: jest.fn<any>(),
    };
  });

  describe('setAuditorSchedulerService', () => {
    it('should set the scheduler service for subsequent handler calls', async () => {
      const statusData = { status: 'idle', auditCount: 0 };
      mockScheduler.getStatus.mockReturnValue(statusData);
      setAuditorSchedulerService(mockScheduler as any);

      await getAuditorStatus(mockReq as Request, mockRes as any, mockNext as NextFunction);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: statusData });
    });

    it('should allow replacing the scheduler service instance', async () => {
      const firstScheduler = { trigger: jest.fn<any>(), getStatus: jest.fn<any>() };
      const secondScheduler = { trigger: jest.fn<any>(), getStatus: jest.fn<any>() };

      firstScheduler.getStatus.mockReturnValue({ status: 'first' });
      secondScheduler.getStatus.mockReturnValue({ status: 'second' });

      setAuditorSchedulerService(firstScheduler as any);
      setAuditorSchedulerService(secondScheduler as any);

      await getAuditorStatus(mockReq as Request, mockRes as any, mockNext as NextFunction);
      expect(secondScheduler.getStatus).toHaveBeenCalled();
      expect(firstScheduler.getStatus).not.toHaveBeenCalled();
    });
  });

  describe('triggerAudit', () => {
    it('should return 503 when scheduler not initialized', async () => {
      setAuditorSchedulerService(null as any);
      await triggerAudit(mockReq as Request, mockRes as any, mockNext as NextFunction);
      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Auditor scheduler not initialized',
      });
    });

    it('should return 200 when audit is triggered successfully', async () => {
      const triggerResult = {
        triggered: true,
        source: 'api',
        timestamp: new Date().toISOString(),
      };
      mockScheduler.trigger.mockResolvedValue(triggerResult);
      setAuditorSchedulerService(mockScheduler as any);

      await triggerAudit(mockReq as Request, mockRes as any, mockNext as NextFunction);
      expect(mockScheduler.trigger).toHaveBeenCalledWith('api');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: triggerResult });
    });

    it('should return 409 when audit already running', async () => {
      const triggerResult = {
        triggered: false,
        reason: 'Audit already in progress',
        source: 'api',
        timestamp: new Date().toISOString(),
      };
      mockScheduler.trigger.mockResolvedValue(triggerResult);
      setAuditorSchedulerService(mockScheduler as any);

      await triggerAudit(mockReq as Request, mockRes as any, mockNext as NextFunction);
      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({ success: false, data: triggerResult });
    });

    it('should call next with error when trigger throws', async () => {
      const error = new Error('Unexpected scheduler failure');
      mockScheduler.trigger.mockRejectedValue(error);
      setAuditorSchedulerService(mockScheduler as any);

      await triggerAudit(mockReq as Request, mockRes as any, mockNext as NextFunction);
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should not call next when scheduler is not initialized', async () => {
      setAuditorSchedulerService(null as any);
      await triggerAudit(mockReq as Request, mockRes as any, mockNext as NextFunction);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass the "api" source string to scheduler.trigger', async () => {
      mockScheduler.trigger.mockResolvedValue({ triggered: true });
      setAuditorSchedulerService(mockScheduler as any);

      await triggerAudit(mockReq as Request, mockRes as any, mockNext as NextFunction);
      expect(mockScheduler.trigger).toHaveBeenCalledTimes(1);
      expect(mockScheduler.trigger).toHaveBeenCalledWith('api');
    });
  });

  describe('getAuditorStatus', () => {
    it('should return 503 when scheduler not initialized', async () => {
      setAuditorSchedulerService(null as any);
      await getAuditorStatus(mockReq as Request, mockRes as any, mockNext as NextFunction);
      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Auditor scheduler not initialized',
      });
    });

    it('should return status data on success', async () => {
      const statusData = {
        status: 'idle',
        auditCount: 5,
        lastAuditStart: new Date().toISOString(),
        periodicEnabled: true,
        eventListenerBound: true,
      };
      mockScheduler.getStatus.mockReturnValue(statusData);
      setAuditorSchedulerService(mockScheduler as any);

      await getAuditorStatus(mockReq as Request, mockRes as any, mockNext as NextFunction);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: statusData });
    });

    it('should call next with error when getStatus throws', async () => {
      const error = new Error('Status retrieval failed');
      mockScheduler.getStatus.mockImplementation(() => { throw error; });
      setAuditorSchedulerService(mockScheduler as any);

      await getAuditorStatus(mockReq as Request, mockRes as any, mockNext as NextFunction);
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should not call next when scheduler is not initialized', async () => {
      setAuditorSchedulerService(null as any);
      await getAuditorStatus(mockReq as Request, mockRes as any, mockNext as NextFunction);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should not set explicit status code on success (defaults to 200)', async () => {
      mockScheduler.getStatus.mockReturnValue({ status: 'running' });
      setAuditorSchedulerService(mockScheduler as any);

      await getAuditorStatus(mockReq as Request, mockRes as any, mockNext as NextFunction);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { status: 'running' },
      });
    });

    it('should return whatever shape the scheduler getStatus provides', async () => {
      const complexStatus = {
        status: 'auditing',
        auditCount: 12,
        lastAuditStart: '2026-03-11T10:00:00Z',
        lastAuditEnd: '2026-03-11T10:05:00Z',
        periodicEnabled: false,
        eventListenerBound: true,
        customField: 'extra-data',
      };
      mockScheduler.getStatus.mockReturnValue(complexStatus);
      setAuditorSchedulerService(mockScheduler as any);

      await getAuditorStatus(mockReq as Request, mockRes as any, mockNext as NextFunction);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: complexStatus });
    });
  });
});
