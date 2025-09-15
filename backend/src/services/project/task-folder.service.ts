import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { resolveStepConfig } from '../../utils/prompt-resolver.js';

export class TaskFolderService {
  
  /**
   * Creates the status folder structure for a milestone
   * Creates: open/, in_progress/, done/, blocked/ folders
   */
  async createMilestoneStatusFolders(milestonePath: string): Promise<void> {
    const statusFolders = ['open', 'in_progress', 'done', 'blocked'];
    
    for (const folder of statusFolders) {
      const folderPath = path.join(milestonePath, folder);
      await fs.mkdir(folderPath, { recursive: true });
    }
  }

  /**
   * Creates m0_defining_project milestone with status folders
   */
  async createM0DefininingProjectMilestone(projectPath: string): Promise<string> {
    const tasksPath = path.join(projectPath, '.agentmux', 'tasks');
    const m0Path = path.join(tasksPath, 'm0_defining_project');
    
    // Create main tasks directory and m0 milestone
    await fs.mkdir(m0Path, { recursive: true });
    
    // Create status folders
    await this.createMilestoneStatusFolders(m0Path);
    
    return m0Path;
  }

  /**
   * Ensures all existing milestone folders have status subfolders
   */
  async ensureStatusFoldersForProject(projectPath: string): Promise<void> {
    const tasksPath = path.join(projectPath, '.agentmux', 'tasks');
    
    if (!fsSync.existsSync(tasksPath)) {
      return;
    }

    const items = await fs.readdir(tasksPath);
    
    for (const item of items) {
      const itemPath = path.join(tasksPath, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory() && item.startsWith('m') && item.includes('_')) {
        // This is a milestone folder, ensure it has status subfolders
        await this.createMilestoneStatusFolders(itemPath);
      }
    }
  }

  /**
   * Moves a task file between status folders
   */
  async moveTaskToStatus(
    taskFilePath: string, 
    newStatus: 'open' | 'in_progress' | 'done' | 'blocked'
  ): Promise<string> {
    const fileName = path.basename(taskFilePath);
    const milestoneDir = path.dirname(path.dirname(taskFilePath));
    const newPath = path.join(milestoneDir, newStatus, fileName);
    
    // Ensure target folder exists
    await fs.mkdir(path.dirname(newPath), { recursive: true });
    
    // Move the file
    await fs.rename(taskFilePath, newPath);
    
    return newPath;
  }

  /**
   * Creates a task file in the specified status folder
   */
  async createTaskFile(
    milestonePath: string,
    taskFileName: string,
    taskContent: string,
    status: 'open' | 'in_progress' | 'done' | 'blocked' = 'open'
  ): Promise<string> {
    const statusFolderPath = path.join(milestonePath, status);
    const taskFilePath = path.join(statusFolderPath, taskFileName);
    
    // Ensure status folder exists
    await fs.mkdir(statusFolderPath, { recursive: true });
    
    // Write the task file
    await fs.writeFile(taskFilePath, taskContent, 'utf-8');
    
    return taskFilePath;
  }

  /**
   * Lists all task files in a specific status folder
   */
  async getTasksInStatus(
    milestonePath: string,
    status: 'open' | 'in_progress' | 'done' | 'blocked'
  ): Promise<string[]> {
    const statusFolderPath = path.join(milestonePath, status);
    
    if (!fsSync.existsSync(statusFolderPath)) {
      return [];
    }

    const files = await fs.readdir(statusFolderPath);
    return files.filter(file => file.endsWith('.md'));
  }

  /**
   * Gets task file path by scanning all status folders for a task
   */
  async findTaskFile(milestonePath: string, taskFileName: string): Promise<string | null> {
    const statusFolders = ['open', 'in_progress', 'done', 'blocked'];
    
    for (const status of statusFolders) {
      const filePath = path.join(milestonePath, status, taskFileName);
      if (fsSync.existsSync(filePath)) {
        return filePath;
      }
    }
    
    return null;
  }

  /**
   * Gets the current status of a task based on which folder it's in
   */
  async getTaskStatus(milestonePath: string, taskFileName: string): Promise<'open' | 'in_progress' | 'done' | 'blocked' | 'not_found'> {
    const statusFolders: Array<'open' | 'in_progress' | 'done' | 'blocked'> = ['open', 'in_progress', 'done', 'blocked'];
    
    for (const status of statusFolders) {
      const filePath = path.join(milestonePath, status, taskFileName);
      if (fsSync.existsSync(filePath)) {
        return status;
      }
    }
    
    return 'not_found';
  }

  /**
   * Creates a task file from a JSON step configuration
   */
  async generateTaskFileContent(
    step: any,
    projectName: string,
    projectPath: string,
    projectId: string,
    initialGoal?: string,
    userJourney?: string
  ): Promise<string> {
    // Resolve prompts using the prompt resolver utility
    const templateVars = {
      PROJECT_NAME: projectName,
      PROJECT_ID: projectId,
      PROJECT_PATH: projectPath,
      INITIAL_GOAL: initialGoal || 'See project specifications',
      USER_JOURNEY: userJourney || 'See project specifications'
    };

    // Use prompt resolver to handle both prompt_file and legacy prompts array
    const resolvedStep = await resolveStepConfig(step, templateVars);
    const processedPrompts = resolvedStep.prompts;

    // Process template variables in verification object
    const processedVerification = this.processTemplateVariablesInObject(step.verification, templateVars);

    const taskContent = `---
targetRole: ${step.targetRole}
stepId: ${step.id}
delayMinutes: ${step.delayMinutes}
conditional: ${step.conditional || 'none'}
verification: ${JSON.stringify(processedVerification, null, 2)}
---

# ${step.name}

## Objective
${processedPrompts[0] || step.name}

## Detailed Instructions
${processedPrompts.slice(1).join('\n\n')}

## Acceptance Criteria
- [ ] Task completed according to verification criteria
- [ ] All deliverables created and validated
- [ ] Task moved to 'done' folder upon completion

## Dependencies
${step.conditional !== 'none' ? `- Previous step must be completed: ${step.conditional}` : '- None'}

## Verification
\`\`\`json
${JSON.stringify(processedVerification, null, 2)}
\`\`\`

## Notes
- Move this file to 'in_progress/' folder when starting work
- Move to 'done/' folder when completed
- Move to 'blocked/' folder if unable to proceed (include block reason)
`;

    return taskContent;
  }

  /**
   * Recursively processes template variables in an object
   */
  private processTemplateVariablesInObject(obj: any, templateVars: Record<string, string>): any {
    if (typeof obj === 'string') {
      return this.replaceTemplateVariables(obj, templateVars);
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.processTemplateVariablesInObject(item, templateVars));
    } else if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.processTemplateVariablesInObject(value, templateVars);
      }
      return result;
    }
    return obj;
  }

  /**
   * Replaces template variables in a string
   */
  private replaceTemplateVariables(text: string, templateVars: Record<string, string>): string {
    let result = text;
    Object.entries(templateVars).forEach(([key, value]) => {
      const pattern = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(pattern, value);
    });
    return result;
  }
}