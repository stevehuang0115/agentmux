/**
 * Backend-specific constants
 * Re-exported from the main config constants for backend use
 */

// Re-export the constants that the backend needs from the main config
export const ORCHESTRATOR_SESSION_NAME = 'agentmux-orc';
export const ORCHESTRATOR_ROLE = 'orchestrator';
export const ORCHESTRATOR_WINDOW_NAME = 'AgentMux Orchestrator';
export const AGENT_INITIALIZATION_TIMEOUT = 90000;
export const CLAUDE_INITIALIZATION_TIMEOUT = 45000;

// Agent and Working Status Constants (duplicated from config/constants.ts for backend use)
export const AGENTMUX_CONSTANTS = {
	SESSIONS: {
		ORCHESTRATOR_NAME: 'agentmux-orc',
		DEFAULT_TIMEOUT: 120000,
		REGISTRATION_CHECK_INTERVAL: 5000,
		CLAUDE_DETECTION_CACHE_TIMEOUT: 30000,
		DEFAULT_SHELL: '/bin/bash',
	},
	AGENT_STATUSES: {
		INACTIVE: 'inactive' as const,
		ACTIVATING: 'activating' as const,
		ACTIVE: 'active' as const,
	},
	WORKING_STATUSES: {
		IDLE: 'idle' as const,
		IN_PROGRESS: 'in_progress' as const,
	},
} as const;

// Environment variable names (duplicated from config/constants.ts for backend use)
export const ENV_CONSTANTS = {
	TMUX_SESSION_NAME: 'TMUX_SESSION_NAME',
	AGENTMUX_ROLE: 'AGENTMUX_ROLE',
} as const;

// Agent-specific timeout values (in milliseconds)
export const AGENT_TIMEOUTS = {
	ORCHESTRATOR_INITIALIZATION: 120000, // 2 minutes for orchestrator
	REGULAR_AGENT_INITIALIZATION: 75000, // 75 seconds for regular agents
} as const;

// Agent runtime types
export const RUNTIME_TYPES = {
	CLAUDE_CODE: 'claude-code',
	GEMINI_CLI: 'gemini-cli',
	CODEX_CLI: 'codex-cli',
} as const;

// Type helpers
export type AgentStatus =
	(typeof AGENTMUX_CONSTANTS.AGENT_STATUSES)[keyof typeof AGENTMUX_CONSTANTS.AGENT_STATUSES];
export type WorkingStatus =
	(typeof AGENTMUX_CONSTANTS.WORKING_STATUSES)[keyof typeof AGENTMUX_CONSTANTS.WORKING_STATUSES];
export type RuntimeType = (typeof RUNTIME_TYPES)[keyof typeof RUNTIME_TYPES];
