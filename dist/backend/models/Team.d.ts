import { Team, TeamMember } from '../types/index.js';
export declare class TeamModel implements Team {
    id: string;
    name: string;
    description?: string;
    members: TeamMember[];
    currentProject?: string;
    status: Team['status'];
    createdAt: string;
    updatedAt: string;
    constructor(data: Partial<Team>);
    updateStatus(status: Team['status']): void;
    assignToProject(projectId: string): void;
    addMember(member: TeamMember): void;
    removeMember(memberId: string): void;
    updateMember(memberId: string, updates: Partial<TeamMember>): void;
    assignTicketsToMember(memberId: string, ticketIds: string[]): void;
    toJSON(): Team;
    static fromJSON(data: Team): TeamModel;
}
//# sourceMappingURL=Team.d.ts.map