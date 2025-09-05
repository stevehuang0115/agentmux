export class TeamModel {
    id;
    name;
    description;
    members;
    currentProject;
    status;
    createdAt;
    updatedAt;
    constructor(data) {
        this.id = data.id || '';
        this.name = data.name || '';
        this.description = data.description;
        this.members = data.members || [];
        this.status = data.status || 'idle';
        this.currentProject = data.currentProject;
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }
    updateStatus(status) {
        this.status = status;
        this.updatedAt = new Date().toISOString();
    }
    assignToProject(projectId) {
        this.currentProject = projectId;
        this.updatedAt = new Date().toISOString();
    }
    addMember(member) {
        this.members.push(member);
        this.updatedAt = new Date().toISOString();
    }
    removeMember(memberId) {
        this.members = this.members.filter(member => member.id !== memberId);
        this.updatedAt = new Date().toISOString();
    }
    updateMember(memberId, updates) {
        const memberIndex = this.members.findIndex(member => member.id === memberId);
        if (memberIndex !== -1) {
            this.members[memberIndex] = {
                ...this.members[memberIndex],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this.updatedAt = new Date().toISOString();
        }
    }
    assignTicketsToMember(memberId, ticketIds) {
        const memberIndex = this.members.findIndex(member => member.id === memberId);
        if (memberIndex !== -1) {
            this.members[memberIndex].currentTickets = ticketIds;
            this.members[memberIndex].updatedAt = new Date().toISOString();
            this.updatedAt = new Date().toISOString();
        }
    }
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            members: this.members,
            currentProject: this.currentProject,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
    static fromJSON(data) {
        return new TeamModel(data);
    }
}
//# sourceMappingURL=Team.js.map