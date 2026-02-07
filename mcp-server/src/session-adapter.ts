/**
 * Session Adapter for MCP Server
 *
 * Provides a TmuxService-like interface that communicates with the backend API
 * instead of directly managing sessions. This is necessary because the MCP server
 * runs in a separate process from the backend, so they can't share in-memory sessions.
 *
 * @module session-adapter
 */

import { logger } from './logger.js';
import { WEB_CONSTANTS } from '../../config/index.js';

/**
 * Session information returned by the backend
 */
export interface SessionInfo {
	sessionName: string;
	created?: string;
	status?: string;
	pid?: number;
	attached?: boolean;
}

/**
 * Configuration for creating a new session
 */
export interface SessionConfig {
	name: string;
	cwd?: string;
	command?: string;
	args?: string[];
	env?: Record<string, string>;
}

/**
 * Session Adapter class that provides TmuxService-compatible interface
 * using HTTP API calls to the backend.
 */
export class SessionAdapter {
	private apiBaseUrl: string;

	constructor() {
		this.apiBaseUrl = `http://localhost:${process.env.API_PORT || WEB_CONSTANTS.PORTS.BACKEND}`;
	}

	/**
	 * Initialize the session adapter (no-op for API-based adapter)
	 */
	async initialize(): Promise<void> {
		// No initialization needed - backend manages sessions
		logger.info('[SessionAdapter] Session adapter initialized (using backend API)');
	}

	/**
	 * Cleanup resources (no-op for API-based adapter)
	 */
	destroy(): void {
		// No cleanup needed - backend manages sessions
		logger.info('[SessionAdapter] Session adapter destroyed');
	}

	/**
	 * Check if a session exists
	 */
	async sessionExists(sessionName: string): Promise<boolean> {
		try {
			const response = await fetch(
				`${this.apiBaseUrl}/api/sessions/${encodeURIComponent(sessionName)}`
			);
			return response.ok;
		} catch (error) {
			logger.warn(`[SessionAdapter] Failed to check session ${sessionName}:`, error);
			return false;
		}
	}

	/**
	 * List all active sessions
	 */
	async listSessions(): Promise<SessionInfo[]> {
		try {
			const response = await fetch(`${this.apiBaseUrl}/api/sessions`);
			if (!response.ok) {
				logger.warn('[SessionAdapter] Failed to list sessions:', response.statusText);
				return [];
			}
			const data = (await response.json()) as { sessions?: SessionInfo[] };
			return data.sessions || [];
		} catch (error) {
			logger.warn('[SessionAdapter] Failed to list sessions:', error);
			return [];
		}
	}

	/**
	 * Send a message to a session
	 */
	async sendMessage(sessionName: string, message: string): Promise<void> {
		try {
			// Write message text first
			const response = await fetch(
				`${this.apiBaseUrl}/api/sessions/${encodeURIComponent(sessionName)}/write`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ data: message }),
				}
			);
			if (!response.ok) {
				throw new Error(`Failed to send message: ${response.statusText}`);
			}

			// Wait for Claude Code to process the pasted text before sending Enter
			await new Promise(resolve => setTimeout(resolve, 1000));

			// Send Enter key separately so it's not consumed by bracketed paste mode
			const enterResponse = await fetch(
				`${this.apiBaseUrl}/api/sessions/${encodeURIComponent(sessionName)}/write`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ data: '\r' }),
				}
			);
			if (!enterResponse.ok) {
				throw new Error(`Failed to send Enter key: ${enterResponse.statusText}`);
			}
		} catch (error) {
			logger.error(`[SessionAdapter] Failed to send message to ${sessionName}:`, error);
			throw error;
		}
	}

	/**
	 * Send a key to a session (without newline)
	 */
	async sendKey(sessionName: string, key: string): Promise<void> {
		try {
			const response = await fetch(
				`${this.apiBaseUrl}/api/sessions/${encodeURIComponent(sessionName)}/write`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ data: key }),
				}
			);
			if (!response.ok) {
				throw new Error(`Failed to send key: ${response.statusText}`);
			}
		} catch (error) {
			logger.error(`[SessionAdapter] Failed to send key to ${sessionName}:`, error);
			throw error;
		}
	}

	/**
	 * Capture output from a session
	 */
	async capturePane(sessionName: string, lines: number = 100): Promise<string> {
		try {
			const response = await fetch(
				`${this.apiBaseUrl}/api/sessions/${encodeURIComponent(sessionName)}/output?lines=${lines}`
			);
			if (!response.ok) {
				logger.warn(`[SessionAdapter] Failed to capture pane for ${sessionName}:`, response.statusText);
				return '';
			}
			const data = (await response.json()) as { output?: string };
			return data.output || '';
		} catch (error) {
			logger.warn(`[SessionAdapter] Failed to capture pane for ${sessionName}:`, error);
			return '';
		}
	}

	/**
	 * Create a new session
	 */
	async createSession(config: SessionConfig): Promise<SessionInfo> {
		try {
			const response = await fetch(`${this.apiBaseUrl}/api/sessions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(config),
			});
			if (!response.ok) {
				throw new Error(`Failed to create session: ${response.statusText}`);
			}
			return (await response.json()) as SessionInfo;
		} catch (error) {
			logger.error(`[SessionAdapter] Failed to create session ${config.name}:`, error);
			throw error;
		}
	}

	/**
	 * Kill a session
	 */
	async killSession(sessionName: string): Promise<void> {
		try {
			const response = await fetch(
				`${this.apiBaseUrl}/api/sessions/${encodeURIComponent(sessionName)}`,
				{ method: 'DELETE' }
			);
			if (!response.ok) {
				throw new Error(`Failed to kill session: ${response.statusText}`);
			}
		} catch (error) {
			logger.error(`[SessionAdapter] Failed to kill session ${sessionName}:`, error);
			throw error;
		}
	}
}
