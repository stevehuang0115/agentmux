export interface TeamMember {
    id: string;
    name: string;
    sessionName: string;
    role: 'orchestrator' | 'tpm' | 'pgm' | 'developer' | 'frontend-developer' | 'backend-developer' | 'qa' | 'tester' | 'designer';
    systemPrompt: string;
    status: 'idle' | 'working' | 'blocked' | 'terminated' | 'ready' | 'activating' | 'active';
    agentStatus: 'inactive' | 'activating' | 'active';
    workingStatus: 'idle' | 'in_progress';
    currentTickets?: string[];
    readyAt?: string;
    capabilities?: string[];
    lastActivityCheck?: string;
    createdAt: string;
    updatedAt: string;
}
export interface Team {
    id: string;
    name: string;
    description?: string;
    members: TeamMember[];
    currentProject?: string;
    status: 'idle' | 'working' | 'blocked' | 'terminated' | 'ready' | 'activating' | 'active';
    createdAt: string;
    updatedAt: string;
}
export interface Project {
    id: string;
    name: string;
    path: string;
    teams: Record<string, string[]>;
    status: 'active' | 'paused' | 'completed' | 'stopped';
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
    createdAt: string;
}
export interface ScheduledMessage {
    id: string;
    name: string;
    targetTeam: string;
    targetProject?: string;
    message: string;
    delayAmount: number;
    delayUnit: 'seconds' | 'minutes' | 'hours';
    isRecurring: boolean;
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
}
export interface MCPToolRequest {
    tool: string;
    parameters: Record<string, any>;
    sessionName: string;
}
export interface MCPToolResponse {
    success: boolean;
    data?: any;
    error?: string;
}
export interface TerminalOutput {
    sessionName: string;
    content: string;
    timestamp: string;
    type: 'stdout' | 'stderr';
}
export interface WebSocketMessage {
    type: 'terminal_output' | 'file_change' | 'team_status' | 'schedule_update' | 'connection_established' | 'subscription_confirmed' | 'unsubscription_confirmed' | 'session_not_found' | 'input_error' | 'initial_terminal_state' | 'terminal_state_error' | 'system_notification';
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
    mcpPort: number;
    agentmuxHome: string;
    defaultCheckInterval: number;
    autoCommitInterval: number;
}
//# sourceMappingURL=index.d.ts.map