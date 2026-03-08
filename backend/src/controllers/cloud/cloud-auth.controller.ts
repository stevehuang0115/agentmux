/**
 * Cloud Auth REST Controller (Supabase-backed)
 *
 * Handles HTTP requests for Supabase-backed Cloud authentication
 * and license verification. These endpoints operate against
 * Supabase Auth and the `licenses` table.
 *
 * Endpoints:
 * - POST /api/cloud/register  — create account via Supabase
 * - POST /api/cloud/login     — sign in via Supabase
 * - POST /api/cloud/logout    — sign out from Supabase
 * - GET  /api/cloud/session   — check current session
 * - GET  /api/cloud/license   — check license status
 *
 * @module controllers/cloud/cloud-auth.controller
 */

import type { Request, Response, NextFunction } from 'express';
import { CloudAuthService } from '../../services/cloud/cloud-auth.service.js';
import { LoggerService } from '../../services/core/logger.service.js';
import { MIN_PASSWORD_LENGTH, EMAIL_REGEX } from '../../services/cloud/auth/auth.utils.js';

const logger = LoggerService.getInstance().createComponentLogger('CloudAuthController');

/**
 * POST /api/cloud/register
 *
 * Register a new cloud account via Supabase Auth.
 *
 * @param req - Request with body: { email, password }
 * @param res - Response with CloudAuthResult
 * @param next - Next function for error propagation
 */
export async function cloudRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Missing required fields: email, password' });
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      res.status(400).json({ success: false, error: 'Invalid email format' });
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }

    const service = CloudAuthService.getInstance();
    const result = await service.signUp(email, password);

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    logger.info('Cloud user registered', { email });
    res.status(201).json({ success: true, data: result.session });
  } catch (error) {
    logger.error('Cloud register failed', { error: error instanceof Error ? error.message : String(error) });
    next(error);
  }
}

/**
 * POST /api/cloud/login
 *
 * Sign in via Supabase Auth with email and password.
 *
 * @param req - Request with body: { email, password }
 * @param res - Response with CloudAuthResult
 * @param next - Next function for error propagation
 */
export async function cloudLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Missing required fields: email, password' });
      return;
    }

    const service = CloudAuthService.getInstance();
    const result = await service.signIn(email, password);

    if (!result.success) {
      res.status(401).json({ success: false, error: result.error });
      return;
    }

    logger.info('Cloud user logged in', { email });
    res.json({ success: true, data: result.session });
  } catch (error) {
    logger.error('Cloud login failed', { error: error instanceof Error ? error.message : String(error) });
    next(error);
  }
}

/**
 * POST /api/cloud/logout
 *
 * Sign out from Supabase Auth.
 *
 * @param req - Express request (no body required)
 * @param res - Response with success status
 * @param next - Next function for error propagation
 */
export async function cloudLogout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const service = CloudAuthService.getInstance();
    const result = await service.signOut();

    if (!result.success) {
      res.status(500).json({ success: false, error: result.error });
      return;
    }

    logger.info('Cloud user logged out');
    res.json({ success: true });
  } catch (error) {
    logger.error('Cloud logout failed', { error: error instanceof Error ? error.message : String(error) });
    next(error);
  }
}

/**
 * GET /api/cloud/session
 *
 * Check the current Supabase Auth session.
 *
 * @param req - Express request (no body required)
 * @param res - Response with CloudSessionInfo
 * @param next - Next function for error propagation
 */
export async function cloudGetSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const service = CloudAuthService.getInstance();
    const session = await service.getSession();

    res.json({ success: true, data: session });
  } catch (error) {
    logger.error('Cloud getSession failed', { error: error instanceof Error ? error.message : String(error) });
    next(error);
  }
}

/**
 * GET /api/cloud/license
 *
 * Check the license status for the authenticated user.
 * Expects a userId query parameter or a valid session.
 *
 * @param req - Request with query: { userId }
 * @param res - Response with CloudLicenseInfo
 * @param next - Next function for error propagation
 */
export async function cloudGetLicense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const service = CloudAuthService.getInstance();

    // Try userId from query, fallback to current session
    let userId = req.query['userId'] as string | undefined;

    if (!userId) {
      const session = await service.getSession();
      userId = session.userId ?? undefined;
    }

    if (!userId) {
      res.status(401).json({ success: false, error: 'No userId provided and no active session' });
      return;
    }

    const license = await service.checkLicense(userId);

    res.json({ success: true, data: license });
  } catch (error) {
    logger.error('Cloud getLicense failed', { error: error instanceof Error ? error.message : String(error) });
    next(error);
  }
}
