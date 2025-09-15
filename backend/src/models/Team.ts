import { Team, TeamMember } from '../types/index.js';
import { RUNTIME_TYPES } from '../constants.js';

export class TeamModel implements Team {
  id: string;
  name: string;
  description?: string;
  members: TeamMember[];
  currentProject?: string;
  createdAt: string;
  updatedAt: string;

  constructor(data: Partial<Team>) {
    this.id = data.id || '';
    this.name = data.name || '';
    this.description = data.description;
    this.members = data.members || [];
    this.currentProject = data.currentProject;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
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
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(data: Team): TeamModel {
    // Handle data migration from legacy format
    const migratedData = { ...data };
    
    // Migrate legacy status fields for team members
    if (migratedData.members) {
      migratedData.members = migratedData.members.map((member: any) => {
        const migratedMember = { ...member };
        // Migrate legacy 'status' field to 'agentStatus'
        if (member.status && !member.agentStatus) {
          // Map legacy status values to new agentStatus values
          switch (member.status) {
            case 'active':
              migratedMember.agentStatus = 'active';
              break;
            case 'idle':
            case 'inactive':
              migratedMember.agentStatus = 'inactive';
              break;
            case 'activating':
              migratedMember.agentStatus = 'activating';
              break;
            default:
              migratedMember.agentStatus = 'inactive';
          }

          // Remove legacy field
          delete migratedMember.status;
        }

        // Ensure workingStatus exists (default to 'idle')
        if (!migratedMember.workingStatus) {
          migratedMember.workingStatus = 'idle';
        }

        // Ensure agentStatus exists (default to 'inactive')
        // CRITICAL: Only set default for truly missing fields, preserve 'activating'/'active' states
        if (migratedMember.agentStatus === undefined || migratedMember.agentStatus === null) {
          migratedMember.agentStatus = 'inactive';
        }

        // Ensure runtimeType exists (default to 'claude-code')
        if (!migratedMember.runtimeType) {
          migratedMember.runtimeType = RUNTIME_TYPES.CLAUDE_CODE;
        }
        return migratedMember;
      });
    }
    
    return new TeamModel(migratedData);
  }
}