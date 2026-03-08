/**
 * Tests for Supabase Auth Middleware
 *
 * Validates token extraction, Supabase verification, plan resolution,
 * caching behaviour, and plan gating.
 *
 * @module services/cloud/auth/supabase-auth.middleware.test
 */

import {
  requireSupabaseAuth,
  requireSupabasePlan,
  resetSupabaseClient,
  clearPlanCache,
  type SupabaseAuthenticatedRequest,
} from './supabase-auth.middleware.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetUser = jest.fn();
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
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

jest.mock('../../../constants.js', () => ({
  CLOUD_AUTH_CONSTANTS: {
    SUPABASE: {
      get URL() { return 'https://test.supabase.co'; },
      get ANON_KEY() { return 'test-anon-key'; },
    },
    TABLES: { LICENSES: 'licenses' },
    LICENSE_STATUS: { ACTIVE: 'active', EXPIRED: 'expired', CANCELLED: 'cancelled' },
  },
  AUTH_CONSTANTS: {
    PLANS: { FREE: 'free', PRO: 'pro' },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock Express request. */
function mockReq(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    headers: {},
    path: '/test',
    ...overrides,
  };
}

/** Create a mock Express response. */
function mockRes(): { json: jest.Mock; status: jest.Mock } {
  const res = {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
  };
  return res;
}

/** Set up the Supabase query chain mock for license lookup. */
function setupLicenseQuery(result: { data: unknown[] | null; error: unknown }): void {
  mockLimit.mockResolvedValue(result);
  mockOrder.mockReturnValue({ limit: mockLimit });
  mockEq.mockReturnValueOnce({ eq: jest.fn().mockReturnValue({ order: mockOrder }) });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SupabaseAuthMiddleware', () => {
  const next = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    resetSupabaseClient();
    clearPlanCache();
  });

  // =========================================================================
  // requireSupabaseAuth
  // =========================================================================

  describe('requireSupabaseAuth', () => {
    it('should return 401 when no Authorization header is provided', async () => {
      const req = mockReq();
      const res = mockRes();

      await requireSupabaseAuth(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Authentication required') }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when Authorization header is not Bearer', async () => {
      const req = mockReq({ headers: { authorization: 'Basic abc123' } });
      const res = mockRes();

      await requireSupabaseAuth(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when Supabase rejects the token', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid JWT' },
      });

      const req = mockReq({ headers: { authorization: 'Bearer invalid-token' } });
      const res = mockRes();

      await requireSupabaseAuth(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid JWT' }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when Supabase returns no user', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const req = mockReq({ headers: { authorization: 'Bearer some-token' } });
      const res = mockRes();

      await requireSupabaseAuth(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should attach user info and call next on valid token (free plan)', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'test@example.com' } },
        error: null,
      });
      setupLicenseQuery({ data: [], error: null });

      const req = mockReq({ headers: { authorization: 'Bearer valid-token' } });
      const res = mockRes();

      await requireSupabaseAuth(req as any, res as any, next);

      expect(next).toHaveBeenCalled();
      const authReq = req as unknown as SupabaseAuthenticatedRequest;
      expect(authReq.user).toEqual({
        userId: 'user-1',
        email: 'test@example.com',
        plan: 'free',
      });
    });

    it('should resolve pro plan from licenses table', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-2', email: 'pro@example.com' } },
        error: null,
      });
      setupLicenseQuery({
        data: [{ plan: 'pro', status: 'active', expires_at: null }],
        error: null,
      });

      const req = mockReq({ headers: { authorization: 'Bearer pro-token' } });
      const res = mockRes();

      await requireSupabaseAuth(req as any, res as any, next);

      expect(next).toHaveBeenCalled();
      const authReq = req as unknown as SupabaseAuthenticatedRequest;
      expect(authReq.user.plan).toBe('pro');
    });

    it('should treat expired license as free plan', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-3', email: 'expired@example.com' } },
        error: null,
      });
      setupLicenseQuery({
        data: [{ plan: 'pro', status: 'active', expires_at: '2020-01-01T00:00:00Z' }],
        error: null,
      });

      const req = mockReq({ headers: { authorization: 'Bearer expired-token' } });
      const res = mockRes();

      await requireSupabaseAuth(req as any, res as any, next);

      expect(next).toHaveBeenCalled();
      const authReq = req as unknown as SupabaseAuthenticatedRequest;
      expect(authReq.user.plan).toBe('free');
    });

    it('should use cached plan on second request', async () => {
      // First request — hits DB
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-cache', email: 'cache@example.com' } },
        error: null,
      });
      setupLicenseQuery({
        data: [{ plan: 'pro', status: 'active', expires_at: null }],
        error: null,
      });

      const req1 = mockReq({ headers: { authorization: 'Bearer cache-token' } });
      const res1 = mockRes();
      await requireSupabaseAuth(req1 as any, res1 as any, next);

      // Second request — should use cache
      mockFrom.mockClear();
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-cache', email: 'cache@example.com' } },
        error: null,
      });

      const req2 = mockReq({ headers: { authorization: 'Bearer cache-token' } });
      const res2 = mockRes();
      await requireSupabaseAuth(req2 as any, res2 as any, jest.fn());

      // Should NOT have hit the DB again
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should handle Supabase client exceptions gracefully', async () => {
      mockGetUser.mockRejectedValue(new Error('Network error'));

      const req = mockReq({ headers: { authorization: 'Bearer error-token' } });
      const res = mockRes();

      await requireSupabaseAuth(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Authentication failed' }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should default to empty email when user email is null', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-no-email', email: null } },
        error: null,
      });
      setupLicenseQuery({ data: [], error: null });

      const req = mockReq({ headers: { authorization: 'Bearer no-email-token' } });
      const res = mockRes();

      await requireSupabaseAuth(req as any, res as any, next);

      expect(next).toHaveBeenCalled();
      const authReq = req as unknown as SupabaseAuthenticatedRequest;
      expect(authReq.user.email).toBe('');
    });

    it('should fallback to free plan on license query error', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-db-err', email: 'dberr@example.com' } },
        error: null,
      });
      setupLicenseQuery({ data: null, error: { message: 'DB connection failed' } });

      const req = mockReq({ headers: { authorization: 'Bearer db-err-token' } });
      const res = mockRes();

      await requireSupabaseAuth(req as any, res as any, next);

      expect(next).toHaveBeenCalled();
      const authReq = req as unknown as SupabaseAuthenticatedRequest;
      expect(authReq.user.plan).toBe('free');
    });
  });

  // =========================================================================
  // requireSupabasePlan
  // =========================================================================

  describe('requireSupabasePlan', () => {
    it('should return 401 when no user is attached', () => {
      const middleware = requireSupabasePlan('pro');
      const req = mockReq();
      const res = mockRes();

      middleware(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when user plan does not match', () => {
      const middleware = requireSupabasePlan('pro');
      const req = mockReq();
      (req as any).user = { userId: 'u1', email: 'free@test.com', plan: 'free' };
      const res = mockRes();

      middleware(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('requires a "pro" plan'),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next when user has the required plan', () => {
      const middleware = requireSupabasePlan('pro');
      const req = mockReq();
      (req as any).user = { userId: 'u2', email: 'pro@test.com', plan: 'pro' };
      const res = mockRes();

      middleware(req as any, res as any, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
