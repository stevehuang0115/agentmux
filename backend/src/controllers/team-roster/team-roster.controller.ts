/**
 * Team roster endpoints (specs/2026-10-10-team-roster.md), mounted at
 * `/api/team-roster`:
 *
 * - `GET /`         — the roster (`?format=json` for structured data, default markdown; `?fresh=1` rebuilds)
 * - `GET /find?q=`  — ranked owner candidates for a request (`&limit=`)
 *
 * @module controllers/team-roster/team-roster.controller
 */

import { Router, type Request, type Response } from 'express';
import { TEAM_ROSTER_CONSTANTS as C } from '../../constants.js';
import { TeamRosterService } from '../../services/team-roster/team-roster.service.js';
import { renderRoster } from '../../services/team-roster/team-roster.builder.js';

/**
 * GET /api/team-roster
 *
 * @param req - Query `format` (`md` | `json`), `fresh`, `maxTokens`
 * @param res - 200 `{ success, data }` where `data` is markdown or the roster; 500 on failure
 */
export async function getTeamRoster(req: Request, res: Response): Promise<void> {
	try {
		const service = TeamRosterService.getInstance();
		const teams = await service.getRoster({ fresh: req.query.fresh === '1' || req.query.fresh === 'true' });
		if (req.query.format === 'json') {
			res.json({ success: true, data: teams });
			return;
		}
		const asked = Number(req.query.maxTokens);
		const budget = Number.isFinite(asked) && asked >= 200 ? Math.min(asked, 20_000) : C.PROMPT_MAX_TOKENS * 2;
		res.json({ success: true, data: renderRoster(teams, budget) });
	} catch (err) {
		res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
	}
}

/**
 * GET /api/team-roster/find?q=<request>
 *
 * @param req - Query `q` (required), `limit`
 * @param res - 200 `{ success, data: OwnerCandidate[] }`; 400 without `q`
 */
export async function findTeamOwner(req: Request, res: Response): Promise<void> {
	const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
	if (!q) {
		res.status(400).json({ success: false, error: 'q is required: the owner request to route' });
		return;
	}
	try {
		const limit = Number(req.query.limit);
		const data = await TeamRosterService.getInstance().find(q, Number.isFinite(limit) && limit > 0 ? limit : undefined);
		res.json({ success: true, data });
	} catch (err) {
		res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
	}
}

/**
 * Create the team roster router.
 *
 * @returns Router for `/api/team-roster`
 */
export function createTeamRosterRouter(): Router {
	const router = Router();
	router.get('/', getTeamRoster);
	router.get('/find', findTeamOwner);
	return router;
}
