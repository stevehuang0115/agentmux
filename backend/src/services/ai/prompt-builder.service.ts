import { readFile, access } from 'fs/promises';
import * as path from 'path';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import { TeamMemberSessionConfig, SOPRole } from '../../types/index.js';
import { MemoryService } from '../memory/memory.service.js';
import { SOPService } from '../sop/sop.service.js';
import { getRoleService } from '../settings/role.service.js';

/**
 * Options for building system prompts
 */
export interface PromptOptions {
  /** Agent's role */
  role?: string;
  /** Current task context for SOP selection */
  taskContext?: string;
  /** Task type for SOP matching */
  taskType?: string;
  /** Whether to include memory context (default: true) */
  includeMemory?: boolean;
  /** Whether to include SOPs (default: true) */
  includeSOPs?: boolean;
  /** Maximum number of SOPs to include */
  sopLimit?: number;
  /** Maximum number of memory entries to include */
  memoryLimit?: number;
  /** Force reload context instead of using cache */
  freshContext?: boolean;
}

/**
 * Parts that compose a complete prompt
 */
interface PromptParts {
  /** Base role instructions */
  basePrompt: string;
  /** Project context from context loader */
  projectContext?: string;
  /** Memory context from memory service */
  memoryContext?: string;
  /** SOP context (for future use) */
  sopContext?: string;
  /** Project name */
  projectName?: string;
  /** Project path */
  projectPath?: string;
  /** Session name */
  sessionName?: string;
  /** Member ID */
  memberId?: string;
  /** Role */
  role?: string;
  /** Team ID */
  teamId?: string;
}

/**
 * Service dedicated to building and loading the various prompts used to communicate with agents.
 * Handles prompt templating, variable substitution, and fallback prompt generation.
 */
export class PromptBuilderService {
	private logger: ComponentLogger;
	private readonly projectRoot: string;
	private readonly rolesDirectory: string;
	/** Absolute path to agent skill scripts (used in prompts so agents can find them from any working directory) */
	private readonly agentSkillsPath: string;
	private memoryService: MemoryService | null = null;
	private sopService: SOPService | null = null;

	constructor(projectRoot: string = process.cwd()) {
		this.logger = LoggerService.getInstance().createComponentLogger('PromptBuilderService');
		this.projectRoot = projectRoot;
		this.rolesDirectory = path.join(projectRoot, 'config', 'roles');
		this.agentSkillsPath = path.join(projectRoot, 'config', 'skills', 'agent');
	}

	/**
	 * Gets the MemoryService instance (lazy initialization)
	 *
	 * @returns The MemoryService singleton
	 */
	private getMemoryService(): MemoryService {
		if (!this.memoryService) {
			this.memoryService = MemoryService.getInstance();
		}
		return this.memoryService;
	}

	/**
	 * Gets the SOPService instance (lazy initialization)
	 *
	 * @returns The SOPService singleton
	 */
	private getSOPService(): SOPService {
		if (!this.sopService) {
			this.sopService = SOPService.getInstance();
		}
		return this.sopService;
	}

	/**
	 * Build orchestrator prompt for project management
	 */
	buildOrchestratorPrompt(projectData: {
		projectName: string;
		projectPath: string;
		teamDetails: any;
		requirements?: string;
	}): string {
		const { projectName, projectPath, teamDetails, requirements } = projectData;

		const teamMembers = Array.isArray(teamDetails.members)
			? teamDetails.members
					.map(
						(member: any) =>
							`- ${member.name}: ${member.role} (${member.skills || 'General'})`
					)
					.join('\n')
			: 'No team members specified';

		const prompt =
			`I need you to build a full-stack application. The specifications are in ${projectPath}

Please:
1. Create a ${teamDetails.name || 'development team'} (${teamMembers
				.replace(/- /g, '')
				.replace(/\n/g, ' + ')})
2. Have them build according to the specs in ${projectPath}/.agentmux/specs/
3. Ensure 30-minute git commits
4. Coordinate the team to work on Phase 1 simultaneously

## Project: ${projectName}
**Path**: ${projectPath}
**Requirements**: ${requirements || 'See project documentation in .agentmux/specs/'}

## Team Structure
${teamMembers}

## Your Role as Orchestrator
You are managing the "${projectName}" project. The team sessions have been created for you. Monitor progress, coordinate work between team members, and ensure git commits happen every 30 minutes.

The team is ready to start. Begin by reviewing the project specs and coordinating the team to start Phase 1 development.

Start all teams on Phase 1 simultaneously.`.trim();

		this.logger.debug('Built orchestrator prompt', {
			projectName,
			teamMembersCount: teamDetails.members?.length || 0,
			promptLength: prompt.length,
		});

		return prompt;
	}

	/**
	 * Build system prompt for Claude Code agent
	 * Loads prompts from config/roles/{role}/prompt.md
	 */
	async buildSystemPrompt(config: TeamMemberSessionConfig): Promise<string> {
		// Normalize role name to directory name format
		const roleName = config.role.toLowerCase().replace(/\s+/g, '-');

		// Try to load role-specific prompt from config/roles/{role}/prompt.md
		const promptPath = path.resolve(this.rolesDirectory, roleName, 'prompt.md');

		try {
			await access(promptPath);
			let promptContent = await readFile(promptPath, 'utf8');

			// Replace template variables
			promptContent = this.replaceTemplateVariables(promptContent, {
				SESSION_NAME: config.name || 'unknown',
				SESSION_ID: config.name || 'unknown',
				ROLE: config.role,
				PROJECT_PATH: config.projectPath || 'Not specified',
				MEMBER_ID: config.memberId || '',
				AGENT_SKILLS_PATH: this.agentSkillsPath,
			});

			this.logger.info('Loaded role-specific system prompt', {
				role: config.role,
				promptPath,
				promptLength: promptContent.length,
			});

			return promptContent.trim();
		} catch (error) {
			// Fallback to generic prompt if specific role prompt not found
			this.logger.warn(`Role-specific prompt not found: ${promptPath}, using fallback`, {
				role: config.role,
			});

			return this.buildFallbackSystemPrompt(config);
		}
	}

	/**
	 * Build system prompt with memory and SOP context included
	 *
	 * This method builds a complete system prompt that includes:
	 * - Base role instructions
	 * - Project context
	 * - Memory context (agent and project memories)
	 * - SOP context (relevant Standard Operating Procedures)
	 * - Agent identity information
	 *
	 * @param config - Session configuration
	 * @param options - Prompt building options
	 * @returns Complete system prompt with memory and SOPs
	 *
	 * @example
	 * ```typescript
	 * const prompt = await promptBuilder.buildSystemPromptWithMemory(config, {
	 *   includeMemory: true,
	 *   includeSOPs: true,
	 *   taskContext: 'implementing authentication',
	 *   role: 'developer'
	 * });
	 * ```
	 */
	async buildSystemPromptWithMemory(
		config: TeamMemberSessionConfig,
		options: PromptOptions = {}
	): Promise<string> {
		const includeMemory = options.includeMemory !== false;
		const includeSOPs = options.includeSOPs !== false;

		// Get base prompt
		const basePrompt = await this.buildSystemPrompt(config);

		// Build memory context if enabled
		let memoryContext = '';
		if (includeMemory && config.projectPath && config.memberId) {
			memoryContext = await this.buildMemoryContext(
				config.memberId,
				config.projectPath,
				options
			);
		}

		// Build SOP context if enabled
		let sopContext = '';
		if (includeSOPs) {
			sopContext = await this.buildSOPContext(
				config.role,
				options.taskContext,
				options.taskType,
				options.sopLimit
			);
		}

		// Compose final prompt with memory and SOPs
		if (memoryContext || sopContext) {
			return this.composePromptWithMemory({
				basePrompt,
				memoryContext,
				sopContext,
				sessionName: config.name,
				memberId: config.memberId,
				role: config.role,
				projectPath: config.projectPath,
			});
		}

		return basePrompt;
	}

	/**
	 * Build memory context from agent and project memories
	 *
	 * @param agentId - Agent identifier
	 * @param projectPath - Project path
	 * @param options - Prompt options
	 * @returns Formatted memory context string
	 */
	async buildMemoryContext(
		agentId: string,
		projectPath: string,
		options: PromptOptions = {}
	): Promise<string> {
		try {
			const memoryService = this.getMemoryService();

			// Initialize memory for session if needed
			await memoryService.initializeForSession(
				agentId,
				options.role || 'developer',
				projectPath
			);

			// Get full context from memory service
			const fullContext = await memoryService.getFullContext(agentId, projectPath);

			if (!fullContext || fullContext.trim().length === 0) {
				this.logger.debug('No memory context available', { agentId, projectPath });
				return '';
			}

			this.logger.debug('Built memory context', {
				agentId,
				projectPath,
				contextLength: fullContext.length,
			});

			return `
## Your Knowledge Base

This is your accumulated knowledge from previous sessions. Use it to work more effectively.

${fullContext}

**Note:** You can add new knowledge using the \`remember\` tool and recall specific memories using the \`recall\` tool.
`.trim();
		} catch (error) {
			this.logger.warn('Failed to build memory context', {
				agentId,
				projectPath,
				error: error instanceof Error ? error.message : String(error),
			});
			return '';
		}
	}

	/**
	 * Build SOP context from relevant SOPs for the agent's role and task
	 *
	 * @param role - Agent's role
	 * @param taskContext - Current task context for SOP matching
	 * @param taskType - Type of task being performed
	 * @param limit - Maximum number of SOPs to include
	 * @returns Formatted SOP context string
	 */
	async buildSOPContext(
		role: string,
		taskContext?: string,
		taskType?: string,
		limit?: number
	): Promise<string> {
		try {
			const sopService = this.getSOPService();

			// Generate SOP context based on role and task
			const sopContext = await sopService.generateSOPContext({
				role: role as SOPRole | 'all',
				taskContext: taskContext || '',
				taskType,
				limit,
			});

			if (!sopContext || sopContext.trim().length === 0) {
				this.logger.debug('No SOP context available', { role, taskContext });
				return '';
			}

			this.logger.debug('Built SOP context', {
				role,
				taskContext,
				contextLength: sopContext.length,
			});

			return sopContext;
		} catch (error) {
			this.logger.warn('Failed to build SOP context', {
				role,
				taskContext,
				error: error instanceof Error ? error.message : String(error),
			});
			return '';
		}
	}

	/**
	 * Compose a prompt with memory and SOP context included
	 *
	 * @param parts - Prompt parts to compose
	 * @returns Composed prompt string
	 */
	private composePromptWithMemory(parts: PromptParts): string {
		const sections: string[] = [];

		// Add base prompt
		sections.push(parts.basePrompt);

		// Add memory context if available
		if (parts.memoryContext && parts.memoryContext.trim()) {
			sections.push('\n---\n');
			sections.push(parts.memoryContext);
		}

		// Add SOP context if available
		if (parts.sopContext && parts.sopContext.trim()) {
			sections.push('\n---\n');
			sections.push(parts.sopContext);
		}

		// Add agent identity section
		if (parts.sessionName || parts.memberId || parts.role) {
			sections.push('\n---\n');
			sections.push('## Your Identity');
			if (parts.sessionName) sections.push(`- **Session Name:** ${parts.sessionName}`);
			if (parts.memberId) sections.push(`- **Member ID:** ${parts.memberId}`);
			if (parts.role) sections.push(`- **Role:** ${parts.role}`);
			if (parts.teamId) sections.push(`- **Team:** ${parts.teamId}`);
			if (parts.projectPath) sections.push(`- **Project Path:** ${parts.projectPath}`);
		}

		// Add communication instructions
		sections.push('\n---\n');
		sections.push(`## Communication

Use bash skills at \`${this.agentSkillsPath}/\` for all team communication. Read \`~/.agentmux/skills/AGENT_SKILLS_CATALOG.md\` for a full reference.
- \`send-message\` to communicate with other agents
- \`report-progress\` to update on task status
- \`remember\` to store important learnings (always pass your \`agentId\` and \`projectPath\`)
- \`recall\` to retrieve relevant knowledge (always pass your \`agentId\` and \`projectPath\`)
- \`record-learning\` to record learnings (always pass your \`agentId\` and \`projectPath\`)
- \`get-sops\` to request relevant SOPs for your current situation

**IMPORTANT for memory tools:** When calling \`remember\`, \`recall\`, or \`record-learning\`, you MUST pass:
- \`agentId\`: Your **Session Name** from the Identity section above
- \`projectPath\`: Your **Project Path** from the Identity section above
This ensures your knowledge is stored under your identity and in the correct project.

**IMPORTANT for recall:** Before answering questions about the project, deployment, architecture, or past decisions, ALWAYS call \`recall\` first to check your stored knowledge.`);

		return sections.join('\n').trim();
	}

	/**
	 * Build a continuation prompt for when an agent needs to resume work
	 *
	 * @param agentId - Agent identifier
	 * @param role - Agent's role
	 * @param projectPath - Project path
	 * @param currentTask - Current task being worked on
	 * @param taskContext - Optional task context for SOP matching
	 * @returns Continuation prompt string
	 */
	async buildContinuationPrompt(
		agentId: string,
		role: string,
		projectPath: string,
		currentTask: { title: string; description?: string },
		taskContext?: string
	): Promise<string> {
		const memoryContext = await this.buildMemoryContext(agentId, projectPath, { role });

		// Build SOP context based on task description/context
		const sopContextInput = taskContext || currentTask.description || currentTask.title;
		const sopContext = await this.buildSOPContext(role, sopContextInput);

		const sections: string[] = ['# Continue Your Work', ''];

		if (memoryContext) {
			sections.push(memoryContext);
			sections.push('');
		} else {
			sections.push('(No prior memory context available)');
			sections.push('');
		}

		sections.push(`## Current Task`);
		sections.push(`**${currentTask.title}**`);
		if (currentTask.description) {
			sections.push('');
			sections.push(currentTask.description);
		}
		sections.push('');

		if (sopContext) {
			sections.push('---');
			sections.push('');
			sections.push(sopContext);
			sections.push('');
		}

		sections.push(`## Instructions`);
		sections.push('');
		sections.push('1. Review your progress so far');
		sections.push('2. Follow the SOPs above for guidance');
		sections.push('3. Continue working on the task');
		sections.push('4. Run quality checks before marking complete');
		sections.push(`5. Run \`bash ${this.agentSkillsPath}/complete-task/execute.sh\` when ALL gates pass`);

		return sections.join('\n').trim();
	}

	/**
	 * Load registration prompt from config files
	 * Loads from config/roles/{role}/prompt.md
	 */
	async loadRegistrationPrompt(
		role: string,
		sessionName: string,
		memberId?: string
	): Promise<string> {
		try {
			// Normalize role name to directory name format
			const roleName = role.toLowerCase().replace(/\s+/g, '-');
			const promptPath = path.join(this.rolesDirectory, roleName, 'prompt.md');
			let prompt = await readFile(promptPath, 'utf8');

			// Replace template variables
			const variables: Record<string, string> = {
				SESSION_NAME: sessionName,
				SESSION_ID: sessionName,
				ROLE: role,
				AGENT_SKILLS_PATH: this.agentSkillsPath,
			};

			if (memberId) {
				variables.MEMBER_ID = memberId;
			}

			prompt = this.replaceTemplateVariables(prompt, variables);

			// For orchestrator or cases without member ID, remove the memberId parameter
			if (!memberId) {
				prompt = prompt.replace(/,\s*"memberId":\s*"\{\{MEMBER_ID\}\}"/g, '');
			}

			this.logger.debug('Loaded registration prompt', {
				role,
				sessionName,
				hasMemberId: !!memberId,
				promptLength: prompt.length,
			});

			return prompt;
		} catch (error) {
			// Fallback to inline prompt if file doesn't exist
			this.logger.warn('Could not load registration prompt from config, using fallback', {
				role,
				error: error instanceof Error ? error.message : String(error),
			});

			const memberIdParam = memberId ? `,"teamMemberId":"${memberId}"` : '';

			return `# AgentMux Agent Registration

You are running in the **AgentMux multi-agent orchestration environment**.

## Registration Required

**IMMEDIATELY** register yourself with the AgentMux system using the register-self bash skill:

\`\`\`bash
bash ${this.agentSkillsPath}/register-self/execute.sh '{"role":"${role}","sessionName":"${sessionName}"${memberIdParam}}'
\`\`\`

After registering, read the agent skills catalog for a full reference of available skills:
\`\`\`bash
cat ~/.agentmux/skills/AGENT_SKILLS_CATALOG.md
\`\`\`

**IMPORTANT:** You MUST complete registration before proceeding.

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
	 * Build a fallback system prompt when role-specific prompt is not found
	 */
	private buildFallbackSystemPrompt(config: TeamMemberSessionConfig): string {
		const fallbackPrompt = `Hey! I need your help with ${config.role} tasks on this project.

## Quick context about this setup

This project uses AgentMux for team coordination. You have bash skills available at \`${this.agentSkillsPath}/\` that communicate with the AgentMux backend running locally. Read the skills catalog at \`~/.agentmux/skills/AGENT_SKILLS_CATALOG.md\` for a full reference of available skills.

## First thing - please check in

Please run the register-self skill to let the team dashboard know you're available:
\`\`\`bash
bash ${this.agentSkillsPath}/register-self/execute.sh '{"role":"${config.role}","sessionName":"${config.name}"}'
\`\`\`
All it does is update a local status flag so the web UI shows you as online - nothing more.

After checking in, just say "Ready for tasks" and wait for me to send you work.

## Project context
- Session: ${config.name}
- Project Path: ${config.projectPath || 'Not specified'}
`;

		this.logger.info('Built fallback system prompt', {
			role: config.role,
			promptLength: fallbackPrompt.length,
		});

		return fallbackPrompt.trim();
	}

	/**
	 * Replace template variables in prompt content
	 */
	private replaceTemplateVariables(
		content: string,
		variables: Record<string, string>
	): string {
		let result = content;

		for (const [key, value] of Object.entries(variables)) {
			const placeholder = `{{${key}}}`;
			result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
		}

		this.logger.debug('Replaced template variables', {
			variableCount: Object.keys(variables).length,
			variables: Object.keys(variables),
		});

		return result;
	}

	/**
	 * Load prompt template from file
	 *
	 * Loads from config/roles/{roleName}/prompt.md or by full file name for backwards compatibility.
	 * Checks for user override files in ~/.agentmux/roles/{roleName}/prompt.md first.
	 *
	 * @param fileNameOrRole - Either a role name (e.g., 'orchestrator') or legacy file name (e.g., 'orchestrator-prompt.md')
	 * @returns The prompt content, or null if not found
	 */
	async loadPromptTemplate(fileNameOrRole: string): Promise<string | null> {
		try {
			// Try to get role from RoleService
			const roleService = getRoleService();
			const roleName = fileNameOrRole.replace(/-prompt\.md$/, '').toLowerCase().replace(/\s+/g, '-');

			const roleWithPrompt = await roleService.getRoleByName(roleName);
			if (roleWithPrompt && roleWithPrompt.systemPromptContent) {
				this.logger.debug('Loaded prompt template from RoleService', {
					roleName,
					contentLength: roleWithPrompt.systemPromptContent.length,
				});
				return roleWithPrompt.systemPromptContent;
			}

			// Fall back to direct file read from roles directory
			const filePath = path.join(this.rolesDirectory, roleName, 'prompt.md');
			const content = await readFile(filePath, 'utf8');

			this.logger.debug('Loaded prompt template', {
				roleName,
				contentLength: content.length,
				source: 'direct-file',
			});

			return content;
		} catch (error) {
			this.logger.warn('Failed to load prompt template', {
				fileNameOrRole,
				error: error instanceof Error ? error.message : String(error),
			});
			return null;
		}
	}

	/**
	 * Check if a prompt template exists for a role
	 */
	async promptTemplateExists(roleName: string): Promise<boolean> {
		try {
			const normalizedName = roleName.replace(/-prompt\.md$/, '').toLowerCase().replace(/\s+/g, '-');
			const filePath = path.join(this.rolesDirectory, normalizedName, 'prompt.md');
			await access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Get the path to the roles directory
	 */
	getRolesDirectory(): string {
		return this.rolesDirectory;
	}

	/**
	 * Build a prompt for project start communication to orchestrator
	 */
	buildProjectStartPrompt(projectData: {
		projectName: string;
		projectPath: string;
		teamDetails: any;
		requirements?: string;
	}): string {
		return this.buildOrchestratorPrompt(projectData);
	}

	/**
	 * Build a task assignment prompt
	 */
	buildTaskAssignmentPrompt(task: {
		id: string;
		title: string;
		description: string;
		assigneeRole: string;
		priority: 'high' | 'medium' | 'low';
		estimatedHours?: number;
	}): string {
		const prompt = `
## New Task Assignment

**Task ID**: ${task.id}
**Title**: ${task.title}
**Assigned to**: ${task.assigneeRole}
**Priority**: ${task.priority.toUpperCase()}
${task.estimatedHours ? `**Estimated Hours**: ${task.estimatedHours}` : ''}

**Description**:
${task.description}

Please acknowledge receipt of this task and provide an estimated completion timeline.
`;

		this.logger.debug('Built task assignment prompt', {
			taskId: task.id,
			assigneeRole: task.assigneeRole,
			priority: task.priority,
		});

		return prompt.trim();
	}

	/**
	 * Build a status update request prompt
	 */
	buildStatusUpdatePrompt(sessionName: string, role: string): string {
		const prompt = `
## Status Update Request

Please provide a brief status update on your current work:

1. **Current Task**: What are you currently working on?
2. **Progress**: What percentage complete is your current task?
3. **Blockers**: Are there any issues preventing progress?
4. **Next Steps**: What will you work on next?
5. **ETA**: When do you expect to complete your current task?

Keep your response concise and factual.
`;

		this.logger.debug('Built status update prompt', {
			sessionName,
			role,
		});

		return prompt.trim();
	}
}