/**
 * Tests for SchedulerService
 *
 * @module services/workflow/scheduler.service.test
 */

import { SchedulerService } from './scheduler.service.js';
import { StorageService } from '../core/storage.service.js';
import { LoggerService } from '../core/logger.service.js';
import { MessageDeliveryLogModel } from '../../models/ScheduledMessage.js';
import {
  ISessionBackend,
  ISession,
  setSessionBackendForTesting,
  resetSessionBackendFactory,
} from '../session/index.js';
import {
  DEFAULT_SCHEDULES,
  DEFAULT_ADAPTIVE_CONFIG,
} from '../../types/scheduler.types.js';

// Mock dependencies
jest.mock('../core/storage.service.js');
jest.mock('../core/logger.service.js');
jest.mock('../../models/ScheduledMessage.js');

describe('SchedulerService', () => {
  let service: SchedulerService;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockSessionBackend: jest.Mocked<ISessionBackend>;
  let mockSession: jest.Mocked<ISession>;
  let mockLogger: any;

  const mockDeliveryLog = {
    id: 'log-1',
    scheduledMessageId: expect.any(String),
    messageName: expect.any(String),
    targetTeam: 'test-session',
    targetProject: '',
    message: expect.any(String),
    deliveredAt: expect.any(String),
    success: true,
    createdAt: expect.any(String),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Create mock session
    mockSession = {
      name: 'test-session',
      pid: 1234,
      cwd: '/test',
      onData: jest.fn().mockReturnValue(() => {}),
      onExit: jest.fn().mockReturnValue(() => {}),
      write: jest.fn(),
      resize: jest.fn(),
      kill: jest.fn(),
    };

    // Create mock session backend
    mockSessionBackend = {
      createSession: jest.fn().mockResolvedValue(mockSession),
      getSession: jest.fn().mockReturnValue(mockSession),
      killSession: jest.fn().mockResolvedValue(undefined),
      listSessions: jest.fn().mockReturnValue(['test-session']),
      sessionExists: jest.fn().mockReturnValue(true),
      captureOutput: jest.fn().mockReturnValue(''),
      getTerminalBuffer: jest.fn().mockReturnValue(''),
      getRawHistory: jest.fn().mockReturnValue(''),
      destroy: jest.fn().mockResolvedValue(undefined),
    };

    // Set the mock backend for testing
    setSessionBackendForTesting(mockSessionBackend, 'pty');

    mockStorageService = {
      saveDeliveryLog: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    (LoggerService.getInstance as jest.Mock).mockReturnValue({
      createComponentLogger: jest.fn().mockReturnValue(mockLogger),
    });

    (MessageDeliveryLogModel.create as jest.Mock).mockReturnValue(mockDeliveryLog);

    service = new SchedulerService(mockStorageService);
  });

  afterEach(() => {
    jest.useRealTimers();
    service.cleanup();
    resetSessionBackendFactory();
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
      expect(emitSpy).toHaveBeenCalledWith(
        'check_scheduled',
        expect.objectContaining({
          id: checkId,
          targetSession: 'test-session',
          message: 'Test message',
          isRecurring: false,
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Scheduled check-in',
        expect.objectContaining({
          checkId,
          targetSession: 'test-session',
          minutes: 5,
        })
      );
    });

    it('should execute check after delay', async () => {
      const emitSpy = jest.spyOn(service, 'emit');

      const checkId = service.scheduleCheck('test-session', 1, 'Test message');

      // Fast forward 1 minute
      jest.advanceTimersByTime(60000);
      await jest.runAllTimersAsync();

      expect(mockSession.write).toHaveBeenCalledWith('Test message\n');
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

    it('should schedule with custom message type', () => {
      const checkId = service.scheduleCheck(
        'test-session',
        5,
        'Progress check',
        'progress-check'
      );

      const enhanced = service.getEnhancedMessage(checkId);
      expect(enhanced?.type).toBe('progress-check');
    });
  });

  describe('scheduleRecurringCheck', () => {
    it('should schedule a recurring check', () => {
      const emitSpy = jest.spyOn(service, 'emit');

      const checkId = service.scheduleRecurringCheck('test-session', 10, 'Recurring message');

      expect(checkId).toBeTruthy();
      expect(emitSpy).toHaveBeenCalledWith(
        'recurring_check_scheduled',
        expect.objectContaining({
          id: checkId,
          targetSession: 'test-session',
          message: 'Recurring message',
          isRecurring: true,
          intervalMinutes: 10,
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Scheduled recurring check-in',
        expect.objectContaining({
          checkId,
          targetSession: 'test-session',
          intervalMinutes: 10,
        })
      );
    });

    it('should store recurring check in recurringChecks map', () => {
      const checkId = service.scheduleRecurringCheck('test-session', 10, 'Recurring message');

      const stats = service.getStats();
      expect(stats.recurringChecks).toBe(1);
    });

    it('should execute recurring checks multiple times', async () => {
      service.scheduleRecurringCheck('test-session', 1, 'Recurring message');

      // Fast forward through multiple intervals - use Promise.resolve() to allow async operations to complete
      jest.advanceTimersByTime(60000); // First execution
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(60000); // Second execution
      await Promise.resolve();
      await Promise.resolve();

      expect(mockSession.write).toHaveBeenCalledTimes(2);
    });

    it('should track occurrence count', async () => {
      const checkId = service.scheduleRecurringCheck('test-session', 1, 'Recurring message');

      jest.advanceTimersByTime(60000);
      await Promise.resolve();
      await Promise.resolve();

      const enhanced = service.getEnhancedMessage(checkId);
      expect(enhanced?.recurring?.currentOccurrence).toBe(1);
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
        DEFAULT_SCHEDULES.initialCheck,
        expect.stringContaining('Initial check-in'),
        'check-in'
      );
      expect(scheduleRecurringSpy).toHaveBeenCalledWith(
        'new-agent-session',
        DEFAULT_SCHEDULES.progressCheck,
        expect.stringContaining('Regular check-in'),
        'progress-check'
      );
      expect(scheduleRecurringSpy).toHaveBeenCalledWith(
        'new-agent-session',
        DEFAULT_SCHEDULES.commitReminder,
        expect.stringContaining('Git reminder'),
        'commit-reminder'
      );
    });
  });

  describe('scheduleContinuationCheck', () => {
    it('should schedule a continuation check', () => {
      const emitSpy = jest.spyOn(service, 'emit');

      const checkId = service.scheduleContinuationCheck({
        sessionName: 'test-session',
        delayMinutes: 5,
        agentId: 'agent-1',
        projectPath: '/path/to/project',
      });

      expect(checkId).toBeTruthy();
      expect(emitSpy).toHaveBeenCalledWith('continuation_check_scheduled', {
        checkId,
        sessionName: 'test-session',
        delayMinutes: 5,
      });
    });

    it('should store continuation metadata', () => {
      const checkId = service.scheduleContinuationCheck({
        sessionName: 'test-session',
        delayMinutes: 5,
        agentId: 'agent-1',
        projectPath: '/path/to/project',
      });

      const enhanced = service.getEnhancedMessage(checkId);
      expect(enhanced?.type).toBe('continuation');
      expect(enhanced?.metadata?.triggerContinuation).toBe(true);
      expect(enhanced?.metadata?.agentId).toBe('agent-1');
      expect(enhanced?.metadata?.projectPath).toBe('/path/to/project');
    });

    it('should execute continuation check after delay', async () => {
      const mockContinuationService = {
        handleEvent: jest.fn().mockResolvedValue({}),
      };
      service.setContinuationService(mockContinuationService);

      service.scheduleContinuationCheck({
        sessionName: 'test-session',
        delayMinutes: 1,
        agentId: 'agent-1',
        projectPath: '/path/to/project',
      });

      jest.advanceTimersByTime(60000);
      await jest.runAllTimersAsync();

      expect(mockContinuationService.handleEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: 'explicit_request',
          sessionName: 'test-session',
          agentId: 'agent-1',
          projectPath: '/path/to/project',
        })
      );
    });

    it('should fall back to regular message without continuation service', async () => {
      service.scheduleContinuationCheck({
        sessionName: 'test-session',
        delayMinutes: 1,
      });

      jest.advanceTimersByTime(60000);
      await jest.runAllTimersAsync();

      expect(mockSession.write).toHaveBeenCalledWith(
        expect.stringContaining('Continuation check')
      );
    });

    it('should track continuation checks in stats', () => {
      service.scheduleContinuationCheck({
        sessionName: 'test-session',
        delayMinutes: 5,
      });

      const stats = service.getStats();
      expect(stats.continuationChecks).toBe(1);
    });
  });

  describe('scheduleAdaptiveCheckin', () => {
    it('should schedule adaptive check-in with default config', async () => {
      const checkId = await service.scheduleAdaptiveCheckin('test-session');

      expect(checkId).toBeTruthy();
      expect(service.getStats().adaptiveChecks).toBe(1);
    });

    it('should increase interval for highly active agents', async () => {
      const mockActivityMonitor = {
        getWorkingStatusForSession: jest.fn().mockResolvedValue('in_progress'),
      };
      service.setActivityMonitor(mockActivityMonitor);

      const checkId = await service.scheduleAdaptiveCheckin('test-session', {
        baseInterval: 10,
        minInterval: 5,
        maxInterval: 30,
        adjustmentFactor: 2,
      });

      // Should schedule at 20 minutes (10 * 2)
      const enhanced = service.getEnhancedMessage(checkId);
      const scheduledTime = enhanced?.scheduledFor.getTime();
      const now = Date.now();
      const expectedDelay = 20 * 60 * 1000;

      // Allow some tolerance for execution time
      expect(scheduledTime).toBeGreaterThanOrEqual(now + expectedDelay - 1000);
    });

    it('should decrease interval for idle agents', async () => {
      const mockActivityMonitor = {
        getWorkingStatusForSession: jest.fn().mockResolvedValue('idle'),
      };
      service.setActivityMonitor(mockActivityMonitor);

      const checkId = await service.scheduleAdaptiveCheckin('test-session', {
        baseInterval: 20,
        minInterval: 5,
        maxInterval: 60,
        adjustmentFactor: 2,
      });

      // Should schedule at 10 minutes (20 / 2)
      const enhanced = service.getEnhancedMessage(checkId);
      const scheduledTime = enhanced?.scheduledFor.getTime();
      const now = Date.now();
      const expectedDelay = 10 * 60 * 1000;

      expect(scheduledTime).toBeGreaterThanOrEqual(now + expectedDelay - 1000);
    });

    it('should respect maxInterval limit', async () => {
      const mockActivityMonitor = {
        getWorkingStatusForSession: jest.fn().mockResolvedValue('in_progress'),
      };
      service.setActivityMonitor(mockActivityMonitor);

      const checkId = await service.scheduleAdaptiveCheckin('test-session', {
        baseInterval: 50,
        minInterval: 5,
        maxInterval: 60,
        adjustmentFactor: 2,
      });

      // Should cap at 60 minutes (not 100)
      const enhanced = service.getEnhancedMessage(checkId);
      const scheduledTime = enhanced?.scheduledFor.getTime();
      const now = Date.now();
      const maxDelay = 60 * 60 * 1000;

      expect(scheduledTime).toBeLessThanOrEqual(now + maxDelay + 1000);
    });

    it('should respect minInterval limit', async () => {
      const mockActivityMonitor = {
        getWorkingStatusForSession: jest.fn().mockResolvedValue('idle'),
      };
      service.setActivityMonitor(mockActivityMonitor);

      const checkId = await service.scheduleAdaptiveCheckin('test-session', {
        baseInterval: 8,
        minInterval: 5,
        maxInterval: 60,
        adjustmentFactor: 2,
      });

      // Should cap at 5 minutes (not 4)
      const enhanced = service.getEnhancedMessage(checkId);
      const scheduledTime = enhanced?.scheduledFor.getTime();
      const now = Date.now();
      const minDelay = 5 * 60 * 1000;

      expect(scheduledTime).toBeGreaterThanOrEqual(now + minDelay - 1000);
    });

    it('should handle activity monitor errors gracefully', async () => {
      const mockActivityMonitor = {
        getWorkingStatusForSession: jest.fn().mockRejectedValue(new Error('Monitor error')),
      };
      service.setActivityMonitor(mockActivityMonitor);

      const checkId = await service.scheduleAdaptiveCheckin('test-session');

      // Should still schedule with base interval
      expect(checkId).toBeTruthy();
    });
  });

  describe('cancelCheck', () => {
    it('should cancel one-time check', () => {
      const emitSpy = jest.spyOn(service, 'emit');
      const checkId = service.scheduleCheck('test-session', 5, 'Test message');

      service.cancelCheck(checkId);

      expect(emitSpy).toHaveBeenCalledWith('check_cancelled', { checkId, type: 'one-time' });
      expect(mockLogger.info).toHaveBeenCalledWith('Cancelled one-time check-in', { checkId });
      expect(service.getStats().oneTimeChecks).toBe(0);
    });

    it('should cancel recurring check', () => {
      const emitSpy = jest.spyOn(service, 'emit');
      const checkId = service.scheduleRecurringCheck('test-session', 10, 'Recurring message');

      service.cancelCheck(checkId);

      expect(emitSpy).toHaveBeenCalledWith('check_cancelled', { checkId, type: 'recurring' });
      expect(mockLogger.info).toHaveBeenCalledWith('Cancelled recurring check-in', { checkId });
      expect(service.getStats().recurringChecks).toBe(0);
    });

    it('should cancel continuation check', () => {
      const emitSpy = jest.spyOn(service, 'emit');
      const checkId = service.scheduleContinuationCheck({
        sessionName: 'test-session',
        delayMinutes: 5,
      });

      service.cancelCheck(checkId);

      expect(emitSpy).toHaveBeenCalledWith('check_cancelled', { checkId, type: 'continuation' });
      expect(mockLogger.info).toHaveBeenCalledWith('Cancelled continuation check', { checkId });
      expect(service.getStats().continuationChecks).toBe(0);
    });

    it('should log warning if check not found', () => {
      service.cancelCheck('nonexistent-id');

      expect(mockLogger.warn).toHaveBeenCalledWith('Check-in not found', {
        checkId: 'nonexistent-id',
      });
    });
  });

  describe('cancelAllChecksForSession', () => {
    it('should cancel all checks for specific session', () => {
      const emitSpy = jest.spyOn(service, 'emit');

      // Schedule checks for different sessions
      service.scheduleCheck('session-1', 5, 'Message 1');
      service.scheduleCheck('session-2', 5, 'Message 2');
      const recurringId = service.scheduleRecurringCheck('session-1', 10, 'Recurring for session-1');
      service.scheduleContinuationCheck({
        sessionName: 'session-1',
        delayMinutes: 5,
      });

      service.cancelAllChecksForSession('session-1');

      expect(emitSpy).toHaveBeenCalledWith('session_checks_cancelled', {
        sessionName: 'session-1',
        checkId: recurringId,
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Cancelled all check-ins for session', {
        sessionName: 'session-1',
      });

      // session-1 checks should be removed
      const stats = service.getStats();
      expect(stats.recurringChecks).toBe(0);
    });
  });

  describe('listScheduledChecks', () => {
    it('should list scheduled checks sorted by time', () => {
      service.scheduleRecurringCheck('session-1', 10, 'Message 1');
      service.scheduleRecurringCheck('session-2', 5, 'Message 2');

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
      checks.forEach((check) => {
        expect(check.targetSession).toBe('session-1');
      });
    });
  });

  describe('executeCheck', () => {
    it('should execute check successfully using PTY', async () => {
      const emitSpy = jest.spyOn(service, 'emit');

      await (service as any).executeCheck('test-session', 'Test message');

      expect(mockSessionBackend.sessionExists).toHaveBeenCalledWith('test-session');
      expect(mockSessionBackend.getSession).toHaveBeenCalledWith('test-session');
      expect(mockSession.write).toHaveBeenCalledWith('Test message\n');
      expect(mockLogger.info).toHaveBeenCalledWith('Check-in executed', {
        targetSession: 'test-session',
        messageLength: 12,
      });
      expect(emitSpy).toHaveBeenCalledWith('check_executed', {
        targetSession: 'test-session',
        message: 'Test message',
        executedAt: expect.any(String),
      });
    });

    it('should skip check if session does not exist', async () => {
      mockSessionBackend.sessionExists.mockReturnValue(false);

      await (service as any).executeCheck('nonexistent-session', 'Test message');

      expect(mockSession.write).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Session no longer exists, skipping check-in',
        { targetSession: 'nonexistent-session' }
      );
    });

    it('should handle session not found gracefully', async () => {
      mockSessionBackend.getSession.mockReturnValue(undefined);

      await (service as any).executeCheck('test-session', 'Test message');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Session not found for scheduled message',
        { targetSession: 'test-session' }
      );
    });

    it('should handle write error', async () => {
      const error = new Error('Write error');
      mockSession.write.mockImplementation(() => {
        throw error;
      });
      const emitSpy = jest.spyOn(service, 'emit');

      await (service as any).executeCheck('test-session', 'Test message');

      expect(mockLogger.error).toHaveBeenCalledWith('Error executing check-in', {
        targetSession: 'test-session',
        error: 'Write error',
      });
      expect(emitSpy).toHaveBeenCalledWith('check_execution_failed', {
        targetSession: 'test-session',
        message: 'Test message',
        error: 'Write error',
      });
    });

    it('should create delivery log with correct message name for git reminder', async () => {
      await (service as any).executeCheck('test-session', 'Git reminder: Please commit your changes');

      expect(MessageDeliveryLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messageName: 'Scheduled Git Reminder',
        })
      );
    });

    it('should create delivery log with correct message name for status check', async () => {
      await (service as any).executeCheck('test-session', 'Regular status check message');

      expect(MessageDeliveryLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messageName: 'Scheduled Status Check-in',
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

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error saving scheduler delivery log',
        expect.objectContaining({ error: 'Log save error' })
      );
    });
  });

  describe('executeContinuationCheck', () => {
    it('should call continuation service when configured', async () => {
      const mockContinuationService = {
        handleEvent: jest.fn().mockResolvedValue({}),
      };
      service.setContinuationService(mockContinuationService);

      await (service as any).executeContinuationCheck('test-session', 'agent-1', '/path');

      expect(mockContinuationService.handleEvent).toHaveBeenCalledWith({
        trigger: 'explicit_request',
        sessionName: 'test-session',
        agentId: 'agent-1',
        projectPath: '/path',
        timestamp: expect.any(String),
        metadata: {
          source: 'scheduler',
          scheduledCheck: true,
        },
      });
    });

    it('should handle continuation service errors', async () => {
      const mockContinuationService = {
        handleEvent: jest.fn().mockRejectedValue(new Error('Continuation error')),
      };
      service.setContinuationService(mockContinuationService);

      await (service as any).executeContinuationCheck('test-session', 'agent-1', '/path');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error executing continuation check',
        expect.objectContaining({
          sessionName: 'test-session',
          error: 'Continuation error',
        })
      );
    });
  });

  describe('scheduleRecurringExecution', () => {
    it('should stop recurring execution when check is cancelled', async () => {
      const checkId = service.scheduleRecurringCheck('test-session', 1, 'Test message');

      // Let first execution happen
      jest.advanceTimersByTime(60000);
      await Promise.resolve();
      await Promise.resolve();

      // Cancel the check
      service.cancelCheck(checkId);

      // Fast forward and verify no more executions
      jest.advanceTimersByTime(60000);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockSession.write).toHaveBeenCalledTimes(1); // Only the first execution
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      service.scheduleCheck('session-1', 5, 'Message 1');
      service.scheduleCheck('session-2', 5, 'Message 2');
      service.scheduleRecurringCheck('session-1', 10, 'Recurring 1');
      service.scheduleRecurringCheck('session-3', 10, 'Recurring 2');
      service.scheduleContinuationCheck({
        sessionName: 'session-4',
        delayMinutes: 5,
      });

      const stats = service.getStats();

      expect(stats.oneTimeChecks).toBe(2);
      expect(stats.recurringChecks).toBe(2);
      expect(stats.continuationChecks).toBe(1);
      expect(stats.totalActiveSessions).toBe(4);
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
      service.scheduleContinuationCheck({
        sessionName: 'session-3',
        delayMinutes: 5,
      });

      const initialStats = service.getStats();
      expect(initialStats.oneTimeChecks).toBe(1);
      expect(initialStats.recurringChecks).toBe(1);
      expect(initialStats.continuationChecks).toBe(1);

      service.cleanup();

      const finalStats = service.getStats();
      expect(finalStats.oneTimeChecks).toBe(0);
      expect(finalStats.recurringChecks).toBe(0);
      expect(finalStats.continuationChecks).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Scheduler service cleaned up');
    });
  });

  describe('getEnhancedMessage', () => {
    it('should return enhanced message for scheduled check', () => {
      const checkId = service.scheduleCheck('test-session', 5, 'Test message', 'progress-check');

      const enhanced = service.getEnhancedMessage(checkId);

      expect(enhanced).toBeDefined();
      expect(enhanced?.id).toBe(checkId);
      expect(enhanced?.sessionName).toBe('test-session');
      expect(enhanced?.message).toBe('Test message');
      expect(enhanced?.type).toBe('progress-check');
    });

    it('should return undefined for unknown check ID', () => {
      const enhanced = service.getEnhancedMessage('unknown-id');

      expect(enhanced).toBeUndefined();
    });
  });

  describe('setContinuationService', () => {
    it('should set continuation service for integration', () => {
      const mockContinuationService = {
        handleEvent: jest.fn(),
      };

      service.setContinuationService(mockContinuationService);

      expect(mockLogger.info).toHaveBeenCalledWith('ContinuationService integration enabled');
    });
  });

  describe('setActivityMonitor', () => {
    it('should set activity monitor for adaptive scheduling', () => {
      const mockActivityMonitor = {
        getWorkingStatusForSession: jest.fn(),
      };

      service.setActivityMonitor(mockActivityMonitor);

      expect(mockLogger.info).toHaveBeenCalledWith('ActivityMonitor integration enabled');
    });
  });
});
