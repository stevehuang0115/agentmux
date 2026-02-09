/**
 * Teams Backup Routes
 *
 * Router configuration for teams backup and restore endpoints.
 *
 * @module controllers/teams-backup/teams-backup.routes
 */

import { Router } from 'express';
import { getBackupStatus, restoreFromBackup } from './teams-backup.controller.js';

/**
 * Create the teams backup router.
 *
 * @returns Express router for /api/teams/backup routes
 */
export function createTeamsBackupRouter(): Router {
  const router = Router();

  // Check backup vs current status
  router.get('/status', getBackupStatus);

  // Restore teams from backup
  router.post('/restore', restoreFromBackup);

  return router;
}
