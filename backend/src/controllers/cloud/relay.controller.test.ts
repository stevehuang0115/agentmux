/**
 * Tests for Relay Controller
 *
 * @module controllers/cloud/relay.controller.test
 */

import type { Request, Response, NextFunction } from 'express';
import { registerRelayNode, getRelayStatus } from './relay.controller.js';

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
});
