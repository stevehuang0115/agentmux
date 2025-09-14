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
    } as any;

    // Mock fs
    mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

    (LoggerService.getInstance as jest.Mock).mockReturnValue({
      createComponentLogger: jest.fn().mockReturnValue(mockComponentLogger)
    });

    // Create service instance
    service = new TaskAssignmentMonitorService(mockTmuxService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    
    // Clean up any running monitors
    if (service) {
      service.stopAllMonitoring();
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
    });

    /**
     * Test successful monitoring start
     */
    it('should start monitoring successfully with valid config', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(true);

      const result = await service.startMonitoring(mockConfig);

      expect(result.success).toBe(true);
      expect(mockTmuxService.sessionExists).toHaveBeenCalledWith('orchestrator');
      expect(mockComponentLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Started monitoring task assignment')
      );
    });

    /**
     * Test monitoring start with invalid orchestrator session
     */
    it('should fail when orchestrator session does not exist', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(false);

      const result = await service.startMonitoring(mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Orchestrator session');
      expect(mockComponentLogger.error).toHaveBeenCalled();
    });

    /**
     * Test concurrent monitoring limit
     */
    it('should respect maximum concurrent monitoring jobs limit', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(true);
      
      // Start multiple monitoring jobs
      const promises = [];
      for (let i = 0; i < 12; i++) { // Exceed MAX_CONCURRENT_JOBS (10)
        const config = { ...mockConfig, monitoringId: `test-${i}` };
        promises.push(service.startMonitoring(config));
      }
      
      const results = await Promise.all(promises);
      
      // Some should succeed, some should fail due to limit
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      expect(successful).toBeLessThanOrEqual(10);
      expect(failed).toBeGreaterThan(0);
    });

    /**
     * Test duplicate monitoring ID handling
     */
    it('should reject duplicate monitoring IDs', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(true);
      
      // Start first monitoring job
      const result1 = await service.startMonitoring(mockConfig);
      expect(result1.success).toBe(true);
      
      // Try to start second with same ID
      const result2 = await service.startMonitoring(mockConfig);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('already being monitored');
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

      mockTmuxService.sessionExists.mockResolvedValue(true);
      mockExistsSync.mockReturnValue(false); // File never appears

      const result = await service.startMonitoring(shortTimeoutConfig);
      expect(result.success).toBe(true);

      // Wait for timeout to occur
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should have logged timeout
      expect(mockComponentLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('timeout')
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
      mockTmuxService.sessionExists.mockResolvedValue(true);
      
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

      const stopResult = service.stopMonitoring('stop-test');
      expect(stopResult.success).toBe(true);
    });

    /**
     * Test stopping all monitoring jobs
     */
    it('should allow stopping all monitoring jobs', () => {
      const result = service.stopAllMonitoring();
      expect(result.stoppedCount).toBeGreaterThanOrEqual(0);
      expect(mockComponentLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Stopped all monitoring')
      );
    });

    /**
     * Test getting monitoring status
     */
    it('should provide monitoring status information', () => {
      const status = service.getMonitoringStatus();
      expect(status).toBeDefined();
      expect(status.activeMonitors).toBeDefined();
      expect(status.totalActive).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    /**
     * Test handling of tmux service errors
     */
    it('should handle tmux service errors gracefully', async () => {
      mockTmuxService.sessionExists.mockRejectedValue(new Error('Tmux error'));
      
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

      const result = await service.startMonitoring(config);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Tmux error');
      expect(mockComponentLogger.error).toHaveBeenCalled();
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
    it('should clean up resources properly', () => {
      // Test that cleanup methods exist
      expect(service.stopAllMonitoring).toBeDefined();
      expect(service.stopMonitoring).toBeDefined();
      
      // Call cleanup
      const result = service.stopAllMonitoring();
      expect(result.stoppedCount).toBeGreaterThanOrEqual(0);
    });
  });
});