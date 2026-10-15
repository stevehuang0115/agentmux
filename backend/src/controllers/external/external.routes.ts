/**
 * External conversations routes, mounted at `/api/external`
 * (specs/2026-10-15-embedded-agent.md).
 *
 * - POST   /replies          — `{ conversation, text }`: reply to an embedded-panel asker (front agent or owner); 422 `reply_blocked` with `reasons`
 * - POST   /host-api         — `{ conversation, method, path, body? }`: call the host's API as that asker (front agent or owner)
 * - GET    /embeds           — OWNER only: embeds this machine answers
 * - PUT    /embeds/:embedId  — OWNER only: `{ frontAgent, label? }` attach an embed to an agent
 * - DELETE /embeds/:embedId  — OWNER only: detach
 *
 * @module controllers/external/external.routes
 */

import { Router } from 'express';
import { ownerOrVerifiedAgent, requireOwner } from '../../middleware/caller-identity.middleware.js';
import { deleteEmbed, listEmbeds, postHostApi, postReply, putEmbed } from './external.controller.js';

/**
 * @returns The `/api/external` router
 */
export function createExternalRouter(): Router {
	const router = Router();
	router.post('/replies', ownerOrVerifiedAgent('Replying to an external person'), postReply);
	router.post('/host-api', ownerOrVerifiedAgent("Calling a portal's API as an external person"), postHostApi);
	router.get('/embeds', requireOwner, listEmbeds);
	router.put('/embeds/:embedId', requireOwner, putEmbed);
	router.delete('/embeds/:embedId', requireOwner, deleteEmbed);
	return router;
}
