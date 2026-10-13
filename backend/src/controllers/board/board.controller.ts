/**
 * Owner Board API (crewly#1247): the local view of what is pushed to Cloud.
 *
 * - `GET /api/board` -> the snapshot (same shape as the Cloud push)
 * - `GET /api/board/agents/:session/timeline` -> the agent's recent activity
 *
 * @module controllers/board/board.controller
 */

import type { Request, Response } from 'express';
import { getBoardService, type BoardService } from '../../services/board/board.service.js';

/** Session names the timeline route accepts. */
const SESSION_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

/** Where the handlers get the board (tests inject one). */
export type BoardAccessor = () => BoardService | null;

/**
 * Create the handlers.
 *
 * @param board - Board accessor (default: the process-wide board)
 * @returns Express handlers
 */
export function createBoardHandlers(board: BoardAccessor = getBoardService): {
	getBoard: (req: Request, res: Response) => Promise<void>;
	getTimeline: (req: Request, res: Response) => void;
} {
	return {
		async getBoard(_req, res) {
			const service = board();
			if (!service) {
				res.status(503).json({ success: false, error: 'board is not ready yet' });
				return;
			}
			try {
				res.json({ success: true, data: await service.getSnapshot() });
			} catch (error) {
				res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'board failed' });
			}
		},
		getTimeline(req, res) {
			const service = board();
			const session = String(req.params.session ?? '');
			if (!SESSION_PATTERN.test(session)) {
				res.status(400).json({ success: false, error: 'invalid session' });
				return;
			}
			if (!service) {
				res.status(503).json({ success: false, error: 'board is not ready yet' });
				return;
			}
			res.json({ success: true, data: service.timeline(session) });
		},
	};
}
