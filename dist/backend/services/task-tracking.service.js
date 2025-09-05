import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
export class TaskTrackingService {
    taskTrackingPath;
    constructor() {
        this.taskTrackingPath = path.join(os.homedir(), '.agentmux', 'in_progress_tasks.json');
    }
    async loadTaskData() {
        try {
            if (!fsSync.existsSync(this.taskTrackingPath)) {
                const initialData = {
                    tasks: [],
                    lastUpdated: new Date().toISOString(),
                    version: '1.0.0'
                };
                await this.saveTaskData(initialData);
                return initialData;
            }
            const content = await fs.readFile(this.taskTrackingPath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            console.error('Error loading task tracking data:', error);
            return {
                tasks: [],
                lastUpdated: new Date().toISOString(),
                version: '1.0.0'
            };
        }
    }
    async saveTaskData(data) {
        try {
            data.lastUpdated = new Date().toISOString();
            await fs.writeFile(this.taskTrackingPath, JSON.stringify(data, null, 2), 'utf-8');
        }
        catch (error) {
            console.error('Error saving task tracking data:', error);
            throw error;
        }
    }
    async assignTask(projectId, taskFilePath, taskName, targetRole, teamMemberId, sessionId) {
        const data = await this.loadTaskData();
        const task = {
            id: uuidv4(),
            projectId,
            taskFilePath,
            taskName,
            targetRole,
            assignedTeamMemberId: teamMemberId,
            assignedSessionId: sessionId,
            assignedAt: new Date().toISOString(),
            status: 'assigned'
        };
        data.tasks.push(task);
        await this.saveTaskData(data);
        return task;
    }
    async updateTaskStatus(taskId, status, blockReason) {
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
    }
    async removeTask(taskId) {
        const data = await this.loadTaskData();
        data.tasks = data.tasks.filter(t => t.id !== taskId);
        await this.saveTaskData(data);
    }
    async addTaskToQueue(taskInfo) {
        const data = await this.loadTaskData();
        const task = {
            id: uuidv4(),
            projectId: taskInfo.projectId,
            taskFilePath: taskInfo.taskFilePath,
            taskName: taskInfo.taskName,
            targetRole: taskInfo.targetRole,
            assignedTeamMemberId: 'orchestrator', // Queued for orchestrator assignment
            assignedSessionId: 'agentmux-orc',
            assignedAt: taskInfo.createdAt,
            status: 'pending_assignment', // New status for tasks awaiting assignment
            priority: taskInfo.priority
        };
        data.tasks.push(task);
        await this.saveTaskData(data);
        return task;
    }
    async getTasksForProject(projectId) {
        const data = await this.loadTaskData();
        return data.tasks.filter(t => t.projectId === projectId);
    }
    async getTasksForTeamMember(teamMemberId) {
        const data = await this.loadTaskData();
        return data.tasks.filter(t => t.assignedTeamMemberId === teamMemberId);
    }
    async getAllInProgressTasks() {
        const data = await this.loadTaskData();
        return data.tasks;
    }
    // Utility method to scan project tasks and sync with file system
    async syncTasksWithFileSystem(projectPath, projectId) {
        const tasksPath = path.join(projectPath, '.agentmux', 'tasks');
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
                }
                else if (fsSync.existsSync(blockedFile)) {
                    // Task was blocked, update status
                    await this.updateTaskStatus(task.id, 'blocked', 'Moved to blocked folder manually');
                }
            }
        }
    }
    // Get available open tasks for a project
    async getOpenTasks(projectPath) {
        const tasksPath = path.join(projectPath, '.agentmux', 'tasks');
        const openTasks = [];
        if (!fsSync.existsSync(tasksPath)) {
            return openTasks;
        }
        const milestones = await fs.readdir(tasksPath);
        for (const milestone of milestones) {
            if (!milestone.startsWith('m') || !milestone.includes('_'))
                continue;
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
    extractTaskNameFromFile(filename) {
        // Remove extension and number prefix
        return filename
            .replace('.md', '')
            .replace(/^\d+_/, '')
            .replace(/_[a-z]+$/, '') // Remove role suffix
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }
}
//# sourceMappingURL=task-tracking.service.js.map