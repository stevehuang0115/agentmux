/**
 * Tests for the Google Workspace Token Controller.
 *
 * Validates token exchange, error handling, and scope listing.
 */

import { Request, Response, NextFunction } from 'express';

// Mock UserIdentityService
const mockGetUserById = jest.fn();
const mockDecryptToken = jest.fn();
jest.mock('../../services/user/user-identity.service.js', () => ({
  UserIdentityService: {
    getInstance: () => ({
      getUserById: mockGetUserById,
      decryptToken: mockDecryptToken,
    }),
  },
}));

// Mock LoggerService
jest.mock('../../services/core/logger.service.js', () => ({
  LoggerService: {
    getInstance: () => ({
      createComponentLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }),
    }),
  },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import { getWorkspaceToken, listWorkspaceScopes } from './workspace.controller.js';

describe('WorkspaceController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  const originalEnv = process.env;

  beforeEach(() => {
    req = { query: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    mockGetUserById.mockReset();
    mockDecryptToken.mockReset();
    mockFetch.mockReset();
    process.env = {
      ...originalEnv,
      GOOGLE_OAUTH_CLIENT_ID: 'test-client-id',
      GOOGLE_OAUTH_CLIENT_SECRET: 'test-secret',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getWorkspaceToken', () => {
    it('should return 400 when userId is missing', async () => {
      req.query = {};

      await getWorkspaceToken(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.stringContaining('userId') }),
      );
    });

    it('should return 500 when Google OAuth is not configured', async () => {
      process.env.GOOGLE_OAUTH_CLIENT_ID = '';
      req.query = { userId: 'user-1' };

      await getWorkspaceToken(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('not configured') }),
      );
    });

    it('should return 404 when user is not found', async () => {
      req.query = { userId: 'nonexistent' };
      mockGetUserById.mockResolvedValue(null);

      await getWorkspaceToken(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('User not found') }),
      );
    });

    it('should return 404 when no Google account is connected', async () => {
      req.query = { userId: 'user-1' };
      mockGetUserById.mockResolvedValue({
        id: 'user-1',
        connectedServices: [{ provider: 'github' }],
      });

      await getWorkspaceToken(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('No Google account') }),
      );
    });

    it('should return fresh access token on success', async () => {
      req.query = { userId: 'user-1' };
      mockGetUserById.mockResolvedValue({
        id: 'user-1',
        connectedServices: [{
          provider: 'google',
          encryptedRefreshToken: 'enc-refresh',
          scopes: ['gmail.readonly'],
        }],
      });
      mockDecryptToken.mockReturnValue('real-refresh-token');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'fresh-access-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'gmail.readonly gmail.send',
        }),
      });

      await getWorkspaceToken(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          accessToken: 'fresh-access-token',
          expiresIn: 3600,
          tokenType: 'Bearer',
          scopes: ['gmail.readonly', 'gmail.send'],
        },
      });
    });

    it('should return 502 when token refresh fails', async () => {
      req.query = { userId: 'user-1' };
      mockGetUserById.mockResolvedValue({
        id: 'user-1',
        connectedServices: [{
          provider: 'google',
          encryptedRefreshToken: 'enc-refresh',
          scopes: [],
        }],
      });
      mockDecryptToken.mockReturnValue('revoked-refresh-token');
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Token has been revoked',
        }),
      });

      await getWorkspaceToken(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Token has been revoked') }),
      );
    });

    it('should call next on unexpected errors', async () => {
      req.query = { userId: 'user-1' };
      mockGetUserById.mockRejectedValue(new Error('DB down'));

      await getWorkspaceToken(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('listWorkspaceScopes', () => {
    it('should return all configured workspace scopes', () => {
      listWorkspaceScopes(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          scopes: expect.arrayContaining([
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/documents',
          ]),
        },
      });
    });
  });
});
