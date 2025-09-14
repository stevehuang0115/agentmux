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

export interface LoadProjectContextParams {
  includeFiles?: boolean;
  includeGitHistory?: boolean;
  includeTickets?: boolean;
}

export interface AssignTaskParams {
  taskPath: string;
  memberId: string;
  sessionId: string;
}

export interface AcceptTaskParams {
  taskPath: string;
  sessionName: string;
}

export interface CompleteTaskParams {
  taskPath: string;
  sessionName: string;
}

export interface ReadTaskParams {
  taskPath: string;
}

export interface BlockTaskParams {
  taskPath: string;
  reason: string;
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
  sessionId: string;
  memberId?: string;
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
  session: string;
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