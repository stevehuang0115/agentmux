import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { ScheduledMessage } from '../types/index.js';
import { ScheduledMessageModel } from '../models/ScheduledMessage.js';
import { StorageService } from './storage.service.js';

export interface ActiveProject {
  projectId: string;
  status: 'running' | 'stopped';
  startedAt: string;
  stoppedAt?: string;
  checkInScheduleId?: string;
  gitCommitScheduleId?: string;
}

export interface ActiveProjectsData {
  activeProjects: ActiveProject[];
  lastUpdated: string;
  version: string;
}

export class ActiveProjectsService {
  private readonly activeProjectsPath: string;
  private storageService?: StorageService;

  constructor(storageService?: StorageService) {
    this.activeProjectsPath = path.join(os.homedir(), '.agentmux', 'active_projects.json');
    this.storageService = storageService;
  }

  async loadActiveProjectsData(): Promise<ActiveProjectsData> {
    try {
      if (!fsSync.existsSync(this.activeProjectsPath)) {
        const initialData: ActiveProjectsData = {
          activeProjects: [],
          lastUpdated: new Date().toISOString(),
          version: '1.0.0'
        };
        await this.saveActiveProjectsData(initialData);
        return initialData;
      }

      const content = await fs.readFile(this.activeProjectsPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error loading active projects data:', error);
      return {
        activeProjects: [],
        lastUpdated: new Date().toISOString(),
        version: '1.0.0'
      };
    }
  }

  async saveActiveProjectsData(data: ActiveProjectsData): Promise<void> {
    try {
      data.lastUpdated = new Date().toISOString();
      
      // Ensure directory exists
      const dir = path.dirname(this.activeProjectsPath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(this.activeProjectsPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving active projects data:', error);
      throw error;
    }
  }

  async startProject(
    projectId: string,
    messageSchedulerService?: any
  ): Promise<{
    checkInScheduleId?: string;
    gitCommitScheduleId?: string;
  }> {
    const data = await this.loadActiveProjectsData();
    
    // Check if project is already running
    const existingProject = data.activeProjects.find(p => p.projectId === projectId);
    if (existingProject && existingProject.status === 'running') {
      throw new Error('Project is already running');
    }

    // Create or update project entry
    const projectEntry: ActiveProject = {
      projectId,
      status: 'running',
      startedAt: new Date().toISOString()
    };

    let checkInScheduleId: string | undefined;
    let gitCommitScheduleId: string | undefined;

    // Create scheduled messages if messageSchedulerService is provided
    if (messageSchedulerService) {
      try {
        // Create 15-minute check-in schedule
        checkInScheduleId = await this.createProjectCheckInSchedule(
          projectId,
          messageSchedulerService
        );
        projectEntry.checkInScheduleId = checkInScheduleId;

        // Create 30-minute git commit schedule
        gitCommitScheduleId = await this.createProjectGitCommitSchedule(
          projectId,
          messageSchedulerService
        );
        projectEntry.gitCommitScheduleId = gitCommitScheduleId;

      } catch (scheduleError) {
        console.warn('Failed to create scheduled messages for project:', scheduleError);
        // Continue without scheduled messages
      }
    }

    // Update or add project
    if (existingProject) {
      const index = data.activeProjects.findIndex(p => p.projectId === projectId);
      data.activeProjects[index] = projectEntry;
    } else {
      data.activeProjects.push(projectEntry);
    }

    await this.saveActiveProjectsData(data);

    return {
      checkInScheduleId,
      gitCommitScheduleId
    };
  }

  async stopProject(
    projectId: string,
    messageSchedulerService?: any
  ): Promise<void> {
    const data = await this.loadActiveProjectsData();
    
    const projectIndex = data.activeProjects.findIndex(p => p.projectId === projectId);
    if (projectIndex === -1) {
      throw new Error('Project not found in active projects');
    }

    const project = data.activeProjects[projectIndex];

    // Cancel scheduled messages if messageSchedulerService is provided
    if (messageSchedulerService) {
      try {
        if (project.checkInScheduleId) {
          await messageSchedulerService.deleteScheduledMessage(project.checkInScheduleId);
        }
        if (project.gitCommitScheduleId) {
          await messageSchedulerService.deleteScheduledMessage(project.gitCommitScheduleId);
        }
      } catch (scheduleError) {
        console.warn('Failed to cancel scheduled messages for project:', scheduleError);
        // Continue with stopping project
      }
    }

    // Update project status
    project.status = 'stopped';
    project.stoppedAt = new Date().toISOString();

    // Remove schedule IDs since they're cancelled
    delete project.checkInScheduleId;
    delete project.gitCommitScheduleId;

    data.activeProjects[projectIndex] = project;

    await this.saveActiveProjectsData(data);
  }

  async restartProject(
    projectId: string,
    messageSchedulerService?: any
  ): Promise<{
    checkInScheduleId?: string;
    gitCommitScheduleId?: string;
  }> {
    // Stop project first (if running) then start it
    try {
      await this.stopProject(projectId, messageSchedulerService);
    } catch (error) {
      // Project might not be running, continue with restart
      console.log('Project was not running, starting fresh:', error);
    }

    return await this.startProject(projectId, messageSchedulerService);
  }

  async getActiveProjects(): Promise<ActiveProject[]> {
    const data = await this.loadActiveProjectsData();
    return data.activeProjects.filter(p => p.status === 'running');
  }

  async getAllProjects(): Promise<ActiveProject[]> {
    const data = await this.loadActiveProjectsData();
    return data.activeProjects;
  }

  async getProjectStatus(projectId: string): Promise<ActiveProject | null> {
    const data = await this.loadActiveProjectsData();
    return data.activeProjects.find(p => p.projectId === projectId) || null;
  }

  async isProjectRunning(projectId: string): Promise<boolean> {
    const project = await this.getProjectStatus(projectId);
    return project?.status === 'running';
  }

  private async createProjectCheckInSchedule(
    projectId: string,
    messageSchedulerService: any
  ): Promise<string> {
    const checkInMessage = `🔄 **15-Minute Project Check-in**

**Project ID**: ${projectId}

**Orchestrator Tasks:**
1. Use the \`check_team_progress\` MCP tool with projectId: "${projectId}"
2. Review the team progress report and current task status
3. Identify any blockers, delays, or issues
4. Provide guidance and next steps to team members
5. If needed, reassign tasks or adjust priorities

**Focus Areas:**
- Are team members actively working on their assigned tasks?
- Are there any blocked tasks that need attention?
- Is the team making good progress toward project goals?
- Do any team members need additional context or support?

Use: \`check_team_progress { "projectId": "${projectId}" }\``;

    const scheduledMessage = ScheduledMessageModel.create({
      name: `Check-in for Project ${projectId}`,
      targetTeam: 'orchestrator',
      targetProject: projectId,
      message: checkInMessage,
      delayAmount: 15,
      delayUnit: 'minutes',
      isRecurring: true,
      isActive: true
    });

    if (this.storageService) {
      await this.storageService.saveScheduledMessage(scheduledMessage);
      messageSchedulerService?.scheduleMessage(scheduledMessage);
    }

    return scheduledMessage.id;
  }

  private async createProjectGitCommitSchedule(
    projectId: string,
    messageSchedulerService: any
  ): Promise<string> {
    const commitMessage = `💾 **30-Minute Git Commit Reminder**

**Project ID**: ${projectId}

**Task**: Ask the Technical Product Manager (TPM) or best available team member to commit current work.

**Commit Instructions:**
1. Review all changes made in the last 30 minutes
2. Stage appropriate files for commit
3. Create a meaningful commit message describing the work completed
4. Push changes to the repository

**Message to send to TPM:**
"Please commit and push any current work for project ${projectId}. Include a descriptive commit message about the progress made in the last 30 minutes."

**Fallback**: If TPM is unavailable, delegate this task to the most senior available team member.`;

    const scheduledMessage = ScheduledMessageModel.create({
      name: `Git Commit Reminder for Project ${projectId}`,
      targetTeam: 'orchestrator',
      targetProject: projectId,
      message: commitMessage,
      delayAmount: 30,
      delayUnit: 'minutes',
      isRecurring: true,
      isActive: true
    });

    if (this.storageService) {
      await this.storageService.saveScheduledMessage(scheduledMessage);
      messageSchedulerService?.scheduleMessage(scheduledMessage);
    }

    return scheduledMessage.id;
  }

  async cleanupStoppedProjects(olderThanDays: number = 7): Promise<number> {
    const data = await this.loadActiveProjectsData();
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const initialCount = data.activeProjects.length;
    
    data.activeProjects = data.activeProjects.filter(project => {
      if (project.status === 'stopped' && project.stoppedAt) {
        const stoppedDate = new Date(project.stoppedAt);
        return stoppedDate > cutoffDate;
      }
      return true; // Keep running projects and projects without stop date
    });

    await this.saveActiveProjectsData(data);
    
    return initialCount - data.activeProjects.length;
  }
}