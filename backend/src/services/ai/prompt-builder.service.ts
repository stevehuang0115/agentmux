import { readFile, access } from 'fs/promises';
import * as path from 'path';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import { TeamMemberSessionConfig } from '../../types/index.js';
import { MemoryService } from '../memory/memory.service.js';

/**
 * Options for building system prompts
 */
export interface PromptOptions {
  /** Agent's role */
  role?: string;
  /** Current task context for SOP selection */
  taskContext?: string;
  /** Whether to include memory context (default: true) */
  includeMemory?: boolean;
  /** Whether to include SOPs (default: true, for future use) */
  includeSOPs?: boolean;
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
	private readonly promptsDirectory: string;
	private memoryService: MemoryService | null = null;

	constructor(projectRoot: string = process.cwd()) {
		this.logger = LoggerService.getInstance().createComponentLogger('PromptBuilderService');
		this.promptsDirectory = path.join(projectRoot, 'config', 'teams', 'prompts');
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
	 */
	async buildSystemPrompt(config: TeamMemberSessionConfig): Promise<string> {
		// Try to load role-specific prompt from config/prompts directory
		const promptFileName = `${config.role.toLowerCase().replace(/\s+/g, '-')}-prompt.md`;
		const promptPath = path.resolve(this.promptsDirectory, promptFileName);

		try {
			await access(promptPath);
			let promptContent = await readFile(promptPath, 'utf8');

			// Replace template variables
			promptContent = this.replaceTemplateVariables(promptContent, {
				SESSION_ID: config.name || 'unknown',
				ROLE: config.role,
				PROJECT_PATH: config.projectPath || 'Not specified',
				MEMBER_ID: config.memberId || '',
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
	 * Build system prompt with memory context included
	 *
	 * This method builds a complete system prompt that includes:
	 * - Base role instructions
	 * - Project context
	 * - Memory context (agent and project memories)
	 * - Agent identity information
	 *
	 * @param config - Session configuration
	 * @param options - Prompt building options
	 * @returns Complete system prompt with memory
	 *
	 * @example
	 * ```typescript
	 * const prompt = await promptBuilder.buildSystemPromptWithMemory(config, {
	 *   includeMemory: true,
	 *   role: 'developer'
	 * });
	 * ```
	 */
	async buildSystemPromptWithMemory(
		config: TeamMemberSessionConfig,
		options: PromptOptions = {}
	): Promise<string> {
		const includeMemory = options.includeMemory !== false;

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

		// Compose final prompt with memory
		if (memoryContext) {
			return this.composePromptWithMemory({
				basePrompt,
				memoryContext,
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
	 * Compose a prompt with memory context included
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

		// Add agent identity section
		if (parts.sessionName || parts.memberId || parts.role) {
			sections.push('\n---\n');
			sections.push('## Your Identity');
			if (parts.sessionName) sections.push(`- **Session Name:** ${parts.sessionName}`);
			if (parts.memberId) sections.push(`- **Member ID:** ${parts.memberId}`);
			if (parts.role) sections.push(`- **Role:** ${parts.role}`);
			if (parts.teamId) sections.push(`- **Team:** ${parts.teamId}`);
		}

		// Add communication instructions
		sections.push('\n---\n');
		sections.push(`## Communication

Use MCP tools for all team communication:
- \`send_message\` to communicate with other agents
- \`report_progress\` to update on task status
- \`remember\` to store important learnings
- \`recall\` to retrieve relevant knowledge`);

		return sections.join('\n').trim();
	}

	/**
	 * Build a continuation prompt for when an agent needs to resume work
	 *
	 * @param agentId - Agent identifier
	 * @param role - Agent's role
	 * @param projectPath - Project path
	 * @param currentTask - Current task being worked on
	 * @returns Continuation prompt string
	 */
	async buildContinuationPrompt(
		agentId: string,
		role: string,
		projectPath: string,
		currentTask: { title: string; description?: string }
	): Promise<string> {
		const memoryContext = await this.buildMemoryContext(agentId, projectPath, { role });

		return `
# Continue Your Work

${memoryContext || '(No prior memory context available)'}

## Current Task
**${currentTask.title}**
${currentTask.description ? `\n${currentTask.description}` : ''}

## Instructions
Continue working on your assigned task. Use your knowledge base above to guide your approach.
`.trim();
	}

	/**
	 * Load registration prompt from config files
	 */
	async loadRegistrationPrompt(
		role: string,
		sessionName: string,
		memberId?: string
	): Promise<string> {
		try {
			const promptPath = path.join(this.promptsDirectory, `${role}-prompt.md`);
			let prompt = await readFile(promptPath, 'utf8');

			// Replace template variables
			const variables: Record<string, string> = {
				SESSION_ID: sessionName,
				ROLE: role,
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

			const memberIdParam = memberId ? `, "memberId": "${memberId}"` : '';
			return `Please immediately run: register_agent_status with parameters {"role": "${role}", "sessionName": "${sessionName}"${memberIdParam}}`;
		}
	}

	/**
	 * Build a fallback system prompt when role-specific prompt is not found
	 */
	private buildFallbackSystemPrompt(config: TeamMemberSessionConfig): string {
		const fallbackPrompt = `
# AgentMux Agent: ${config.role.toUpperCase()}

You are a ${config.role} agent in the AgentMux system.

## IMPORTANT: Registration Required
Immediately call the 'register_agent_status' tool with your role to register as active, then await further instructions.

Example:
register_agent_status({ "role": "${config.role}" })

After registration, respond with "Agent registered and awaiting instructions" and do nothing else until you receive explicit task assignments.

## Project Context
- Session: ${config.name}
- Role: ${config.role}
- Project Path: ${config.projectPath || 'Not specified'}

Do not take autonomous action. Wait for explicit instructions.
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
	 */
	async loadPromptTemplate(fileName: string): Promise<string | null> {
		try {
			const filePath = path.join(this.promptsDirectory, fileName);
			const content = await readFile(filePath, 'utf8');

			this.logger.debug('Loaded prompt template', {
				fileName,
				contentLength: content.length,
			});

			return content;
		} catch (error) {
			this.logger.warn('Failed to load prompt template', {
				fileName,
				error: error instanceof Error ? error.message : String(error),
			});
			return null;
		}
	}

	/**
	 * Check if a prompt template exists
	 */
	async promptTemplateExists(fileName: string): Promise<boolean> {
		try {
			const filePath = path.join(this.promptsDirectory, fileName);
			await access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Get the path to the prompts directory
	 */
	getPromptsDirectory(): string {
		return this.promptsDirectory;
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