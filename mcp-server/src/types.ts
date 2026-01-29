export interface MCPRequest {
  jsonrpc: string;
  id?: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: string;
  id?: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

export interface SendMessageParams {
  to: string;
  message: string;
  type?: string;
}

export interface BroadcastParams {
  message: string;
  excludeSelf?: boolean;
}

export interface GetTicketsParams {
  status?: string;
  all?: boolean;
}

export interface UpdateTicketParams {
  ticketId: string;
  status?: string;
  notes?: string;
  blockers?: string[];
}

export interface ReportProgressParams {
  ticketId?: string;
  progress: number;
  completed?: string[];
  current?: string;
  blockers?: string[];
  nextSteps?: string;
}

export interface RequestReviewParams {
  ticketId: string;
  reviewer?: string;
  branch?: string;
  message?: string;
}

export interface ScheduleCheckParams {
  minutes: number;
  message: string;
  target?: string;
}

export interface EnforceCommitParams {
  message?: string;
}

export interface CreateTeamParams {
  role: string;
  name: string;
  projectPath: string;
  systemPrompt?: string;
}

export interface DelegateTaskParams {
  to: string;
  task: string;
  priority: string;
  ticketId?: string;
}

export interface AssignTaskDelegationParams {
  absoluteTaskPath: string;
  targetSessionName: string;
  delegatedBy?: string;
  reason?: string;
  delegationChain?: string[];
}

export interface LoadProjectContextParams {
  includeFiles?: boolean;
  includeGitHistory?: boolean;
  includeTickets?: boolean;
}

export interface AssignTaskParams {
  absoluteTaskPath: string;
  teamMemberId: string;
  sessionName: string;
}

export interface AcceptTaskParams {
  absoluteTaskPath: string;
  sessionName: string;
}

export interface CompleteTaskParams {
  absoluteTaskPath: string;
  sessionName: string;
}

export interface ReadTaskParams {
  absoluteTaskPath: string;
}

export interface BlockTaskParams {
  absoluteTaskPath: string;
  reason: string;
  questions?: string[];
  urgency?: 'low' | 'medium' | 'high';
}

export interface TakeNextTaskParams {
  projectId: string;
  memberRole: string;
}

export interface SyncTaskStatusParams {
  projectId: string;
}

export interface CheckTeamProgressParams {
  projectId: string;
}

export interface ReadTaskFileParams {
  taskPath?: string;
  taskId?: string;
  milestone?: string;
}

export interface ReportReadyParams {
  role: string;
  capabilities?: string[];
}

export interface RegisterAgentStatusParams {
  role: string;
  sessionName: string;
  teamMemberId?: string;
}

export interface GetAgentLogsParams {
  agentName?: string;
  sessionName?: string;
  lines?: number;
}

export interface GetAgentStatusParams {
  agentName?: string;
  sessionName?: string;
}

export interface ShutdownAgentParams {
  sessionName: string;
}

export interface TicketInfo {
  id: string;
  title: string;
  status: string;
  assignedTo?: string;
  priority?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  path?: string;
  milestone?: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export interface AgentStatus {
  agentStatus: string;
  workingStatus: string;
  lastActivityCheck: string;
  sessionActive: boolean;
}

// ============================================
// Session Types
// ============================================

export interface TmuxSession {
  sessionName: string;
  windowName?: string;
  paneId?: string;
  isAttached?: boolean;
  createdAt?: string;
}

// ============================================
// Team and Member Types
// ============================================

export interface TeamMember {
  id: string;
  name: string;
  sessionName: string;
  role: string;
  systemPrompt?: string;
  agentStatus: 'inactive' | 'activating' | 'active';
  workingStatus: 'idle' | 'in_progress';
  runtimeType?: 'claude-code' | 'gemini-cli' | 'codex-cli';
  currentTickets?: string[];
  readyAt?: string;
  capabilities?: string[];
  avatar?: string;
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

export interface TeamResponse {
  success: boolean;
  data?: Team;
  error?: string;
}

export interface TeamsListResponse {
  success: boolean;
  data?: Team[];
  error?: string;
}

// ============================================
// Agent Data Types
// ============================================

export interface BackendAgentData {
  agentStatus: string;
  workingStatus: string;
  currentTickets?: string[];
  teamId?: string;
  memberName?: string;
  role?: string;
  lastActivityCheck?: string;
}

export interface AgentStatusResult {
  sessionName: string;
  exists: boolean;
  agentStatus: string;
  workingStatus: string;
  teamId?: string;
  teamName?: string;
  memberName?: string;
  role?: string;
  currentTickets?: string[];
  lastActivity?: string;
  recentOutput?: string;
  error?: string;
}

// ============================================
// Task Types
// ============================================

export interface TaskContent {
  id: string;
  title: string;
  description?: string;
  status: string;
  assignedTo?: string;
  priority?: string;
  labels?: string[];
  filePath?: string;
  milestone?: string;
  acceptanceCriteria?: string[];
  tasks?: string[];
  projectName?: string;
}

export interface InProgressTask {
  id?: string;
  taskId?: string;
  taskPath: string;
  taskName?: string;
  filePath?: string;
  assignedTo?: string;
  assignedSessionName?: string;
  assignedTeamMemberId?: string;
  assignedAt?: string;
  sessionName?: string;
  teamId?: string;
  projectId?: string;
  startedAt?: string;
  status: string;
  originalPath?: string;
}

export interface TaskTrackingData {
  tasks: InProgressTask[];
  lastUpdated: string;
  version: string;
}

export interface TaskDetails {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assignedTo?: string;
  milestone?: string;
  filePath?: string;
  projectName?: string;
}

export interface AssignmentResult {
  success: boolean;
  taskPath?: string;
  teamId?: string;
  projectId?: string;
  error?: string;
  newPath?: string;
  memberId?: string;
}

// ============================================
// Terminate Agent Types
// ============================================

export interface TerminateAgentParams {
  sessionName: string;
  force?: boolean;
  reason?: string;
}

export interface TerminateAgentsParams {
  sessionNames: string[];
  force?: boolean;
  reason?: string;
}

// ============================================
// Recovery Types
// ============================================

export interface RecoveryReportData {
  totalInProgress: number;
  recovered: number;
  skipped: number;
  recoveredTasks: string[];
  errors: string[];
}

export interface RecoveryReport {
  success: boolean;
  data: RecoveryReportData;
}

export interface RecoveryDetail {
  sessionName: string;
  status: 'recovered' | 'failed' | 'skipped';
  reason?: string;
}

// ============================================
// YAML Field Value Type
// ============================================

export type YAMLFieldValue = string | number | boolean | string[] | null;

// ============================================
// Memory Tool Parameter Types
// ============================================

/**
 * Parameters for the remember tool
 */
export interface RememberToolParams {
  /** The knowledge content to remember */
  content: string;
  /** Category of the knowledge */
  category: 'pattern' | 'decision' | 'gotcha' | 'fact' | 'preference' | 'relationship';
  /** Scope: agent-level or project-level */
  scope: 'agent' | 'project';
  /** Optional short title for the knowledge */
  title?: string;
  /** Additional metadata */
  metadata?: {
    /** Pattern category for project patterns */
    patternCategory?: 'api' | 'component' | 'service' | 'testing' | 'styling' | 'database' | 'config' | 'other';
    /** Code example */
    example?: string;
    /** Related file paths */
    files?: string[];
    /** Rationale for decisions */
    rationale?: string;
    /** Alternatives considered */
    alternatives?: string[];
    /** Areas affected */
    affectedAreas?: string[];
    /** Solution for gotchas */
    solution?: string;
    /** Severity for gotchas */
    severity?: 'low' | 'medium' | 'high' | 'critical';
    /** Relationship type */
    relationshipType?: 'depends-on' | 'uses' | 'extends' | 'implements' | 'calls' | 'imported-by';
    /** Target component for relationships */
    targetComponent?: string;
  };
}

/**
 * Parameters for the recall tool
 */
export interface RecallToolParams {
  /** Context/query for finding relevant memories */
  context: string;
  /** Scope to search: agent, project, or both */
  scope?: 'agent' | 'project' | 'both';
  /** Maximum number of results to return */
  limit?: number;
}

/**
 * Parameters for the record_learning tool
 */
export interface RecordLearningToolParams {
  /** The learning content */
  learning: string;
  /** Related task/ticket ID */
  relatedTask?: string;
  /** Related file paths */
  relatedFiles?: string[];
}