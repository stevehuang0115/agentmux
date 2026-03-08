/**
 * Tests for Cloud Auth Controller (Supabase-backed)
 *
 * @module controllers/cloud/cloud-auth.controller.test
 */

import type { Request, Response, NextFunction } from 'express';
import {
  cloudRegister,
  cloudLogin,
  cloudLogout,
  cloudGetSession,
  cloudGetLicense,
} from './cloud-auth.controller.js';

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

const mockSignUp = jest.fn();
const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();
const mockCheckLicense = jest.fn();

jest.mock('../../services/cloud/cloud-auth.service.js', () => ({
  CloudAuthService: {
    getInstance: () => ({
      signUp: mockSignUp,
      signIn: mockSignIn,
      signOut: mockSignOut,
      getSession: mockGetSession,
      checkLicense: mockCheckLicense,
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

/** Mock session object. */
const SESSION_DATA = {
  active: true,
  userId: 'user-id-abc',
  email: 'test@example.com',
  accessToken: 'token-123',
  refreshToken: 'refresh-456',
  expiresAt: 1700000000,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Cloud Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----- cloudRegister -----------------------------------------------------

  describe('cloudRegister()', () => {
    it('should return 201 with session on successful registration', async () => {
      mockSignUp.mockResolvedValue({
        success: true,
        session: SESSION_DATA,
        error: null,
      });

      const req = mockReq({ body: { email: 'test@example.com', password: 'password123' } });
      const res = mockRes();

      await cloudRegister(req, res, mockNext);

      expect(mockSignUp).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: SESSION_DATA,
      });
    });

    it('should return 400 when email is missing', async () => {
      const req = mockReq({ body: { password: 'password123' } });
      const res = mockRes();

      await cloudRegister(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.stringContaining('email') }),
      );
    });

    it('should return 400 when password is missing', async () => {
      const req = mockReq({ body: { email: 'test@example.com' } });
      const res = mockRes();

      await cloudRegister(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for invalid email format', async () => {
      const req = mockReq({ body: { email: 'not-an-email', password: 'password123' } });
      const res = mockRes();

      await cloudRegister(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid email format' }),
      );
    });

    it('should return 400 when password is too short', async () => {
      const req = mockReq({ body: { email: 'test@example.com', password: 'short' } });
      const res = mockRes();

      await cloudRegister(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('at least') }),
      );
    });

    it('should return 400 when Supabase returns an error', async () => {
      mockSignUp.mockResolvedValue({
        success: false,
        session: null,
        error: 'User already registered',
      });

      const req = mockReq({ body: { email: 'existing@example.com', password: 'password123' } });
      const res = mockRes();

      await cloudRegister(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'User already registered' }),
      );
    });

    it('should call next on unexpected error', async () => {
      const error = new Error('Network failure');
      mockSignUp.mockRejectedValue(error);

      const req = mockReq({ body: { email: 'test@example.com', password: 'password123' } });
      const res = mockRes();

      await cloudRegister(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  // ----- cloudLogin --------------------------------------------------------

  describe('cloudLogin()', () => {
    it('should return session on successful login', async () => {
      mockSignIn.mockResolvedValue({
        success: true,
        session: SESSION_DATA,
        error: null,
      });

      const req = mockReq({ body: { email: 'test@example.com', password: 'password123' } });
      const res = mockRes();

      await cloudLogin(req, res, mockNext);

      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: SESSION_DATA,
      });
    });

    it('should return 400 when email is missing', async () => {
      const req = mockReq({ body: { password: 'password123' } });
      const res = mockRes();

      await cloudLogin(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 401 on invalid credentials', async () => {
      mockSignIn.mockResolvedValue({
        success: false,
        session: null,
        error: 'Invalid login credentials',
      });

      const req = mockReq({ body: { email: 'test@example.com', password: 'wrong' } });
      const res = mockRes();

      await cloudLogin(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid login credentials' }),
      );
    });

    it('should call next on unexpected error', async () => {
      const error = new Error('Timeout');
      mockSignIn.mockRejectedValue(error);

      const req = mockReq({ body: { email: 'test@example.com', password: 'password123' } });
      const res = mockRes();

      await cloudLogin(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  // ----- cloudLogout -------------------------------------------------------

  describe('cloudLogout()', () => {
    it('should return success on sign out', async () => {
      mockSignOut.mockResolvedValue({ success: true, error: null });

      const req = mockReq();
      const res = mockRes();

      await cloudLogout(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should return 500 on sign out failure', async () => {
      mockSignOut.mockResolvedValue({ success: false, error: 'Sign out failed' });

      const req = mockReq();
      const res = mockRes();

      await cloudLogout(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Sign out failed' }),
      );
    });

    it('should call next on unexpected error', async () => {
      const error = new Error('Network error');
      mockSignOut.mockRejectedValue(error);

      const req = mockReq();
      const res = mockRes();

      await cloudLogout(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  // ----- cloudGetSession ---------------------------------------------------

  describe('cloudGetSession()', () => {
    it('should return session info', async () => {
      mockGetSession.mockResolvedValue(SESSION_DATA);

      const req = mockReq();
      const res = mockRes();

      await cloudGetSession(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: SESSION_DATA,
      });
    });

    it('should call next on error', async () => {
      const error = new Error('Session error');
      mockGetSession.mockRejectedValue(error);

      const req = mockReq();
      const res = mockRes();

      await cloudGetSession(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  // ----- cloudGetLicense ---------------------------------------------------

  describe('cloudGetLicense()', () => {
    it('should return license info with userId from query', async () => {
      const licenseInfo = { valid: true, plan: 'pro', status: 'active', expiresAt: null };
      mockCheckLicense.mockResolvedValue(licenseInfo);

      const req = mockReq({ query: { userId: 'user-id-abc' } });
      const res = mockRes();

      await cloudGetLicense(req, res, mockNext);

      expect(mockCheckLicense).toHaveBeenCalledWith('user-id-abc');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: licenseInfo,
      });
    });

    it('should fallback to session userId when query param is missing', async () => {
      const licenseInfo = { valid: true, plan: 'pro', status: 'active', expiresAt: null };
      mockGetSession.mockResolvedValue(SESSION_DATA);
      mockCheckLicense.mockResolvedValue(licenseInfo);

      const req = mockReq({ query: {} });
      const res = mockRes();

      await cloudGetLicense(req, res, mockNext);

      expect(mockCheckLicense).toHaveBeenCalledWith('user-id-abc');
    });

    it('should return 401 when no userId and no active session', async () => {
      mockGetSession.mockResolvedValue({
        active: false,
        userId: null,
        email: null,
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
      });

      const req = mockReq({ query: {} });
      const res = mockRes();

      await cloudGetLicense(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('No userId') }),
      );
    });

    it('should call next on unexpected error', async () => {
      const error = new Error('DB error');
      mockCheckLicense.mockRejectedValue(error);

      const req = mockReq({ query: { userId: 'user-id-abc' } });
      const res = mockRes();

      await cloudGetLicense(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
