import { readFile } from 'fs/promises';
import path from 'path';
export class PromptTemplateService {
    templatesPath;
    constructor(templatesPath) {
        this.templatesPath = templatesPath || path.join(process.cwd(), 'config', 'prompts');
    }
    /**
     * Load and process orchestrator task assignment template
     */
    async getOrchestratorTaskAssignmentPrompt(data) {
        const templatePath = path.join(this.templatesPath, 'assign-task-orchestrator-prompt-template.md');
        const template = await readFile(templatePath, 'utf-8');
        return this.processTemplate(template, {
            ...data,
            taskDescription: data.taskDescription || 'No description provided',
            taskPriority: data.taskPriority || 'medium',
            taskMilestone: data.taskMilestone || 'general'
        });
    }
    /**
     * Extract and process team member task assignment prompt from orchestrator template
     */
    async getTeamMemberTaskAssignmentPrompt(data) {
        // Load the orchestrator template and extract the team member message
        const orchestratorTemplate = await this.getOrchestratorTaskAssignmentPrompt(data);
        // Extract the message content from the send_message call
        const messageMatch = orchestratorTemplate.match(/message: "([^"]*(?:\\"[^"]*)*?)"/s);
        if (messageMatch) {
            return messageMatch[1].replace(/\\"/g, '"'); // Unescape quotes
        }
        // Fallback if extraction fails
        return `📋 TASK ASSIGNMENT - ${data.taskTitle}

**Task File:** \`${data.projectPath}/.agentmux/tasks/${data.taskMilestone || 'general'}/open/${data.taskId}.md\`
**Priority:** ${data.taskPriority || 'medium'}

Please:
1. Read the complete task file above for full specifications
2. Call accept_task to move it to in_progress:
   accept_task({ taskPath: '${data.projectPath}/.agentmux/tasks/${data.taskMilestone || 'general'}/open/${data.taskId}.md', memberId: '[your_member_id]' })
3. Follow exact deliverables and file locations specified in the task file

CRITICAL: Read the actual task file, not this summary!`;
    }
    /**
     * Process template by replacing placeholders with actual values
     */
    processTemplate(template, data) {
        let processed = template;
        // Replace all {key} placeholders with values
        Object.entries(data).forEach(([key, value]) => {
            const placeholder = new RegExp(`{${key}}`, 'g');
            processed = processed.replace(placeholder, value || '');
        });
        return processed;
    }
}
//# sourceMappingURL=prompt-template.service.js.map