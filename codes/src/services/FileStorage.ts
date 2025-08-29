import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

// Import types from central types file
export interface Project {
  id: string;
  name: string;
  fsPath: string; // Changed from 'path' to 'fsPath' per spec
  status: 'active' | 'idle' | 'archived';
  createdAt: string; // ISO string instead of Date
  lastActivity?: string;
  assignedTeamId?: string;
}

export interface Role {
  name: string; // 'orchestrator', 'pm', 'dev', 'qa'
  count: number;
  tmuxWindows?: string[]; // window IDs
}

export interface Team {
  id: string;
  name: string;
  roles: Role[]; // Changed from TeamRole[] to Role[]
  tmuxSession?: string;
  tmuxSessionName?: string;
  status: 'active' | 'idle' | 'paused' | 'stopped';
  createdAt: string; // ISO string instead of Date
  lastActivity?: string;
  assignedProjectId?: string;
}

export interface Assignment {
  id: string;
  projectId: string;
  teamId: string;
  status: 'active' | 'paused' | 'ended'; // Changed 'completed' to 'ended' per spec
  startedAt: string; // Changed from createdAt to startedAt
  endedAt?: string;
}

export interface ActivityEntry {
  timestamp: string; // ISO string instead of Date
  type: 'project' | 'team' | 'pane'; // Simplified types per spec
  targetId: string;
  status: 'active' | 'idle';
  metadata?: Record<string, any>;
}

export interface Settings {
  version: string;
  created: string;
  pollingInterval: number; // milliseconds
}

export interface AgentMuxData {
  projects: Project[];
  teams: Team[];
  assignments: Assignment[];
  settings: Settings; // Changed from version/lastUpdated to settings object
}

export interface ActivityLog {
  entries: ActivityEntry[];
}

export interface FileStorageConfig {
  maxActivityEntries?: number;
  backupBeforeSave?: boolean;
  dataDirectory?: string;
}

export class FileStorage {
  private dataDir: string;
  private dataPath: string;
  private activityPath: string;
  private config: Required<FileStorageConfig>;
  private activityWriteLock: Promise<void> = Promise.resolve();

  constructor(dataDir?: string, config?: FileStorageConfig) {
    this.dataDir = dataDir || path.join(os.homedir(), '.agentmux');
    this.dataPath = path.join(this.dataDir, 'data.json');
    this.activityPath = path.join(this.dataDir, 'activity.json');
    
    this.config = {
      maxActivityEntries: config?.maxActivityEntries || 1000,
      backupBeforeSave: config?.backupBeforeSave ?? true,
      dataDirectory: this.dataDir
    };
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      if ((error as any).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private getDefaultData(): AgentMuxData {
    return {
      projects: [],
      teams: [],
      assignments: [],
      settings: {
        version: '1.0.0',
        created: new Date().toISOString(),
        pollingInterval: 30000
      }
    };
  }

  private validateData(data: AgentMuxData): void {
    // Validate projects
    data.projects.forEach((project, index) => {
      if (!project.id) throw new Error(`Project ${index}: ID is required`);
      if (!project.name) throw new Error(`Project ${index}: name is required`);
      if (!project.fsPath) throw new Error(`Project ${index}: fsPath is required`);
      if (!project.status) throw new Error(`Project ${index}: status is required`);
      if (!project.createdAt) throw new Error(`Project ${index}: createdAt is required`);
      
      if (!['active', 'idle', 'archived'].includes(project.status)) {
        throw new Error(`Project ${index}: invalid status`);
      }
    });

    // Validate teams
    data.teams.forEach((team, index) => {
      if (!team.id) throw new Error(`Team ${index}: ID is required`);
      if (!team.name) throw new Error(`Team ${index}: name is required`);
      if (!Array.isArray(team.roles)) throw new Error(`Team ${index}: roles must be an array`);
      if (!team.status) throw new Error(`Team ${index}: status is required`);
      if (!team.createdAt) throw new Error(`Team ${index}: createdAt is required`);
      
      if (!['active', 'idle', 'paused', 'stopped'].includes(team.status)) {
        throw new Error(`Team ${index}: invalid status`);
      }

      // Validate roles
      team.roles.forEach((role, roleIndex) => {
        if (!role.name) throw new Error(`Team ${index}, Role ${roleIndex}: name is required`);
        if (typeof role.count !== 'number' || role.count < 0) {
          throw new Error(`Team ${index}, Role ${roleIndex}: count must be a non-negative number`);
        }
      });

      // Check for required orchestrator role
      const hasOrchestrator = team.roles.some(role => role.name === 'orchestrator' && role.count > 0);
      if (!hasOrchestrator) {
        throw new Error(`Team ${index}: must have at least one orchestrator role`);
      }
    });

    // Validate assignments
    data.assignments.forEach((assignment, index) => {
      if (!assignment.id) throw new Error(`Assignment ${index}: ID is required`);
      if (!assignment.projectId) throw new Error(`Assignment ${index}: projectId is required`);
      if (!assignment.teamId) throw new Error(`Assignment ${index}: teamId is required`);
      if (!assignment.status) throw new Error(`Assignment ${index}: status is required`);
      if (!assignment.startedAt) throw new Error(`Assignment ${index}: startedAt is required`);
      
      if (!['active', 'paused', 'ended'].includes(assignment.status)) {
        throw new Error(`Assignment ${index}: invalid status`);
      }
    });
  }

  async loadData(): Promise<AgentMuxData> {
    await this.ensureDataDir();

    try {
      const content = await fs.readFile(this.dataPath, 'utf8');
      const data = JSON.parse(content);
      return data;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // File doesn't exist, return default data
        return this.getDefaultData();
      } else {
        console.warn('Failed to load data file, returning default data:', error);
        return this.getDefaultData();
      }
    }
  }

  async saveData(data: AgentMuxData): Promise<void> {
    await this.ensureDataDir();

    // Validate data before saving
    this.validateData(data);

    // Create backup if file exists and backup is enabled
    if (this.config.backupBeforeSave) {
      try {
        await fs.access(this.dataPath);
        const backupPath = this.dataPath + '.backup';
        await fs.copyFile(this.dataPath, backupPath);
      } catch (error) {
        // Backup failed or original file doesn't exist, continue
      }
    }

    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(this.dataPath, content, 'utf8');
  }

  async loadActivity(): Promise<ActivityLog> {
    await this.ensureDataDir();

    try {
      const content = await fs.readFile(this.activityPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return { entries: [] };
      } else {
        console.warn('Failed to load activity file, returning empty log:', error);
        return { entries: [] };
      }
    }
  }

  async appendActivity(entry: ActivityEntry): Promise<void> {
    // Use a lock to prevent concurrent writes
    this.activityWriteLock = this.activityWriteLock.then(async () => {
      await this.ensureDataDir();

      const activity = await this.loadActivity();
      activity.entries.push(entry);

      // Rotate if too large
      if (activity.entries.length > this.config.maxActivityEntries) {
        const keepCount = this.config.maxActivityEntries;
        activity.entries = activity.entries.slice(-keepCount);
      }

      const content = JSON.stringify(activity, null, 2);
      await fs.writeFile(this.activityPath, content, 'utf8');
    });

    await this.activityWriteLock;
  }

  private async getProjectPath(projectId: string): Promise<string> {
    const data = await this.loadData();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    return project.fsPath;
  }

  private validateSpecPath(specPath: string): void {
    // Prevent path traversal attacks
    const normalizedPath = path.normalize(specPath);
    if (normalizedPath.startsWith('../') || 
        normalizedPath.includes('/../') || 
        normalizedPath.includes('..\\') || 
        normalizedPath.startsWith('..\\') ||
        normalizedPath === '..' ||
        path.isAbsolute(specPath)) {
      throw new Error(`Path traversal not allowed: ${specPath}`);
    }
  }

  async writeSpec(projectId: string, specPath: string, content: string): Promise<void> {
    this.validateSpecPath(specPath);
    
    const projectPath = await this.getProjectPath(projectId);
    const fullPath = path.join(projectPath, specPath);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    await fs.writeFile(fullPath, content, 'utf8');
  }

  async readSpec(projectId: string, specPath: string): Promise<string> {
    this.validateSpecPath(specPath);
    
    const projectPath = await this.getProjectPath(projectId);
    const fullPath = path.join(projectPath, specPath);
    
    try {
      return await fs.readFile(fullPath, 'utf8');
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(`Spec file not found: ${specPath}`);
      }
      throw error;
    }
  }

  // Helper methods for API endpoints

  async getProjects(): Promise<Project[]> {
    const data = await this.loadData();
    return data.projects;
  }

  async createProject(projectData: Partial<Project>): Promise<Project> {
    const data = await this.loadData();
    
    const project: Project = {
      id: projectData.id || `project-${Date.now()}`,
      name: projectData.name || '',
      fsPath: projectData.fsPath || '',
      status: projectData.status || 'idle',
      createdAt: new Date().toISOString(),
      lastActivity: projectData.lastActivity,
      assignedTeamId: projectData.assignedTeamId
    };

    data.projects.push(project);
    await this.saveData(data);
    
    return project;
  }

  async updateProject(projectId: string, updates: Partial<Project>): Promise<Project | null> {
    const data = await this.loadData();
    const projectIndex = data.projects.findIndex(p => p.id === projectId);
    
    if (projectIndex === -1) {
      return null;
    }

    data.projects[projectIndex] = { ...data.projects[projectIndex], ...updates };
    await this.saveData(data);
    
    return data.projects[projectIndex];
  }

  async deleteProject(projectId: string): Promise<boolean> {
    const data = await this.loadData();
    const projectIndex = data.projects.findIndex(p => p.id === projectId);
    
    if (projectIndex === -1) {
      return false;
    }

    data.projects.splice(projectIndex, 1);
    
    // Also remove any assignments for this project
    data.assignments = data.assignments.filter(a => a.projectId !== projectId);
    
    await this.saveData(data);
    return true;
  }

  async getTeams(): Promise<Team[]> {
    const data = await this.loadData();
    return data.teams;
  }

  async createTeam(teamData: Partial<Team>): Promise<Team> {
    const data = await this.loadData();
    
    const team: Team = {
      id: teamData.id || `team-${Date.now()}`,
      name: teamData.name || '',
      roles: teamData.roles || [{ name: 'orchestrator', count: 1 }],
      tmuxSession: teamData.tmuxSession,
      tmuxSessionName: teamData.tmuxSessionName,
      status: teamData.status || 'idle',
      createdAt: new Date().toISOString(),
      lastActivity: teamData.lastActivity,
      assignedProjectId: teamData.assignedProjectId
    };

    data.teams.push(team);
    await this.saveData(data);
    
    return team;
  }

  async updateTeam(teamId: string, updates: Partial<Team>): Promise<Team | null> {
    const data = await this.loadData();
    const teamIndex = data.teams.findIndex(t => t.id === teamId);
    
    if (teamIndex === -1) {
      return null;
    }

    data.teams[teamIndex] = { ...data.teams[teamIndex], ...updates };
    await this.saveData(data);
    
    return data.teams[teamIndex];
  }

  async deleteTeam(teamId: string): Promise<boolean> {
    const data = await this.loadData();
    const teamIndex = data.teams.findIndex(t => t.id === teamId);
    
    if (teamIndex === -1) {
      return false;
    }

    data.teams.splice(teamIndex, 1);
    
    // Also remove any assignments for this team
    data.assignments = data.assignments.filter(a => a.teamId !== teamId);
    
    await this.saveData(data);
    return true;
  }

  async getAssignments(): Promise<Assignment[]> {
    const data = await this.loadData();
    return data.assignments;
  }

  async createAssignment(assignmentData: Partial<Assignment>): Promise<Assignment> {
    const data = await this.loadData();
    
    const assignment: Assignment = {
      id: assignmentData.id || `assignment-${Date.now()}`,
      projectId: assignmentData.projectId || '',
      teamId: assignmentData.teamId || '',
      status: assignmentData.status || 'active',
      startedAt: new Date().toISOString(),
      endedAt: assignmentData.endedAt
    };

    data.assignments.push(assignment);
    await this.saveData(data);
    
    return assignment;
  }

  async updateAssignment(assignmentId: string, updates: Partial<Assignment>): Promise<Assignment | null> {
    const data = await this.loadData();
    const assignmentIndex = data.assignments.findIndex(a => a.id === assignmentId);
    
    if (assignmentIndex === -1) {
      return null;
    }

    data.assignments[assignmentIndex] = { ...data.assignments[assignmentIndex], ...updates };
    await this.saveData(data);
    
    return data.assignments[assignmentIndex];
  }

  async deleteAssignment(assignmentId: string): Promise<boolean> {
    const data = await this.loadData();
    const assignmentIndex = data.assignments.findIndex(a => a.id === assignmentId);
    
    if (assignmentIndex === -1) {
      return false;
    }

    data.assignments.splice(assignmentIndex, 1);
    await this.saveData(data);
    return true;
  }

  async getActivity(limit?: number): Promise<ActivityEntry[]> {
    const activity = await this.loadActivity();
    
    if (limit && limit > 0) {
      return activity.entries.slice(-limit);
    }
    
    return activity.entries;
  }
}