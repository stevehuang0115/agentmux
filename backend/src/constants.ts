/**
 * Backend-specific constants
 * Re-exported from the main config constants for backend use
 */

// Import from config directory for cross-domain constants
import {
  AGENTMUX_CONSTANTS as CONFIG_AGENTMUX_CONSTANTS,
  AGENT_IDENTITY_CONSTANTS as CONFIG_AGENT_IDENTITY_CONSTANTS,
  TIMING_CONSTANTS as CONFIG_TIMING_CONSTANTS,
  MEMORY_CONSTANTS as CONFIG_MEMORY_CONSTANTS,
  CONTINUATION_CONSTANTS as CONFIG_CONTINUATION_CONSTANTS
} from '../../config/constants.js';

// Re-export the cross-domain constants for backend use
export const AGENT_IDENTITY_CONSTANTS = CONFIG_AGENT_IDENTITY_CONSTANTS;
export const TIMING_CONSTANTS = CONFIG_TIMING_CONSTANTS;
export const MEMORY_CONSTANTS = CONFIG_MEMORY_CONSTANTS;
export const CONTINUATION_CONSTANTS = CONFIG_CONTINUATION_CONSTANTS;

// Re-export specific constants that the backend needs from the main config
export const ORCHESTRATOR_SESSION_NAME = 'agentmux-orc';
export const ORCHESTRATOR_ROLE = 'orchestrator';
export const ORCHESTRATOR_WINDOW_NAME = 'AgentMux Orchestrator';
export const AGENT_INITIALIZATION_TIMEOUT = 90000;
export const CLAUDE_INITIALIZATION_TIMEOUT = 45000;

// Merge cross-domain constants with backend-specific extensions
export const AGENTMUX_CONSTANTS = {
	...CONFIG_AGENTMUX_CONSTANTS,
	// Backend-specific extensions
	INIT_SCRIPTS: {
		TMUX: 'initialize_tmux.sh',
		CLAUDE: 'initialize_claude.sh',
		TMUX_ROBOSEND: 'tmux_robosend.sh',
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

// PTY session constants
export const PTY_CONSTANTS = {
	MAX_DATA_LISTENERS: 100,
	MAX_EXIT_LISTENERS: 50,
	DEFAULT_MAX_HISTORY_SIZE: 10 * 1024 * 1024, // 10MB
	DEFAULT_SCROLLBACK: 5000,
	DEFAULT_COLS: 80,
	DEFAULT_ROWS: 24,
	MAX_RESIZE_COLS: 1000,
	MAX_RESIZE_ROWS: 1000,
} as const;

// Session command timing delays (in milliseconds)
export const SESSION_COMMAND_DELAYS = {
	MESSAGE_DELAY: 100,
	KEY_DELAY: 50,
	CLEAR_COMMAND_DELAY: 100,
	ENV_VAR_DELAY: 100,
} as const;

// Terminal controller constants
export const TERMINAL_CONTROLLER_CONSTANTS = {
	DEFAULT_CAPTURE_LINES: 50,
	MAX_CAPTURE_LINES: 500,
	MAX_OUTPUT_SIZE: 16384, // 16KB max output per request
} as const;

// Type helpers
export type AgentStatus =
	(typeof AGENTMUX_CONSTANTS.AGENT_STATUSES)[keyof typeof AGENTMUX_CONSTANTS.AGENT_STATUSES];
export type WorkingStatus =
	(typeof AGENTMUX_CONSTANTS.WORKING_STATUSES)[keyof typeof AGENTMUX_CONSTANTS.WORKING_STATUSES];
export type RuntimeType = (typeof RUNTIME_TYPES)[keyof typeof RUNTIME_TYPES];
export type AgentId = string; // Agent identifier type for heartbeat service
