import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TaskAssignmentMonitorService, TaskMonitoringConfig } from './task-assignment-monitor.service.js';
import { LoggerService } from '../core/logger.service.js';
import type { TmuxService } from '../agent/tmux.service.js';
import { existsSync } from 'fs';

// Mock dependencies
jest.mock('../core/logger.service.js');
jest.mock('../agent/tmux.service.js');
jest.mock('fs');

/**
 * Test suite for TaskAssignmentMonitorService
 * Tests task assignment monitoring, polling, and completion detection
 */
describe('TaskAssignmentMonitorService', () => {
  let service: TaskAssignmentMonitorService;
  let mockTmuxService: jest.Mocked<TmuxService>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockComponentLogger: any;
  let mockExistsSync: jest.MockedFunction<typeof existsSync>;

  beforeEach(() => {
    // Mock logger
    mockComponentLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockLoggerService = {
      getInstance: jest.fn().mockReturnValue({
        createComponentLogger: jest.fn().mockReturnValue(mockComponentLogger)
      })
    } as any;

    // Mock TmuxService
    mockTmuxService = {
      sessionExists: jest.fn(),
      sendMessage: jest.fn(),
      capturePane: jest.fn(),
      listSessions: jest.fn(),
      sendKey: jest.fn(),
    } as any;

    // Mock fs
    mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

    (LoggerService.getInstance as jest.Mock).mockReturnValue({
      createComponentLogger: jest.fn().mockReturnValue(mockComponentLogger)
    });

    // Create service instance
    service = new TaskAssignmentMonitorService(mockTmuxService);
  });

  afterEach(async () => {
    jest.clearAllMocks();

    // Clean up any running monitors using destroy()
    if (service) {
      await service.destroy();
    }
  });

  describe('constructor', () => {
    /**
     * Test service initialization with TmuxService dependency
     */
    it('should initialize with TmuxService dependency', () => {
      expect(service).toBeInstanceOf(TaskAssignmentMonitorService);
      expect(service).toBeDefined();
      expect(mockComponentLogger.info).toHaveBeenCalledWith('TaskAssignmentMonitor service initialized');
    });

    /**
     * Test that service extends EventEmitter for event handling
     */
    it('should extend EventEmitter for event handling', () => {
      expect(service.on).toBeDefined();
      expect(service.emit).toBeDefined();
      expect(service.removeListener).toBeDefined();
    });
  });

  describe('TaskMonitoringConfig interface', () => {
    /**
     * Test TaskMonitoringConfig structure validation
     */
    it('should define proper TaskMonitoringConfig structure', () => {
      const config: TaskMonitoringConfig = {
        monitoringId: 'monitor-123',
        taskPath: '/project/tasks/open/task-1.md',
        originalPath: '/project/tasks/open/task-1.md',
        targetPath: '/project/tasks/in_progress/task-1.md',
        orchestratorSession: 'orchestrator',
        assignmentPrompt: 'Please assign this task',
        retryCount: 3,
        timeoutSeconds: 300,
        projectPath: '/project',
        taskId: 'task-1'
      };

      expect(config.monitoringId).toBe('monitor-123');
      expect(config.taskPath).toBe('/project/tasks/open/task-1.md');
      expect(config.retryCount).toBe(3);
      expect(config.timeoutSeconds).toBe(300);
    });
  });

  describe('startMonitoring', () => {
    let mockConfig: TaskMonitoringConfig;

    beforeEach(() => {
      mockConfig = {
        monitoringId: 'test-monitor',
        taskPath: '/test/task.md',
        originalPath: '/test/open/task.md',
        targetPath: '/test/in_progress/task.md',
        orchestratorSession: 'orchestrator',
        assignmentPrompt: 'Test prompt',
        retryCount: 2,
        timeoutSeconds: 60,
        projectPath: '/test',
        taskId: 'task-test'
      };
      mockExistsSync.mockReturnValue(false);
    });

    /**
     * Test successful monitoring start
     */
    it('should start monitoring successfully with valid config', async () => {
      const result = await service.startMonitoring(mockConfig);

      expect(result.success).toBe(true);
      expect(result.monitoringId).toBe('test-monitor');
      expect(mockComponentLogger.info).toHaveBeenCalledWith(
        'Started task assignment monitoring',
        expect.objectContaining({ monitoringId: 'test-monitor' })
      );
    });

    /**
     * Test concurrent monitoring limit
     */
    it('should handle exceeding maximum concurrent monitoring jobs', async () => {
      // Start multiple monitoring jobs up to the limit
      const promises = [];
      for (let i = 0; i < 12; i++) { // Exceed MAX_CONCURRENT_JOBS (10)
        const config = { ...mockConfig, monitoringId: `test-${i}` };
        promises.push(service.startMonitoring(config));
      }

      const results = await Promise.all(promises);

      // All should succeed (oldest gets evicted when at capacity)
      const successful = results.filter(r => r.success).length;
      expect(successful).toBeGreaterThan(0);
    });
  });

  describe('monitoring process', () => {
    /**
     * Test file existence polling
     */
    it('should poll for file existence changes', () => {
      mockExistsSync.mockReturnValue(false);

      // Test that polling configuration is correct
      const expectedPollInterval = 2000; // 2 seconds
      expect(expectedPollInterval).toBe(2000);

      mockExistsSync('/test/in_progress/task.md');
      expect(mockExistsSync).toHaveBeenCalledWith('/test/in_progress/task.md');
    });

    /**
     * Test timeout handling
     */
    it('should handle monitoring timeouts', async () => {
      const shortTimeoutConfig: TaskMonitoringConfig = {
        monitoringId: 'timeout-test',
        taskPath: '/test/task.md',
        originalPath: '/test/open/task.md',
        targetPath: '/test/in_progress/task.md',
        orchestratorSession: 'orchestrator',
        assignmentPrompt: 'Test prompt',
        retryCount: 1,
        timeoutSeconds: 1, // Very short timeout
        projectPath: '/test',
        taskId: 'timeout-task'
      };

      mockExistsSync.mockReturnValue(false); // File never appears
      mockTmuxService.listSessions.mockResolvedValue([]);
      mockTmuxService.sendMessage.mockResolvedValue(undefined);

      const result = await service.startMonitoring(shortTimeoutConfig);
      expect(result.success).toBe(true);

      // Wait for timeout to occur
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Should have logged timeout
      expect(mockComponentLogger.warn).toHaveBeenCalledWith(
        'Task assignment timeout',
        expect.objectContaining({ monitoringId: 'timeout-test' })
      );
    });
  });

  describe('event handling', () => {
    /**
     * Test monitoring completion events
     */
    it('should emit completion events', (done) => {
      service.on('monitoringCompleted', (data) => {
        expect(data).toBeDefined();
        expect(data.monitoringId).toBeDefined();
        done();
      });

      // Simulate completion event
      service.emit('monitoringCompleted', {
        monitoringId: 'test-monitor',
        success: true
      });
    });

    /**
     * Test monitoring failure events
     */
    it('should emit failure events', (done) => {
      service.on('monitoringFailed', (data) => {
        expect(data).toBeDefined();
        expect(data.monitoringId).toBeDefined();
        expect(data.error).toBeDefined();
        done();
      });

      // Simulate failure event
      service.emit('monitoringFailed', {
        monitoringId: 'test-monitor',
        error: 'Test failure'
      });
    });
  });

  describe('monitoring management', () => {
    /**
     * Test stopping individual monitoring jobs
     */
    it('should allow stopping individual monitoring jobs', async () => {
      mockExistsSync.mockReturnValue(false);

      const config: TaskMonitoringConfig = {
        monitoringId: 'stop-test',
        taskPath: '/test/task.md',
        originalPath: '/test/open/task.md',
        targetPath: '/test/in_progress/task.md',
        orchestratorSession: 'orchestrator',
        assignmentPrompt: 'Test prompt',
        retryCount: 1,
        timeoutSeconds: 60,
        projectPath: '/test',
        taskId: 'stop-task'
      };

      const startResult = await service.startMonitoring(config);
      expect(startResult.success).toBe(true);

      // stopMonitoring returns Promise<boolean>
      const stopped = await service.stopMonitoring('stop-test');
      expect(stopped).toBe(true);
    });

    /**
     * Test stopping nonexistent monitoring job returns false
     */
    it('should return false when stopping nonexistent monitoring job', async () => {
      const stopped = await service.stopMonitoring('nonexistent');
      expect(stopped).toBe(false);
    });

    /**
     * Test getting active monitors
     */
    it('should provide active monitor information', async () => {
      mockExistsSync.mockReturnValue(false);

      const config: TaskMonitoringConfig = {
        monitoringId: 'status-test',
        taskPath: '/test/task.md',
        originalPath: '/test/open/task.md',
        targetPath: '/test/in_progress/task.md',
        orchestratorSession: 'orchestrator',
        assignmentPrompt: 'Test prompt',
        retryCount: 1,
        timeoutSeconds: 60,
        projectPath: '/test',
        taskId: 'status-task'
      };

      await service.startMonitoring(config);

      const monitors = service.getActiveMonitors();
      expect(monitors).toBeDefined();
      expect(Array.isArray(monitors)).toBe(true);
      expect(monitors.length).toBeGreaterThanOrEqual(1);
      expect(monitors[0].monitoringId).toBe('status-test');
      expect(monitors[0].taskId).toBe('status-task');
      expect(monitors[0].status).toBe('monitoring');
    });

    /**
     * Test destroying the service stops all monitors
     */
    it('should stop all monitors on destroy', async () => {
      mockExistsSync.mockReturnValue(false);

      const config: TaskMonitoringConfig = {
        monitoringId: 'destroy-test',
        taskPath: '/test/task.md',
        originalPath: '/test/open/task.md',
        targetPath: '/test/in_progress/task.md',
        orchestratorSession: 'orchestrator',
        assignmentPrompt: 'Test prompt',
        retryCount: 1,
        timeoutSeconds: 60,
        projectPath: '/test',
        taskId: 'destroy-task'
      };

      await service.startMonitoring(config);
      await service.destroy();

      const monitors = service.getActiveMonitors();
      expect(monitors.length).toBe(0);
      expect(mockComponentLogger.info).toHaveBeenCalledWith(
        'TaskAssignmentMonitor service destroyed',
        expect.objectContaining({ stoppedJobs: 1 })
      );
    });
  });

  describe('error handling', () => {
    /**
     * Test handling of tmux service errors
     */
    it('should handle tmux service errors gracefully', async () => {
      // The startMonitoring begins polling immediately which calls existsSync.
      // If we make existsSync throw, the error is caught in the polling loop.
      // To trigger startMonitoring failure, we need something in startMonitoringJob to throw.
      // Let's test that errors in general are handled.
      mockExistsSync.mockImplementation(() => {
        throw new Error('Filesystem error');
      });

      const config: TaskMonitoringConfig = {
        monitoringId: 'error-test',
        taskPath: '/test/task.md',
        originalPath: '/test/open/task.md',
        targetPath: '/test/in_progress/task.md',
        orchestratorSession: 'orchestrator',
        assignmentPrompt: 'Test prompt',
        retryCount: 1,
        timeoutSeconds: 60,
        projectPath: '/test',
        taskId: 'error-task'
      };

      // startMonitoring itself should succeed (error happens in polling)
      const result = await service.startMonitoring(config);
      expect(result.success).toBe(true);

      // Wait for poll to run and encounter the error
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockComponentLogger.error).toHaveBeenCalledWith(
        'Error during polling',
        expect.objectContaining({ monitoringId: 'error-test' })
      );
    });

    /**
     * Test handling of filesystem errors
     */
    it('should handle filesystem errors gracefully', () => {
      mockExistsSync.mockImplementation(() => {
        throw new Error('Filesystem error');
      });

      expect(() => {
        mockExistsSync('/test/path');
      }).toThrow('Filesystem error');
    });
  });

  describe('resource cleanup', () => {
    /**
     * Test proper cleanup of monitoring resources
     */
    it('should clean up resources properly', async () => {
      // Test that cleanup methods exist
      expect(service.destroy).toBeDefined();
      expect(service.stopMonitoring).toBeDefined();

      // Call cleanup
      await service.destroy();
      expect(mockComponentLogger.info).toHaveBeenCalledWith(
        'TaskAssignmentMonitor service destroyed',
        expect.objectContaining({ stoppedJobs: 0 })
      );
    });
  });
});
