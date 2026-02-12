import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import { StorageService } from '../core/storage.service.js';
import {
	SessionCommandHelper,
	getSessionBackendSync,
	createSessionCommandHelper,
} from '../session/index.js';
import { RuntimeServiceFactory } from './runtime-service.factory.js';
import { SessionMemoryService } from '../memory/session-memory.service.js';
import { getTerminalGateway } from '../../websocket/terminal.gateway.js';
import { SHELL_PROMPT_PATTERNS } from '../continuation/patterns/idle-patterns.js';
import {
	AGENTMUX_CONSTANTS,
	ORCHESTRATOR_SESSION_NAME,
	RUNTIME_EXIT_CONSTANTS,
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

		// Update agent status to inactive
		try {
			const storageService = StorageService.getInstance();
			await storageService.updateAgentStatus(
				sessionName,
				AGENTMUX_CONSTANTS.AGENT_STATUSES.INACTIVE
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
					status: AGENTMUX_CONSTANTS.AGENT_STATUSES.INACTIVE,
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
