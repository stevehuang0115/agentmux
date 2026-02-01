/**
 * Settings Controllers Index
 *
 * Combines role and settings controllers under a single router.
 *
 * @module controllers/settings/index
 */

import { Router } from 'express';
import type { ApiContext } from '../types.js';
import roleController from './role.controller.js';
import settingsController from './settings.controller.js';

/**
 * Creates the settings router
 *
 * @param _context - API context (unused, but kept for consistency with other routers)
 * @returns Express router for settings endpoints
 */
export function createSettingsRouter(_context: ApiContext): Router {
  const router = Router();

  // Mount sub-controllers
  // /api/settings/roles/* - Role management endpoints
  router.use('/roles', roleController);

  // /api/settings/* - General settings endpoints
  router.use('/', settingsController);

  return router;
}

export default createSettingsRouter;
