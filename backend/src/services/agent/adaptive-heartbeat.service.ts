/**
 * Adaptive Heartbeat Service
 *
 * Implements self-driven, agent-side heartbeat scheduling that replaces
 * passive orchestrator-driven polling. Agents wake themselves at adaptive
 * intervals based on workload state:
 *
 * | State   | Interval | Behavior                              |
 * |---------|----------|---------------------------------------|
 * | Busy    | 5 min    | Full context scan, execute next task  |
 * | Idle    | 4 hours  | Check for new assignments             |
 * | Dormant | 24 hours | Alive check only                      |
 *
 * Inspired by Paperclip's heartbeat protocol.
 *
 * @see https://github.com/stevehuang0115/crewly/issues/172
 * @module services/agent/adaptive-heartbeat.service
 */

import { LoggerService, type ComponentLogger } from '../core/logger.service.js';

/** Heartbeat state determines scheduling interval */
export type HeartbeatState = 'busy' | 'idle' | 'dormant';

/** Adaptive heartbeat configuration */
export interface AdaptiveHeartbeatConfig {
	/** Interval in ms when agent has active tasks (default: 5 minutes) */
	busyIntervalMs: number;
	/** Interval in ms when agent has no tasks but team is active (default: 4 hours) */
	idleIntervalMs: number;
	/** Interval in ms when team is inactive (default: 24 hours) */
	dormantIntervalMs: number;
	/** Maximum consecutive idle heartbeats before transitioning to dormant */
	idleToDormantThreshold: number;
}

/** Result of a single heartbeat check */
export interface HeartbeatCheckResult {
	/** Current heartbeat state */
	state: HeartbeatState;
	/** Next heartbeat interval in ms */
	nextIntervalMs: number;
	/** Whether there is pending work */
	hasPendingWork: boolean;
	/** Number of pending tasks */
	pendingTaskCount: number;
	/** Number of pending messages */
	pendingMessageCount: number;
	/** ISO timestamp of this check */
	checkedAt: string;
}

/** Pending work summary returned by the backend API */
export interface PendingWorkSummary {
	/** Whether there is any pending work */
	hasPendingWork: boolean;
	/** Pending tasks assigned to this agent */
	pendingTasks: Array<{
		id: string;
		taskName: string;
		priority?: string;
		assignedAt: string;
	}>;
	/** Undelivered messages waiting for this agent */
	pendingMessages: Array<{
		id: string;
		from: string;
		preview: string;
		queuedAt: string;
	}>;
	/** Whether the agent's team is active */
	teamActive: boolean;
	/** Recommended heartbeat state based on current workload */
	recommendedState: HeartbeatState;
	/** Recommended next interval in ms */
	recommendedIntervalMs: number;
}

/** Default adaptive heartbeat configuration */
export const ADAPTIVE_HEARTBEAT_DEFAULTS: Readonly<AdaptiveHeartbeatConfig> = {
	busyIntervalMs: 5 * 60 * 1000,        // 5 minutes
	idleIntervalMs: 4 * 60 * 60 * 1000,   // 4 hours
	dormantIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
	idleToDormantThreshold: 3,
} as const;

/**
 * AdaptiveHeartbeatService manages self-driven agent heartbeats.
 *
 * Each agent instance runs this service to:
 * 1. Check for pending work via API
 * 2. Dynamically adjust heartbeat interval based on workload
 * 3. Report health status to the backend
 *
 * The service replaces passive orchestrator-driven polling (#169)
 * with agent-driven scheduling, reducing resource usage by ~80%
 * for idle agents.
 */
export class AdaptiveHeartbeatService {
	private readonly logger: ComponentLogger;
	private readonly config: AdaptiveHeartbeatConfig;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private currentState: HeartbeatState = 'idle';
	private consecutiveIdleChecks: number = 0;
	private lastCheckResult: HeartbeatCheckResult | null = null;
	private onHeartbeat: ((result: HeartbeatCheckResult) => void) | null = null;
	private checkPendingWork: ((sessionName: string) => Promise<PendingWorkSummary>) | null = null;
	private sessionName: string;

	constructor(
		sessionName: string,
		config: Partial<AdaptiveHeartbeatConfig> = {},
	) {
		this.sessionName = sessionName;
		this.config = { ...ADAPTIVE_HEARTBEAT_DEFAULTS, ...config };
		this.logger = LoggerService.getInstance().createComponentLogger('AdaptiveHeartbeat');
	}

	/**
	 * Set the callback for pending work checks.
	 *
	 * @param fn - Function that queries the backend for pending work
	 */
	setCheckPendingWork(fn: (sessionName: string) => Promise<PendingWorkSummary>): void {
		this.checkPendingWork = fn;
	}

	/**
	 * Set the callback invoked after each heartbeat.
	 *
	 * @param fn - Callback receiving the heartbeat check result
	 */
	setOnHeartbeat(fn: (result: HeartbeatCheckResult) => void): void {
		this.onHeartbeat = fn;
	}

	/**
	 * Start the adaptive heartbeat loop.
	 * First heartbeat fires immediately, then reschedules adaptively.
	 */
	start(): void {
		if (this.timer) {
			this.logger.warn('Heartbeat already running, ignoring start()');
			return;
		}
		this.logger.info('Starting adaptive heartbeat', {
			sessionName: this.sessionName,
			initialState: this.currentState,
		});
		// Fire first heartbeat immediately
		this.tick();
	}

	/**
	 * Stop the adaptive heartbeat loop.
	 */
	stop(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.logger.info('Adaptive heartbeat stopped', { sessionName: this.sessionName });
	}

	/**
	 * Get the current heartbeat state.
	 *
	 * @returns Current state
	 */
	getState(): HeartbeatState {
		return this.currentState;
	}

	/**
	 * Get the last heartbeat check result.
	 *
	 * @returns Last result or null if no check has run
	 */
	getLastResult(): HeartbeatCheckResult | null {
		return this.lastCheckResult;
	}

	/**
	 * Get the interval for a given state.
	 *
	 * @param state - Heartbeat state
	 * @returns Interval in ms
	 */
	getIntervalForState(state: HeartbeatState): number {
		switch (state) {
			case 'busy': return this.config.busyIntervalMs;
			case 'idle': return this.config.idleIntervalMs;
			case 'dormant': return this.config.dormantIntervalMs;
		}
	}

	/**
	 * Determine the next heartbeat state based on pending work.
	 *
	 * @param summary - Pending work summary from the backend
	 * @returns Next heartbeat state
	 */
	determineState(summary: PendingWorkSummary): HeartbeatState {
		if (summary.hasPendingWork) {
			this.consecutiveIdleChecks = 0;
			return 'busy';
		}

		if (!summary.teamActive) {
			return 'dormant';
		}

		this.consecutiveIdleChecks++;
		if (this.consecutiveIdleChecks >= this.config.idleToDormantThreshold) {
			return 'dormant';
		}

		return 'idle';
	}

	/**
	 * Execute a single heartbeat tick: check pending work, update state, schedule next.
	 */
	private async tick(): Promise<void> {
		try {
			let summary: PendingWorkSummary;

			if (this.checkPendingWork) {
				summary = await this.checkPendingWork(this.sessionName);
			} else {
				// Fallback: assume idle if no check function is set
				summary = {
					hasPendingWork: false,
					pendingTasks: [],
					pendingMessages: [],
					teamActive: true,
					recommendedState: 'idle',
					recommendedIntervalMs: this.config.idleIntervalMs,
				};
			}

			const previousState = this.currentState;
			this.currentState = this.determineState(summary);
			const nextIntervalMs = this.getIntervalForState(this.currentState);

			const result: HeartbeatCheckResult = {
				state: this.currentState,
				nextIntervalMs,
				hasPendingWork: summary.hasPendingWork,
				pendingTaskCount: summary.pendingTasks.length,
				pendingMessageCount: summary.pendingMessages.length,
				checkedAt: new Date().toISOString(),
			};
			this.lastCheckResult = result;

			if (previousState !== this.currentState) {
				this.logger.info('Heartbeat state transition', {
					from: previousState,
					to: this.currentState,
					nextIntervalMs,
				});
			}

			// Notify listener
			if (this.onHeartbeat) {
				this.onHeartbeat(result);
			}

			// Schedule next tick
			this.timer = setTimeout(() => this.tick(), nextIntervalMs);

		} catch (err) {
			this.logger.error('Heartbeat tick failed, retrying in 1 minute', {
				error: err instanceof Error ? err.message : String(err),
			});
			// On error, retry in 1 minute
			this.timer = setTimeout(() => this.tick(), 60_000);
		}
	}
}
