import * as path from 'path';
import { readFile } from 'fs/promises';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import {
	SessionCommandHelper,
	createSessionCommandHelper,
	getSessionBackendSync,
	createSessionBackend,
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
} from '../../constants.js';
import { delay } from '../../utils/async.utils.js';

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
		runtimeType: RuntimeType = RUNTIME_TYPES.CLAUDE_CODE
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
				runtimeType
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
					runtimeType
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
		// First clear any existing stuff
		await (await this.getSessionHelper()).sendCtrlC(sessionName);

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

		// Send Ctrl+C to cancel any pending slash command from detection
		await (await this.getSessionHelper()).sendCtrlC(sessionName);

		const prompt = await this.loadRegistrationPrompt(role, sessionName, memberId);
		const promptDelivered = await this.sendPromptRobustly(sessionName, prompt);

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
		runtimeType: RuntimeType = RUNTIME_TYPES.CLAUDE_CODE
	): Promise<boolean> {
		// Clear Commandline
		await (await this.getSessionHelper()).clearCurrentCommandLine(sessionName);

		// Reinitialize runtime using the appropriate initialization script
		// runtimeService2: Fresh instance for runtime reinitialization after cleanup
		// New instance ensures clean state without cached detection results
		const runtimeService2 = this.createRuntimeService(runtimeType);
		await runtimeService2.executeRuntimeInitScript(sessionName, projectPath);

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

		// For PTY sessions, once runtime is detected as ready, consider initialization successful
		// MCP registration will happen async when the agent processes its first prompt
		this.logger.info('Runtime detected as ready, session initialization successful', {
			sessionName,
			role,
			runtimeType,
		});

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
	 * Send registration prompt asynchronously (non-blocking)
	 */
	private async sendRegistrationPromptAsync(
		sessionName: string,
		role: string,
		memberId?: string,
		runtimeType: RuntimeType = RUNTIME_TYPES.CLAUDE_CODE
	): Promise<void> {
		try {
			const prompt = await this.loadRegistrationPrompt(role, sessionName, memberId);
			await this.sendPromptRobustly(sessionName, prompt);
			this.logger.debug('Registration prompt sent asynchronously', { sessionName, role });
		} catch (error) {
			this.logger.warn('Failed to send registration prompt asynchronously', {
				sessionName,
				error: error instanceof Error ? error.message : String(error),
			});
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
		runtimeType: RuntimeType = RUNTIME_TYPES.CLAUDE_CODE
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

			// Initialize runtime for orchestrator using script (stay in agentmux project)
			const runtimeService = this.createRuntimeService(runtimeType);
			await runtimeService.executeRuntimeInitScript(sessionName, process.cwd());

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
			// For other roles, create basic session and initialize Claude
			await (await this.getSessionHelper()).createSession(sessionName, projectPath || process.cwd());

			// Initialize runtime using the initialization script
			const runtimeService = this.createRuntimeService(runtimeType);
			await runtimeService.executeRuntimeInitScript(sessionName, projectPath);

			// Wait for runtime to be ready (simplified detection)
			const checkInterval = this.getCheckInterval();
			const isReady = await this.createRuntimeService(runtimeType)
				.waitForRuntimeReady(sessionName, 25000, checkInterval); // 25s timeout
			if (!isReady) {
				throw new Error(
					`Failed to initialize ${runtimeType} in recreated session within timeout`
				);
			}
		}

		// For PTY sessions, once runtime is detected as ready, consider initialization successful
		this.logger.info('Runtime detected as ready after full recreation, session initialization successful', {
			sessionName,
			role,
			runtimeType,
		});

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
			// Create cache key based on role and whether memberId is used
			const cacheKey = `${role}-${!!memberId}`;

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
			const memberIdApiParam = memberId ? `, "memberId": "${memberId}"` : '';

			return `# AgentMux Agent Registration

You are running in the **AgentMux multi-agent orchestration environment**.

## Registration Required

**IMMEDIATELY** register yourself with the AgentMux system.

### Primary Method: MCP Tool (Preferred)

Call the \`register_agent_status\` MCP tool with these parameters:
\`\`\`json
{
  "role": "${role}",
  "sessionName": "${sessionName}"${memberIdParam}
}
\`\`\`

### Fallback Method: Direct API Call

If the MCP tool is unavailable or fails, use curl to call the registration API directly:
\`\`\`bash
curl -X POST "http://localhost:8787/api/teams/members/register" \\
  -H "Content-Type: application/json" \\
  -d '{
    "role": "${role}",
    "sessionName": "${sessionName}"${memberIdApiParam},
    "status": "active",
    "registeredAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }'
\`\`\`

**IMPORTANT:** You MUST complete registration before proceeding. Try the MCP method first; only use the API fallback if MCP fails.

## Instructions

After successful registration, respond with:
\`\`\`
Agent registered and awaiting instructions from orchestrator.
Environment: AgentMux
Role: ${role}
Status: Active and ready for task assignments
\`\`\`

Then wait for explicit task assignments from the orchestrator.`;
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
				const promptDelivered = await this.sendPromptRobustly(sessionName, prompt);

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
	}): Promise<{
		success: boolean;
		sessionName?: string;
		message?: string;
		error?: string;
	}> {
		const { sessionName, role, projectPath = process.cwd(), windowName, memberId } = config;

		// Get runtime type from config or default to claude-code
		let runtimeType = config.runtimeType || RUNTIME_TYPES.CLAUDE_CODE;

		// For team members, try to get runtime type from storage
		if (!config.runtimeType && role !== ORCHESTRATOR_ROLE) {
			try {
				const teams = await this.storageService.getTeams();
				for (const team of teams) {
					const member = team.members?.find((m) => m.sessionName === sessionName);
					if (member && member.runtimeType) {
						runtimeType = member.runtimeType as RuntimeType;
						break;
					}
				}
			} catch (error) {
				this.logger.warn('Failed to get runtime type from storage, using default', {
					sessionName,
					role,
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

				// If recovery succeeded, set environment variables and return early
				if (recoverySuccess) {
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
				runtimeType
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

			// Update agent status to inactive (works for both orchestrator and team members)
			await this.storageService.updateAgentStatus(
				sessionName,
				AGENTMUX_CONSTANTS.AGENT_STATUSES.INACTIVE
			);
			this.logger.info('Agent status updated to inactive', { sessionName, role });

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
		message: string
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
			// This handles Claude Code's input state better than just clearing the line
			const delivered = await this.sendMessageWithRetry(sessionName, message);

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
	 * Send message using event-driven delivery with output stream subscription.
	 *
	 * This method subscribes to the terminal output stream to:
	 * 1. Detect when Claude is at a prompt (ready for input)
	 * 2. Send the message when ready
	 * 3. Confirm delivery via processing indicators in the stream
	 *
	 * @param sessionName - The session name
	 * @param message - The message to send
	 * @param timeoutMs - Maximum time to wait for delivery confirmation
	 * @returns true if message was delivered and processing confirmed
	 */
	private async sendMessageEventDriven(
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
			let deliveryConfirmed = false;
			let resolved = false;

			// Track all timeouts to prevent memory leaks (P1.1 fix)
			const pendingTimeouts: NodeJS.Timeout[] = [];
			const scheduleTimeout = (fn: () => void, delayMs: number): NodeJS.Timeout => {
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
						this.logger.debug('Processing detected, message accepted', { sessionName, attemptNum });
						buffer = ''; // Reset for processing indicator detection
						return;
					}

					if (attemptNum > MAX_ENTER_RETRIES) {
						this.logger.debug('Max Enter retries reached, proceeding', { sessionName });
						buffer = '';
						return;
					}

					sendEnterKey(attemptNum === 1 ? 'initial' : `retry-${attemptNum}`);

					// Schedule check and possible retry (using tracked timeout to prevent leaks)
					scheduleTimeout(() => {
						if (resolved) return;

						if (checkProcessingStarted()) {
							processingDetected = true;
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

			const timeoutId = setTimeout(() => {
				this.logger.debug('Event-driven delivery timed out', {
					sessionName,
					messageSent,
					enterSent,
					deliveryConfirmed,
					bufferLength: buffer.length,
				});
				cleanup();
				// Partial success if Enter was sent (message was fully submitted)
				resolve(enterSent);
			}, timeoutMs);

			// IMPORTANT: Check current terminal state immediately
			// Claude may already be at prompt with no new output coming
			const currentOutput = sessionHelper.capturePane(sessionName, 10);
			if (this.isClaudeAtPrompt(currentOutput)) {
				this.logger.debug('Claude already at prompt (immediate check)', { sessionName });
				sendMessageNow();
			}

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
	 * Uses event-driven delivery as primary method with polling fallback.
	 *
	 * @param sessionName - The session name
	 * @param message - The message to send
	 * @param maxAttempts - Maximum number of delivery attempts
	 * @returns true if message was delivered successfully
	 */
	private async sendMessageWithRetry(
		sessionName: string,
		message: string,
		maxAttempts: number = 3
	): Promise<boolean> {
		const sessionHelper = await this.getSessionHelper();

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				this.logger.debug('Attempting message delivery', {
					sessionName,
					attempt,
					maxAttempts,
					messageLength: message.length,
					method: 'event-driven',
				});

				// Try event-driven delivery first (primary method)
				const delivered = await this.sendMessageEventDriven(
					sessionName,
					message,
					EVENT_DELIVERY_CONSTANTS.PROMPT_DETECTION_TIMEOUT
				);

				if (delivered) {
					this.logger.debug('Message delivered via event-driven method', {
						sessionName,
						attempt,
					});
					return true;
				}

				// Event-driven failed, check if we need to clear terminal state
				// Only do this on first failed attempt to avoid interrupting processing
				if (attempt === 1) {
					const output = sessionHelper.capturePane(sessionName, 5);
					const isAtPrompt = this.isClaudeAtPrompt(output);

					if (!isAtPrompt) {
						this.logger.debug('Clearing terminal state before retry', { sessionName });
						await sessionHelper.sendEscape(sessionName);
						await delay(SESSION_COMMAND_DELAYS.CLAUDE_RECOVERY_DELAY);
					}
				}

				this.logger.warn('Event-driven delivery failed, retrying', {
					sessionName,
					attempt,
					nextAttempt: attempt < maxAttempts,
				});

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

		// Log exhaustion of all retries
		this.logger.error('Message delivery failed after all retry attempts', {
			sessionName,
			maxAttempts,
			messageLength: message.length,
		});

		return false;
	}

	// delay() utility is now imported from utils/async.utils.js

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

		// Check last few lines for prompt indicators
		const lines = terminalOutput.split('\n').filter((line) => line.trim().length > 0);
		const lastLine = lines[lines.length - 1] || '';

		return AgentRegistrationService.CLAUDE_PROMPT_INDICATORS.some(
			(indicator) => lastLine.includes(indicator)
		);
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
	 * Send system prompt with robust delivery mechanism to handle tmux race conditions
	 * @param sessionName The tmux session name
	 * @param prompt The system prompt to send
	 * @returns true if prompt was delivered successfully, false otherwise
	 */
	private async sendPromptRobustly(sessionName: string, prompt: string): Promise<boolean> {
		const maxAttempts = 3;
		// Get session helper once to avoid repeated async calls
		const sessionHelper = await this.getSessionHelper();

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				this.logger.debug('Attempting robust prompt delivery', {
					sessionName,
					attempt,
					promptLength: prompt.length,
				});

				// Capture state before sending
				const beforeOutput = sessionHelper.capturePane(sessionName, 10);
				const beforeLength = beforeOutput.length;

				// Clear the existing prompts if any
				await sessionHelper.sendCtrlC(sessionName);

				// Send the prompt with proper timing
				await sessionHelper.sendMessage(sessionName, prompt);

				// Claude Code with bracketed paste mode may need explicit Enter presses after paste
				// Send additional Enter keys to ensure the prompt is submitted
				await delay(500);
				await sessionHelper.sendEnter(sessionName);
				await delay(300);
				await sessionHelper.sendEnter(sessionName);

				// Wait for Claude to start processing
				await delay(3000);

				// Verify prompt was delivered and processed
				const afterOutput = sessionHelper.capturePane(sessionName, 20);
				const afterLength = afterOutput.length;

				// Check for signs of Claude processing the prompt
				const lengthIncrease = afterLength - beforeLength;
				const hasPromptInOutput = afterOutput.includes(prompt.substring(0, 100)); // Check first 100 chars
				const hasProcessingIndicators = /thinking|processing|analyzing|registering/i.test(
					afterOutput
				);

				if (lengthIncrease > 50 || hasProcessingIndicators || !hasPromptInOutput) {
					// Prompt appears to have been processed (content changed significantly)
					this.logger.debug(
						'Prompt delivery verified - Claude appears to be processing',
						{
							sessionName,
							attempt,
							lengthIncrease,
							hasProcessingIndicators,
						}
					);
					return true;
				}

				// If prompt is still visible and no processing detected, retry
				this.logger.warn('Prompt delivery may have failed - retrying', {
					sessionName,
					attempt,
					lengthIncrease,
					hasPromptInOutput,
					beforeLength,
					afterLength,
				});

				// Add longer delay before retry
				if (attempt < maxAttempts) {
					await delay(1000);
				}
			} catch (error) {
				this.logger.error('Error during robust prompt delivery', {
					sessionName,
					attempt,
					error: error instanceof Error ? error.message : String(error),
				});

				if (attempt === maxAttempts) {
					return false;
				}
			}
		}

		this.logger.error('Failed to deliver prompt after all attempts', {
			sessionName,
			maxAttempts,
		});
		return false;
	}
}
