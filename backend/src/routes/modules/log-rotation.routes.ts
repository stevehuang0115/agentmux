import { Router, Request, Response } from 'express';
import { LogRotationService } from '../../services/session/log-rotation.service.js';

/**
 * Creates the log rotation admin router with manual trigger and status endpoints.
 *
 * @returns Express Router for log rotation admin operations
 */
export function createLogRotationRouter(): Router {
	const router = Router();

	/**
	 * POST /api/admin/log-rotation/run
	 * Manually triggers a log rotation pass.
	 */
	router.post('/run', async (_req: Request, res: Response) => {
		try {
			const service = LogRotationService.getInstance();
			const result = await service.runRotation();
			res.json({
				success: true,
				data: {
					...result,
					bytesFreedMB: Math.round(result.bytesFreed / (1024 * 1024) * 100) / 100,
				},
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	});

	/**
	 * GET /api/admin/log-rotation/status
	 * Returns the current log file sizes and last rotation run info.
	 */
	router.get('/status', async (_req: Request, res: Response) => {
		try {
			const service = LogRotationService.getInstance();
			const status = await service.getStatus();
			res.json({
				success: true,
				data: {
					...status,
					totalSizeMB: Math.round(status.totalSizeBytes / (1024 * 1024) * 100) / 100,
					currentFiles: status.currentFiles.map(f => ({
						...f,
						sizeMB: Math.round(f.sizeBytes / (1024 * 1024) * 100) / 100,
					})),
				},
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	});

	return router;
}
