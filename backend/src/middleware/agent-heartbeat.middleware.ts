/**
 * Agent Heartbeat Middleware
 *
 * Express middleware that extracts the X-Agent-Session header from incoming
 * API requests and fires a heartbeat update. This ensures ANY skill call
 * from ANY agent counts as a heartbeat, eliminating the problem of only
 * a few endpoints updating the heartbeat.
 *
 * @module agent-heartbeat.middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { updateAgentHeartbeat } from '../services/agent/agent-heartbeat.service.js';
import { PtyActivityTrackerService } from '../services/agent/pty-activity-tracker.service.js';
import { LoggerService } from '../services/core/logger.service.js';

const logger = LoggerService.getInstance().createComponentLogger('AgentHeartbeatMiddleware');

/**
 * Express middleware that reads the X-Agent-Session header and updates
 * the agent heartbeat fire-and-forget. Also records the API call as
 * PTY activity so that idle detection treats API calls as proof-of-life,
 * preventing false suspend/restart of active agents.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function agentHeartbeatMiddleware(req: Request, res: Response, next: NextFunction): void {
	const sessionName = req.headers['x-agent-session'];

	if (typeof sessionName === 'string' && sessionName.length > 0) {
		// Fire-and-forget: don't await, don't block the request
		updateAgentHeartbeat(sessionName).catch((err) => {
			logger.debug('Heartbeat update failed (non-blocking)', {
				sessionName,
				error: err instanceof Error ? err.message : String(err),
			});
		});

		// Record API call as activity for idle detection.
		// This prevents false idle suspend when agents are actively calling
		// skills/APIs but not producing PTY output.
		PtyActivityTrackerService.getInstance().recordActivity(sessionName);
	}

	next();
}
