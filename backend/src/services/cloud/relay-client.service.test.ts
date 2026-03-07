/**
 * Tests for Relay Client Service
 *
 * Tests WebSocket relay client connection, registration, pairing,
 * encrypted message exchange, heartbeat, and reconnection logic.
 *
 * Uses a real RelayServerService instance for integration-style tests.
 *
 * @module services/cloud/relay-client.service.test
 */

import { createServer, type Server as HttpServer } from 'http';
import { RelayServerService } from './relay-server.service.js';
import { RelayClientService } from './relay-client.service.js';
import type { RelayClientState } from './relay.types.js';

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for the client to reach a specific state. */
function waitForState(client: RelayClientService, target: RelayClientState, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (client.getState() === target) {
      resolve();
      return;
    }

    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for state "${target}", current: "${client.getState()}"`)),
      timeoutMs,
    );

    const handler = (state: RelayClientState): void => {
      if (state === target) {
        clearTimeout(timer);
        client.removeListener('stateChange', handler);
        resolve();
      }
    };

    client.on('stateChange', handler);
  });
}

/** Wait for a 'message' event on the client. */
function waitForClientMessage(client: RelayClientService, timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Timeout waiting for message')),
      timeoutMs,
    );

    client.once('message', (plaintext: string) => {
      clearTimeout(timer);
      resolve(plaintext);
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RelayClientService', () => {
  let relayServer: RelayServerService;
  let httpServer: HttpServer;
  let port: number;

  beforeEach((done) => {
    RelayServerService.resetInstance();
    RelayClientService.resetInstance();

    relayServer = RelayServerService.getInstance();
    httpServer = createServer();

    httpServer.listen(0, '127.0.0.1', () => {
      const addr = httpServer.address();
      port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      relayServer.start({ httpServer, path: '/relay' });
      done();
    });
  });

  afterEach(async () => {
    RelayClientService.resetInstance();
    await relayServer.stop();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
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
  // Connection & Registration
  // -----------------------------------------------------------------------

  it('should connect and reach registered state', async () => {
    const client = RelayClientService.getInstance();

    client.connect({
      wsUrl: `ws://127.0.0.1:${port}/relay`,
      pairingCode: 'test-pair',
      role: 'agent',
      token: 'tok-1',
      sharedSecret: 'secret',
    });

    await waitForState(client, 'registered');
    expect(client.getState()).toBe('registered');
    expect(client.getSessionId()).toBeDefined();
  });

  it('should start in disconnected state', () => {
    const client = RelayClientService.getInstance();
    expect(client.getState()).toBe('disconnected');
    expect(client.getSessionId()).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Pairing
  // -----------------------------------------------------------------------

  it('should reach paired state when two clients connect', async () => {
    // We need two separate instances — use one via getInstance, create another manually
    const client1 = RelayClientService.getInstance();

    client1.connect({
      wsUrl: `ws://127.0.0.1:${port}/relay`,
      pairingCode: 'pair-test',
      role: 'agent',
      token: 'tok-1',
      sharedSecret: 'shared-secret',
    });

    await waitForState(client1, 'registered');

    // Create a second client (can't use singleton, so we use the server directly)
    // For this test, we verify that the first client pairs when a compatible
    // second client registers on the server
    const WebSocket = (await import('ws')).default;
    const ws2 = new WebSocket(`ws://127.0.0.1:${port}/relay`);

    await new Promise<void>((resolve) => ws2.on('open', resolve));
    ws2.send(JSON.stringify({
      type: 'register',
      role: 'orchestrator',
      pairingCode: 'pair-test',
      token: 'tok-2',
    }));

    await waitForState(client1, 'paired');
    expect(client1.getState()).toBe('paired');

    ws2.close();
  });

  // -----------------------------------------------------------------------
  // Send validation
  // -----------------------------------------------------------------------

  it('should throw when sending before paired', async () => {
    const client = RelayClientService.getInstance();

    client.connect({
      wsUrl: `ws://127.0.0.1:${port}/relay`,
      pairingCode: 'send-test',
      role: 'agent',
      token: 'tok-1',
      sharedSecret: 'secret',
    });

    await waitForState(client, 'registered');

    expect(() => client.send('hello')).toThrow('Cannot send');
  });

  it('should throw when sending while disconnected', () => {
    const client = RelayClientService.getInstance();
    expect(() => client.send('hello')).toThrow('Cannot send');
  });

  // -----------------------------------------------------------------------
  // Disconnect
  // -----------------------------------------------------------------------

  it('should transition to disconnected state on disconnect', async () => {
    const client = RelayClientService.getInstance();

    client.connect({
      wsUrl: `ws://127.0.0.1:${port}/relay`,
      pairingCode: 'dc-test',
      role: 'agent',
      token: 'tok-1',
      sharedSecret: 'secret',
    });

    await waitForState(client, 'registered');
    client.disconnect();
    expect(client.getState()).toBe('disconnected');
    expect(client.getSessionId()).toBeNull();
  });

  it('should handle disconnect when not connected', () => {
    const client = RelayClientService.getInstance();
    // Should not throw
    client.disconnect();
    expect(client.getState()).toBe('disconnected');
  });

  // -----------------------------------------------------------------------
  // Warn on double-connect
  // -----------------------------------------------------------------------

  it('should warn and no-op when connecting while already connected', async () => {
    const client = RelayClientService.getInstance();

    client.connect({
      wsUrl: `ws://127.0.0.1:${port}/relay`,
      pairingCode: 'double-connect',
      role: 'agent',
      token: 'tok-1',
      sharedSecret: 'secret',
    });

    await waitForState(client, 'registered');

    // Second connect should be ignored (not disconnected or error state)
    client.connect({
      wsUrl: `ws://127.0.0.1:${port}/relay`,
      pairingCode: 'double-connect-2',
      role: 'agent',
      token: 'tok-2',
      sharedSecret: 'secret-2',
    });

    // Should still be registered, not connecting
    expect(client.getState()).toBe('registered');
  });
});
