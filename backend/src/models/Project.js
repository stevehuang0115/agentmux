export class ProjectModel {
    id;
    name;
    path;
    teams;
    status;
    createdAt;
    updatedAt;
    constructor(data) {
        this.id = data.id || '';
        this.name = data.name || '';
        this.path = data.path || '';
        this.teams = data.teams || {};
        this.status = data.status || 'stopped';
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }
    updateStatus(status) {
        this.status = status;
        this.updatedAt = new Date().toISOString();
    }
    assignTeam(teamId, role) {
        if (!this.teams[role]) {
            this.teams[role] = [];
        }
        if (!this.teams[role].includes(teamId)) {
            this.teams[role].push(teamId);
        }
        this.updatedAt = new Date().toISOString();
    }
    unassignTeam(teamId, role) {
        if (role) {
            // Unassign from specific role
            if (this.teams[role]) {
                this.teams[role] = this.teams[role].filter(id => id !== teamId);
                if (this.teams[role].length === 0) {
                    delete this.teams[role];
                }
            }
        }
        else {
            // Unassign from all roles
            for (const [currentRole, teamIds] of Object.entries(this.teams)) {
                this.teams[currentRole] = teamIds.filter(id => id !== teamId);
                if (this.teams[currentRole].length === 0) {
                    delete this.teams[currentRole];
                }
            }
        }
        this.updatedAt = new Date().toISOString();
    }
    getAssignedTeams() {
        return Object.values(this.teams).flat();
    }
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            path: this.path,
            teams: this.teams,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
    static fromJSON(data) {
        return new ProjectModel(data);
    }
}
//# sourceMappingURL=Project.js.map