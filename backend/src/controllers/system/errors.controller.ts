import { Request, Response } from 'express';
import type { ApiContext } from '../types.js';
import { ErrorTrackingService } from '../../services/index.js';
import { ApiResponse } from '../../types/index.js';
import { LoggerService } from '../../services/core/logger.service.js';

const logger = LoggerService.getInstance().createComponentLogger('ErrorsController');

export async function trackError(this: ApiContext, req: Request, res: Response): Promise<void> {
	try {
		const { message, level, source, component, action, metadata } = req.body as any;
		if (!message) {
			res.status(400).json({
				success: false,
				error: 'Error message is required',
			} as ApiResponse);
			return;
		}
		const errorTracker = ErrorTrackingService.getInstance();
		const errorId = errorTracker.trackError(message, {
			level: level || 'error',
			source: source || 'frontend',
			component,
			action,
			metadata,
			sessionId: req.headers['x-session-id'] as string,
			userId: req.headers['x-user-id'] as string,
		});
		res.status(201).json({
			success: true,
			data: { errorId },
			message: 'Error tracked successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error tracking error', { error: error instanceof Error ? error.message : String(error) });
		res.status(500).json({ success: false, error: 'Failed to track error' } as ApiResponse);
	}
}

export async function getErrorStats(this: ApiContext, req: Request, res: Response): Promise<void> {
	try {
		const errorTracker = ErrorTrackingService.getInstance();
		const stats = errorTracker.getErrorStats();
		res.json({ success: true, data: stats } as ApiResponse);
	} catch (error) {
		logger.error('Error getting error stats', { error: error instanceof Error ? error.message : String(error) });
		res.status(500).json({
			success: false,
			error: 'Failed to get error statistics',
		} as ApiResponse);
	}
}

export async function getErrors(this: ApiContext, req: Request, res: Response): Promise<void> {
	try {
		const { level, source, component, userId, sessionId, since, limit } = req.query as any;
		const errorTracker = ErrorTrackingService.getInstance();
		const errors = errorTracker.getErrors({
			level,
			source,
			component,
			userId,
			sessionId,
			since,
			limit: limit ? parseInt(limit) : undefined,
		});
		res.json({ success: true, data: errors } as ApiResponse);
	} catch (error) {
		logger.error('Error getting errors', { error: error instanceof Error ? error.message : String(error) });
		res.status(500).json({ success: false, error: 'Failed to get errors' } as ApiResponse);
	}
}

export async function getError(this: ApiContext, req: Request, res: Response): Promise<void> {
	try {
		const { errorId } = req.params as any;
		const errorTracker = ErrorTrackingService.getInstance();
		const errorEvent = errorTracker.getError(errorId);
		if (!errorEvent) {
			res.status(404).json({ success: false, error: 'Error not found' } as ApiResponse);
			return;
		}
		res.json({ success: true, data: errorEvent } as ApiResponse);
	} catch (error) {
		logger.error('Error getting error', { error: error instanceof Error ? error.message : String(error) });
		res.status(500).json({ success: false, error: 'Failed to get error' } as ApiResponse);
	}
}

export async function clearErrors(this: ApiContext, req: Request, res: Response): Promise<void> {
	try {
		const { olderThan, level, source } = req.body as any;
		const errorTracker = ErrorTrackingService.getInstance();
		const removedCount = errorTracker.clearErrors({ olderThan, level, source });
		res.json({
			success: true,
			data: { removedCount },
			message: `Cleared ${removedCount} error records`,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error clearing errors', { error: error instanceof Error ? error.message : String(error) });
		res.status(500).json({ success: false, error: 'Failed to clear errors' } as ApiResponse);
	}
}
