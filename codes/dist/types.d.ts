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
export interface ActivityEntry {
    timestamp: string;
    type: 'project' | 'team' | 'pane';
    targetId: string;
    status: 'active' | 'idle';
    metadata?: Record<string, any>;
}
export interface ActivityLog {
    entries: ActivityEntry[];
}
export interface APIResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    timestamp?: string;
}
export interface TmuxSession {
    id: string;
    name: string;
    windows: TmuxWindow[];
    created?: string;
    lastActivity?: string;
}
export interface TmuxWindow {
    id: string;
    index: number;
    name: string;
    panes: TmuxPane[];
    active?: boolean;
}
export interface TmuxPane {
    id: string;
    index: number;
    active?: boolean;
    byteCount?: number;
    lastByteCount?: number;
}
export interface ValidationError {
    field: string;
    message: string;
}
export interface FileStorageConfig {
    maxActivityEntries?: number;
    backupBeforeSave?: boolean;
    dataDirectory?: string;
}
//# sourceMappingURL=types.d.ts.map