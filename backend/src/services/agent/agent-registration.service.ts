import * as path from 'path';
import * as os from 'os';
import { readFile, mkdir, writeFile } from 'fs/promises';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import {
	SessionCommandHelper,
	createSessionCommandHelper,
	getSessionBackendSync,
	createSessionBackend,
	getSessionStatePersistence,
} from '../session/index.js';
import { RuntimeAgentService } from './runtime-agent.service.abstract.js';
import { RuntimeServiceFactory } from './runtime-service.factory.js';
import { StorageService } from '../core/storage.service.js';
import {
	AGENTMUX_CONSTANTS,
	ENV_CONSTANTS,
	AGENT_TIMEOUTS,
	ORCHESTRATOR_ROLE,
	RUNTIME_TYPES,
	RuntimeType,
	SESSION_COMMAND_DELAYS,
	EVENT_DELIVERY_CONSTANTS,
	TERMINAL_PATTERNS,
	CLAUDE_RESUME_CONSTANTS,
	GEMINI_SHELL_MODE_CONSTANTS,
} from '../../constants.js';
import { WEB_CONSTANTS } from '../../../../config/constants.js';
import { delay } from '../../utils/async.utils.js';
import { SessionMemoryService } from '../memory/session-memory.service.js';
import { RuntimeExitMonitorService } from './runtime-exit-monitor.service.js';

export interface OrchestratorConfig {
	sessionName: string;
	projectPath: string;
	windowName?: string;
}

/**
 * Service responsible for the complex, multi-step process of agent initialization and registration.
 * Isolates the complex state management of agent startup with progressive escalation.
 *
 * Key capabilities:
 * - Agent session creation and management
 * - Runtime initialization and registration
 * - Reliable message delivery to Claude Code with retry logic
 * - Health checking and status management
 */
export class AgentRegistrationService {
	private logger: ComponentLogger;
	private _sessionHelper: SessionCommandHelper | null = null;
	private storageService: StorageService;
	private projectRoot: string;

	// Prompt file caching to eliminate file I/O contention during concurrent session creation
	private promptCache = new Map<string, string>();

	// AbortControllers for pending registration prompts (keyed by session name)
	private registrationAbortControllers = new Map<string, AbortController>();

	// Terminal patterns are now centralized in TERMINAL_PATTERNS constant
	// Keeping these as static getters for backwards compatibility within the class
	private static get CLAUDE_PROMPT_INDICATORS() {
		return TERMINAL_PATTERNS.PROMPT_CHARS;
	}

	private static get CLAUDE_PROMPT_STREAM_PATTERN() {
		return TERMINAL_PATTERNS.PROMPT_STREAM;
	}

	private static get CLAUDE_PROCESSING_INDICATORS() {
		return TERMINAL_PATTERNS.PROCESSING_INDICATORS;
	}

	constructor(
		_legacyTmuxService: unknown, // Legacy parameter for backwards compatibility
		projectRoot: string | null,
		storageService: StorageService
	) {
		this.logger = LoggerService.getInstance().createComponentLogger('AgentRegistrationService');
		this.storageService = storageService;
		this.projectRoot = projectRoot || this.findProjectRoot();

		// Wire up the exit monitor to cancel pending registrations on runtime exit
		RuntimeExitMonitorService.getInstance().setOnExitDetectedCallback(
			(sessionName: string) => this.cancelPendingRegistration(sessionName)
		);
	}

	/**
	 * Cancel a pending registration prompt for a session.
	 * Called by RuntimeExitMonitorService when a runtime exit is detected.
	 *
	 * @param sessionName - The session whose registration to cancel
	 */
	cancelPendingRegistration(sessionName: string): void {
		const controller = this.registrationAbortControllers.get(sessionName);
		if (controller) {
			controller.abort();
			this.registrationAbortControllers.delete(sessionName);
			this.logger.info('Cancelled pending registration', { sessionName });
		}
	}

	/**
	 * Get or create the session helper with lazy initialization
	 */
	private async getSessionHelper(): Promise<SessionCommandHelper> {
		this.logger.debug('Getting session helper', {
			hasExistingHelper: !!this._sessionHelper,
		});

		if (this._sessionHelper) {
			return this._sessionHelper;
		}

		let backend = getSessionBackendSync();
		this.logger.debug('Backend sync check', {
			hasBackend: !!backend,
		});

		if (!backend) {
			this.logger.info('Creating new PTY session backend');
			backend = await createSessionBackend('pty');
			this.logger.info('PTY session backend created', {
				hasBackend: !!backend,
			});
		}

		this._sessionHelper = createSessionCommandHelper(backend);
		this.logger.debug('Session helper created');
		return this._sessionHelper;
	}

	/**
	 * Get session helper synchronously (may throw if not initialized)
	 */
	private getSessionHelperSync(): SessionCommandHelper {
		if (!this._sessionHelper) {
			const backend = getSessionBackendSync();
			if (!backend) {
				throw new Error('Session backend not initialized');
			}
			this._sessionHelper = createSessionCommandHelper(backend);
		}
		return this._sessionHelper;
	}

	/**
	 * Find the project root by looking for package.json
	 */
	private findProjectRoot(): string {
		// Simple fallback - could be improved to walk up directories
		return process.cwd();
	}

	/**
	 * Resolve runtime flags from the agent's effective skills.
	 * Reads role config and skill configs to collect flags compatible with the runtime.
	 *
	 * @param role - The agent's role name
	 * @param runtimeType - The agent's runtime type (e.g. 'claude-code')
	 * @param skillOverrides - Additional skills assigned to the member
	 * @param excludedRoleSkills - Skills excluded from the role's default set
	 * @returns Array of CLI flags to inject (e.g. ['--chrome'])
	 */
	private async resolveRuntimeFlags(
		role: string,
		runtimeType: RuntimeType,
		skillOverrides?: string[],
		excludedRoleSkills?: string[]
	): Promise<string[]> {
		const flags = new Set<string>();
		try {
			// 1. Get role's assigned skills from config/roles/{role}/role.json
			const roleName = role.toLowerCase().replace(/\s+/g, '-');
			const rolePath = path.join(this.projectRoot, 'config', 'roles', roleName, 'role.json');
			const roleContent = await readFile(rolePath, 'utf8');
			const roleConfig = JSON.parse(roleContent);
			const roleSkills: string[] = roleConfig.assignedSkills || [];

			// 2. Apply skill overrides and exclusions
			const effectiveSkills = new Set([...roleSkills, ...(skillOverrides || [])]);
			for (const excluded of (excludedRoleSkills || [])) {
				effectiveSkills.delete(excluded);
			}

			// 3. For each skill, read skill.json and collect flags matching runtime
			for (const skillId of effectiveSkills) {
				try {
					const skillPath = path.join(this.projectRoot, 'config', 'skills', skillId, 'skill.json');
					const skillContent = await readFile(skillPath, 'utf8');
					const skillConfig = JSON.parse(skillContent);
					if (skillConfig.runtime?.runtime === runtimeType && Array.isArray(skillConfig.runtime?.flags)) {
						for (const flag of skillConfig.runtime.flags) {
							flags.add(flag);
						}
					}
				} catch {
					// Skill config not found — skip silently
				}
			}

			if (flags.size > 0) {
				this.logger.info('Resolved runtime flags from skills', {
					role, runtimeType, flags: Array.from(flags),
				});
			}
		} catch (error) {
			this.logger.debug('Could not resolve runtime flags (no role config or read error)', {
				role, runtimeType, error: error instanceof Error ? error.message : String(error),
			});
		}
		return Array.from(flags);
	}

	/**
	 * Create a runtime service instance for the given runtime type.
	 * Centralizes RuntimeServiceFactory creation to reduce code duplication.
	 */
	private createRuntimeService(runtimeType: RuntimeType): RuntimeAgentService {
		return RuntimeServiceFactory.create(runtimeType, null, this.projectRoot);
	}

	/**
	 * Get the check interval based on environment.
	 * Uses shorter intervals in test environment for faster tests.
	 */
	private getCheckInterval(): number {
		return process.env.NODE_ENV === 'test' ? 1000 : 2000;
	}

	/**
	 * Update agent status with safe error handling (non-blocking).
	 * Returns true if successful, false if failed.
	 */
	private async updateAgentStatusSafe(
		sessionName: string,
		status: (typeof AGENTMUX_CONSTANTS.AGENT_STATUSES)[keyof typeof AGENTMUX_CONSTANTS.AGENT_STATUSES],
		context?: { role?: string }
	): Promise<boolean> {
		try {
			await this.storageService.updateAgentStatus(sessionName, status);
			this.logger.info(`Agent status updated to ${status}`, { sessionName, ...context });
			return true;
		} catch (error) {
			this.logger.warn('Failed to update agent status (non-critical)', {
				sessionName,
				error: error instanceof Error ? error.message : String(error),
			});
			return false;
		}
	}

	/**
	 * Get prompt file path for a specific role
	 * Uses the unified config/roles/{role}/prompt.md structure
	 */
	private async getPromptFileForRole(role: string): Promise<string> {
		// Normalize role name to directory name format
		const roleName = role.toLowerCase().replace(/\s+/g, '-');
		return path.join(process.cwd(), 'config', 'roles', roleName, 'prompt.md');
	}

	/**
	 * Initialize agent with optimized 2-step escalation process
	 * Reduced from 4-step to 2-step with shorter timeouts for better concurrency
	 */
	async initializeAgentWithRegistration(
		sessionName: string,
		role: string,
		projectPath?: string,
		timeout: number = AGENT_TIMEOUTS.REGULAR_AGENT_INITIALIZATION,
		memberId?: string,
		runtimeType: RuntimeType = RUNTIME_TYPES.CLAUDE_CODE,
		runtimeFlags?: string[]
	): Promise<{
		success: boolean;
		message?: string;
		error?: string;
	}> {
		const startTime = Date.now();

		this.logger.info('Starting optimized agent initialization with registration', {
			sessionName,
			role,
			timeout,
			runtimeType,
		});

		// PHASE 4: agentStatus is now set immediately in API endpoints (startTeam/startTeamMember)
		// No longer need to set it here - focus only on session creation
		this.logger.info('Starting agent session initialization', { sessionName, role });

		// Clear detection cache to ensure fresh runtime detection
		const runtimeService = this.createRuntimeService(runtimeType);
		runtimeService.clearDetectionCache(sessionName);

		// Skip Step 1 (direct registration) as it often fails in concurrent scenarios
		// Go directly to Step 2: Cleanup + reinit (more reliable)
		try {
			this.logger.info('Step 1: Attempting cleanup and reinitialization', {
				sessionName,
			});
			const step1Success = await this.tryCleanupAndReinit(
				sessionName,
				role,
				40000, // 40 seconds for cleanup and reinit
				projectPath,
				memberId,
				runtimeType,
				runtimeFlags
			);
			if (step1Success) {
				return {
					success: true,
					message: 'Agent registered successfully after cleanup and reinit',
				};
			}
		} catch (error) {
			this.logger.warn('Step 1 (cleanup + reinit) failed', {
				sessionName,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		// Step 2: Full session recreation (30 seconds) - only if time remaining
		if (Date.now() - startTime < timeout - 35000) {
			try {
				this.logger.info('Step 2: Attempting full session recreation', { sessionName });
				const step2Success = await this.tryFullRecreation(
					sessionName,
					role,
					30000, // Reduced from 45000 to 30000
					projectPath,
					memberId,
					runtimeType,
					runtimeFlags
				);
				if (step2Success) {
					return {
						success: true,
						message: 'Agent registered successfully after full recreation',
					};
				}
			} catch (error) {
				this.logger.warn('Step 2 (full recreation) failed', {
					sessionName,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		// Give up after 2 steps
		const errorMsg = `Failed to initialize agent after optimized escalation attempts (${Math.round(
			(Date.now() - startTime) / 1000
		)}s)`;
		this.logger.error(errorMsg, { sessionName, role });
		return { success: false, error: errorMsg };
	}

	/**
	 * Step 1: Try direct registration prompt
	 * Assumes Claude is already running and just needs a registration prompt
	 */
	private async tryDirectRegistration(
		sessionName: string,
		role: string,
		timeout: number,
		memberId?: string,
		runtimeType: RuntimeType = RUNTIME_TYPES.CLAUDE_CODE
	): Promise<boolean> {
		// Clear any existing input. Claude already performs Ctrl+C cleanup during
		// runtime detection, so avoid sending additional Ctrl+C sequences.
		// Gemini CLI: Skip cleanup — Ctrl+C at an empty prompt triggers /quit.
		// Escape defocuses the TUI. Ctrl+U is ignored by the TUI.
		const helper = await this.getSessionHelper();

		// First check if runtime is running before sending the prompt
		// runtimeService2: Separate instance for pre-registration runtime detection
		// This instance is isolated from main runtimeService to avoid cache interference
		const runtimeService2 = this.createRuntimeService(runtimeType);
		const runtimeRunning = await runtimeService2.detectRuntimeWithCommand(sessionName);
		if (!runtimeRunning) {
			this.logger.debug('Runtime not detected in Step 1, skipping direct registration', {
				sessionName,
				runtimeType,
			});
			return false;
		}

		this.logger.debug('Runtime detected, sending registration prompt', {
			sessionName,
			runtimeType,
		});

		// Clear any pending slash command from detection. Claude detection already
		// exits slash mode. Gemini CLI: skip — Ctrl+C at empty prompt exits CLI,
		// Escape defocuses TUI, Ctrl+U is ignored. The prompt should be clean.

		const prompt = await this.loadRegistrationPrompt(role, sessionName, memberId);
		const promptDelivered = await this.sendPromptRobustly(sessionName, prompt, runtimeType);

		if (!promptDelivered) {
			this.logger.warn('Failed to deliver registration prompt', { sessionName, role });
			return false;
		}

		return await this.waitForRegistration(sessionName, role, timeout);
	}

	/**
	 * Step 2: Cleanup with Ctrl+C and reinitialize
	 * Tries to reset the runtime session and start fresh
	 */
	private async tryCleanupAndReinit(
		sessionName: string,
		role: string,
		timeout: number,
		projectPath?: string,
		memberId?: string,
		runtimeType: RuntimeType = RUNTIME_TYPES.CLAUDE_CODE,
		runtimeFlags?: string[]
	): Promise<boolean> {
		// Clear Commandline
		await (await this.getSessionHelper()).clearCurrentCommandLine(sessionName);

		// Reinitialize runtime using the appropriate initialization script (always fresh start)
		// runtimeService2: Fresh instance for runtime reinitialization after cleanup
		// New instance ensures clean state without cached detection results
		const runtimeService2 = this.createRuntimeService(runtimeType);
		await runtimeService2.executeRuntimeInitScript(sessionName, projectPath, runtimeFlags);

		// Wait for runtime to be ready (simplified detection)
		// Use shorter check interval in test environment, and reasonable interval in production
		const checkInterval = process.env.NODE_ENV === 'test' ? 1000 : 2000; // Check every 1-2 seconds
		const isReady = await runtimeService2.waitForRuntimeReady(
			sessionName,
			30000,
			checkInterval
		); // 30s timeout
		if (!isReady) {
			throw new Error(`Failed to reinitialize ${runtimeType} within timeout`);
		}

		// Start runtime exit monitoring IMMEDIATELY after runtime is ready.
		// Must be before postInitialize and sendRegistrationPromptAsync so exits
		// during those phases are detected and the abort signal fires in time.
		RuntimeExitMonitorService.getInstance().startMonitoring(
			sessionName, runtimeType, role
		);

		// Run post-initialization hook (e.g., Gemini CLI directory allowlist)
		try {
			await runtimeService2.postInitialize(sessionName);
			// Drain stale terminal escape sequences (e.g. DA1 [?1;2c) that may have
			// arrived during postInitialize commands, so they don't leak into the prompt input
			await delay(500);
			// Clear any pending input after post-initialization.
			// Claude Code: Ctrl+C + Ctrl+U (clearCurrentCommandLine) — standard cleanup.
			// Gemini CLI: Skip cleanup entirely — the TUI just started with a clean
			// prompt. Ctrl+C at an empty Gemini CLI prompt triggers /quit and exits
			// the CLI. Escape defocuses the TUI. Ctrl+U is ignored. The delay(500)
			// above is sufficient to drain stale escape sequences.
			if (runtimeType === RUNTIME_TYPES.CLAUDE_CODE) {
				await (await this.getSessionHelper()).clearCurrentCommandLine(sessionName);
			}
		} catch (postInitError) {
			this.logger.warn('Post-initialization hook failed (non-fatal)', {
				sessionName,
				runtimeType,
				error: postInitError instanceof Error ? postInitError.message : String(postInitError),
			});
		}

		// For PTY sessions, once runtime is detected as ready, consider initialization successful
		// MCP registration will happen async when the agent processes its first prompt
		this.logger.info('Runtime detected as ready, session initialization successful', {
			sessionName,
			role,
			runtimeType,
		});

		// Resume via /resume command if this was a previously running Claude Code session
		if (runtimeType === RUNTIME_TYPES.CLAUDE_CODE) {
			try {
				const persistence = getSessionStatePersistence();
				if (persistence.isRestoredSession(sessionName)) {
					await this.resumeClaudeCodeSession(sessionName);
				}
			} catch (resumeError) {
				this.logger.warn('Resume attempt failed (non-fatal, continuing with fresh session)', {
					sessionName,
					error: resumeError instanceof Error ? resumeError.message : String(resumeError),
				});
			}
		}

		// Send the registration prompt in background (don't block on it)
		this.sendRegistrationPromptAsync(sessionName, role, memberId, runtimeType).catch((err) => {
			this.logger.warn('Background registration prompt failed (non-blocking)', {
				sessionName,
				error: err instanceof Error ? err.message : String(err),
			});
		});

		// Update agent status to 'started' since the runtime is running
		// The agent will become 'active' only after it registers via the API endpoint
		try {
			await this.storageService.updateAgentStatus(
				sessionName,
				AGENTMUX_CONSTANTS.AGENT_STATUSES.STARTED
			);
			this.logger.info('Agent status updated to started (runtime running, awaiting registration)', { sessionName, role });
		} catch (statusError) {
			this.logger.warn('Failed to update agent status (non-critical)', {
				sessionName,
				error: statusError instanceof Error ? statusError.message : String(statusError),
			});
		}

		return true;
	}

	/**
	 * Resume a Claude Code session via the /resume slash command.
	 *
	 * Sends /resume to the running Claude Code instance, waits for the session
	 * picker to appear, then presses Enter to select the most recent session.
	 * This is non-fatal — if it fails, the agent continues with a fresh session.
	 *
	 * @param sessionName - PTY session name
	 * @returns true if resume succeeded, false otherwise
	 */
	private async resumeClaudeCodeSession(sessionName: string): Promise<boolean> {
		this.logger.info('Attempting Claude Code session resume via /resume command', { sessionName });

		try {
			const helper = await this.getSessionHelper();

			// Send /resume slash command
			await helper.sendMessage(sessionName, '/resume');

			// Wait for the session picker to appear
			await delay(CLAUDE_RESUME_CONSTANTS.SESSION_PICKER_DELAY_MS);

			// Press Enter to select the first (most recent) session
			await helper.sendKey(sessionName, 'Enter');

			// Brief settle time
			await delay(1000);

			// Wait for Claude to resume and return to prompt
			const runtimeService = this.createRuntimeService(RUNTIME_TYPES.CLAUDE_CODE);
			const isReady = await runtimeService.waitForRuntimeReady(
				sessionName,
				CLAUDE_RESUME_CONSTANTS.RESUME_READY_TIMEOUT_MS,
				2000
			);

			if (isReady) {
				this.logger.info('Claude Code session resumed successfully via /resume', { sessionName });
				return true;
			}

			this.logger.warn('Claude Code /resume did not return to ready state within timeout', { sessionName });
			return false;
		} catch (error) {
			this.logger.warn('Claude Code /resume failed (non-fatal)', {
				sessionName,
				error: error instanceof Error ? error.message : String(error),
			});
			return false;
		}
	}

	/**
	 * Send registration prompt asynchronously (non-blocking).
	 * Uses an AbortController so the operation can be cancelled if the
	 * runtime exits before registration completes.
	 */
	private async sendRegistrationPromptAsync(
		sessionName: string,
		role: string,
		memberId?: string,
		runtimeType: RuntimeType = RUNTIME_TYPES.CLAUDE_CODE
	): Promise<void> {
		// Create AbortController for this registration
		const controller = new AbortController();
		this.registrationAbortControllers.set(sessionName, controller);

		try {
			if (controller.signal.aborted) return;
			const prompt = await this.loadRegistrationPrompt(role, sessionName, memberId);

			if (controller.signal.aborted) return;
			await this.sendPromptRobustly(sessionName, prompt, runtimeType, controller.signal);

			this.logger.debug('Registration prompt sent asynchronously', { sessionName, role });
		} catch (error) {
			if (controller.signal.aborted) {
				this.logger.info('Registration prompt cancelled (runtime exited)', { sessionName });
				return;
			}
			this.logger.warn('Failed to send registration prompt asynchronously', {
				sessionName,
				error: error instanceof Error ? error.message : String(error),
			});
		} finally {
			this.registrationAbortControllers.delete(sessionName);
		}
	}

	/**
	 * Step 3: Kill session and recreate completely
	 * Most aggressive approach - completely recreates the session from scratch
	 */
	private async tryFullRecreation(
		sessionName: string,
		role: string,
		timeout: number,
		projectPath?: string,
		memberId?: string,
		runtimeType: RuntimeType = RUNTIME_TYPES.CLAUDE_CODE,
		runtimeFlags?: string[]
	): Promise<boolean> {
		// Kill existing session
		await (await this.getSessionHelper()).killSession(sessionName);

		// Wait for cleanup
		await delay(1000);

		// Recreate session based on role
		if (role === ORCHESTRATOR_ROLE) {
			await this.createOrchestratorSession({
				sessionName,
				projectPath: projectPath || process.cwd(),
			});

			// Initialize runtime for orchestrator using script (always fresh start)
			const runtimeService = this.createRuntimeService(runtimeType);
			await runtimeService.executeRuntimeInitScript(sessionName, process.cwd(), runtimeFlags);

			// Wait for runtime to be ready
			const checkInterval = this.getCheckInterval();
			// runtimeService3: Separate instance for orchestrator ready-state detection
			// Isolated from runtimeService to prevent interference between init and ready checks
			const runtimeService3 = this.createRuntimeService(runtimeType);
			const isReady = await runtimeService3.waitForRuntimeReady(
				sessionName,
				45000,
				checkInterval
			);
			if (!isReady) {
				throw new Error(
					`Failed to initialize ${runtimeType} in recreated orchestrator session within timeout`
				);
			}

			// Start runtime exit monitoring immediately after runtime is ready
			RuntimeExitMonitorService.getInstance().startMonitoring(
				sessionName, runtimeType, role
			);

			// Additional verification: Use runtime detection to confirm runtime is responding
			// Wait a bit longer for runtime to fully load after showing welcome message
			this.logger.debug(
				'Runtime ready detected for orchestrator, waiting for full startup before verification',
				{ sessionName, runtimeType }
			);
			await delay(5000);

			this.logger.debug('Verifying orchestrator runtime responsiveness', {
				sessionName,
				runtimeType,
			});
			// runtimeService4: Final verification instance for orchestrator responsiveness
			// Clean instance for post-initialization responsiveness testing
			const runtimeService4 = this.createRuntimeService(runtimeType);
			const runtimeResponding = await runtimeService4.detectRuntimeWithCommand(sessionName);
			if (!runtimeResponding) {
				throw new Error(
					`${runtimeType} not responding to commands after orchestrator recreation`
				);
			}

			this.logger.debug(
				'Runtime confirmed ready for orchestrator in Step 3',
				{ sessionName, runtimeType }
			);
		} else {
			// For other roles, create basic session and initialize Claude (always fresh start)
			await (await this.getSessionHelper()).createSession(sessionName, projectPath || process.cwd());

			const runtimeService = this.createRuntimeService(runtimeType);
			await runtimeService.executeRuntimeInitScript(sessionName, projectPath, runtimeFlags);

			// Wait for runtime to be ready (simplified detection)
			const checkInterval = this.getCheckInterval();
			const isReady = await this.createRuntimeService(runtimeType)
				.waitForRuntimeReady(sessionName, 25000, checkInterval); // 25s timeout
			if (!isReady) {
				throw new Error(
					`Failed to initialize ${runtimeType} in recreated session within timeout`
				);
			}

			// Start runtime exit monitoring immediately after runtime is ready
			RuntimeExitMonitorService.getInstance().startMonitoring(
				sessionName, runtimeType, role
			);
		}

		// Run post-initialization hook (e.g., Gemini CLI directory allowlist)
		try {
			const postInitService = this.createRuntimeService(runtimeType);
			await postInitService.postInitialize(sessionName);
			// Drain stale terminal escape sequences (e.g. DA1 [?1;2c) that may have
			// arrived during postInitialize commands, so they don't leak into the prompt input
			await delay(500);
			// Claude Code: Ctrl+C + Ctrl+U to clear any stale input.
			// Gemini CLI (Ink TUI): Do NOT send any cleanup keystrokes.
			// Escape defocuses the Ink TUI input permanently. Ctrl+C at empty
			// prompt triggers /quit. Ctrl+U is ignored. The delay above is
			// sufficient to drain stale escape sequences.
			if (runtimeType === RUNTIME_TYPES.CLAUDE_CODE) {
				await (await this.getSessionHelper()).clearCurrentCommandLine(sessionName);
			}
		} catch (postInitError) {
			this.logger.warn('Post-initialization hook failed after recreation (non-fatal)', {
				sessionName,
				runtimeType,
				error: postInitError instanceof Error ? postInitError.message : String(postInitError),
			});
		}

		// For PTY sessions, once runtime is detected as ready, consider initialization successful
		this.logger.info('Runtime detected as ready after full recreation, session initialization successful', {
			sessionName,
			role,
			runtimeType,
		});

		// Resume via /resume command if this was a previously running Claude Code session
		if (runtimeType === RUNTIME_TYPES.CLAUDE_CODE) {
			try {
				const persistence = getSessionStatePersistence();
				if (persistence.isRestoredSession(sessionName)) {
					await this.resumeClaudeCodeSession(sessionName);
				}
			} catch (resumeError) {
				this.logger.warn('Resume attempt failed (non-fatal, continuing with fresh session)', {
					sessionName,
					error: resumeError instanceof Error ? resumeError.message : String(resumeError),
				});
			}
		}

		// Send the registration prompt in background (don't block on it)
		this.sendRegistrationPromptAsync(sessionName, role, memberId, runtimeType).catch((err) => {
			this.logger.warn('Background registration prompt failed after recreation (non-blocking)', {
				sessionName,
				error: err instanceof Error ? err.message : String(err),
			});
		});

		// Update agent status to 'started' since the runtime is running
		// The agent will become 'active' only after it registers via the API endpoint
		try {
			await this.storageService.updateAgentStatus(
				sessionName,
				AGENTMUX_CONSTANTS.AGENT_STATUSES.STARTED
			);
			this.logger.info('Agent status updated to started after recreation (awaiting registration)', { sessionName, role });
		} catch (statusError) {
			this.logger.warn('Failed to update agent status after recreation (non-critical)', {
				sessionName,
				error: statusError instanceof Error ? statusError.message : String(statusError),
			});
		}

		return true;
	}

	/**
	 * Load registration prompt from config files (with caching to prevent file I/O contention)
	 */
	private async loadRegistrationPrompt(
		role: string,
		sessionName: string,
		memberId?: string
	): Promise<string> {
		try {
			// Cache key is role only - the template file is the same regardless of memberId
			const cacheKey = role;

			// Check cache first to avoid file I/O during concurrent operations
			if (!this.promptCache.has(cacheKey)) {
				this.logger.debug('Loading prompt template from file', { role, cacheKey });

				// Get the prompt file path from team roles configuration
				const promptPath = await this.getPromptFileForRole(role);
				const promptTemplate = await readFile(promptPath, 'utf8');
				this.promptCache.set(cacheKey, promptTemplate);
				this.logger.debug('Prompt template cached', { role, cacheKey, promptPath });
			} else {
				this.logger.debug('Using cached prompt template', { role, cacheKey });
			}

			// Get cached template and apply variable replacements
			let prompt = this.promptCache.get(cacheKey)!;

			// Replace session ID and member ID placeholders
			prompt = prompt.replace(/\{\{SESSION_ID\}\}/g, sessionName);
			if (memberId) {
				prompt = prompt.replace(/\{\{MEMBER_ID\}\}/g, memberId);
			} else {
				// For orchestrator or cases without member ID, remove the memberId parameter
				prompt = prompt.replace(/,\s*"memberId":\s*"\{\{MEMBER_ID\}\}"/g, '');
			}

			// Look up project path for team members
			let projectPath = process.cwd();
			try {
				const teams = await this.storageService.getTeams();
				for (const team of teams) {
					const member = team.members?.find((m) => m.sessionName === sessionName);
					if (member && team.currentProject) {
						const projects = await this.storageService.getProjects();
						const project = projects.find((p) => p.id === team.currentProject);
						if (project?.path) {
							projectPath = project.path;
						}
						break;
					}
				}
			} catch {
				// Non-critical - use default project path
			}

			// Generate and inject startup briefing from session memory
			try {
				const sessionMemoryService = SessionMemoryService.getInstance();
				await sessionMemoryService.onSessionStart(sessionName, role, projectPath);
				const briefing = await sessionMemoryService.generateStartupBriefing(sessionName, role, projectPath);
				const briefingMd = sessionMemoryService.formatBriefingAsMarkdown(briefing);
				if (briefingMd && briefingMd.length > 30) {
					prompt += `\n\n---\n\n${briefingMd}`;
					this.logger.info('Startup briefing injected into prompt', { sessionName, role, briefingLength: briefingMd.length });
				}
			} catch (briefingError) {
				this.logger.warn('Failed to generate startup briefing (non-critical)', {
					sessionName,
					error: briefingError instanceof Error ? briefingError.message : String(briefingError),
				});
			}

			// Append identity section so the agent knows its session name and project path
			prompt += `\n\n---\n\n## Your Identity\n- **Session Name:** ${sessionName}\n- **Project Path:** ${projectPath}`;
			if (memberId) {
				prompt += `\n- **Member ID:** ${memberId}`;
			}

			return prompt;
		} catch (error) {
			// Fallback to inline prompt if file doesn't exist
			const attemptedPath = await this.getPromptFileForRole(role);

			this.logger.error('Could not load prompt from config, using fallback', {
				role,
				promptPath: attemptedPath,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});

			const memberIdParam = memberId ? `, "teamMemberId": "${memberId}"` : '';

			return `Hey! I need your help with some tasks on this project.

## Quick context about this setup

This project uses AgentMux for team coordination. The \`register_agent_status\` tool is an MCP tool that's already configured in your MCP server settings (check your .mcp.json if you want to verify). The AgentMux backend is running locally as part of this development environment.

## First thing - please check in

Please call the \`register_agent_status\` MCP tool to let the team dashboard know you're available. All it does is update a local status flag so the web UI shows you as online - nothing more.

\`\`\`json
{
  "role": "${role}",
  "sessionName": "${sessionName}"${memberIdParam}
}
\`\`\`

After checking in, just say "Ready for tasks" and wait for me to send you work.`;
		}
	}

	/**
	 * Wait for agent registration to complete
	 */
	private async waitForRegistration(
		sessionName: string,
		role: string,
		timeout: number
	): Promise<boolean> {
		const startTime = Date.now();
		const checkInterval = 5000; // Check every 5 seconds to prevent overlapping with `/` detection

		while (Date.now() - startTime < timeout) {
			try {
				if (await this.checkAgentRegistration(sessionName, role)) {
					this.logger.info('Agent registration confirmed', { sessionName, role });
					return true;
				}

				await delay(checkInterval);
			} catch (error) {
				this.logger.warn('Error checking registration', {
					sessionName,
					role,
					error: error instanceof Error ? error.message : String(error),
				});
				await delay(checkInterval);
			}
		}

		this.logger.warn('Timeout waiting for agent registration', { sessionName, role, timeout });
		return false;
	}

	/**
	 * Check if agent is properly registered
	 */
	private async checkAgentRegistration(sessionName: string, role: string): Promise<boolean> {
		try {
			if (role === ORCHESTRATOR_ROLE) {
				// For orchestrator, check agentStatus is active
				const orchestratorStatus = await this.storageService.getOrchestratorStatus();
				return orchestratorStatus?.agentStatus === AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVE;
			}

			// For team members, check teams data
			const teams = await this.storageService.getTeams();

			// Find team member with matching sessionName and check agentStatus
			for (const team of teams) {
				if (team.members) {
					for (const member of team.members) {
						if (member.sessionName === sessionName && member.role === role) {
							return member.agentStatus === AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVE;
						}
					}
				}
			}

			return false;
		} catch (error) {
			this.logger.debug('Error checking agent registration', {
				sessionName,
				role,
				error: error instanceof Error ? error.message : String(error),
			});
			return false;
		}
	}

	/**
	 * Fast registration with verification and retry mechanism
	 * Sends system prompt to runtime which triggers MCP registration via teams.json
	 * @param skipInitialCleanup If true, skips Ctrl+C on first attempt (when runtime was just initialized)
	 */
	private async attemptRegistrationWithVerification(
		sessionName: string,
		role: string,
		timeout: number,
		memberId?: string,
		maxRetries: number = 3,
		skipInitialCleanup: boolean = false,
		runtimeType: RuntimeType = RUNTIME_TYPES.CLAUDE_CODE
	): Promise<boolean> {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			this.logger.info('Attempting system prompt registration with MCP flow', {
				sessionName,
				role,
				runtimeType,
				attempt,
				maxRetries,
			});

			try {
				// Step 1: Send Ctrl+C to clear any pending commands (skip on first attempt if Claude was just initialized)
				if (!skipInitialCleanup || attempt > 1) {
					await (await this.getSessionHelper()).clearCurrentCommandLine(sessionName);
					await delay(500);
					this.logger.debug('Sent Ctrl+C to clear terminal state', {
						sessionName,
						attempt,
					});
				} else {
					this.logger.debug(
						'Skipping Ctrl+C on first attempt (Claude was just initialized)',
						{ sessionName, attempt }
					);
				}

				// Step 2: Verify runtime is running (skip detection if runtime was just initialized and verified)
				let runtimeRunning = true; // Assume true if we skip detection

				if (!skipInitialCleanup || attempt > 1) {
					// Only do runtime detection on retries or when runtime wasn't just initialized
					const forceRefresh = attempt > 1; // Force refresh on retry attempts
					const runtimeService5 = this.createRuntimeService(runtimeType);
					runtimeRunning = await runtimeService5.detectRuntimeWithCommand(
						sessionName,
						forceRefresh
					);

					if (!runtimeRunning) {
						this.logger.warn('Runtime not detected, cannot send system prompt', {
							sessionName,
							runtimeType,
							attempt,
							forceRefresh,
						});

						// Clear detection cache before continuing to retry
						const runtimeService6 = this.createRuntimeService(runtimeType);
						runtimeService6.clearDetectionCache(sessionName);

						// Add longer delay between failed detection attempts
						if (attempt < maxRetries) {
							await delay(2000);
						}
						continue; // Try again
					}
				} else {
					this.logger.debug(
						'Skipping runtime detection (runtime was just initialized and verified)',
						{
							sessionName,
							runtimeType,
							attempt,
						}
					);
				}

				// Step 3: Send system prompt with robust delivery mechanism
				const prompt = await this.loadRegistrationPrompt(role, sessionName, memberId);
				const promptDelivered = await this.sendPromptRobustly(sessionName, prompt, runtimeType);

				if (!promptDelivered) {
					this.logger.warn('Failed to deliver system prompt reliably', {
						sessionName,
						attempt,
						promptLength: prompt.length,
					});
					continue; // Try again
				}

				this.logger.debug('System prompt delivered successfully', {
					sessionName,
					promptLength: prompt.length,
				});

				this.logger.debug('Terminal activity detected, waiting for MCP registration', {
					sessionName,
				});

				// Step 5: Wait for MCP tool call to update teams.json (agentStatus: activating -> active)
				const registrationTimeout = Math.min(timeout, 25000); // Max 25s per attempt
				const registered = await this.waitForRegistrationFast(
					sessionName,
					role,
					registrationTimeout
				);

				if (registered) {
					this.logger.info('MCP registration successful (teams.json updated)', {
						sessionName,
						role,
						attempt,
					});
					return true;
				}

				this.logger.warn('MCP registration timeout, retrying', {
					sessionName,
					role,
					attempt,
					nextAttempt: attempt < maxRetries,
				});
			} catch (error) {
				this.logger.error('System prompt registration attempt failed', {
					sessionName,
					role,
					attempt,
					error: error instanceof Error ? error.message : String(error),
				});
			}

			// Short delay before retry
			if (attempt < maxRetries) {
				await delay(1000);
			}
		}

		this.logger.error('All runtime registration attempts failed', {
			sessionName,
			role,
			runtimeType,
			maxRetries,
		});
		return false;
	}

	/**
	 * Fast registration polling with shorter intervals
	 */
	private async waitForRegistrationFast(
		sessionName: string,
		role: string,
		timeout: number
	): Promise<boolean> {
		const startTime = Date.now();
		const fastCheckInterval = 2000; // Check every 2 seconds (faster than original 5s)

		while (Date.now() - startTime < timeout) {
			try {
				if (await this.checkAgentRegistration(sessionName, role)) {
					this.logger.info('Fast registration confirmation', { sessionName, role });
					return true;
				}

				await delay(fastCheckInterval);
			} catch (error) {
				this.logger.debug('Error in fast registration check', {
					sessionName,
					role,
					error: error instanceof Error ? error.message : String(error),
				});
				await delay(1000); // Shorter error delay
			}
		}

		this.logger.warn('Fast registration timeout', { sessionName, role, timeout });
		return false;
	}

	/**
	 * Create orchestrator session - extracted from the original tmux service
	 */
	private async createOrchestratorSession(config: OrchestratorConfig): Promise<void> {
		this.logger.info('Creating orchestrator session', {
			sessionName: config.sessionName,
			projectPath: config.projectPath,
		});

		// Check if session already exists
		if (await (await this.getSessionHelper()).sessionExists(config.sessionName)) {
			this.logger.info('Orchestrator session already exists', {
				sessionName: config.sessionName,
			});
			return;
		}

		// Create new session for orchestrator
		await (await this.getSessionHelper()).createSession(
			config.sessionName,
			config.projectPath
			// windowName not used in PTY backend
		);

		this.logger.info('Orchestrator session created successfully', {
			sessionName: config.sessionName,
		});
	}

	/**
	 * Unified session creation that handles both orchestrator and team members
	 * @param config Session configuration
	 * @returns Promise with success/error information
	 */
	async createAgentSession(config: {
		sessionName: string;
		role: string;
		projectPath?: string;
		windowName?: string;
		memberId?: string;
		runtimeType?: RuntimeType;
		teamId?: string;
	}): Promise<{
		success: boolean;
		sessionName?: string;
		message?: string;
		error?: string;
	}> {
		const { sessionName, role, projectPath = process.cwd(), windowName, memberId } = config;

		// Get runtime type from config or default to claude-code
		let runtimeType = config.runtimeType || RUNTIME_TYPES.CLAUDE_CODE;

		// Resolve runtime flags from the agent's effective skills
		let runtimeFlags: string[] = [];

		// For team members, try to get runtime type from storage and resolve skill flags
		if (!config.runtimeType && role !== ORCHESTRATOR_ROLE) {
			try {
				const teams = await this.storageService.getTeams();
				for (const team of teams) {
					const member = team.members?.find((m) => m.sessionName === sessionName);
					if (member) {
						if (member.runtimeType) {
							runtimeType = member.runtimeType as RuntimeType;
						}
						// Resolve runtime flags from role skills + member overrides
						runtimeFlags = await this.resolveRuntimeFlags(
							role, runtimeType, member.skillOverrides, member.excludedRoleSkills
						);
						break;
					}
				}
			} catch (error) {
				this.logger.warn('Failed to get runtime type or flags from storage, using defaults', {
					sessionName,
					role,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		} else if (role !== ORCHESTRATOR_ROLE) {
			// Config-provided runtimeType, still resolve flags
			try {
				const teams = await this.storageService.getTeams();
				for (const team of teams) {
					const member = team.members?.find((m) => m.sessionName === sessionName);
					if (member) {
						runtimeFlags = await this.resolveRuntimeFlags(
							role, runtimeType, member.skillOverrides, member.excludedRoleSkills
						);
						break;
					}
				}
			} catch (error) {
				this.logger.warn('Failed to resolve runtime flags', {
					sessionName, role,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		// For orchestrator, try to get runtime type from orchestrator status
		if (role === ORCHESTRATOR_ROLE && !config.runtimeType) {
			try {
				const orchestratorStatus = await this.storageService.getOrchestratorStatus();
				if (orchestratorStatus?.runtimeType) {
					runtimeType = orchestratorStatus.runtimeType as RuntimeType;
				}
			} catch (error) {
				this.logger.warn(
					'Failed to get orchestrator runtime type from storage, using default',
					{
						sessionName,
						role,
						error: error instanceof Error ? error.message : String(error),
					}
				);
			}
		}

		try {
			this.logger.info('Creating agent session (unified approach)', {
				sessionName,
				role,
				runtimeType,
				projectPath,
				windowName,
				memberId,
			});

			// Get session helper first
			this.logger.debug('Getting session helper for session creation');
			const sessionHelper = await this.getSessionHelper();
			this.logger.debug('Session helper obtained', {
				hasHelper: !!sessionHelper,
			});

			// Check if session already exists
			const sessionExists = sessionHelper.sessionExists(sessionName);
			this.logger.debug('Checked if session exists', {
				sessionName,
				sessionExists,
			});

			if (!sessionExists) {
				// Session doesn't exist, go directly to creating a new session
				this.logger.info('Session does not exist, will create new session', { sessionName });
			} else {
				this.logger.info(
					'Session already exists, attempting intelligent recovery instead of killing',
					{
						sessionName,
					}
				);

				// Step 1: Try to detect if runtime is already running using slash command
				const runtimeService = this.createRuntimeService(runtimeType);

				let recoverySuccess = false;

				try {
					const runtimeRunning = await runtimeService.detectRuntimeWithCommand(
						sessionName
					);

					if (runtimeRunning) {
						this.logger.info(
							'Runtime detected in existing session, attempting direct registration',
							{
								sessionName,
							}
						);

						// Try to send registration prompt directly
						const registrationResult = await this.attemptRegistrationWithVerification(
							sessionName,
							role,
							25000, // 25 second timeout
							memberId,
							1, // single attempt for now
							true, // skip initial cleanup since runtime is confirmed running
							runtimeType
						);

						if (registrationResult) {
							recoverySuccess = true;
							this.logger.info(
								'Successfully registered existing session with runtime',
								{ sessionName }
							);
						}
					}

					// Step 2: If runtime not detected or registration failed, try Ctrl+C restart
					if (!recoverySuccess) {
						this.logger.info(
							'Runtime not detected or registration failed, attempting Ctrl+C restart',
							{
								sessionName,
							}
						);

						// Send Ctrl+C twice to try to restart Claude
						await (await this.getSessionHelper()).sendCtrlC(sessionName);
						await delay(1000);
						await (await this.getSessionHelper()).sendCtrlC(sessionName);
						await delay(2000);

						// Clear runtime detection cache after Ctrl+C restart
						runtimeService.clearDetectionCache(sessionName);

						// Try registration after Ctrl+C restart
						const postCtrlCResult = await this.attemptRegistrationWithVerification(
							sessionName,
							role,
							25000,
							memberId,
							1, // single attempt
							false, // don't skip cleanup after Ctrl+C
							runtimeType
						);

						if (postCtrlCResult) {
							recoverySuccess = true;
							this.logger.info(
								'Successfully recovered session after Ctrl+C restart',
								{ sessionName }
							);
						}
					}
				} catch (error) {
					this.logger.warn('Error during intelligent session recovery', {
						sessionName,
						error: error instanceof Error ? error.message : String(error),
					});
				}

				// If recovery succeeded, register for persistence and return early
				if (recoverySuccess) {
					// Register session for state persistence so it survives restarts
					try {
						const persistence = getSessionStatePersistence();
						persistence.registerSession(sessionName, {
							cwd: projectPath || process.cwd(),
							command: process.env.SHELL || '/bin/bash',
							args: [],
						}, runtimeType, role, config.teamId);
					} catch (persistError) {
						this.logger.warn('Failed to register recovered session for persistence (non-critical)', {
							sessionName,
							error: persistError instanceof Error ? persistError.message : String(persistError),
						});
					}

					return {
						success: true,
						sessionName,
						message: 'Agent session recovered and registered successfully',
					};
				}

				// Step 3: Last resort - fall back to killing session for clean restart
				this.logger.warn(
					'All recovery attempts failed, falling back to session recreation',
					{
						sessionName,
					}
				);
				await (await this.getSessionHelper()).killSession(sessionName);
				await delay(1000); // Wait for cleanup
			}

			// Create new session (same approach for both orchestrator and team members)
			const cwdToUse = projectPath || process.cwd();
			this.logger.info('Creating PTY session', {
				sessionName,
				cwd: cwdToUse,
			});

			try {
				const createdSession = await sessionHelper.createSession(sessionName, cwdToUse);
				this.logger.info('PTY session created successfully', {
					sessionName,
					pid: createdSession.pid,
					cwd: createdSession.cwd,
				});
			} catch (createError) {
				this.logger.error('Failed to create PTY session', {
					sessionName,
					cwd: cwdToUse,
					error: createError instanceof Error ? createError.message : String(createError),
					stack: createError instanceof Error ? createError.stack : undefined,
				});
				throw createError;
			}

			// Verify session was created
			const sessionCreatedCheck = sessionHelper.sessionExists(sessionName);
			this.logger.info('Session creation verification', {
				sessionName,
				exists: sessionCreatedCheck,
			});

			if (!sessionCreatedCheck) {
				throw new Error(`Session '${sessionName}' was not created successfully`);
			}

			// Register session for state persistence so it survives restarts
			try {
				const persistence = getSessionStatePersistence();
				persistence.registerSession(sessionName, {
					cwd: cwdToUse,
					command: process.env.SHELL || '/bin/bash',
					args: [],
				}, runtimeType, role, config.teamId);
			} catch (persistError) {
				this.logger.warn('Failed to register session for persistence (non-critical)', {
					sessionName,
					error: persistError instanceof Error ? persistError.message : String(persistError),
				});
			}

			// Set environment variables for MCP connection
			await sessionHelper.setEnvironmentVariable(
				sessionName,
				ENV_CONSTANTS.TMUX_SESSION_NAME,
				sessionName
			);
			await sessionHelper.setEnvironmentVariable(
				sessionName,
				ENV_CONSTANTS.AGENTMUX_ROLE,
				role
			);
			await sessionHelper.setEnvironmentVariable(
				sessionName,
				ENV_CONSTANTS.AGENTMUX_API_URL,
				`http://localhost:${WEB_CONSTANTS.PORTS.BACKEND}`
			);

			this.logger.info('Agent session created and environment variables set, initializing with registration', {
				sessionName,
				role,
				runtimeType,
			});

			// Use the existing unified registration system
			const timeout =
				role === ORCHESTRATOR_ROLE
					? AGENT_TIMEOUTS.ORCHESTRATOR_INITIALIZATION
					: AGENT_TIMEOUTS.REGULAR_AGENT_INITIALIZATION;
			const initResult = await this.initializeAgentWithRegistration(
				sessionName,
				role,
				projectPath,
				timeout,
				memberId,
				runtimeType,
				runtimeFlags
			);

			if (!initResult.success) {
				return {
					success: false,
					sessionName,
					error: initResult.error || 'Failed to initialize and register agent',
				};
			}

			return {
				success: true,
				sessionName,
				message: initResult.message || 'Agent session created and registered successfully',
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error('Failed to create agent session', {
				sessionName,
				role,
				error: errorMessage,
			});

			return {
				success: false,
				sessionName,
				error: errorMessage,
			};
		}
	}

	/**
	 * Unified session termination that handles both orchestrator and team members
	 * @param sessionName The session to terminate
	 * @param role The role for proper status updates
	 * @returns Promise with success/error information
	 */
	async terminateAgentSession(
		sessionName: string,
		role: string = 'unknown'
	): Promise<{
		success: boolean;
		message?: string;
		error?: string;
	}> {
		try {
			this.logger.info('Terminating agent session (unified approach)', { sessionName, role });

			// Stop runtime exit monitoring before killing the session
			RuntimeExitMonitorService.getInstance().stopMonitoring(sessionName);

			// Get session helper once to avoid repeated async calls
			const sessionHelper = await this.getSessionHelper();
			const sessionExists = sessionHelper.sessionExists(sessionName);

			if (sessionExists) {
				// Kill the tmux session
				await sessionHelper.killSession(sessionName);
				this.logger.info('Session terminated successfully', { sessionName });
			} else {
				this.logger.info('Session already terminated or does not exist', { sessionName });
			}

			// Capture session end for memory persistence
			try {
				const sessionMemoryService = SessionMemoryService.getInstance();
				await sessionMemoryService.onSessionEnd(sessionName, role, process.cwd());
				this.logger.info('Session memory captured on termination', { sessionName, role });
			} catch (memoryError) {
				this.logger.warn('Failed to capture session memory on termination (non-critical)', {
					sessionName,
					error: memoryError instanceof Error ? memoryError.message : String(memoryError),
				});
			}

			// Update agent status to inactive (works for both orchestrator and team members)
			await this.storageService.updateAgentStatus(
				sessionName,
				AGENTMUX_CONSTANTS.AGENT_STATUSES.INACTIVE
			);
			this.logger.info('Agent status updated to inactive', { sessionName, role });

			// Unregister from persistence so explicitly stopped agents don't reappear in resume popup
			try {
				const persistence = getSessionStatePersistence();
				persistence.unregisterSession(sessionName);
			} catch (persistError) {
				this.logger.warn('Failed to unregister session from persistence (non-critical)', {
					sessionName,
					error: persistError instanceof Error ? persistError.message : String(persistError),
				});
			}

			return {
				success: true,
				message: sessionExists
					? 'Agent session terminated successfully'
					: 'Agent session was already terminated',
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error('Failed to terminate agent session', {
				sessionName,
				role,
				error: errorMessage,
			});

			return {
				success: false,
				error: errorMessage,
			};
		}
	}

	/**
	 * Send a message to any agent session with reliable delivery.
	 * Uses robust delivery mechanism with retry logic to ensure messages
	 * are properly delivered to Claude Code's input.
	 *
	 * @param sessionName - The agent session name
	 * @param message - The message to send
	 * @returns Promise with success status and optional error message
	 *
	 * @example
	 * ```typescript
	 * const result = await agentRegistrationService.sendMessageToAgent(
	 *   'agentmux-orc',
	 *   '[CHAT:123] Hello, orchestrator!'
	 * );
	 * if (result.success) {
	 *   console.log('Message delivered');
	 * } else {
	 *   console.error('Delivery failed:', result.error);
	 * }
	 * ```
	 */
	async sendMessageToAgent(
		sessionName: string,
		message: string,
		runtimeType: RuntimeType = RUNTIME_TYPES.CLAUDE_CODE
	): Promise<{
		success: boolean;
		message?: string;
		error?: string;
	}> {
		try {
			if (!message || typeof message !== 'string') {
				return {
					success: false,
					error: 'Message is required and must be a string',
				};
			}

			// Get session helper once for this method
			const sessionHelper = await this.getSessionHelper();

			// Check if session exists
			if (!sessionHelper.sessionExists(sessionName)) {
				return {
					success: false,
					error: `Session '${sessionName}' does not exist`,
				};
			}

			// Use robust message delivery with proper waiting mechanism
			const delivered = await this.sendMessageWithRetry(sessionName, message, 3, runtimeType);

			if (!delivered) {
				return {
					success: false,
					error: 'Failed to deliver message after multiple attempts',
				};
			}

			this.logger.info('Message sent to agent successfully', {
				sessionName,
				messageLength: message.length,
			});

			return {
				success: true,
				message: 'Message sent to agent successfully',
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error('Failed to send message to agent', {
				sessionName,
				error: errorMessage,
			});

			return {
				success: false,
				error: errorMessage,
			};
		}
	}

	/**
	 * Wait for an agent session to be at a ready prompt before sending messages.
	 *
	 * Subscribes to terminal output and polls capturePane to detect when the
	 * agent returns to an input prompt. This is critical for sequential message
	 * processing: after the orchestrator responds to a message it may continue
	 * working (managing agents, running commands) before returning to prompt.
	 *
	 * @param sessionName - The session name to wait on
	 * @param timeoutMs - Maximum time to wait (default 120s)
	 * @returns true if agent is ready, false if timed out
	 */
	async waitForAgentReady(
		sessionName: string,
		timeoutMs: number = EVENT_DELIVERY_CONSTANTS.AGENT_READY_TIMEOUT
	): Promise<boolean> {
		const sessionHelper = await this.getSessionHelper();

		// Check if session exists
		if (!sessionHelper.sessionExists(sessionName)) {
			this.logger.warn('Session does not exist for waitForAgentReady', { sessionName });
			return false;
		}

		// Quick check - already at prompt?
		const currentOutput = sessionHelper.capturePane(sessionName);
		if (this.isClaudeAtPrompt(currentOutput)) {
			this.logger.debug('Agent already at prompt', { sessionName });
			return true;
		}

		this.logger.info('Waiting for agent to return to prompt', { sessionName, timeoutMs });

		const session = sessionHelper.getSession(sessionName);
		if (!session) {
			return false;
		}

		return new Promise<boolean>((resolve) => {
			let resolved = false;
			const pollInterval = EVENT_DELIVERY_CONSTANTS.AGENT_READY_POLL_INTERVAL;

			const cleanup = () => {
				if (resolved) return;
				resolved = true;
				clearTimeout(timeoutId);
				clearInterval(pollId);
				unsubscribe();
			};

			// Timeout - give up waiting
			const timeoutId = setTimeout(() => {
				this.logger.warn('Timed out waiting for agent to be ready', { sessionName, timeoutMs });
				cleanup();
				resolve(false);
			}, timeoutMs);

			// Poll capturePane periodically as a fallback
			const pollId = setInterval(() => {
				if (resolved) return;
				const output = sessionHelper.capturePane(sessionName);
				if (this.isClaudeAtPrompt(output)) {
					this.logger.debug('Agent at prompt (detected via polling)', { sessionName });
					cleanup();
					resolve(true);
				}
			}, pollInterval);

			// Also subscribe to terminal data for faster detection
			const unsubscribe = session.onData((data) => {
				if (resolved) return;
				if (TERMINAL_PATTERNS.PROMPT_STREAM.test(data)) {
					// Double-check with capturePane to avoid false positives from partial data
					const output = sessionHelper.capturePane(sessionName);
					if (this.isClaudeAtPrompt(output)) {
						this.logger.debug('Agent at prompt (detected via stream)', { sessionName });
						cleanup();
						resolve(true);
					}
				}
			});
		});
	}

	/**
	 * @deprecated Replaced by SessionCommandHelper.sendMessage() in sendMessageWithRetry.
	 * Complex event-driven state machine was fragile — Enter key often got lost.
	 * Kept as dead code for reference during transition.
	 */
	private async _deprecated_sendMessageEventDriven(
		sessionName: string,
		message: string,
		timeoutMs: number = EVENT_DELIVERY_CONSTANTS.TOTAL_DELIVERY_TIMEOUT
	): Promise<boolean> {
		const sessionHelper = await this.getSessionHelper();
		const session = sessionHelper.getSession(sessionName);

		if (!session) {
			this.logger.error('Session not found for event-driven delivery', { sessionName });
			return false;
		}

		return new Promise<boolean>((resolve) => {
			let buffer = '';
			let messageSent = false;
			let enterSent = false;
			let enterAccepted = false;
			let deliveryConfirmed = false;
			let resolved = false;

			// Track all timeouts to prevent memory leaks (P1.1 fix)
			const pendingTimeouts: NodeJS.Timeout[] = [];
			const scheduleTimeout = (fn: () => void | Promise<void>, delayMs: number): NodeJS.Timeout => {
				const id = setTimeout(fn, delayMs);
				pendingTimeouts.push(id);
				return id;
			};

			const cleanup = () => {
				// Immediately mark as resolved to prevent race conditions (P1.2 fix)
				const wasResolved = resolved;
				resolved = true;
				if (!wasResolved) {
					// Clear all pending timeouts to prevent memory leaks
					pendingTimeouts.forEach((id) => clearTimeout(id));
					clearTimeout(timeoutId);
					unsubscribe();
				}
			};

			// Use centralized patterns from TERMINAL_PATTERNS
			const PASTE_PATTERN = TERMINAL_PATTERNS.PASTE_INDICATOR;
			const PROCESSING_PATTERN = TERMINAL_PATTERNS.PROCESSING;

			// Use centralized timing from EVENT_DELIVERY_CONSTANTS
			const INITIAL_DELAY = EVENT_DELIVERY_CONSTANTS.INITIAL_MESSAGE_DELAY;
			const PASTE_CHECK_DELAY = EVENT_DELIVERY_CONSTANTS.PASTE_CHECK_DELAY;
			const ENTER_RETRY_DELAY = EVENT_DELIVERY_CONSTANTS.ENTER_RETRY_DELAY;
			const MAX_ENTER_RETRIES = EVENT_DELIVERY_CONSTANTS.MAX_ENTER_RETRIES;
			const MAX_BUFFER_SIZE = EVENT_DELIVERY_CONSTANTS.MAX_BUFFER_SIZE;

		// Helper to send the message when prompt is detected
			const sendMessageNow = () => {
				if (messageSent || resolved) return;

				this.logger.debug('Claude at prompt, sending message', {
					sessionName,
					messageLength: message.length,
					isMultiLine: message.includes('\n'),
				});

				// Send the message text
				session.write(message);
				messageSent = true;
				const isMultiLine = message.includes('\n');

				// Track Enter key state
				let enterAttempts = 0;
				let processingDetected = false;
				const bufferAtSend = buffer;

				// Function to send Enter and track attempts
				const sendEnterKey = (reason: string) => {
					if (resolved || processingDetected) return;
					enterAttempts++;
					session.write('\r');
					enterSent = true;
					this.logger.debug('Enter key sent', {
						sessionName,
						attempt: enterAttempts,
						reason,
					});
				};

				// Function to check if Enter was accepted (processing started)
				const checkProcessingStarted = (): boolean => {
					const newData = buffer.slice(bufferAtSend.length);
					return PROCESSING_PATTERN.test(newData);
				};

				// Function to check for paste indicator
				const checkPasteIndicator = (): boolean => {
					const newData = buffer.slice(bufferAtSend.length);
					return PASTE_PATTERN.test(newData);
				};

				// Strategy: Send Enter with progressive timing, retry if not accepted
				const attemptEnter = (attemptNum: number) => {
					if (resolved || processingDetected) return;

					// Check if processing already started
					if (checkProcessingStarted()) {
						processingDetected = true;
						enterAccepted = true;
						this.logger.debug('Processing detected, message accepted', { sessionName, attemptNum });
						buffer = ''; // Reset for processing indicator detection
						return;
					}

					if (attemptNum > MAX_ENTER_RETRIES) {
						this.logger.warn('Max Enter retries reached, verifying message acceptance', { sessionName });
						scheduleTimeout(async () => {
							if (resolved) return;
							const stuck = await this.isMessageStuckAtPrompt(sessionName, message);
							if (stuck) {
								this.logger.warn('Message stuck at prompt after all Enter retries', { sessionName });
								const stuckHelper = await this.getSessionHelper();
								await stuckHelper.clearCurrentCommandLine(sessionName);
								enterAccepted = false;
							} else {
								this.logger.debug('Message appears accepted (no longer at prompt)', { sessionName });
								enterAccepted = true;
								buffer = '';
							}
						}, EVENT_DELIVERY_CONSTANTS.POST_ENTER_VERIFICATION_DELAY);
						return;
					}

					sendEnterKey(attemptNum === 1 ? 'initial' : `retry-${attemptNum}`);

					// Schedule check and possible retry (using tracked timeout to prevent leaks)
					scheduleTimeout(() => {
						if (resolved) return;

						if (checkProcessingStarted()) {
							processingDetected = true;
							enterAccepted = true;
							this.logger.debug('Processing detected after Enter', { sessionName, attemptNum });
							buffer = '';
						} else {
							// Not accepted yet, retry
							this.logger.debug('Enter may not have been accepted, retrying', {
								sessionName,
								attemptNum,
								bufferLength: buffer.length,
							});
							attemptEnter(attemptNum + 1);
						}
					}, ENTER_RETRY_DELAY);
				};

				// For multi-line messages, wait longer for paste indicator
				// For single-line messages, send Enter sooner
				const initialWait = isMultiLine ? PASTE_CHECK_DELAY : INITIAL_DELAY;

				scheduleTimeout(() => {
					if (resolved) return;

					// For multi-line: check if paste indicator appeared
					if (isMultiLine && checkPasteIndicator()) {
						this.logger.debug('Paste indicator detected', { sessionName });
					}

					// Start Enter key attempts
					attemptEnter(1);
				}, initialWait);
			};

			const timeoutId = setTimeout(async () => {
				this.logger.debug('Event-driven delivery timed out', {
					sessionName,
					messageSent,
					enterSent,
					enterAccepted,
					deliveryConfirmed,
					bufferLength: buffer.length,
				});

				// If Enter was sent but not confirmed accepted, verify via terminal capture
				if (enterSent && !enterAccepted && !deliveryConfirmed) {
					const timeoutHelper = await this.getSessionHelper();
					const stuck = await this.isMessageStuckAtPrompt(sessionName, message);
					if (stuck) {
						this.logger.warn('Timeout: message stuck at prompt, clearing and failing', { sessionName });
						await timeoutHelper.clearCurrentCommandLine(sessionName);
						cleanup();
						resolve(false);
						return;
					}
					this.logger.debug('Timeout: message not at prompt, treating as accepted', { sessionName });
				}

				cleanup();
				resolve(enterAccepted || deliveryConfirmed);
			}, timeoutMs);

			// IMPORTANT: Check current terminal state, but wait for output to settle first.
			// If the orchestrator just finished outputting (greeting, notification, status bar),
			// the prompt may not be cleanly detectable. We capture the pane, wait briefly,
			// and re-capture. If output is still changing, wait again before checking prompt.
			// Use 50 lines to account for status bars and notifications that can
			// wrap across many lines and push the prompt out of a smaller window.
			const waitForSettled = async () => {
				let prevOutput = sessionHelper.capturePane(sessionName);
				for (let i = 0; i < 5; i++) { // Max 5 checks, 500ms apart = 2.5s max
					if (resolved) return;
					await delay(500);
					if (resolved) return;
					const currentOutput = sessionHelper.capturePane(sessionName);
					if (currentOutput === prevOutput) {
						// Output settled
						if (this.isClaudeAtPrompt(currentOutput)) {
							this.logger.debug('Claude at prompt after output settled', { sessionName, settleChecks: i + 1 });
							sendMessageNow();
						}
						return;
					}
					prevOutput = currentOutput;
				}
				// Output still changing after 2.5s - check anyway
				if (!resolved && this.isClaudeAtPrompt(prevOutput)) {
					this.logger.debug('Claude at prompt (output still changing, checking anyway)', { sessionName });
					sendMessageNow();
				}
			};
			waitForSettled();

			const unsubscribe = session.onData((data) => {
				if (resolved) return;

				// Accumulate data with size limit to prevent memory exhaustion (P2.3 fix)
				buffer += data;
				if (buffer.length > MAX_BUFFER_SIZE) {
					buffer = buffer.slice(-MAX_BUFFER_SIZE);
				}

				// Phase 1: Wait for Claude to be at prompt before sending
				if (!messageSent) {
					const isAtPrompt = AgentRegistrationService.CLAUDE_PROMPT_STREAM_PATTERN.test(buffer);

					if (isAtPrompt) {
						sendMessageNow();
					}
					return;
				}

				// Phase 2: Only check for processing indicators AFTER Enter has been sent
				if (!enterSent) {
					return; // Wait for Enter to be sent
				}

				// Look for processing indicators confirming delivery
				const hasProcessingIndicator =
					AgentRegistrationService.CLAUDE_PROCESSING_INDICATORS.some((pattern) =>
						pattern.test(buffer)
					);

				// Also check if prompt disappeared (Claude is working)
				const promptStillVisible =
					AgentRegistrationService.CLAUDE_PROMPT_STREAM_PATTERN.test(buffer);

				// Use constant for minimum buffer check (P3.2 fix)
				if (hasProcessingIndicator || (!promptStillVisible && buffer.length > EVENT_DELIVERY_CONSTANTS.MIN_BUFFER_FOR_PROCESSING_DETECTION)) {
					this.logger.debug('Message delivery confirmed (event-driven)', {
						sessionName,
						hasProcessingIndicator,
						promptStillVisible,
						bufferLength: buffer.length,
					});
					deliveryConfirmed = true;
					cleanup();
					resolve(true);
				}
			});
		});
	}

	/**
	 * Send message with retry logic for reliable delivery to Claude Code.
	 * Uses SessionCommandHelper.sendMessage() (proven two-step write pattern)
	 * with stuck-message detection and retry on failure.
	 *
	 * @param sessionName - The session name
	 * @param message - The message to send
	 * @param maxAttempts - Maximum number of delivery attempts
	 * @returns true if message was delivered successfully
	 */
	private async sendMessageWithRetry(
		sessionName: string,
		message: string,
		maxAttempts: number = 3,
		runtimeType: RuntimeType = RUNTIME_TYPES.CLAUDE_CODE
	): Promise<boolean> {
		const sessionHelper = await this.getSessionHelper();
		const isClaudeCode = runtimeType === RUNTIME_TYPES.CLAUDE_CODE;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				this.logger.debug('Attempting message delivery', {
					sessionName,
					attempt,
					maxAttempts,
					messageLength: message.length,
					runtimeType,
				});

				// Verify agent is at prompt before sending
				const output = sessionHelper.capturePane(sessionName);
				if (!this.isClaudeAtPrompt(output)) {
					this.logger.debug('Not at prompt, waiting before retry', { sessionName, attempt });
					await delay(SESSION_COMMAND_DELAYS.CLAUDE_RECOVERY_DELAY);
					continue;
				}

				// Gemini CLI shell mode guard: if the prompt shows `!` instead of `>`,
				// input will be executed as a shell command. Send Escape to exit first.
				if (runtimeType === RUNTIME_TYPES.GEMINI_CLI && this.isGeminiInShellMode(output)) {
					const escaped = await this.escapeGeminiShellMode(sessionName, sessionHelper);
					if (!escaped) {
						this.logger.warn('Could not exit Gemini shell mode, skipping attempt', {
							sessionName,
							attempt,
						});
						await delay(SESSION_COMMAND_DELAYS.MESSAGE_RETRY_DELAY);
						continue;
					}
				}

				// Clear any stale text before sending.
				// Claude Code: Ctrl+C to cancel any pending input.
				// Gemini CLI (Ink TUI): Send Enter to "wake up" the input box.
				// The TUI input can lose focus after idle periods, auto-update
				// notifications, or dialog overlays. When defocused, writes are
				// silently consumed by the Ink framework but NOT routed to the
				// InputPrompt. Enter on an empty `> ` prompt is a safe no-op
				// (just shows a new blank prompt line) and can dismiss overlays
				// or re-engage input focus after minor TUI state glitches.
				// Do NOT send Escape (defocuses permanently), Ctrl+C (triggers
				// /quit on empty prompt), or Ctrl+U (ignored by TUI).
				if (isClaudeCode) {
					await sessionHelper.sendCtrlC(sessionName);
					await delay(300);
				} else {
					await sessionHelper.sendEnter(sessionName);
					await delay(500);
				}

				// For TUI runtimes, capture output BEFORE sending to detect changes.
				// The TUI always shows the `> ` prompt (even during processing), so
				// isClaudeAtPrompt can't detect delivery. Instead, compare output
				// before and after to see if the agent started processing.
				// Use a small pane capture (20 lines) to reduce noise from TUI
				// border redraws that can cause length changes unrelated to delivery.
				const beforeOutput = !isClaudeCode
					? sessionHelper.capturePane(sessionName, 20)
					: '';
				const beforeLength = beforeOutput.length;

				// Use SessionCommandHelper.sendMessage() — proven two-step write:
				// 1. session.write(message)    — triggers bracketed paste
				// 2. await delay(scaled)       — waits for paste processing
				// 3. session.write('\r')       — sends Enter separately
				// 4. await delay(KEY_DELAY)    — waits for key processing
				await sessionHelper.sendMessage(sessionName, message);

				// Wait for agent to start processing, then verify delivery.
				// TUI runtimes need a longer delay (3s) for the TUI to redraw
				// and show processing indicators after accepting input.
				const processingDelay = isClaudeCode
					? SESSION_COMMAND_DELAYS.MESSAGE_PROCESSING_DELAY
					: 3000;
				await delay(processingDelay);

				// === Delivery verification ===
				// Claude Code: prompt disappears during processing, so check
				// isMessageStuckAtPrompt (text still at prompt = stuck).
				// TUI runtimes (Gemini CLI): the `> ` prompt is ALWAYS visible
				// even during processing, making isClaudeAtPrompt unreliable.
				// Instead, detect delivery via output changes (length increase
				// or processing indicators), same approach as sendPromptRobustly.
				if (isClaudeCode) {
					const stuck = await this.isMessageStuckAtPrompt(sessionName, message);
					if (!stuck) {
						this.logger.debug('Message delivered successfully', { sessionName, attempt });
						return true;
					}
				} else {
					// Use the same small pane capture as the "before" snapshot.
					const afterOutput = sessionHelper.capturePane(sessionName, 20);
					const lengthDiff = afterOutput.length - beforeLength;
					const hasProcessingIndicators = TERMINAL_PATTERNS.PROCESSING_WITH_TEXT.test(
						afterOutput.slice(-500)
					);
					// Check broader processing keywords that Gemini CLI may show
					const hasGeminiIndicators = /reading|thinking|processing|analyzing|registering|generating|searching/i.test(
						afterOutput
					);
					// Check if output CONTENT changed (not just length). TUI redraws
					// can cause length to decrease while the content actually changed
					// because the agent accepted the input and started processing.
					const contentChanged = beforeOutput !== afterOutput;
					// Accept delivery if:
					// 1. Output grew significantly (agent produced new output)
					// 2. Output content changed AND length changed by any significant amount
					//    (positive OR negative — TUI redraws cause shrinkage)
					// 3. Processing indicators detected
					const significantLengthChange = Math.abs(lengthDiff) > 10;
					const delivered = (lengthDiff > 20)
						|| (contentChanged && significantLengthChange)
						|| hasProcessingIndicators
						|| hasGeminiIndicators;

					if (delivered) {
						this.logger.debug('Message delivered successfully (TUI output changed)', {
							sessionName,
							attempt,
							lengthDiff,
							contentChanged,
							hasProcessingIndicators,
							hasGeminiIndicators,
						});
						return true;
					}

					this.logger.warn('TUI output did not change after send — message may not have been accepted', {
						sessionName,
						attempt,
						lengthDiff,
						contentChanged,
						hasProcessingIndicators,
						hasGeminiIndicators,
					});
				}

				// Message stuck at prompt — clear line and retry.
				this.logger.warn('Message stuck at prompt after send, clearing for retry', {
					sessionName,
					attempt,
				});
				if (isClaudeCode) {
					await sessionHelper.clearCurrentCommandLine(sessionName);
				} else {
					// Gemini CLI retry cleanup: be careful with cleanup keystrokes.
					// If output changed (contentChanged=true), text likely reached the
					// input box but wasn't submitted — Ctrl+C safely clears it.
					// If output did NOT change at all, the TUI input is likely defocused
					// and the input box is EMPTY. Ctrl+C on an empty Gemini CLI prompt
					// triggers /quit and exits the CLI entirely. In this case, only send
					// Enter (safe no-op on empty prompt) to try to re-engage the input.
					const noOutputChange = !isClaudeCode && beforeOutput === sessionHelper.capturePane(sessionName, 20);
					if (noOutputChange) {
						this.logger.warn('No output change detected — TUI input may be defocused, sending Enter to re-engage', {
							sessionName,
							attempt,
						});
						await sessionHelper.sendEnter(sessionName);
						await delay(300);
					} else {
						await sessionHelper.sendCtrlC(sessionName);
						await delay(200);
					}
				}
				await delay(SESSION_COMMAND_DELAYS.CLEAR_COMMAND_DELAY);

				if (attempt < maxAttempts) {
					await delay(SESSION_COMMAND_DELAYS.MESSAGE_RETRY_DELAY);
				}
			} catch (error) {
				this.logger.error('Error during message delivery', {
					sessionName,
					attempt,
					error: error instanceof Error ? error.message : String(error),
				});

				if (attempt < maxAttempts) {
					await delay(SESSION_COMMAND_DELAYS.MESSAGE_RETRY_DELAY);
				}
			}
		}

		this.logger.error('Message delivery failed after all retry attempts', {
			sessionName,
			maxAttempts,
			messageLength: message.length,
		});

		return false;
	}


	/**
	 * Check if a sent message is stuck at the terminal prompt (Enter was not accepted).
	 *
	 * Captures the current terminal pane and looks for the message text still visible
	 * on the last few lines. If the text is found, Enter was not processed and the
	 * message is stuck.
	 *
	 * @param sessionName - The session to check
	 * @param message - The original message that was sent
	 * @returns true if the message text is still visible at the prompt (stuck)
	 */
	private async isMessageStuckAtPrompt(sessionName: string, message: string): Promise<boolean> {
		try {
			const sessionHelper = await this.getSessionHelper();
			const output = sessionHelper.capturePane(sessionName);

			if (!output || output.trim().length === 0) {
				return false;
			}

			// Extract a search token from the message:
			// Strip [CHAT:uuid] prefix if present, then take the first 40 chars
			const chatPrefixMatch = message.match(/^\[CHAT:[^\]]+\]\s*/);
			const contentAfterPrefix = chatPrefixMatch
				? message.slice(chatPrefixMatch[0].length)
				: message;
			const searchToken = contentAfterPrefix.slice(0, 40).trim();

			// Also use [CHAT: as a secondary token if message has a CHAT prefix
			const chatToken = chatPrefixMatch ? '[CHAT:' : null;

			// Check last 20 non-empty lines for either token.
			// Gemini CLI TUI has status bars at the bottom (branch, sandbox, model info)
			// that push input content further up. 5 lines was insufficient.
			const lines = output.split('\n').filter((line) => line.trim().length > 0);
			const linesToCheck = lines.slice(-20);

			const isStuck = linesToCheck.some((line) => {
				// Strip TUI box-drawing borders before checking (Gemini CLI wraps content in │...│)
				const stripped = line.replace(/^[│┃║|\s]+/, '').replace(/[│┃║|\s]+$/, '');
				if (searchToken && (line.includes(searchToken) || stripped.includes(searchToken))) return true;
				if (chatToken && (line.includes(chatToken) || stripped.includes(chatToken))) return true;
				return false;
			});

			this.logger.debug('isMessageStuckAtPrompt result', {
				sessionName,
				isStuck,
				searchToken: searchToken.slice(0, 20),
				linesChecked: linesToCheck.length,
			});

			return isStuck;
		} catch (error) {
			this.logger.warn('Error checking if message stuck at prompt', {
				sessionName,
				error: error instanceof Error ? error.message : String(error),
			});
			return false;
		}
	}

	/**
	 * Check if Claude Code appears to be at an input prompt.
	 * Looks for common prompt indicators in terminal output.
	 *
	 * @param terminalOutput - The terminal output to check
	 * @returns true if Claude Code appears to be at a prompt
	 */
	private isClaudeAtPrompt(terminalOutput: string): boolean {
		// Handle null/undefined/empty input gracefully
		if (!terminalOutput || typeof terminalOutput !== 'string') {
			this.logger.debug('Terminal output is empty or invalid, assuming at prompt');
			return true; // Assume at prompt if no output (safer for message delivery)
		}

		// Only analyze the tail of the buffer to avoid matching historical prompts
		const tailSection = terminalOutput.slice(-2000);

		// Check for prompt FIRST. Processing indicators like "thinking" or "analyzing"
		// can appear in the agent's previous response text and persist in the terminal
		// scroll buffer, causing false negatives if checked before the prompt.
		if (TERMINAL_PATTERNS.PROMPT_STREAM.test(tailSection)) {
			return true;
		}

		// Fallback: check last several lines for prompt indicators.
		// The prompt may not be on the very last line due to status bars,
		// notifications, or terminal wrapping below the prompt.
		const lines = tailSection.split('\n').filter((line) => line.trim().length > 0);
		const linesToCheck = lines.slice(-10);

		const hasPrompt = linesToCheck.some((line) => {
			const trimmed = line.trim();
			// Strip TUI box-drawing borders (│, ┃, etc.) that Gemini CLI wraps around prompts
			const stripped = trimmed.replace(/^[│┃|]+\s*/, '').replace(/\s*[│┃|]+$/, '');
			// Exact match for single-char prompts (❯, >, ⏵, $)
			if (AgentRegistrationService.CLAUDE_PROMPT_INDICATORS.some(
				(indicator) => trimmed === indicator || stripped === indicator
			)) {
				return true;
			}
			// Bypass permissions mode: line starts with ❯❯ followed by space
			if (trimmed.startsWith('❯❯ ')) {
				return true;
			}
			// Gemini CLI TUI prompt: > or ! followed by space (may have placeholder text)
			// Check both raw trimmed line and stripped (box-drawing removed) line
			if (trimmed.startsWith('> ') || trimmed.startsWith('! ') ||
				stripped.startsWith('> ') || stripped.startsWith('! ')) {
				return true;
			}
			return false;
		});

		if (hasPrompt) {
			return true;
		}

		// No prompt found — check if still processing. Only check the last few
		// lines to avoid matching words like "thinking" in historical response text.
		const recentLines = linesToCheck.slice(-5).join('\n');
		if (TERMINAL_PATTERNS.PROCESSING_WITH_TEXT.test(recentLines)) {
			this.logger.debug('Processing indicators present near bottom of output');
			return false;
		}

		return false;
	}

	/**
	 * Detect if Gemini CLI is currently in shell mode.
	 *
	 * In shell mode, Gemini CLI changes its prompt from `>` to `!`. Any input
	 * sent in this mode is executed as a shell command instead of being passed
	 * to the model. This method examines the last few lines of terminal output
	 * for shell mode prompt indicators.
	 *
	 * @param terminalOutput - Captured terminal pane content
	 * @returns true if the terminal shows a shell mode prompt
	 */
	private isGeminiInShellMode(terminalOutput: string): boolean {
		if (!terminalOutput || typeof terminalOutput !== 'string') {
			return false;
		}

		const lines = terminalOutput.split('\n').filter((line) => line.trim().length > 0);
		const linesToCheck = lines.slice(-10);

		return linesToCheck.some((line) => {
			const trimmed = line.trim();
			// Strip TUI box-drawing borders
			const stripped = trimmed.replace(/^[│┃|]+\s*/, '').replace(/\s*[│┃|]+$/, '');

			// Shell mode prompt: `!` alone or `! ` with text (not `> ` which is normal mode)
			// Check stripped line — after removing box-drawing, if it starts with `! ` or equals `!`
			if (stripped === '!' || stripped.startsWith('! ')) {
				return true;
			}

			// Also check pattern-based detection for bordered prompts
			return GEMINI_SHELL_MODE_CONSTANTS.SHELL_MODE_PROMPT_PATTERNS.some(
				(pattern) => pattern.test(trimmed)
			);
		});
	}

	/**
	 * Escape from Gemini CLI shell mode by sending Escape key.
	 *
	 * Sends Escape and waits for the prompt to change from `!` back to `>`.
	 * Retries up to MAX_ESCAPE_ATTEMPTS times.
	 *
	 * @param sessionName - The session running Gemini CLI
	 * @param sessionHelper - SessionCommandHelper instance
	 * @returns true if successfully escaped shell mode, false if still in shell mode
	 */
	private async escapeGeminiShellMode(
		sessionName: string,
		sessionHelper: SessionCommandHelper
	): Promise<boolean> {
		for (let attempt = 1; attempt <= GEMINI_SHELL_MODE_CONSTANTS.MAX_ESCAPE_ATTEMPTS; attempt++) {
			this.logger.info('Gemini CLI in shell mode, sending Escape to exit', {
				sessionName,
				attempt,
			});

			await sessionHelper.sendEscape(sessionName);
			await delay(GEMINI_SHELL_MODE_CONSTANTS.ESCAPE_DELAY_MS);

			// Check if we're back to normal mode
			const output = sessionHelper.capturePane(sessionName);
			if (!this.isGeminiInShellMode(output)) {
				this.logger.info('Successfully exited Gemini CLI shell mode', {
					sessionName,
					attempt,
				});
				return true;
			}
		}

		this.logger.warn('Failed to exit Gemini CLI shell mode after max attempts', {
			sessionName,
			maxAttempts: GEMINI_SHELL_MODE_CONSTANTS.MAX_ESCAPE_ATTEMPTS,
		});
		return false;
	}

	/**
	 * Generic key sending to any agent session
	 * @param sessionName The agent session name
	 * @param key The key to send (e.g., 'Enter', 'Ctrl+C')
	 * @returns Promise with success/error information
	 */
	async sendKeyToAgent(
		sessionName: string,
		key: string
	): Promise<{
		success: boolean;
		message?: string;
		error?: string;
	}> {
		try {
			// Get session helper once to avoid repeated async calls
			const sessionHelper = await this.getSessionHelper();

			// Check if session exists
			const sessionExists = sessionHelper.sessionExists(sessionName);
			if (!sessionExists) {
				return {
					success: false,
					error: `Session '${sessionName}' does not exist`,
				};
			}

			// Send key using session command helper
			await sessionHelper.sendKey(sessionName, key);

			this.logger.info('Key sent to agent successfully', {
				sessionName,
				key,
			});

			return {
				success: true,
				message: `${key} key sent to agent successfully`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error('Failed to send key to agent', {
				sessionName,
				key,
				error: errorMessage,
			});

			return {
				success: false,
				error: errorMessage,
			};
		}
	}

	/**
	 * Generic health check for any agent session
	 * @param sessionName The agent session name
	 * @param role The agent role for additional context
	 * @param timeout Timeout for health check in milliseconds
	 * @returns Promise with health status information
	 */
	async checkAgentHealth(
		sessionName: string,
		role?: string,
		timeout: number = 1000
	): Promise<{
		success: boolean;
		data?: {
			agent: {
				sessionName: string;
				role?: string;
				running: boolean;
				status: (typeof AGENTMUX_CONSTANTS.AGENT_STATUSES)[keyof typeof AGENTMUX_CONSTANTS.AGENT_STATUSES];
			};
			timestamp: string;
		};
		error?: string;
	}> {
		try {
			// Lightweight health check with timeout
			const agentRunning = await Promise.race([
				(await this.getSessionHelper()).sessionExists(sessionName),
				new Promise<boolean>((_, reject) =>
					setTimeout(() => reject(new Error('Health check timeout')), timeout)
				),
			]).catch(() => false);

			return {
				success: true,
				data: {
					agent: {
						sessionName,
						role,
						running: agentRunning,
						status: agentRunning
							? AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVE
							: AGENTMUX_CONSTANTS.AGENT_STATUSES.INACTIVE,
					},
					timestamp: new Date().toISOString(),
				},
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error('Failed to check agent health', {
				sessionName,
				role,
				error: errorMessage,
			});

			return {
				success: false,
				error: errorMessage,
			};
		}
	}

	/**
	 * Write the prompt to a file and send a short instruction to the agent to read it.
	 *
	 * Instead of pasting large multi-line prompts directly into the terminal (which
	 * causes bracketed paste issues, shell interpretation errors, and truncation),
	 * we write the prompt to ~/.agentmux/prompts/{sessionName}-init.md and send a
	 * single-line instruction telling the agent to read that file.
	 *
	 * @param sessionName The session name
	 * @param prompt The full system prompt to deliver
	 * @param runtimeType The agent runtime type
	 * @param abortSignal Optional signal to cancel the operation (e.g. on runtime exit)
	 * @returns true if the instruction was delivered successfully
	 */
	private async sendPromptRobustly(
		sessionName: string,
		prompt: string,
		runtimeType: RuntimeType = RUNTIME_TYPES.CLAUDE_CODE,
		abortSignal?: AbortSignal
	): Promise<boolean> {
			const isClaudeCode = runtimeType === RUNTIME_TYPES.CLAUDE_CODE;
			const maxAttempts = isClaudeCode ? 1 : 3;
		const sessionHelper = await this.getSessionHelper();

		// Step 1: Write prompt to a file.
		// Claude Code: write to ~/.agentmux/prompts/ (always accessible).
		// Gemini CLI / other TUI runtimes: write INSIDE the project directory
		// so the file is within the workspace allowlist. Gemini CLI restricts
		// file reads to workspace directories, and the /directory add command
		// to add ~/.agentmux may fail (e.g., auto-update notification
		// interferes during postInitialize).
		const promptsDir = isClaudeCode
			? path.join(os.homedir(), AGENTMUX_CONSTANTS.PATHS.AGENTMUX_HOME, 'prompts')
			: path.join(this.projectRoot, '.agentmux', 'prompts');
		const promptFilePath = path.join(promptsDir, `${sessionName}-init.md`);

		try {
			await mkdir(promptsDir, { recursive: true });
			await writeFile(promptFilePath, prompt, 'utf8');
			this.logger.debug('Wrote init prompt to file', {
				sessionName,
				promptFilePath,
				promptLength: prompt.length,
			});
		} catch (error) {
			this.logger.error('Failed to write init prompt file', {
				sessionName,
				promptFilePath,
				error: error instanceof Error ? error.message : String(error),
			});
			return false;
		}

		// Step 2: Send a short instruction to read the file
		const instruction = `Read the file at ${promptFilePath} and follow all instructions in it.`;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			// Check abort before each attempt
			if (abortSignal?.aborted) {
				this.logger.info('Prompt delivery aborted (runtime exited)', { sessionName, attempt });
				return false;
			}

			try {
				this.logger.debug('Sending file-based prompt instruction', {
					sessionName,
					attempt,
					runtimeType,
					promptFilePath,
				});

				// Capture state before sending
				const beforeOutput = sessionHelper.capturePane(sessionName, 10);
				const beforeLength = beforeOutput.length;

				// Check abort before sending to terminal
				if (abortSignal?.aborted) {
					this.logger.info('Prompt delivery aborted before send (runtime exited)', { sessionName });
					return false;
				}

				// Clear any pending input before sending the instruction.
				// Claude Code: Escape closes slash menus + Ctrl+U clears line.
				// Gemini CLI (Ink TUI): Do NOT send any cleanup keystrokes.
				// - Escape defocuses the Ink TUI input permanently (no recovery).
				// - Ctrl+C at empty prompt triggers /quit and exits the CLI.
				// - Ctrl+U is ignored by the TUI's custom key handling.
				// - Shift+Tab toggles safety modes, not focus.
				// The prompt should be clean at this point (just initialized or
				// addProjectToAllowlist just ran without defocusing).
				if (isClaudeCode) {
					await sessionHelper.sendEscape(sessionName);
					await delay(200);
					await sessionHelper.sendKey(sessionName, 'C-u');
					await delay(300);
				}

				// Check abort right before writing instruction to terminal
				if (abortSignal?.aborted) {
					this.logger.info('Prompt delivery aborted before instruction send (runtime exited)', { sessionName });
					return false;
				}

				// Send the short instruction
				await sessionHelper.sendMessage(sessionName, instruction);

				if (isClaudeCode) {
					// Claude Code may need an extra Enter after bracketed paste
					await delay(1000);
					if (abortSignal?.aborted) return false;
					await sessionHelper.sendEnter(sessionName);
				}

				// Wait for agent to start processing
				await delay(3000);

				if (abortSignal?.aborted) return false;

				// Verify delivery
				const afterOutput = sessionHelper.capturePane(sessionName, 20);
				const afterLength = afterOutput.length;
				const lengthIncrease = afterLength - beforeLength;
				const hasProcessingIndicators = /thinking|processing|analyzing|registering|reading/i.test(
					afterOutput
				);

				if (lengthIncrease > 20 || hasProcessingIndicators) {
					this.logger.debug('Prompt instruction delivered successfully', {
						sessionName,
						attempt,
						lengthIncrease,
						hasProcessingIndicators,
						runtimeType,
					});
					return true;
				}

				this.logger.warn('Prompt instruction delivery may have failed - retrying', {
					sessionName,
					attempt,
					lengthIncrease,
					runtimeType,
				});

				if (attempt < maxAttempts) {
					await delay(1000);
				}
			} catch (error) {
				this.logger.error('Error during prompt instruction delivery', {
					sessionName,
					attempt,
					runtimeType,
					error: error instanceof Error ? error.message : String(error),
				});

				if (attempt === maxAttempts) {
					return false;
				}
			}
		}

		this.logger.error('Failed to deliver prompt instruction after all attempts', {
			sessionName,
			maxAttempts,
			runtimeType,
		});
		return false;
	}
}
