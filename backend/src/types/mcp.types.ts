/**
 * MCP (Model Context Protocol) Type Definitions
 *
 * These types define the JSON-RPC protocol and tool interfaces for the
 * AgentMux MCP server implementation.
 *
 * @module types/mcp
 */

// ============================================
// JSON-RPC Protocol Types
// ============================================

/**
 * JSON-RPC request format for MCP communication
 */
export interface MCPRequest {
	jsonrpc: string;
	id?: string | number;
	method: string;
	params?: Record<string, unknown>;
}

/**
 * JSON-RPC response format for MCP communication
 */
export interface MCPResponse {
	jsonrpc: string;
	id?: string | number;
	result?: unknown;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}

/**
 * Result format for MCP tool execution
 */
export interface MCPToolResult {
	content: Array<{
		type: 'text';
		text: string;
	}>;
	isError?: boolean;
}

// ============================================
// Tool Parameter Types
// ============================================

export interface SendMessageParams {
	to: string;
	message: string;
	type?: string;
	teamMemberId?: string;
}

export interface BroadcastParams {
	message: string;
	excludeSelf?: boolean;
	teamMemberId?: string;
}

export interface GetTicketsParams {
	status?: string;
	all?: boolean;
	teamMemberId?: string;
}

export interface UpdateTicketParams {
	ticketId: string;
	status?: string;
	notes?: string;
	blockers?: string[];
	teamMemberId?: string;
}

export interface ReportProgressParams {
	ticketId?: string;
	progress: number;
	completed?: string[];
	current?: string;
	blockers?: string[];
	nextSteps?: string;
	teamMemberId?: string;
}

export interface RequestReviewParams {
	ticketId: string;
	reviewer?: string;
	branch?: string;
	message?: string;
	teamMemberId?: string;
}

export interface ScheduleCheckParams {
	minutes: number;
	message: string;
	target?: string;
	teamMemberId?: string;
}

export interface EnforceCommitParams {
	message?: string;
	teamMemberId?: string;
}

export interface CreateTeamParams {
	role: string;
	name: string;
	projectPath?: string;
	systemPrompt?: string;
	teamMemberId?: string;
}

export interface DelegateTaskParams {
	to: string;
	task: string;
	priority: string;
	ticketId?: string;
	teamMemberId?: string;
}

export interface AssignTaskDelegationParams {
	absoluteTaskPath: string;
	targetSessionName: string;
	delegatedBy?: string;
	reason?: string;
	delegationChain?: string[];
	teamMemberId?: string;
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
	teamMemberId?: string;
}

export interface CompleteTaskParams {
	absoluteTaskPath: string;
	sessionName: string;
	teamMemberId?: string;
}

export interface ReadTaskParams {
	absoluteTaskPath: string;
	teamMemberId?: string;
}

export interface BlockTaskParams {
	absoluteTaskPath: string;
	reason: string;
	questions?: string[];
	urgency?: 'low' | 'medium' | 'high';
	teamMemberId?: string;
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
	teamMemberId?: string;
}

export interface GetAgentStatusParams {
	agentName?: string;
	sessionName?: string;
	teamMemberId?: string;
}

export interface ShutdownAgentParams {
	sessionName: string;
}

export interface TerminateAgentParams {
	sessionName: string;
	force?: boolean;
	reason?: string;
	teamMemberId?: string;
}

export interface TerminateAgentsParams {
	sessionNames: string[];
	force?: boolean;
	reason?: string;
	teamMemberId?: string;
}

// ============================================
// Tool Schema Types
// ============================================

/**
 * Schema definition for an MCP tool
 */
export interface ToolSchema {
	name: string;
	description: string;
	inputSchema: {
		type: 'object';
		properties: Record<string, unknown>;
		required: string[];
	};
}

// ============================================
// Data Types
// ============================================

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

export interface AgentStatusInfo {
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
	attached?: boolean;
}

// ============================================
// Team and Member Types
// ============================================

export interface MCPTeamMember {
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

export interface MCPTeam {
	id: string;
	name: string;
	description?: string;
	members: MCPTeamMember[];
	currentProject?: string;
	createdAt: string;
	updatedAt: string;
}

export interface TeamResponse {
	success: boolean;
	data?: MCPTeam;
	error?: string;
}

export interface TeamsListResponse {
	success: boolean;
	data?: MCPTeam[];
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
