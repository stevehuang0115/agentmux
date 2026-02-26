export interface TeamMember {
  id: string;
  name: string;
  sessionName: string; // tmux session name
  role: 'orchestrator' | 'tpm' | 'architect' | 'pgm' | 'developer' | 'frontend-developer' | 'backend-developer' | 'fullstack-dev' | 'qa' | 'qa-engineer' | 'tester' | 'designer' | 'product-manager' | 'sales' | 'support';
  avatar?: string; // URL or emoji for member avatar
  systemPrompt: string;
  agentStatus: 'inactive' | 'starting' | 'started' | 'active' | 'suspended' | 'activating'; // Connection/registration status (activating is deprecated)
  workingStatus: 'idle' | 'in_progress'; // Activity level status
  runtimeType: 'claude-code' | 'gemini-cli' | 'codex-cli'; // AI runtime to use
  skillOverrides?: string[]; // Additional skill IDs beyond what the role provides
  excludedRoleSkills?: string[]; // Role skills to exclude for this specific member
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
  projectIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  path: string; // absolute filesystem path
  teams: Record<string, string[]>; // team assignments
  status: 'active' | 'paused' | 'completed' | 'stopped';
  scheduledMessageId?: string; // ID of auto-assignment scheduled message
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
  // YAML frontmatter + markdown body
}

export interface SessionInfo {
  sessionName: string;
  pid: number;
  windows: number;
  created: string;
  attached: boolean;
}

export interface ScheduledCheck {
  id: string;
  targetSession: string;
  message: string;
  scheduledFor: string;
  intervalMinutes?: number;
  isRecurring: boolean;
  label?: string;
  persistent?: boolean;
  timezone?: string;
  recurrenceType?: 'interval' | 'daily' | 'weekdays' | 'weekly';
  timeOfDay?: string;
  dayOfWeek?: number;
  maxOccurrences?: number;
  currentOccurrence?: number;
  createdAt: string;
  /** Optional session name of the agent being monitored (for status enrichment) */
  watchedSession?: string;
}

export interface ScheduledMessage {
  id: string;
  name: string;
  targetTeam: string; // e.g. 'orchestrator', 'frontend-team-pm', 'frontend-team-dev'
  targetProject?: string; // project ID, optional
  message: string; // message content to send
  delayAmount: number; // numeric amount
  delayUnit: 'seconds' | 'minutes' | 'hours'; // time unit
  isRecurring: boolean; // one-time or recurring
  isActive: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageDeliveryLog {
  id: string;
  scheduledMessageId: string;
  messageName: string;
  targetTeam: string;
  targetProject?: string;
  message: string;
  sentAt: string;
  success: boolean;
  error?: string;
}

export interface FileChange {
  type: 'created' | 'updated' | 'deleted';
  path: string;
  timestamp: string;
}

export interface TicketFilter {
  status?: string;
  assignedTo?: string;
  projectId?: string;
  priority?: string;
}

export interface TeamMemberConfig {
  name: string;
  role: TeamMember['role'];
  systemPrompt: string;
  skillOverrides?: string[];
  excludedRoleSkills?: string[];
}

export interface TeamConfig {
  name: string;
  description?: string;
  members: TeamMemberConfig[];
  projectPath?: string;
}

export interface TeamMemberSessionConfig {
  name: string;
  role: TeamMember['role'];
  systemPrompt: string;
  projectPath?: string;
  memberId?: string;
  runtimeType?: TeamMember['runtimeType'];
  skillOverrides?: string[];
  excludedRoleSkills?: string[];
}

export interface TerminalOutput {
  sessionName: string;
  content: string;
  timestamp: string;
  type: 'stdout' | 'stderr';
}

export interface WebSocketMessage {
  type: 'terminal_output' | 'file_change' | 'team_status' | 'schedule_update'
       | 'connection_established' | 'subscription_confirmed' | 'unsubscription_confirmed'
       | 'session_not_found' | 'session_pending' | 'input_error' | 'initial_terminal_state'
       | 'terminal_state_error' | 'system_notification' | 'orchestrator_status_changed'
       | 'team_member_status_changed' | 'team_activity_updated';
  payload: any;
  timestamp: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface StartupConfig {
  webPort: number;
  crewlyHome: string;
  defaultCheckInterval: number;
  autoCommitInterval: number;
}

// Re-export memory types
export * from './memory.types.js';

// Re-export continuation types
export * from './continuation.types.js';

// Re-export quality gate types
export * from './quality-gate.types.js';

// Re-export SOP types
export * from './sop.types.js';

// Re-export auto-assignment types
export * from './auto-assign.types.js';

// Re-export budget types
export * from './budget.types.js';

// Re-export scheduler types
export * from './scheduler.types.js';

// Re-export role types
export * from './role.types.js';

// Re-export settings types
export * from './settings.types.js';

// Re-export skill types
export * from './skill.types.js';

// Re-export chat types
export * from './chat.types.js';

// Re-export task output types
export * from './task-output.types.js';
