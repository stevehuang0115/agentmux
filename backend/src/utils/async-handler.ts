/**
 * Shared async handler for Express route handlers.
 *
 * Wraps an async route handler with a standard try/catch that returns
 * a consistent JSON error response on unhandled exceptions.
 *
 * @module utils/async-handler
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Wraps an async route handler with error catching.
 *
 * Catches unhandled errors and either forwards them to Express error middleware
 * (if next is available) or responds with a 500 JSON error.
 *
 * @param fn - The async handler function to wrap
 * @returns A wrapped handler that catches errors
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
	return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			await fn(req, res, next);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			res.status(500).json({ success: false, error: msg });
		}
	};
}
