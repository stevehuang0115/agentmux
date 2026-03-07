/**
 * Tests for Cloud Controller
 *
 * @module controllers/cloud/cloud.controller.test
 */

import type { Request, Response, NextFunction } from 'express';
import { connectToCloud, disconnectFromCloud, getCloudStatus, getCloudTemplates } from './cloud.controller.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
const mockGetStatus = jest.fn();
const mockGetTemplates = jest.fn();
const mockIsConnected = jest.fn();

jest.mock('../../services/cloud/cloud-client.service.js', () => ({
  CloudClientService: {
    getInstance: () => ({
      connect: mockConnect,
      disconnect: mockDisconnect,
      getStatus: mockGetStatus,
      getTemplates: mockGetTemplates,
      isConnected: mockIsConnected,
    }),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal mock Express Request. */
function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    params: {},
    query: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}

/** Build a mock Express Response with chainable status/json. */
function mockRes(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

const mockNext: NextFunction = jest.fn();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Cloud Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----- connectToCloud ---------------------------------------------------

  describe('connectToCloud()', () => {
    it('should connect and return tier on success', async () => {
      mockConnect.mockResolvedValue({ success: true, tier: 'pro' });

      const req = mockReq({ body: { token: 'test-token', cloudUrl: 'https://cloud.test.com' } });
      const res = mockRes();

      await connectToCloud(req, res, mockNext);

      expect(mockConnect).toHaveBeenCalledWith('https://cloud.test.com', 'test-token');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { tier: 'pro' },
      });
    });

    it('should use default cloud URL when not provided', async () => {
      mockConnect.mockResolvedValue({ success: true, tier: 'free' });

      const req = mockReq({ body: { token: 'test-token' } });
      const res = mockRes();

      await connectToCloud(req, res, mockNext);

      expect(mockConnect).toHaveBeenCalledWith(
        expect.stringContaining('cloud.crewly'),
        'test-token',
      );
    });

    it('should return 400 when token is missing', async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();

      await connectToCloud(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('token'),
        }),
      );
    });

    it('should return 401 on authentication failure', async () => {
      mockConnect.mockRejectedValue(new Error('Cloud authentication failed: 401 Unauthorized'));

      const req = mockReq({ body: { token: 'bad-token' } });
      const res = mockRes();

      await connectToCloud(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should call next on unexpected error', async () => {
      const error = new Error('Network error');
      mockConnect.mockRejectedValue(error);

      const req = mockReq({ body: { token: 'test-token' } });
      const res = mockRes();

      await connectToCloud(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  // ----- disconnectFromCloud ----------------------------------------------

  describe('disconnectFromCloud()', () => {
    it('should disconnect and return success', async () => {
      const req = mockReq();
      const res = mockRes();

      await disconnectFromCloud(req, res, mockNext);

      expect(mockDisconnect).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  // ----- getCloudStatus ---------------------------------------------------

  describe('getCloudStatus()', () => {
    it('should return current status', async () => {
      const status = {
        connectionStatus: 'connected',
        cloudUrl: 'https://cloud.test.com',
        tier: 'pro',
        lastSyncAt: '2026-03-07T00:00:00.000Z',
      };
      mockGetStatus.mockReturnValue(status);

      const req = mockReq();
      const res = mockRes();

      await getCloudStatus(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: status,
      });
    });
  });

  // ----- getCloudTemplates ------------------------------------------------

  describe('getCloudTemplates()', () => {
    it('should return templates when connected', async () => {
      mockIsConnected.mockReturnValue(true);
      const templates = [{ id: '1', name: 'Template 1' }];
      mockGetTemplates.mockResolvedValue(templates);

      const req = mockReq();
      const res = mockRes();

      await getCloudTemplates(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: templates,
      });
    });

    it('should return 403 when not connected', async () => {
      mockIsConnected.mockReturnValue(false);

      const req = mockReq();
      const res = mockRes();

      await getCloudTemplates(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Not connected'),
        }),
      );
    });

    it('should call next on fetch error', async () => {
      mockIsConnected.mockReturnValue(true);
      const error = new Error('Fetch failed');
      mockGetTemplates.mockRejectedValue(error);

      const req = mockReq();
      const res = mockRes();

      await getCloudTemplates(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
