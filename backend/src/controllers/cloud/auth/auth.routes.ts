/**
 * Auth REST Routes
 *
 * Router configuration for CrewlyAI Cloud account endpoints.
 *
 * Public endpoints (no auth required):
 * - POST /register  — create account (via Supabase)
 * - POST /login     — authenticate (via Supabase)
 * - POST /refresh   — refresh token (via Supabase)
 *
 * Protected endpoints (requireSupabaseAuth middleware):
 * - GET  /me        — get profile
 * - PUT  /me        — update profile
 * - GET  /license   — check license status
 *
 * @module controllers/cloud/auth/auth.routes
 */

import { Router } from 'express';
import {
  register,
  login,
  refresh,
  getProfile,
  updateProfile,
  getLicense,
} from './auth.controller.js';
import { requireSupabaseAuth } from '../../../services/cloud/auth/supabase-auth.middleware.js';

/**
 * Creates the auth router with all account management endpoints.
 *
 * @returns Express router configured with auth routes
 */
export function createAuthRouter(): Router {
  const router = Router();

  // Public endpoints
  router.post('/register', register);
  router.post('/login', login);
  router.post('/refresh', refresh);

  // Protected endpoints (require valid Supabase JWT)
  router.get('/me', requireSupabaseAuth, getProfile);
  router.put('/me', requireSupabaseAuth, updateProfile);
  router.get('/license', requireSupabaseAuth, getLicense);

  return router;
}
