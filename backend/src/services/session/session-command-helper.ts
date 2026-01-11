/**
 * Session Command Helper
 *
 * Provides high-level terminal command operations using the ISessionBackend abstraction.
 * This helper bridges the gap between low-level PTY operations and the higher-level
 * commands that services like AgentRegistrationService need.
 *
 * Key mappings from TmuxCommandService:
 * - sendMessage → write(message + '\r')
 * - sendKey → write(keyCode)
 * - sendCtrlC → write('\x03')
 * - sendEnter → write('\r')
 * - clearCurrentCommandLine → write('\x03\x15') (Ctrl+C then Ctrl+U)
 * - capturePane → captureOutput()
 *
 * @module session-command-helper
 */

import type { ISession, ISessionBackend } from './session-backend.interface.js';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import { SESSION_COMMAND_DELAYS } from '../../constants.js';

/**
 * Key code mappings for special keys
 */
export const KEY_CODES: Record<string, string> = {
	Enter: '\r',
	'C-c': '\x03', // Ctrl+C
	'C-u': '\x15', // Ctrl+U (clear line)
	'C-l': '\x0c', // Ctrl+L (clear screen)
	'C-d': '\x04', // Ctrl+D (EOF)
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
};

/**
 * Session Command Helper class
 *
 * Provides a unified interface for terminal commands that works with both
 * PTY and tmux backends through the ISessionBackend abstraction.
 */
export class SessionCommandHelper {
	private logger: ComponentLogger;
	private backend: ISessionBackend;

	constructor(backend: ISessionBackend) {
		this.logger = LoggerService.getInstance().createComponentLogger('SessionCommandHelper');
		this.backend = backend;
	}

	/**
	 * Check if a session exists
	 */
	sessionExists(sessionName: string): boolean {
		return this.backend.sessionExists(sessionName);
	}

	/**
	 * Get a session by name
	 */
	getSession(sessionName: string): ISession | undefined {
		return this.backend.getSession(sessionName);
	}

	/**
	 * Send a message to a session with Enter key
	 *
	 * @param sessionName - The session to send to
	 * @param message - The message to send
	 * @throws Error if session does not exist
	 */
	async sendMessage(sessionName: string, message: string): Promise<void> {
		const session = this.backend.getSession(sessionName);
		if (!session) {
			throw new Error(`Session '${sessionName}' does not exist`);
		}

		this.logger.debug('Sending message to session', {
			sessionName,
			messageLength: message.length,
		});

		// Write message followed by Enter key
		session.write(message + '\r');

		// Small delay to allow processing
		await this.delay(SESSION_COMMAND_DELAYS.MESSAGE_DELAY);
	}

	/**
	 * Send a key to a session
	 *
	 * @param sessionName - The session to send to
	 * @param key - The key name (e.g., 'Enter', 'C-c', 'Escape')
	 * @throws Error if session does not exist or key is unknown
	 */
	async sendKey(sessionName: string, key: string): Promise<void> {
		const session = this.backend.getSession(sessionName);
		if (!session) {
			throw new Error(`Session '${sessionName}' does not exist`);
		}

		const keyCode = KEY_CODES[key];
		if (!keyCode) {
			// If not a special key, send as literal
			session.write(key);
		} else {
			session.write(keyCode);
		}

		this.logger.debug('Sent key to session', {
			sessionName,
			key,
			isSpecialKey: !!keyCode,
		});

		await this.delay(SESSION_COMMAND_DELAYS.KEY_DELAY);
	}

	/**
	 * Send Ctrl+C to a session
	 */
	async sendCtrlC(sessionName: string): Promise<void> {
		const session = this.backend.getSession(sessionName);
		if (!session) {
			throw new Error(`Session '${sessionName}' does not exist`);
		}

		session.write('\x03');
		this.logger.debug('Sent Ctrl+C to session', { sessionName });
		await this.delay(SESSION_COMMAND_DELAYS.KEY_DELAY);
	}

	/**
	 * Send Enter key to a session
	 */
	async sendEnter(sessionName: string): Promise<void> {
		const session = this.backend.getSession(sessionName);
		if (!session) {
			throw new Error(`Session '${sessionName}' does not exist`);
		}

		session.write('\r');
		this.logger.debug('Sent Enter to session', { sessionName });
		await this.delay(SESSION_COMMAND_DELAYS.KEY_DELAY);
	}

	/**
	 * Send Escape key to a session
	 */
	async sendEscape(sessionName: string): Promise<void> {
		const session = this.backend.getSession(sessionName);
		if (!session) {
			throw new Error(`Session '${sessionName}' does not exist`);
		}

		session.write('\x1b');
		this.logger.debug('Sent Escape to session', { sessionName });
		await this.delay(SESSION_COMMAND_DELAYS.KEY_DELAY);
	}

	/**
	 * Clear the current command line in a session
	 * Sends Ctrl+C followed by Ctrl+U to cancel any input and clear the line
	 */
	async clearCurrentCommandLine(sessionName: string): Promise<void> {
		const session = this.backend.getSession(sessionName);
		if (!session) {
			throw new Error(`Session '${sessionName}' does not exist`);
		}

		// Ctrl+C to cancel any running command
		session.write('\x03');
		await this.delay(SESSION_COMMAND_DELAYS.CLEAR_COMMAND_DELAY);

		// Ctrl+U to clear the current line
		session.write('\x15');

		this.logger.debug('Cleared command line', { sessionName });
		await this.delay(SESSION_COMMAND_DELAYS.KEY_DELAY);
	}

	/**
	 * Capture terminal output from a session
	 *
	 * @param sessionName - The session to capture from
	 * @param lines - Number of lines to capture (default: 100)
	 * @returns The captured terminal content
	 */
	capturePane(sessionName: string, lines: number = 100): string {
		return this.backend.captureOutput(sessionName, lines);
	}

	/**
	 * List all active sessions
	 */
	listSessions(): string[] {
		return this.backend.listSessions();
	}

	/**
	 * Kill a session
	 */
	async killSession(sessionName: string): Promise<void> {
		await this.backend.killSession(sessionName);
		this.logger.info('Session killed', { sessionName });
	}

	/**
	 * Create a new session
	 *
	 * @param sessionName - Unique name for the session
	 * @param cwd - Working directory for the session
	 * @param options - Additional session options
	 * @returns The created session
	 */
	async createSession(
		sessionName: string,
		cwd: string,
		options?: {
			command?: string;
			args?: string[];
			env?: Record<string, string>;
			cols?: number;
			rows?: number;
		}
	): Promise<ISession> {
		this.logger.info('Creating session', { sessionName, cwd });

		// Default to shell if no command specified
		const command = options?.command || process.env.SHELL || '/bin/bash';

		const session = await this.backend.createSession(sessionName, {
			cwd,
			command,
			args: options?.args,
			env: options?.env,
			cols: options?.cols,
			rows: options?.rows,
		});

		this.logger.info('Session created', { sessionName, pid: session.pid });
		return session;
	}

	/**
	 * Set an environment variable in a session by executing export command
	 * Note: This only affects new commands run in the session
	 */
	async setEnvironmentVariable(
		sessionName: string,
		key: string,
		value: string
	): Promise<void> {
		const session = this.backend.getSession(sessionName);
		if (!session) {
			throw new Error(`Session '${sessionName}' does not exist`);
		}

		// Export the variable
		session.write(`export ${key}="${value}"\r`);
		this.logger.debug('Set environment variable', { sessionName, key });
		await this.delay(SESSION_COMMAND_DELAYS.ENV_VAR_DELAY);
	}

	/**
	 * Resize a session's terminal
	 */
	resizeSession(sessionName: string, cols: number, rows: number): void {
		const session = this.backend.getSession(sessionName);
		if (!session) {
			throw new Error(`Session '${sessionName}' does not exist`);
		}

		session.resize(cols, rows);
		this.logger.debug('Session resized', { sessionName, cols, rows });
	}

	/**
	 * Get the underlying backend
	 */
	getBackend(): ISessionBackend {
		return this.backend;
	}

	/**
	 * Utility delay function
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

/**
 * Create a SessionCommandHelper instance
 */
export function createSessionCommandHelper(backend: ISessionBackend): SessionCommandHelper {
	return new SessionCommandHelper(backend);
}
