/**
 * Auth Types
 *
 * Type definitions for the CrewlyAI Cloud account system.
 * Covers user entities, JWT payloads, and request/response shapes.
 *
 * @module services/cloud/auth/auth.types
 */

import type { UserPlan } from '../../../constants.js';

// ---------------------------------------------------------------------------
// User entity
// ---------------------------------------------------------------------------

/** Stored user record (password hash included, never exposed via API). */
export interface UserRecord {
  /** Unique user identifier (UUID) */
  id: string;
  /** User email address (unique) */
  email: string;
  /** Scrypt-hashed password (hex-encoded salt:hash) */
  passwordHash: string;
  /** Display name */
  displayName: string;
  /** Subscription plan */
  plan: UserPlan;
  /** ISO timestamp of account creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

/** Public user profile (no sensitive fields). */
export interface UserProfile {
  /** Unique user identifier */
  id: string;
  /** User email address */
  email: string;
  /** Display name */
  displayName: string;
  /** Subscription plan */
  plan: UserPlan;
  /** ISO timestamp of account creation */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------

/** Payload embedded in JWT access tokens. */
export interface JwtPayload {
  /** Subject — user ID */
  sub: string;
  /** User email */
  email: string;
  /** User plan */
  plan: UserPlan;
  /** Issued-at timestamp (seconds since epoch) */
  iat: number;
  /** Expiration timestamp (seconds since epoch) */
  exp: number;
  /** Issuer */
  iss: string;
  /** Token type discriminator */
  type: 'access' | 'refresh';
}

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

/** Request body for POST /api/auth/register. */
export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

/** Request body for POST /api/auth/login. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Request body for POST /api/auth/refresh. */
export interface RefreshRequest {
  refreshToken: string;
}

/** Request body for PUT /api/auth/me. */
export interface UpdateProfileRequest {
  displayName?: string;
}

/** Auth response with tokens. */
export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserProfile;
}

/** License status response. */
export interface LicenseStatus {
  plan: UserPlan;
  features: string[];
  active: boolean;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/**
 * Check whether a value is a valid UserPlan.
 *
 * @param value - Value to check
 * @returns true if value is 'free' or 'pro'
 */
export function isValidPlan(value: unknown): value is UserPlan {
  return value === 'free' || value === 'pro' || value === 'enterprise';
}

/**
 * Check whether a parsed object is a valid JwtPayload.
 *
 * @param data - Parsed JWT payload
 * @returns true if data has all required fields
 */
export function isJwtPayload(data: unknown): data is JwtPayload {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj['sub'] === 'string' &&
    typeof obj['email'] === 'string' &&
    typeof obj['plan'] === 'string' &&
    typeof obj['iat'] === 'number' &&
    typeof obj['exp'] === 'number' &&
    typeof obj['iss'] === 'string' &&
    (obj['type'] === 'access' || obj['type'] === 'refresh')
  );
}

/**
 * Convert a UserRecord to a public UserProfile (strips sensitive data).
 *
 * @param record - Full user record
 * @returns Public profile without passwordHash
 */
export function toUserProfile(record: UserRecord): UserProfile {
  return {
    id: record.id,
    email: record.email,
    displayName: record.displayName,
    plan: record.plan,
    createdAt: record.createdAt,
  };
}
