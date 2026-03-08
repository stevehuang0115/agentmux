/**
 * Relay REST Routes
 *
 * Router configuration for WebSocket Relay server and client endpoints.
 *
 * Server-side endpoints (public):
 * - POST /register    - Register a local instance as a relay node
 * - GET  /status      - Get relay server status and active sessions
 *
 * Client-side endpoints (require Supabase auth + Pro plan):
 * - POST /connect     - Connect to a remote relay server
 * - POST /disconnect  - Disconnect from the relay server
 * - GET  /devices     - List paired/connected devices
 * - POST /send        - Send a message to the paired peer
 *
 * @module controllers/cloud/relay.routes
 */

import { Router } from 'express';
import {
  registerRelayNode,
  getRelayStatus,
  connectToRelay,
  disconnectFromRelay,
  getRelayDevices,
  sendRelayMessage,
} from './relay.controller.js';
import {
  requireSupabaseAuth,
  requireSupabasePlan,
} from '../../services/cloud/auth/supabase-auth.middleware.js';

/**
 * Creates the relay router with all relay management endpoints.
 *
 * Server-side endpoints are public (used by the relay server itself).
 * Client-side endpoints require Supabase authentication and a Pro plan,
 * since Cloud Relay is a paid feature.
 *
 * @returns Express router configured with relay routes
 */
export function createRelayRouter(): Router {
  const router = Router();

  // Server-side endpoints (public — used by relay infrastructure)
  router.post('/register', registerRelayNode);
  router.get('/status', getRelayStatus);

  // Client-side endpoints (require Supabase auth + Pro plan)
  router.post('/connect', requireSupabaseAuth, requireSupabasePlan('pro'), connectToRelay);
  router.post('/disconnect', requireSupabaseAuth, requireSupabasePlan('pro'), disconnectFromRelay);
  router.get('/devices', requireSupabaseAuth, requireSupabasePlan('pro'), getRelayDevices);
  router.post('/send', requireSupabaseAuth, requireSupabasePlan('pro'), sendRelayMessage);

  return router;
}
