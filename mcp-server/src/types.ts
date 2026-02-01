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
  /** Skip quality gates (not recommended) */
  skipGates?: boolean;
  /** Summary of what was accomplished */
  summary?: string;
}

/**
 * Parameters for the check_quality_gates tool
 */
export interface CheckQualityGatesParams {
  /** Specific gates to run (default: all) */
  gates?: string[];
  /** Skip optional gates */
  skipOptional?: boolean;
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

/**
 * Parameters for the get_sops tool
 */
export interface GetSOPsParams {
  /** Describe what you need guidance on */
  context: string;
  /** Specific category of SOPs (optional) */
  category?: 'workflow' | 'quality' | 'communication' | 'escalation' | 'tools' | 'debugging' | 'testing' | 'git' | 'security';
}

// ============================================
// Role Management Tool Types
// ============================================

/**
 * Parameters for the create_role tool
 */
export interface CreateRoleToolParams {
  /** Internal name for the role (lowercase, hyphens) */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Description of the role purpose */
  description: string;
  /** Role category */
  category: 'development' | 'management' | 'quality' | 'design' | 'sales' | 'support';
  /** The system prompt content for this role (markdown) */
  systemPromptContent: string;
  /** Skill IDs to assign to this role */
  assignedSkills?: string[];
}

/**
 * Parameters for the update_role tool
 */
export interface UpdateRoleToolParams {
  /** ID of the role to update */
  roleId: string;
  /** Human-readable display name */
  displayName?: string;
  /** Description of the role purpose */
  description?: string;
  /** Role category */
  category?: 'development' | 'management' | 'quality' | 'design' | 'sales' | 'support';
  /** The system prompt content for this role (markdown) */
  systemPromptContent?: string;
  /** Skill IDs to assign to this role */
  assignedSkills?: string[];
}

/**
 * Parameters for the list_roles tool
 */
export interface ListRolesToolParams {
  /** Filter by category */
  category?: string;
  /** Search in name/description */
  search?: string;
}

// ============================================
// Skill Management Tool Types
// ============================================

/**
 * Parameters for the create_skill tool
 */
export interface CreateSkillToolParams {
  /** Skill name */
  name: string;
  /** What this skill does */
  description: string;
  /** Skill category */
  category: 'development' | 'design' | 'communication' | 'research' | 'content-creation' | 'automation' | 'analysis' | 'integration';
  /** Skill instructions (markdown) */
  promptContent: string;
  /** Keywords that trigger this skill */
  triggers?: string[];
  /** Searchable tags */
  tags?: string[];
  /** How this skill is executed */
  executionType?: 'prompt-only' | 'script' | 'browser' | 'mcp-tool';
  /** Script configuration (if executionType is script) */
  scriptConfig?: {
    file: string;
    interpreter: 'bash' | 'python' | 'node';
  };
  /** Browser automation config (if executionType is browser) */
  browserConfig?: {
    url: string;
    instructions: string;
  };
}

/**
 * Parameters for the execute_skill tool
 */
export interface ExecuteSkillToolParams {
  /** ID of the skill to execute */
  skillId: string;
  /** Execution context */
  context?: {
    agentId?: string;
    roleId?: string;
    projectId?: string;
    taskId?: string;
    userInput?: string;
  };
}

/**
 * Parameters for the list_skills tool
 */
export interface ListSkillsToolParams {
  /** Filter by category */
  category?: string;
  /** Filter by assignable role */
  roleId?: string;
  /** Search in name/description */
  search?: string;
}

// ============================================
// Project Management Tool Types
// ============================================

/**
 * Parameters for the create_project_folder tool
 */
export interface CreateProjectFolderToolParams {
  /** Project name */
  name: string;
  /** Path where to create the project */
  path: string;
  /** Project template to use */
  template?: 'empty' | 'typescript' | 'react' | 'node' | 'python';
  /** Initialize git repository */
  initGit?: boolean;
}

/**
 * Parameters for the setup_project_structure tool
 */
export interface SetupProjectStructureToolParams {
  /** Path to the project */
  projectPath: string;
  /** Project structure configuration */
  structure: {
    /** Folders to create */
    folders?: string[];
    /** Files to create */
    files?: Array<{
      path: string;
      content: string;
    }>;
  };
}

/**
 * Parameters for the create_team_for_project tool
 */
export interface CreateTeamForProjectToolParams {
  /** Project to create team for */
  projectId: string;
  /** Name for the team */
  teamName: string;
  /** Role IDs to include in the team */
  roles: string[];
  /** Number of agents per role */
  agentCount?: Record<string, number>;
}

// ============================================
// Self-Improvement Tool Types
// ============================================

/**
 * File change specification for self-improvement
 */
export interface SelfImproveFileChange {
  /** File path relative to project root */
  path: string;
  /** Type of operation */
  operation: 'create' | 'modify' | 'delete';
  /** File content (for create/modify) */
  content?: string;
  /** Description of the change */
  description?: string;
}

/**
 * Parameters for self-improvement plan action
 */
export interface SelfImprovePlanParams {
  /** Action type */
  action: 'plan';
  /** Description of the improvement */
  description: string;
  /** Files to modify */
  files: SelfImproveFileChange[];
}

/**
 * Parameters for self-improvement execute action
 */
export interface SelfImproveExecuteParams {
  /** Action type */
  action: 'execute';
  /** Plan ID to execute */
  planId: string;
}

/**
 * Parameters for self-improvement status action
 */
export interface SelfImproveStatusParams {
  /** Action type */
  action: 'status';
}

/**
 * Parameters for self-improvement rollback action
 */
export interface SelfImproveRollbackParams {
  /** Action type */
  action: 'rollback';
  /** Reason for rollback */
  reason: string;
}

/**
 * Parameters for self-improvement cancel action
 */
export interface SelfImproveCancelParams {
  /** Action type */
  action: 'cancel';
}

/**
 * Combined self-improvement tool parameters
 */
export type SelfImproveToolParams =
  | SelfImprovePlanParams
  | SelfImproveExecuteParams
  | SelfImproveStatusParams
  | SelfImproveRollbackParams
  | SelfImproveCancelParams;

// ============================================
// Tool Result Types
// ============================================

/**
 * Standard tool result structure
 */
export interface ToolResultData {
  success: boolean;
  message?: string;
  error?: string;
  [key: string]: unknown;
}