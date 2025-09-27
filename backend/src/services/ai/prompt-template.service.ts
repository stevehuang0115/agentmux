import { readFile } from 'fs/promises';
import path from 'path';

export interface TaskAssignmentData {
  projectName: string;
  projectPath: string;
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  taskPriority?: string;
  taskMilestone?: string;
}

export interface AutoAssignmentData extends Record<string, string> {
  projectName: string;
  projectPath: string;
  currentTimestamp: string;
}

export interface ProjectStartData extends Record<string, string> {
  projectName: string;
  projectPath: string;
  teamName: string;
  teamMemberCount: string;
}

export interface CheckinData extends Record<string, string> {
  projectName: string;
  projectId: string;
  projectPath: string;
  currentTimestamp: string;
}

export class PromptTemplateService {
  private templatesPath: string;

  constructor(templatesPath?: string) {
    this.templatesPath = templatesPath || path.join(process.cwd(), 'config', 'orchestrator_tasks', 'prompts');
  }

  /**
   * Load and process orchestrator task assignment template
   */
  async getOrchestratorTaskAssignmentPrompt(data: TaskAssignmentData): Promise<string> {
    const templatePath = path.join(this.templatesPath, 'assign-task-orchestrator-prompt-template.md');
    const template = await readFile(templatePath, 'utf-8');

    // Ensure all required fields have values - CRITICAL for orchestrator template paths
    const processedData = {
      ...data,
      taskDescription: data.taskDescription || 'No description provided',
      taskPriority: data.taskPriority || 'medium',
      taskMilestone: data.taskMilestone || 'general',
      projectPath: data.projectPath || '[MISSING_PROJECT_PATH]',
      taskId: data.taskId || '[MISSING_TASK_ID]'
    };

    // Log warning if critical orchestrator template values are missing
    if (!data.projectPath || !data.taskMilestone || !data.taskId) {
      console.warn('⚠️  Orchestrator template missing critical values:', {
        projectPath: data.projectPath || 'MISSING',
        taskMilestone: data.taskMilestone || 'MISSING',
        taskId: data.taskId || 'MISSING',
        taskTitle: data.taskTitle || 'MISSING'
      });
    }

    return this.processTemplate(template, processedData);
  }

  /**
   * Extract and process team member task assignment prompt from orchestrator template
   */
  async getTeamMemberTaskAssignmentPrompt(data: TaskAssignmentData): Promise<string> {
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
   accept_task({ absoluteTaskPath: '${data.projectPath}/.agentmux/tasks/${data.taskMilestone || 'general'}/open/${data.taskId}.md', memberId: '[your_member_id]' })
3. Follow exact deliverables and file locations specified in the task file

CRITICAL: Read the actual task file, not this summary!`;
  }


  /**
   * Load and process project start orchestrator template for immediate coordination
   */
  async getProjectStartPrompt(data: ProjectStartData): Promise<string> {
    const templatePath = path.join(this.templatesPath, 'project-start-orchestrator-prompt-template.md');
    const template = await readFile(templatePath, 'utf-8');
    return this.processTemplate(template, data);
  }

  /**
   * Load and process check-in prompt for 15-minute cycles (includes auto-assignment)
   */
  async getCheckinPrompt(data: CheckinData): Promise<string> {
    const templatePath = path.join(this.templatesPath, 'checkin-orchestrator-prompt-template.md');
    const template = await readFile(templatePath, 'utf-8');
    return this.processTemplate(template, data);
  }

  /**
   * Process template by replacing placeholders with actual values
   */
  private processTemplate(template: string, data: Record<string, string>): string {
    let processed = template;

    // Replace all {key} placeholders with values
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = new RegExp(`{${key}}`, 'g');
      processed = processed.replace(placeholder, value || '');
    });

    // Validate that critical path components are present for orchestrator templates
    if (template.includes('**Task File Location:**')) {
      const { projectPath, taskMilestone, taskId } = data;
      if (!projectPath || !taskMilestone || !taskId) {
        console.warn('Orchestrator template missing critical path components:', {
          projectPath: !!projectPath,
          taskMilestone: !!taskMilestone,
          taskId: !!taskId
        });
      }
    }

    return processed;
  }
}