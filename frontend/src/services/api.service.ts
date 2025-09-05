import axios from 'axios';
import { Project, Team, Ticket, ApiResponse } from '../types';

const API_BASE = '/api';

class ApiService {
  // Project methods
  async getProjects(): Promise<Project[]> {
    const response = await axios.get<ApiResponse<Project[]>>(`${API_BASE}/projects`);
    return response.data.data || [];
  }

  async getProject(id: string): Promise<Project> {
    const response = await axios.get<ApiResponse<Project>>(`${API_BASE}/projects/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Project not found');
    }
    return response.data.data;
  }

  async createProject(path: string, name?: string, description?: string): Promise<Project> {
    const response = await axios.post<ApiResponse<Project>>(`${API_BASE}/projects`, {
      path,
      name,
      description
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create project');
    }
    return response.data.data;
  }

  async startProject(projectId: string, teamIds: string[]): Promise<{ message: string }> {
    const response = await axios.post<ApiResponse<any>>(`${API_BASE}/projects/${projectId}/start`, {
      teamIds
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to start project');
    }
    return {
      message: response.data.message || 'Project started successfully'
    };
  }

  async assignTeamsToProject(projectId: string, teamIds: string[]): Promise<void> {
    // Backend expects teamAssignments format based on integration tests
    // Convert team IDs to team assignments by role (get roles from team members)
    const teams = await this.getTeams();
    const teamAssignments: Record<string, string[]> = {};
    
    teamIds.forEach(teamId => {
      const team = teams.find(t => t.id === teamId);
      if (team && team.members.length > 0) {
        // Use the role of the first team member as the team's primary role
        const primaryRole = team.members[0].role;
        if (!teamAssignments[primaryRole]) {
          teamAssignments[primaryRole] = [];
        }
        teamAssignments[primaryRole].push(teamId);
      }
    });
    
    const response = await axios.post<ApiResponse<void>>(`${API_BASE}/projects/${projectId}/assign-teams`, {
      teamAssignments
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to assign teams');
    }
  }

  // Team methods
  async getTeams(): Promise<Team[]> {
    const response = await axios.get<ApiResponse<Team[]>>(`${API_BASE}/teams`);
    return response.data.data || [];
  }

  async getTeam(id: string): Promise<Team> {
    const response = await axios.get<ApiResponse<Team>>(`${API_BASE}/teams/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Team not found');
    }
    return response.data.data;
  }

  async createTeam(team: Omit<Team, 'id' | 'createdAt' | 'updatedAt' | 'sessionName'>): Promise<Team> {
    const response = await axios.post<ApiResponse<Team>>(`${API_BASE}/teams`, team);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create team');
    }
    return response.data.data;
  }

  async deleteTeam(id: string): Promise<void> {
    const response = await axios.delete<ApiResponse<void>>(`${API_BASE}/teams/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete team');
    }
  }

  async unassignTeamFromProject(projectId: string, teamId: string): Promise<void> {
    const response = await axios.post<ApiResponse<void>>(`${API_BASE}/projects/${projectId}/unassign-team`, {
      teamId
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to unassign team');
    }
  }

  // Ticket methods
  async getProjectTickets(projectId: string): Promise<Ticket[]> {
    const response = await axios.get<ApiResponse<Ticket[]>>(`${API_BASE}/projects/${projectId}/tickets`);
    return response.data.data || [];
  }

  async createTicket(projectId: string, ticket: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>): Promise<Ticket> {
    const response = await axios.post<ApiResponse<Ticket>>(`${API_BASE}/projects/${projectId}/tickets`, ticket);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create ticket');
    }
    return response.data.data;
  }

  async updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket> {
    const response = await axios.patch<ApiResponse<Ticket>>(`${API_BASE}/tickets/${id}`, updates);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update ticket');
    }
    return response.data.data;
  }

  async deleteTicket(projectId: string, ticketId: string): Promise<void> {
    const response = await axios.delete<ApiResponse<void>>(`${API_BASE}/projects/${projectId}/tickets/${ticketId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete ticket');
    }
  }

  // Task methods (from markdown files)
  async getAllTasks(projectId: string): Promise<any[]> {
    const response = await axios.get<ApiResponse<any[]>>(`${API_BASE}/projects/${projectId}/tasks`);
    return response.data.data || [];
  }

  async getMilestones(projectId: string): Promise<any[]> {
    const response = await axios.get<ApiResponse<any[]>>(`${API_BASE}/projects/${projectId}/milestones`);
    return response.data.data || [];
  }

  async getTasksByStatus(projectId: string, status: string): Promise<any[]> {
    const response = await axios.get<ApiResponse<any[]>>(`${API_BASE}/projects/${projectId}/tasks/status/${status}`);
    return response.data.data || [];
  }

  async getTasksByMilestone(projectId: string, milestoneId: string): Promise<any[]> {
    const response = await axios.get<ApiResponse<any[]>>(`${API_BASE}/projects/${projectId}/tasks/milestone/${milestoneId}`);
    return response.data.data || [];
  }
}

export const apiService = new ApiService();