import { Team, TeamMember } from '../types/index.js';

export class TeamModel implements Team {
  id: string;
  name: string;
  description?: string;
  members: TeamMember[];
  currentProject?: string;
  status: 'idle' | 'working' | 'blocked' | 'terminated';
  createdAt: string;
  updatedAt: string;

  constructor(data: Partial<Team>) {
    this.id = data.id || '';
    this.name = data.name || '';
    this.description = data.description;
    this.members = data.members || [];
    this.status = data.status || 'idle';
    this.currentProject = data.currentProject;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  updateStatus(status: Team['status']): void {
    this.status = status;
    this.updatedAt = new Date().toISOString();
  }

  assignToProject(projectId: string): void {
    this.currentProject = projectId;
    this.updatedAt = new Date().toISOString();
  }

  addMember(member: TeamMember): void {
    this.members.push(member);
    this.updatedAt = new Date().toISOString();
  }

  removeMember(memberId: string): void {
    this.members = this.members.filter(member => member.id !== memberId);
    this.updatedAt = new Date().toISOString();
  }

  updateMember(memberId: string, updates: Partial<TeamMember>): void {
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

  assignTicketsToMember(memberId: string, ticketIds: string[]): void {
    const memberIndex = this.members.findIndex(member => member.id === memberId);
    if (memberIndex !== -1) {
      this.members[memberIndex].currentTickets = ticketIds;
      this.members[memberIndex].updatedAt = new Date().toISOString();
      this.updatedAt = new Date().toISOString();
    }
  }

  toJSON(): Team {
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

  static fromJSON(data: Team): TeamModel {
    return new TeamModel(data);
  }
}