import { readFile, access } from 'fs/promises';
import * as path from 'path';
import { LoggerService } from '../core/logger.service.js';
/**
 * Service dedicated to building and loading the various prompts used to communicate with agents.
 * Handles prompt templating, variable substitution, and fallback prompt generation.
 */
export class PromptBuilderService {
    logger;
    promptsDirectory;
    constructor(projectRoot = process.cwd()) {
        this.logger = LoggerService.getInstance().createComponentLogger('PromptBuilderService');
        this.promptsDirectory = path.join(projectRoot, 'config', 'teams', 'prompts');
    }
    /**
     * Build orchestrator prompt for project management
     */
    buildOrchestratorPrompt(projectData) {
        const { projectName, projectPath, teamDetails, requirements } = projectData;
        const teamMembers = Array.isArray(teamDetails.members)
            ? teamDetails.members
                .map((member) => `- ${member.name}: ${member.role} (${member.skills || 'General'})`)
                .join('\n')
            : 'No team members specified';
        const prompt = `I need you to build a full-stack application. The specifications are in ${projectPath}

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
    async buildSystemPrompt(config) {
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
        }
        catch (error) {
            // Fallback to generic prompt if specific role prompt not found
            this.logger.warn(`Role-specific prompt not found: ${promptPath}, using fallback`, {
                role: config.role,
            });
            return this.buildFallbackSystemPrompt(config);
        }
    }
    /**
     * Load registration prompt from config files
     */
    async loadRegistrationPrompt(role, sessionName, memberId) {
        try {
            const promptPath = path.join(this.promptsDirectory, `${role}-prompt.md`);
            let prompt = await readFile(promptPath, 'utf8');
            // Replace template variables
            const variables = {
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
        }
        catch (error) {
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
    buildFallbackSystemPrompt(config) {
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
    replaceTemplateVariables(content, variables) {
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
    async loadPromptTemplate(fileName) {
        try {
            const filePath = path.join(this.promptsDirectory, fileName);
            const content = await readFile(filePath, 'utf8');
            this.logger.debug('Loaded prompt template', {
                fileName,
                contentLength: content.length,
            });
            return content;
        }
        catch (error) {
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
    async promptTemplateExists(fileName) {
        try {
            const filePath = path.join(this.promptsDirectory, fileName);
            await access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get the path to the prompts directory
     */
    getPromptsDirectory() {
        return this.promptsDirectory;
    }
    /**
     * Build a prompt for project start communication to orchestrator
     */
    buildProjectStartPrompt(projectData) {
        return this.buildOrchestratorPrompt(projectData);
    }
    /**
     * Build a task assignment prompt
     */
    buildTaskAssignmentPrompt(task) {
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
    buildStatusUpdatePrompt(sessionName, role) {
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
//# sourceMappingURL=prompt-builder.service.js.map