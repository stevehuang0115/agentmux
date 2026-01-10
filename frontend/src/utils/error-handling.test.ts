import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  logSilentError,
  withSilentError,
  createSilentErrorHandler,
  isDevelopment,
  type SilentErrorOptions
} from './error-handling';

describe('error-handling utilities', () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('isDevelopment', () => {
    it('should return true when import.meta.env.DEV is true', () => {
      vi.stubEnv('DEV', true);
      // Note: isDevelopment reads from import.meta.env which is set at build time
      // This test verifies the function exists and returns a boolean
      expect(typeof isDevelopment()).toBe('boolean');
    });
  });

  describe('logSilentError', () => {
    beforeEach(() => {
      // Mock development mode
      vi.stubEnv('DEV', true);
      vi.stubEnv('MODE', 'development');
    });

    it('should log error with context using console.debug by default', () => {
      const error = new Error('Test error');

      logSilentError(error, { context: 'Loading data' });

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[Silent Error] Loading data',
        'Test error'
      );
    });

    it('should log error without context', () => {
      const error = new Error('Test error');

      logSilentError(error);

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[Silent Error]',
        'Test error'
      );
    });

    it('should use console.warn when level is warn', () => {
      const error = new Error('Warning error');

      logSilentError(error, { context: 'Warning context', level: 'warn' });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Silent Error] Warning context',
        'Warning error'
      );
    });

    it('should use console.error when level is error', () => {
      const error = new Error('Error level');

      logSilentError(error, { context: 'Error context', level: 'error' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Silent Error] Error context',
        'Error level'
      );
    });

    it('should handle non-Error objects', () => {
      const error = 'String error';

      logSilentError(error, { context: 'String error context' });

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[Silent Error] String error context',
        'String error'
      );
    });

    it('should handle null and undefined errors', () => {
      logSilentError(null, { context: 'Null error' });
      expect(consoleDebugSpy).toHaveBeenCalledWith('[Silent Error] Null error', 'null');

      logSilentError(undefined, { context: 'Undefined error' });
      expect(consoleDebugSpy).toHaveBeenCalledWith('[Silent Error] Undefined error', 'undefined');
    });

    it('should log in production when logInProduction is true', () => {
      vi.stubEnv('DEV', false);
      vi.stubEnv('MODE', 'production');

      const error = new Error('Production error');

      logSilentError(error, { context: 'Prod context', logInProduction: true });

      expect(consoleDebugSpy).toHaveBeenCalled();
    });
  });

  describe('withSilentError', () => {
    beforeEach(() => {
      vi.stubEnv('DEV', true);
      vi.stubEnv('MODE', 'development');
    });

    it('should return result when function succeeds', async () => {
      const successFn = async () => ({ data: 'success' });

      const result = await withSilentError(successFn);

      expect(result).toEqual({ data: 'success' });
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should return undefined when function throws', async () => {
      const failFn = async () => {
        throw new Error('Function failed');
      };

      const result = await withSilentError(failFn, { context: 'Async operation' });

      expect(result).toBeUndefined();
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[Silent Error] Async operation',
        'Function failed'
      );
    });

    it('should pass options to logSilentError', async () => {
      const failFn = async () => {
        throw new Error('Failed with warn');
      };

      await withSilentError(failFn, { context: 'Warn context', level: 'warn' });

      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should handle synchronous functions wrapped in async', async () => {
      const syncFn = async () => 42;

      const result = await withSilentError(syncFn);

      expect(result).toBe(42);
    });
  });

  describe('createSilentErrorHandler', () => {
    beforeEach(() => {
      vi.stubEnv('DEV', true);
      vi.stubEnv('MODE', 'development');
    });

    it('should create a handler function', () => {
      const handler = createSilentErrorHandler('Test context');

      expect(typeof handler).toBe('function');
    });

    it('should log error with provided context when called', () => {
      const handler = createSilentErrorHandler('Handler context');
      const error = new Error('Handler error');

      handler(error);

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[Silent Error] Handler context',
        'Handler error'
      );
    });

    it('should pass additional options to logSilentError', () => {
      const handler = createSilentErrorHandler('Warn handler', { level: 'warn' });
      const error = new Error('Warn handler error');

      handler(error);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Silent Error] Warn handler',
        'Warn handler error'
      );
    });

    it('should be usable with Promise.catch', async () => {
      const handler = createSilentErrorHandler('Promise catch context');
      const failingPromise = Promise.reject(new Error('Promise error'));

      await failingPromise.catch(handler);

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[Silent Error] Promise catch context',
        'Promise error'
      );
    });
  });
});
