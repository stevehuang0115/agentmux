import * as fs from 'fs/promises';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import { StorageService } from '../core/storage.service.js';
import {
	SessionCommandHelper,
	getSessionBackendSync,
	createSessionCommandHelper,
	type ISessionBackend,
} from '../session/index.js';
import { getSessionStatePersistence } from '../session/session-state-persistence.js';
import { RuntimeServiceFactory } from './runtime-service.factory.js';
import { SessionMemoryService } from '../memory/session-memory.service.js';
import { getTerminalGateway } from '../../websocket/terminal.gateway.js';
import { SHELL_PROMPT_PATTERNS } from '../continuation/patterns/idle-patterns.js';
import { PtyActivityTrackerService } from './pty-activity-tracker.service.js';
import { TaskTrackingService } from '../project/task-tracking.service.js';
import type { AgentRegistrationService } from './agent-registration.service.js';
import type { InProgressTask } from '../../types/task-tracking.types.js';
import {
	CREWLY_CONSTANTS,
	ORCHESTRATOR_SESSION_NAME,
	ORCHESTRATOR_ROLE,
	RUNTIME_EXIT_CONSTANTS,
	AGENT_SUSPEND_CONSTANTS,
	SESSION_COMMAND_DELAYS,
	type RuntimeType,
} from '../../constants.js';

/**
 * Internal state tracked per monitored session.
 */
interface MonitoredSession {
	sessionName: string;
	runtimeType: RuntimeType;
	role: string;
	memberId?: string;
	teamId?: string;
	unsubscribe: () => void;
	buffer: string;
	startedAt: number;
	exitDetected: boolean;
	debounceTimer?: ReturnType<typeof setTimeout>;
	/** Interval handle for periodic process-alive polling */
	processPollingInterval?: ReturnType<typeof setInterval>;
}

/**
 * Service that monitors PTY sessions for runtime exit patterns.
 *
 * When an agent CLI (Claude Code, Gemini CLI, Codex CLI) exits inside a PTY
 * session, the PTY shell itself stays alive. This service watches terminal
 * output for runtime-specific exit patterns and reacts by:
 *
 * 1. Updating the agent status to `inactive`
 * 2. Capturing session memory
 * 3. Broadcasting WebSocket events to the frontend
 * 4. Cancelling pending registration operations
 *
 * @example
 * ```typescript
 * const monitor = RuntimeExitMonitorService.getInstance();
 * monitor.startMonitoring('agent-dev-001', 'claude-code', 'developer');
 * // ... later ...
 * monitor.stopMonitoring('agent-dev-001');
 * ```
 */
export class RuntimeExitMonitorService {
	private static instance: RuntimeExitMonitorService | null = null;
	private logger: ComponentLogger;
	private sessions = new Map<string, MonitoredSession>();
	private onExitDetectedCallback?: (sessionName: string) => void;
	private agentRegistrationService: AgentRegistrationService | null = null;
	private taskTrackingService: TaskTrackingService | null = null;

	private constructor() {
		this.logger = LoggerService.getInstance().createComponentLogger('RuntimeExitMonitorService');
	}

	/**
	 * Get the singleton instance.
	 */
	static getInstance(): RuntimeExitMonitorService {
		if (!RuntimeExitMonitorService.instance) {
			RuntimeExitMonitorService.instance = new RuntimeExitMonitorService();
		}
		return RuntimeExitMonitorService.instance;
	}

	/**
	 * Reset the singleton (for testing).
	 */
	static resetInstance(): void {
		if (RuntimeExitMonitorService.instance) {
			RuntimeExitMonitorService.instance.destroy();
		}
		RuntimeExitMonitorService.instance = null;
	}

	/**
	 * Register a callback invoked when a runtime exit is detected.
	 * Used by AgentRegistrationService to cancel pending registrations.
	 *
	 * @param callback - Called with the sessionName on exit detection
	 */
	setOnExitDetectedCallback(callback: (sessionName: string) => void): void {
		this.onExitDetectedCallback = callback;
	}

	/**
	 * Set the AgentRegistrationService dependency for agent restart.
	 *
	 * @param service - The AgentRegistrationService instance
	 */
	setAgentRegistrationService(service: AgentRegistrationService): void {
		this.agentRegistrationService = service;
	}

	/**
	 * Set the TaskTrackingService dependency for in-progress task queries.
	 *
	 * @param service - The TaskTrackingService instance
	 */
	setTaskTrackingService(service: TaskTrackingService): void {
		this.taskTrackingService = service;
	}

	/**
	 * Start monitoring a PTY session for runtime exit patterns.
	 *
	 * @param sessionName - PTY session name
	 * @param runtimeType - Agent runtime type (claude-code, gemini-cli, codex-cli)
	 * @param role - Agent role name
	 * @param teamId - Optional team identifier
	 * @param memberId - Optional member identifier
	 */
	startMonitoring(
		sessionName: string,
		runtimeType: RuntimeType,
		role: string,
		teamId?: string,
		memberId?: string
	): void {
		// Stop any existing monitoring for this session
		if (this.sessions.has(sessionName)) {
			this.stopMonitoring(sessionName);
		}

		const backend = getSessionBackendSync();
		if (!backend) {
			this.logger.warn('Cannot start monitoring: session backend not initialized', { sessionName });
			return;
		}

		const helper = createSessionCommandHelper(backend);
		const session = helper.getSession(sessionName);
		if (!session) {
			this.logger.warn('Cannot start monitoring: session not found', { sessionName });
			return;
		}

		const monitored: MonitoredSession = {
			sessionName,
			runtimeType,
			role,
			memberId,
			teamId,
			buffer: '',
			startedAt: Date.now(),
			exitDetected: false,
			unsubscribe: () => {},
		};

		// Get exit patterns for this runtime type
		let exitPatterns: RegExp[];
		try {
			const runtimeService = RuntimeServiceFactory.create(runtimeType, null, process.cwd());
			exitPatterns = runtimeService.getExitPatterns();
		} catch {
			this.logger.warn('Failed to get exit patterns, using empty set', { sessionName, runtimeType });
			exitPatterns = [];
		}

		if (exitPatterns.length === 0) {
			this.logger.debug('No exit patterns for runtime, skipping monitoring', { sessionName, runtimeType });
			return;
		}

		// Subscribe to PTY output
		const unsubscribe = session.onData((data: string) => {
			this.handleData(sessionName, data, exitPatterns, helper);
		});

		monitored.unsubscribe = unsubscribe;

		// Start periodic process-alive polling as a fallback.
		// This catches exits that don't produce recognizable text patterns
		// (e.g. context window exhaustion, SIGKILL, unexpected crashes).
		monitored.processPollingInterval = setInterval(() => {
			this.checkProcessAlive(sessionName, backend, helper);
		}, RUNTIME_EXIT_CONSTANTS.PROCESS_POLL_INTERVAL_MS);

		this.sessions.set(sessionName, monitored);

		this.logger.info('Started runtime exit monitoring', {
			sessionName,
			runtimeType,
			role,
			patternCount: exitPatterns.length,
		});
	}

	/**
	 * Stop monitoring a PTY session.
	 *
	 * @param sessionName - PTY session name
	 */
	stopMonitoring(sessionName: string): void {
		const monitored = this.sessions.get(sessionName);
		if (!monitored) {
			return;
		}

		if (monitored.debounceTimer) {
			clearTimeout(monitored.debounceTimer);
		}
		if (monitored.processPollingInterval) {
			clearInterval(monitored.processPollingInterval);
		}

		monitored.unsubscribe();
		this.sessions.delete(sessionName);

		this.logger.debug('Stopped runtime exit monitoring', { sessionName });
	}

	/**
	 * Check if a session is being monitored.
	 */
	isMonitoring(sessionName: string): boolean {
		return this.sessions.has(sessionName);
	}

	/**
	 * Destroy all monitoring subscriptions.
	 */
	destroy(): void {
		for (const [sessionName] of this.sessions) {
			this.stopMonitoring(sessionName);
		}
		this.logger.debug('All runtime exit monitors destroyed');
	}

	/**
	 * Handle incoming PTY data for a monitored session.
	 */
	private handleData(
		sessionName: string,
		data: string,
		exitPatterns: RegExp[],
		helper: SessionCommandHelper
	): void {
		const monitored = this.sessions.get(sessionName);
		if (!monitored || monitored.exitDetected) {
			return;
		}

		// Append to rolling buffer, cap at MAX_BUFFER_SIZE
		monitored.buffer += data;
		if (monitored.buffer.length > RUNTIME_EXIT_CONSTANTS.MAX_BUFFER_SIZE) {
			monitored.buffer = monitored.buffer.slice(-RUNTIME_EXIT_CONSTANTS.MAX_BUFFER_SIZE);
		}

		// Skip pattern matching during startup grace period
		if (Date.now() - monitored.startedAt < RUNTIME_EXIT_CONSTANTS.STARTUP_GRACE_PERIOD_MS) {
			return;
		}

		// Test buffer against exit patterns
		const matched = exitPatterns.some((pattern) => pattern.test(monitored.buffer));
		if (!matched) {
			return;
		}

		// Pattern matched — start debounce timer to confirm
		if (monitored.debounceTimer) {
			clearTimeout(monitored.debounceTimer);
		}

		monitored.debounceTimer = setTimeout(() => {
			this.confirmAndReact(sessionName, helper);
		}, RUNTIME_EXIT_CONSTANTS.CONFIRMATION_DELAY_MS);
	}

	/**
	 * Confirm exit by checking for a shell prompt, then react.
	 */
	private async confirmAndReact(
		sessionName: string,
		helper: SessionCommandHelper
	): Promise<void> {
		const monitored = this.sessions.get(sessionName);
		if (!monitored || monitored.exitDetected) {
			return;
		}

		// Verify shell prompt is visible (avoids false positives)
		if (!this.verifyExitWithShellPrompt(sessionName, helper)) {
			this.logger.debug('Exit pattern matched but shell prompt not confirmed, ignoring', { sessionName });
			return;
		}

		// Mark as detected to prevent double-processing
		monitored.exitDetected = true;

		this.logger.info('Runtime exit detected and confirmed', {
			sessionName,
			runtimeType: monitored.runtimeType,
			role: monitored.role,
		});

		// Fire the exit-detected callback (used to cancel pending registrations)
		if (this.onExitDetectedCallback) {
			try {
				this.onExitDetectedCallback(sessionName);
			} catch (error) {
				this.logger.warn('onExitDetected callback error', {
					sessionName,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		// Check for in-progress tasks — restart agent if any exist (non-orchestrator only)
		if (monitored.role !== ORCHESTRATOR_ROLE && this.agentRegistrationService && this.taskTrackingService) {
			try {
				const tasks = await this.taskTrackingService.getTasksForTeamMember(monitored.memberId || '');
				const activeTasks = tasks.filter(t => t.status === 'assigned' || t.status === 'active');

				if (activeTasks.length > 0) {
					this.logger.info('Runtime exit with in-progress tasks, attempting restart', {
						sessionName,
						activeTaskCount: activeTasks.length,
					});

					try {
						await this.restartAgentWithTasks(sessionName, monitored, activeTasks);
						// Cleanup this subscription (restart succeeded, skip inactive flow)
						this.stopMonitoring(sessionName);
						return;
					} catch (restartError) {
						this.logger.warn('Agent restart after runtime exit failed, falling back to inactive', {
							sessionName,
							error: restartError instanceof Error ? restartError.message : String(restartError),
						});
						// Fall through to normal inactive flow
					}
				}
			} catch (error) {
				this.logger.warn('Failed to check in-progress tasks after runtime exit', {
					sessionName,
					error: error instanceof Error ? error.message : String(error),
				});
				// Fall through to normal inactive flow
			}
		}

		// Update agent status to inactive
		try {
			const storageService = StorageService.getInstance();
			await storageService.updateAgentStatus(
				sessionName,
				CREWLY_CONSTANTS.AGENT_STATUSES.INACTIVE
			);
			this.logger.info('Agent status updated to inactive after runtime exit', { sessionName });
		} catch (error) {
			this.logger.warn('Failed to update agent status after runtime exit', {
				sessionName,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		// Capture session memory
		try {
			const sessionMemoryService = SessionMemoryService.getInstance();
			await sessionMemoryService.onSessionEnd(sessionName, monitored.role, process.cwd());
		} catch (error) {
			this.logger.warn('Failed to capture session memory after runtime exit', {
				sessionName,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		// Broadcast WebSocket event
		try {
			const terminalGateway = getTerminalGateway();
			if (terminalGateway) {
				const statusPayload = {
					sessionName,
					agentStatus: CREWLY_CONSTANTS.AGENT_STATUSES.INACTIVE,
					reason: 'runtime_exited',
				};

				if (sessionName === ORCHESTRATOR_SESSION_NAME) {
					terminalGateway.broadcastOrchestratorStatus(statusPayload);
				} else {
					terminalGateway.broadcastTeamMemberStatus(statusPayload);
				}
			}
		} catch (error) {
			this.logger.warn('Failed to broadcast runtime exit event', {
				sessionName,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		// Cleanup this subscription
		this.stopMonitoring(sessionName);
	}

	/**
	 * Restart an agent that exited while it had in-progress tasks.
	 *
	 * Mirrors the restart pattern from AgentHeartbeatMonitorService:
	 * 1. Save Claude session ID for resume
	 * 2. Kill old PTY session + clear PTY activity tracker
	 * 3. Pre-set session ID for resume
	 * 4. Recreate agent session via AgentRegistrationService
	 * 5. Broadcast restarted status via WebSocket
	 * 6. Re-deliver tasks asynchronously
	 *
	 * @param sessionName - PTY session name
	 * @param monitored - Monitored session state
	 * @param activeTasks - In-progress tasks to re-deliver
	 */
	private async restartAgentWithTasks(
		sessionName: string,
		monitored: MonitoredSession,
		activeTasks: InProgressTask[]
	): Promise<void> {
		const backend = getSessionBackendSync();
		if (!backend || !this.agentRegistrationService) {
			throw new Error('Missing dependencies for agent restart');
		}

		// Save Claude session ID before killing
		let claudeSessionId: string | undefined;
		try {
			const persistence = getSessionStatePersistence();
			claudeSessionId = persistence.getSessionId(sessionName);
		} catch {
			this.logger.warn('Could not retrieve Claude session ID for restart', { sessionName });
		}

		// Kill old PTY session
		if (backend.sessionExists(sessionName)) {
			await backend.killSession(sessionName);
		}

		// Clear PTY activity tracker
		PtyActivityTrackerService.getInstance().clearSession(sessionName);

		// Pre-set session ID for resume
		if (claudeSessionId) {
			try {
				const persistence = getSessionStatePersistence();
				const metadata = persistence.getSessionMetadata(sessionName);
				if (metadata) {
					persistence.updateSessionId(sessionName, claudeSessionId);
				}
			} catch {
				this.logger.warn('Could not pre-set session ID for resume', { sessionName });
			}
		}

		// Recreate agent session
		const result = await this.agentRegistrationService.createAgentSession({
			sessionName,
			role: monitored.role,
			teamId: monitored.teamId,
			memberId: monitored.memberId,
		});

		if (!result.success) {
			throw new Error(result.error || 'createAgentSession failed');
		}

		// Broadcast agent restarted event
		const terminalGateway = getTerminalGateway();
		if (terminalGateway) {
			terminalGateway.broadcastTeamMemberStatus({
				teamId: monitored.teamId,
				memberId: monitored.memberId,
				sessionName,
				agentStatus: 'active',
			});
		}

		this.logger.info('Agent restarted after runtime exit with in-progress tasks', {
			sessionName,
			activeTaskCount: activeTasks.length,
			claudeSessionId: claudeSessionId ? '(resumed)' : '(fresh)',
		});

		// Re-deliver in-progress tasks (async, non-blocking)
		this.redeliverTasks(sessionName, activeTasks).catch((err) => {
			this.logger.error('Task re-delivery failed after runtime exit restart', {
				sessionName,
				error: err instanceof Error ? err.message : String(err),
			});
		});
	}

	/**
	 * Re-deliver in-progress tasks to a restarted agent.
	 *
	 * Waits for the agent to initialize, reads task files, and writes
	 * summaries into the agent's PTY session.
	 *
	 * @param sessionName - PTY session name
	 * @param activeTasks - Tasks to re-deliver
	 */
	private async redeliverTasks(
		sessionName: string,
		activeTasks: InProgressTask[]
	): Promise<void> {
		// Wait for agent initialization
		await new Promise(resolve => setTimeout(resolve, AGENT_SUSPEND_CONSTANTS.REHYDRATION_TIMEOUT_MS));

		const backend = getSessionBackendSync();
		if (!backend || !backend.sessionExists(sessionName)) {
			this.logger.warn('Agent session not found after restart, skipping task re-delivery', { sessionName });
			return;
		}

		const session = backend.getSession(sessionName);
		if (!session) {
			return;
		}

		this.logger.info('Re-delivering tasks to restarted agent', {
			sessionName,
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
				'[TASK RE-DELIVERY] You were working on this task before your session was restarted:',
				`Task: ${task.taskName}`,
				`File: ${task.taskFilePath}`,
				'---',
				taskContent,
				'---',
				'Please continue working on this task.',
			].join('\n');

			// Write message and Enter as separate writes so that Enter is not
			// swallowed by the terminal's bracketed paste mode.
			session.write(message);

			// Delay to let the terminal finish processing the paste, then send Enter
			const pasteDelay = Math.min(
				SESSION_COMMAND_DELAYS.MESSAGE_DELAY + Math.ceil(message.length / 10),
				5000
			);
			await new Promise(resolve => setTimeout(resolve, pasteDelay));
			session.write('\r');

			// Delay between tasks to avoid flooding
			await new Promise(resolve => setTimeout(resolve, 2000));
		}

		this.logger.info('Task re-delivery complete', {
			sessionName,
			tasksDelivered: activeTasks.length,
		});
	}

	/**
	 * Periodic check: is the runtime child process still alive?
	 *
	 * Uses the session backend's isChildProcessAlive() (pgrep -P <pid>)
	 * to determine if the CLI process has exited. This is a version-agnostic
	 * fallback that doesn't depend on any text the CLI prints.
	 *
	 * @param sessionName - PTY session name
	 * @param backend - Session backend for process checks
	 * @param helper - Session command helper for shell prompt verification
	 */
	private checkProcessAlive(
		sessionName: string,
		backend: ISessionBackend,
		helper: SessionCommandHelper
	): void {
		const monitored = this.sessions.get(sessionName);
		if (!monitored || monitored.exitDetected) {
			return;
		}

		// Skip during startup grace period (CLI may not have spawned yet)
		if (Date.now() - monitored.startedAt < RUNTIME_EXIT_CONSTANTS.PROCESS_POLL_GRACE_PERIOD_MS) {
			return;
		}

		// Check if the backend supports process-alive checks
		if (!backend.isChildProcessAlive) {
			return;
		}

		const isAlive = backend.isChildProcessAlive(sessionName);
		if (isAlive) {
			return;
		}

		// Process is not alive — verify with shell prompt before confirming
		if (!this.verifyExitWithShellPrompt(sessionName, helper)) {
			this.logger.debug('Process not alive but shell prompt not confirmed, skipping', { sessionName });
			return;
		}

		this.logger.info('Runtime exit detected via process check (no child process)', {
			sessionName,
			runtimeType: monitored.runtimeType,
		});

		// Trigger the same exit flow as pattern-based detection
		this.confirmAndReact(sessionName, helper);
	}

	/**
	 * Verify that a shell prompt is visible in the terminal, confirming
	 * that the agent CLI has actually exited and returned to the shell.
	 */
	private verifyExitWithShellPrompt(sessionName: string, helper: SessionCommandHelper): boolean {
		try {
			const output = helper.capturePane(sessionName);
			return SHELL_PROMPT_PATTERNS.some((pattern) => pattern.test(output));
		} catch {
			return false;
		}
	}
}
