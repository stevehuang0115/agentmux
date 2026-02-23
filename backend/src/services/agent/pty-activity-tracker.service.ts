/**
 * PTY Activity Tracker Service
 *
 * Lightweight singleton that tracks the last PTY output timestamp per session.
 * Used by IdleDetectionService to determine when agents have been idle
 * long enough to be suspended.
 *
 * @module pty-activity-tracker-service
 */

import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import { stripAnsiCodes } from '../../utils/terminal-output.utils.js';
import { PTY_CONSTANTS } from '../../constants.js';

/**
 * Tracks last PTY output timestamp per session for idle detection.
 *
 * This service is intentionally kept simple — it only records timestamps
 * and answers idle-time queries. It does NOT subscribe to PTY events
 * itself; the terminal gateway hooks into it via `recordActivity()`.
 */
export class PtyActivityTrackerService {
	private static instance: PtyActivityTrackerService | null = null;
	private logger: ComponentLogger;

	/** Map of session name to last activity timestamp (epoch ms) */
	private lastActivityMap: Map<string, number> = new Map();

	private constructor() {
		this.logger = LoggerService.getInstance().createComponentLogger('PtyActivityTracker');
	}

	/**
	 * Get the singleton instance.
	 *
	 * @returns The PtyActivityTrackerService singleton
	 */
	static getInstance(): PtyActivityTrackerService {
		if (!PtyActivityTrackerService.instance) {
			PtyActivityTrackerService.instance = new PtyActivityTrackerService();
		}
		return PtyActivityTrackerService.instance;
	}

	/**
	 * Reset the singleton (for testing).
	 */
	static resetInstance(): void {
		PtyActivityTrackerService.instance = null;
	}

	/**
	 * Record PTY activity for a session.
	 * Called by the terminal gateway whenever PTY data is received.
	 *
	 * @param sessionName - The session that produced output
	 */
	recordActivity(sessionName: string): void {
		this.lastActivityMap.set(sessionName, Date.now());
	}

	/**
	 * Get the idle time in milliseconds for a session.
	 * Returns 0 if no activity has ever been recorded, treating unknown
	 * sessions as "just started" to prevent premature heartbeat/suspend
	 * actions against agents that haven't produced PTY output yet.
	 *
	 * @param sessionName - The session to check
	 * @returns Milliseconds since last PTY output, or 0 if never recorded
	 */
	getIdleTimeMs(sessionName: string): number {
		const lastActivity = this.lastActivityMap.get(sessionName);
		if (lastActivity === undefined) {
			return 0;
		}
		return Date.now() - lastActivity;
	}

	/**
	 * Check whether a session has been idle for at least the given duration.
	 * Returns false if no activity has ever been recorded for the session,
	 * since "never seen" should not be treated as "idle" — this prevents
	 * newly started agents from being immediately suspended.
	 *
	 * @param sessionName - The session to check
	 * @param durationMs - Required idle duration in milliseconds
	 * @returns True if the session has been idle for at least durationMs
	 */
	isIdleFor(sessionName: string, durationMs: number): boolean {
		if (!this.lastActivityMap.has(sessionName)) {
			return false;
		}
		return this.getIdleTimeMs(sessionName) >= durationMs;
	}

	/**
	 * Check if activity has ever been recorded for a session.
	 *
	 * @param sessionName - The session to check
	 * @returns True if activity has been recorded
	 */
	hasActivity(sessionName: string): boolean {
		return this.lastActivityMap.has(sessionName);
	}

	/**
	 * Record PTY activity only if the output contains meaningful content.
	 * Strips ANSI escape codes (cursor movements, color codes, spinner characters)
	 * and only records activity if the remaining text has sufficient non-whitespace
	 * characters. This prevents TUI noise (spinners, cursor repositioning) from
	 * resetting the idle timer.
	 *
	 * @param sessionName - The session that produced output
	 * @param rawData - Raw PTY output data to evaluate
	 */
	recordFilteredActivity(sessionName: string, rawData: string): void {
		const stripped = stripAnsiCodes(rawData).replace(/\s/g, '');
		if (stripped.length >= PTY_CONSTANTS.MIN_MEANINGFUL_OUTPUT_BYTES) {
			this.recordActivity(sessionName);
		}
	}

	/**
	 * Remove tracking data for a session.
	 * Called when a session is terminated or suspended.
	 *
	 * @param sessionName - The session to clear
	 */
	clearSession(sessionName: string): void {
		this.lastActivityMap.delete(sessionName);
		this.logger.debug('Cleared activity tracking for session', { sessionName });
	}

	/**
	 * Get the number of tracked sessions.
	 *
	 * @returns Number of sessions with recorded activity
	 */
	getTrackedSessionCount(): number {
		return this.lastActivityMap.size;
	}
}
