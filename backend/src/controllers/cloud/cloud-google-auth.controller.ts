/**
 * Cloud Google OAuth Controller
 *
 * Handles Google OAuth login flow for the CrewlyAI Cloud Portal.
 * Provides start (redirect to Google) and callback (exchange code, issue JWT) endpoints.
 *
 * Routes:
 * - GET /api/cloud/google/start    → Redirects to Google consent screen
 * - GET /api/cloud/google/callback  → Handles Google redirect, issues JWT, redirects to frontend
 *
 * @module controllers/cloud/cloud-google-auth.controller
 */

import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { GOOGLE_OAUTH_CONSTANTS, AUTH_CONSTANTS, CLOUD_AUTH_CONSTANTS } from '../../constants.js';
import { UserIdentityService } from '../../services/user/user-identity.service.js';
import { LoggerService } from '../../services/core/logger.service.js';

const logger = LoggerService.getInstance().createComponentLogger('CloudGoogleAuth');

/** Env var for the Cloud Portal frontend URL (where to redirect after login). */
const CLOUD_PORTAL_FRONTEND_URL = (): string =>
  process.env['CLOUD_PORTAL_URL'] || 'https://crewlyai.com';

/** Env var for the Google OAuth redirect URI (must match GCP console). */
const CLOUD_GOOGLE_REDIRECT_URI = (req: Request): string =>
  process.env['CLOUD_GOOGLE_REDIRECT_URI'] ||
  `${req.protocol}://${req.get('host')}/api/cloud/google/callback`;

/** Scopes for Cloud Portal login — only need email and profile. */
const LOGIN_SCOPES = ['openid', 'email', 'profile'];

/**
 * Sign a JWT using HMAC-SHA256.
 *
 * @param payload - JWT payload object
 * @returns Signed JWT string (header.payload.signature)
 */
function signJwt(payload: Record<string, unknown>): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', AUTH_CONSTANTS.JWT.DEFAULT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');
  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * GET /api/cloud/google/start
 *
 * Redirects the browser to the Google OAuth consent screen.
 * Accepts an optional `redirect` query param to control where
 * the user is sent after login completes.
 *
 * @param req - Express request with optional query: { redirect }
 * @param res - Express response (302 redirect)
 * @param next - Next function for error propagation
 */
export async function cloudGoogleStart(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clientId = CLOUD_AUTH_CONSTANTS.GOOGLE.CLIENT_ID;
    if (!clientId) {
      res.status(500).json({ success: false, error: 'GOOGLE_CLIENT_ID is not configured' });
      return;
    }

    const redirectUri = CLOUD_GOOGLE_REDIRECT_URI(req);
    const postLoginRedirect = req.query['redirect'] ? String(req.query['redirect']) : '';

    const statePayload = {
      redirect: postLoginRedirect,
      t: Date.now(),
      nonce: crypto.randomUUID(),
    };
    const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

    const url = new URL(GOOGLE_OAUTH_CONSTANTS.AUTH_BASE_URL);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('scope', LOGIN_SCOPES.join(' '));
    url.searchParams.set('state', state);

    logger.info('Redirecting to Google OAuth consent screen', { redirectUri });
    res.redirect(url.toString());
  } catch (error) {
    logger.error('Failed to initiate Google OAuth', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

/**
 * GET /api/cloud/google/callback
 *
 * Handles the Google OAuth redirect:
 * 1. Exchanges the authorization code for tokens
 * 2. Fetches the Google user profile (email, name)
 * 3. Creates or finds the user via UserIdentityService
 * 4. Signs a JWT access token
 * 5. Redirects to the Cloud Portal frontend with the token
 *
 * @param req - Express request with query: { code, state? }
 * @param res - Express response (302 redirect to frontend)
 * @param next - Next function for error propagation
 */
export async function cloudGoogleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const code = req.query['code'] ? String(req.query['code']) : '';
    const state = req.query['state'] ? String(req.query['state']) : '';
    const errorParam = req.query['error'] ? String(req.query['error']) : '';

    const portalUrl = CLOUD_PORTAL_FRONTEND_URL();

    // Handle Google error responses (user denied, etc.)
    if (errorParam) {
      logger.warn('Google OAuth returned error', { error: errorParam });
      res.redirect(`${portalUrl}/login?error=${encodeURIComponent(errorParam)}`);
      return;
    }

    if (!code) {
      logger.warn('Google OAuth callback missing code');
      res.redirect(`${portalUrl}/login?error=missing_code`);
      return;
    }

    // --- Exchange code for tokens ---
    const clientId = CLOUD_AUTH_CONSTANTS.GOOGLE.CLIENT_ID;
    const clientSecret = process.env['GOOGLE_CLIENT_SECRET'] || '';
    const redirectUri = CLOUD_GOOGLE_REDIRECT_URI(req);

    if (!clientId || !clientSecret) {
      logger.error('Google OAuth credentials not configured');
      res.redirect(`${portalUrl}/login?error=server_config`);
      return;
    }

    const tokenResp = await fetch(GOOGLE_OAUTH_CONSTANTS.TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResp.ok) {
      const details = await tokenResp.text();
      logger.error('Failed to exchange Google OAuth code', { status: tokenResp.status, details });
      res.redirect(`${portalUrl}/login?error=token_exchange_failed`);
      return;
    }

    const tokenData = (await tokenResp.json()) as {
      access_token: string;
      refresh_token?: string;
      id_token?: string;
    };

    // --- Fetch Google profile ---
    const profileResp = await fetch(GOOGLE_OAUTH_CONSTANTS.USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileResp.ok) {
      const details = await profileResp.text();
      logger.error('Failed to fetch Google profile', { status: profileResp.status, details });
      res.redirect(`${portalUrl}/login?error=profile_fetch_failed`);
      return;
    }

    const profile = (await profileResp.json()) as {
      email?: string;
      name?: string;
      picture?: string;
    };

    if (!profile.email) {
      logger.error('Google profile missing email');
      res.redirect(`${portalUrl}/login?error=no_email`);
      return;
    }

    // --- Create or find user ---
    const users = UserIdentityService.getInstance();
    const user = await users.createOrUpdateUser({ email: profile.email });

    // Store Google tokens for the user
    if (tokenData.refresh_token || tokenData.access_token) {
      await users.connectService(user.id, 'google', {
        refreshToken: tokenData.refresh_token || tokenData.access_token,
        accessToken: tokenData.access_token,
        scopes: LOGIN_SCOPES,
      });
    }

    // --- Issue JWT ---
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = {
      sub: user.id,
      email: profile.email,
      name: profile.name || '',
      plan: 'free',
      iat: now,
      exp: now + AUTH_CONSTANTS.JWT.ACCESS_TOKEN_EXPIRY_S,
      iss: AUTH_CONSTANTS.JWT.ISSUER,
      type: 'access',
    };
    const accessToken = signJwt(jwtPayload);

    // --- Parse state for post-login redirect ---
    let postLoginRedirect = '';
    if (state) {
      try {
        const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as { redirect?: string };
        if (parsed.redirect) {
          postLoginRedirect = parsed.redirect;
        }
      } catch {
        logger.warn('Failed to parse OAuth state parameter');
      }
    }

    const finalRedirect = postLoginRedirect || portalUrl;
    const separator = finalRedirect.includes('?') ? '&' : '?';

    logger.info('Cloud Google OAuth login successful', { email: profile.email, userId: user.id });
    res.redirect(`${finalRedirect}${separator}token=${accessToken}`);
  } catch (error) {
    logger.error('Cloud Google OAuth callback error', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}
