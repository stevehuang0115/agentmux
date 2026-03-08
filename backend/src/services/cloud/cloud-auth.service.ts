/**
 * Cloud Auth Service (Supabase-backed)
 *
 * Provides user authentication and license verification using
 * the Supabase JS SDK. Unlike the local AuthService (which stores
 * data on disk), this service delegates all auth state to Supabase Auth
 * and queries the `licenses` table for plan-based feature gating.
 *
 * @module services/cloud/cloud-auth.service
 */

import { createClient, type SupabaseClient, type AuthResponse, type Session } from '@supabase/supabase-js';
import { LoggerService, type ComponentLogger } from '../core/logger.service.js';
import { CLOUD_AUTH_CONSTANTS } from '../../constants.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Row shape returned from the Supabase `licenses` table. */
export interface LicenseRow {
  /** License primary key */
  id: string;
  /** Owner user ID (Supabase auth.users.id) */
  user_id: string;
  /** Plan tier (e.g. "free", "pro") */
  plan: string;
  /** Whether the license is currently active */
  status: string;
  /** ISO timestamp of license creation */
  created_at: string;
  /** ISO timestamp when the license expires (nullable) */
  expires_at: string | null;
}

/** Aggregated license status returned to callers. */
export interface CloudLicenseInfo {
  /** Whether the user holds a valid license */
  valid: boolean;
  /** Plan tier ("free" if no active license found) */
  plan: string;
  /** License status string */
  status: string;
  /** Expiration date (null if no expiry) */
  expiresAt: string | null;
}

/** Session info returned by getSession / refreshToken. */
export interface CloudSessionInfo {
  /** Whether a session is currently active */
  active: boolean;
  /** Supabase user ID */
  userId: string | null;
  /** User email */
  email: string | null;
  /** Access token */
  accessToken: string | null;
  /** Refresh token */
  refreshToken: string | null;
  /** Token expiry (epoch seconds) */
  expiresAt: number | null;
}

/** Auth result returned by signUp / signIn. */
export interface CloudAuthResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Session info (null on failure) */
  session: CloudSessionInfo | null;
  /** Error message (null on success) */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * CloudAuthService singleton.
 *
 * Wraps the Supabase JS SDK to provide signUp, signIn, signOut,
 * getSession, refreshToken, and checkLicense operations.
 */
export class CloudAuthService {
  private static instance: CloudAuthService | null = null;
  private readonly logger: ComponentLogger;
  private readonly supabase: SupabaseClient;

  private constructor() {
    this.logger = LoggerService.getInstance().createComponentLogger('CloudAuthService');
    this.supabase = createClient(
      CLOUD_AUTH_CONSTANTS.SUPABASE.URL,
      CLOUD_AUTH_CONSTANTS.SUPABASE.ANON_KEY,
    );
  }

  /**
   * Get the singleton instance.
   *
   * @returns CloudAuthService instance
   */
  static getInstance(): CloudAuthService {
    if (!CloudAuthService.instance) {
      CloudAuthService.instance = new CloudAuthService();
    }
    return CloudAuthService.instance;
  }

  /**
   * Reset the singleton (for testing).
   */
  static resetInstance(): void {
    CloudAuthService.instance = null;
  }

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  /**
   * Register a new user via Supabase Auth.
   *
   * @param email - User email address
   * @param password - User password
   * @returns Auth result with session info
   */
  async signUp(email: string, password: string): Promise<CloudAuthResult> {
    this.logger.info('Cloud signUp attempt', { email });

    const response: AuthResponse = await this.supabase.auth.signUp({ email, password });

    if (response.error) {
      this.logger.error('Cloud signUp failed', { email, error: response.error.message });
      return { success: false, session: null, error: response.error.message };
    }

    this.logger.info('Cloud signUp succeeded', { email });
    return {
      success: true,
      session: this.toSessionInfo(response.data.session),
      error: null,
    };
  }

  /**
   * Sign in an existing user via Supabase Auth.
   *
   * @param email - User email address
   * @param password - User password
   * @returns Auth result with session info
   */
  async signIn(email: string, password: string): Promise<CloudAuthResult> {
    this.logger.info('Cloud signIn attempt', { email });

    const response = await this.supabase.auth.signInWithPassword({ email, password });

    if (response.error) {
      this.logger.error('Cloud signIn failed', { email, error: response.error.message });
      return { success: false, session: null, error: response.error.message };
    }

    this.logger.info('Cloud signIn succeeded', { email });
    return {
      success: true,
      session: this.toSessionInfo(response.data.session),
      error: null,
    };
  }

  /**
   * Sign out the current user session.
   *
   * @returns Object indicating success or failure
   */
  async signOut(): Promise<{ success: boolean; error: string | null }> {
    this.logger.info('Cloud signOut');

    const { error } = await this.supabase.auth.signOut();

    if (error) {
      this.logger.error('Cloud signOut failed', { error: error.message });
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  }

  // -------------------------------------------------------------------------
  // Session management
  // -------------------------------------------------------------------------

  /**
   * Get the current session from Supabase Auth.
   *
   * @returns Session info (active: false if no session)
   */
  async getSession(): Promise<CloudSessionInfo> {
    const { data, error } = await this.supabase.auth.getSession();

    if (error) {
      this.logger.error('getSession failed', { error: error.message });
      return { active: false, userId: null, email: null, accessToken: null, refreshToken: null, expiresAt: null };
    }

    return this.toSessionInfo(data.session);
  }

  /**
   * Refresh the current session using a refresh token.
   *
   * @param refreshToken - Refresh token string
   * @returns Auth result with new session info
   */
  async refreshToken(refreshToken: string): Promise<CloudAuthResult> {
    this.logger.info('Cloud refreshToken attempt');

    const { data, error } = await this.supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (error) {
      this.logger.error('Cloud refreshToken failed', { error: error.message });
      return { success: false, session: null, error: error.message };
    }

    this.logger.info('Cloud refreshToken succeeded');
    return {
      success: true,
      session: this.toSessionInfo(data.session),
      error: null,
    };
  }

  // -------------------------------------------------------------------------
  // License verification
  // -------------------------------------------------------------------------

  /**
   * Check the license status for a given user by querying the
   * Supabase `licenses` table.
   *
   * @param userId - Supabase auth user ID
   * @returns License info with plan and status
   */
  async checkLicense(userId: string): Promise<CloudLicenseInfo> {
    this.logger.info('Checking license', { userId });

    const { data, error } = await this.supabase
      .from(CLOUD_AUTH_CONSTANTS.TABLES.LICENSES)
      .select('*')
      .eq('user_id', userId)
      .eq('status', CLOUD_AUTH_CONSTANTS.LICENSE_STATUS.ACTIVE)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      this.logger.error('License check failed', { userId, error: error.message });
      return { valid: false, plan: 'free', status: 'error', expiresAt: null };
    }

    if (!data || data.length === 0) {
      return { valid: false, plan: 'free', status: 'none', expiresAt: null };
    }

    const license = data[0] as LicenseRow;
    const isExpired = license.expires_at !== null && new Date(license.expires_at) < new Date();

    if (isExpired) {
      return { valid: false, plan: license.plan, status: 'expired', expiresAt: license.expires_at };
    }

    return {
      valid: true,
      plan: license.plan,
      status: license.status,
      expiresAt: license.expires_at,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Convert a Supabase Session (or null) to CloudSessionInfo.
   *
   * @param session - Supabase session object
   * @returns Normalized session info
   */
  private toSessionInfo(session: Session | null): CloudSessionInfo {
    if (!session) {
      return { active: false, userId: null, email: null, accessToken: null, refreshToken: null, expiresAt: null };
    }

    return {
      active: true,
      userId: session.user?.id ?? null,
      email: session.user?.email ?? null,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ?? null,
    };
  }
}
