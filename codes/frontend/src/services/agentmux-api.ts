// AgentMux Lightweight API Client
// HTTP polling instead of WebSockets per Phase 1 specs

import { 
  Project, 
  Team, 
  Assignment, 
  ActivityEntry, 
  AgentMuxData,
  APIResponse 
} from '../types/agentmux';

class AgentMuxAPI {
  private baseURL = 'http://localhost:3001';
  
  // Generic API request handler
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const fullURL = endpoint.startsWith('/api/') || endpoint === '/health' 
      ? `${this.baseURL}${endpoint}` 
      : `${this.baseURL}/api${endpoint}`;
      
    console.log('🌐 API Request:', options?.method || 'GET', fullURL);
      
    const response = await fetch(fullURL, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Response Error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result: APIResponse<T> = await response.json();
    console.log('✅ API Response:', endpoint, result.success ? 'SUCCESS' : 'FAILED');

    if (!result.success) {
      throw new Error(result.error || 'API request failed');
    }

    return result.data as T;
  }

  // Health check (special endpoint at /health, not /api/health)
  async health(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/health');
  }

  // Project CRUD operations
  async getProjects(): Promise<Project[]> {
    return this.request<Project[]>('/projects');
  }

  async createProject(project: Omit<Project, 'id' | 'createdAt'>): Promise<Project> {
    return this.request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    return this.request<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteProject(id: string): Promise<void> {
    return this.request<void>(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  // Team CRUD operations  
  async getTeams(): Promise<Team[]> {
    return this.request<Team[]>('/teams');
  }

  async createTeam(team: Omit<Team, 'id' | 'createdAt'>): Promise<Team> {
    return this.request<Team>('/teams', {
      method: 'POST',
      body: JSON.stringify(team),
    });
  }

  async updateTeam(id: string, updates: Partial<Team>): Promise<Team> {
    return this.request<Team>(`/teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTeam(id: string): Promise<void> {
    return this.request<void>(`/teams/${id}`, {
      method: 'DELETE',
    });
  }

  // Assignment operations
  async getAssignments(): Promise<Assignment[]> {
    return this.request<Assignment[]>('/assignments');
  }

  async createAssignment(assignment: Omit<Assignment, 'id'>): Promise<Assignment> {
    return this.request<Assignment>('/assignments', {
      method: 'POST',
      body: JSON.stringify(assignment),
    });
  }

  async updateAssignment(id: string, updates: Partial<Assignment>): Promise<Assignment> {
    return this.request<Assignment>(`/assignments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteAssignment(id: string): Promise<void> {
    return this.request<void>(`/assignments/${id}`, {
      method: 'DELETE',
    });
  }

  // Activity monitoring
  async getActivity(): Promise<ActivityEntry[]> {
    return this.request<ActivityEntry[]>('/activity');
  }

  async refreshActivity(): Promise<void> {
    return this.request<void>('/activity/refresh', {
      method: 'POST',
    });
  }

  // Spec file management
  async getSpec(projectId: string, path: string): Promise<string> {
    return this.request<string>(`/specs/${projectId}/${path}`);
  }

  async saveSpec(projectId: string, path: string, content: string): Promise<void> {
    return this.request<void>(`/specs/${projectId}/${path}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  // All data fetch for polling
  async getAllData(): Promise<AgentMuxData> {
    const [projects, teams, assignments] = await Promise.all([
      this.getProjects(),
      this.getTeams(),
      this.getAssignments(),
    ]);

    return {
      projects,
      teams,
      assignments,
      settings: {
        pollingInterval: 30000,
        dataPath: '~/.agentmux/data.json',
      },
    };
  }
}

export const agentMuxAPI = new AgentMuxAPI();
export default agentMuxAPI;