/**
 * Tests for ContinuationEventEmitter Service
 *
 * @module services/continuation/continuation-events.service.test
 */

import { ContinuationEventEmitter } from './continuation-events.service.js';
import { ContinuationEvent, ContinuationTrigger } from '../../types/continuation.types.js';

// Mock LoggerService
jest.mock('../core/logger.service.js', () => ({
  LoggerService: {
    getInstance: jest.fn(() => ({
      createComponentLogger: jest.fn(() => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      })),
    })),
  },
}));

describe('ContinuationEventEmitter', () => {
  let emitter: ContinuationEventEmitter;

  beforeEach(() => {
    jest.useFakeTimers();
    ContinuationEventEmitter.clearInstance();
    emitter = ContinuationEventEmitter.getInstance();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    ContinuationEventEmitter.clearInstance();
  });

  describe('getInstance', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = ContinuationEventEmitter.getInstance();
      const instance2 = ContinuationEventEmitter.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create a new instance after clearInstance', () => {
      const instance1 = ContinuationEventEmitter.getInstance();
      ContinuationEventEmitter.clearInstance();
      const instance2 = ContinuationEventEmitter.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('registerPtySession', () => {
    it('should register a PTY session for exit events', () => {
      const mockSession = {
        name: 'test-session',
        onExit: jest.fn(),
      };

      emitter.registerPtySession(mockSession, 'agent-001', '/path/to/project');

      expect(emitter.getRegisteredSessions().has('test-session')).toBe(true);
      expect(mockSession.onExit).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should not re-register an already registered session', () => {
      const mockSession = {
        name: 'test-session',
        onExit: jest.fn(),
      };

      emitter.registerPtySession(mockSession, 'agent-001', '/path/to/project');
      emitter.registerPtySession(mockSession, 'agent-001', '/path/to/project');

      expect(mockSession.onExit).toHaveBeenCalledTimes(1);
    });

    it('should emit pty_exit event when session exits', () => {
      const mockSession = {
        name: 'test-session',
        onExit: jest.fn(),
      };

      emitter.registerPtySession(mockSession, 'agent-001', '/path/to/project');

      const eventHandler = jest.fn();
      emitter.on('continuation', eventHandler);

      // Simulate session exit
      const exitCallback = mockSession.onExit.mock.calls[0][0];
      exitCallback(0);

      // Advance timers for debounce
      jest.advanceTimersByTime(6000);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: 'pty_exit',
          sessionName: 'test-session',
          agentId: 'agent-001',
          projectPath: '/path/to/project',
          metadata: { exitCode: 0 },
        })
      );
    });
  });

  describe('unregisterSession', () => {
    it('should remove session from registered sessions', () => {
      const mockSession = {
        name: 'test-session',
        onExit: jest.fn(),
      };

      emitter.registerPtySession(mockSession, 'agent-001', '/path/to/project');
      expect(emitter.getRegisteredSessions().has('test-session')).toBe(true);

      emitter.unregisterSession('test-session');
      expect(emitter.getRegisteredSessions().has('test-session')).toBe(false);
    });

    it('should clear pending events for unregistered session', () => {
      const mockSession = {
        name: 'test-session',
        onExit: jest.fn(),
      };

      emitter.registerPtySession(mockSession, 'agent-001', '/path/to/project');

      // Emit an event that will be pending
      emitter.emitActivityIdle('test-session', 'agent-001', '/path/to/project', {
        lastOutput: 'test',
        idleDuration: 5,
        idleCycles: 2,
      });

      expect(emitter.getPendingEventCount()).toBe(1);

      emitter.unregisterSession('test-session');

      expect(emitter.getPendingEventCount()).toBe(0);
    });
  });

  describe('emitActivityIdle', () => {
    it('should emit activity_idle event with debouncing', () => {
      const eventHandler = jest.fn();
      emitter.on('continuation', eventHandler);

      emitter.emitActivityIdle('test-session', 'agent-001', '/path/to/project', {
        lastOutput: 'last output here',
        idleDuration: 10,
        idleCycles: 5,
      });

      // Event should be pending
      expect(eventHandler).not.toHaveBeenCalled();
      expect(emitter.getPendingEventCount()).toBe(1);

      // Advance past debounce time
      jest.advanceTimersByTime(6000);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: 'activity_idle',
          sessionName: 'test-session',
          agentId: 'agent-001',
          metadata: {
            lastOutput: 'last output here',
            idleDuration: 10,
            idleCycles: 5,
          },
        })
      );
    });

    it('should deduplicate rapid events of the same type', () => {
      const eventHandler = jest.fn();
      emitter.on('continuation', eventHandler);

      // Emit multiple activity_idle events rapidly
      emitter.emitActivityIdle('test-session', 'agent-001', '/path/to/project', {
        idleDuration: 5,
        idleCycles: 2,
      });
      emitter.emitActivityIdle('test-session', 'agent-001', '/path/to/project', {
        idleDuration: 6,
        idleCycles: 3,
      });
      emitter.emitActivityIdle('test-session', 'agent-001', '/path/to/project', {
        idleDuration: 7,
        idleCycles: 4,
      });

      jest.advanceTimersByTime(6000);

      // Only the last event should be emitted (due to debouncing)
      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            idleDuration: 7,
            idleCycles: 4,
          }),
        })
      );
    });
  });

  describe('emitHeartbeatStale', () => {
    it('should emit heartbeat_stale event', () => {
      const eventHandler = jest.fn();
      emitter.on('continuation', eventHandler);

      const lastHeartbeat = new Date().toISOString();
      emitter.emitHeartbeatStale('test-session', 'agent-001', '/path/to/project', lastHeartbeat);

      jest.advanceTimersByTime(6000);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: 'heartbeat_stale',
          sessionName: 'test-session',
          metadata: { lastHeartbeat },
        })
      );
    });
  });

  describe('emitExplicitRequest', () => {
    it('should emit explicit_request event with reason', () => {
      const eventHandler = jest.fn();
      emitter.on('continuation', eventHandler);

      emitter.emitExplicitRequest('test-session', 'agent-001', '/path/to/project', 'User requested continuation');

      jest.advanceTimersByTime(6000);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: 'explicit_request',
          metadata: { requestReason: 'User requested continuation' },
        })
      );
    });

    it('should emit explicit_request event without reason', () => {
      const eventHandler = jest.fn();
      emitter.on('continuation', eventHandler);

      emitter.emitExplicitRequest('test-session', 'agent-001', '/path/to/project');

      jest.advanceTimersByTime(6000);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: 'explicit_request',
          metadata: { requestReason: undefined },
        })
      );
    });
  });

  describe('trigger', () => {
    it('should emit event immediately without debouncing', () => {
      const eventHandler = jest.fn();
      emitter.on('continuation', eventHandler);

      const event: ContinuationEvent = {
        trigger: 'pty_exit',
        sessionName: 'test-session',
        agentId: 'agent-001',
        projectPath: '/path/to/project',
        timestamp: new Date().toISOString(),
        metadata: { exitCode: 0 },
      };

      emitter.trigger(event);

      // Should emit immediately without waiting for debounce
      expect(eventHandler).toHaveBeenCalledWith(event);
    });

    it('should skip duplicate events within dedup window', () => {
      const eventHandler = jest.fn();
      emitter.on('continuation', eventHandler);

      const event: ContinuationEvent = {
        trigger: 'pty_exit',
        sessionName: 'test-session',
        agentId: 'agent-001',
        projectPath: '/path/to/project',
        timestamp: new Date().toISOString(),
        metadata: { exitCode: 0 },
      };

      emitter.trigger(event);
      emitter.trigger(event);
      emitter.trigger(event);

      expect(eventHandler).toHaveBeenCalledTimes(1);
    });

    it('should allow same event after dedup window expires', () => {
      const eventHandler = jest.fn();
      emitter.on('continuation', eventHandler);

      const event: ContinuationEvent = {
        trigger: 'pty_exit',
        sessionName: 'test-session',
        agentId: 'agent-001',
        projectPath: '/path/to/project',
        timestamp: new Date().toISOString(),
        metadata: { exitCode: 0 },
      };

      emitter.trigger(event);
      expect(eventHandler).toHaveBeenCalledTimes(1);

      // Advance past dedup window
      jest.advanceTimersByTime(11000);

      emitter.trigger(event);
      expect(eventHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('different event types for same session', () => {
    it('should allow different trigger types for the same session', () => {
      const eventHandler = jest.fn();
      emitter.on('continuation', eventHandler);

      emitter.emitActivityIdle('test-session', 'agent-001', '/path/to/project', {
        idleDuration: 5,
        idleCycles: 2,
      });

      emitter.emitHeartbeatStale('test-session', 'agent-001', '/path/to/project', new Date().toISOString());

      jest.advanceTimersByTime(6000);

      expect(eventHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanup', () => {
    it('should clean up recent events periodically', () => {
      const eventHandler = jest.fn();
      emitter.on('continuation', eventHandler);

      const event: ContinuationEvent = {
        trigger: 'pty_exit',
        sessionName: 'test-session',
        agentId: 'agent-001',
        projectPath: '/path/to/project',
        timestamp: new Date().toISOString(),
        metadata: { exitCode: 0 },
      };

      emitter.trigger(event);
      expect(eventHandler).toHaveBeenCalledTimes(1);

      // Advance past cleanup interval (60 seconds) + dedup window
      jest.advanceTimersByTime(120000);

      // Now the event should be allowed again
      emitter.trigger(event);
      expect(eventHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('getPendingEventCount', () => {
    it('should return correct count of pending events', () => {
      expect(emitter.getPendingEventCount()).toBe(0);

      emitter.emitActivityIdle('session-1', 'agent-001', '/path', { idleDuration: 5, idleCycles: 2 });
      expect(emitter.getPendingEventCount()).toBe(1);

      emitter.emitHeartbeatStale('session-2', 'agent-002', '/path', new Date().toISOString());
      expect(emitter.getPendingEventCount()).toBe(2);

      // Advance past debounce time
      jest.advanceTimersByTime(6000);
      expect(emitter.getPendingEventCount()).toBe(0);
    });
  });

  describe('getRegisteredSessions', () => {
    it('should return a copy of registered sessions', () => {
      const mockSession1 = { name: 'session-1', onExit: jest.fn() };
      const mockSession2 = { name: 'session-2', onExit: jest.fn() };

      emitter.registerPtySession(mockSession1, 'agent-001', '/path');
      emitter.registerPtySession(mockSession2, 'agent-002', '/path');

      const sessions = emitter.getRegisteredSessions();
      expect(sessions.size).toBe(2);
      expect(sessions.has('session-1')).toBe(true);
      expect(sessions.has('session-2')).toBe(true);

      // Modifying the returned set should not affect the original
      sessions.delete('session-1');
      expect(emitter.getRegisteredSessions().has('session-1')).toBe(true);
    });
  });
});
