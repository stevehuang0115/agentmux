/**
 * Session Routes
 *
 * Defines HTTP routes for session management operations.
 * These endpoints are used by the MCP server to interact with
 * sessions managed by the backend.
 *
 * @module session.routes
 */

import { Router } from 'express';
import type { ApiContext } from '../types.js';
import {
	listSessions,
	getSession,
	createSession,
	writeToSession,
	getSessionOutput,
	killSession,
	getPreviousSessions,
	dismissPreviousSessions,
} from './session.controller.js';

/**
 * Creates session router with all session-related endpoints
 *
 * @param context - API context with services
 * @returns Express router configured with session routes
 */
export function createSessionRouter(context: ApiContext): Router {
	const router = Router();

	// Previous sessions endpoints (must come before /:name to avoid route conflicts)
	router.get('/previous', getPreviousSessions.bind(context));
	router.post('/previous/dismiss', dismissPreviousSessions.bind(context));

	// Session management endpoints
	router.get('/', listSessions.bind(context));
	router.post('/', createSession.bind(context));
	router.get('/:name', getSession.bind(context));
	router.delete('/:name', killSession.bind(context));

	// Session I/O endpoints
	router.post('/:name/write', writeToSession.bind(context));
	router.get('/:name/output', getSessionOutput.bind(context));

	return router;
}
