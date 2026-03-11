/**
 * Cloud REST Routes
 *
 * Router configuration for CrewlyAI Cloud integration endpoints.
 *
 * Endpoints:
 * - POST /connect     - Connect to CrewlyAI Cloud
 * - POST /disconnect  - Disconnect from CrewlyAI Cloud
 * - GET  /status      - Get connection status and subscription tier
 * - GET  /templates   - Fetch premium templates (requires connection)
 *
 * @module controllers/cloud/cloud.routes
 */

import { Router } from 'express';
import {
  connectToCloud,
  disconnectFromCloud,
  getCloudStatus,
  getCloudTemplates,
} from './cloud.controller.js';
/**
 * Creates the cloud router with all CrewlyAI Cloud endpoints.
 *
 * @returns Express router configured with cloud routes
 */
export function createCloudRouter(): Router {
  const router = Router();

  router.post('/connect', connectToCloud);
  router.post('/disconnect', disconnectFromCloud);
  router.get('/status', getCloudStatus);
  router.get('/templates', getCloudTemplates);

  return router;
}
