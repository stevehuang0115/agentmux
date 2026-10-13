/**
 * Routes of the owner board (`/api/board`).
 *
 * @module controllers/board/board.routes
 */

import { Router } from 'express';
import { createBoardHandlers, type BoardAccessor } from './board.controller.js';

/**
 * Create the board router.
 *
 * @param board - Board accessor (default: the process-wide board)
 * @returns Express router
 */
export function createBoardRouter(board?: BoardAccessor): Router {
	const h = createBoardHandlers(board);
	const router = Router();
	router.get('/', h.getBoard);
	router.get('/agents/:session/timeline', h.getTimeline);
	return router;
}
