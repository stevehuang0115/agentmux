import { InProgressTask, TaskTrackingData, TaskFileInfo } from '../types/task-tracking.types.js';
export declare class TaskTrackingService {
    private readonly taskTrackingPath;
    constructor();
    loadTaskData(): Promise<TaskTrackingData>;
    saveTaskData(data: TaskTrackingData): Promise<void>;
    assignTask(projectId: string, taskFilePath: string, taskName: string, targetRole: string, teamMemberId: string, sessionId: string): Promise<InProgressTask>;
    updateTaskStatus(taskId: string, status: InProgressTask['status'], blockReason?: string): Promise<void>;
    removeTask(taskId: string): Promise<void>;
    addTaskToQueue(taskInfo: {
        projectId: string;
        taskFilePath: string;
        taskName: string;
        targetRole: string;
        priority: 'low' | 'medium' | 'high';
        createdAt: string;
    }): Promise<InProgressTask>;
    getTasksForProject(projectId: string): Promise<InProgressTask[]>;
    getTasksForTeamMember(teamMemberId: string): Promise<InProgressTask[]>;
    getAllInProgressTasks(): Promise<InProgressTask[]>;
    syncTasksWithFileSystem(projectPath: string, projectId: string): Promise<void>;
    getOpenTasks(projectPath: string): Promise<TaskFileInfo[]>;
    private extractTaskNameFromFile;
}
//# sourceMappingURL=task-tracking.service.d.ts.map