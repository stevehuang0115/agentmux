/**
 * Tests for Relay Controller
 *
 * Tests both server-side (register, status) and client-side
 * (connect, disconnect, devices, send) relay endpoints.
 *
 * @module controllers/cloud/relay.controller.test
 */

import type { Request, Response, NextFunction } from 'express';
import {
  registerRelayNode,
  getRelayStatus,
  connectToRelay,
  disconnectFromRelay,
  getRelayDevices,
  sendRelayMessage,
} from './relay.controller.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockIsRunning = jest.fn();
const mockGetClientCount = jest.fn();
const mockGetSessions = jest.fn();

jest.mock('../../services/cloud/relay-server.service.js', () => ({
  RelayServerService: {
    getInstance: () => ({
      isRunning: mockIsRunning,
      getClientCount: mockGetClientCount,
      getSessions: mockGetSessions,
    }),
  },
}));

const mockClientConnect = jest.fn();
const mockClientDisconnect = jest.fn();
const mockClientSend = jest.fn();
const mockClientGetState = jest.fn();
const mockClientGetSessionId = jest.fn();

jest.mock('../../services/cloud/relay-client.service.js', () => ({
  RelayClientService: {
    getInstance: () => ({
      connect: mockClientConnect,
      disconnect: mockClientDisconnect,
      send: mockClientSend,
      getState: mockClientGetState,
      getSessionId: mockClientGetSessionId,
    }),
  },
}));

jest.mock('../../services/core/logger.service.js', () => ({
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

function mockReq(body: Record<string, unknown> = {}): Request {
  return {
    body,
    secure: false,
    get: jest.fn().mockReturnValue('localhost:3000'),
  } as unknown as Request;
}

function mockRes(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Relay Controller', () => {
  const next: NextFunction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // POST /relay/register
  // -----------------------------------------------------------------------

  describe('registerRelayNode', () => {
    it('should return 400 when role is missing', async () => {
      const req = mockReq({ pairingCode: 'abc' });
      const res = mockRes();

      await registerRelayNode(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });

    it('should return 400 when pairingCode is missing', async () => {
      const req = mockReq({ role: 'agent' });
      const res = mockRes();

      await registerRelayNode(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for invalid role', async () => {
      const req = mockReq({ role: 'invalid', pairingCode: 'abc' });
      const res = mockRes();
      mockIsRunning.mockReturnValue(true);

      await registerRelayNode(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Invalid role') }),
      );
    });

    it('should return 503 when relay server is not running', async () => {
      const req = mockReq({ role: 'agent', pairingCode: 'abc' });
      const res = mockRes();
      mockIsRunning.mockReturnValue(false);

      await registerRelayNode(req, res, next);
      expect(res.status).toHaveBeenCalledWith(503);
    });

    it('should return success with sessionId and wsUrl when valid', async () => {
      const req = mockReq({ role: 'agent', pairingCode: 'abc-123' });
      const res = mockRes();
      mockIsRunning.mockReturnValue(true);

      await registerRelayNode(req, res, next);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          sessionId: expect.any(String),
          wsUrl: expect.stringContaining('ws://'),
        }),
      );
    });

    it('should accept orchestrator role', async () => {
      const req = mockReq({ role: 'orchestrator', pairingCode: 'abc-123' });
      const res = mockRes();
      mockIsRunning.mockReturnValue(true);

      await registerRelayNode(req, res, next);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // GET /relay/status
  // -----------------------------------------------------------------------

  describe('getRelayStatus', () => {
    it('should return running status and sessions', async () => {
      const req = mockReq();
      const res = mockRes();

      mockIsRunning.mockReturnValue(true);
      mockGetClientCount.mockReturnValue(2);
      mockGetSessions.mockReturnValue([
        { sessionId: 's1', role: 'agent', state: 'paired' },
        { sessionId: 's2', role: 'orchestrator', state: 'paired' },
      ]);

      await getRelayStatus(req, res, next);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          running: true,
          clientCount: 2,
          sessions: expect.arrayContaining([
            expect.objectContaining({ sessionId: 's1' }),
          ]),
        },
      });
    });

    it('should return not running when server is stopped', async () => {
      const req = mockReq();
      const res = mockRes();

      mockIsRunning.mockReturnValue(false);
      mockGetClientCount.mockReturnValue(0);
      mockGetSessions.mockReturnValue([]);

      await getRelayStatus(req, res, next);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ running: false, clientCount: 0 }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // POST /relay/connect
  // -----------------------------------------------------------------------

  describe('connectToRelay', () => {
    const validBody = {
      wsUrl: 'ws://relay.example.com:8787/relay',
      pairingCode: 'test-pair',
      role: 'agent',
      token: 'tok-123',
      sharedSecret: 'my-secret',
    };

    it('should return 400 when wsUrl is missing', async () => {
      const req = mockReq({ ...validBody, wsUrl: undefined });
      const res = mockRes();

      await connectToRelay(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.stringContaining('wsUrl') }),
      );
    });

    it('should return 400 when pairingCode is missing', async () => {
      const req = mockReq({ ...validBody, pairingCode: undefined });
      const res = mockRes();

      await connectToRelay(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when token is missing', async () => {
      const req = mockReq({ ...validBody, token: undefined });
      const res = mockRes();

      await connectToRelay(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when sharedSecret is missing', async () => {
      const req = mockReq({ ...validBody, sharedSecret: undefined });
      const res = mockRes();

      await connectToRelay(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for invalid role', async () => {
      const req = mockReq({ ...validBody, role: 'invalid-role' });
      const res = mockRes();

      await connectToRelay(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Invalid role') }),
      );
    });

    it('should return 409 when client is already connected', async () => {
      const req = mockReq(validBody);
      const res = mockRes();
      mockClientGetState.mockReturnValue('registered');

      await connectToRelay(req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('registered') }),
      );
    });

    it('should return 409 when client is paired', async () => {
      const req = mockReq(validBody);
      const res = mockRes();
      mockClientGetState.mockReturnValue('paired');

      await connectToRelay(req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('should connect successfully from disconnected state', async () => {
      const req = mockReq(validBody);
      const res = mockRes();
      mockClientGetState.mockReturnValue('disconnected');

      await connectToRelay(req, res, next);
      expect(mockClientConnect).toHaveBeenCalledWith({
        wsUrl: validBody.wsUrl,
        pairingCode: validBody.pairingCode,
        role: validBody.role,
        token: validBody.token,
        sharedSecret: validBody.sharedSecret,
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ message: expect.stringContaining('initiated') }),
        }),
      );
    });

    it('should connect successfully from error state', async () => {
      const req = mockReq(validBody);
      const res = mockRes();
      mockClientGetState.mockReturnValue('error');

      await connectToRelay(req, res, next);
      expect(mockClientConnect).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // POST /relay/disconnect
  // -----------------------------------------------------------------------

  describe('disconnectFromRelay', () => {
    it('should disconnect and return previous state', async () => {
      const req = mockReq();
      const res = mockRes();
      mockClientGetState
        .mockReturnValueOnce('paired')     // previousState
        .mockReturnValueOnce('disconnected'); // after disconnect

      await disconnectFromRelay(req, res, next);
      expect(mockClientDisconnect).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          previousState: 'paired',
          state: 'disconnected',
          message: 'Relay client disconnected',
        },
      });
    });

    it('should handle disconnecting when already disconnected', async () => {
      const req = mockReq();
      const res = mockRes();
      mockClientGetState.mockReturnValue('disconnected');

      await disconnectFromRelay(req, res, next);
      expect(mockClientDisconnect).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // GET /relay/devices
  // -----------------------------------------------------------------------

  describe('getRelayDevices', () => {
    it('should return client info and server sessions', async () => {
      const req = mockReq();
      const res = mockRes();
      mockClientGetState.mockReturnValue('paired');
      mockClientGetSessionId.mockReturnValue('client-sess-1');
      mockIsRunning.mockReturnValue(true);
      mockGetSessions.mockReturnValue([
        {
          sessionId: 's1',
          role: 'agent',
          state: 'paired',
          pairedWith: 's2',
          registeredAt: '2026-01-01T00:00:00.000Z',
          lastHeartbeatAt: '2026-01-01T00:01:00.000Z',
        },
      ]);

      await getRelayDevices(req, res, next);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          client: { state: 'paired', sessionId: 'client-sess-1' },
          serverRunning: true,
          devices: [
            {
              sessionId: 's1',
              role: 'agent',
              state: 'paired',
              pairedWith: 's2',
              registeredAt: '2026-01-01T00:00:00.000Z',
              lastHeartbeatAt: '2026-01-01T00:01:00.000Z',
            },
          ],
        },
      });
    });

    it('should return empty devices when server is not running', async () => {
      const req = mockReq();
      const res = mockRes();
      mockClientGetState.mockReturnValue('disconnected');
      mockClientGetSessionId.mockReturnValue(null);
      mockIsRunning.mockReturnValue(false);

      await getRelayDevices(req, res, next);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          client: { state: 'disconnected', sessionId: null },
          serverRunning: false,
          devices: [],
        },
      });
    });
  });

  // -----------------------------------------------------------------------
  // POST /relay/send
  // -----------------------------------------------------------------------

  describe('sendRelayMessage', () => {
    it('should return 400 when message is missing', async () => {
      const req = mockReq({});
      const res = mockRes();

      await sendRelayMessage(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('message') }),
      );
    });

    it('should return 400 when message is empty string', async () => {
      const req = mockReq({ message: '' });
      const res = mockRes();

      await sendRelayMessage(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when message is not a string', async () => {
      const req = mockReq({ message: 123 });
      const res = mockRes();

      await sendRelayMessage(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 409 when client is not paired', async () => {
      const req = mockReq({ message: 'hello' });
      const res = mockRes();
      mockClientGetState.mockReturnValue('registered');

      await sendRelayMessage(req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('registered') }),
      );
    });

    it('should return 409 when client is disconnected', async () => {
      const req = mockReq({ message: 'hello' });
      const res = mockRes();
      mockClientGetState.mockReturnValue('disconnected');

      await sendRelayMessage(req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('should send message successfully when paired', async () => {
      const req = mockReq({ message: 'hello relay!' });
      const res = mockRes();
      mockClientGetState.mockReturnValue('paired');

      await sendRelayMessage(req, res, next);
      expect(mockClientSend).toHaveBeenCalledWith('hello relay!');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          sent: true,
          messageLength: 12,
        },
      });
    });

    it('should call next on unexpected errors', async () => {
      const req = mockReq({ message: 'hello' });
      const res = mockRes();
      mockClientGetState.mockReturnValue('paired');
      mockClientSend.mockImplementation(() => {
        throw new Error('Encryption key not derived');
      });

      await sendRelayMessage(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
