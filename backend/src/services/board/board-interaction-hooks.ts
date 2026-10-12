/**
 * Where the board learns that one agent talked to another (canvas
 * `messaging` links): a middleware on the terminal-write API (what the
 * `send-message` skill calls) and a chat-message listener for agent messages
 * that @mention another agent (rooms, DMs, Slack mirrored into chat).
 * Only sender, receiver and time are kept.
 *
 * @module services/board/board-interaction-hooks
 */

import type { NextFunction, Request, Response } from 'express';
import { readAgentSessionHeader } from '../../utils/agent-caller.utils.js';
import { getAgentInteractions, type AgentInteractionRecorder } from './board-interactions.js';

const WRITE_PATH = /^\/terminal\/([^/]+)\/write\/?$/;

/**
 * Middleware (mounted on `/api`): an agent's successful write to another
 * agent's terminal is a message.
 *
 * @param recorder - Where to record (default: process-wide)
 * @returns Express middleware; never blocks or throws
 */
export function recordTerminalWrites(recorder: AgentInteractionRecorder = getAgentInteractions()) {
	return (req: Request, res: Response, next: NextFunction): void => {
		try {
			if (req.method === 'POST') {
				const match = WRITE_PATH.exec(req.path);
				if (match) {
					const from = readAgentSessionHeader(req);
					const to = decodeURIComponent(match[1]);
					if (from && to && from !== to) {
						res.once('finish', () => {
							if (res.statusCode >= 200 && res.statusCode < 300) recorder.record(from, to);
						});
					}
				}
			}
		} catch {
			/* observing never breaks the request */
		}
		next();
	};
}

/** The parts of a chat message the board reads. */
export interface MentionMessage {
	senderType: string;
	senderId: string;
	mentions?: string[];
}

/**
 * An agent's chat message that @mentions other agents.
 *
 * @param message - Chat message
 * @param resolve - Member id or session -> session (undefined for a team or the owner)
 * @param recorder - Where to record
 */
export function recordChatMentions(message: MentionMessage, resolve: (idOrSession: string) => string | undefined, recorder: AgentInteractionRecorder = getAgentInteractions()): void {
	if (message.senderType !== 'agent' || !message.mentions || message.mentions.length === 0) return;
	const from = resolve(message.senderId) ?? message.senderId;
	for (const m of message.mentions.slice(0, 10)) {
		const to = resolve(m);
		if (to && to !== from) recorder.record(from, to);
	}
}
