/**
 * Session Controller
 *
 * Handles HTTP API endpoints for session management operations.
 * Provides REST API interface for the MCP server to interact with sessions
 * managed by the backend's session backend.
 *
 * @module session.controller
 */

import type { Request, Response } from 'express';
import { getSessionBackendSync, getSessionBackend } from '../../services/session/index.js';
import { LoggerService } from '../../services/core/logger.service.js';

const logger = LoggerService.getInstance().createComponentLogger('SessionController');

/**
 * List all active sessions
 *
 * @route GET /api/sessions
 * @returns {object} JSON response with sessions array
 */
export async function listSessions(
	this: unknown,
	req: Request,
	res: Response
): Promise<void> {
	try {
		// Use async getSessionBackend to ensure backend is initialized
		// This prevents race conditions when sessions are queried before orchestrator setup completes
		const backend = await getSessionBackend();

		const sessionNames = backend.listSessions();
		const sessions = sessionNames.map((name) => {
			const session = backend.getSession(name);
			return {
				sessionName: name,
				pid: session?.pid,
				cwd: session?.cwd,
				status: 'active',
			};
		});

		res.json({ sessions });
	} catch (error) {
		logger.error('Failed to list sessions', { error: error instanceof Error ? error.message : String(error) });
		res.status(500).json({
			error: 'Failed to list sessions',
			message: error instanceof Error ? error.message : 'Unknown error',
		});
	}
}

/**
 * Get a specific session by name
 *
 * @route GET /api/sessions/:name
 * @param name - Session name
 * @returns {object} JSON response with session info or 404
 */
export async function getSession(
	this: unknown,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { name } = req.params;
		const backend = getSessionBackendSync();

		if (!backend || !backend.sessionExists(name)) {
			res.status(404).json({ error: `Session '${name}' not found` });
			return;
		}

		const session = backend.getSession(name);
		res.json({
			sessionName: name,
			pid: session?.pid,
			cwd: session?.cwd,
			status: 'active',
		});
	} catch (error) {
		logger.error('Failed to get session', { name: req.params.name, error: error instanceof Error ? error.message : String(error) });
		res.status(500).json({
			error: 'Failed to get session',
			message: error instanceof Error ? error.message : 'Unknown error',
		});
	}
}

/**
 * Create a new session
 *
 * @route POST /api/sessions
 * @body {name, cwd, command, args, env} - Session configuration
 * @returns {object} JSON response with created session info
 */
export async function createSession(
	this: unknown,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { name, cwd, command, args, env } = req.body;

		if (!name) {
			res.status(400).json({ error: 'Session name is required' });
			return;
		}

		const backend = await getSessionBackend();

		if (backend.sessionExists(name)) {
			res.status(409).json({ error: `Session '${name}' already exists` });
			return;
		}

		const session = await backend.createSession(name, {
			cwd: cwd || process.cwd(),
			command: command || process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
			args: args || [],
			env: env || {},
		});

		logger.info(`Created session '${name}'`);
		res.status(201).json({
			sessionName: name,
			pid: session.pid,
			cwd: session.cwd,
			status: 'active',
		});
	} catch (error) {
		logger.error('Failed to create session', { error: error instanceof Error ? error.message : String(error) });
		res.status(500).json({
			error: 'Failed to create session',
			message: error instanceof Error ? error.message : 'Unknown error',
		});
	}
}

/**
 * Write data to a session
 *
 * @route POST /api/sessions/:name/write
 * @param name - Session name
 * @body {data} - Data to write to the session
 * @returns {object} JSON response confirming write
 */
export async function writeToSession(
	this: unknown,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { name } = req.params;
		const { data } = req.body;

		if (!data) {
			res.status(400).json({ error: 'Data is required' });
			return;
		}

		const backend = getSessionBackendSync();

		if (!backend || !backend.sessionExists(name)) {
			res.status(404).json({ error: `Session '${name}' not found` });
			return;
		}

		const session = backend.getSession(name);
		if (session) {
			session.write(data);
			res.json({ success: true, message: `Data written to session '${name}'` });
		} else {
			res.status(404).json({ error: `Session '${name}' not found` });
		}
	} catch (error) {
		logger.error('Failed to write to session', { name: req.params.name, error: error instanceof Error ? error.message : String(error) });
		res.status(500).json({
			error: 'Failed to write to session',
			message: error instanceof Error ? error.message : 'Unknown error',
		});
	}
}

/**
 * Get output from a session
 *
 * @route GET /api/sessions/:name/output
 * @param name - Session name
 * @query lines - Number of lines to retrieve (default: 100)
 * @returns {object} JSON response with session output
 */
export async function getSessionOutput(
	this: unknown,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { name } = req.params;
		const lines = parseInt(req.query.lines as string) || 100;

		const backend = getSessionBackendSync();

		if (!backend || !backend.sessionExists(name)) {
			res.status(404).json({ error: `Session '${name}' not found` });
			return;
		}

		const output = backend.captureOutput(name, lines);
		res.json({ output });
	} catch (error) {
		logger.error('Failed to get session output', { name: req.params.name, error: error instanceof Error ? error.message : String(error) });
		res.status(500).json({
			error: 'Failed to get session output',
			message: error instanceof Error ? error.message : 'Unknown error',
		});
	}
}

/**
 * Kill a session
 *
 * @route DELETE /api/sessions/:name
 * @param name - Session name
 * @returns {object} JSON response confirming deletion
 */
export async function killSession(
	this: unknown,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { name } = req.params;
		const backend = getSessionBackendSync();

		if (!backend || !backend.sessionExists(name)) {
			res.status(404).json({ error: `Session '${name}' not found` });
			return;
		}

		await backend.killSession(name);
		logger.info(`Killed session '${name}'`);
		res.json({ success: true, message: `Session '${name}' killed` });
	} catch (error) {
		logger.error('Failed to kill session', { name: req.params.name, error: error instanceof Error ? error.message : String(error) });
		res.status(500).json({
			error: 'Failed to kill session',
			message: error instanceof Error ? error.message : 'Unknown error',
		});
	}
}
