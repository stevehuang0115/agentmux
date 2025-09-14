import { SchedulerService } from './scheduler.service';
import { TmuxService } from '../agent/tmux.service.js';
import { StorageService } from '../core/storage.service.js';
import { ScheduledCheck } from '../../types/index';
import { MessageDeliveryLogModel } from '../../models/ScheduledMessage';

// Mock dependencies
jest.mock('../agent/tmux.service.js');
jest.mock('../core/storage.service.js');
jest.mock('../models/ScheduledMessage');

describe('SchedulerService', () => {
  let service: SchedulerService;
  let mockTmuxService: jest.Mocked<TmuxService>;
  let mockStorageService: jest.Mocked<StorageService>;

  const mockDeliveryLog = {
    id: 'log-1',
    scheduledMessageId: expect.any(String),
    messageName: expect.any(String),
    targetTeam: 'test-session',
    targetProject: '',
    message: expect.any(String),
    deliveredAt: expect.any(String),
    success: true,
    createdAt: expect.any(String)
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockTmuxService = {
      sessionExists: jest.fn(),
      sendMessage: jest.fn()
    } as any;
    
    mockStorageService = {
      saveDeliveryLog: jest.fn()
    } as any;
    
    (MessageDeliveryLogModel.create as jest.Mock).mockReturnValue(mockDeliveryLog);
    
    service = new SchedulerService(mockTmuxService, mockStorageService);
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.useRealTimers();
    service.cleanup();
  });

  describe('constructor', () => {
    it('should initialize with required services', () => {
      expect(service).toBeInstanceOf(SchedulerService);
    });
  });

  describe('scheduleCheck', () => {
    it('should schedule a one-time check', () => {
      const emitSpy = jest.spyOn(service, 'emit');
      
      const checkId = service.scheduleCheck('test-session', 5, 'Test message');
      
      expect(checkId).toBeTruthy();
      expect(emitSpy).toHaveBeenCalledWith('check_scheduled', expect.objectContaining({
        id: checkId,
        targetSession: 'test-session',
        message: 'Test message',
        isRecurring: false
      }));
      expect(console.log).toHaveBeenCalledWith('Scheduled check-in for test-session in 5 minutes: "Test message"');
    });

    it('should execute check after delay', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(true);
      mockTmuxService.sendMessage.mockResolvedValue();
      mockStorageService.saveDeliveryLog.mockResolvedValue();
      
      const executeCheckSpy = jest.spyOn(service as any, 'executeCheck').mockResolvedValue();
      const emitSpy = jest.spyOn(service, 'emit');
      
      const checkId = service.scheduleCheck('test-session', 1, 'Test message');
      
      // Fast forward 1 minute
      jest.advanceTimersByTime(60000);
      await jest.runAllTimersAsync();
      
      expect(executeCheckSpy).toHaveBeenCalledWith('test-session', 'Test message');
      expect(emitSpy).toHaveBeenCalledWith('check_executed', expect.any(Object));
    });

    it('should remove one-time check from scheduled checks after execution', async () => {
      const checkId = service.scheduleCheck('test-session', 1, 'Test message');
      const initialStats = service.getStats();
      expect(initialStats.oneTimeChecks).toBe(1);
      
      jest.advanceTimersByTime(60000);
      await jest.runAllTimersAsync();
      
      const finalStats = service.getStats();
      expect(finalStats.oneTimeChecks).toBe(0);
    });
  });

  describe('scheduleRecurringCheck', () => {
    it('should schedule a recurring check', () => {
      const emitSpy = jest.spyOn(service, 'emit');
      
      const checkId = service.scheduleRecurringCheck('test-session', 10, 'Recurring message');
      
      expect(checkId).toBeTruthy();
      expect(emitSpy).toHaveBeenCalledWith('recurring_check_scheduled', expect.objectContaining({
        id: checkId,
        targetSession: 'test-session',
        message: 'Recurring message',
        isRecurring: true,
        intervalMinutes: 10
      }));
      expect(console.log).toHaveBeenCalledWith('Scheduled recurring check-in for test-session every 10 minutes: "Recurring message"');
    });

    it('should store recurring check in recurringChecks map', () => {
      const checkId = service.scheduleRecurringCheck('test-session', 10, 'Recurring message');
      
      const stats = service.getStats();
      expect(stats.recurringChecks).toBe(1);
    });

    it('should execute recurring checks multiple times', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(true);
      mockTmuxService.sendMessage.mockResolvedValue();
      mockStorageService.saveDeliveryLog.mockResolvedValue();
      
      const executeCheckSpy = jest.spyOn(service as any, 'executeCheck').mockResolvedValue();
      
      service.scheduleRecurringCheck('test-session', 1, 'Recurring message');
      
      // Fast forward through multiple intervals
      jest.advanceTimersByTime(60000); // First execution
      await jest.runAllTimersAsync();
      jest.advanceTimersByTime(60000); // Second execution
      await jest.runAllTimersAsync();
      
      expect(executeCheckSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('scheduleDefaultCheckins', () => {
    it('should schedule default check-ins for new agent', () => {
      const scheduleCheckSpy = jest.spyOn(service, 'scheduleCheck');
      const scheduleRecurringSpy = jest.spyOn(service, 'scheduleRecurringCheck');
      
      const checkIds = service.scheduleDefaultCheckins('new-agent-session');
      
      expect(checkIds).toHaveLength(3);
      expect(scheduleCheckSpy).toHaveBeenCalledWith(
        'new-agent-session',
        5,
        'Initial check-in: How are you getting started? Any immediate questions or blockers?'
      );
      expect(scheduleRecurringSpy).toHaveBeenCalledWith(
        'new-agent-session',
        30,
        'Regular check-in: Please provide a status update. What have you accomplished? What are you working on next? Any blockers?'
      );
      expect(scheduleRecurringSpy).toHaveBeenCalledWith(
        'new-agent-session',
        25,
        'Git reminder: Please ensure you commit your changes. Remember our 30-minute commit discipline.'
      );
    });
  });

  describe('cancelCheck', () => {
    it('should cancel one-time check', () => {
      const emitSpy = jest.spyOn(service, 'emit');
      const checkId = service.scheduleCheck('test-session', 5, 'Test message');
      
      service.cancelCheck(checkId);
      
      expect(emitSpy).toHaveBeenCalledWith('check_cancelled', { checkId, type: 'one-time' });
      expect(console.log).toHaveBeenCalledWith(`Cancelled one-time check-in: ${checkId}`);
      expect(service.getStats().oneTimeChecks).toBe(0);
    });

    it('should cancel recurring check', () => {
      const emitSpy = jest.spyOn(service, 'emit');
      const checkId = service.scheduleRecurringCheck('test-session', 10, 'Recurring message');
      
      service.cancelCheck(checkId);
      
      expect(emitSpy).toHaveBeenCalledWith('check_cancelled', { checkId, type: 'recurring' });
      expect(console.log).toHaveBeenCalledWith(`Cancelled recurring check-in: ${checkId}`);
      expect(service.getStats().recurringChecks).toBe(0);
    });

    it('should log if check not found', () => {
      service.cancelCheck('nonexistent-id');
      
      expect(console.log).toHaveBeenCalledWith('Check-in not found: nonexistent-id');
    });
  });

  describe('cancelAllChecksForSession', () => {
    it('should cancel all checks for specific session', () => {
      const emitSpy = jest.spyOn(service, 'emit');
      
      // Schedule checks for different sessions
      service.scheduleCheck('session-1', 5, 'Message 1');
      service.scheduleCheck('session-2', 5, 'Message 2');
      const recurringId = service.scheduleRecurringCheck('session-1', 10, 'Recurring for session-1');
      
      service.cancelAllChecksForSession('session-1');
      
      expect(emitSpy).toHaveBeenCalledWith('session_checks_cancelled', {
        sessionName: 'session-1',
        checkId: recurringId
      });
      expect(console.log).toHaveBeenCalledWith('Cancelled all check-ins for session: session-1');
      
      // session-1 recurring check should be removed
      const stats = service.getStats();
      expect(stats.recurringChecks).toBe(0);
      // One-time checks are cleared for all (implementation limitation)
      expect(stats.oneTimeChecks).toBe(0);
    });
  });

  describe('listScheduledChecks', () => {
    it('should list scheduled checks sorted by time', () => {
      const checkId1 = service.scheduleRecurringCheck('session-1', 10, 'Message 1');
      const checkId2 = service.scheduleRecurringCheck('session-2', 5, 'Message 2');
      
      const checks = service.listScheduledChecks();
      
      expect(checks).toHaveLength(2);
      expect(checks[0].targetSession).toBe('session-2'); // Should be first (5 minutes)
      expect(checks[1].targetSession).toBe('session-1'); // Should be second (10 minutes)
    });
  });

  describe('getChecksForSession', () => {
    it('should return checks for specific session', () => {
      service.scheduleRecurringCheck('session-1', 10, 'Message 1');
      service.scheduleRecurringCheck('session-2', 10, 'Message 2');
      service.scheduleRecurringCheck('session-1', 15, 'Message 3');
      
      const checks = service.getChecksForSession('session-1');
      
      expect(checks).toHaveLength(2);
      checks.forEach(check => {
        expect(check.targetSession).toBe('session-1');
      });
    });
  });

  describe('executeCheck', () => {
    beforeEach(() => {
      mockTmuxService.sessionExists.mockResolvedValue(true);
      mockTmuxService.sendMessage.mockResolvedValue();
      mockStorageService.saveDeliveryLog.mockResolvedValue();
    });

    it('should execute check successfully', async () => {
      const emitSpy = jest.spyOn(service, 'emit');
      
      await (service as any).executeCheck('test-session', 'Test message');
      
      expect(mockTmuxService.sessionExists).toHaveBeenCalledWith('test-session');
      expect(mockTmuxService.sendMessage).toHaveBeenCalledWith('test-session', 'Test message');
      expect(console.log).toHaveBeenCalledWith('Check-in executed for test-session: "Test message"');
      expect(emitSpy).toHaveBeenCalledWith('check_executed', {
        targetSession: 'test-session',
        message: 'Test message',
        executedAt: expect.any(String)
      });
    });

    it('should skip check if session does not exist', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(false);
      
      await (service as any).executeCheck('nonexistent-session', 'Test message');
      
      expect(mockTmuxService.sendMessage).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Session nonexistent-session no longer exists, skipping check-in');
    });

    it('should handle send message error', async () => {
      const error = new Error('Send error');
      mockTmuxService.sendMessage.mockRejectedValue(error);
      const emitSpy = jest.spyOn(service, 'emit');
      
      await (service as any).executeCheck('test-session', 'Test message');
      
      expect(console.error).toHaveBeenCalledWith('Error executing check-in for test-session:', error);
      expect(emitSpy).toHaveBeenCalledWith('check_execution_failed', {
        targetSession: 'test-session',
        message: 'Test message',
        error: 'Send error'
      });
    });

    it('should create delivery log with correct message name for git reminder', async () => {
      await (service as any).executeCheck('test-session', 'Git reminder: Please commit your changes');
      
      expect(MessageDeliveryLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messageName: 'Scheduled Git Reminder'
        })
      );
    });

    it('should create delivery log with correct message name for status check', async () => {
      await (service as any).executeCheck('test-session', 'Regular status check message');
      
      expect(MessageDeliveryLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messageName: 'Scheduled Status Check-in'
        })
      );
    });

    it('should save delivery log', async () => {
      await (service as any).executeCheck('test-session', 'Test message');
      
      expect(mockStorageService.saveDeliveryLog).toHaveBeenCalledWith(mockDeliveryLog);
    });

    it('should handle delivery log save error gracefully', async () => {
      mockStorageService.saveDeliveryLog.mockRejectedValue(new Error('Log save error'));
      
      await (service as any).executeCheck('test-session', 'Test message');
      
      expect(console.error).toHaveBeenCalledWith('Error saving scheduler delivery log:', expect.any(Error));
    });
  });

  describe('scheduleRecurringExecution', () => {
    it('should stop recurring execution when check is cancelled', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(true);
      mockTmuxService.sendMessage.mockResolvedValue();
      mockStorageService.saveDeliveryLog.mockResolvedValue();
      
      const executeCheckSpy = jest.spyOn(service as any, 'executeCheck').mockResolvedValue();
      const checkId = service.scheduleRecurringCheck('test-session', 1, 'Test message');
      
      // Let first execution happen
      jest.advanceTimersByTime(60000);
      await jest.runAllTimersAsync();
      
      // Cancel the check
      service.cancelCheck(checkId);
      
      // Fast forward and verify no more executions
      jest.advanceTimersByTime(60000);
      await jest.runAllTimersAsync();
      
      expect(executeCheckSpy).toHaveBeenCalledTimes(1); // Only the first execution
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      service.scheduleCheck('session-1', 5, 'Message 1');
      service.scheduleCheck('session-2', 5, 'Message 2');
      service.scheduleRecurringCheck('session-1', 10, 'Recurring 1');
      service.scheduleRecurringCheck('session-3', 10, 'Recurring 2');
      
      const stats = service.getStats();
      
      expect(stats).toEqual({
        oneTimeChecks: 2,
        recurringChecks: 2,
        totalActiveSessions: 3 // session-1, session-2, session-3
      });
    });

    it('should count unique sessions correctly', () => {
      service.scheduleRecurringCheck('session-1', 10, 'Recurring 1');
      service.scheduleRecurringCheck('session-1', 15, 'Recurring 2'); // Same session
      service.scheduleRecurringCheck('session-2', 10, 'Recurring 3');
      
      const stats = service.getStats();
      
      expect(stats.totalActiveSessions).toBe(2); // Only session-1 and session-2
    });
  });

  describe('cleanup', () => {
    it('should cleanup all scheduled checks', () => {
      service.scheduleCheck('session-1', 5, 'Message 1');
      service.scheduleRecurringCheck('session-2', 10, 'Message 2');
      
      const initialStats = service.getStats();
      expect(initialStats.oneTimeChecks).toBe(1);
      expect(initialStats.recurringChecks).toBe(1);
      
      service.cleanup();
      
      const finalStats = service.getStats();
      expect(finalStats.oneTimeChecks).toBe(0);
      expect(finalStats.recurringChecks).toBe(0);
      expect(console.log).toHaveBeenCalledWith('Scheduler service cleaned up');
    });
  });
});