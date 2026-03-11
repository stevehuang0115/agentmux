/**
 * Tests for Auth Controller
 *
 * Tests all auth API endpoints: register, login, refresh, me, license.
 *
 * @module controllers/cloud/auth/auth.controller.test
 */

import type { Request, Response, NextFunction } from 'express';
import {
  register,
  login,
  refresh,
  getProfile,
  updateProfile,
  getLicense,
} from './auth.controller.js';
import type { AuthenticatedRequest } from '../../../services/cloud/auth/auth.utils.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRegister = jest.fn();
const mockLogin = jest.fn();
const mockRefreshToken = jest.fn();
const mockGetUserProfile = jest.fn();
const mockUpdateProfile = jest.fn();
const mockGetLicenseStatus = jest.fn();

jest.mock('../../../services/cloud/auth/auth.service.js', () => ({
  AuthService: {
    getInstance: () => ({
      register: mockRegister,
      login: mockLogin,
      refreshToken: mockRefreshToken,
      getUserProfile: mockGetUserProfile,
      updateProfile: mockUpdateProfile,
      getLicenseStatus: mockGetLicenseStatus,
    }),
  },
}));

jest.mock('../../../services/core/logger.service.js', () => ({
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

function mockReq(body: Record<string, unknown> = {}, user?: { userId: string; email: string; plan: string }): Request {
  const req = { body } as unknown as AuthenticatedRequest;
  if (user) {
    req.user = user as AuthenticatedRequest['user'];
  }
  return req as Request;
}

function mockRes(): Response {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Auth Controller', () => {
  const next: NextFunction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // POST /api/auth/register
  // -----------------------------------------------------------------------

  describe('register', () => {
    it('should return 400 when email is missing', async () => {
      const req = mockReq({ password: 'pass1234', displayName: 'Test' });
      const res = mockRes();

      await register(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when password is missing', async () => {
      const req = mockReq({ email: 'test@test.com', displayName: 'Test' });
      const res = mockRes();

      await register(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when displayName is missing', async () => {
      const req = mockReq({ email: 'test@test.com', password: 'pass1234' });
      const res = mockRes();

      await register(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for invalid email format', async () => {
      const req = mockReq({ email: 'not-an-email', password: 'pass1234', displayName: 'Test' });
      const res = mockRes();

      await register(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('email format') }),
      );
    });

    it('should return 400 for short password', async () => {
      const req = mockReq({ email: 'test@test.com', password: 'short', displayName: 'Test' });
      const res = mockRes();

      await register(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('at least 8') }),
      );
    });

    it('should return 409 for duplicate email', async () => {
      const req = mockReq({ email: 'dupe@test.com', password: 'pass12345', displayName: 'Test' });
      const res = mockRes();
      mockRegister.mockRejectedValue(new Error('Email already registered'));

      await register(req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('should return 201 with tokens on success', async () => {
      const tokenResponse = {
        accessToken: 'at', refreshToken: 'rt', expiresIn: 3600,
        user: { id: 'u1', email: 'new@test.com', displayName: 'New', plan: 'free', createdAt: '' },
      };
      mockRegister.mockResolvedValue(tokenResponse);

      const req = mockReq({ email: 'new@test.com', password: 'password123', displayName: 'New' });
      const res = mockRes();

      await register(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: tokenResponse });
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/auth/login
  // -----------------------------------------------------------------------

  describe('login', () => {
    it('should return 400 when email is missing', async () => {
      const req = mockReq({ password: 'pass1234' });
      const res = mockRes();

      await login(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when password is missing', async () => {
      const req = mockReq({ email: 'test@test.com' });
      const res = mockRes();

      await login(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 401 for invalid credentials', async () => {
      mockLogin.mockRejectedValue(new Error('Invalid email or password'));

      const req = mockReq({ email: 'test@test.com', password: 'wrong' });
      const res = mockRes();

      await login(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return tokens on success', async () => {
      const tokenResponse = {
        accessToken: 'at', refreshToken: 'rt', expiresIn: 3600,
        user: { id: 'u1', email: 'test@test.com', displayName: 'Test', plan: 'free', createdAt: '' },
      };
      mockLogin.mockResolvedValue(tokenResponse);

      const req = mockReq({ email: 'test@test.com', password: 'password123' });
      const res = mockRes();

      await login(req, res, next);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: tokenResponse });
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/auth/refresh
  // -----------------------------------------------------------------------

  describe('refresh', () => {
    it('should return 400 when refreshToken is missing', async () => {
      const req = mockReq({});
      const res = mockRes();

      await refresh(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 401 for invalid refresh token', async () => {
      mockRefreshToken.mockRejectedValue(new Error('Invalid token signature'));

      const req = mockReq({ refreshToken: 'bad-token' });
      const res = mockRes();

      await refresh(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 401 for expired token', async () => {
      mockRefreshToken.mockRejectedValue(new Error('Token expired'));

      const req = mockReq({ refreshToken: 'expired-token' });
      const res = mockRes();

      await refresh(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return new tokens on success', async () => {
      const tokenResponse = { accessToken: 'new-at', refreshToken: 'new-rt', expiresIn: 3600, user: {} };
      mockRefreshToken.mockResolvedValue(tokenResponse);

      const req = mockReq({ refreshToken: 'valid-refresh-token' });
      const res = mockRes();

      await refresh(req, res, next);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: tokenResponse });
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/auth/me
  // -----------------------------------------------------------------------

  describe('getProfile', () => {
    it('should return 404 when user not found', async () => {
      mockGetUserProfile.mockResolvedValue(null);

      const req = mockReq({}, { userId: 'u1', email: 'a@b.com', plan: 'free' });
      const res = mockRes();

      await getProfile(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return user profile', async () => {
      const profile = { id: 'u1', email: 'a@b.com', displayName: 'User', plan: 'free', createdAt: '' };
      mockGetUserProfile.mockResolvedValue(profile);

      const req = mockReq({}, { userId: 'u1', email: 'a@b.com', plan: 'free' });
      const res = mockRes();

      await getProfile(req, res, next);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: profile });
    });
  });

  // -----------------------------------------------------------------------
  // PUT /api/auth/me
  // -----------------------------------------------------------------------

  describe('updateProfile', () => {
    it('should return 400 for empty displayName', async () => {
      const req = mockReq({ displayName: '  ' }, { userId: 'u1', email: 'a@b.com', plan: 'free' });
      const res = mockRes();

      await updateProfile(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 for non-existent user', async () => {
      mockUpdateProfile.mockRejectedValue(new Error('User not found'));

      const req = mockReq({ displayName: 'New Name' }, { userId: 'u1', email: 'a@b.com', plan: 'free' });
      const res = mockRes();

      await updateProfile(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should update profile successfully', async () => {
      const updated = { id: 'u1', email: 'a@b.com', displayName: 'Updated', plan: 'free', createdAt: '' };
      mockUpdateProfile.mockResolvedValue(updated);

      const req = mockReq({ displayName: 'Updated' }, { userId: 'u1', email: 'a@b.com', plan: 'free' });
      const res = mockRes();

      await updateProfile(req, res, next);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: updated });
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/auth/license
  // -----------------------------------------------------------------------

  describe('getLicense', () => {
    it('should return 404 for non-existent user', async () => {
      mockGetLicenseStatus.mockRejectedValue(new Error('User not found'));

      const req = mockReq({}, { userId: 'u1', email: 'a@b.com', plan: 'free' });
      const res = mockRes();

      await getLicense(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return license status', async () => {
      const license = { plan: 'pro', features: ['template-marketplace'], active: true };
      mockGetLicenseStatus.mockResolvedValue(license);

      const req = mockReq({}, { userId: 'u1', email: 'a@b.com', plan: 'pro' });
      const res = mockRes();

      await getLicense(req, res, next);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: license });
    });
  });
});
