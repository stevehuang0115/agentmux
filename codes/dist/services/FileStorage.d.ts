export interface Project {
    id: string;
    name: string;
    fsPath: string;
    status: 'active' | 'idle' | 'archived';
    createdAt: string;
    lastActivity?: string;
    assignedTeamId?: string;
}
export interface Role {
    name: string;
    count: number;
    tmuxWindows?: string[];
}
export interface Team {
    id: string;
    name: string;
    roles: Role[];
    tmuxSession?: string;
    tmuxSessionName?: string;
    status: 'active' | 'idle' | 'paused' | 'stopped';
    createdAt: string;
    lastActivity?: string;
    assignedProjectId?: string;
}
export interface Assignment {
    id: string;
    projectId: string;
    teamId: string;
    status: 'active' | 'paused' | 'ended';
    startedAt: string;
    endedAt?: string;
}
export interface ActivityEntry {
    timestamp: string;
    type: 'project' | 'team' | 'pane';
    targetId: string;
    status: 'active' | 'idle';
    metadata?: Record<string, any>;
}
export interface Settings {
    version: string;
    created: string;
    pollingInterval: number;
}
export interface AgentMuxData {
    projects: Project[];
    teams: Team[];
    assignments: Assignment[];
    settings: Settings;
}
export interface ActivityLog {
    entries: ActivityEntry[];
}
export interface FileStorageConfig {
    maxActivityEntries?: number;
    backupBeforeSave?: boolean;
    dataDirectory?: string;
}
export declare class FileStorage {
    private dataDir;
    private dataPath;
    private activityPath;
    private config;
    private activityWriteLock;
    constructor(dataDir?: string, config?: FileStorageConfig);
    private ensureDataDir;
    private getDefaultData;
    private validateData;
    loadData(): Promise<AgentMuxData>;
    saveData(data: AgentMuxData): Promise<void>;
    loadActivity(): Promise<ActivityLog>;
    appendActivity(entry: ActivityEntry): Promise<void>;
    private getProjectPath;
    private validateSpecPath;
    writeSpec(projectId: string, specPath: string, content: string): Promise<void>;
    readSpec(projectId: string, specPath: string): Promise<string>;
    getProjects(): Promise<Project[]>;
    createProject(projectData: Partial<Project>): Promise<Project>;
    updateProject(projectId: string, updates: Partial<Project>): Promise<Project | null>;
    deleteProject(projectId: string): Promise<boolean>;
    getTeams(): Promise<Team[]>;
    createTeam(teamData: Partial<Team>): Promise<Team>;
    updateTeam(teamId: string, updates: Partial<Team>): Promise<Team | null>;
    deleteTeam(teamId: string): Promise<boolean>;
    getAssignments(): Promise<Assignment[]>;
    createAssignment(assignmentData: Partial<Assignment>): Promise<Assignment>;
    updateAssignment(assignmentId: string, updates: Partial<Assignment>): Promise<Assignment | null>;
    deleteAssignment(assignmentId: string): Promise<boolean>;
    getActivity(limit?: number): Promise<ActivityEntry[]>;
}
//# sourceMappingURL=FileStorage.d.ts.map