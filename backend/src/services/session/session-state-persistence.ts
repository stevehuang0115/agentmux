/**
 * Session State Persistence Module
 *
 * Saves session metadata on shutdown and restores sessions on startup.
 * This compensates for PTY sessions not persisting like tmux sessions do.
 *
 * @module session-state-persistence
 */

import { homedir } from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { ISessionBackend, SessionOptions } from './session-backend.interface.js';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import { RuntimeType, RUNTIME_TYPES } from '../../constants.js';

/** Current version of the state file schema */
const STATE_VERSION = 1;

/** Default state file location */
const DEFAULT_STATE_FILE = path.join(homedir(), '.agentmux', 'session-state.json');

/**
 * Metadata about a persisted session.
 */
export interface PersistedSessionInfo {
	/** Unique session name */
	name: string;
	/** Working directory for the session */
	cwd: string;
	/** Command to run (e.g., 'claude', 'gemini') */
	command: string;
	/** Command arguments */
	args: string[];
	/** Runtime type for the agent */
	runtimeType: RuntimeType;
	/** Agent role (e.g., 'orchestrator', 'dev', 'qa') */
	role?: string;
	/** Team ID if part of a team */
	teamId?: string;
	/** Environment variables */
	env?: Record<string, string>;
}

/**
 * Structure of the persisted state file.
 */
export interface PersistedState {
	/** Schema version */
	version: number;
	/** ISO timestamp when state was saved */
	savedAt: string;
	/** Array of session metadata */
	sessions: PersistedSessionInfo[];
}

/**
 * Session State Persistence Service
 *
 * Manages saving and restoring session state for PTY-based sessions.
 * Sessions are saved when the backend shuts down and restored on startup.
 *
 * @example
 * ```typescript
 * const persistence = new SessionStatePersistence();
 *
 * // Register a session for persistence
 * persistence.registerSession('my-session', options, 'claude-code', 'dev');
 *
 * // Save state on shutdown
 * await persistence.saveState(backend);
 *
 * // Restore state on startup
 * await persistence.restoreState(backend);
 * ```
 */
export class SessionStatePersistence {
	/** Path to the state file */
	private readonly filePath: string;

	/** Map of session name to metadata for persistence */
	private sessionMetadata: Map<string, PersistedSessionInfo> = new Map();

	/** Logger instance */
	private logger: ComponentLogger;

	/**
	 * Create a new SessionStatePersistence instance.
	 *
	 * @param filePath - Optional custom path for the state file
	 */
	constructor(filePath?: string) {
		this.filePath = filePath ?? DEFAULT_STATE_FILE;
		this.logger = LoggerService.getInstance().createComponentLogger('SessionPersistence');
	}

	/**
	 * Register a session for persistence tracking.
	 *
	 * @param name - Session name
	 * @param options - Session options used to create the session
	 * @param runtimeType - Type of runtime (claude-code, gemini-cli, codex-cli)
	 * @param role - Optional role for the agent
	 * @param teamId - Optional team ID
	 */
	registerSession(
		name: string,
		options: SessionOptions,
		runtimeType: RuntimeType,
		role?: string,
		teamId?: string
	): void {
		this.sessionMetadata.set(name, {
			name,
			cwd: options.cwd,
			command: options.command,
			args: options.args ?? [],
			runtimeType,
			role,
			teamId,
			env: options.env,
		});

		this.logger.debug('Registered session for persistence', { name, runtimeType, role });
	}

	/**
	 * Remove a session from persistence tracking.
	 *
	 * @param name - Session name to unregister
	 */
	unregisterSession(name: string): void {
		const deleted = this.sessionMetadata.delete(name);
		if (deleted) {
			this.logger.debug('Unregistered session from persistence', { name });
		}
	}

	/**
	 * Check if a session is registered for persistence.
	 *
	 * @param name - Session name to check
	 * @returns true if the session is registered
	 */
	isSessionRegistered(name: string): boolean {
		return this.sessionMetadata.has(name);
	}

	/**
	 * Get metadata for a registered session.
	 *
	 * @param name - Session name
	 * @returns Session metadata or undefined if not registered
	 */
	getSessionMetadata(name: string): PersistedSessionInfo | undefined {
		return this.sessionMetadata.get(name);
	}

	/**
	 * Get all registered session names.
	 *
	 * @returns Array of registered session names
	 */
	getRegisteredSessions(): string[] {
		return Array.from(this.sessionMetadata.keys());
	}

	/**
	 * Save current session state to disk.
	 *
	 * Only saves sessions that are both active in the backend and registered
	 * for persistence.
	 *
	 * @param backend - Session backend to query for active sessions
	 * @returns Number of sessions saved
	 */
	async saveState(backend: ISessionBackend): Promise<number> {
		const activeSessions = backend.listSessions();
		const sessionsToSave: PersistedSessionInfo[] = [];

		for (const name of activeSessions) {
			const metadata = this.sessionMetadata.get(name);
			if (metadata) {
				sessionsToSave.push(metadata);
			}
		}

		const state: PersistedState = {
			version: STATE_VERSION,
			savedAt: new Date().toISOString(),
			sessions: sessionsToSave,
		};

		try {
			// Ensure directory exists
			await fs.mkdir(path.dirname(this.filePath), { recursive: true });
			await fs.writeFile(this.filePath, JSON.stringify(state, null, 2));

			this.logger.info('Saved session state', {
				count: sessionsToSave.length,
				sessions: sessionsToSave.map((s) => s.name),
			});

			return sessionsToSave.length;
		} catch (error) {
			this.logger.error('Failed to save session state', {
				error: error instanceof Error ? error.message : String(error),
			});
			return 0;
		}
	}

	/**
	 * Restore sessions from saved state.
	 *
	 * For Claude sessions, uses --resume flag to restore conversation context.
	 *
	 * @param backend - Session backend to create sessions in
	 * @returns Number of sessions successfully restored
	 */
	async restoreState(backend: ISessionBackend): Promise<number> {
		try {
			const content = await fs.readFile(this.filePath, 'utf-8');
			const state: PersistedState = JSON.parse(content);

			if (state.version !== STATE_VERSION) {
				this.logger.warn('Unknown state version, skipping restore', {
					version: state.version,
					expected: STATE_VERSION,
				});
				return 0;
			}

			let restored = 0;
			const failed: string[] = [];

			for (const sessionInfo of state.sessions) {
				try {
					// For Claude, always use --resume to restore conversation
					const args = this.getRestoreArgs(sessionInfo);

					await backend.createSession(sessionInfo.name, {
						cwd: sessionInfo.cwd,
						command: sessionInfo.command,
						args,
						env: sessionInfo.env,
					});

					// Re-register metadata for future saves
					this.sessionMetadata.set(sessionInfo.name, sessionInfo);
					restored++;

					this.logger.info('Restored session', {
						name: sessionInfo.name,
						runtimeType: sessionInfo.runtimeType,
					});
				} catch (error) {
					failed.push(sessionInfo.name);
					this.logger.error('Failed to restore session', {
						name: sessionInfo.name,
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}

			this.logger.info('Session restore complete', {
				restored,
				total: state.sessions.length,
				failed: failed.length > 0 ? failed : undefined,
			});

			return restored;
		} catch (error) {
			const errno = error as NodeJS.ErrnoException;
			if (errno.code === 'ENOENT') {
				this.logger.info('No saved session state found');
			} else {
				this.logger.error('Failed to restore session state', {
					error: error instanceof Error ? error.message : String(error),
				});
			}
			return 0;
		}
	}

	/**
	 * Get the arguments to use when restoring a session.
	 *
	 * For Claude, adds --resume flag to restore conversation.
	 *
	 * @param sessionInfo - Session metadata
	 * @returns Arguments array for session creation
	 */
	private getRestoreArgs(sessionInfo: PersistedSessionInfo): string[] {
		if (sessionInfo.runtimeType === RUNTIME_TYPES.CLAUDE_CODE) {
			// Always use --resume for Claude to restore conversation
			const args = [...sessionInfo.args];
			if (!args.includes('--resume')) {
				args.push('--resume');
			}
			return args;
		}

		// Other runtimes use original args
		return sessionInfo.args;
	}

	/**
	 * Clear the saved state file.
	 */
	async clearState(): Promise<void> {
		try {
			await fs.unlink(this.filePath);
			this.logger.info('Cleared session state file');
		} catch (error) {
			const errno = error as NodeJS.ErrnoException;
			if (errno.code !== 'ENOENT') {
				this.logger.error('Failed to clear session state file', {
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
	}

	/**
	 * Clear all registered session metadata (in-memory only).
	 */
	clearMetadata(): void {
		this.sessionMetadata.clear();
		this.logger.debug('Cleared session metadata');
	}

	/**
	 * Get the path to the state file.
	 *
	 * @returns State file path
	 */
	getFilePath(): string {
		return this.filePath;
	}

	/**
	 * Load state from file without restoring sessions.
	 *
	 * @returns Persisted state or null if not found/invalid
	 */
	async loadState(): Promise<PersistedState | null> {
		try {
			const content = await fs.readFile(this.filePath, 'utf-8');
			const state: PersistedState = JSON.parse(content);

			if (state.version !== STATE_VERSION) {
				this.logger.warn('Unknown state version', { version: state.version });
				return null;
			}

			return state;
		} catch {
			return null;
		}
	}
}

/** Singleton instance for application-wide use */
let _instance: SessionStatePersistence | null = null;

/**
 * Get the singleton SessionStatePersistence instance.
 *
 * @returns SessionStatePersistence instance
 */
export function getSessionStatePersistence(): SessionStatePersistence {
	if (!_instance) {
		_instance = new SessionStatePersistence();
	}
	return _instance;
}

/**
 * Reset the singleton instance (for testing).
 */
export function resetSessionStatePersistence(): void {
	_instance = null;
}
