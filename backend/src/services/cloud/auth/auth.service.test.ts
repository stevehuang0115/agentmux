/**
 * Tests for Auth Service
 *
 * Tests user registration, login, JWT lifecycle, password hashing,
 * profile management, and license verification.
 *
 * Mocks the filesystem to avoid writing to ~/.crewly/ during tests.
 *
 * @module services/cloud/auth/auth.service.test
 */

import { AuthService } from './auth.service.js';
import { AUTH_CONSTANTS } from '../../../constants.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

// In-memory filesystem mock
const fsStore: Map<string, string> = new Map();

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockImplementation(async (filePath: string, content: string) => {
        fsStore.set(filePath, content);
      }),
      readFile: jest.fn().mockImplementation(async (filePath: string) => {
        const content = fsStore.get(filePath);
        if (content === undefined) {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }
        return content;
      }),
    },
  };
});

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    fsStore.clear();
    AuthService.resetInstance();
    authService = AuthService.getInstance();
  });

  afterEach(() => {
    AuthService.resetInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  it('should return the same instance via getInstance', () => {
    const a = AuthService.getInstance();
    const b = AuthService.getInstance();
    expect(a).toBe(b);
  });

  it('should create a fresh instance after resetInstance', () => {
    const a = AuthService.getInstance();
    AuthService.resetInstance();
    const b = AuthService.getInstance();
    expect(a).not.toBe(b);
  });

  // -----------------------------------------------------------------------
  // Password hashing
  // -----------------------------------------------------------------------

  describe('hashPassword / verifyPassword', () => {
    it('should hash and verify a password', () => {
      const hash = authService.hashPassword('my-password');
      expect(authService.verifyPassword('my-password', hash)).toBe(true);
    });

    it('should reject wrong password', () => {
      const hash = authService.hashPassword('correct-password');
      expect(authService.verifyPassword('wrong-password', hash)).toBe(false);
    });

    it('should produce different hashes for the same password (random salt)', () => {
      const hash1 = authService.hashPassword('same-password');
      const hash2 = authService.hashPassword('same-password');
      expect(hash1).not.toBe(hash2);
    });

    it('should return salt:hash format', () => {
      const hash = authService.hashPassword('test');
      const parts = hash.split(':');
      expect(parts).toHaveLength(2);
      expect(parts[0].length).toBe(AUTH_CONSTANTS.PASSWORD.SALT_LENGTH * 2); // hex
      expect(parts[1].length).toBe(AUTH_CONSTANTS.PASSWORD.KEY_LENGTH * 2); // hex
    });

    it('should return false for malformed hash', () => {
      expect(authService.verifyPassword('test', 'not-a-valid-hash')).toBe(false);
      expect(authService.verifyPassword('test', '')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // JWT
  // -----------------------------------------------------------------------

  describe('verifyToken', () => {
    it('should reject tokens with wrong format', () => {
      expect(() => authService.verifyToken('not.a.valid.token.format')).toThrow('Invalid token format');
      expect(() => authService.verifyToken('single-part')).toThrow('Invalid token format');
    });

    it('should reject tokens with invalid signature', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        sub: 'u1', email: 'a@b.com', plan: 'free',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'crewly-cloud', type: 'access',
      })).toString('base64url');
      const fakeToken = `${header}.${payload}.wrong-signature`;

      expect(() => authService.verifyToken(fakeToken)).toThrow('Invalid token signature');
    });
  });

  // -----------------------------------------------------------------------
  // Registration + Login flow
  // -----------------------------------------------------------------------

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      const result = await authService.register('test@example.com', 'password123', 'Test User');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(AUTH_CONSTANTS.JWT.ACCESS_TOKEN_EXPIRY_S);
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.displayName).toBe('Test User');
      expect(result.user.plan).toBe('free');
      expect(result.user.id).toBeDefined();
    });

    it('should normalize email to lowercase', async () => {
      const result = await authService.register('Test@UPPER.com', 'password123', 'Test');
      expect(result.user.email).toBe('test@upper.com');
    });

    it('should reject duplicate email', async () => {
      await authService.register('dupe@example.com', 'password123', 'First');
      await expect(
        authService.register('dupe@example.com', 'password456', 'Second'),
      ).rejects.toThrow('Email already registered');
    });

    it('should issue verifiable tokens', async () => {
      const result = await authService.register('jwt@example.com', 'password123', 'JWT Test');

      const accessPayload = authService.verifyToken(result.accessToken);
      expect(accessPayload.sub).toBe(result.user.id);
      expect(accessPayload.email).toBe('jwt@example.com');
      expect(accessPayload.type).toBe('access');

      const refreshPayload = authService.verifyToken(result.refreshToken);
      expect(refreshPayload.sub).toBe(result.user.id);
      expect(refreshPayload.type).toBe('refresh');
    });
  });

  describe('login', () => {
    it('should login with correct credentials', async () => {
      await authService.register('login@example.com', 'password123', 'Login User');
      const result = await authService.login('login@example.com', 'password123');

      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe('login@example.com');
    });

    it('should reject wrong password', async () => {
      await authService.register('wrong@example.com', 'correct-password', 'User');
      await expect(
        authService.login('wrong@example.com', 'wrong-password'),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should reject non-existent email', async () => {
      await expect(
        authService.login('nonexistent@example.com', 'password123'),
      ).rejects.toThrow('Invalid email or password');
    });
  });

  // -----------------------------------------------------------------------
  // Token refresh
  // -----------------------------------------------------------------------

  describe('refreshToken', () => {
    it('should issue new tokens from a refresh token', async () => {
      const initial = await authService.register('refresh@example.com', 'password123', 'Refresh');
      const refreshed = await authService.refreshToken(initial.refreshToken);

      expect(refreshed.accessToken).toBeDefined();
      expect(refreshed.refreshToken).toBeDefined();
      expect(refreshed.user.id).toBe(initial.user.id);
      expect(refreshed.user.email).toBe('refresh@example.com');

      // Verify the new access token is valid
      const payload = authService.verifyToken(refreshed.accessToken);
      expect(payload.sub).toBe(initial.user.id);
      expect(payload.type).toBe('access');
    });

    it('should reject access token used as refresh token', async () => {
      const result = await authService.register('noaccess@example.com', 'password123', 'No');
      await expect(
        authService.refreshToken(result.accessToken),
      ).rejects.toThrow('expected refresh token');
    });
  });

  // -----------------------------------------------------------------------
  // Profile
  // -----------------------------------------------------------------------

  describe('getUserProfile', () => {
    it('should return profile for existing user', async () => {
      const result = await authService.register('profile@example.com', 'password123', 'Profile User');
      const profile = await authService.getUserProfile(result.user.id);

      expect(profile).not.toBeNull();
      expect(profile!.email).toBe('profile@example.com');
      expect(profile!.displayName).toBe('Profile User');
    });

    it('should return null for non-existent user', async () => {
      const profile = await authService.getUserProfile('non-existent-id');
      expect(profile).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should update display name', async () => {
      const result = await authService.register('update@example.com', 'password123', 'Old Name');
      const updated = await authService.updateProfile(result.user.id, { displayName: 'New Name' });

      expect(updated.displayName).toBe('New Name');
    });

    it('should throw for non-existent user', async () => {
      await expect(
        authService.updateProfile('non-existent', { displayName: 'Name' }),
      ).rejects.toThrow('User not found');
    });
  });

  // -----------------------------------------------------------------------
  // License
  // -----------------------------------------------------------------------

  describe('getLicenseStatus', () => {
    it('should return free plan with no features for new user', async () => {
      const result = await authService.register('free@example.com', 'password123', 'Free User');
      const license = await authService.getLicenseStatus(result.user.id);

      expect(license.plan).toBe('free');
      expect(license.features).toEqual([]);
      expect(license.active).toBe(true);
    });

    it('should throw for non-existent user', async () => {
      await expect(
        authService.getLicenseStatus('non-existent'),
      ).rejects.toThrow('User not found');
    });
  });
});
