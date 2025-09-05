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
export declare class ActiveProjectsService {
    private readonly activeProjectsPath;
    private storageService?;
    constructor(storageService?: StorageService);
    loadActiveProjectsData(): Promise<ActiveProjectsData>;
    saveActiveProjectsData(data: ActiveProjectsData): Promise<void>;
    startProject(projectId: string, messageSchedulerService?: any): Promise<{
        checkInScheduleId?: string;
        gitCommitScheduleId?: string;
    }>;
    stopProject(projectId: string, messageSchedulerService?: any): Promise<void>;
    restartProject(projectId: string, messageSchedulerService?: any): Promise<{
        checkInScheduleId?: string;
        gitCommitScheduleId?: string;
    }>;
    getActiveProjects(): Promise<ActiveProject[]>;
    getAllProjects(): Promise<ActiveProject[]>;
    getProjectStatus(projectId: string): Promise<ActiveProject | null>;
    isProjectRunning(projectId: string): Promise<boolean>;
    private createProjectCheckInSchedule;
    private createProjectGitCommitSchedule;
    cleanupStoppedProjects(olderThanDays?: number): Promise<number>;
}
//# sourceMappingURL=active-projects.service.d.ts.map