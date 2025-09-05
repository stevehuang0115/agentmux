export interface InProgressTask {
    id: string;
    projectId: string;
    taskFilePath: string;
    taskName: string;
    targetRole: string;
    assignedTeamMemberId: string;
    assignedSessionId: string;
    assignedAt: string;
    status: 'assigned' | 'active' | 'blocked' | 'pending_assignment';
    lastCheckedAt?: string;
    blockReason?: string;
    priority?: 'low' | 'medium' | 'high';
}
export interface TaskTrackingData {
    tasks: InProgressTask[];
    lastUpdated: string;
    version: string;
}
export interface TaskStatus {
    status: 'open' | 'in_progress' | 'done' | 'blocked';
    folder: string;
}
export interface TaskFileInfo {
    filePath: string;
    fileName: string;
    taskName: string;
    targetRole: string;
    milestoneFolder: string;
    statusFolder: 'open' | 'in_progress' | 'done' | 'blocked';
}
//# sourceMappingURL=task-tracking.types.d.ts.map