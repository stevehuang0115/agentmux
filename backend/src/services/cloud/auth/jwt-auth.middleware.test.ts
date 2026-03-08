/**
 * Tests for JWT Auth Middleware
 *
 * Tests requireAuth and requirePlan middleware functions.
 *
 * @module services/cloud/auth/jwt-auth.middleware.test
 */

import type { Request, Response, NextFunction } from 'express';
import { requireAuth, requirePlan, type AuthenticatedRequest } from './jwt-auth.middleware.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockVerifyToken = jest.fn();

jest.mock('./auth.service.js', () => ({
  AuthService: {
    getInstance: () => ({
      verifyToken: mockVerifyToken,
    }),
  },
}));

jest.mock('../../core/logger.service.js', () => ({
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

function mockReq(authHeader?: string): Request {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    path: '/test',
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

describe('JWT Auth Middleware', () => {
  const next: NextFunction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // requireAuth
  // -----------------------------------------------------------------------

  describe('requireAuth', () => {
    it('should return 401 when no Authorization header', () => {
      const req = mockReq();
      const res = mockRes();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Authentication required') }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when Authorization header has no Bearer prefix', () => {
      const req = mockReq('Basic token123');
      const res = mockRes();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when token verification fails', () => {
      const req = mockReq('Bearer invalid-token');
      const res = mockRes();
      mockVerifyToken.mockImplementation(() => {
        throw new Error('Invalid token signature');
      });

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid token signature' }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when token is expired', () => {
      const req = mockReq('Bearer expired-token');
      const res = mockRes();
      mockVerifyToken.mockImplementation(() => {
        throw new Error('Token expired');
      });

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when token type is not access', () => {
      const req = mockReq('Bearer refresh-token');
      const res = mockRes();
      mockVerifyToken.mockReturnValue({
        sub: 'user-1', email: 'a@b.com', plan: 'free',
        iat: 1000, exp: 9999999999, iss: 'crewly-cloud', type: 'refresh',
      });

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('access token') }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next and set req.user for valid access token', () => {
      const req = mockReq('Bearer valid-token');
      const res = mockRes();
      mockVerifyToken.mockReturnValue({
        sub: 'user-123', email: 'test@example.com', plan: 'pro',
        iat: 1000, exp: 9999999999, iss: 'crewly-cloud', type: 'access',
      });

      requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();

      const authReq = req as AuthenticatedRequest;
      expect(authReq.user).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        plan: 'pro',
      });
    });
  });

  // -----------------------------------------------------------------------
  // requirePlan
  // -----------------------------------------------------------------------

  describe('requirePlan', () => {
    it('should return 401 when req.user is not set', () => {
      const req = mockReq();
      const res = mockRes();
      const middleware = requirePlan('pro');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when user plan is free but pro is required', () => {
      const req = mockReq() as AuthenticatedRequest;
      req.user = { userId: 'u1', email: 'a@b.com', plan: 'free' };
      const res = mockRes();
      const middleware = requirePlan('pro');

      middleware(req as Request, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('requires a "pro" plan') }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next when user has pro plan', () => {
      const req = mockReq() as AuthenticatedRequest;
      req.user = { userId: 'u1', email: 'a@b.com', plan: 'pro' };
      const res = mockRes();
      const middleware = requirePlan('pro');

      middleware(req as Request, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
