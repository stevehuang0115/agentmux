export interface Task {
    id: string;
    title: string;
    description: string;
    status: 'open' | 'in_progress' | 'review' | 'done' | 'blocked';
    priority: 'low' | 'medium' | 'high' | 'critical';
    assignee?: string;
    milestone: string;
    milestoneId: string;
    tasks: string[];
    acceptanceCriteria: string[];
    filePath: string;
    createdAt: string;
    updatedAt: string;
}
export interface Milestone {
    id: string;
    name: string;
    title: string;
    tasks: Task[];
}
export declare class TaskService {
    private tasksDir;
    constructor(projectPath?: string);
    private parseMarkdownContent;
    getAllTasks(): Promise<Task[]>;
    getMilestones(): Promise<Milestone[]>;
    getTasksByStatus(status: string): Promise<Task[]>;
    getTasksByMilestone(milestoneId: string): Promise<Task[]>;
}
//# sourceMappingURL=task.service.d.ts.map