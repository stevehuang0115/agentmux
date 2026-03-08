/**
 * JWT Auth Middleware
 *
 * Express middleware for authenticating requests using JWT tokens
 * and gating features based on user plan (free vs pro).
 *
 * Extracts the Bearer token from the Authorization header, verifies
 * it via AuthService, and attaches the decoded user info to the request.
 *
 * @module services/cloud/auth/jwt-auth.middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { LoggerService, type ComponentLogger } from '../../core/logger.service.js';
import { AUTH_CONSTANTS, type UserPlan } from '../../../constants.js';
import type { JwtPayload } from './auth.types.js';

const logger: ComponentLogger = LoggerService.getInstance().createComponentLogger('JwtAuthMiddleware');

// ---------------------------------------------------------------------------
// Extend Express Request to carry authenticated user info
// ---------------------------------------------------------------------------

/** Authenticated user info attached to the request by requireAuth. */
export interface AuthenticatedUser {
  /** User ID */
  userId: string;
  /** User email */
  email: string;
  /** User plan */
  plan: UserPlan;
}

/** Extended request type with authenticated user. */
export interface AuthenticatedRequest extends Request {
  /** Authenticated user data (set by requireAuth middleware) */
  user: AuthenticatedUser;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Extract the Bearer token from an Authorization header.
 *
 * @param req - Express request
 * @returns Token string or null
 */
function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

/**
 * Express middleware that requires a valid JWT access token.
 *
 * Extracts the Bearer token, verifies it with AuthService, and
 * attaches the user info to `req.user`. Responds with 401 if
 * the token is missing, invalid, or expired.
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware
 *
 * @example
 * ```ts
 * router.get('/profile', requireAuth, handler);
 * // handler can access (req as AuthenticatedRequest).user
 * ```
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Provide a Bearer token in the Authorization header.',
    });
    return;
  }

  let payload: JwtPayload;
  try {
    const authService = AuthService.getInstance();
    payload = authService.verifyToken(token);
  } catch (err) {
    logger.warn('JWT verification failed', {
      error: err instanceof Error ? err.message : String(err),
      path: req.path,
    });
    res.status(401).json({
      success: false,
      error: err instanceof Error ? err.message : 'Invalid token',
    });
    return;
  }

  if (payload.type !== 'access') {
    res.status(401).json({
      success: false,
      error: 'Invalid token type — expected access token',
    });
    return;
  }

  // Attach user info to request
  (req as AuthenticatedRequest).user = {
    userId: payload.sub,
    email: payload.email,
    plan: payload.plan,
  };

  next();
}

/**
 * Factory that returns middleware requiring a specific plan level.
 *
 * Must be used after requireAuth (which sets req.user).
 * Responds with 403 if the user's plan does not meet the requirement.
 *
 * @param requiredPlan - Minimum plan required ('pro')
 * @returns Express middleware function
 *
 * @example
 * ```ts
 * router.get('/premium', requireAuth, requirePlan('pro'), handler);
 * ```
 */
export function requirePlan(requiredPlan: 'pro'): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;

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
