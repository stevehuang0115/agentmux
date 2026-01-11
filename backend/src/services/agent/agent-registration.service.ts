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
} from '../../constants.js';

export interface TeamRole {
	key: string;
	displayName: string;
	promptFile: string;
	description: string;
	category: string;
	hidden?: boolean;
	isDefault?: boolean;
}

export interface TeamRolesConfig {
	roles: TeamRole[];
}

export interface OrchestratorConfig {
	sessionName: string;
	projectPath: string;
	windowName?: string;
}

/**
 * Service responsible for the complex, multi-step process of agent initialization and registration.
 * Isolates the complex state management of agent startup with progressive escalation.
 */
export class AgentRegistrationService {
	private logger: ComponentLogger;
	private _sessionHelper: SessionCommandHelper | null = null;
	private storageService: StorageService;
	private projectRoot: string;

	// Prompt file caching to eliminate file I/O contention during concurrent session creation
	private promptCache = new Map<string, string>();

	// Team roles configuration cache
	private teamRolesConfig: TeamRolesConfig | null = null;

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
		if (this._sessionHelper) {
			return this._sessionHelper;
		}

		let backend = getSessionBackendSync();
		if (!backend) {
			backend = await createSessionBackend('pty');
		}

		this._sessionHelper = createSessionCommandHelper(backend);
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
	 * Load team roles configuration from available_team_roles.json
	 */
	private async loadTeamRolesConfig(): Promise<TeamRolesConfig> {
		if (this.teamRolesConfig) {
			return this.teamRolesConfig;
		}

		try {
			const configPath = path.join(process.cwd(), 'config', 'teams', 'available_team_roles.json');
			const configContent = await readFile(configPath, 'utf8');
			this.teamRolesConfig = JSON.parse(configContent) as TeamRolesConfig;
			this.logger.debug('Team roles configuration loaded', {
				rolesCount: this.teamRolesConfig.roles.length
			});
			return this.teamRolesConfig;
		} catch (error) {
			this.logger.error('Failed to load team roles configuration', {
				error: error instanceof Error ? error.message : String(error),
			});
			throw new Error('Could not load team roles configuration');
		}
	}

	/**
	 * Get prompt file path for a specific role using the team roles configuration
	 */
	private async getPromptFileForRole(role: string): Promise<string> {
		const config = await this.loadTeamRolesConfig();
		const roleConfig = config.roles.find(r => r.key === role);

		if (!roleConfig) {
			throw new Error(`Role '${role}' not found in team roles configuration`);
		}

		// Determine the correct directory based on role
		if (role === 'orchestrator') {
			return path.join(process.cwd(), 'config', 'orchestrator_tasks', 'prompts', roleConfig.promptFile);
		} else {
			return path.join(process.cwd(), 'config', 'teams', 'prompts', roleConfig.promptFile);
		}
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
		const runtimeService = RuntimeServiceFactory.create(
			runtimeType,
			null, // Legacy tmux parameter - ignored by RuntimeServiceFactory
			this.projectRoot
		);
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
		const runtimeService2 = RuntimeServiceFactory.create(
			runtimeType,
			null, // Legacy tmux parameter - ignored by RuntimeServiceFactory
			this.projectRoot
		);
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
		const runtimeService2 = RuntimeServiceFactory.create(
			runtimeType,
			null, // Legacy tmux parameter - ignored by RuntimeServiceFactory
			this.projectRoot
		);
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

		// Fast verification and registration with retry (skip Ctrl+C since runtime was just initialized)
		return await this.attemptRegistrationWithVerification(
			sessionName,
			role,
			timeout,
			memberId,
			3,
			true,
			runtimeType
		);
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
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Recreate session based on role
		if (role === ORCHESTRATOR_ROLE) {
			await this.createOrchestratorSession({
				sessionName,
				projectPath: projectPath || process.cwd(),
			});

			// Initialize runtime for orchestrator using script (stay in agentmux project)
			const runtimeService = RuntimeServiceFactory.create(
				runtimeType,
				null, // Legacy tmux parameter - ignored by RuntimeServiceFactory
				this.projectRoot
			);
			await runtimeService.executeRuntimeInitScript(sessionName, process.cwd());

			// Wait for runtime to be ready
			// Use shorter check interval in test environment
			const checkInterval = process.env.NODE_ENV === 'test' ? 1000 : 2000;
			// runtimeService3: Separate instance for orchestrator ready-state detection
			// Isolated from runtimeService to prevent interference between init and ready checks
			const runtimeService3 = RuntimeServiceFactory.create(
				runtimeType,
				null, // Legacy tmux parameter - ignored by RuntimeServiceFactory
				this.projectRoot
			);
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
			await new Promise((resolve) => setTimeout(resolve, 5000));

			this.logger.debug('Verifying orchestrator runtime responsiveness', {
				sessionName,
				runtimeType,
			});
			// runtimeService4: Final verification instance for orchestrator responsiveness
			// Clean instance for post-initialization responsiveness testing
			const runtimeService4 = RuntimeServiceFactory.create(
				runtimeType,
				null, // Legacy tmux parameter - ignored by RuntimeServiceFactory
				this.projectRoot
			);
			const runtimeResponding = await runtimeService4.detectRuntimeWithCommand(sessionName);
			if (!runtimeResponding) {
				throw new Error(
					`${runtimeType} not responding to commands after orchestrator recreation`
				);
			}

			this.logger.debug(
				'Runtime confirmed ready for orchestrator in Step 3, sending registration prompt',
				{ sessionName, runtimeType }
			);

			// Send Ctrl+C to cancel any pending slash command from detection
			await (await this.getSessionHelper()).sendCtrlC(sessionName);
		} else {
			// For other roles, create basic session and initialize Claude
			await (await this.getSessionHelper()).createSession(sessionName, projectPath || process.cwd());

			// Initialize runtime using the initialization script
			const runtimeService = RuntimeServiceFactory.create(
				runtimeType,
				null, // Legacy tmux parameter - ignored by RuntimeServiceFactory
				this.projectRoot
			);
			await runtimeService.executeRuntimeInitScript(sessionName, projectPath);

			// Wait for runtime to be ready (simplified detection)
			// Use shorter check interval in test environment
			const checkInterval = process.env.NODE_ENV === 'test' ? 1000 : 2000;
			const isReady = await RuntimeServiceFactory.create(
				runtimeType,
				null, // Legacy tmux parameter - ignored by RuntimeServiceFactory
				this.projectRoot
			).waitForRuntimeReady(sessionName, 25000, checkInterval); // 25s timeout
			if (!isReady) {
				throw new Error(
					`Failed to initialize ${runtimeType} in recreated session within timeout`
				);
			}
		}

		// Use enhanced registration with verification (skip Ctrl+C since runtime was just initialized)
		return await this.attemptRegistrationWithVerification(
			sessionName,
			role,
			timeout,
			memberId,
			3,
			true,
			runtimeType
		);
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
			console.error(`ERROR: Could not load prompt from config for role '${role}':`, error);

			// Try to get the attempted path for error logging
			let attemptedPath: string = 'unknown';
			try {
				attemptedPath = await this.getPromptFileForRole(role);
			} catch {
				attemptedPath = `config/${role === 'orchestrator' ? 'orchestrator_tasks' : 'teams'}/prompts/${role}-prompt.md`;
			}

			this.logger.error('Could not load prompt from config, using fallback', {
				role,
				promptPath: attemptedPath,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});

			return `Please immediately run: register_agent_status with parameters {"role": "${role}", "sessionName": "${sessionName}"}`;
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

				await new Promise((resolve) => setTimeout(resolve, checkInterval));
			} catch (error) {
				this.logger.warn('Error checking registration', {
					sessionName,
					role,
					error: error instanceof Error ? error.message : String(error),
				});
				await new Promise((resolve) => setTimeout(resolve, checkInterval));
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
					await new Promise((resolve) => setTimeout(resolve, 500));
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
					// runtimeService5: Runtime detection instance for retry attempts
					// Separate instance allows force refresh without affecting other detection operations
					const runtimeService5 = RuntimeServiceFactory.create(
						runtimeType,
						null, // Legacy tmux parameter - ignored by RuntimeServiceFactory
						this.projectRoot
					);
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
						// runtimeService6: Cache clearing instance for failed detection recovery
						// Dedicated instance for clearing detection cache without disrupting ongoing operations
						const runtimeService6 = RuntimeServiceFactory.create(
							runtimeType,
							null, // Legacy tmux parameter - ignored by RuntimeServiceFactory
							this.projectRoot
						);
						runtimeService6.clearDetectionCache(sessionName);

						// Add longer delay between failed detection attempts
						if (attempt < maxRetries) {
							await new Promise((resolve) => setTimeout(resolve, 2000));
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
				await new Promise((resolve) => setTimeout(resolve, 1000));
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

				await new Promise((resolve) => setTimeout(resolve, fastCheckInterval));
			} catch (error) {
				this.logger.debug('Error in fast registration check', {
					sessionName,
					role,
					error: error instanceof Error ? error.message : String(error),
				});
				await new Promise((resolve) => setTimeout(resolve, 1000)); // Shorter error delay
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
			});

			// Check if session already exists
			const sessionExists = await (await this.getSessionHelper()).sessionExists(sessionName);

			if (!sessionExists) {
				// Session doesn't exist, go directly to creating a new session
				this.logger.info('Session does not exist, creating new session', { sessionName });
			} else {
				this.logger.info(
					'Session already exists, attempting intelligent recovery instead of killing',
					{
						sessionName,
					}
				);

				// Step 1: Try to detect if runtime is already running using slash command
				const runtimeService = RuntimeServiceFactory.create(
					runtimeType,
					null, // Legacy tmux parameter - ignored by RuntimeServiceFactory
					this.projectRoot
				);

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
						await new Promise((resolve) => setTimeout(resolve, 1000));
						await (await this.getSessionHelper()).sendCtrlC(sessionName);
						await new Promise((resolve) => setTimeout(resolve, 2000));

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
				await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for cleanup
			}

			// Create new session (same approach for both orchestrator and team members)
			await (await this.getSessionHelper()).createSession(sessionName, projectPath || process.cwd());

			// Set environment variables for MCP connection
			await (await this.getSessionHelper()).setEnvironmentVariable(
				sessionName,
				ENV_CONSTANTS.TMUX_SESSION_NAME,
				sessionName
			);
			await (await this.getSessionHelper()).setEnvironmentVariable(
				sessionName,
				ENV_CONSTANTS.AGENTMUX_ROLE,
				role
			);

			this.logger.info('Agent session created, initializing with registration', {
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

			const sessionExists = await (await this.getSessionHelper()).sessionExists(sessionName);

			if (sessionExists) {
				// Kill the tmux session
				await (await this.getSessionHelper()).killSession(sessionName);
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
	 * Generic message sending to any agent session
	 * @param sessionName The agent session name
	 * @param message The message to send
	 * @returns Promise with success/error information
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

			// Check if session exists
			const sessionExists = await (await this.getSessionHelper()).sessionExists(sessionName);
			if (!sessionExists) {
				return {
					success: false,
					error: `Session '${sessionName}' does not exist`,
				};
			}

			// Clear the terminal first
			await (await this.getSessionHelper()).clearCurrentCommandLine(sessionName);

			// Send message using tmux command service
			await (await this.getSessionHelper()).sendMessage(sessionName, message);

			// Note: sendMessage already includes Enter key with 1000ms delay

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
			// Check if session exists
			const sessionExists = await (await this.getSessionHelper()).sessionExists(sessionName);
			if (!sessionExists) {
				return {
					success: false,
					error: `Session '${sessionName}' does not exist`,
				};
			}

			// Send key using tmux command service
			await (await this.getSessionHelper()).sendKey(sessionName, key);

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

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				this.logger.debug('Attempting robust prompt delivery', {
					sessionName,
					attempt,
					promptLength: prompt.length,
				});

				// Capture state before sending
				const beforeOutput = await (await this.getSessionHelper()).capturePane(sessionName, 10);
				const beforeLength = beforeOutput.length;

				// Clear the existing prompts if any
				await (await this.getSessionHelper()).sendCtrlC(sessionName);

				// Send the prompt with proper timing
				await (await this.getSessionHelper()).sendMessage(sessionName, prompt);

				// Note: sendMessage already includes Enter key with 1000ms delay
				// Additional delay for processing to begin
				await new Promise((resolve) => setTimeout(resolve, 2000));

				// Wait for processing to begin
				await new Promise((resolve) => setTimeout(resolve, 2000));

				// Verify prompt was delivered and processed
				const afterOutput = await (await this.getSessionHelper()).capturePane(sessionName, 20);
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
					await new Promise((resolve) => setTimeout(resolve, 1000));
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
