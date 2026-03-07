/**
 * Tests for CloudAuthMiddleware
 *
 * @module services/cloud/cloud-auth.middleware.test
 */

import type { Request, Response, NextFunction } from 'express';
import { isCloudConnected, requireCloudConnection, requireTier } from './cloud-auth.middleware.js';
import { CloudClientService } from './cloud-client.service.js';

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

// We mock the CloudClientService module so we can control isConnected/getTier
const mockIsConnected = jest.fn<boolean, []>();
const mockGetTier = jest.fn<string, []>();

jest.mock('./cloud-client.service.js', () => ({
  CloudClientService: {
    getInstance: () => ({
      isConnected: mockIsConnected,
      getTier: mockGetTier,
    }),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal mock Express Request. */
function mockReq(overrides: Partial<Request> = {}): Request {
  return { path: '/test', ...overrides } as unknown as Request;
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

describe('CloudAuthMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----- isCloudConnected() -----------------------------------------------

  describe('isCloudConnected()', () => {
    it('should return true when client is connected', () => {
      mockIsConnected.mockReturnValue(true);
      expect(isCloudConnected()).toBe(true);
    });

    it('should return false when client is not connected', () => {
      mockIsConnected.mockReturnValue(false);
      expect(isCloudConnected()).toBe(false);
    });
  });

  // ----- requireCloudConnection -------------------------------------------

  describe('requireCloudConnection()', () => {
    it('should call next() when connected', () => {
      mockIsConnected.mockReturnValue(true);

      const req = mockReq();
      const res = mockRes();

      requireCloudConnection(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should respond 403 when not connected', () => {
      mockIsConnected.mockReturnValue(false);

      const req = mockReq();
      const res = mockRes();

      requireCloudConnection(req, res, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Cloud connection required'),
        }),
      );
    });
  });

  // ----- requireTier() ----------------------------------------------------

  describe('requireTier()', () => {
    it('should call next() when tier meets requirement', () => {
      mockIsConnected.mockReturnValue(true);
      mockGetTier.mockReturnValue('enterprise');

      const middleware = requireTier('pro');
      const req = mockReq();
      const res = mockRes();

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should call next() when tier exactly matches requirement', () => {
      mockIsConnected.mockReturnValue(true);
      mockGetTier.mockReturnValue('pro');

      const middleware = requireTier('pro');
      const req = mockReq();
      const res = mockRes();

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should respond 403 when tier is insufficient', () => {
      mockIsConnected.mockReturnValue(true);
      mockGetTier.mockReturnValue('free');

      const middleware = requireTier('pro');
      const req = mockReq();
      const res = mockRes();

      middleware(req, res, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('requires a "pro" subscription'),
        }),
      );
    });

    it('should respond 403 when not connected', () => {
      mockIsConnected.mockReturnValue(false);

      const middleware = requireTier('pro');
      const req = mockReq();
      const res = mockRes();

      middleware(req, res, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Cloud connection required'),
        }),
      );
    });

    it('should respond 403 for enterprise requirement when tier is pro', () => {
      mockIsConnected.mockReturnValue(true);
      mockGetTier.mockReturnValue('pro');

      const middleware = requireTier('enterprise');
      const req = mockReq();
      const res = mockRes();

      middleware(req, res, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('requires a "enterprise" subscription'),
        }),
      );
    });
  });
});
