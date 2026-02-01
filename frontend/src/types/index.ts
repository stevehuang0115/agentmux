// Frontend types (mirrors backend types exactly)
export interface TeamMember {
  id: string;
  name: string;
  sessionName: string; // terminal session name
  role: string; // Now accepts any role key from configuration
  avatar?: string; // URL or emoji
  systemPrompt: string;
  agentStatus: 'inactive' | 'activating' | 'active'; // Connection/registration status
  workingStatus: 'idle' | 'in_progress'; // Activity level status
  runtimeType: 'claude-code' | 'gemini-cli' | 'codex-cli'; // AI runtime to use
  currentTickets?: string[];
  readyAt?: string; // ISO timestamp when agent reported ready
  capabilities?: string[]; // Agent-reported capabilities
  lastActivityCheck?: string; // ISO timestamp of last activity monitoring
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  members: TeamMember[];
  currentProject?: string;
  createdAt: string;
  updatedAt: string;
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
  payload: unknown;
  timestamp: string;
}

/**
 * WebSocket event data for team member status changes
 * Used by Teams and TeamDetail pages for real-time status updates
 */
export interface TeamMemberStatusChangeEvent {
  teamId: string;
  memberId: string;
  sessionName: string;
  agentStatus: TeamMember['agentStatus'];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Re-export factory types
export * from './factory.types';

// Re-export role types
export * from './role.types';

// Re-export settings types
export * from './settings.types';

// Re-export chat types
export * from './chat.types';

// Re-export skill types
export * from './skill.types';
