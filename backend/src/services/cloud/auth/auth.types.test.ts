/**
 * Tests for Auth Types
 *
 * Validates type guards and helper functions for the auth system.
 *
 * @module services/cloud/auth/auth.types.test
 */

import {
  isValidPlan,
  isJwtPayload,
  toUserProfile,
  type UserRecord,
  type JwtPayload,
} from './auth.types.js';

// ---------------------------------------------------------------------------
// isValidPlan
// ---------------------------------------------------------------------------

describe('isValidPlan', () => {
  it('should return true for "free"', () => {
    expect(isValidPlan('free')).toBe(true);
  });

  it('should return true for "pro"', () => {
    expect(isValidPlan('pro')).toBe(true);
  });

  it('should return false for invalid strings', () => {
    expect(isValidPlan('enterprise')).toBe(false);
    expect(isValidPlan('premium')).toBe(false);
    expect(isValidPlan('')).toBe(false);
  });

  it('should return false for non-string values', () => {
    expect(isValidPlan(42)).toBe(false);
    expect(isValidPlan(null)).toBe(false);
    expect(isValidPlan(undefined)).toBe(false);
    expect(isValidPlan({})).toBe(false);
    expect(isValidPlan(true)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isJwtPayload
// ---------------------------------------------------------------------------

describe('isJwtPayload', () => {
  const validPayload: JwtPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    plan: 'free',
    iat: 1700000000,
    exp: 1700003600,
    iss: 'crewly-cloud',
    type: 'access',
  };

  it('should return true for valid access token payload', () => {
    expect(isJwtPayload(validPayload)).toBe(true);
  });

  it('should return true for valid refresh token payload', () => {
    expect(isJwtPayload({ ...validPayload, type: 'refresh' })).toBe(true);
  });

  it('should return false when sub is missing', () => {
    const { sub, ...rest } = validPayload;
    expect(isJwtPayload(rest)).toBe(false);
  });

  it('should return false when email is missing', () => {
    const { email, ...rest } = validPayload;
    expect(isJwtPayload(rest)).toBe(false);
  });

  it('should return false when plan is missing', () => {
    const { plan, ...rest } = validPayload;
    expect(isJwtPayload(rest)).toBe(false);
  });

  it('should return false when iat is not a number', () => {
    expect(isJwtPayload({ ...validPayload, iat: 'not-a-number' })).toBe(false);
  });

  it('should return false when exp is not a number', () => {
    expect(isJwtPayload({ ...validPayload, exp: 'not-a-number' })).toBe(false);
  });

  it('should return false when type is invalid', () => {
    expect(isJwtPayload({ ...validPayload, type: 'invalid' })).toBe(false);
  });

  it('should return false for null', () => {
    expect(isJwtPayload(null)).toBe(false);
  });

  it('should return false for non-objects', () => {
    expect(isJwtPayload('string')).toBe(false);
    expect(isJwtPayload(42)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toUserProfile
// ---------------------------------------------------------------------------

describe('toUserProfile', () => {
  const userRecord: UserRecord = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'salt:hash',
    displayName: 'Test User',
    plan: 'free',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('should strip passwordHash from the record', () => {
    const profile = toUserProfile(userRecord);
    expect(profile).not.toHaveProperty('passwordHash');
    expect(profile).not.toHaveProperty('updatedAt');
  });

  it('should include public fields', () => {
    const profile = toUserProfile(userRecord);
    expect(profile).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      displayName: 'Test User',
      plan: 'free',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('should not mutate the original record', () => {
    const original = { ...userRecord };
    toUserProfile(userRecord);
    expect(userRecord).toEqual(original);
  });
});
