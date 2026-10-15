/**
 * External conversations API (`/api/external`): replies to embedded-panel
 * askers, host API calls as the asker, and the owner's embed attachment
 * (specs/2026-10-15-embedded-agent.md).
 *
 * @module controllers/external/external.controller
 */

import type { Request, Response } from 'express';
import { callerAgentSession } from '../../middleware/caller-identity.middleware.js';
import { AppsCloudError } from '../../services/apps/apps-cloud.client.js';
import { ExternalError, type ExternalCaller } from '../../services/external/external.service.js';
import { getExternalParts } from '../../services/external/external.wiring.js';

/**
 * @param req - Request (already past ownerOrVerifiedAgent)
 * @returns The caller: an agent session, or the owner
 */
function callerOf(req: Request): ExternalCaller {
	const session = callerAgentSession(req);
	return session ? { kind: 'agent', session } : { kind: 'owner' };
}

/**
 * Answer a failure as `{ success:false, error, message, reasons? }`.
 *
 * @param res - Response
 * @param err - The failure
 */
export function sendExternalError(res: Response, err: unknown): void {
	if (err instanceof ExternalError || err instanceof AppsCloudError) {
		const reasons = Array.isArray(err.details?.['reasons']) ? { reasons: err.details['reasons'] } : {};
		res.status(err.status).json({ success: false, error: err.code, message: err.message, ...reasons });
		return;
	}
	res.status(500).json({ success: false, error: 'internal', message: 'The external layer failed unexpectedly; check the backend log.' });
}

/**
 * Wrap a handler: answer `{ success:true, data }`, map errors.
 *
 * @param fn - Produces the data
 * @returns Express handler
 */
function handle(fn: (req: Request, caller: ExternalCaller) => Promise<unknown> | unknown) {
	return async (req: Request, res: Response): Promise<void> => {
		try {
			res.json({ success: true, data: await fn(req, callerOf(req)) });
		} catch (err) {
			sendExternalError(res, err);
		}
	};
}

/** POST /replies `{ conversation, text }` */
export const postReply = handle((req, caller) => {
	const { conversation, text } = (req.body ?? {}) as { conversation?: unknown; text?: unknown };
	return getExternalParts().service.reply(caller, String(conversation ?? ''), typeof text === 'string' ? text : '');
});

/** POST /host-api `{ conversation, method, path, body? }` */
export const postHostApi = handle((req, caller) => {
	const { conversation, method, path, body } = (req.body ?? {}) as { conversation?: unknown; method?: unknown; path?: unknown; body?: unknown };
	return getExternalParts().service.hostCall(caller, String(conversation ?? ''), String(method ?? 'GET'), String(path ?? ''), body);
});

/** GET /embeds (owner) */
export const listEmbeds = handle(() => getExternalParts().service.listEmbeds());

/** PUT /embeds/:embedId `{ frontAgent, label? }` (owner) */
export const putEmbed = handle((req) => {
	const { frontAgent, label } = (req.body ?? {}) as { frontAgent?: unknown; label?: unknown };
	return getExternalParts().service.attachEmbed({
		embedId: req.params.embedId,
		frontAgent: typeof frontAgent === 'string' ? frontAgent : '',
		...(typeof label === 'string' ? { label } : {}),
	});
});

/** DELETE /embeds/:embedId (owner) */
export const deleteEmbed = handle((req) => {
	getExternalParts().service.detachEmbed(req.params.embedId);
	return { detached: req.params.embedId };
});
