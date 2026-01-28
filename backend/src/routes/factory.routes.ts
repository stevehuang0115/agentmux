/**
 * Factory Routes
 *
 * API endpoints for the 3D Factory visualization, providing real-time
 * data about running Claude instances and usage statistics.
 *
 * Includes both REST endpoints (for backward compatibility) and
 * SSE endpoint for real-time updates.
 *
 * @module routes/factory
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { FactoryService } from '../services/factory.service.js';
import { factorySSEService } from '../services/factory/factory-sse.service.js';

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
	 * GET /api/factory/sse
	 * Server-Sent Events endpoint for real-time Claude instance updates.
	 *
	 * Provides efficient real-time updates instead of polling:
	 * - Single backend poll every 3 seconds (vs per-client polling)
	 * - Hash-based change detection (only broadcasts when data changes)
	 * - Heartbeat every 30 seconds to keep connections alive
	 *
	 * Events:
	 * - connected: Sent on initial connection with clientId
	 * - instances: Claude instances data (sent when data changes)
	 * - heartbeat: Keep-alive signal
	 * - error: Error notification
	 */
	router.get('/sse', (req: Request, res: Response) => {
		// Set SSE headers
		res.setHeader('Content-Type', 'text/event-stream');
		res.setHeader('Cache-Control', 'no-cache');
		res.setHeader('Connection', 'keep-alive');
		res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

		// Flush headers immediately
		res.flushHeaders();

		// Generate unique client ID
		const clientId = randomUUID();

		// Add client to SSE service
		factorySSEService.addClient(clientId, res);

		// Handle client disconnect
		req.on('close', () => {
			factorySSEService.removeClient(clientId);
		});
	});

	/**
	 * GET /api/factory/health
	 * Health check for factory API
	 */
	router.get('/health', (req: Request, res: Response) => {
		res.json({
			status: 'ok',
			timestamp: new Date().toISOString(),
			sseClients: factorySSEService.getClientCount(),
		});
	});

	return router;
}
