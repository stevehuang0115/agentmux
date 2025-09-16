import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { WebSocketService } from './websocket.service';

// Mock socket.io-client
const mockSocket = {
  connected: false,
  id: 'test-socket-id',
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('socket.io-client', () => {
  return { default: vi.fn(() => mockSocket) };
});

// Mock console methods
const consoleSpy = {
  log: vi.spyOn(console, 'log').mockImplementation(),
  error: vi.spyOn(console, 'error').mockImplementation(),
};

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    protocol: 'http:',
    host: 'localhost:8788',
  },
  writable: true,
});

// Mock timers
vi.useFakeTimers();

describe('WebSocketService', () => {
  let service: WebSocketService;
  const mockCallback = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
    mockSocket.on.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.disconnect.mockClear();
    
    service = new WebSocketService();
  });

  afterEach(() => {
    service.destroy();
    vi.clearAllTimers();
  });

  afterAll(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.error.mockRestore();
    vi.useRealTimers();
  });

  describe('Constructor', () => {
    it('uses default URL when none provided', () => {
      const defaultService = new WebSocketService();
      expect(defaultService).toBeDefined();
    });

    it('uses provided URL', () => {
      const customService = new WebSocketService('ws://custom:8080');
      expect(customService).toBeDefined();
    });
  });

  describe('Connection Management', () => {
    it('connects successfully when socket connects', async () => {
      const connectPromise = service.connect();
      
      // Simulate successful connection
      mockSocket.connected = true;
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      connectHandler?.();

      await expect(connectPromise).resolves.toBeUndefined();
      expect(consoleSpy.log).toHaveBeenCalledWith('WebSocket connected:', 'test-socket-id');
    });

    it('rejects when initial connection fails', async () => {
      const connectPromise = service.connect();
      
      // Simulate connection error
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')?.[1];
      const testError = new Error('Connection failed');
      errorHandler?.(testError);

      await expect(connectPromise).rejects.toBe(testError);
    });

    it('does not reconnect when already connected', async () => {
      mockSocket.connected = true;
      
      await service.connect();
      
      expect(mockSocket.on).not.toHaveBeenCalled();
    });

    it('handles intentional disconnect', () => {
      service.disconnect();
      
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith('WebSocket intentionally disconnected');
    });

    it('handles unexpected disconnection with reconnection', () => {
      const connectSpy = vi.spyOn(service, 'connect').mockResolvedValue();
      
      // Set up connection first
      const connectPromise = service.connect();
      mockSocket.connected = true;
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      connectHandler?.();
      
      // Simulate unexpected disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')?.[1];
      disconnectHandler?.('io server disconnect');

      // Fast-forward timer to trigger reconnection
      vi.advanceTimersByTime(1000);

      expect(connectSpy).toHaveBeenCalled();
    });
  });

  describe('Event Listener Management', () => {
    it('adds event listeners', () => {
      service.on('test_event', mockCallback);
      
      // Verify the listener was added by emitting an event
      service.emit('test_event', { test: 'data' });
      expect(mockCallback).toHaveBeenCalledWith({ test: 'data' });
    });

    it('removes event listeners', () => {
      service.on('test_event', mockCallback);
      service.off('test_event', mockCallback);
      
      // Verify the listener was removed
      service.emit('test_event', { test: 'data' });
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('handles multiple listeners for same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      service.on('test_event', callback1);
      service.on('test_event', callback2);
      
      service.emit('test_event', { test: 'data' });
      
      expect(callback1).toHaveBeenCalledWith({ test: 'data' });
      expect(callback2).toHaveBeenCalledWith({ test: 'data' });
    });

    it('handles errors in event callbacks gracefully', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      
      service.on('test_event', errorCallback);
      service.emit('test_event', { test: 'data' });
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Error in WebSocket event handler for test_event:',
        expect.any(Error)
      );
    });
  });

  describe('Terminal Session Management', () => {
    beforeEach(() => {
      mockSocket.connected = true;
    });

    it('subscribes to terminal session', () => {
      service.subscribeToSession('test-session');
      
      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe_to_session', 'test-session');
      expect(consoleSpy.log).toHaveBeenCalledWith('Subscribing to session:', 'test-session');
    });

    it('unsubscribes from terminal session', () => {
      service.unsubscribeFromSession('test-session');
      
      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe_from_session', 'test-session');
      expect(consoleSpy.log).toHaveBeenCalledWith('Unsubscribing from session:', 'test-session');
    });

    it('sends terminal input', () => {
      service.sendInput('test-session', 'ls -la');
      
      expect(mockSocket.emit).toHaveBeenCalledWith('send_input', {
        sessionName: 'test-session',
        input: 'ls -la'
      });
    });

    it('resizes terminal', () => {
      service.resizeTerminal('test-session', 80, 24);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('terminal_resize', {
        sessionName: 'test-session',
        cols: 80,
        rows: 24
      });
    });

    it('handles operations when not connected', () => {
      mockSocket.connected = false;
      
      service.subscribeToSession('test-session');
      service.unsubscribeFromSession('test-session');
      service.sendInput('test-session', 'command');
      service.resizeTerminal('test-session', 80, 24);
      
      expect(consoleSpy.error).toHaveBeenCalledTimes(4);
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('Socket Event Handling', () => {
    beforeEach(async () => {
      // Set up connection with all event handlers
      const connectPromise = service.connect();
      mockSocket.connected = true;
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      connectHandler?.();
      await connectPromise;
    });

    it('handles terminal_output events', () => {
      service.on('terminal_output', mockCallback);
      
      const terminalOutputHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'terminal_output'
      )?.[1];
      
      const testMessage = {
        type: 'terminal_output',
        payload: { sessionName: 'test', content: 'output' },
        timestamp: '2023-01-01T00:00:00Z'
      };
      
      terminalOutputHandler?.(testMessage);
      
      expect(mockCallback).toHaveBeenCalledWith(testMessage.payload);
    });

    it('handles initial_terminal_state events', () => {
      service.on('initial_terminal_state', mockCallback);
      
      const initialStateHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'initial_terminal_state'
      )?.[1];
      
      const testMessage = {
        type: 'initial_terminal_state',
        payload: { sessionName: 'test', content: 'initial content' },
        timestamp: '2023-01-01T00:00:00Z'
      };
      
      initialStateHandler?.(testMessage);
      
      expect(mockCallback).toHaveBeenCalledWith(testMessage.payload);
    });

    it('handles error events', () => {
      service.on('error', mockCallback);
      
      const errorHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];
      
      const testMessage = {
        type: 'error',
        payload: { error: 'Test error' },
        timestamp: '2023-01-01T00:00:00Z'
      };
      
      errorHandler?.(testMessage);
      
      expect(consoleSpy.error).toHaveBeenCalledWith('WebSocket error:', testMessage.payload);
      expect(mockCallback).toHaveBeenCalledWith(testMessage.payload);
    });

    it('handles team activity events', () => {
      const orchestratorCallback = vi.fn();
      const memberCallback = vi.fn();
      const activityCallback = vi.fn();
      
      service.on('orchestrator_status_changed', orchestratorCallback);
      service.on('team_member_status_changed', memberCallback);
      service.on('team_activity_updated', activityCallback);
      
      const orchestratorHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'orchestrator_status_changed'
      )?.[1];
      const memberHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'team_member_status_changed'
      )?.[1];
      const activityHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'team_activity_updated'
      )?.[1];
      
      const testMessages = [
        { payload: { status: 'active' } },
        { payload: { memberId: '1', status: 'active' } },
        { payload: { teamId: 'team1', activity: 'updated' } }
      ];
      
      orchestratorHandler?.(testMessages[0]);
      memberHandler?.(testMessages[1]);
      activityHandler?.(testMessages[2]);
      
      expect(orchestratorCallback).toHaveBeenCalledWith(testMessages[0].payload);
      expect(memberCallback).toHaveBeenCalledWith(testMessages[1].payload);
      expect(activityCallback).toHaveBeenCalledWith(testMessages[2].payload);
    });
  });

  describe('Connection Status', () => {
    it('returns correct connection status when disconnected', () => {
      expect(service.isConnected()).toBe(false);
      expect(service.getConnectionState()).toBe('disconnected');
    });

    it('returns correct connection status when connected', async () => {
      const connectPromise = service.connect();
      mockSocket.connected = true;
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      connectHandler?.();
      await connectPromise;
      
      expect(service.isConnected()).toBe(true);
      expect(service.getConnectionState()).toBe('connected');
    });

    it('returns reconnecting status during reconnection attempts', () => {
      // Start connection
      service.connect();
      
      // Simulate disconnect that triggers reconnection
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')?.[1];
      disconnectHandler?.('io server disconnect');
      
      expect(service.getConnectionState()).toBe('reconnecting');
    });
  });

  describe('Reconnection Logic', () => {
    it('attempts reconnection on unexpected disconnect', () => {
      const connectSpy = vi.spyOn(service, 'connect').mockResolvedValue();
      
      // Set up initial connection
      service.connect();
      mockSocket.connected = true;
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      connectHandler?.();
      
      // Simulate unexpected disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')?.[1];
      disconnectHandler?.('io server disconnect');
      
      // Fast-forward timer
      vi.advanceTimersByTime(1000);
      
      expect(connectSpy).toHaveBeenCalled();
    });

    it('stops reconnection after max attempts', () => {
      service.on('connection_failed', mockCallback);
      
      // Simulate multiple failed connection attempts
      for (let i = 0; i < 6; i++) {
        service.connect();
        const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')?.[1];
        errorHandler?.(new Error('Connection failed'));
        
        // Advance timer for reconnection attempts
        vi.advanceTimersByTime(5000);
      }
      
      expect(mockCallback).toHaveBeenCalledWith({
        reason: 'Max reconnection attempts reached'
      });
    });

    it('uses exponential backoff for reconnection attempts', () => {
      const connectSpy = vi.spyOn(service, 'connect').mockRejectedValue(new Error('Failed'));
      
      // Set up initial connection and disconnect
      service.connect();
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')?.[1];
      disconnectHandler?.('io server disconnect');
      
      // First reconnection attempt - should be ~1000ms
      vi.advanceTimersByTime(1000);
      expect(connectSpy).toHaveBeenCalledTimes(1);
      
      // Second attempt should be longer due to exponential backoff
      vi.advanceTimersByTime(2000);
      expect(connectSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cleanup', () => {
    it('clears all listeners and disconnects on destroy', () => {
      service.on('test_event', mockCallback);
      service.destroy();
      
      expect(mockSocket.disconnect).toHaveBeenCalled();
      
      // Verify listeners are cleared
      service.emit('test_event', { test: 'data' });
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('clears reconnection timer on disconnect', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      // Set up reconnection scenario
      service.connect();
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')?.[1];
      disconnectHandler?.('io server disconnect');
      
      // Now disconnect intentionally
      service.disconnect();
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('Private Methods', () => {
    // These tests access private methods through public interfaces
    it('emits events to registered listeners', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      service.on('test_event', callback1);
      service.on('test_event', callback2);
      service.on('other_event', vi.fn());
      
      // Use internal emit method through socket event simulation
      service.connect();
      const terminalHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'terminal_output'
      )?.[1];
      
      service.on('terminal_output', callback1);
      service.on('terminal_output', callback2);
      
      terminalHandler?.({ payload: { test: 'data' } });
      
      expect(callback1).toHaveBeenCalledWith({ test: 'data' });
      expect(callback2).toHaveBeenCalledWith({ test: 'data' });
    });
  });
});