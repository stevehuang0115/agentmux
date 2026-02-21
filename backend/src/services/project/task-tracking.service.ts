import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { InProgressTask, TaskTrackingData, TaskFileInfo } from '../../types/task-tracking.types.js';
import { CREWLY_CONSTANTS } from '../../constants.js';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';

export class TaskTrackingService extends EventEmitter {
  private readonly taskTrackingPath: string;
  private readonly logger: ComponentLogger = LoggerService.getInstance().createComponentLogger('TaskTrackingService');

  constructor() {
    super();
    this.taskTrackingPath = path.join(os.homedir(), '.crewly', 'in_progress_tasks.json');
  }

  async loadTaskData(): Promise<TaskTrackingData> {
    try {
      if (!fsSync.existsSync(this.taskTrackingPath)) {
        const initialData: TaskTrackingData = {
          tasks: [],
          lastUpdated: new Date().toISOString(),
          version: '1.0.0'
        };
        await this.saveTaskData(initialData);
        return initialData;
      }

      const content = await fs.readFile(this.taskTrackingPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.error('Error loading task tracking data', { error: error instanceof Error ? error.message : String(error) });
      return {
        tasks: [],
        lastUpdated: new Date().toISOString(),
        version: '1.0.0'
      };
    }
  }

  async saveTaskData(data: TaskTrackingData): Promise<void> {
    try {
      data.lastUpdated = new Date().toISOString();
      await fs.writeFile(this.taskTrackingPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      this.logger.error('Error saving task tracking data', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async assignTask(
    projectId: string,
    teamId: string,
    taskFilePath: string,
    taskName: string,
    targetRole: string,
    teamMemberId: string,
    sessionName: string
  ): Promise<InProgressTask> {
    const data = await this.loadTaskData();
    
    const task: InProgressTask = {
      id: uuidv4(),
      projectId,
      teamId,
      taskFilePath,
      taskName,
      targetRole,
      assignedTeamMemberId: teamMemberId,
      assignedSessionName: sessionName,
      assignedAt: new Date().toISOString(),
      status: 'assigned'
    };

    data.tasks.push(task);
    await this.saveTaskData(data);
    
    // Emit task assigned event
    this.emit('task_assigned', task);
    
    return task;
  }

  async updateTaskStatus(taskId: string, status: InProgressTask['status'], blockReason?: string): Promise<void> {
    const data = await this.loadTaskData();
    const task = data.tasks.find(t => t.id === taskId);
    
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    task.status = status;
    task.lastCheckedAt = new Date().toISOString();
    
    if (status === 'blocked' && blockReason) {
      task.blockReason = blockReason;
    }

    await this.saveTaskData(data);
    
    // Emit task completed event if status is completed
    if (status === 'completed') {
      this.emit('task_completed', task);
    }
  }

  async removeTask(taskId: string): Promise<void> {
    const data = await this.loadTaskData();
    data.tasks = data.tasks.filter(t => t.id !== taskId);
    await this.saveTaskData(data);
  }

  async addTaskToQueue(taskInfo: {
    projectId: string;
    teamId: string;
    taskFilePath: string;
    taskName: string;
    targetRole: string;
    priority: 'low' | 'medium' | 'high';
    createdAt: string;
  }): Promise<InProgressTask> {
    const data = await this.loadTaskData();
    
    const task: InProgressTask = {
      id: uuidv4(),
      projectId: taskInfo.projectId,
      teamId: taskInfo.teamId,
      taskFilePath: taskInfo.taskFilePath,
      taskName: taskInfo.taskName,
      targetRole: taskInfo.targetRole,
      assignedTeamMemberId: 'orchestrator', // Queued for orchestrator assignment
      assignedSessionName: CREWLY_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
      assignedAt: taskInfo.createdAt,
      status: 'pending_assignment', // New status for tasks awaiting assignment
      priority: taskInfo.priority
    };

    data.tasks.push(task);
    await this.saveTaskData(data);
    
    return task;
  }

  async getTasksForProject(projectId: string): Promise<InProgressTask[]> {
    const data = await this.loadTaskData();
    return data.tasks.filter(t => t.projectId === projectId);
  }

  async getTasksForTeamMember(teamMemberId: string): Promise<InProgressTask[]> {
    const data = await this.loadTaskData();
    return data.tasks.filter(t => t.assignedTeamMemberId === teamMemberId);
  }

  async getAllInProgressTasks(): Promise<InProgressTask[]> {
    const data = await this.loadTaskData();
    return data.tasks;
  }

  // Utility method to scan project tasks and sync with file system
  async syncTasksWithFileSystem(projectPath: string, projectId: string): Promise<void> {
    const tasksPath = path.join(projectPath, '.crewly', 'tasks');
    
    if (!fsSync.existsSync(tasksPath)) {
      return;
    }

    const data = await this.loadTaskData();
    const projectTasks = data.tasks.filter(t => t.projectId === projectId);

    // Check if assigned tasks still exist in in_progress folder
    for (const task of projectTasks) {
      const expectedInProgressPath = task.taskFilePath.replace('/open/', '/in_progress/');
      const taskStillInProgress = fsSync.existsSync(expectedInProgressPath);
      
      if (!taskStillInProgress) {
        // Task was moved manually, check where it went
        const baseName = path.basename(task.taskFilePath);
        const milestoneDir = path.dirname(path.dirname(task.taskFilePath));
        
        const doneFile = path.join(milestoneDir, 'done', baseName);
        const blockedFile = path.join(milestoneDir, 'blocked', baseName);
        
        if (fsSync.existsSync(doneFile)) {
          // Task was completed, remove from tracking
          await this.removeTask(task.id);
        } else if (fsSync.existsSync(blockedFile)) {
          // Task was blocked, update status
          await this.updateTaskStatus(task.id, 'blocked', 'Moved to blocked folder manually');
        }
      }
    }
  }

  // Get available open tasks for a project
  async getOpenTasks(projectPath: string): Promise<TaskFileInfo[]> {
    const tasksPath = path.join(projectPath, '.crewly', 'tasks');
    const openTasks: TaskFileInfo[] = [];
    
    if (!fsSync.existsSync(tasksPath)) {
      return openTasks;
    }

    const milestones = await fs.readdir(tasksPath);
    
    for (const milestone of milestones) {
      if (!milestone.startsWith('m') || !milestone.includes('_')) continue;
      
      const milestonePath = path.join(tasksPath, milestone);
      const openFolderPath = path.join(milestonePath, 'open');
      
      if (fsSync.existsSync(openFolderPath)) {
        const openFiles = await fs.readdir(openFolderPath);
        
        for (const file of openFiles) {
          if (file.endsWith('.md')) {
            const fullPath = path.join(openFolderPath, file);
            
            // Parse role from filename (assumes format: NN_task_name_ROLE.md)
            const roleMatch = file.match(/_([a-z]+)\.md$/);
            const targetRole = roleMatch ? roleMatch[1] : 'unknown';
            
            openTasks.push({
              filePath: fullPath,
              fileName: file,
              taskName: this.extractTaskNameFromFile(file),
              targetRole,
              milestoneFolder: milestone,
              statusFolder: 'open'
            });
          }
        }
      }
    }

    return openTasks;
  }

  private extractTaskNameFromFile(filename: string): string {
    // Remove extension and number prefix
    return filename
      .replace('.md', '')
      .replace(/^\d+_/, '')
      .replace(/_[a-z]+$/, '') // Remove role suffix
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Recovers abandoned in-progress tasks by checking agent status and moving inactive tasks back to open
   * @param getTeamStatus Function to get current team status from API
   * @returns Recovery report with actions taken
   */
  async recoverAbandonedTasks(getTeamStatus: () => Promise<any[]>): Promise<{
    totalInProgress: number;
    recovered: number;
    skipped: number;
    errors: string[];
    recoveredTasks: string[];
  }> {
    const report = {
      totalInProgress: 0,
      recovered: 0,
      skipped: 0,
      errors: [] as string[],
      recoveredTasks: [] as string[]
    };

    try {
      this.logger.info('Starting task recovery check');

      const data = await this.loadTaskData();
      const inProgressTasks = data.tasks.filter(t => t.status === 'assigned' || t.status === 'active');
      report.totalInProgress = inProgressTasks.length;

      if (inProgressTasks.length === 0) {
        this.logger.info('No in-progress tasks found to recover');
        return report;
      }

      this.logger.info('Found in-progress tasks to check', { count: inProgressTasks.length });

      // Get current team status
      const teams = await getTeamStatus();
      const activeMembers = new Set();

      teams.forEach(team => {
        team.members?.forEach((member: any) => {
          if (member.agentStatus === 'active' && member.workingStatus === 'in_progress') {
            activeMembers.add(member.sessionName);
            activeMembers.add(member.id);
          }
        });
      });

      this.logger.info('Found active working members', { count: activeMembers.size });

      // Check each in-progress task
      for (const task of inProgressTasks) {
        try {
          const isAgentActive = activeMembers.has(task.assignedSessionName) ||
                              activeMembers.has(task.assignedTeamMemberId);

          if (isAgentActive) {
            this.logger.info('Agent is still active, keeping task', { sessionName: task.assignedSessionName, taskName: task.taskName });
            report.skipped++;
            continue;
          }

          this.logger.warn('Agent is inactive, recovering task', { sessionName: task.assignedSessionName, taskName: task.taskName });

          // Move task back to open folder and clean metadata
          const recovered = await this.moveTaskBackToOpen(task);
          if (recovered) {
            // Remove from JSON tracking
            await this.removeTask(task.id);
            report.recovered++;
            report.recoveredTasks.push(task.taskName);
            this.logger.info('Successfully recovered task', { taskName: task.taskName });
          } else {
            report.errors.push(`Failed to move task back to open: ${task.taskName}`);
            this.logger.error('Failed to recover task', { taskName: task.taskName });
          }

        } catch (error) {
          const errorMsg = `Error processing task ${task.taskName}: ${error instanceof Error ? error.message : String(error)}`;
          report.errors.push(errorMsg);
          this.logger.error('Error processing task during recovery', { taskName: task.taskName, error: error instanceof Error ? error.message : String(error) });
        }
      }

      this.logger.info('Recovery complete', { recovered: report.recovered, skipped: report.skipped, errors: report.errors.length });

    } catch (error) {
      const errorMsg = `Task recovery failed: ${error instanceof Error ? error.message : String(error)}`;
      report.errors.push(errorMsg);
      this.logger.error('Task recovery failed', { error: error instanceof Error ? error.message : String(error) });
    }

    return report;
  }

  /**
   * Moves a task back to the open folder and cleans assignment metadata
   */
  private async moveTaskBackToOpen(task: InProgressTask): Promise<boolean> {
    try {
      // Check if task file still exists in in_progress
      if (!fsSync.existsSync(task.taskFilePath)) {
        this.logger.warn('Task file not found in in_progress', { taskFilePath: task.taskFilePath });
        return false;
      }

      // Read current task content
      const content = await fs.readFile(task.taskFilePath, 'utf-8');

      // Clean assignment metadata
      const cleanedContent = this.cleanAssignmentMetadata(content);

      // Calculate target path in open folder
      const openPath = task.taskFilePath.replace('/in_progress/', '/open/');
      const openDir = path.dirname(openPath);

      // Ensure open directory exists
      if (!fsSync.existsSync(openDir)) {
        await fs.mkdir(openDir, { recursive: true });
      }

      // Write cleaned content to open folder
      await fs.writeFile(openPath, cleanedContent, 'utf-8');

      // Remove from in_progress folder
      await fs.unlink(task.taskFilePath);

      this.logger.info('Moved task back to open', { from: task.taskFilePath, to: openPath });
      return true;

    } catch (error) {
      this.logger.error('Failed to move task back to open', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /**
   * Removes assignment metadata sections from task content
   */
  private cleanAssignmentMetadata(content: string): string {
    // Remove ## Assignment Information section and everything after it
    // This preserves the original task content but removes assignment metadata
    const lines = content.split('\n');
    const cleanedLines = [];
    let inAssignmentSection = false;

    for (const line of lines) {
      if (line.trim().startsWith('## Assignment Information')) {
        inAssignmentSection = true;
        continue;
      }

      // If we hit another ## section after assignment, stop skipping
      if (inAssignmentSection && line.trim().startsWith('## ') && !line.includes('Assignment Information')) {
        inAssignmentSection = false;
      }

      if (!inAssignmentSection) {
        cleanedLines.push(line);
      }
    }

    // Remove trailing empty lines
    while (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1].trim() === '') {
      cleanedLines.pop();
    }

    return cleanedLines.join('\n');
  }
}