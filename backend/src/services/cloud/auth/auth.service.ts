/**
 * Auth Service
 *
 * Handles user registration, authentication, JWT token management,
 * and user data persistence for the CrewlyAI Cloud account system.
 *
 * Uses Node.js built-in crypto module for password hashing (scrypt)
 * and JWT signing (HMAC-SHA256), consistent with the project's
 * existing crypto patterns (relay-crypto.service).
 *
 * User data is stored as JSON files in ~/.crewly/cloud/users/.
 *
 * @module services/cloud/auth/auth.service
 */

import { randomBytes, scryptSync, createHmac, timingSafeEqual } from 'crypto';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LoggerService, type ComponentLogger } from '../../core/logger.service.js';
import { AUTH_CONSTANTS, type UserPlan } from '../../../constants.js';
import {
  type UserRecord,
  type UserProfile,
  type JwtPayload,
  type AuthTokenResponse,
  type LicenseStatus,
  toUserProfile,
  isJwtPayload,
} from './auth.types.js';

const AUTH = AUTH_CONSTANTS;

// ---------------------------------------------------------------------------
// User index type (email → userId mapping)
// ---------------------------------------------------------------------------

interface UserIndex {
  [email: string]: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * AuthService singleton.
 *
 * Manages user accounts, password verification, and JWT lifecycle.
 * All user data is stored as individual JSON files in ~/.crewly/cloud/users/.
 */
export class AuthService {
  private static instance: AuthService | null = null;
  private readonly logger: ComponentLogger;
  private readonly usersDir: string;
  private readonly indexPath: string;
  private readonly jwtSecret: string;

  private constructor() {
    this.logger = LoggerService.getInstance().createComponentLogger('AuthService');
    const crewlyHome = path.join(os.homedir(), '.crewly');
    this.usersDir = path.join(crewlyHome, AUTH.STORAGE.USERS_DIR);
    this.indexPath = path.join(crewlyHome, AUTH.STORAGE.USER_INDEX_FILE);
    this.jwtSecret = process.env['CREWLY_JWT_SECRET'] || AUTH.JWT.DEFAULT_SECRET;
  }

  /**
   * Get the singleton instance.
   *
   * @returns AuthService instance
   */
  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Reset the singleton (for testing).
   */
  static resetInstance(): void {
    AuthService.instance = null;
  }

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  /**
   * Register a new user account.
   *
   * @param email - User email (must be unique)
   * @param password - Plain-text password (will be hashed)
   * @param displayName - User display name
   * @returns Auth token response with access and refresh tokens
   * @throws Error if email is already registered
   */
  async register(email: string, password: string, displayName: string): Promise<AuthTokenResponse> {
    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing user
    const existingId = await this.findUserIdByEmail(normalizedEmail);
    if (existingId) {
      throw new Error('Email already registered');
    }

    const now = new Date().toISOString();
    const user: UserRecord = {
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash: this.hashPassword(password),
      displayName: displayName.trim(),
      plan: AUTH.PLANS.FREE as UserPlan,
      createdAt: now,
      updatedAt: now,
    };

    await this.saveUser(user);
    await this.updateIndex(normalizedEmail, user.id);

    this.logger.info('User registered', { userId: user.id, email: normalizedEmail });

    return this.createTokenResponse(user);
  }

  // -------------------------------------------------------------------------
  // Login
  // -------------------------------------------------------------------------

  /**
   * Authenticate a user with email and password.
   *
   * @param email - User email
   * @param password - Plain-text password
   * @returns Auth token response with access and refresh tokens
   * @throws Error if credentials are invalid
   */
  async login(email: string, password: string): Promise<AuthTokenResponse> {
    const normalizedEmail = email.toLowerCase().trim();

    const userId = await this.findUserIdByEmail(normalizedEmail);
    if (!userId) {
      throw new Error('Invalid email or password');
    }

    const user = await this.loadUser(userId);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!this.verifyPassword(password, user.passwordHash)) {
      throw new Error('Invalid email or password');
    }

    this.logger.info('User logged in', { userId: user.id });

    return this.createTokenResponse(user);
  }

  // -------------------------------------------------------------------------
  // Token management
  // -------------------------------------------------------------------------

  /**
   * Refresh an access token using a valid refresh token.
   *
   * @param refreshToken - JWT refresh token
   * @returns New auth token response
   * @throws Error if refresh token is invalid or expired
   */
  async refreshToken(refreshToken: string): Promise<AuthTokenResponse> {
    const payload = this.verifyToken(refreshToken);

    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type — expected refresh token');
    }

    const user = await this.loadUser(payload.sub);
    if (!user) {
      throw new Error('User not found');
    }

    this.logger.info('Token refreshed', { userId: user.id });

    return this.createTokenResponse(user);
  }

  /**
   * Verify a JWT token and return its payload.
   *
   * @param token - JWT token string
   * @returns Decoded JWT payload
   * @throws Error if token is invalid, expired, or malformed
   */
  verifyToken(token: string): JwtPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const expectedSig = this.sign(`${headerB64}.${payloadB64}`);

    if (signatureB64 !== expectedSig) {
      throw new Error('Invalid token signature');
    }

    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    let payload: unknown;
    try {
      payload = JSON.parse(payloadJson);
    } catch {
      throw new Error('Invalid token payload');
    }

    if (!isJwtPayload(payload)) {
      throw new Error('Invalid token payload structure');
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      throw new Error('Token expired');
    }

    return payload;
  }

  // -------------------------------------------------------------------------
  // User profile
  // -------------------------------------------------------------------------

  /**
   * Get a user profile by ID.
   *
   * @param userId - User ID
   * @returns Public user profile or null if not found
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const user = await this.loadUser(userId);
    if (!user) return null;
    return toUserProfile(user);
  }

  /**
   * Update a user's display name.
   *
   * @param userId - User ID
   * @param updates - Fields to update
   * @returns Updated user profile
   * @throws Error if user not found
   */
  async updateProfile(userId: string, updates: { displayName?: string }): Promise<UserProfile> {
    const user = await this.loadUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (updates.displayName !== undefined) {
      user.displayName = updates.displayName.trim();
    }
    user.updatedAt = new Date().toISOString();

    await this.saveUser(user);
    this.logger.info('User profile updated', { userId });

    return toUserProfile(user);
  }

  // -------------------------------------------------------------------------
  // License
  // -------------------------------------------------------------------------

  /**
   * Get the license status for a user.
   *
   * @param userId - User ID
   * @returns License status with plan and feature list
   * @throws Error if user not found
   */
  async getLicenseStatus(userId: string): Promise<LicenseStatus> {
    const user = await this.loadUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const isPro = user.plan === AUTH.PLANS.PRO;

    return {
      plan: user.plan,
      features: isPro ? [...AUTH.PRO_FEATURES] : [],
      active: true,
    };
  }

  // -------------------------------------------------------------------------
  // Password hashing (scrypt)
  // -------------------------------------------------------------------------

  /**
   * Hash a password using scrypt with a random salt.
   *
   * @param password - Plain-text password
   * @returns Encoded hash in format "salt:hash" (both hex-encoded)
   */
  hashPassword(password: string): string {
    const salt = randomBytes(AUTH.PASSWORD.SALT_LENGTH);
    const hash = scryptSync(password, salt, AUTH.PASSWORD.KEY_LENGTH, {
      cost: AUTH.PASSWORD.COST,
    });
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
  }

  /**
   * Verify a password against a stored hash.
   *
   * @param password - Plain-text password to verify
   * @param storedHash - Stored hash in "salt:hash" format
   * @returns true if password matches
   */
  verifyPassword(password: string, storedHash: string): boolean {
    const [saltHex, hashHex] = storedHash.split(':');
    if (!saltHex || !hashHex) return false;

    const salt = Buffer.from(saltHex, 'hex');
    const expectedHash = Buffer.from(hashHex, 'hex');
    const actualHash = scryptSync(password, salt, AUTH.PASSWORD.KEY_LENGTH, {
      cost: AUTH.PASSWORD.COST,
    });

    return timingSafeEqual(expectedHash, actualHash);
  }

  // -------------------------------------------------------------------------
  // JWT creation
  // -------------------------------------------------------------------------

  /**
   * Create a JWT token response with access and refresh tokens.
   *
   * @param user - User record to create tokens for
   * @returns Auth token response
   */
  private createTokenResponse(user: UserRecord): AuthTokenResponse {
    const now = Math.floor(Date.now() / 1000);

    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      plan: user.plan,
      iat: now,
      exp: now + AUTH.JWT.ACCESS_TOKEN_EXPIRY_S,
      iss: AUTH.JWT.ISSUER,
      type: 'access',
    };

    const refreshPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      plan: user.plan,
      iat: now,
      exp: now + AUTH.JWT.REFRESH_TOKEN_EXPIRY_S,
      iss: AUTH.JWT.ISSUER,
      type: 'refresh',
    };

    return {
      accessToken: this.createJwt(accessPayload),
      refreshToken: this.createJwt(refreshPayload),
      expiresIn: AUTH.JWT.ACCESS_TOKEN_EXPIRY_S,
      user: toUserProfile(user),
    };
  }

  /**
   * Create a signed JWT from a payload.
   *
   * @param payload - JWT payload object
   * @returns Signed JWT string (header.payload.signature)
   */
  private createJwt(payload: JwtPayload): string {
    const header = { alg: AUTH.JWT.ALGORITHM, typ: 'JWT' };
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.sign(`${headerB64}.${payloadB64}`);
    return `${headerB64}.${payloadB64}.${signature}`;
  }

  /**
   * Sign data with HMAC-SHA256 using the JWT secret.
   *
   * @param data - Data to sign
   * @returns Base64url-encoded signature
   */
  private sign(data: string): string {
    return createHmac('sha256', this.jwtSecret).update(data).digest('base64url');
  }

  // -------------------------------------------------------------------------
  // Storage
  // -------------------------------------------------------------------------

  /**
   * Ensure the users storage directory exists.
   */
  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.usersDir, { recursive: true });
  }

  /**
   * Save a user record to disk.
   *
   * @param user - User record to save
   */
  private async saveUser(user: UserRecord): Promise<void> {
    await this.ensureDir();
    const filePath = path.join(this.usersDir, `${user.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(user, null, 2), 'utf8');
  }

  /**
   * Load a user record from disk.
   *
   * @param userId - User ID
   * @returns User record or null if not found
   */
  private async loadUser(userId: string): Promise<UserRecord | null> {
    const filePath = path.join(this.usersDir, `${userId}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content) as UserRecord;
    } catch {
      return null;
    }
  }

  /**
   * Find a user ID by email using the index.
   *
   * @param email - User email (normalized)
   * @returns User ID or null if not found
   */
  private async findUserIdByEmail(email: string): Promise<string | null> {
    const index = await this.loadIndex();
    return index[email] || null;
  }

  /**
   * Load the email → userId index from disk.
   *
   * @returns User index object
   */
  private async loadIndex(): Promise<UserIndex> {
    try {
      const content = await fs.readFile(this.indexPath, 'utf8');
      return JSON.parse(content) as UserIndex;
    } catch {
      return {};
    }
  }

  /**
   * Update the email → userId index on disk.
   *
   * @param email - User email
   * @param userId - User ID
   */
  private async updateIndex(email: string, userId: string): Promise<void> {
    await this.ensureDir();
    const index = await this.loadIndex();
    index[email] = userId;
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf8');
  }
}
