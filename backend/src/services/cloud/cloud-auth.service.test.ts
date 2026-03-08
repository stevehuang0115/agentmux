/**
 * Tests for CloudAuthService (Supabase-backed)
 *
 * @module services/cloud/cloud-auth.service.test
 */

import { CloudAuthService } from './cloud-auth.service.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSignUp = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();
const mockRefreshSession = jest.fn();
const mockFrom = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      getSession: mockGetSession,
      refreshSession: mockRefreshSession,
    },
    from: mockFrom,
  }),
}));

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

/** Build a mock Supabase session. */
function mockSession(overrides: Record<string, unknown> = {}) {
  return {
    access_token: 'access-token-123',
    refresh_token: 'refresh-token-456',
    expires_at: 1700000000,
    user: {
      id: 'user-id-abc',
      email: 'test@example.com',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CloudAuthService', () => {
  let service: CloudAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    CloudAuthService.resetInstance();
    service = CloudAuthService.getInstance();
  });

  // ----- Singleton ---------------------------------------------------------

  describe('singleton', () => {
    it('should return the same instance on multiple calls', () => {
      const a = CloudAuthService.getInstance();
      const b = CloudAuthService.getInstance();
      expect(a).toBe(b);
    });

    it('should return a new instance after reset', () => {
      const a = CloudAuthService.getInstance();
      CloudAuthService.resetInstance();
      const b = CloudAuthService.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // ----- signUp ------------------------------------------------------------

  describe('signUp()', () => {
    it('should return session on successful sign up', async () => {
      mockSignUp.mockResolvedValue({
        data: { session: mockSession() },
        error: null,
      });

      const result = await service.signUp('test@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.session).toEqual(
        expect.objectContaining({
          active: true,
          userId: 'user-id-abc',
          email: 'test@example.com',
          accessToken: 'access-token-123',
        }),
      );
    });

    it('should return error when sign up fails', async () => {
      mockSignUp.mockResolvedValue({
        data: { session: null },
        error: { message: 'User already registered' },
      });

      const result = await service.signUp('existing@example.com', 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User already registered');
      expect(result.session).toBeNull();
    });

    it('should handle null session on sign up (email confirmation required)', async () => {
      mockSignUp.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await service.signUp('test@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(result.session).toEqual(
        expect.objectContaining({ active: false, userId: null }),
      );
    });
  });

  // ----- signIn ------------------------------------------------------------

  describe('signIn()', () => {
    it('should return session on successful sign in', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: mockSession() },
        error: null,
      });

      const result = await service.signIn('test@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(result.session?.active).toBe(true);
      expect(result.session?.userId).toBe('user-id-abc');
    });

    it('should return error on invalid credentials', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid login credentials' },
      });

      const result = await service.signIn('test@example.com', 'wrong-password');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid login credentials');
    });
  });

  // ----- signOut -----------------------------------------------------------

  describe('signOut()', () => {
    it('should return success on sign out', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      const result = await service.signOut();

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should return error when sign out fails', async () => {
      mockSignOut.mockResolvedValue({ error: { message: 'Network error' } });

      const result = await service.signOut();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  // ----- getSession --------------------------------------------------------

  describe('getSession()', () => {
    it('should return active session info', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: mockSession() },
        error: null,
      });

      const session = await service.getSession();

      expect(session.active).toBe(true);
      expect(session.userId).toBe('user-id-abc');
      expect(session.email).toBe('test@example.com');
      expect(session.accessToken).toBe('access-token-123');
    });

    it('should return inactive session when no session exists', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const session = await service.getSession();

      expect(session.active).toBe(false);
      expect(session.userId).toBeNull();
    });

    it('should return inactive session on error', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session expired' },
      });

      const session = await service.getSession();

      expect(session.active).toBe(false);
    });
  });

  // ----- refreshToken ------------------------------------------------------

  describe('refreshToken()', () => {
    it('should return new session on successful refresh', async () => {
      mockRefreshSession.mockResolvedValue({
        data: { session: mockSession({ access_token: 'new-access-token' }) },
        error: null,
      });

      const result = await service.refreshToken('old-refresh-token');

      expect(result.success).toBe(true);
      expect(result.session?.accessToken).toBe('new-access-token');
    });

    it('should return error on invalid refresh token', async () => {
      mockRefreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid refresh token' },
      });

      const result = await service.refreshToken('bad-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid refresh token');
    });
  });

  // ----- checkLicense ------------------------------------------------------

  describe('checkLicense()', () => {
    /** Helper to set up mockFrom chain. */
    function setupLicenseQuery(data: unknown[] | null, error: { message: string } | null) {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data, error }),
      };
      mockFrom.mockReturnValue(chain);
      return chain;
    }

    it('should return valid license for active pro user', async () => {
      setupLicenseQuery(
        [
          {
            id: 'lic-1',
            user_id: 'user-id-abc',
            plan: 'pro',
            status: 'active',
            created_at: '2026-01-01T00:00:00Z',
            expires_at: '2027-01-01T00:00:00Z',
          },
        ],
        null,
      );

      const result = await service.checkLicense('user-id-abc');

      expect(result.valid).toBe(true);
      expect(result.plan).toBe('pro');
      expect(result.status).toBe('active');
    });

    it('should return invalid license when no license exists', async () => {
      setupLicenseQuery([], null);

      const result = await service.checkLicense('user-no-license');

      expect(result.valid).toBe(false);
      expect(result.plan).toBe('free');
      expect(result.status).toBe('none');
    });

    it('should return expired license when expires_at is in the past', async () => {
      setupLicenseQuery(
        [
          {
            id: 'lic-2',
            user_id: 'user-id-abc',
            plan: 'pro',
            status: 'active',
            created_at: '2025-01-01T00:00:00Z',
            expires_at: '2025-12-31T00:00:00Z',
          },
        ],
        null,
      );

      const result = await service.checkLicense('user-id-abc');

      expect(result.valid).toBe(false);
      expect(result.plan).toBe('pro');
      expect(result.status).toBe('expired');
    });

    it('should return valid license when expires_at is null (no expiry)', async () => {
      setupLicenseQuery(
        [
          {
            id: 'lic-3',
            user_id: 'user-id-abc',
            plan: 'pro',
            status: 'active',
            created_at: '2026-01-01T00:00:00Z',
            expires_at: null,
          },
        ],
        null,
      );

      const result = await service.checkLicense('user-id-abc');

      expect(result.valid).toBe(true);
      expect(result.expiresAt).toBeNull();
    });

    it('should return error status on database error', async () => {
      setupLicenseQuery(null, { message: 'DB connection failed' });

      const result = await service.checkLicense('user-id-abc');

      expect(result.valid).toBe(false);
      expect(result.status).toBe('error');
    });
  });
});
