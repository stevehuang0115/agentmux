/**
 * Tests for Relay Client Service
 *
 * Unit tests for the relay client singleton, state management,
 * connection lifecycle, and send validation.
 *
 * @module services/cloud/relay-client.service.test
 */

import { RelayClientService } from './relay-client.service.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../core/logger.service.js', () => ({
  LoggerService: {
    getInstance: () => ({
      createComponentLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      }),
    }),
  },
}));

// Mock ws to avoid real WebSocket connections
jest.mock('ws', () => {
  const EventEmitter = require('events');
  class MockWebSocket extends EventEmitter {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = 3; // CLOSED
    send = jest.fn();
    close = jest.fn(() => {
      this.readyState = 3;
      this.emit('close');
    });
  }
  return { __esModule: true, default: MockWebSocket, WebSocket: MockWebSocket };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RelayClientService', () => {
  beforeEach(() => {
    RelayClientService.resetInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  it('should return the same instance via getInstance', () => {
    const a = RelayClientService.getInstance();
    const b = RelayClientService.getInstance();
    expect(a).toBe(b);
  });

  it('should create a fresh instance after resetInstance', () => {
    const a = RelayClientService.getInstance();
    RelayClientService.resetInstance();
    const b = RelayClientService.getInstance();
    expect(a).not.toBe(b);
  });

  // -----------------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------------

  it('should start in disconnected state', () => {
    const client = RelayClientService.getInstance();
    expect(client.getState()).toBe('disconnected');
    expect(client.getSessionId()).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Send validation
  // -----------------------------------------------------------------------

  it('should throw when sending while disconnected', () => {
    const client = RelayClientService.getInstance();
    expect(() => client.send('hello')).toThrow('Cannot send');
  });

  // -----------------------------------------------------------------------
  // Disconnect
  // -----------------------------------------------------------------------

  it('should handle disconnect when not connected', () => {
    const client = RelayClientService.getInstance();
    client.disconnect();
    expect(client.getState()).toBe('disconnected');
  });
});
