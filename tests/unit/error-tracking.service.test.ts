import { ErrorTrackingService } from '../../backend/src/services/error-tracking.service';
import { LoggerService } from '../../backend/src/services/logger.service';
import { ConfigService } from '../../backend/src/services/config.service';

// Mock the dependencies
jest.mock('../../backend/src/services/logger.service');
jest.mock('../../backend/src/services/config.service');

describe('ErrorTrackingService', () => {
  let errorTrackingService: ErrorTrackingService;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockConfig: jest.Mocked<ConfigService>;

  beforeEach(() => {
    // Reset singletons
    (ErrorTrackingService as any).instance = undefined;
    (LoggerService as any).instance = undefined;
    (ConfigService as any).instance = undefined;

    // Setup mocks
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    mockConfig = {
      getConfig: jest.fn(),
      get: jest.fn()
    } as any;

    (LoggerService.getInstance as jest.Mock).mockReturnValue(mockLogger);
    (ConfigService.getInstance as jest.Mock).mockReturnValue(mockConfig);

    // Mock environment variables
    process.env.ERROR_TRACKING_MAX_STORED = '100';
    process.env.ERROR_TRACKING_RETENTION_HOURS = '1';

    errorTrackingService = ErrorTrackingService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.ERROR_TRACKING_MAX_STORED;
    delete process.env.ERROR_TRACKING_RETENTION_HOURS;
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance when called multiple times', () => {
      const instance1 = ErrorTrackingService.getInstance();
      const instance2 = ErrorTrackingService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('trackError', () => {
    test('should track a simple string error', () => {
      const errorId = errorTrackingService.trackError('Test error message');
      
      expect(errorId).toMatch(/^err_\d+_[a-z0-9]{6}$/);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error tracked: Test error message'),
        expect.objectContaining({
          errorId: expect.stringMatching(/^err_\d+_[a-z0-9]{6}$/),
          source: 'backend'
        })
      );
    });

    test('should track an Error object with stack trace', () => {
      const testError = new Error('Test error object');
      const errorId = errorTrackingService.trackError(testError);
      
      expect(errorId).toMatch(/^err_\d+_[a-z0-9]{6}$/);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error tracked: Test error object'),
        expect.objectContaining({
          errorId: expect.stringMatching(/^err_\d+_[a-z0-9]{6}$/),
          stack: expect.stringContaining('Error: Test error object')
        })
      );
    });

    test('should track error with custom context', () => {
      const errorId = errorTrackingService.trackError('Context error', {
        level: 'critical',
        source: 'frontend',
        userId: 'user123',
        sessionId: 'session456',
        component: 'Dashboard',
        action: 'loadData',
        metadata: { requestId: 'req789' }
      });
      
      expect(errorId).toMatch(/^err_\d+_[a-z0-9]{6}$/);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error tracked: Context error'),
        expect.objectContaining({
          errorId: expect.stringMatching(/^err_\d+_[a-z0-9]{6}$/),
          source: 'frontend',
          component: 'Dashboard',
          action: 'loadData',
          userId: 'user123',
          sessionId: 'session456',
          metadata: { requestId: 'req789' }
        })
      );
    });

    test('should handle critical errors specially', () => {
      const errorId = errorTrackingService.trackError('Critical error', {
        level: 'critical'
      });
      
      // Should log the regular error
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error tracked: Critical error'),
        expect.any(Object)
      );
      
      // Should also handle critical error specifically
      expect(mockLogger.error).toHaveBeenCalledWith(
        'CRITICAL ERROR detected',
        expect.objectContaining({
          errorId: expect.stringMatching(/^err_\d+_[a-z0-9]{6}$/),
          message: 'Critical error'
        })
      );
    });
  });

  describe('getErrorStats', () => {
    beforeEach(() => {
      // Add some test errors
      errorTrackingService.trackError('Error 1', { level: 'error', source: 'backend' });
      errorTrackingService.trackError('Error 2', { level: 'warning', source: 'frontend' });
      errorTrackingService.trackError('Critical Error', { level: 'critical', source: 'backend', component: 'API' });
      errorTrackingService.trackError('Error 1', { level: 'error', source: 'backend' }); // Duplicate
    });

    test('should return comprehensive error statistics', () => {
      const stats = errorTrackingService.getErrorStats();
      
      expect(stats).toEqual({
        totalErrors: 4,
        errorsByLevel: {
          error: 2,
          warning: 1,
          critical: 1
        },
        errorsBySource: {
          backend: 3,
          frontend: 1
        },
        errorsByComponent: {
          API: 1
        },
        topErrors: expect.arrayContaining([
          expect.objectContaining({
            message: 'Error 1',
            count: 2,
            lastSeen: expect.any(String)
          })
        ]),
        recentErrors: expect.arrayContaining([
          expect.objectContaining({
            message: 'Error 1',
            level: 'error',
            source: 'backend'
          })
        ])
      });
    });

    test('should limit recent errors to 50', () => {
      // Add more than 50 errors
      for (let i = 0; i < 60; i++) {
        errorTrackingService.trackError(`Error ${i}`, { level: 'error' });
      }
      
      const stats = errorTrackingService.getErrorStats();
      expect(stats.recentErrors.length).toBeLessThanOrEqual(50);
    });

    test('should sort top errors by frequency', () => {
      // Clear existing errors first
      errorTrackingService.clearErrors();
      
      // Add errors with different frequencies
      errorTrackingService.trackError('Common Error', { level: 'error' });
      errorTrackingService.trackError('Common Error', { level: 'error' });
      errorTrackingService.trackError('Common Error', { level: 'error' });
      errorTrackingService.trackError('Rare Error', { level: 'error' });
      
      const stats = errorTrackingService.getErrorStats();
      expect(stats.topErrors[0]).toEqual({
        message: 'Common Error',
        count: 3,
        lastSeen: expect.any(String)
      });
      expect(stats.topErrors[1]).toEqual({
        message: 'Rare Error',
        count: 1,
        lastSeen: expect.any(String)
      });
    });
  });

  describe('getErrors', () => {
    beforeEach(() => {
      // Add test errors
      errorTrackingService.trackError('Backend Error', { 
        level: 'error', 
        source: 'backend', 
        component: 'API',
        userId: 'user1',
        sessionId: 'session1'
      });
      errorTrackingService.trackError('Frontend Warning', { 
        level: 'warning', 
        source: 'frontend', 
        component: 'Dashboard',
        userId: 'user2',
        sessionId: 'session2'
      });
      errorTrackingService.trackError('Critical Error', { 
        level: 'critical', 
        source: 'mcp'
      });
    });

    test('should return all errors when no criteria provided', () => {
      const errors = errorTrackingService.getErrors();
      expect(errors).toHaveLength(3);
    });

    test('should filter errors by level', () => {
      const errors = errorTrackingService.getErrors({ level: 'error' });
      expect(errors).toHaveLength(1);
      expect(errors[0].level).toBe('error');
      expect(errors[0].message).toBe('Backend Error');
    });

    test('should filter errors by source', () => {
      const errors = errorTrackingService.getErrors({ source: 'frontend' });
      expect(errors).toHaveLength(1);
      expect(errors[0].source).toBe('frontend');
      expect(errors[0].message).toBe('Frontend Warning');
    });

    test('should filter errors by component', () => {
      const errors = errorTrackingService.getErrors({ component: 'API' });
      expect(errors).toHaveLength(1);
      expect(errors[0].component).toBe('API');
    });

    test('should filter errors by userId', () => {
      const errors = errorTrackingService.getErrors({ userId: 'user1' });
      expect(errors).toHaveLength(1);
      expect(errors[0].userId).toBe('user1');
    });

    test('should filter errors by sessionId', () => {
      const errors = errorTrackingService.getErrors({ sessionId: 'session2' });
      expect(errors).toHaveLength(1);
      expect(errors[0].sessionId).toBe('session2');
    });

    test('should limit results', () => {
      const errors = errorTrackingService.getErrors({ limit: 2 });
      expect(errors).toHaveLength(2);
    });

    test('should filter by since date', () => {
      const futureDate = new Date(Date.now() + 60000).toISOString();
      const errors = errorTrackingService.getErrors({ since: futureDate });
      expect(errors).toHaveLength(0);
    });
  });

  describe('getError', () => {
    test('should return specific error by ID', () => {
      const errorId = errorTrackingService.trackError('Test error');
      const error = errorTrackingService.getError(errorId);
      
      expect(error).not.toBeNull();
      expect(error!.id).toBe(errorId);
      expect(error!.message).toBe('Test error');
    });

    test('should return null for non-existent error ID', () => {
      const error = errorTrackingService.getError('non-existent-id');
      expect(error).toBeNull();
    });
  });

  describe('clearErrors', () => {
    beforeEach(() => {
      // Add test errors
      errorTrackingService.trackError('Error 1', { level: 'error', source: 'backend' });
      errorTrackingService.trackError('Error 2', { level: 'warning', source: 'frontend' });
      errorTrackingService.trackError('Error 3', { level: 'critical', source: 'mcp' });
    });

    test('should clear all errors when no criteria provided', () => {
      const removedCount = errorTrackingService.clearErrors();
      expect(removedCount).toBe(3);
      
      const errors = errorTrackingService.getErrors();
      expect(errors).toHaveLength(0);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cleared 3 error records',
        expect.objectContaining({
          component: 'ErrorTrackingService',
          action: 'clearErrors'
        })
      );
    });

    test('should clear errors by level', () => {
      const removedCount = errorTrackingService.clearErrors({ level: 'error' });
      expect(removedCount).toBe(1);
      
      const errors = errorTrackingService.getErrors();
      expect(errors).toHaveLength(2);
      expect(errors.some(e => e.level === 'error')).toBe(false);
    });

    test('should clear errors by source', () => {
      const removedCount = errorTrackingService.clearErrors({ source: 'frontend' });
      expect(removedCount).toBe(1);
      
      const errors = errorTrackingService.getErrors();
      expect(errors).toHaveLength(2);
      expect(errors.some(e => e.source === 'frontend')).toBe(false);
    });
  });

  describe('getHealthStatus', () => {
    test('should return healthy status with normal error count', () => {
      // Add a few normal errors
      errorTrackingService.trackError('Error 1');
      errorTrackingService.trackError('Error 2');
      
      const health = errorTrackingService.getHealthStatus();
      expect(health.status).toBe('healthy');
      expect(health.details.storedErrors).toBe(2);
      expect(health.details.memoryUsage).toMatch(/^\d+\.\d{2} MB$/);
      expect(health.details.recentCriticalErrors).toBe(0);
    });

    test('should return warning status with moderate critical errors', () => {
      // Add moderate critical errors
      errorTrackingService.trackError('Critical 1', { level: 'critical' });
      errorTrackingService.trackError('Critical 2', { level: 'critical' });
      errorTrackingService.trackError('Critical 3', { level: 'critical' });
      
      const health = errorTrackingService.getHealthStatus();
      expect(health.status).toBe('warning');
      expect(health.details.recentCriticalErrors).toBe(3);
    });

    test('should return critical status with many critical errors', () => {
      // Add many critical errors
      for (let i = 0; i < 6; i++) {
        errorTrackingService.trackError(`Critical ${i}`, { level: 'critical' });
      }
      
      const health = errorTrackingService.getHealthStatus();
      expect(health.status).toBe('critical');
      expect(health.details.recentCriticalErrors).toBe(6);
    });
  });

  describe('Error Storage Management', () => {
    test('should trim stored errors when exceeding limit', () => {
      // Mock environment to set low limit
      process.env.ERROR_TRACKING_MAX_STORED = '3';
      
      // Create new instance with the new limit
      (ErrorTrackingService as any).instance = undefined;
      const service = ErrorTrackingService.getInstance();
      
      // Add more errors than the limit
      service.trackError('Error 1');
      service.trackError('Error 2');
      service.trackError('Error 3');
      service.trackError('Error 4');
      service.trackError('Error 5');
      
      const errors = service.getErrors();
      expect(errors).toHaveLength(3);
      
      // Should keep the most recent errors
      expect(errors[0].message).toBe('Error 5');
      expect(errors[1].message).toBe('Error 4');
      expect(errors[2].message).toBe('Error 3');
    });
  });

  describe('Error ID Generation', () => {
    test('should generate unique error IDs', () => {
      const id1 = errorTrackingService.trackError('Error 1');
      const id2 = errorTrackingService.trackError('Error 2');
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^err_\d+_[a-z0-9]{6}$/);
      expect(id2).toMatch(/^err_\d+_[a-z0-9]{6}$/);
    });
  });
});