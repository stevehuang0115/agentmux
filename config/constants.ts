/**
 * AgentMux Cross-Domain Constants
 *
 * This file contains constants shared across all AgentMux domains:
 * - Backend (Express.js server)
 * - Frontend (React application)
 * - CLI (Command-line interface)
 * - MCP Server (Model Context Protocol server)
 *
 * Domain-specific constants should remain in their respective constants.ts files.
 */

// ========================= CORE SYSTEM CONSTANTS =========================

/**
 * AgentMux core system identifiers and names
 */
export const AGENTMUX_CONSTANTS = {
	/**
	 * Session and orchestrator configuration
	 */
	SESSIONS: {
		/** Default orchestrator session name used across all domains */
		ORCHESTRATOR_NAME: 'agentmux-orc',
		/** Default timeout for agent initialization (2 minutes) */
		DEFAULT_TIMEOUT: 120000,
		/** Interval for checking agent registration status (5 seconds) */
		REGISTRATION_CHECK_INTERVAL: 5000,
		/** Cache timeout for Claude detection (30 seconds) */
		CLAUDE_DETECTION_CACHE_TIMEOUT: 30000,
		/** Default shell for tmux sessions */
		DEFAULT_SHELL: '/bin/bash',
	},

	/**
	 * File system paths and directory structure
	 */
	PATHS: {
		/** AgentMux home directory name */
		AGENTMUX_HOME: '.agentmux',
		/** Teams configuration file */
		TEAMS_FILE: 'teams.json',
		/** Projects configuration file */
		PROJECTS_FILE: 'projects.json',
		/** Runtime state file */
		RUNTIME_FILE: 'runtime.json',
		/** Scheduled messages file */
		SCHEDULED_MESSAGES_FILE: 'scheduled-messages.json',
		/** Message delivery logs file */
		MESSAGE_DELIVERY_LOGS_FILE: 'message-delivery-logs.json',
		/** Configuration directory */
		CONFIG_DIR: 'config',
		/** System prompts directory */
		PROMPTS_DIR: 'prompts',
		/** Tasks directory */
		TASKS_DIR: 'tasks',
		/** Specifications directory */
		SPECS_DIR: 'specs',
		/** Agent memory directory */
		MEMORY_DIR: 'memory',
	},

	/**
	 * Agent status enumeration - represents agent lifecycle states
	 */
	AGENT_STATUSES: {
		/** Agent is not running or has been stopped */
		INACTIVE: 'inactive',
		/** Agent is in the process of starting up */
		ACTIVATING: 'activating',
		/** Agent is fully operational and ready */
		ACTIVE: 'active',
	},

	/**
	 * Working status enumeration - represents current agent activity
	 */
	WORKING_STATUSES: {
		/** Agent is idle and available for tasks */
		IDLE: 'idle',
		/** Agent is currently processing a task */
		IN_PROGRESS: 'in_progress',
	},

	/**
	 * Agent roles available in the system
	 */
	ROLES: {
		/** System orchestrator - coordinates all activities */
		ORCHESTRATOR: 'orchestrator',
		/** Project manager - handles project-level coordination */
		PROJECT_MANAGER: 'pm',
		/** Technical project manager - technical leadership */
		TECH_LEAD: 'tpm',
		/** Software developer - implements features */
		DEVELOPER: 'developer',
		/** Quality assurance engineer - testing and validation */
		QA: 'qa',
		/** DevOps engineer - deployment and infrastructure */
		DEVOPS: 'devops',
	},

	/**
	 * Human-readable role display names
	 */
	ROLE_DISPLAY_NAMES: {
		orchestrator: 'Orchestrator',
		pm: 'Project Manager',
		tpm: 'Technical Project Manager',
		developer: 'Developer',
		qa: 'Quality Assurance',
		devops: 'DevOps Engineer',
	},
} as const;

// ========================= MCP SERVER CONSTANTS =========================

/**
 * Model Context Protocol server configuration
 */
export const MCP_CONSTANTS = {
	/**
	 * Network ports and endpoints
	 */
	PORTS: {
		/** Default MCP server port */
		DEFAULT: 3001,
		/** Health check endpoint path */
		HEALTH_CHECK: '/health',
	},

	/**
	 * Timeout configurations for MCP operations
	 */
	TIMEOUTS: {
		/** Response timeout for MCP calls (30 seconds) */
		RESPONSE: 30000,
		/** Connection timeout (10 seconds) */
		CONNECTION: 10000,
	},

	/**
	 * MCP tool names and identifiers
	 */
	TOOLS: {
		/** Send message to another team member */
		SEND_MESSAGE: 'send_message',
		/** Broadcast message to all team members */
		BROADCAST: 'broadcast',
		/** Get current team status */
		GET_TEAM_STATUS: 'get_team_status',
		/** Get agent logs for monitoring */
		GET_AGENT_LOGS: 'get_agent_logs',
		/** Get agent status information */
		GET_AGENT_STATUS: 'get_agent_status',
		/** Register agent as active */
		REGISTER_AGENT_STATUS: 'register_agent_status',
		/** Accept a task */
		ACCEPT_TASK: 'accept_task',
		/** Complete a task */
		COMPLETE_TASK: 'complete_task',
	},
} as const;

// ========================= WEB SERVER CONSTANTS =========================

/**
 * Web server and API configuration
 */
export const WEB_CONSTANTS = {
	/**
	 * Default server ports
	 */
	PORTS: {
		/** Backend API server default port */
		BACKEND: 3000,
		/** Frontend development server default port */
		FRONTEND: 3002,
	},

	/**
	 * API endpoint paths
	 */
	ENDPOINTS: {
		/** Health check endpoint */
		HEALTH: '/health',
		/** Base API path */
		API_BASE: '/api',
		/** Teams management endpoints */
		TEAMS: '/api/teams',
		/** Projects management endpoints */
		PROJECTS: '/api/projects',
		/** Orchestrator control endpoints */
		ORCHESTRATOR: '/api/orchestrator',
		/** Terminal operations endpoints */
		TERMINAL: '/api/terminal',
		/** Task management endpoints */
		TASKS: '/api/tasks',
	},
} as const;

// ========================= TIMING CONSTANTS =========================

/**
 * Timing and interval configurations used across domains
 */
export const TIMING_CONSTANTS = {
	/**
	 * Retry and timeout configurations
	 */
	RETRIES: {
		/** Maximum retry attempts for failed operations */
		MAX_ATTEMPTS: 3,
		/** Base delay between retries (1 second) */
		BASE_DELAY: 1000,
		/** Maximum delay between retries (10 seconds) */
		MAX_DELAY: 10000,
	},

	/**
	 * Polling and monitoring intervals
	 */
	INTERVALS: {
		/** Health check interval (30 seconds) */
		HEALTH_CHECK: 30000,
		/** Memory cleanup interval (5 minutes) */
		MEMORY_CLEANUP: 5 * 60 * 1000,
		/** Status update interval (10 seconds) */
		STATUS_UPDATE: 10000,
		/** Activity monitoring interval (15 seconds) */
		ACTIVITY_MONITOR: 15000,
	},

	/**
	 * Timeout values for various operations
	 */
	TIMEOUTS: {
		/** Claude initialization timeout (45 seconds) */
		CLAUDE_INIT: 45000,
		/** Agent setup timeout (90 seconds) */
		AGENT_SETUP: 90000,
		/** Task completion timeout (5 minutes) */
		TASK_COMPLETION: 5 * 60 * 1000,
		/** WebSocket connection timeout (30 seconds) */
		WEBSOCKET: 30000,
	},
} as const;

// ========================= MESSAGE CONSTANTS =========================

/**
 * Message handling and communication constants
 */
export const MESSAGE_CONSTANTS = {
	/**
	 * Message size and chunking limits
	 */
	LIMITS: {
		/** Maximum message size before chunking (1500 characters) */
		CHUNK_SIZE: 1500,
		/** Small chunk size to avoid paste detection (200 characters) */
		SMALL_CHUNK_SIZE: 200,
		/** Maximum output buffer size for streaming */
		MAX_BUFFER_SIZE: 100,
	},

	/**
	 * Message types and categories
	 */
	TYPES: {
		/** System-generated status messages */
		SYSTEM: 'system',
		/** User-initiated messages */
		USER: 'user',
		/** Agent-to-agent communications */
		AGENT: 'agent',
		/** Error and warning messages */
		ERROR: 'error',
		/** Broadcast messages to all agents */
		BROADCAST: 'broadcast',
	},
} as const;

// ========================= ENVIRONMENT CONSTANTS =========================

/**
 * Environment variable names used across domains
 */
export const ENV_CONSTANTS = {
	/** Tmux session name */
	TMUX_SESSION_NAME: 'TMUX_SESSION_NAME',
	/** AgentMux role identifier */
	AGENTMUX_ROLE: 'AGENTMUX_ROLE',
	/** API server port */
	API_PORT: 'API_PORT',
	/** MCP server port */
	MCP_PORT: 'AGENTMUX_MCP_PORT',
	/** Project path */
	PROJECT_PATH: 'PROJECT_PATH',
	/** Agent role */
	AGENT_ROLE: 'AGENT_ROLE',
	/** Node environment */
	NODE_ENV: 'NODE_ENV',
	/** Development mode flag */
	DEV_MODE: 'DEV_MODE',
} as const;

// ========================= TYPE HELPERS =========================

/**
 * Type helpers for extracting literal types from constants
 */
export type AgentStatus =
	(typeof AGENTMUX_CONSTANTS.AGENT_STATUSES)[keyof typeof AGENTMUX_CONSTANTS.AGENT_STATUSES];
export type WorkingStatus =
	(typeof AGENTMUX_CONSTANTS.WORKING_STATUSES)[keyof typeof AGENTMUX_CONSTANTS.WORKING_STATUSES];
export type AgentRole = (typeof AGENTMUX_CONSTANTS.ROLES)[keyof typeof AGENTMUX_CONSTANTS.ROLES];
export type MCPTool = (typeof MCP_CONSTANTS.TOOLS)[keyof typeof MCP_CONSTANTS.TOOLS];
export type MessageType = (typeof MESSAGE_CONSTANTS.TYPES)[keyof typeof MESSAGE_CONSTANTS.TYPES];
