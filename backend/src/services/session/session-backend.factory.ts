/**
 * Session Backend Factory Module
 *
 * Provides factory functions for creating and accessing session backend instances.
 * Uses a singleton pattern to ensure only one backend instance is active at a time.
 *
 * @module session-backend.factory
 */

import {
	ISessionBackend,
	SessionBackendType,
} from './session-backend.interface.js';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import { PtySessionBackend } from './pty/index.js';

// DORMANT: Uncomment to re-enable tmux backend
// import { TmuxSessionBackend } from './tmux/index.js';

/**
 * Singleton instance of the session backend
 */
let sessionBackendInstance: ISessionBackend | null = null;

/**
 * Type of the currently active backend
 */
let currentBackendType: SessionBackendType | null = null;

/**
 * Promise-based mutex to prevent race conditions during async initialization.
 * If a creation is in progress, subsequent calls wait for it to complete.
 */
let creationPromise: Promise<ISessionBackend> | null = null;

/**
 * Logger for factory operations
 */
const getLogger = (): ComponentLogger => {
	return LoggerService.getInstance().createComponentLogger('SessionBackendFactory');
};

/**
 * Create a new session backend instance.
 *
 * This function creates a new backend instance based on the specified type.
 * If a backend already exists and is of a different type, the existing
 * backend will be destroyed before creating the new one.
 *
 * @param type - Type of backend to create ('pty' or 'tmux'). Defaults to 'pty'.
 * @returns The created session backend instance
 * @throws Error if the backend type is not supported or creation fails
 *
 * @example
 * ```typescript
 * // Create a PTY backend (default)
 * const backend = await createSessionBackend();
 *
 * // Create a specific backend type
 * const ptyBackend = await createSessionBackend('pty');
 * const tmuxBackend = await createSessionBackend('tmux');
 * ```
 */
export async function createSessionBackend(
	type: SessionBackendType = 'pty'
): Promise<ISessionBackend> {
	const logger = getLogger();

	// Return existing instance if it matches the requested type
	if (sessionBackendInstance && currentBackendType === type) {
		logger.debug('Returning existing session backend instance', { type });
		return sessionBackendInstance;
	}

	// If a creation is already in progress, wait for it
	if (creationPromise) {
		logger.debug('Waiting for in-progress backend creation', { type });
		return creationPromise;
	}

	// Create the backend with mutex protection
	creationPromise = (async () => {
		try {
			// Double-check after acquiring the "lock"
			if (sessionBackendInstance && currentBackendType === type) {
				return sessionBackendInstance;
			}

			// If we have an existing instance of a different type, destroy it first
			if (sessionBackendInstance && currentBackendType !== type) {
				logger.info('Destroying existing backend to switch types', {
					oldType: currentBackendType,
					newType: type,
				});
				await sessionBackendInstance.destroy();
				sessionBackendInstance = null;
				currentBackendType = null;
			}

			logger.info('Creating new session backend', { type });

			switch (type) {
				case 'pty': {
					sessionBackendInstance = new PtySessionBackend();
					currentBackendType = 'pty';
					logger.info('PTY session backend created');
					return sessionBackendInstance;
				}

				case 'tmux':
					// DORMANT: tmux backend is available but disabled in favor of PTY.
					// To re-enable tmux support:
					// 1. Uncomment the import at the top of this file
					// 2. Uncomment the lines below
					// sessionBackendInstance = new TmuxSessionBackend();
					// currentBackendType = 'tmux';
					// logger.info('Tmux session backend created');
					// return sessionBackendInstance;
					throw new Error(
						'tmux backend is currently disabled. ' +
							'PTY backend is preferred. ' +
							'To re-enable tmux, see session-backend.factory.ts'
					);

				default: {
					const exhaustiveCheck: never = type;
					throw new Error(`Unsupported session backend type: ${exhaustiveCheck}`);
				}
			}
		} finally {
			// Clear the promise after completion (success or failure)
			creationPromise = null;
		}
	})();

	return creationPromise;
}

/**
 * Get the singleton session backend instance.
 *
 * Returns the currently active session backend instance, or creates a new
 * PTY backend if none exists.
 *
 * @returns The session backend instance
 * @throws Error if no backend exists and creation fails
 *
 * @example
 * ```typescript
 * const backend = await getSessionBackend();
 * const session = await backend.createSession('my-session', options);
 * ```
 */
export async function getSessionBackend(): Promise<ISessionBackend> {
	if (!sessionBackendInstance) {
		return await createSessionBackend('pty');
	}
	return sessionBackendInstance;
}

/**
 * Get the singleton session backend instance synchronously.
 *
 * Returns the currently active session backend instance, or null if none exists.
 * This is useful for checking if a backend has been initialized without
 * triggering creation.
 *
 * @returns The session backend instance if it exists, null otherwise
 *
 * @example
 * ```typescript
 * const backend = getSessionBackendSync();
 * if (backend) {
 *   console.log('Backend is initialized');
 * } else {
 *   console.log('No backend initialized yet');
 * }
 * ```
 */
export function getSessionBackendSync(): ISessionBackend | null {
	return sessionBackendInstance;
}

/**
 * Get the type of the currently active backend.
 *
 * @returns The backend type if one is active, null otherwise
 *
 * @example
 * ```typescript
 * const type = getSessionBackendType();
 * console.log('Current backend type:', type ?? 'none');
 * ```
 */
export function getSessionBackendType(): SessionBackendType | null {
	return currentBackendType;
}

/**
 * Destroy the current session backend and release resources.
 *
 * This function destroys the singleton backend instance, killing all
 * active sessions and releasing any held resources.
 *
 * @returns Promise that resolves when destruction is complete
 *
 * @example
 * ```typescript
 * await destroySessionBackend();
 * console.log('Backend destroyed');
 * ```
 */
export async function destroySessionBackend(): Promise<void> {
	const logger = getLogger();

	if (sessionBackendInstance) {
		logger.info('Destroying session backend', { type: currentBackendType });
		await sessionBackendInstance.destroy();
		sessionBackendInstance = null;
		currentBackendType = null;
		logger.info('Session backend destroyed');
	} else {
		logger.debug('No session backend to destroy');
	}
}

/**
 * Check if a session backend is currently initialized.
 *
 * @returns true if a backend exists, false otherwise
 *
 * @example
 * ```typescript
 * if (isSessionBackendInitialized()) {
 *   console.log('Backend is ready');
 * }
 * ```
 */
export function isSessionBackendInitialized(): boolean {
	return sessionBackendInstance !== null;
}

/**
 * Reset the factory state (for testing purposes).
 *
 * This function resets the internal factory state without destroying
 * the backend. Use with caution - this is primarily for testing.
 *
 * @internal
 */
export function resetSessionBackendFactory(): void {
	sessionBackendInstance = null;
	currentBackendType = null;
	creationPromise = null;
}

/**
 * Set the session backend instance (for testing purposes).
 *
 * This function allows injecting a mock backend for testing.
 * Use with caution - this is primarily for testing.
 *
 * @param backend - The backend instance to set
 * @param type - The type of the backend
 * @internal
 */
export function setSessionBackendForTesting(
	backend: ISessionBackend | null,
	type: SessionBackendType | null
): void {
	sessionBackendInstance = backend;
	currentBackendType = type;
}
