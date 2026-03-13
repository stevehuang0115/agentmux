import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AuditorSchedulerService } from './auditor-scheduler.service.js';
import { AUDITOR_SCHEDULER_CONSTANTS } from '../../constants.js';

describe('AuditorSchedulerService', () => {
  let scheduler: AuditorSchedulerService;
  let mockRuntime: Record<string, jest.Mock<any>>;
  let mockEventBus: Record<string, jest.Mock<any>>;

  const mockAuditResult = {
    text: 'Audit complete',
    steps: 3,
    toolCalls: [{ toolName: 'get_team_status', args: {}, result: {} }],
    usage: { input: 100, output: 200 },
    finishReason: 'end_turn',
  };

  beforeEach(() => {
    jest.useFakeTimers();
    AuditorSchedulerService.resetInstance();
    scheduler = AuditorSchedulerService.getInstance();

    mockRuntime = {
      isReady: jest.fn<any>().mockReturnValue(false),
      initializeInProcess: jest.fn<any>().mockResolvedValue(undefined),
      handleMessage: jest.fn<any>().mockResolvedValue(mockAuditResult),
      shutdown: jest.fn<any>(),
    };

    mockEventBus = {
      on: jest.fn<any>(),
      removeAllListeners: jest.fn<any>(),
    };

    scheduler.setAuditorRuntime(mockRuntime as any);
    scheduler.setEventBusService(mockEventBus as any);
  });

  afterEach(() => {
    scheduler.stop();
    AuditorSchedulerService.resetInstance();
    jest.useRealTimers();
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const a = AuditorSchedulerService.getInstance();
      const b = AuditorSchedulerService.getInstance();
      expect(a).toBe(b);
    });

    it('should create a new instance after resetInstance', () => {
      const a = AuditorSchedulerService.getInstance();
      AuditorSchedulerService.resetInstance();
      const b = AuditorSchedulerService.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe('start/stop', () => {
    it('should set status to idle on start', () => {
      scheduler.start();
      expect(scheduler.getStatus().status).toBe('idle');
    });

    it('should set status to stopped on stop', () => {
      scheduler.start();
      scheduler.stop();
      expect(scheduler.getStatus().status).toBe('stopped');
    });

    it('should not double-start', () => {
      scheduler.start();
      scheduler.start();
      expect(scheduler.getStatus().status).toBe('idle');
    });

    it('should enable periodic timer on start', () => {
      scheduler.start();
      expect(scheduler.getStatus().periodicEnabled).toBe(true);
    });

    it('should disable periodic timer on stop', () => {
      scheduler.start();
      scheduler.stop();
      expect(scheduler.getStatus().periodicEnabled).toBe(false);
    });

    it('should bind EventBus listener on start', () => {
      scheduler.start();
      expect(mockEventBus.on).toHaveBeenCalledWith('event_published', expect.any(Function));
      expect(scheduler.getStatus().eventListenerBound).toBe(true);
    });

    it('should initialize runtime on start (always-active)', async () => {
      scheduler.start();
      // Allow async initialization to run
      await jest.advanceTimersByTimeAsync(0);
      expect(mockRuntime.initializeInProcess).toHaveBeenCalledWith(
        AUDITOR_SCHEDULER_CONSTANTS.AUDITOR_SESSION_NAME,
        undefined,
        'auditor',
      );
    });

    it('should shutdown runtime only on stop', () => {
      mockRuntime.isReady.mockReturnValue(true);
      scheduler.start();
      scheduler.stop();
      expect(mockRuntime.shutdown).toHaveBeenCalled();
    });
  });

  describe('trigger (L3 API)', () => {
    beforeEach(async () => {
      scheduler.start();
      // Let the async initializeAuditorRuntime() from start() complete
      await jest.advanceTimersByTimeAsync(0);
      mockRuntime.initializeInProcess.mockClear();
      mockRuntime.handleMessage.mockClear();
    });

    it('should run audit when runtime not ready', async () => {
      mockRuntime.isReady.mockReturnValue(false);
      const result = await scheduler.trigger('api');
      expect(result.triggered).toBe(true);
      expect(result.source).toBe('api');
      expect(mockRuntime.initializeInProcess).toHaveBeenCalled();
      expect(mockRuntime.handleMessage).toHaveBeenCalledWith(
        AUDITOR_SCHEDULER_CONSTANTS.AUDIT_COMMAND,
      );
    });

    it('should NOT shutdown after successful audit (always-active)', async () => {
      mockRuntime.isReady.mockReturnValue(true);
      await scheduler.trigger('api');
      // shutdown should NOT be called after audit
      // (only called via stop(), not in trigger())
      // The mock may have been called in start() init path, reset first
      mockRuntime.shutdown.mockClear();
      await scheduler.trigger('api');
      expect(mockRuntime.shutdown).not.toHaveBeenCalled();
    });

    it('should NOT shutdown on audit error (always-active)', async () => {
      mockRuntime.isReady.mockReturnValue(true);
      mockRuntime.handleMessage.mockRejectedValue(new Error('Model API timeout'));
      mockRuntime.shutdown.mockClear();
      const result = await scheduler.trigger('api');
      expect(result.triggered).toBe(false);
      expect(result.reason).toContain('Model API timeout');
      expect(scheduler.getStatus().status).toBe('idle');
      expect(mockRuntime.shutdown).not.toHaveBeenCalled();
    });

    it('should not allow concurrent audits', async () => {
      mockRuntime.isReady.mockReturnValue(true);
      mockRuntime.handleMessage.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5000)),
      );

      const p1 = scheduler.trigger('api');
      const p2Result = await scheduler.trigger('api');
      expect(p2Result.triggered).toBe(false);
      expect(p2Result.reason).toContain('already in progress');

      jest.advanceTimersByTime(5000);
      await p1;
    });

    it('should return error when scheduler is stopped', async () => {
      scheduler.stop();
      const result = await scheduler.trigger('api');
      expect(result.triggered).toBe(false);
      expect(result.reason).toContain('stopped');
    });

    it('should return error when no runtime configured', async () => {
      AuditorSchedulerService.resetInstance();
      const fresh = AuditorSchedulerService.getInstance();
      fresh.start();
      const result = await fresh.trigger('api');
      expect(result.triggered).toBe(false);
      expect(result.reason).toContain('No auditor runtime');
      fresh.stop();
    });

    it('should increment auditCount', async () => {
      mockRuntime.isReady.mockReturnValue(true);
      expect(scheduler.getStatus().auditCount).toBe(0);
      await scheduler.trigger('api');
      expect(scheduler.getStatus().auditCount).toBe(1);
      await scheduler.trigger('api');
      expect(scheduler.getStatus().auditCount).toBe(2);
    });
  });

  describe('handleUserMessage (Slack)', () => {
    beforeEach(async () => {
      mockRuntime.isReady.mockReturnValue(true);
      scheduler.start();
      // Let the async initializeAuditorRuntime() from start() complete
      await jest.advanceTimersByTimeAsync(0);
      // Clear mock call counts from initialization
      mockRuntime.initializeInProcess.mockClear();
      mockRuntime.handleMessage.mockClear();
    });

    it('should send message with SLACK_CONTEXT prefix', async () => {
      const result = await scheduler.handleUserMessage('show recent findings', {
        channelId: 'C12345',
        threadTs: '1234567890.123456',
      });
      expect(result.triggered).toBe(true);
      expect(mockRuntime.handleMessage).toHaveBeenCalledWith(
        '[SLACK_CONTEXT:channelId=C12345,threadTs=1234567890.123456]\nshow recent findings',
      );
    });

    it('should return error when no runtime', async () => {
      AuditorSchedulerService.resetInstance();
      const fresh = AuditorSchedulerService.getInstance();
      const result = await fresh.handleUserMessage('test', { channelId: 'C1', threadTs: 't1' });
      expect(result.triggered).toBe(false);
      expect(result.reason).toContain('No auditor runtime');
    });

    it('should initialize runtime if not ready', async () => {
      mockRuntime.isReady.mockReturnValue(false);
      // After initializeAuditorRuntime called, it should become ready
      mockRuntime.initializeInProcess.mockImplementation(async () => {
        mockRuntime.isReady.mockReturnValue(true);
      });
      await scheduler.handleUserMessage('test', { channelId: 'C1', threadTs: 't1' });
      expect(mockRuntime.initializeInProcess).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockRuntime.handleMessage.mockRejectedValue(new Error('Runtime error'));
      const result = await scheduler.handleUserMessage('test', { channelId: 'C1', threadTs: 't1' });
      expect(result.triggered).toBe(false);
      expect(result.reason).toContain('Runtime error');
    });
  });

  describe('L1 periodic trigger', () => {
    it('should trigger audit after interval', async () => {
      mockRuntime.isReady.mockReturnValue(true);
      scheduler.start();
      jest.advanceTimersByTime(AUDITOR_SCHEDULER_CONSTANTS.AUDIT_INTERVAL_MS);
      await jest.advanceTimersByTimeAsync(0);
      expect(mockRuntime.handleMessage).toHaveBeenCalled();
    });
  });

  describe('L2 event-driven trigger', () => {
    it('should trigger audit on qualifying event after debounce', async () => {
      mockRuntime.isReady.mockReturnValue(true);
      scheduler.start();

      const listenerCall = mockEventBus.on.mock.calls.find(
        (c: any[]) => c[0] === 'event_published',
      );
      expect(listenerCall).toBeDefined();
      const listener = listenerCall![1] as (payload: { eventType: string }) => void;

      listener({ eventType: 'agent:inactive' });
      expect(mockRuntime.handleMessage).not.toHaveBeenCalled();

      jest.advanceTimersByTime(AUDITOR_SCHEDULER_CONSTANTS.EVENT_DEBOUNCE_MS);
      await jest.advanceTimersByTimeAsync(0);
      expect(mockRuntime.handleMessage).toHaveBeenCalled();
    });

    it('should debounce multiple rapid events', async () => {
      mockRuntime.isReady.mockReturnValue(true);
      scheduler.start();

      const listenerCall = mockEventBus.on.mock.calls.find(
        (c: any[]) => c[0] === 'event_published',
      );
      const listener = listenerCall![1] as (payload: { eventType: string }) => void;

      listener({ eventType: 'task:failed' });
      jest.advanceTimersByTime(10_000);
      listener({ eventType: 'agent:inactive' });
      jest.advanceTimersByTime(10_000);
      listener({ eventType: 'task:failed' });

      expect(mockRuntime.handleMessage).not.toHaveBeenCalled();

      jest.advanceTimersByTime(AUDITOR_SCHEDULER_CONSTANTS.EVENT_DEBOUNCE_MS);
      await jest.advanceTimersByTimeAsync(0);
      expect(mockRuntime.handleMessage).toHaveBeenCalledTimes(1);
    });

    it('should ignore non-qualifying events', () => {
      scheduler.start();

      const listenerCall = mockEventBus.on.mock.calls.find(
        (c: any[]) => c[0] === 'event_published',
      );
      const listener = listenerCall![1] as (payload: { eventType: string }) => void;

      listener({ eventType: 'agent:idle' });
      jest.advanceTimersByTime(AUDITOR_SCHEDULER_CONSTANTS.EVENT_DEBOUNCE_MS + 1000);
      expect(mockRuntime.handleMessage).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should return correct initial status', () => {
      const status = scheduler.getStatus();
      expect(status.status).toBe('stopped');
      expect(status.auditCount).toBe(0);
      expect(status.lastAuditStart).toBeNull();
      expect(status.periodicEnabled).toBe(false);
      expect(status.eventListenerBound).toBe(false);
      expect(status.runtimeReady).toBe(false);
    });

    it('should reflect runtimeReady state', () => {
      mockRuntime.isReady.mockReturnValue(true);
      scheduler.start();
      expect(scheduler.getStatus().runtimeReady).toBe(true);
    });

    it('should reflect running state during audit', async () => {
      mockRuntime.isReady.mockReturnValue(true);
      scheduler.start();

      let resolveMessage!: (value: any) => void;
      mockRuntime.handleMessage.mockImplementation(
        () => new Promise((resolve) => { resolveMessage = resolve; }),
      );

      const triggerPromise = scheduler.trigger('api');
      await Promise.resolve();
      await Promise.resolve();

      expect(scheduler.getStatus().status).toBe('running_audit');
      expect(scheduler.getStatus().lastAuditStart).not.toBeNull();

      resolveMessage(mockAuditResult);
      await triggerPromise;
      expect(scheduler.getStatus().status).toBe('idle');
    });
  });
});
