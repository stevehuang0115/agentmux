/**
 * PTY Session Module
 *
 * Implements the ISession interface using node-pty for direct PTY access.
 * This provides better input reliability and Windows support compared to tmux.
 *
 * @module pty-session
 */

import * as pty from 'node-pty';
import type { ISession, SessionOptions } from '../session-backend.interface.js';
import {
	DEFAULT_TERMINAL_COLS,
	DEFAULT_TERMINAL_ROWS,
} from '../session-backend.interface.js';
import { PTY_CONSTANTS } from '../../../constants.js';
import { LoggerService, ComponentLogger } from '../../core/logger.service.js';

/**
 * PTY Session implementation using node-pty.
 *
 * Provides a direct PTY-based terminal session with the following capabilities:
 * - Spawn shell processes with configurable environment
 * - Write input and receive output via callbacks
 * - Resize terminal dimensions
 * - Graceful termination
 *
 * @example
 * ```typescript
 * const session = new PtySession('my-session', '/home/user', {
 *   cwd: '/home/user',
 *   command: '/bin/bash',
 *   cols: 120,
 *   rows: 40,
 * });
 *
 * session.onData((data) => console.log(data));
 * session.write('echo hello\n');
 * session.kill();
 * ```
 */
export class PtySession implements ISession {
	/**
	 * The underlying node-pty process
	 */
	private ptyProcess: pty.IPty;

	/**
	 * Array of data listeners for output events
	 */
	private dataListeners: Array<(data: string) => void> = [];

	/**
	 * Array of exit listeners for process termination events
	 */
	private exitListeners: Array<(code: number) => void> = [];

	/**
	 * Flag indicating whether the session has been killed
	 */
	private killed = false;

	/**
	 * Logger for this session
	 */
	private logger: ComponentLogger;

	/**
	 * Create a new PTY session.
	 *
	 * @param name - Unique name for this session
	 * @param cwd - Current working directory for the session
	 * @param options - Session configuration options
	 * @throws Error if PTY process spawn fails
	 *
	 * @example
	 * ```typescript
	 * const session = new PtySession('dev-session', '/home/user/project', {
	 *   cwd: '/home/user/project',
	 *   command: '/bin/bash',
	 *   args: ['--login'],
	 *   env: { NODE_ENV: 'development' },
	 *   cols: 120,
	 *   rows: 40,
	 * });
	 * ```
	 */
	constructor(
		public readonly name: string,
		public readonly cwd: string,
		options: SessionOptions
	) {
		this.logger = LoggerService.getInstance().createComponentLogger(`PtySession:${name}`);

		// Merge process environment with session-specific environment
		const sessionEnv: Record<string, string> = {
			...this.sanitizeEnv(process.env),
			...options.env,
			// Set TERM for proper terminal emulation
			TERM: 'xterm-256color',
		};

		// Spawn the PTY process
		this.ptyProcess = pty.spawn(options.command, options.args ?? [], {
			name: 'xterm-256color',
			cols: options.cols ?? DEFAULT_TERMINAL_COLS,
			rows: options.rows ?? DEFAULT_TERMINAL_ROWS,
			cwd: options.cwd,
			env: sessionEnv,
		});

		// Set up event handlers
		this.setupEventHandlers();
	}

	/**
	 * The process ID of the underlying PTY process.
	 */
	get pid(): number {
		return this.ptyProcess.pid;
	}

	/**
	 * Subscribe to data output from the session.
	 *
	 * @param callback - Function called when data is received
	 * @returns Unsubscribe function to remove the listener
	 * @throws Error if maximum listener count is exceeded
	 *
	 * @example
	 * ```typescript
	 * const unsubscribe = session.onData((data) => {
	 *   process.stdout.write(data);
	 * });
	 * // Later: unsubscribe();
	 * ```
	 */
	onData(callback: (data: string) => void): () => void {
		if (this.dataListeners.length >= PTY_CONSTANTS.MAX_DATA_LISTENERS) {
			throw new Error(
				`Maximum data listener count (${PTY_CONSTANTS.MAX_DATA_LISTENERS}) exceeded for session ${this.name}`
			);
		}

		this.dataListeners.push(callback);

		return () => {
			const index = this.dataListeners.indexOf(callback);
			if (index > -1) {
				this.dataListeners.splice(index, 1);
			}
		};
	}

	/**
	 * Subscribe to the session exit event.
	 *
	 * @param callback - Function called when the process exits
	 * @returns Unsubscribe function to remove the listener
	 * @throws Error if maximum listener count is exceeded
	 *
	 * @example
	 * ```typescript
	 * const unsubscribe = session.onExit((code) => {
	 *   console.log(`Session exited with code ${code}`);
	 * });
	 * ```
	 */
	onExit(callback: (code: number) => void): () => void {
		if (this.exitListeners.length >= PTY_CONSTANTS.MAX_EXIT_LISTENERS) {
			throw new Error(
				`Maximum exit listener count (${PTY_CONSTANTS.MAX_EXIT_LISTENERS}) exceeded for session ${this.name}`
			);
		}

		this.exitListeners.push(callback);

		return () => {
			const index = this.exitListeners.indexOf(callback);
			if (index > -1) {
				this.exitListeners.splice(index, 1);
			}
		};
	}

	/**
	 * Write data to the session's stdin.
	 *
	 * @param data - String data to write to the session
	 * @throws Error if session has been killed
	 *
	 * @example
	 * ```typescript
	 * session.write('ls -la\n');
	 * session.write('\x03'); // Send Ctrl+C
	 * ```
	 */
	write(data: string): void {
		if (this.killed) {
			throw new Error(`Cannot write to killed session ${this.name}`);
		}
		this.ptyProcess.write(data);
	}

	/**
	 * Resize the terminal dimensions.
	 *
	 * @param cols - Number of columns (width)
	 * @param rows - Number of rows (height)
	 * @throws Error if session has been killed
	 *
	 * @example
	 * ```typescript
	 * session.resize(120, 40);
	 * ```
	 */
	resize(cols: number, rows: number): void {
		if (this.killed) {
			throw new Error(`Cannot resize killed session ${this.name}`);
		}
		this.ptyProcess.resize(cols, rows);
	}

	/**
	 * Kill the session and terminate the underlying process.
	 *
	 * After calling kill(), the session cannot be used anymore.
	 * All listeners will be cleared and subsequent write/resize calls will throw.
	 *
	 * @example
	 * ```typescript
	 * session.kill();
	 * ```
	 */
	kill(): void {
		if (this.killed) {
			return; // Already killed, no-op
		}

		this.killed = true;
		this.ptyProcess.kill();

		// Clear all listeners to prevent memory leaks
		this.dataListeners = [];
		this.exitListeners = [];
	}

	/**
	 * Check if the session has been killed.
	 *
	 * @returns true if the session has been killed
	 */
	isKilled(): boolean {
		return this.killed;
	}

	/**
	 * Set up event handlers for the PTY process.
	 */
	private setupEventHandlers(): void {
		// Handle data output
		this.ptyProcess.onData((data) => {
			if (!this.killed) {
				// Copy listeners array to avoid issues with modifications during iteration
				const listeners = [...this.dataListeners];
				for (const callback of listeners) {
					try {
						callback(data);
					} catch (error) {
						// Log error but don't let one bad listener break others
						this.logger.error('Error in data listener', {
							error: error instanceof Error ? error.message : String(error),
						});
					}
				}
			}
		});

		// Handle process exit
		this.ptyProcess.onExit(({ exitCode }) => {
			// Copy listeners array to avoid issues with modifications during iteration
			const listeners = [...this.exitListeners];
			for (const callback of listeners) {
				try {
					callback(exitCode);
				} catch (error) {
					// Log error but don't let one bad listener break others
					this.logger.error('Error in exit listener', {
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}

			// Mark as killed after exit
			this.killed = true;
			this.dataListeners = [];
			this.exitListeners = [];
		});
	}

	/**
	 * Sanitize environment variables, removing undefined values.
	 *
	 * @param env - Environment variables object
	 * @returns Sanitized environment object with string values only
	 */
	private sanitizeEnv(env: NodeJS.ProcessEnv): Record<string, string> {
		const result: Record<string, string> = {};
		for (const [key, value] of Object.entries(env)) {
			if (value !== undefined) {
				result[key] = value;
			}
		}
		return result;
	}
}
