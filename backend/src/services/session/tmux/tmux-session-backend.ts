/**
 * TmuxSessionBackend Module
 *
 * Implements ISessionBackend interface using tmux as the underlying session manager.
 *
 * NOTE: This backend is DORMANT and not actively used. The PTY backend is preferred.
 * To re-enable, see session-backend.factory.ts.
 *
 * Key differences from PtySessionBackend:
 * - Sessions survive backend crashes (tmux persists)
 * - Multi-client attach supported (can attach to existing sessions)
 * - Unix only (no Windows support)
 * - Polling-based output detection (higher latency)
 *
 * @module tmux-session-backend
 */

import type { ISession, ISessionBackend, SessionOptions } from '../session-backend.interface.js';
import { TmuxSession } from './tmux-session.js';
// Import from original location - will be moved when tmux is fully deprecated
import { TmuxCommandService } from '../../agent/tmux-command.service.js';
import { LoggerService, ComponentLogger } from '../../core/logger.service.js';

/** Default lines to capture for output */
const DEFAULT_CAPTURE_LINES = 100;

/**
 * TmuxSessionBackend implements ISessionBackend using tmux.
 *
 * This backend creates and manages tmux sessions for terminal access.
 * It's designed as a fallback option but is currently dormant in favor
 * of the PTY backend.
 *
 * @example
 * ```typescript
 * const backend = new TmuxSessionBackend();
 *
 * const session = await backend.createSession('my-agent', {
 *   cwd: '/home/user/project',
 *   command: 'claude',
 *   args: ['--resume'],
 * });
 *
 * session.onData((data) => console.log(data));
 * session.write('hello\n');
 *
 * await backend.destroy();
 * ```
 */
export class TmuxSessionBackend implements ISessionBackend {
	/** Map of session name to TmuxSession instance */
	private sessions: Map<string, TmuxSession> = new Map();

	/** TmuxCommandService instance for low-level tmux operations */
	private tmuxCommand: TmuxCommandService;

	/** Logger instance */
	private logger: ComponentLogger;

	/**
	 * Create a new TmuxSessionBackend.
	 */
	constructor() {
		this.tmuxCommand = new TmuxCommandService();
		this.logger = LoggerService.getInstance().createComponentLogger('TmuxSessionBackend');
	}

	/**
	 * Create a new tmux session.
	 *
	 * @param name - Unique session name
	 * @param options - Session configuration options
	 * @returns Promise resolving to the created session
	 * @throws Error if session already exists or creation fails
	 */
	async createSession(name: string, options: SessionOptions): Promise<ISession> {
		if (this.sessions.has(name)) {
			throw new Error(`Session '${name}' already exists`);
		}

		this.logger.info('Creating tmux session', { name, cwd: options.cwd, command: options.command });

		// Create the tmux session
		await this.tmuxCommand.createSession(name, options.cwd);

		// Start the command in the session
		const command = options.command;
		const args = options.args || [];
		const fullCommand = [command, ...args].join(' ');

		// Send the command to the session
		await this.tmuxCommand.sendMessage(name, fullCommand);
		await this.tmuxCommand.sendEnter(name);

		// Create the session adapter
		const session = new TmuxSession(name, options.cwd, this.tmuxCommand);
		this.sessions.set(name, session);

		this.logger.info('Created tmux session', { name });

		return session;
	}

	/**
	 * Get an existing session by name.
	 *
	 * @param name - Session name
	 * @returns The session if found, undefined otherwise
	 */
	getSession(name: string): ISession | undefined {
		return this.sessions.get(name);
	}

	/**
	 * Kill a session by name.
	 *
	 * @param name - Session name to kill
	 */
	async killSession(name: string): Promise<void> {
		const session = this.sessions.get(name);
		if (session) {
			this.logger.info('Killing tmux session', { name });
			session.kill();
			this.sessions.delete(name);
		} else {
			// Try to kill even if not tracked
			this.logger.warn('Killing untracked tmux session', { name });
			await this.tmuxCommand.killSession(name);
		}
	}

	/**
	 * List all active session names.
	 *
	 * NOTE: This only returns sessions created through this backend,
	 * not all tmux sessions on the system.
	 *
	 * @returns Array of session names
	 */
	listSessions(): string[] {
		return Array.from(this.sessions.keys());
	}

	/**
	 * Check if a session exists.
	 *
	 * @param name - Session name to check
	 * @returns true if session exists
	 */
	sessionExists(name: string): boolean {
		// Check local tracking first
		if (this.sessions.has(name)) {
			return true;
		}

		// Fall back to tmux check (synchronous wrapper)
		// Note: This is a simplified check
		try {
			// For synchronous operation, we check our local map
			return false;
		} catch {
			return false;
		}
	}

	/**
	 * Capture recent output from a session.
	 *
	 * @param name - Session name
	 * @param lines - Number of lines to capture
	 * @returns Captured output as string
	 */
	captureOutput(name: string, lines = DEFAULT_CAPTURE_LINES): string {
		// Note: This is async in tmux but interface requires sync
		// For dormant backend, this returns empty string synchronously
		// Real implementation would need to cache last output
		this.logger.debug('captureOutput called on dormant tmux backend', { name, lines });
		return '';
	}

	/**
	 * Get the terminal buffer content.
	 *
	 * @param name - Session name
	 * @returns Buffer content as string
	 */
	getTerminalBuffer(name: string): string {
		return this.captureOutput(name, DEFAULT_CAPTURE_LINES);
	}

	/**
	 * Destroy the backend and clean up all sessions.
	 */
	async destroy(): Promise<void> {
		this.logger.info('Destroying TmuxSessionBackend', { sessionCount: this.sessions.size });

		for (const name of this.sessions.keys()) {
			await this.killSession(name);
		}

		this.sessions.clear();
	}
}
