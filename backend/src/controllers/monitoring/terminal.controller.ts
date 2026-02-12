/**
 * Terminal Controller
 *
 * Handles terminal session management endpoints for the API.
 * Uses ISessionBackend for PTY-based session operations.
 *
 * @module terminal-controller
 */

import { Request, Response } from 'express';
import { ApiResponse } from '../../types/index.js';
import { getSessionBackendSync, getSessionBackend } from '../../services/session/index.js';
import { LoggerService, ComponentLogger } from '../../services/core/logger.service.js';
import { TERMINAL_CONTROLLER_CONSTANTS } from '../../constants.js';
import {
	validateTerminalInput,
	sanitizeTerminalInput,
	validateSessionName,
} from '../../utils/security.js';

/** Logger instance for terminal controller */
const logger: ComponentLogger = LoggerService.getInstance().createComponentLogger('TerminalController');

/**
 * List all active terminal sessions.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @returns Promise that resolves when response is sent
 *
 * @example
 * GET /api/terminal/sessions
 * Response: { success: true, data: { sessions: ["session1", "session2"] } }
 */
export async function listTerminalSessions(req: Request, res: Response): Promise<void> {
	try {
		// Use async getSessionBackend to ensure backend is initialized
		// This prevents race conditions when sessions are queried before orchestrator setup completes
		const backend = await getSessionBackend();

		const sessions = backend.listSessions();
		res.json({
			success: true,
			data: { sessions },
		} as ApiResponse);
	} catch (error) {
		logger.error('Error listing terminal sessions', {
			error: error instanceof Error ? error.message : String(error),
		});
		res.status(500).json({
			success: false,
			error: 'Failed to list terminal sessions',
		} as ApiResponse);
	}
}

/**
 * Check if a terminal session exists.
 *
 * @param req - Express request object with sessionName param
 * @param res - Express response object
 * @returns Promise that resolves when response is sent
 *
 * @example
 * GET /api/terminal/my-session/exists
 * Response: { success: true, data: { exists: true, sessionName: "my-session" } }
 */
export async function sessionExists(req: Request, res: Response): Promise<void> {
	try {
		const { sessionName } = req.params;

		if (!sessionName) {
			res.status(400).json({
				success: false,
				error: 'Session name is required',
			} as ApiResponse);
			return;
		}

		// Validate session name for security
		const sessionValidation = validateSessionName(sessionName);
		if (!sessionValidation.isValid) {
			res.status(400).json({
				success: false,
				error: sessionValidation.error,
			} as ApiResponse);
			return;
		}

		const backend = getSessionBackendSync();
		if (!backend) {
			res.status(503).json({
				success: false,
				error: 'Session backend not initialized',
			} as ApiResponse);
			return;
		}

		const exists = backend.sessionExists(sessionName);
		res.json({
			success: true,
			data: { exists, sessionName },
		} as ApiResponse);
	} catch (error) {
		logger.error('Error checking session existence', {
			error: error instanceof Error ? error.message : String(error),
		});
		res.status(500).json({
			success: false,
			error: 'Failed to check session existence',
		} as ApiResponse);
	}
}

/**
 * Capture terminal output from a session.
 *
 * @param req - Express request object with sessionName param and lines query
 * @param res - Express response object
 * @returns Promise that resolves when response is sent
 *
 * @example
 * GET /api/terminal/my-session/output?lines=50
 * Response: { success: true, data: { output: "...", sessionName: "my-session", lines: 50, truncated: false } }
 */
export async function captureTerminal(req: Request, res: Response): Promise<void> {
	try {
		const { sessionName } = req.params;
		const { lines } = req.query;

		if (!sessionName) {
			res.status(400).json({
				success: false,
				error: 'Session name is required',
			} as ApiResponse);
			return;
		}

		// Validate session name for security
		const sessionValidation = validateSessionName(sessionName);
		if (!sessionValidation.isValid) {
			res.status(400).json({
				success: false,
				error: sessionValidation.error,
			} as ApiResponse);
			return;
		}

		const backend = getSessionBackendSync();
		if (!backend) {
			res.status(503).json({
				success: false,
				error: 'Session backend not initialized',
			} as ApiResponse);
			return;
		}

		// Limit lines to prevent memory issues
		const requestedLines = parseInt(lines as string) || TERMINAL_CONTROLLER_CONSTANTS.DEFAULT_CAPTURE_LINES;
		const maxLines = Math.min(requestedLines, TERMINAL_CONTROLLER_CONSTANTS.MAX_CAPTURE_LINES);

		// Check if session exists
		if (!backend.sessionExists(sessionName)) {
			res.status(404).json({
				success: false,
				error: `Session '${sessionName}' not found`,
			} as ApiResponse);
			return;
		}

		// Capture output from session
		const output = backend.captureOutput(sessionName, maxLines);

		// Limit output size to prevent memory issues
		const trimmedOutput =
			output.length > TERMINAL_CONTROLLER_CONSTANTS.MAX_OUTPUT_SIZE
				? '...' + output.substring(output.length - TERMINAL_CONTROLLER_CONSTANTS.MAX_OUTPUT_SIZE + 3)
				: output;

		res.json({
			success: true,
			data: {
				output: trimmedOutput,
				sessionName,
				lines: maxLines,
				truncated: output.length > TERMINAL_CONTROLLER_CONSTANTS.MAX_OUTPUT_SIZE,
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error capturing terminal', {
			error: error instanceof Error ? error.message : String(error),
		});
		res.status(500).json({
			success: false,
			error: 'Failed to capture terminal output',
		} as ApiResponse);
	}
}

/**
 * Write data to a terminal session.
 *
 * @param req - Express request object with sessionName param and data in body
 * @param res - Express response object
 * @returns Promise that resolves when response is sent
 *
 * @example
 * POST /api/terminal/my-session/write
 * Body: { data: "hello\r" }
 * Response: { success: true, message: "Data written successfully" }
 */
export async function writeToSession(req: Request, res: Response): Promise<void> {
	try {
		const { sessionName } = req.params;
		const { data } = req.body;

		if (!sessionName) {
			res.status(400).json({
				success: false,
				error: 'Session name is required',
			} as ApiResponse);
			return;
		}

		// Validate session name for security
		const sessionValidation = validateSessionName(sessionName);
		if (!sessionValidation.isValid) {
			res.status(400).json({
				success: false,
				error: sessionValidation.error,
			} as ApiResponse);
			return;
		}

		if (data === undefined || data === null) {
			res.status(400).json({
				success: false,
				error: 'Data is required',
			} as ApiResponse);
			return;
		}

		// Convert data to string and validate for dangerous control sequences
		const dataStr = String(data);
		const validation = validateTerminalInput(dataStr);
		if (!validation.isValid) {
			logger.warn('Terminal input validation failed', {
				sessionName,
				error: validation.error,
				dataLength: dataStr.length,
			});
			res.status(400).json({
				success: false,
				error: `Invalid terminal input: ${validation.error}`,
			} as ApiResponse);
			return;
		}

		const backend = getSessionBackendSync();
		if (!backend) {
			res.status(503).json({
				success: false,
				error: 'Session backend not initialized',
			} as ApiResponse);
			return;
		}

		const session = backend.getSession(sessionName);
		if (!session) {
			res.status(404).json({
				success: false,
				error: `Session '${sessionName}' not found`,
			} as ApiResponse);
			return;
		}

		// Write data to session (add carriage return for command execution)
		session.write(dataStr + '\r');

		logger.debug('Data written to session', {
			sessionName,
			dataLength: dataStr.length,
		});

		res.json({
			success: true,
			message: 'Data written successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error writing to session', {
			error: error instanceof Error ? error.message : String(error),
		});
		res.status(500).json({
			success: false,
			error: 'Failed to write to session',
		} as ApiResponse);
	}
}

/**
 * Send terminal input to a session (legacy endpoint).
 *
 * @param req - Express request object with sessionName param and input in body
 * @param res - Express response object
 * @returns Promise that resolves when response is sent
 *
 * @example
 * POST /api/terminal/my-session/input
 * Body: { input: "echo hello" }
 * Response: { success: true, message: "Input sent successfully" }
 */
export async function sendTerminalInput(req: Request, res: Response): Promise<void> {
	try {
		const { sessionName } = req.params;
		const { input } = req.body;

		if (!sessionName) {
			res.status(400).json({
				success: false,
				error: 'Session name is required',
			} as ApiResponse);
			return;
		}

		// Validate session name for security
		const sessionValidation = validateSessionName(sessionName);
		if (!sessionValidation.isValid) {
			res.status(400).json({
				success: false,
				error: sessionValidation.error,
			} as ApiResponse);
			return;
		}

		if (!input) {
			res.status(400).json({
				success: false,
				error: 'Input is required',
			} as ApiResponse);
			return;
		}

		// Convert input to string and validate for dangerous control sequences
		const inputStr = String(input);
		const validation = validateTerminalInput(inputStr);
		if (!validation.isValid) {
			logger.warn('Terminal input validation failed', {
				sessionName,
				error: validation.error,
				inputLength: inputStr.length,
			});
			res.status(400).json({
				success: false,
				error: `Invalid terminal input: ${validation.error}`,
			} as ApiResponse);
			return;
		}

		const backend = getSessionBackendSync();
		if (!backend) {
			res.status(503).json({
				success: false,
				error: 'Session backend not initialized',
			} as ApiResponse);
			return;
		}

		const session = backend.getSession(sessionName);
		if (!session) {
			res.status(404).json({
				success: false,
				error: `Session '${sessionName}' not found`,
			} as ApiResponse);
			return;
		}

		// Write input to session (add carriage return for command execution)
		session.write(inputStr + '\r');

		logger.debug('Input sent to session', {
			sessionName,
			inputLength: inputStr.length,
		});

		res.json({
			success: true,
			message: 'Input sent successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error sending terminal input', {
			error: error instanceof Error ? error.message : String(error),
		});
		res.status(500).json({
			success: false,
			error: 'Failed to send terminal input',
		} as ApiResponse);
	}
}

/**
 * Send a special key to a terminal session.
 *
 * @param req - Express request object with sessionName param and key in body
 * @param res - Express response object
 * @returns Promise that resolves when response is sent
 *
 * @example
 * POST /api/terminal/my-session/key
 * Body: { key: "Enter" }
 * Response: { success: true, message: "Key sent successfully" }
 */
export async function sendTerminalKey(req: Request, res: Response): Promise<void> {
	try {
		const { sessionName } = req.params;
		const { key } = req.body;

		if (!sessionName) {
			res.status(400).json({
				success: false,
				error: 'Session name is required',
			} as ApiResponse);
			return;
		}

		// Validate session name for security
		const sessionValidation = validateSessionName(sessionName);
		if (!sessionValidation.isValid) {
			res.status(400).json({
				success: false,
				error: sessionValidation.error,
			} as ApiResponse);
			return;
		}

		if (!key) {
			res.status(400).json({
				success: false,
				error: 'Key is required',
			} as ApiResponse);
			return;
		}

		// Validate key name - only allow known safe key names
		const allowedKeys = [
			'Enter', 'Return', 'Escape', 'Tab', 'Backspace', 'Delete',
			'Up', 'Down', 'Right', 'Left', 'Home', 'End', 'PageUp', 'PageDown',
			'C-c', 'C-d', 'C-z', 'C-l'
		];
		if (!allowedKeys.includes(key)) {
			res.status(400).json({
				success: false,
				error: `Invalid key name. Allowed keys: ${allowedKeys.join(', ')}`,
			} as ApiResponse);
			return;
		}

		const backend = getSessionBackendSync();
		if (!backend) {
			res.status(503).json({
				success: false,
				error: 'Session backend not initialized',
			} as ApiResponse);
			return;
		}

		const session = backend.getSession(sessionName);
		if (!session) {
			res.status(404).json({
				success: false,
				error: `Session '${sessionName}' not found`,
			} as ApiResponse);
			return;
		}

		// Map key names to their escape sequences
		const keySequence = mapKeyToSequence(key);
		session.write(keySequence);

		logger.debug('Key sent to session', {
			sessionName,
			key,
		});

		res.json({
			success: true,
			message: 'Key sent successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error sending terminal key', {
			error: error instanceof Error ? error.message : String(error),
		});
		res.status(500).json({
			success: false,
			error: 'Failed to send terminal key',
		} as ApiResponse);
	}
}

/**
 * Kill a terminal session.
 *
 * @param req - Express request object with sessionName param
 * @param res - Express response object
 * @returns Promise that resolves when response is sent
 *
 * @example
 * DELETE /api/terminal/my-session
 * Response: { success: true, message: "Session killed successfully" }
 */
export async function killSession(req: Request, res: Response): Promise<void> {
	try {
		const { sessionName } = req.params;

		if (!sessionName) {
			res.status(400).json({
				success: false,
				error: 'Session name is required',
			} as ApiResponse);
			return;
		}

		// Validate session name for security
		const sessionValidation = validateSessionName(sessionName);
		if (!sessionValidation.isValid) {
			res.status(400).json({
				success: false,
				error: sessionValidation.error,
			} as ApiResponse);
			return;
		}

		const backend = getSessionBackendSync();
		if (!backend) {
			res.status(503).json({
				success: false,
				error: 'Session backend not initialized',
			} as ApiResponse);
			return;
		}

		if (!backend.sessionExists(sessionName)) {
			res.status(404).json({
				success: false,
				error: `Session '${sessionName}' not found`,
			} as ApiResponse);
			return;
		}

		await backend.killSession(sessionName);

		logger.info('Session killed', { sessionName });

		res.json({
			success: true,
			message: 'Session killed successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error killing session', {
			error: error instanceof Error ? error.message : String(error),
		});
		res.status(500).json({
			success: false,
			error: 'Failed to kill session',
		} as ApiResponse);
	}
}

/**
 * Map a key name to its terminal escape sequence.
 *
 * @param key - The key name (e.g., "Enter", "Escape", "C-c")
 * @returns The corresponding escape sequence
 */
function mapKeyToSequence(key: string): string {
	const keyMap: Record<string, string> = {
		Enter: '\r',
		Return: '\r',
		Escape: '\x1b',
		Tab: '\t',
		Backspace: '\x7f',
		Delete: '\x1b[3~',
		Up: '\x1b[A',
		Down: '\x1b[B',
		Right: '\x1b[C',
		Left: '\x1b[D',
		Home: '\x1b[H',
		End: '\x1b[F',
		PageUp: '\x1b[5~',
		PageDown: '\x1b[6~',
		'C-c': '\x03', // Ctrl+C
		'C-d': '\x04', // Ctrl+D
		'C-z': '\x1a', // Ctrl+Z
		'C-l': '\x0c', // Ctrl+L (clear)
	};

	return keyMap[key] ?? key;
}
