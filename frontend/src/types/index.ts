// Frontend types (mirrors backend types exactly)
export interface TeamMember {
  id: string;
  name: string;
  sessionName: string; // tmux session name
  role: 'orchestrator' | 'tpm' | 'pgm' | 'developer' | 'qa' | 'tester' | 'designer';
  systemPrompt: string;
  status: 'idle' | 'working' | 'blocked' | 'terminated';
  currentTickets?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  members: TeamMember[];
  currentProject?: string;
  status: 'idle' | 'working' | 'blocked' | 'terminated';
  createdAt: string;
  updatedAt: string;
}

// UI-specific Team interface for new dashboard components
export interface UITeam {
  id: string;
  name: string;
  project: string;
  members: number;
  status: 'idle' | 'working' | 'blocked' | 'terminated';
  lastActivity: string;
  description?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  path: string; // absolute filesystem path
  teams: Record<string, string[]>; // team assignments
  status: 'active' | 'paused' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'review' | 'done' | 'blocked';
  assignedTo?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  labels?: string[];
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledCheck {
  id: string;
  targetSession: string;
  message: string;
  scheduledFor: string;
  intervalMinutes?: number;
  isRecurring: boolean;
  createdAt: string;
}

export interface TerminalOutput {
  sessionName: string;
  content: string;
  timestamp: string;
  type: 'stdout' | 'stderr';
}

export interface WebSocketMessage {
  type: 'terminal_output' | 'file_change' | 'team_status' | 'schedule_update';
  payload: any;
  timestamp: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}