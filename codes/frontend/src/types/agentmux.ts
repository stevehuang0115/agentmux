// AgentMux Lightweight Phase 1 Data Models
// Based on specs/architecture-lightweight.md

export interface Project {
  id: string;
  name: string;
  fsPath: string;
  status: 'active' | 'idle' | 'archived';
  createdAt: string;
  lastActivity?: string;
}

export interface Role {
  name: string; // 'orchestrator', 'pm', 'dev', 'qa', 'custom'
  count: number;
  tmuxWindows?: string[]; // window IDs
}

export interface Team {
  id: string;
  name: string;
  roles: Role[];
  tmuxSession?: string;
  status: 'active' | 'idle' | 'paused' | 'stopped';
  createdAt: string;
  lastActivity?: string;
}

export interface Assignment {
  id: string;
  projectId: string;
  teamId: string;
  status: 'active' | 'paused' | 'ended';
  startedAt: string;
  endedAt?: string;
}

export interface ActivityEntry {
  timestamp: string;
  type: 'project' | 'team' | 'pane';
  targetId: string;
  status: 'active' | 'idle';
  metadata?: Record<string, any>;
}

export interface AgentMuxData {
  projects: Project[];
  teams: Team[];
  assignments: Assignment[];
  settings: Settings;
}

export interface Settings {
  pollingInterval: number; // Default 30000ms
  dataPath: string; // ~/.agentmux/data.json
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Phase 1 Status Types
export type ProjectStatus = 'active' | 'idle' | 'archived';
export type TeamStatus = 'active' | 'idle' | 'paused' | 'stopped';
export type AssignmentStatus = 'active' | 'paused' | 'ended';
export type ActivityStatus = 'active' | 'idle';