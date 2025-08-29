/**
 * Additional MCP Foundation Types for AgentMux
 * Extends the existing type system with MCP-specific interfaces
 */

import { Project, Team, Assignment, ActivityEntry, TmuxSession } from '../types.js';

// MCP Transport Configuration
export interface McpTransportConfig {
  type: 'stdio' | 'http' | 'websocket';
  port?: number;
  host?: string;
  path?: string;
  secure?: boolean;
}

// MCP Server Configuration
export interface McpServerConfig {
  name: string;
  version: string;
  enabled: boolean;
  transport: McpTransportConfig;
  debug: boolean;
  authentication?: McpAuthConfig;
  rateLimit?: McpRateLimitConfig;
}

export interface McpAuthConfig {
  enabled: boolean;
  method: 'api-key' | 'jwt' | 'none';
  apiKey?: string;
  jwtSecret?: string;
}

export interface McpRateLimitConfig {
  enabled: boolean;
  maxRequests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
}

// Enhanced Tool Result Types
export interface McpToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
  metadata?: Record<string, any>;
}

// Resource Discovery Types
export interface McpResourceDescriptor {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  annotations?: Record<string, any>;
}

// Prompt Template Types
export interface McpPromptTemplate {
  name: string;
  description: string;
  argsSchema: any;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: {
      type: 'text';
      text: string;
    };
  }>;
}

// Activity Monitoring Types
export interface McpActivitySnapshot {
  timestamp: string;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    teamId?: string;
    lastActivity?: string;
  }>;
  teams: Array<{
    id: string;
    name: string;
    status: string;
    sessionName?: string;
    projectId?: string;
    lastActivity?: string;
  }>;
  sessions: Array<{
    name: string;
    windows: number;
    panes: number;
    active: boolean;
    lastActivity?: string;
  }>;
}

// Claude Integration Types
export interface ClaudeAgentContext {
  agentId: string;
  sessionId: string;
  capabilities: string[];
  preferences: Record<string, any>;
  workingProject?: string;
  assignedTeams: string[];
}

export interface ClaudeWorkflowState {
  phase: 'planning' | 'executing' | 'monitoring' | 'reviewing' | 'completed';
  currentTask?: string;
  objectives: string[];
  constraints: string[];
  progress: number; // 0-100
  blockers: string[];
  nextActions: string[];
}

// Team Communication Types
export interface TeamMessage {
  from: 'claude' | 'orchestrator' | 'dev' | 'qa' | 'pm';
  to: 'team' | 'role' | 'claude';
  type: 'instruction' | 'status' | 'question' | 'blocker' | 'completion';
  content: string;
  timestamp: string;
  urgent: boolean;
}

export interface TeamCommunicationLog {
  teamId: string;
  sessionName: string;
  messages: TeamMessage[];
  lastUpdated: string;
}

// Project Template Types
export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  type: 'web-app' | 'api' | 'cli' | 'library' | 'mobile' | 'other';
  requiredRoles: string[];
  optionalRoles: string[];
  estimatedDuration: string;
  complexity: 'simple' | 'moderate' | 'complex';
  prerequisites: string[];
  deliverables: string[];
}

export interface TeamTemplate {
  id: string;
  name: string;
  description: string;
  roles: Array<{
    name: string;
    required: boolean;
    responsibilities: string[];
    skills: string[];
  }>;
  workflowPattern: 'sequential' | 'parallel' | 'hybrid';
  communicationFrequency: string;
  escalationRules: string[];
}

// Workflow Automation Types
export interface WorkflowTrigger {
  id: string;
  name: string;
  description: string;
  condition: {
    type: 'activity' | 'time' | 'status' | 'manual';
    criteria: Record<string, any>;
  };
  action: {
    type: 'create-team' | 'assign' | 'pause' | 'resume' | 'notify';
    parameters: Record<string, any>;
  };
  enabled: boolean;
}

// Metrics and Analytics Types
export interface McpUsageMetrics {
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  averageResponseTime: number;
  mostUsedTools: Array<{
    name: string;
    count: number;
  }>;
  activeClients: number;
  uptime: string;
}

export interface AgentMuxAnalytics {
  projectMetrics: {
    total: number;
    active: number;
    completed: number;
    averageCompletion: string;
  };
  teamMetrics: {
    total: number;
    active: number;
    averageSize: number;
    mostCommonRoles: string[];
  };
  activityMetrics: {
    totalSessions: number;
    averageSessionDuration: string;
    peakActiveHours: string[];
    idleTimePercentage: number;
  };
}

// Error Handling Types
export interface McpErrorContext {
  toolName?: string;
  resourceUri?: string;
  promptName?: string;
  clientId?: string;
  timestamp: string;
  requestId?: string;
}

export interface McpError {
  code: string;
  message: string;
  context?: McpErrorContext;
  recoverable: boolean;
  suggestedAction?: string;
}

// Security Types
export interface McpSecurityEvent {
  type: 'authentication' | 'authorization' | 'rate-limit' | 'validation' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  clientId?: string;
  source: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export interface McpAccessControl {
  clientId: string;
  allowedTools: string[];
  allowedResources: string[];
  allowedPrompts: string[];
  rateLimits: Record<string, number>;
  expiresAt?: string;
}

// Integration Helper Types
export interface AgentMuxMcpIntegration {
  server: any; // MCP Server instance
  config: McpServerConfig;
  clients: Map<string, ClaudeAgentContext>;
  workflows: Map<string, ClaudeWorkflowState>;
  templates: {
    projects: Map<string, ProjectTemplate>;
    teams: Map<string, TeamTemplate>;
  };
  triggers: Map<string, WorkflowTrigger>;
  metrics: McpUsageMetrics;
}

// Runtime State Types
export interface McpServerState {
  started: boolean;
  startTime: string;
  transport: any;
  activeConnections: number;
  lastActivity: string;
  health: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
}

// Event System Types
export interface McpEvent {
  type: string;
  source: 'server' | 'client' | 'agentmux';
  timestamp: string;
  data: Record<string, any>;
  correlation?: string;
}

export interface McpEventHandler {
  eventType: string;
  handler: (event: McpEvent) => Promise<void>;
  priority: number;
  enabled: boolean;
}

// Capability Negotiation Types
export interface McpCapabilities {
  tools: boolean;
  resources: boolean;
  prompts: boolean;
  sampling: boolean;
  experimental?: string[];
}

export interface McpClientCapabilities extends McpCapabilities {
  agentType?: 'claude' | 'gpt' | 'other';
  version: string;
  supportedTransports: string[];
}

export interface McpServerCapabilities extends McpCapabilities {
  maxConcurrentClients: number;
  supportedTransports: string[];
  authentication: boolean;
  rateLimit: boolean;
}

// Export all types for use in other modules
export type {
  McpTransportConfig,
  McpServerConfig,
  McpAuthConfig,
  McpRateLimitConfig,
  McpToolResult,
  McpResourceDescriptor,
  McpPromptTemplate,
  McpActivitySnapshot,
  ClaudeAgentContext,
  ClaudeWorkflowState,
  TeamMessage,
  TeamCommunicationLog,
  ProjectTemplate,
  TeamTemplate,
  WorkflowTrigger,
  McpUsageMetrics,
  AgentMuxAnalytics,
  McpErrorContext,
  McpError,
  McpSecurityEvent,
  McpAccessControl,
  AgentMuxMcpIntegration,
  McpServerState,
  McpEvent,
  McpEventHandler,
  McpCapabilities,
  McpClientCapabilities,
  McpServerCapabilities
};