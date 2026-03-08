/**
 * Supabase Auth Middleware
 *
 * Express middleware for authenticating requests using Supabase JWTs.
 * Verifies tokens via the Supabase `auth.getUser()` API and resolves
 * the user's plan from the `licenses` table for feature gating.
 *
 * This replaces the self-signed JWT middleware (`jwt-auth.middleware.ts`)
 * so the frontend can authenticate directly with Supabase and send the
 * Supabase access token as a Bearer token to protected endpoints.
 *
 * @module services/cloud/auth/supabase-auth.middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { LoggerService, type ComponentLogger } from '../../core/logger.service.js';
import { CLOUD_AUTH_CONSTANTS, AUTH_CONSTANTS, type UserPlan } from '../../../constants.js';

const logger: ComponentLogger = LoggerService.getInstance().createComponentLogger('SupabaseAuthMiddleware');

// ---------------------------------------------------------------------------
// Supabase client (shared, lightweight — only used for token verification)
// ---------------------------------------------------------------------------

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create the shared Supabase client for auth verification.
 *
 * @returns SupabaseClient instance
 */
function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(
      CLOUD_AUTH_CONSTANTS.SUPABASE.URL,
      CLOUD_AUTH_CONSTANTS.SUPABASE.ANON_KEY,
    );
  }
  return supabaseClient;
}

/**
 * Reset the shared Supabase client (for testing).
 */
export function resetSupabaseClient(): void {
  supabaseClient = null;
}

// ---------------------------------------------------------------------------
// Plan cache (avoids hitting the licenses table on every request)
// ---------------------------------------------------------------------------

/** Cache entry for user plan lookups. */
interface PlanCacheEntry {
  /** Resolved user plan */
  plan: UserPlan;
  /** Cache timestamp (ms since epoch) */
  cachedAt: number;
}

/** How long plan lookups are cached (5 minutes). */
const PLAN_CACHE_TTL_MS = 5 * 60 * 1000;

/** In-memory cache: userId → plan info. */
const planCache = new Map<string, PlanCacheEntry>();

/**
 * Clear the plan cache (for testing).
 */
export function clearPlanCache(): void {
  planCache.clear();
}

// ---------------------------------------------------------------------------
// Types (re-exported for consumers — using shared AuthenticatedUser)
// ---------------------------------------------------------------------------

import { extractBearerToken } from './auth.utils.js';
import type { AuthenticatedUser, AuthenticatedRequest } from './auth.utils.js';

/** Supabase authenticated user (same shape as AuthenticatedUser). */
export type SupabaseAuthenticatedUser = AuthenticatedUser;

/** Supabase authenticated request (same shape as AuthenticatedRequest). */
export type SupabaseAuthenticatedRequest = AuthenticatedRequest;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the user's plan from the Supabase `licenses` table.
 * Results are cached for PLAN_CACHE_TTL_MS to avoid repeated DB queries.
 *
 * @param userId - Supabase user ID
 * @returns Resolved user plan ('free' if no active license)
 */
async function resolveUserPlan(userId: string): Promise<UserPlan> {
  // Check cache first
  const cached = planCache.get(userId);
  if (cached && (Date.now() - cached.cachedAt) < PLAN_CACHE_TTL_MS) {
    return cached.plan;
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(CLOUD_AUTH_CONSTANTS.TABLES.LICENSES)
      .select('plan, status, expires_at')
      .eq('user_id', userId)
      .eq('status', CLOUD_AUTH_CONSTANTS.LICENSE_STATUS.ACTIVE)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      const plan: UserPlan = AUTH_CONSTANTS.PLANS.FREE;
      planCache.set(userId, { plan, cachedAt: Date.now() });
      return plan;
    }

    const license = data[0] as { plan: string; status: string; expires_at: string | null };
    const isExpired = license.expires_at !== null && new Date(license.expires_at) < new Date();

    const plan: UserPlan = isExpired
      ? AUTH_CONSTANTS.PLANS.FREE
      : (license.plan === 'pro' ? AUTH_CONSTANTS.PLANS.PRO : AUTH_CONSTANTS.PLANS.FREE);

    planCache.set(userId, { plan, cachedAt: Date.now() });
    return plan;
  } catch (err) {
    logger.error('Failed to resolve user plan', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return AUTH_CONSTANTS.PLANS.FREE;
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware that requires a valid Supabase access token.
 *
 * Extracts the Bearer token, verifies it with Supabase `auth.getUser()`,
 * resolves the user's plan from the `licenses` table, and attaches user
 * info to `req.user`. Responds with 401 if the token is missing or invalid.
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware
 *
 * @example
 * ```ts
 * router.get('/profile', requireSupabaseAuth, handler);
 * // handler can access (req as SupabaseAuthenticatedRequest).user
 * ```
 */
export async function requireSupabaseAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearerToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Provide a Bearer token in the Authorization header.',
    });
    return;
  }

  try {
    const supabase = getSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn('Supabase token verification failed', {
        error: error?.message ?? 'No user returned',
        path: req.path,
      });
      res.status(401).json({
        success: false,
        error: error?.message ?? 'Invalid or expired token',
      });
      return;
    }

    // Resolve plan from licenses table (cached)
    const plan = await resolveUserPlan(user.id);

    // Attach user info to request
    (req as SupabaseAuthenticatedRequest).user = {
      userId: user.id,
      email: user.email ?? '',
      plan,
    };

    next();
  } catch (err) {
    logger.error('Supabase auth middleware error', {
      error: err instanceof Error ? err.message : String(err),
      path: req.path,
    });
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
}

/**
 * Factory that returns middleware requiring a specific plan level.
 *
 * Must be used after requireSupabaseAuth (which sets req.user).
 * Responds with 403 if the user's plan does not meet the requirement.
 *
 * @param requiredPlan - Minimum plan required ('pro')
 * @returns Express middleware function
 *
 * @example
 * ```ts
 * router.get('/premium', requireSupabaseAuth, requireSupabasePlan('pro'), handler);
 * ```
 */
export function requireSupabasePlan(
  requiredPlan: 'pro',
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as SupabaseAuthenticatedRequest).user;

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (user.plan !== requiredPlan) {
      logger.warn('Plan check failed', {
        userId: user.userId,
        currentPlan: user.plan,
        requiredPlan,
        path: req.path,
      });
      res.status(403).json({
        success: false,
        error: `This feature requires a "${requiredPlan}" plan. Current plan: "${user.plan}". Upgrade at https://crewly.dev/pricing.`,
      });
      return;
    }

    next();
  };
}
