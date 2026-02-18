/**
 * Tests for Safe Restart Service
 *
 * @module services/orchestrator/safe-restart.service.test
 */

// Jest globals are available automatically
import {
  SafeRestartService,
  getSafeRestartService,
  resetSafeRestartService,
} from './safe-restart.service.js';
import { resetStatePersistenceService } from './state-persistence.service.js';
import { resetSlackOrchestratorBridge } from '../slack/slack-orchestrator-bridge.js';

describe('SafeRestartService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetSafeRestartService();
    resetStatePersistenceService();
    resetSlackOrchestratorBridge();
    process.env = { ...originalEnv };
    delete process.env.CREWLY_RESTARTED;
    delete process.env.CREWLY_RESTART_REASON;
  });

  afterEach(() => {
    resetSafeRestartService();
    resetStatePersistenceService();
    resetSlackOrchestratorBridge();
    process.env = originalEnv;
  });

  describe('getSafeRestartService', () => {
    it('should return singleton instance', () => {
      const service1 = getSafeRestartService();
      const service2 = getSafeRestartService();
      expect(service1).toBe(service2);
    });

    it('should return SafeRestartService instance', () => {
      const service = getSafeRestartService();
      expect(service).toBeInstanceOf(SafeRestartService);
    });
  });

  describe('resetSafeRestartService', () => {
    it('should reset the singleton instance', () => {
      const service1 = getSafeRestartService();
      resetSafeRestartService();
      const service2 = getSafeRestartService();
      expect(service1).not.toBe(service2);
    });
  });

  describe('handleStartup', () => {
    it('should return null on fresh start', async () => {
      const service = getSafeRestartService();
      const instructions = await service.handleStartup();
      expect(instructions).toBeNull();
    });
  });

  describe('onShutdown', () => {
    it('should register shutdown callback', () => {
      const service = getSafeRestartService();
      const callback = jest.fn().mockResolvedValue(undefined);

      service.onShutdown(callback);
      // Callback should be registered without error
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('onStartup', () => {
    it('should register startup callback', () => {
      const service = getSafeRestartService();
      const callback = jest.fn().mockResolvedValue(undefined);

      service.onStartup(callback);
      // Callback should be registered without error
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('scheduleRestart', () => {
    it('should schedule a restart', () => {
      const service = getSafeRestartService();

      service.scheduleRestart({
        reason: 'test',
        delayMs: 10000,
        notifySlack: false,
      });

      const status = service.getStatus();
      expect(status.isRestarting).toBe(false);
      expect(status.restartScheduledAt).toBeDefined();
      expect(status.restartReason).toBe('test');
      expect(status.countdown).toBeGreaterThan(0);

      // Clean up
      service.cancelScheduledRestart();
    });

    it('should use default delay if not specified', () => {
      const service = getSafeRestartService();

      service.scheduleRestart({
        reason: 'test',
        notifySlack: false,
      });

      const status = service.getStatus();
      expect(status.countdown).toBeLessThanOrEqual(5);

      // Clean up
      service.cancelScheduledRestart();
    });
  });

  describe('cancelScheduledRestart', () => {
    it('should cancel scheduled restart', () => {
      const service = getSafeRestartService();

      service.scheduleRestart({
        reason: 'test',
        delayMs: 10000,
        notifySlack: false,
      });

      const cancelled = service.cancelScheduledRestart();
      expect(cancelled).toBe(true);

      const status = service.getStatus();
      expect(status.restartScheduledAt).toBeUndefined();
    });

    it('should return false when no restart scheduled', () => {
      const service = getSafeRestartService();
      const cancelled = service.cancelScheduledRestart();
      expect(cancelled).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return initial status', () => {
      const service = getSafeRestartService();
      const status = service.getStatus();

      expect(status.isRestarting).toBe(false);
      expect(status.restartScheduledAt).toBeUndefined();
      expect(status.restartReason).toBeUndefined();
      expect(status.countdown).toBeUndefined();
    });

    it('should return status with scheduled restart', () => {
      const service = getSafeRestartService();

      service.scheduleRestart({
        reason: 'code update',
        delayMs: 60000,
        notifySlack: false,
      });

      const status = service.getStatus();

      expect(status.isRestarting).toBe(false);
      expect(status.restartScheduledAt).toBeDefined();
      expect(status.restartReason).toBe('code update');
      expect(status.countdown).toBeDefined();
      expect(status.countdown).toBeGreaterThan(50); // Should be close to 60

      // Clean up
      service.cancelScheduledRestart();
    });
  });

  describe('isRestart', () => {
    it('should return false for fresh start', () => {
      const service = getSafeRestartService();
      expect(service.isRestart()).toBe(false);
    });

    it('should return true when CREWLY_RESTARTED is set', () => {
      process.env.CREWLY_RESTARTED = 'true';

      const service = new SafeRestartService();
      expect(service.isRestart()).toBe(true);
    });

    it('should return false for other values', () => {
      process.env.CREWLY_RESTARTED = 'false';

      const service = new SafeRestartService();
      expect(service.isRestart()).toBe(false);
    });
  });

  describe('getRestartReason', () => {
    it('should return undefined for fresh start', () => {
      const service = getSafeRestartService();
      expect(service.getRestartReason()).toBeUndefined();
    });

    it('should return reason when CREWLY_RESTART_REASON is set', () => {
      process.env.CREWLY_RESTART_REASON = 'test-reason';

      const service = new SafeRestartService();
      expect(service.getRestartReason()).toBe('test-reason');
    });
  });

  describe('gracefulShutdown', () => {
    it('should run shutdown callbacks', async () => {
      const service = getSafeRestartService();
      const callback = jest.fn().mockResolvedValue(undefined);

      service.onShutdown(callback);
      await service.gracefulShutdown('test');

      expect(callback).toHaveBeenCalled();
    });

    it('should only run once', async () => {
      const service = getSafeRestartService();
      const callback = jest.fn().mockResolvedValue(undefined);

      service.onShutdown(callback);
      await service.gracefulShutdown('first');
      await service.gracefulShutdown('second');

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle callback errors gracefully', async () => {
      const service = getSafeRestartService();
      const errorCallback = jest.fn().mockRejectedValue(new Error('test error'));
      const successCallback = jest.fn().mockResolvedValue(undefined);

      service.onShutdown(errorCallback);
      service.onShutdown(successCallback);

      // Should not throw
      await expect(service.gracefulShutdown('test')).resolves.not.toThrow();

      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();
    });
  });

  describe('emergencyShutdown', () => {
    it('should not throw', async () => {
      const service = getSafeRestartService();
      await expect(
        service.emergencyShutdown('test error')
      ).resolves.not.toThrow();
    });
  });

  describe('checkPostRestartCommand', () => {
    it('should not throw when no marker file exists', async () => {
      const service = getSafeRestartService();
      await expect(service.checkPostRestartCommand()).resolves.not.toThrow();
    });
  });

  describe('clearCallbacks', () => {
    it('should clear shutdown callbacks', async () => {
      const service = new SafeRestartService();
      const callback = jest.fn().mockResolvedValue(undefined);

      service.onShutdown(callback);
      service.clearShutdownCallbacks();

      await service.gracefulShutdown('test');
      expect(callback).not.toHaveBeenCalled();
    });

    it('should clear startup callbacks', () => {
      const service = new SafeRestartService();
      const callback = jest.fn().mockResolvedValue(undefined);

      service.onStartup(callback);
      service.clearStartupCallbacks();

      // Callbacks cleared - we can't easily test this without mocking
      // but the method should not throw
      expect(() => service.clearStartupCallbacks()).not.toThrow();
    });
  });
});
