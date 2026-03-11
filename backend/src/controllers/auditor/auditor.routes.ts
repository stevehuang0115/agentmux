/**
 * Auditor Routes
 *
 * Router configuration for auditor trigger and status endpoints.
 *
 * @module controllers/auditor/auditor.routes
 */

import { Router } from 'express';
import { triggerAudit, getAuditorStatus } from './auditor.controller.js';

/**
 * Create the auditor router with trigger and status endpoints.
 *
 * @returns Express router for /api/auditor routes
 */
export function createAuditorRouter(): Router {
  const router = Router();

  // POST /api/auditor/trigger — manually trigger an audit run
  router.post('/trigger', triggerAudit);

  // GET /api/auditor/status — get scheduler status
  router.get('/status', getAuditorStatus);

  return router;
}
