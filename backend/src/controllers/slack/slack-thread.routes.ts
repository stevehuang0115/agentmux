/**
 * Slack Thread Routes
 *
 * Express router for Slack thread-related API endpoints.
 *
 * @module controllers/slack/slack-thread.routes
 */

import { Router } from 'express';
import { registerAgentThread } from './slack-thread.controller.js';

/**
 * Create the Slack thread router.
 *
 * @returns Express Router with slack-thread endpoints
 */
export function createSlackThreadRouter(): Router {
  const router = Router();

  // POST /api/slack-threads/register-agent
  router.post('/register-agent', registerAgentThread);

  return router;
}
