/**
 * Google Workspace Token Controller
 *
 * Provides a token-serving endpoint for agents to obtain short-lived
 * Google access tokens for Workspace operations (Gmail, Drive, Calendar, Docs).
 *
 * Tokens are stored encrypted via UserIdentityService. This controller
 * exchanges stored refresh tokens for fresh access tokens via Google's
 * token endpoint, never exposing refresh tokens to callers.
 *
 * @module controllers/workspace/workspace.controller
 */

import { Request, Response, NextFunction } from 'express';
import { GOOGLE_OAUTH_CONSTANTS } from '../../constants.js';
import { UserIdentityService } from '../../services/user/user-identity.service.js';
import { LoggerService } from '../../services/core/logger.service.js';

const logger = LoggerService.getInstance().createComponentLogger('WorkspaceController');

/**
 * Token response from Google's OAuth2 token endpoint.
 */
interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

/**
 * GET /api/workspace/token — Provide a fresh Google access token.
 *
 * Looks up the authenticated user's stored Google refresh token,
 * exchanges it for a short-lived access token, and returns it.
 * The refresh token is never exposed to the caller.
 *
 * Query params:
 * - userId (required): The user ID whose Google token to fetch
 *
 * @param req - Express request with query.userId
 * @param res - Express response
 * @param next - Express next function
 */
export async function getWorkspaceToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.query.userId ? String(req.query.userId) : '';
    if (!userId) {
      res.status(400).json({ success: false, error: 'Missing required query parameter: userId' });
      return;
    }

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
    if (!clientId || !clientSecret) {
      res.status(500).json({ success: false, error: 'Google OAuth credentials are not configured' });
      return;
    }

    const users = UserIdentityService.getInstance();
    const user = await users.getUserById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: `User not found: ${userId}` });
      return;
    }

    const googleService = user.connectedServices.find((s) => s.provider === 'google');
    if (!googleService) {
      res.status(404).json({ success: false, error: 'No Google account connected for this user' });
      return;
    }

    // Decrypt the stored refresh token
    const refreshToken = users.decryptToken(googleService.encryptedRefreshToken);

    // Exchange refresh token for a fresh access token
    const tokenResp = await fetch(GOOGLE_OAUTH_CONSTANTS.TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenResp.json() as GoogleTokenResponse;

    if (!tokenResp.ok || tokenData.error) {
      logger.error('Failed to refresh Google access token', {
        userId,
        error: tokenData.error || 'unknown',
        description: tokenData.error_description,
      });
      res.status(502).json({
        success: false,
        error: `Token refresh failed: ${tokenData.error_description || tokenData.error || 'unknown error'}`,
      });
      return;
    }

    logger.info('Issued fresh Google Workspace access token', {
      userId,
      expiresIn: tokenData.expires_in,
      scopes: tokenData.scope,
    });

    res.json({
      success: true,
      data: {
        accessToken: tokenData.access_token,
        expiresIn: tokenData.expires_in,
        tokenType: tokenData.token_type,
        scopes: tokenData.scope ? tokenData.scope.split(' ') : googleService.scopes,
      },
    });
  } catch (error) {
    logger.error('Workspace token endpoint error', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

/**
 * GET /api/workspace/scopes — List available Workspace scopes.
 *
 * Returns the configured WORKSPACE_SCOPES from constants.
 * Agents can use this to know which Google APIs are available.
 *
 * @param _req - Express request (unused)
 * @param res - Express response
 */
export function listWorkspaceScopes(_req: Request, res: Response): void {
  res.json({
    success: true,
    data: {
      scopes: [...GOOGLE_OAUTH_CONSTANTS.WORKSPACE_SCOPES],
    },
  });
}
