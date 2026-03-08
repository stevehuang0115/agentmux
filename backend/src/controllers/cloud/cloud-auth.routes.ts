/**
 * Cloud Auth REST Routes (Supabase-backed)
 *
 * Router configuration for Supabase-backed Cloud authentication endpoints.
 * All endpoints are public (Supabase handles auth state internally).
 *
 * Endpoints:
 * - POST /register  — create account
 * - POST /login     — sign in
 * - POST /logout    — sign out
 * - GET  /session   — check current session
 * - GET  /license   — check license status
 *
 * @module controllers/cloud/cloud-auth.routes
 */

import { Router } from 'express';
import {
  cloudRegister,
  cloudLogin,
  cloudLogout,
  cloudGetSession,
  cloudGetLicense,
} from './cloud-auth.controller.js';

/**
 * Creates the cloud auth router with Supabase-backed endpoints.
 *
 * @returns Express router configured with cloud auth routes
 */
export function createCloudAuthRouter(): Router {
  const router = Router();

  router.post('/register', cloudRegister);
  router.post('/login', cloudLogin);
  router.post('/logout', cloudLogout);
  router.get('/session', cloudGetSession);
  router.get('/license', cloudGetLicense);

  return router;
}
