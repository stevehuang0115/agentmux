/**
 * Relay REST Routes
 *
 * Router configuration for WebSocket Relay registration and status endpoints.
 *
 * Endpoints:
 * - POST /register  - Register a local instance as a relay node
 * - GET  /status    - Get relay server status and active sessions
 *
 * @module controllers/cloud/relay.routes
 */

import { Router } from 'express';
import { registerRelayNode, getRelayStatus } from './relay.controller.js';

/**
 * Creates the relay router with all relay management endpoints.
 *
 * @returns Express router configured with relay routes
 */
export function createRelayRouter(): Router {
  const router = Router();

  router.post('/register', registerRelayNode);
  router.get('/status', getRelayStatus);

  return router;
}
