/**
 * Terminal Routes Module
 *
 * Registers API routes for terminal session management.
 * Uses ISessionBackend for PTY-based session operations.
 *
 * @module terminal-routes
 */

import { Router } from 'express';
import * as terminalHandlers from '../../controllers/monitoring/terminal.controller.js';

/**
 * Register terminal routes on the router.
 *
 * Routes:
 * - GET /terminal/sessions - List all sessions
 * - GET /terminal/:sessionName/exists - Check if session exists
 * - GET /terminal/:sessionName/output - Get session output (alias for capture)
 * - GET /terminal/:sessionName/capture - Capture terminal output (legacy)
 * - POST /terminal/:sessionName/write - Write data to session
 * - POST /terminal/:sessionName/input - Send input to session (legacy)
 * - POST /terminal/:sessionName/key - Send key to session
 * - DELETE /terminal/:sessionName - Kill session
 *
 * @param router - Express router to register routes on
 */
export function registerTerminalRoutes(router: Router): void {
	// List all sessions
	router.get('/terminal/sessions', terminalHandlers.listTerminalSessions);

	// Check if session exists
	router.get('/terminal/:sessionName/exists', terminalHandlers.sessionExists);

	// Get session output (new PTY-based endpoint)
	router.get('/terminal/:sessionName/output', terminalHandlers.captureTerminal);

	// Capture terminal output (legacy endpoint, same as output)
	router.get('/terminal/:sessionName/capture', terminalHandlers.captureTerminal);

	// Write data to session (new PTY-based endpoint)
	router.post('/terminal/:sessionName/write', terminalHandlers.writeToSession);

	// Send input to session (legacy endpoint)
	router.post('/terminal/:sessionName/input', terminalHandlers.sendTerminalInput);

	// Send key to session
	router.post('/terminal/:sessionName/key', terminalHandlers.sendTerminalKey);

	// Kill session
	router.delete('/terminal/:sessionName', terminalHandlers.killSession);
}
