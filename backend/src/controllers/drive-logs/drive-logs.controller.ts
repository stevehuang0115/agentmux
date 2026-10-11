/**
 * Drive mode session logs on this machine (specs/2026-10-09-drive-mode-v3.md §10),
 * mounted at `/api/drive-logs`:
 *
 * - `GET /`              — recent logs, newest first (`?limit=`)
 * - `GET /:id`           — one log as markdown (`?format=jsonl` for the events); `id` is `<date>-<sessionId>` or the session id
 *
 * @module controllers/drive-logs/drive-logs.controller
 */

import { Router, type Request, type Response } from 'express';
import { getDriveLogStore } from '../../services/drive/drive-log.store.js';

/**
 * GET /api/drive-logs
 *
 * @param req - Query `limit`
 * @param res - 200 `{ success, data: DriveLogEntry[] }`
 */
export async function listDriveLogs(req: Request, res: Response): Promise<void> {
  try {
    const limit = Number(req.query.limit);
    res.json({ success: true, data: await getDriveLogStore().list(Number.isFinite(limit) && limit > 0 ? limit : undefined) });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * GET /api/drive-logs/:id
 *
 * @param req - Param `id`, query `format` (`md` | `jsonl`)
 * @param res - 200 `{ success, data: text }`; 404 when there is no such log
 */
export async function readDriveLog(req: Request, res: Response): Promise<void> {
  try {
    const format = req.query.format === 'jsonl' ? 'jsonl' : 'md';
    const text = await getDriveLogStore().read(String(req.params.id ?? ''), format);
    if (text === null) {
      res.status(404).json({ success: false, error: 'No such Drive log. List them with GET /api/drive-logs.' });
      return;
    }
    res.json({ success: true, data: text });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Create the Drive logs router.
 *
 * @returns Router for `/api/drive-logs`
 */
export function createDriveLogsRouter(): Router {
  const router = Router();
  router.get('/', listDriveLogs);
  router.get('/:id', readDriveLog);
  return router;
}
