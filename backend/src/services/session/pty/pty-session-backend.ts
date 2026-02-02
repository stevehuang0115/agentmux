/**
 * PTY Session Backend Module
 *
 * Implements the ISessionBackend interface using node-pty and @xterm/headless.
 * Provides a full terminal emulation backend with memory-bounded output buffers.
 *
 * @module pty-session-backend
 */

import type { ISessionBackend, ISession, SessionOptions } from '../session-backend.interface.js';
import {
	DEFAULT_TERMINAL_COLS,
	DEFAULT_TERMINAL_ROWS,
} from '../session-backend.interface.js';
import { PtySession } from './pty-session.js';
import { PtyTerminalBuffer } from './pty-terminal-buffer.js';
import { LoggerService, ComponentLogger } from '../../core/logger.service.js';

/**
 * PTY Session Backend implementation.
 *
 * Manages terminal sessions using node-pty for process spawning and
 * @xterm/headless for terminal emulation and output buffering.
 *
 * Features:
 * - In-memory session management via Map
 * - Terminal emulation with xterm.js headless
 * - Memory-bounded output buffers (max 10MB)
 * - Proper cleanup on session termination
 *
 * @example
 * ```typescript
 * const backend = new PtySessionBackend();
 *
 * // Create a session
 * const session = await backend.createSession('dev', {
 *   cwd: '/home/user/project',
 *   command: '/bin/bash',
 * });
 *
 * // Capture output
 * const output = backend.captureOutput('dev', 50);
 *
 * // Cleanup
 * await backend.destroy();
 * ```
 */
export class PtySessionBackend implements ISessionBackend {
	/**
	 * Map of session names to PtySession instances
	 */
	private sessions: Map<string, PtySession> = new Map();

	/**
	 * Map of session names to PtyTerminalBuffer instances
	 */
	private terminalBuffers: Map<string, PtyTerminalBuffer> = new Map();

	/**
	 * Logger for this backend
	 */
	private logger: ComponentLogger;

	/**
	 * Create a new PTY session backend.
	 */
	constructor() {
		this.logger = LoggerService.getInstance().createComponentLogger('PtySessionBackend');
		this.logger.info('PTY session backend initialized');
	}

	/**
	 * Create a new terminal session.
	 *
	 * @param name - Unique name for the session
	 * @param options - Session configuration options
	 * @returns Promise resolving to the created session
	 * @throws Error if session name already exists
	 *
	 * @example
	 * ```typescript
	 * const session = await backend.createSession('my-session', {
	 *   cwd: '/home/user',
	 *   command: '/bin/bash',
	 *   args: ['--login'],
	 *   env: { NODE_ENV: 'development' },
	 *   cols: 120,
	 *   rows: 40,
	 * });
	 * ```
	 */
	async createSession(name: string, options: SessionOptions): Promise<ISession> {
		if (this.sessions.has(name)) {
			throw new Error(`Session '${name}' already exists`);
		}

		this.logger.info('Creating PTY session', {
			name,
			command: options.command,
			cwd: options.cwd,
		});

		// Create the PTY session
		const session = new PtySession(name, options.cwd, options);

		// Create terminal buffer for output buffering and history
		const cols = options.cols ?? DEFAULT_TERMINAL_COLS;
		const rows = options.rows ?? DEFAULT_TERMINAL_ROWS;
		const terminalBuffer = new PtyTerminalBuffer(cols, rows);

		// Pipe session output to terminal buffer
		session.onData((data) => {
			terminalBuffer.write(data);
		});

		// Clean up on session exit
		session.onExit((code) => {
			this.logger.info('Session exited', { name, exitCode: code });
			// Don't delete here - let the session remain accessible until explicitly killed
		});

		// Store session and terminal buffer
		this.sessions.set(name, session);
		this.terminalBuffers.set(name, terminalBuffer);

		this.logger.info('PTY session created', {
			name,
			pid: session.pid,
			cols,
			rows,
		});

		return session;
	}

	/**
	 * Get an existing session by name.
	 *
	 * @param name - Name of the session to retrieve
	 * @returns The session if found, undefined otherwise
	 *
	 * @example
	 * ```typescript
	 * const session = backend.getSession('my-session');
	 * if (session) {
	 *   session.write('echo hello\n');
	 * }
	 * ```
	 */
	getSession(name: string): ISession | undefined {
		return this.sessions.get(name);
	}

	/**
	 * Kill a session by name.
	 *
	 * @param name - Name of the session to kill
	 * @returns Promise that resolves when the session is killed
	 *
	 * @example
	 * ```typescript
	 * await backend.killSession('my-session');
	 * ```
	 */
	async killSession(name: string): Promise<void> {
		const session = this.sessions.get(name);
		const terminalBuffer = this.terminalBuffers.get(name);

		if (session) {
			this.logger.info('Killing session', { name });
			session.kill();
			this.sessions.delete(name);
		}

		if (terminalBuffer) {
			terminalBuffer.dispose();
			this.terminalBuffers.delete(name);
		}

		this.logger.debug('Session resources cleaned up', { name });
	}

	/**
	 * List all active session names.
	 *
	 * @returns Array of session names
	 *
	 * @example
	 * ```typescript
	 * const sessions = backend.listSessions();
	 * console.log('Active sessions:', sessions);
	 * ```
	 */
	listSessions(): string[] {
		return Array.from(this.sessions.keys());
	}

	/**
	 * Check if a session exists by name.
	 *
	 * @param name - Name of the session to check
	 * @returns true if the session exists, false otherwise
	 *
	 * @example
	 * ```typescript
	 * if (backend.sessionExists('my-session')) {
	 *   console.log('Session is running');
	 * }
	 * ```
	 */
	sessionExists(name: string): boolean {
		return this.sessions.has(name);
	}

	/**
	 * Capture recent output from a session.
	 *
	 * @param name - Name of the session
	 * @param lines - Number of lines to capture (default: 100)
	 * @returns Captured output as a string
	 *
	 * @example
	 * ```typescript
	 * const output = backend.captureOutput('my-session', 50);
	 * console.log('Recent output:', output);
	 * ```
	 */
	captureOutput(name: string, lines = 100): string {
		const terminalBuffer = this.terminalBuffers.get(name);
		if (!terminalBuffer) {
			return '';
		}

		return terminalBuffer.getContent(lines);
	}

	/**
	 * Get the full terminal buffer content for a session.
	 *
	 * @param name - Name of the session
	 * @returns Full buffer content as a string
	 *
	 * @example
	 * ```typescript
	 * const buffer = backend.getTerminalBuffer('my-session');
	 * console.log('Full buffer:', buffer);
	 * ```
	 */
	getTerminalBuffer(name: string): string {
		const terminalBuffer = this.terminalBuffers.get(name);
		if (!terminalBuffer) {
			return '';
		}

		return terminalBuffer.getAllContent();
	}

	/**
	 * Get raw output history with ANSI escape codes preserved.
	 *
	 * @param name - Name of the session
	 * @returns Raw output history as a string with ANSI codes
	 *
	 * @example
	 * ```typescript
	 * const rawHistory = backend.getRawHistory('my-session');
	 * terminal.write(rawHistory);
	 * ```
	 */
	getRawHistory(name: string): string {
		const terminalBuffer = this.terminalBuffers.get(name);
		if (!terminalBuffer) {
			return '';
		}

		return terminalBuffer.getHistoryAsString();
	}

	/**
	 * Destroy the backend and clean up all resources.
	 *
	 * @returns Promise that resolves when cleanup is complete
	 *
	 * @example
	 * ```typescript
	 * await backend.destroy();
	 * ```
	 */
	async destroy(): Promise<void> {
		this.logger.info('Destroying PTY session backend', {
			sessionCount: this.sessions.size,
		});

		// Kill all sessions
		const sessionNames = Array.from(this.sessions.keys());
		for (const name of sessionNames) {
			await this.killSession(name);
		}

		this.logger.info('PTY session backend destroyed');
	}

	/**
	 * Get the number of active sessions.
	 *
	 * @returns Number of active sessions
	 */
	getSessionCount(): number {
		return this.sessions.size;
	}

	/**
	 * Resize a session's terminal.
	 *
	 * @param name - Name of the session
	 * @param cols - Number of columns
	 * @param rows - Number of rows
	 * @throws Error if session does not exist
	 */
	resizeSession(name: string, cols: number, rows: number): void {
		const session = this.sessions.get(name);
		const terminalBuffer = this.terminalBuffers.get(name);

		if (!session) {
			throw new Error(`Session '${name}' does not exist`);
		}

		session.resize(cols, rows);
		if (terminalBuffer) {
			terminalBuffer.resize(cols, rows);
		}

		this.logger.debug('Session resized', { name, cols, rows });
	}

	/**
	 * Get the raw output history for a session.
	 *
	 * This returns the raw bytes written to the terminal, including ANSI
	 * sequences. Useful for replaying the session.
	 *
	 * @param name - Name of the session
	 * @returns Raw output history as a string
	 *
	 * @example
	 * ```typescript
	 * const history = backend.getSessionHistory('my-session');
	 * ```
	 */
	getSessionHistory(name: string): string {
		const terminalBuffer = this.terminalBuffers.get(name);
		if (!terminalBuffer) {
			return '';
		}

		return terminalBuffer.getHistoryAsString();
	}

	/**
	 * Get the terminal buffer instance for a session.
	 *
	 * @param name - Name of the session
	 * @returns The PtyTerminalBuffer instance if found, undefined otherwise
	 */
	getTerminalBufferInstance(name: string): PtyTerminalBuffer | undefined {
		return this.terminalBuffers.get(name);
	}
}
