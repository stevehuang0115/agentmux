import { Project } from '../types/index.js';
export declare class ProjectModel implements Project {
    id: string;
    name: string;
    path: string;
    teams: Record<string, string[]>;
    status: 'active' | 'paused' | 'completed' | 'stopped';
    createdAt: string;
    updatedAt: string;
    constructor(data: Partial<Project>);
    updateStatus(status: Project['status']): void;
    assignTeam(teamId: string, role: string): void;
    unassignTeam(teamId: string, role?: string): void;
    getAssignedTeams(): string[];
    toJSON(): Project;
    static fromJSON(data: Project): ProjectModel;
}
//# sourceMappingURL=Project.d.ts.map