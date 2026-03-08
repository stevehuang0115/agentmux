/**
 * Auth REST Controller
 *
 * Handles HTTP requests for user registration, authentication,
 * token refresh, profile management, and license verification.
 *
 * Endpoints:
 * - POST /api/auth/register  — create a new account
 * - POST /api/auth/login     — authenticate and receive JWT
 * - POST /api/auth/refresh   — refresh an access token
 * - GET  /api/auth/me        — get current user profile
 * - PUT  /api/auth/me        — update profile
 * - GET  /api/auth/license   — check license/plan status
 *
 * @module controllers/cloud/auth/auth.controller
 */

import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../../services/cloud/auth/auth.service.js';
import { LoggerService } from '../../../services/core/logger.service.js';
import type {
  RegisterRequest,
  LoginRequest,
  RefreshRequest,
  UpdateProfileRequest,
} from '../../../services/cloud/auth/auth.types.js';
import type { AuthenticatedRequest } from '../../../services/cloud/auth/auth.utils.js';
import { MIN_PASSWORD_LENGTH, EMAIL_REGEX } from '../../../services/cloud/auth/auth.utils.js';

const logger = LoggerService.getInstance().createComponentLogger('AuthController');

/**
 * POST /api/auth/register
 *
 * Create a new user account. Returns JWT tokens on success.
 *
 * @param req - Request with body: { email, password, displayName }
 * @param res - Response with AuthTokenResponse
 * @param next - Next function for error propagation
 */
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, displayName } = req.body as Partial<RegisterRequest>;

    if (!email || !password || !displayName) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: email, password, displayName',
      });
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({
        success: false,
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
      return;
    }

    const authService = AuthService.getInstance();
    const result = await authService.register(email, password, displayName);

    logger.info('User registered via API', { email });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'Email already registered') {
      res.status(409).json({ success: false, error: error.message });
      return;
    }
    logger.error('Registration failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

/**
 * POST /api/auth/login
 *
 * Authenticate with email and password. Returns JWT tokens on success.
 *
 * @param req - Request with body: { email, password }
 * @param res - Response with AuthTokenResponse
 * @param next - Next function for error propagation
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as Partial<LoginRequest>;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: email, password',
      });
      return;
    }

    const authService = AuthService.getInstance();
    const result = await authService.login(email, password);

    logger.info('User logged in via API', { email });
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid email or password') {
      res.status(401).json({ success: false, error: error.message });
      return;
    }
    logger.error('Login failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

/**
 * POST /api/auth/refresh
 *
 * Refresh an access token using a valid refresh token.
 *
 * @param req - Request with body: { refreshToken }
 * @param res - Response with new AuthTokenResponse
 * @param next - Next function for error propagation
 */
export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body as Partial<RefreshRequest>;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: refreshToken',
      });
      return;
    }

    const authService = AuthService.getInstance();
    const result = await authService.refreshToken(refreshToken);

    logger.info('Token refreshed via API');
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('Invalid token') ||
      error.message.includes('Token expired') ||
      error.message.includes('expected refresh token')
    )) {
      res.status(401).json({ success: false, error: error.message });
      return;
    }
    logger.error('Token refresh failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

/**
 * GET /api/auth/me
 *
 * Get the current authenticated user's profile.
 * Requires requireAuth middleware to be applied first.
 *
 * @param req - Authenticated request with user info
 * @param res - Response with UserProfile
 * @param next - Next function for error propagation
 */
export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = (req as AuthenticatedRequest).user;

    const authService = AuthService.getInstance();
    const profile = await authService.getUserProfile(userId);

    if (!profile) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    logger.error('Get profile failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

/**
 * PUT /api/auth/me
 *
 * Update the current authenticated user's profile.
 * Requires requireAuth middleware to be applied first.
 *
 * @param req - Authenticated request with body: { displayName? }
 * @param res - Response with updated UserProfile
 * @param next - Next function for error propagation
 */
export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const { displayName } = req.body as Partial<UpdateProfileRequest>;

    if (displayName !== undefined && (typeof displayName !== 'string' || displayName.trim().length === 0)) {
      res.status(400).json({
        success: false,
        error: 'displayName must be a non-empty string',
      });
      return;
    }

    const authService = AuthService.getInstance();
    const profile = await authService.updateProfile(userId, { displayName });

    res.json({ success: true, data: profile });
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    logger.error('Update profile failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

/**
 * GET /api/auth/license
 *
 * Get the current user's license/plan status and available features.
 * Requires requireAuth middleware to be applied first.
 *
 * @param req - Authenticated request with user info
 * @param res - Response with LicenseStatus
 * @param next - Next function for error propagation
 */
export async function getLicense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = (req as AuthenticatedRequest).user;

    const authService = AuthService.getInstance();
    const license = await authService.getLicenseStatus(userId);

    res.json({ success: true, data: license });
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    logger.error('Get license failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}
