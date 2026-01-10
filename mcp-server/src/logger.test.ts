import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MCPLogger, logger, createLogger } from './logger.js';

describe('MCPLogger', () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Reset logger level to debug for tests
    logger.setLevel('debug');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log levels', () => {
    it('should respect log level setting', () => {
      logger.setLevel('warn');

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should log all levels when set to debug', () => {
      logger.setLevel('debug');

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(consoleDebugSpy).toHaveBeenCalled();
      expect(consoleInfoSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should only log error when set to error level', () => {
      logger.setLevel('error');

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('message formatting', () => {
    it('should include prefix and level', () => {
      logger.setLevel('info');
      logger.info('test message');

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MCP]')
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]')
      );
    });

    it('should include timestamp by default', () => {
      logger.setLevel('info');
      logger.info('test message');

      // ISO timestamp pattern
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      );
    });

    it('should include context when provided', () => {
      logger.setLevel('info');
      logger.info('test message', { sessionName: 'test-session' });

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('sessionName=test-session')
      );
    });

    it('should include multiple context values', () => {
      logger.setLevel('info');
      logger.info('test message', { sessionName: 'session-1', toolName: 'getStatus' });

      const call = consoleInfoSpy.mock.calls[0][0];
      expect(call).toContain('sessionName=session-1');
      expect(call).toContain('toolName=getStatus');
    });
  });

  describe('child loggers', () => {
    it('should create child with inherited context', () => {
      logger.setLevel('info');
      const childLogger = createLogger({ toolName: 'getAgentStatus' });

      childLogger.info('tool executed');

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('toolName=getAgentStatus')
      );
    });

    it('should merge parent and child context', () => {
      const parentLogger = new MCPLogger({}, { sessionName: 'parent-session' });
      const childLogger = parentLogger.child({ toolName: 'childTool' });

      childLogger.setLevel('info');
      childLogger.info('test');

      const call = consoleInfoSpy.mock.calls[0][0];
      expect(call).toContain('sessionName=parent-session');
      expect(call).toContain('toolName=childTool');
    });
  });

  describe('error logging', () => {
    it('should log error stack trace', () => {
      logger.setLevel('error');
      const error = new Error('Test error');

      logger.error('Operation failed', error);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Operation failed')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stack:')
      );
    });

    it('should log non-Error objects as JSON', () => {
      logger.setLevel('error');
      const errorObj = { code: 'ERR_001', reason: 'Unknown' };

      logger.error('Operation failed', errorObj);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Details:')
      );
    });

    it('should handle error without additional error object', () => {
      logger.setLevel('error');

      logger.error('Simple error message');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Simple error message')
      );
    });
  });

  describe('isLevelEnabled', () => {
    it('should return true for enabled levels', () => {
      logger.setLevel('info');

      expect(logger.isLevelEnabled('info')).toBe(true);
      expect(logger.isLevelEnabled('warn')).toBe(true);
      expect(logger.isLevelEnabled('error')).toBe(true);
    });

    it('should return false for disabled levels', () => {
      logger.setLevel('warn');

      expect(logger.isLevelEnabled('debug')).toBe(false);
      expect(logger.isLevelEnabled('info')).toBe(false);
    });
  });
});
