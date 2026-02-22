/**
 * Context Window Monitor Service
 *
 * Monitors PTY session output for context window usage percentages and triggers
 * proactive warnings and auto-recovery when thresholds are exceeded.
 *
 * When an agent's Claude Code session reports context usage (e.g., "85% context"),
 * this service detects the percentage, evaluates it against configured thresholds,
 * and takes action:
 * - Yellow (70%): Publishes a warning event
 * - Red (85%): Publishes a warning event
 * - Critical (95%): Triggers auto-recovery (kill + restart session with task re-delivery)
 *
 * Follows the PTY subscription pattern from RuntimeExitMonitorService and the
 * lifecycle/restart pattern from AgentHeartbeatMonitorService.
 *
 * @module services/agent/context-window-monitor
 */

import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import { StorageService } from '../core/storage.service.js';
import {
	getSessionBackendSync,
	createSessionCommandHelper,
} from '../session/index.js';
import { getSessionStatePersistence } from '../session/session-state-persistence.js';
import { getTerminalGateway } from '../../websocket/terminal.gateway.js';
import { PtyActivityTrackerService } from './pty-activity-tracker.service.js';
import { RuntimeExitMonitorService } from './runtime-exit-monitor.service.js';
import { TaskTrackingService } from '../project/task-tracking.service.js';
import { stripAnsiCodes } from '../../utils/terminal-output.utils.js';
import {
	CONTEXT_WINDOW_MONITOR_CONSTANTS,
	AGENT_SUSPEND_CONSTANTS,
	SESSION_COMMAND_DELAYS,
} from '../../constants.js';
import type { AgentRegistrationService } from './agent-registration.service.js';
import type { ISessionBackend } from '../session/session-backend.interface.js';
import type { EventBusService } from '../event-bus/event-bus.service.js';
import type { AgentEvent, EventType } from '../../types/event-bus.types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Context usage severity level.
 */
export type ContextLevel = 'normal' | 'yellow' | 'red' | 'critical';

/**
 * Per-session context window monitoring state.
 */
export interface ContextWindowState {
	/** PTY session name */
	sessionName: string;
	/** Team member ID */
	memberId: string;
	/** Team ID */
	teamId: string;
	/** Agent role */
	role: string;
	/** Last detected context usage percentage (0-100) */
	contextPercent: number;
	/** Current severity level */
	level: ContextLevel;
	/** Timestamp of last context % detection */
	lastDetectedAt: number;
	/** Whether auto-recovery has been triggered for this session */
	recoveryTriggered: boolean;
	/** Total recovery count for this session */
	recoveryCount: number;
	/** Timestamps of recent recoveries for cooldown tracking */
	recoveryTimestamps: number[];
}

/**
 * Internal PTY subscription state per session.
 */
interface SessionSubscription {
	/** Function to unsubscribe from PTY data events */
	unsubscribe: () => void;
	/** Rolling buffer for terminal output */
	buffer: string;
}

// =============================================================================
// Regex patterns for detecting context usage percentages in PTY output
// =============================================================================

/**
 * Patterns to match context window usage percentages from Claude Code output.
 * Each pattern captures the percentage as group 1.
 */
const CONTEXT_PERCENT_PATTERNS: RegExp[] = [
	/(\d{1,3})%\s*(?:of\s+)?context/i,
	/context[:\s]+(\d{1,3})%/i,
	/(\d{1,3})%\s*ctx/i,
];

// =============================================================================
// Service
// =============================================================================

/**
 * Monitors agent PTY sessions for context window usage and triggers
 * threshold-based warnings and auto-recovery.
 *
 * @example
 * ```typescript
 * const monitor = ContextWindowMonitorService.getInstance();
 * monitor.setDependencies(backend, regService, storageService, taskService, eventBus);
 * monitor.start();
 * monitor.startSessionMonitoring('agent-dev', 'member-1', 'team-1', 'developer');
 * ```
 */
export class ContextWindowMonitorService {
	private static instance: ContextWindowMonitorService | null = null;
	private logger: ComponentLogger;

	/** Per-session context window state */
	private contextStates: Map<string, ContextWindowState> = new Map();

	/** Per-session PTY data subscriptions + rolling buffers */
	private sessionSubscriptions: Map<string, SessionSubscription> = new Map();

	/** Periodic check interval timer */
	private checkTimer: ReturnType<typeof setInterval> | null = null;

	/** Dependencies (injected via setDependencies) */
	private sessionBackend: ISessionBackend | null = null;
	private agentRegistrationService: AgentRegistrationService | null = null;
	private storageService: StorageService | null = null;
	private taskTrackingService: TaskTrackingService | null = null;
	private eventBusService: EventBusService | null = null;

	private constructor() {
		this.logger = LoggerService.getInstance().createComponentLogger('ContextWindowMonitor');
	}

	/**
	 * Get the singleton instance.
	 *
	 * @returns The ContextWindowMonitorService singleton
	 */
	static getInstance(): ContextWindowMonitorService {
		if (!ContextWindowMonitorService.instance) {
			ContextWindowMonitorService.instance = new ContextWindowMonitorService();
		}
		return ContextWindowMonitorService.instance;
	}

	/**
	 * Reset the singleton (for testing).
	 */
	static resetInstance(): void {
		if (ContextWindowMonitorService.instance) {
			ContextWindowMonitorService.instance.stop();
			ContextWindowMonitorService.instance.destroyAllSubscriptions();
		}
		ContextWindowMonitorService.instance = null;
	}

	/**
	 * Inject required dependencies.
	 *
	 * @param sessionBackend - Session backend for PTY access
	 * @param agentRegistrationService - For recreating agent sessions on recovery
	 * @param storageService - For querying agent status
	 * @param taskTrackingService - For querying in-progress tasks for re-delivery
	 * @param eventBusService - For publishing context warning/critical events
	 */
	setDependencies(
		sessionBackend: ISessionBackend,
		agentRegistrationService: AgentRegistrationService,
		storageService: StorageService,
		taskTrackingService: TaskTrackingService,
		eventBusService: EventBusService
	): void {
		this.sessionBackend = sessionBackend;
		this.agentRegistrationService = agentRegistrationService;
		this.storageService = storageService;
		this.taskTrackingService = taskTrackingService;
		this.eventBusService = eventBusService;
	}

	/**
	 * Start the periodic check loop for stale detection and cleanup.
	 */
	start(): void {
		if (this.checkTimer) {
			this.logger.warn('Context window monitor already running');
			return;
		}

		this.logger.info('Starting context window monitor', {
			checkIntervalMs: CONTEXT_WINDOW_MONITOR_CONSTANTS.CHECK_INTERVAL_MS,
			yellowThreshold: CONTEXT_WINDOW_MONITOR_CONSTANTS.YELLOW_THRESHOLD_PERCENT,
			redThreshold: CONTEXT_WINDOW_MONITOR_CONSTANTS.RED_THRESHOLD_PERCENT,
			criticalThreshold: CONTEXT_WINDOW_MONITOR_CONSTANTS.CRITICAL_THRESHOLD_PERCENT,
		});

		this.checkTimer = setInterval(() => {
			this.performCheck();
		}, CONTEXT_WINDOW_MONITOR_CONSTANTS.CHECK_INTERVAL_MS);
	}

	/**
	 * Stop the periodic check loop.
	 */
	stop(): void {
		if (this.checkTimer) {
			clearInterval(this.checkTimer);
			this.checkTimer = null;
			this.logger.info('Context window monitor stopped');
		}
	}

	/**
	 * Check if the monitor is currently running.
	 *
	 * @returns True if the periodic check loop is active
	 */
	isRunning(): boolean {
		return this.checkTimer !== null;
	}

	/**
	 * Start monitoring a specific session for context window usage.
	 *
	 * Subscribes to the session's PTY onData events and parses output
	 * for context usage percentages.
	 *
	 * @param sessionName - PTY session name
	 * @param memberId - Team member ID
	 * @param teamId - Team ID
	 * @param role - Agent role
	 */
	startSessionMonitoring(
		sessionName: string,
		memberId: string,
		teamId: string,
		role: string
	): void {
		// Stop any existing monitoring for this session
		if (this.sessionSubscriptions.has(sessionName)) {
			this.stopSessionMonitoring(sessionName);
		}

		const backend = this.sessionBackend || getSessionBackendSync();
		if (!backend) {
			this.logger.warn('Cannot start context monitoring: session backend not available', { sessionName });
			return;
		}

		const session = backend.getSession(sessionName);
		if (!session) {
			this.logger.warn('Cannot start context monitoring: session not found', { sessionName });
			return;
		}

		// Initialize state
		const state: ContextWindowState = {
			sessionName,
			memberId,
			teamId,
			role,
			contextPercent: 0,
			level: 'normal',
			lastDetectedAt: Date.now(),
			recoveryTriggered: false,
			recoveryCount: 0,
			recoveryTimestamps: [],
		};
		this.contextStates.set(sessionName, state);

		// Subscribe to PTY data
		const unsubscribe = session.onData((data: string) => {
			this.handleData(sessionName, data);
		});

		this.sessionSubscriptions.set(sessionName, {
			unsubscribe,
			buffer: '',
		});

		this.logger.info('Started context window monitoring', {
			sessionName,
			memberId,
			teamId,
			role,
		});
	}

	/**
	 * Stop monitoring a specific session.
	 *
	 * @param sessionName - PTY session name
	 */
	stopSessionMonitoring(sessionName: string): void {
		const sub = this.sessionSubscriptions.get(sessionName);
		if (sub) {
			sub.unsubscribe();
			this.sessionSubscriptions.delete(sessionName);
		}
		this.contextStates.delete(sessionName);

		this.logger.debug('Stopped context window monitoring', { sessionName });
	}

	/**
	 * Get the context window state for a specific session.
	 *
	 * @param sessionName - PTY session name
	 * @returns The context window state or undefined if not monitored
	 */
	getContextState(sessionName: string): ContextWindowState | undefined {
		return this.contextStates.get(sessionName);
	}

	/**
	 * Get all monitored context window states.
	 *
	 * @returns Map of session name to context window state
	 */
	getAllContextStates(): Map<string, ContextWindowState> {
		return new Map(this.contextStates);
	}

	/**
	 * Handle incoming PTY data for a monitored session.
	 * Strips ANSI codes, appends to rolling buffer, and checks for context % patterns.
	 *
	 * @param sessionName - PTY session name
	 * @param data - Raw PTY output data
	 */
	private handleData(sessionName: string, data: string): void {
		const sub = this.sessionSubscriptions.get(sessionName);
		const state = this.contextStates.get(sessionName);
		if (!sub || !state) {
			return;
		}

		// Strip ANSI and append to rolling buffer
		const clean = stripAnsiCodes(data);
		sub.buffer += clean;

		// Cap buffer size
		if (sub.buffer.length > CONTEXT_WINDOW_MONITOR_CONSTANTS.MAX_BUFFER_SIZE) {
			sub.buffer = sub.buffer.slice(-CONTEXT_WINDOW_MONITOR_CONSTANTS.MAX_BUFFER_SIZE);
		}

		// Try to extract context percentage from buffer
		const percent = this.extractContextPercent(sub.buffer);
		if (percent !== null) {
			this.updateContextUsage(sessionName, percent);
			// Clear buffer after successful extraction to avoid re-matching
			sub.buffer = '';
		}
	}

	/**
	 * Extract context usage percentage from terminal output.
	 *
	 * @param text - Cleaned terminal output text
	 * @returns The extracted percentage (0-100) or null if not found
	 */
	private extractContextPercent(text: string): number | null {
		for (const pattern of CONTEXT_PERCENT_PATTERNS) {
			const match = pattern.exec(text);
			if (match) {
				const percent = parseInt(match[1], 10);
				if (percent >= 0 && percent <= 100) {
					return percent;
				}
			}
		}
		return null;
	}

	/**
	 * Update context usage for a session and evaluate thresholds.
	 *
	 * @param sessionName - PTY session name
	 * @param percent - New context usage percentage
	 */
	updateContextUsage(sessionName: string, percent: number): void {
		const state = this.contextStates.get(sessionName);
		if (!state) {
			return;
		}

		const previousLevel = state.level;
		state.contextPercent = percent;
		state.lastDetectedAt = Date.now();

		// Determine new level
		if (percent >= CONTEXT_WINDOW_MONITOR_CONSTANTS.CRITICAL_THRESHOLD_PERCENT) {
			state.level = 'critical';
		} else if (percent >= CONTEXT_WINDOW_MONITOR_CONSTANTS.RED_THRESHOLD_PERCENT) {
			state.level = 'red';
		} else if (percent >= CONTEXT_WINDOW_MONITOR_CONSTANTS.YELLOW_THRESHOLD_PERCENT) {
			state.level = 'yellow';
		} else {
			state.level = 'normal';
		}

		// Only fire events on level transitions (not repeated at same level)
		if (state.level !== previousLevel && state.level !== 'normal') {
			this.evaluateThresholds(state, previousLevel);
		}
	}

	/**
	 * Evaluate threshold transitions and take appropriate actions.
	 * Fires events and triggers auto-recovery at critical level.
	 *
	 * @param state - Current context window state
	 * @param previousLevel - The level before this update
	 */
	private evaluateThresholds(state: ContextWindowState, previousLevel: ContextLevel): void {
		this.logger.warn('Context window threshold crossed', {
			sessionName: state.sessionName,
			previousLevel,
			newLevel: state.level,
			contextPercent: state.contextPercent,
		});

		// Publish event for warning levels
		if (state.level === 'yellow' || state.level === 'red') {
			this.publishContextEvent(state, 'agent:context_warning');
		}

		// Publish event and trigger recovery for critical level
		if (state.level === 'critical') {
			this.publishContextEvent(state, 'agent:context_critical');

			if (
				CONTEXT_WINDOW_MONITOR_CONSTANTS.AUTO_RECOVERY_ENABLED &&
				!state.recoveryTriggered
			) {
				state.recoveryTriggered = true;
				this.triggerAutoRecovery(state).catch((err) => {
					this.logger.error('Auto-recovery failed', {
						sessionName: state.sessionName,
						error: err instanceof Error ? err.message : String(err),
					});
				});
			}
		}

		// Broadcast to frontend
		this.broadcastContextWarning(state);
	}

	/**
	 * Publish a context event via the event bus.
	 *
	 * @param state - Context window state
	 * @param eventType - Event type to publish
	 */
	private publishContextEvent(state: ContextWindowState, eventType: EventType): void {
		if (!this.eventBusService) {
			return;
		}

		const event: AgentEvent = {
			id: uuidv4(),
			type: eventType,
			timestamp: new Date().toISOString(),
			teamId: state.teamId,
			teamName: '',
			memberId: state.memberId,
			memberName: '',
			sessionName: state.sessionName,
			previousValue: String(state.contextPercent),
			newValue: state.level,
			changedField: 'contextUsage',
		};

		this.eventBusService.publish(event);

		this.logger.info('Published context event', {
			eventType,
			sessionName: state.sessionName,
			contextPercent: state.contextPercent,
			level: state.level,
		});
	}

	/**
	 * Broadcast context window status to frontend via WebSocket.
	 *
	 * @param state - Context window state to broadcast
	 */
	private broadcastContextWarning(state: ContextWindowState): void {
		const terminalGateway = getTerminalGateway();
		if (!terminalGateway) {
			return;
		}

		terminalGateway.broadcastContextWindowStatus({
			sessionName: state.sessionName,
			memberId: state.memberId,
			teamId: state.teamId,
			contextPercent: state.contextPercent,
			level: state.level,
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Trigger auto-recovery for a session at critical context usage.
	 *
	 * Mirrors the restart pattern from AgentHeartbeatMonitorService:
	 * 1. Check cooldown
	 * 2. Save Claude session ID
	 * 3. Stop exit monitoring
	 * 4. Kill PTY session
	 * 5. Clear activity tracker
	 * 6. Pre-set session ID for resume
	 * 7. Recreate agent session
	 * 8. Broadcast status
	 * 9. Re-deliver tasks
	 *
	 * @param state - Context window state for the session to recover
	 */
	private async triggerAutoRecovery(state: ContextWindowState): Promise<void> {
		const backend = this.sessionBackend || getSessionBackendSync();
		if (!backend || !this.agentRegistrationService) {
			this.logger.warn('Cannot trigger auto-recovery: missing dependencies', {
				sessionName: state.sessionName,
			});
			return;
		}

		// Check cooldown
		const now = Date.now();
		const windowStart = now - CONTEXT_WINDOW_MONITOR_CONSTANTS.COOLDOWN_WINDOW_MS;
		state.recoveryTimestamps = state.recoveryTimestamps.filter(ts => ts > windowStart);

		if (state.recoveryTimestamps.length >= CONTEXT_WINDOW_MONITOR_CONSTANTS.MAX_RECOVERIES_PER_WINDOW) {
			this.logger.warn('Context recovery cooldown active, skipping', {
				sessionName: state.sessionName,
				recoveriesInWindow: state.recoveryTimestamps.length,
				maxPerWindow: CONTEXT_WINDOW_MONITOR_CONSTANTS.MAX_RECOVERIES_PER_WINDOW,
			});
			return;
		}

		this.logger.info('Triggering context window auto-recovery', {
			sessionName: state.sessionName,
			contextPercent: state.contextPercent,
			recoveryCount: state.recoveryCount,
		});

		try {
			// Save Claude session ID before killing
			let claudeSessionId: string | undefined;
			try {
				const persistence = getSessionStatePersistence();
				claudeSessionId = persistence.getSessionId(state.sessionName);
			} catch {
				this.logger.warn('Could not retrieve Claude session ID for recovery', {
					sessionName: state.sessionName,
				});
			}

			// Stop exit monitoring to avoid triggering exit callbacks
			RuntimeExitMonitorService.getInstance().stopMonitoring(state.sessionName);

			// Stop our own monitoring (will be re-started after session creation)
			this.stopSessionMonitoring(state.sessionName);

			// Kill old PTY session
			if (backend.sessionExists(state.sessionName)) {
				await backend.killSession(state.sessionName);
			}

			// Clear PTY activity tracker
			PtyActivityTrackerService.getInstance().clearSession(state.sessionName);

			// Pre-set session ID for resume
			if (claudeSessionId) {
				try {
					const persistence = getSessionStatePersistence();
					const metadata = persistence.getSessionMetadata(state.sessionName);
					if (metadata) {
						persistence.updateSessionId(state.sessionName, claudeSessionId);
					}
				} catch {
					this.logger.warn('Could not pre-set session ID for resume', {
						sessionName: state.sessionName,
					});
				}
			}

			// Recreate agent session
			const result = await this.agentRegistrationService.createAgentSession({
				sessionName: state.sessionName,
				role: state.role,
				teamId: state.teamId,
				memberId: state.memberId,
			});

			if (!result.success) {
				this.logger.error('Context recovery createAgentSession failed', {
					sessionName: state.sessionName,
					error: result.error,
				});
				return;
			}

			// Track recovery
			state.recoveryTimestamps.push(now);
			state.recoveryCount++;

			// Broadcast agent recovered status
			const terminalGateway = getTerminalGateway();
			if (terminalGateway) {
				terminalGateway.broadcastTeamMemberStatus({
					teamId: state.teamId,
					memberId: state.memberId,
					sessionName: state.sessionName,
					agentStatus: 'active',
				});
			}

			this.logger.info('Context window auto-recovery successful', {
				sessionName: state.sessionName,
				recoveryCount: state.recoveryCount,
				claudeSessionId: claudeSessionId ? '(resumed)' : '(fresh)',
			});

			// Re-deliver in-progress tasks (async, non-blocking)
			this.redeliverTasks(state).catch((err) => {
				this.logger.error('Task re-delivery failed after context recovery', {
					sessionName: state.sessionName,
					error: err instanceof Error ? err.message : String(err),
				});
			});
		} catch (err) {
			this.logger.error('Failed to perform context window auto-recovery', {
				sessionName: state.sessionName,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	/**
	 * Re-deliver in-progress tasks to a recovered agent.
	 *
	 * @param state - Context window state for the recovered session
	 */
	private async redeliverTasks(state: ContextWindowState): Promise<void> {
		if (!this.taskTrackingService) {
			return;
		}

		const backend = this.sessionBackend || getSessionBackendSync();
		if (!backend) {
			return;
		}

		// Wait for agent initialization
		await new Promise(resolve => setTimeout(resolve, AGENT_SUSPEND_CONSTANTS.REHYDRATION_TIMEOUT_MS));

		if (!backend.sessionExists(state.sessionName)) {
			this.logger.warn('Agent session not found after recovery, skipping task re-delivery', {
				sessionName: state.sessionName,
			});
			return;
		}

		const session = backend.getSession(state.sessionName);
		if (!session) {
			return;
		}

		const tasks = await this.taskTrackingService.getTasksForTeamMember(state.memberId);
		const activeTasks = tasks.filter(t => t.status === 'assigned' || t.status === 'active');

		if (activeTasks.length === 0) {
			this.logger.debug('No active tasks to re-deliver after context recovery', {
				sessionName: state.sessionName,
			});
			return;
		}

		this.logger.info('Re-delivering tasks after context recovery', {
			sessionName: state.sessionName,
			taskCount: activeTasks.length,
		});

		for (const task of activeTasks) {
			let taskContent = '';
			try {
				taskContent = await fs.readFile(task.taskFilePath, 'utf-8');
				if (taskContent.length > 2000) {
					taskContent = taskContent.slice(0, 2000) + '\n... (truncated)';
				}
			} catch {
				taskContent = '(task file not found)';
			}

			const message = [
				'[TASK RE-DELIVERY] Your previous session ran out of context window.',
				'You were working on this task before your session was recovered:',
				`Task: ${task.taskName}`,
				`File: ${task.taskFilePath}`,
				'---',
				taskContent,
				'---',
				'Please continue working on this task.',
			].join('\n');

			session.write(message);

			const pasteDelay = Math.min(
				SESSION_COMMAND_DELAYS.MESSAGE_DELAY + Math.ceil(message.length / 10),
				5000
			);
			await new Promise(resolve => setTimeout(resolve, pasteDelay));
			session.write('\r');

			await new Promise(resolve => setTimeout(resolve, 2000));
		}

		this.logger.info('Task re-delivery after context recovery complete', {
			sessionName: state.sessionName,
			tasksDelivered: activeTasks.length,
		});
	}

	/**
	 * Periodic check for stale states and cleanup.
	 * Removes states for sessions that haven't reported context usage recently.
	 */
	private performCheck(): void {
		const now = Date.now();
		const staleThreshold = CONTEXT_WINDOW_MONITOR_CONSTANTS.STALE_DETECTION_THRESHOLD_MS;

		for (const [sessionName, state] of this.contextStates) {
			const timeSinceLastDetection = now - state.lastDetectedAt;

			// Clean up stale states (no context % detected for a while)
			if (timeSinceLastDetection > staleThreshold && state.level !== 'normal') {
				this.logger.debug('Context state stale, resetting to normal', {
					sessionName,
					timeSinceLastDetectionMs: timeSinceLastDetection,
				});
				state.level = 'normal';
				state.recoveryTriggered = false;
			}
		}
	}

	/**
	 * Destroy all PTY subscriptions. Used during resetInstance.
	 */
	private destroyAllSubscriptions(): void {
		for (const [sessionName, sub] of this.sessionSubscriptions) {
			sub.unsubscribe();
		}
		this.sessionSubscriptions.clear();
		this.contextStates.clear();
	}
}
