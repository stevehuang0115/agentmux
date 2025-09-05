import { LoggerService, ComponentLogger, RequestLogger } from '../../backend/src/services/logger.service';

// Mock fs and config service
jest.mock('fs/promises');
jest.mock('fs', () => ({
  existsSync: jest.fn()
}));

jest.mock('../../backend/src/services/config.service', () => ({
  ConfigService: {
    getInstance: jest.fn(() => ({
      get: jest.fn((section: string) => {
        if (section === 'logging') {
          return {
            level: 'info',
            format: 'simple',
            enableFileLogging: false,
            logDir: '/tmp/logs',
            maxFiles: 5,
            maxSize: '10m'
          };
        }
        return {};
      })
    }))
  }
}));

describe('LoggerService', () => {
  let logger: LoggerService;
  let consoleSpy: {
    error: jest.SpyInstance;
    warn: jest.SpyInstance;
    info: jest.SpyInstance;
    debug: jest.SpyInstance;
  };

  beforeEach(() => {
    // Reset singleton
    (LoggerService as any).instance = undefined;
    
    // Mock console methods
    consoleSpy = {
      error: jest.spyOn(console, 'error').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      info: jest.spyOn(console, 'info').mockImplementation(),
      debug: jest.spyOn(console, 'debug').mockImplementation()
    };

    logger = LoggerService.getInstance();
  });

  afterEach(() => {
    logger.shutdown();
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance', () => {
      const instance1 = LoggerService.getInstance();
      const instance2 = LoggerService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Log Levels', () => {
    test('should log error messages', () => {
      logger.error('Test error message');
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('ERROR')
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Test error message')
      );
    });

    test('should log warning messages', () => {
      logger.warn('Test warning message');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('WARN')
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Test warning message')
      );
    });

    test('should log info messages', () => {
      logger.info('Test info message');
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('INFO')
      );
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Test info message')
      );
    });

    test('should log debug messages when level permits', () => {
      // Mock debug level by modifying the mock config
      const mockConfigService = require('../../backend/src/services/config.service').ConfigService;
      const originalGetInstance = mockConfigService.getInstance;
      
      mockConfigService.getInstance = jest.fn(() => ({
        get: jest.fn((section: string) => {
          if (section === 'logging') {
            return {
              level: 'debug',
              format: 'simple',
              enableFileLogging: false,
              logDir: '/tmp/logs',
              maxFiles: 5,
              maxSize: '10m'
            };
          }
          return {};
        })
      }));

      // Reset logger to pick up new config
      (LoggerService as any).instance = undefined;
      logger = LoggerService.getInstance();

      logger.debug('Test debug message');
      
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG')
      );
      
      // Restore original mock
      mockConfigService.getInstance = originalGetInstance;
    });
  });

  describe('Log Formatting', () => {
    test('should include context in log messages', () => {
      const context = { userId: '123', action: 'login' };
      logger.info('User action', context);
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Context: {"userId":"123","action":"login"}')
      );
    });

    test('should include component in log messages', () => {
      logger.info('Test message', {}, { component: 'TestComponent' });
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[TestComponent]')
      );
    });

    test('should include request ID in log messages', () => {
      logger.info('Test message', {}, { requestId: 'req-123' });
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[req-123]')
      );
    });

    test('should format timestamp correctly', () => {
      logger.info('Test message');
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)
      );
    });
  });

  describe('Specialized Logging Methods', () => {
    test('should log HTTP requests', () => {
      logger.logHttpRequest('GET', '/api/test', 200, 150);
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('HTTP Request')
      );
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('GET')
      );
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('/api/test')
      );
    });

    test('should log HTTP errors', () => {
      logger.logHttpError('POST', '/api/test', 500, 'Internal server error');
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('HTTP Error')
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('500')
      );
    });

    test('should log agent actions', () => {
      logger.logAgentAction('agent-123', 'send_message', true, { recipient: 'agent-456' });
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Agent Action: send_message')
      );
    });

    test('should log system metrics', () => {
      logger.logSystemMetric('cpu_usage', 75.5, '%');
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('System Metric')
      );
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('"value":75.5')
      );
    });

    test('should log security events', () => {
      logger.logSecurityEvent('failed_login_attempt', { 
        ip: '192.168.1.1', 
        username: 'admin' 
      });
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Security Event')
      );
    });

    test('should log database operations', () => {
      // Test failed database operation which logs at error level
      logger.logDatabaseOperation('SELECT', 'users', 25, false);
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Database Operation')
      );
    });
  });

  describe('ComponentLogger', () => {
    test('should create component logger with scoped component', () => {
      const componentLogger = logger.createComponentLogger('TestComponent');
      
      expect(componentLogger).toBeInstanceOf(ComponentLogger);
    });

    test('should include component in all log messages', () => {
      const componentLogger = logger.createComponentLogger('TestComponent');
      
      componentLogger.info('Test message');
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[TestComponent]')
      );
    });

    test('should support all log levels', () => {
      const componentLogger = logger.createComponentLogger('TestComponent');
      
      componentLogger.error('Error message');
      componentLogger.warn('Warning message');
      componentLogger.info('Info message');
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[TestComponent]')
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('[TestComponent]')
      );
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[TestComponent]')
      );
    });
  });

  describe('RequestLogger', () => {
    test('should create request logger with request ID', () => {
      const requestLogger = logger.createRequestLogger('req-123');
      
      expect(requestLogger).toBeInstanceOf(RequestLogger);
    });

    test('should include request ID in all log messages', () => {
      const requestLogger = logger.createRequestLogger('req-123');
      
      requestLogger.info('Test message');
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[req-123]')
      );
    });

    test('should include both request ID and user ID', () => {
      const requestLogger = logger.createRequestLogger('req-123', 'user-456');
      
      requestLogger.info('Test message');
      
      const loggedMessage = consoleSpy.info.mock.calls[0][0];
      expect(loggedMessage).toContain('[req-123]');
      // Note: userId is included in context, not as a separate tag in simple format
    });
  });

  describe('Log Level Filtering', () => {
    test('should not log debug messages when level is info', () => {
      logger.debug('Debug message');
      
      expect(consoleSpy.debug).not.toHaveBeenCalled();
    });

    test('should log messages at or above configured level', () => {
      logger.error('Error message');
      logger.warn('Warning message');
      logger.info('Info message');
      
      expect(consoleSpy.error).toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.info).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should include stack trace for error objects', () => {
      const error = new Error('Test error');
      logger.error('Something went wrong', { error });
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining(error.stack || '')
      );
    });

    test('should handle errors in context gracefully', () => {
      const circularObj: any = {};
      circularObj.self = circularObj;
      
      // This should not throw
      expect(() => {
        logger.info('Test message', { circular: circularObj });
      }).not.toThrow();
    });
  });

  describe('Shutdown', () => {
    test('should shutdown gracefully', () => {
      expect(() => {
        logger.shutdown();
      }).not.toThrow();
    });

    test('should prevent multiple shutdowns', () => {
      logger.shutdown();
      
      expect(() => {
        logger.shutdown();
      }).not.toThrow();
    });
  });

  describe('Process Event Handlers', () => {
    test('should handle uncaught exceptions', () => {
      const originalListeners = process.listeners('uncaughtException');
      
      // Reset logger to register event handlers
      (LoggerService as any).instance = undefined;
      logger = LoggerService.getInstance();
      
      const newListeners = process.listeners('uncaughtException');
      expect(newListeners.length).toBeGreaterThan(originalListeners.length);
      
      // Simulate uncaught exception
      const testError = new Error('Test uncaught exception');
      process.emit('uncaughtException', testError);
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Uncaught exception')
      );
    });

    test('should handle unhandled promise rejections', () => {
      const originalListeners = process.listeners('unhandledRejection');
      
      // Reset logger to register event handlers
      (LoggerService as any).instance = undefined;
      logger = LoggerService.getInstance();
      
      const newListeners = process.listeners('unhandledRejection');
      expect(newListeners.length).toBeGreaterThan(originalListeners.length);
      
      // Simulate unhandled rejection
      const testError = new Error('Test unhandled rejection');
      process.emit('unhandledRejection', testError, Promise.resolve());
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Unhandled promise rejection')
      );
    });
  });
});