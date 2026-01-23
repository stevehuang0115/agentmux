/**
 * Factory Routes
 *
 * API endpoints for the 3D Factory visualization, providing real-time
 * data about running Claude instances and usage statistics.
 *
 * @module routes/factory
 */

import { Router, Request, Response } from 'express';
import { FactoryService } from '../services/factory.service.js';

const factoryService = new FactoryService();

/**
 * Create the factory routes
 *
 * @returns Express router with factory API endpoints
 */
export function createFactoryRoutes(): Router {
	const router = Router();

	/**
	 * GET /api/factory/claude-instances
	 * Returns information about all running Claude CLI instances
	 */
	router.get('/claude-instances', async (req: Request, res: Response) => {
		try {
			const data = await factoryService.getClaudeInstances();
			res.json(data);
		} catch (error) {
			console.error('Error in /api/factory/claude-instances:', error);
			res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
		}
	});

	/**
	 * GET /api/factory/usage
	 * Returns token usage statistics
	 */
	router.get('/usage', async (req: Request, res: Response) => {
		try {
			const data = await factoryService.getUsageStats();
			res.json(data);
		} catch (error) {
			console.error('Error in /api/factory/usage:', error);
			res.json({
				timestamp: new Date().toISOString(),
				today: { messages: 0, sessions: 0, toolCalls: 0, tokens: 0 },
				totals: { sessions: 0, messages: 0 },
				modelUsage: [],
				recentDays: [],
			});
		}
	});

	/**
	 * GET /api/factory/health
	 * Health check for factory API
	 */
	router.get('/health', (req: Request, res: Response) => {
		res.json({ status: 'ok', timestamp: new Date().toISOString() });
	});

	return router;
}
