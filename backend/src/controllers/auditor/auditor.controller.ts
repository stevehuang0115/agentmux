/**
 * Auditor Controller
 *
 * HTTP request handlers for manual auditor triggers and status queries.
 *
 * @module controllers/auditor/auditor.controller
 */

import type { Request, Response, NextFunction } from 'express';
import type { AuditorSchedulerService } from '../../services/agent/auditor-scheduler.service.js';

/** Module-level reference to the auditor scheduler service */
let schedulerService: AuditorSchedulerService | null = null;

/**
 * Set the AuditorSchedulerService instance.
 * Called during server initialization.
 *
 * @param service - The AuditorSchedulerService instance
 */
export function setAuditorSchedulerService(service: AuditorSchedulerService): void {
  schedulerService = service;
}

/**
 * POST /api/auditor/trigger
 *
 * Manually trigger an audit run (L3 trigger layer).
 *
 * @param _req - Express request
 * @param res - Express response with trigger result
 * @param next - Express next function
 */
export async function triggerAudit(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!schedulerService) {
      res.status(503).json({ success: false, error: 'Auditor scheduler not initialized' });
      return;
    }

    const result = await schedulerService.trigger('api');
    const statusCode = result.triggered ? 200 : 409;
    res.status(statusCode).json({ success: result.triggered, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auditor/status
 *
 * Get the current auditor scheduler status and statistics.
 *
 * @param _req - Express request
 * @param res - Express response with status data
 * @param next - Express next function
 */
export async function getAuditorStatus(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!schedulerService) {
      res.status(503).json({ success: false, error: 'Auditor scheduler not initialized' });
      return;
    }

    const status = schedulerService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
}
