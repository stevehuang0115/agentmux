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
		/** Default shell for terminal sessions, /bin/bash, /bin/zsh */
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
	 * Lifecycle: inactive -> starting -> started -> active
	 */
	AGENT_STATUSES: {
		/** Agent is not running or has been stopped */
		INACTIVE: 'inactive',
		/** Terminal/PTY session is being created */
		STARTING: 'starting',
		/** Runtime (Claude Code, etc.) is running but agent hasn't registered yet */
		STARTED: 'started',
		/** Agent has registered and is fully operational */
		ACTIVE: 'active',
		/** @deprecated Use STARTING instead - kept for backward compatibility */
		ACTIVATING: 'activating',
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
	 * Special agent identifiers for system-level agents
	 */
	AGENT_IDS: {
		/** Orchestrator agent identifier - used in teamAgentStatus.json */
		ORCHESTRATOR_ID: 'orchestrator',
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

	/**
	 * Orchestrator-specific configuration
	 */
	ORCHESTRATOR: {
		/** Display name for the orchestrator role */
		DISPLAY_NAME: 'Orchestrator',
		/** Default orchestrator window name */
		WINDOW_NAME: 'AgentMux Orchestrator',
		/** AgentMux session name prefix pattern */
		SESSION_PREFIX: 'agentmux_',
	},
} as const;

// ========================= AGENT IDENTITY CONSTANTS =========================

/**
 * Convenient agent identity references combining multiple constants
 */
export const AGENT_IDENTITY_CONSTANTS = {
	/**
	 * Orchestrator agent identity - combines ID, session name, and role
	 */
	ORCHESTRATOR: {
		/** Agent identifier used in teamAgentStatus.json */
		ID: AGENTMUX_CONSTANTS.AGENT_IDS.ORCHESTRATOR_ID, // 'orchestrator'
		/** PTY session name */
		SESSION_NAME: AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME, // 'agentmux-orc'
		/** Agent role */
		ROLE: AGENTMUX_CONSTANTS.ROLES.ORCHESTRATOR // 'orchestrator'
	}
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
		BACKEND: 8787,
		/** Frontend development server default port */
		FRONTEND: 8788,
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
		/** Factory SSE endpoint */
		FACTORY_SSE: '/api/factory/sse',
	},

	/**
	 * SSE (Server-Sent Events) configuration
	 */
	SSE: {
		/** Backend polling interval in milliseconds (3 seconds) */
		POLL_INTERVAL: 3000,
		/** Heartbeat interval in milliseconds (30 seconds) */
		HEARTBEAT_INTERVAL: 30000,
		/** Maximum reconnection attempts before fallback to polling */
		MAX_RECONNECT_ATTEMPTS: 5,
		/** Base delay between reconnection attempts (1 second) */
		BASE_RECONNECT_DELAY: 1000,
		/** Maximum reconnection delay (30 seconds) */
		MAX_RECONNECT_DELAY: 30000,
		/** Fallback polling interval when SSE fails (5 seconds) */
		FALLBACK_POLL_INTERVAL: 5000,
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
		/** General cleanup interval (1 minute) */
		CLEANUP: 60000,
		/** Batch operation delay (500ms) */
		BATCH_DELAY: 500,
		/** Rate limit window for short bursts (1 second) */
		RATE_LIMIT_WINDOW: 1000,
		/** Task cleanup interval (5 minutes) */
		TASK_CLEANUP: 300000,
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
		/** Orchestrator setup timeout (30 seconds) */
		ORCHESTRATOR_SETUP: 30000,
		/** Task monitoring and polling intervals (2 seconds) */
		TASK_MONITOR_POLL: 2000,
		/** Health check timeout for individual checks (1 second) */
		HEALTH_CHECK_TIMEOUT: 1000,
		/** HTTP health check timeout for CLI commands (3 seconds) */
		HTTP_HEALTH_CHECK: 3000,
		/** API request timeout for quick calls (2 seconds) */
		API_REQUEST_QUICK: 2000,
		/** Shutdown wait timeout (2 seconds) */
		SHUTDOWN: 2000,
		/** Connection timeout for network requests (10 seconds) */
		CONNECTION: 10000,
		/** Agent default timeout for operations (5 minutes) */
		AGENT_DEFAULT: 300000,
		/** Context refresh interval (30 minutes) */
		CONTEXT_REFRESH: 1800000,
		/** WebSocket ping timeout (60 seconds) */
		WS_PING: 60000,
		/** WebSocket ping interval (25 seconds) */
		WS_PING_INTERVAL: 25000,
		/** Backup interval (1 hour) */
		BACKUP: 3600000,
		/** Rate limit window (15 minutes) */
		RATE_LIMIT_WINDOW: 900000,
		/** Command timestamp offset (5 minutes) */
		COMMAND_TIMESTAMP_OFFSET: 300000,
		/** Command timestamp offset long (10 minutes) */
		COMMAND_TIMESTAMP_OFFSET_LONG: 600000,
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
	/** Session name (legacy: kept for compatibility with older agents) */
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

// ========================= BACKEND-SPECIFIC CONSTANTS =========================

/**
 * Backend-specific configuration constants
 * These constants are primarily used by the Express.js backend server
 */
export const BACKEND_CONSTANTS = {
	/**
	 * File names and configurations
	 */
	FILES: {
		/** Active projects tracking file name */
		ACTIVE_PROJECTS_FILE: 'active_projects.json',
		/** Task tracking file name */
		TASK_TRACKING_FILE: 'in_progress_tasks.json',
		/** Communication log file name */
		COMMUNICATION_LOG_FILE: 'communication.log',
		/** Configuration file names */
		CONFIG_FILE_NAMES: {
			CONFIG_JSON: 'config.json',
			APP_JSON: 'app.json',
		},
		/** Log file naming patterns */
		LOG_FILE_PREFIX: 'agentmux-',
		LOG_FILE_EXTENSION: '.log',
	},

	/**
	 * Additional directory names not covered in AGENTMUX_CONSTANTS.PATHS
	 */
	ADDITIONAL_DIRS: {
		LOGS: 'logs',
		DATA: 'data',
	},

	/**
	 * HTTP and network configuration
	 */
	NETWORK: {
		/** Default CORS origin */
		DEFAULT_CORS_ORIGIN: 'http://localhost:8788',
		/** Allowed HTTP methods */
		ALLOWED_HTTP_METHODS: ['GET', 'POST'],
		/** HTTP status codes used in the application */
		HTTP_STATUS_CODES: {
			OK: 200,
			CREATED: 201,
			BAD_REQUEST: 400,
			NOT_FOUND: 404,
			INTERNAL_SERVER_ERROR: 500,
			SERVICE_UNAVAILABLE: 503,
		},
		/** Maximum request body size (10MB) */
		MAX_REQUEST_BODY_SIZE: '10mb',
	},

	/**
	 * API endpoint paths
	 */
	API_ENDPOINTS: {
		ORCHESTRATOR_SETUP: '/api/orchestrator/setup',
		TEAMS: '/api/teams',
		TEAM_START: '/api/teams/:id/start',
		HEALTH: '/health',
		API_BASE: '/api',
		PROJECTS: '/projects',
		MONITORING: '/monitoring',
		SYSTEM: '/system',
	},

	/**
	 * Orchestrator command identifiers
	 */
	ORCHESTRATOR_COMMANDS: {
		GET_TEAM_STATUS: 'get_team_status',
		LIST_PROJECTS: 'list_projects',
		LIST_SESSIONS: 'list_sessions',
		BROADCAST: 'broadcast',
		HELP: 'help',
	},

	/**
	 * Session command templates (legacy - PTY backend now used)
	 */
	SESSION_COMMANDS: {
		/** @deprecated PTY backend now manages sessions internally */
		LIST_SESSIONS: '',
	},

	/**
	 * Special key names
	 */
	SPECIAL_KEYS: {
		ENTER: 'Enter',
		CTRL_C: 'C-c',
	},

	/**
	 * Initialization script file names
	 */
	INIT_SCRIPTS: {
		CLAUDE: 'initialize_claude.sh',
	},

	/**
	 * Size and limit constants
	 */
	LIMITS: {
		/** Maximum file size for context loading (1MB) */
		MAX_CONTEXT_FILE_SIZE_BYTES: 1048576,
		/** Default log entry limit */
		DEFAULT_LOG_LIMIT: 100,
		/** Maximum concurrent monitoring jobs */
		MAX_CONCURRENT_MONITORING_JOBS: 10,
		/** Default log file size limit */
		DEFAULT_LOG_FILE_SIZE: '10m',
	},

	/**
	 * Frontend build directory path (relative to backend)
	 */
	FRONTEND_DIST_PATH: '../../frontend/dist',

	/**
	 * Additional environment variable names
	 */
	ADDITIONAL_ENV_VARS: {
		WEB_PORT: 'WEB_PORT',
		DEFAULT_CHECK_INTERVAL: 'DEFAULT_CHECK_INTERVAL',
		AUTO_COMMIT_INTERVAL: 'AUTO_COMMIT_INTERVAL',
		AGENTMUX_HOME: 'AGENTMUX_HOME',
	},

	/**
	 * Orchestrator help text
	 */
	ORCHESTRATOR_HELP_TEXT: `
Available commands:
- get_team_status: Get current status of all team members
- list_projects: List all available projects
- list_sessions: List all active sessions
- broadcast [message]: Send message to all active agents
- help: Show this help message
`.trim(),
} as const;

// ========================= MEMORY SYSTEM CONSTANTS =========================

/**
 * Memory system configuration for the two-level memory architecture
 * Agent-level: ~/.agentmux/agents/{agentId}/
 * Project-level: project/.agentmux/knowledge/
 */
export const MEMORY_CONSTANTS = {
  /**
   * Storage paths for memory files
   */
  PATHS: {
    /** Agent memory directory (relative to AGENTMUX_HOME) */
    AGENTS_DIR: 'agents',
    /** Project knowledge directory (relative to project .agentmux) */
    KNOWLEDGE_DIR: 'knowledge',
    /** Agent session archives directory name (under agent dir) */
    SESSIONS_DIR: 'sessions',
    /** Latest session summary file name */
    LATEST_SUMMARY: 'latest-summary.md',
    /** Daily log directory (under project .agentmux) */
    DAILY_LOG_DIR: 'logs/daily',
    /** Goals directory (under project .agentmux) */
    GOALS_DIR: 'goals',
    /** Goals file */
    GOALS_FILE: 'goals.md',
    /** Current focus file */
    FOCUS_FILE: 'current_focus.md',
    /** Decisions log file (with retrospective outcomes) */
    DECISIONS_LOG: 'decisions_log.md',
    /** Learning accumulation directory (under project .agentmux) */
    LEARNING_DIR: 'learning',
    /** What worked file */
    WHAT_WORKED_FILE: 'what_worked.md',
    /** What failed file */
    WHAT_FAILED_FILE: 'what_failed.md',
    /** Global learning directory (under AGENTMUX_HOME) */
    GLOBAL_LEARNING_DIR: 'learning',
    /** Cross-project insights file */
    CROSS_PROJECT_INSIGHTS: 'cross_project_insights.md',
    /** Agents index file (under project .agentmux) */
    AGENTS_INDEX: 'agents-index.json',
  },

  /**
   * File names for agent-level memory
   */
  AGENT_FILES: {
    /** Main memory file */
    MEMORY: 'memory.json',
    /** Detailed role knowledge entries */
    ROLE_KNOWLEDGE: 'role-knowledge.json',
    /** Agent preferences */
    PREFERENCES: 'preferences.json',
    /** Performance metrics */
    PERFORMANCE: 'performance.json',
    /** Custom SOPs directory */
    SOP_CUSTOM_DIR: 'sop-custom',
  },

  /**
   * File names for project-level memory
   */
  PROJECT_FILES: {
    /** Main index file */
    INDEX: 'index.json',
    /** Pattern entries */
    PATTERNS: 'patterns.json',
    /** Decision entries */
    DECISIONS: 'decisions.json',
    /** Gotcha entries */
    GOTCHAS: 'gotchas.json',
    /** Relationship entries */
    RELATIONSHIPS: 'relationships.json',
    /** Human-readable learnings log */
    LEARNINGS: 'learnings.md',
  },

  /**
   * Storage limits to keep memory files performant
   */
  LIMITS: {
    /** Maximum entries per category in agent memory */
    MAX_ROLE_KNOWLEDGE_ENTRIES: 500,
    /** Maximum entries per category in project memory */
    MAX_PATTERN_ENTRIES: 200,
    MAX_DECISION_ENTRIES: 100,
    MAX_GOTCHA_ENTRIES: 200,
    MAX_RELATIONSHIP_ENTRIES: 500,
    /** Maximum file size in bytes (1MB) */
    MAX_FILE_SIZE_BYTES: 1048576,
    /** Maximum entries returned in a single query */
    MAX_QUERY_RESULTS: 50,
    /** Minimum confidence to retain during pruning (0-1) */
    MIN_CONFIDENCE_THRESHOLD: 0.2,
    /** Days before low-confidence entries are pruned */
    PRUNE_AFTER_DAYS: 90,
  },

  /**
   * Default values for memory entries
   */
  DEFAULTS: {
    /** Default confidence for new knowledge entries */
    INITIAL_CONFIDENCE: 0.5,
    /** Confidence increase when knowledge is reinforced */
    CONFIDENCE_REINFORCEMENT: 0.1,
    /** Maximum confidence value */
    MAX_CONFIDENCE: 1.0,
    /** Minimum confidence value */
    MIN_CONFIDENCE: 0.0,
  },

  /**
   * Schema versioning for migrations
   */
  SCHEMA: {
    /** Current schema version */
    CURRENT_VERSION: 1,
    /** Minimum supported schema version */
    MIN_SUPPORTED_VERSION: 1,
  },

  /**
   * Memory categories
   */
  CATEGORIES: {
    /** Role knowledge categories */
    ROLE_KNOWLEDGE: ['best-practice', 'anti-pattern', 'tool-usage', 'workflow'] as const,
    /** Pattern categories */
    PATTERN: ['api', 'component', 'service', 'testing', 'styling', 'database', 'config', 'other'] as const,
    /** Gotcha severity levels */
    GOTCHA_SEVERITY: ['low', 'medium', 'high', 'critical'] as const,
    /** Learning categories */
    LEARNING: ['pattern', 'decision', 'gotcha', 'insight', 'improvement'] as const,
    /** Relationship types */
    RELATIONSHIP: ['depends-on', 'uses', 'extends', 'implements', 'calls', 'imported-by'] as const,
  },
} as const;

// ========================= CONTINUATION SYSTEM =========================

/**
 * Continuation system configuration for automatic agent continuation
 */
export const CONTINUATION_CONSTANTS = {
  /**
   * Detection thresholds
   */
  DETECTION: {
    /** Number of idle poll cycles before triggering continuation check */
    IDLE_CYCLES_BEFORE_CHECK: 2,
    /** Minutes without MCP calls before heartbeat is considered stale */
    STALE_THRESHOLD_MINUTES: 30,
    /** Milliseconds between activity poll checks */
    ACTIVITY_POLL_INTERVAL_MS: 120000, // 2 minutes
  },

  /**
   * Event handling configuration
   */
  EVENTS: {
    /** Debounce time for events (ms) */
    DEBOUNCE_MS: 5000,
    /** Deduplication window (ms) */
    DEDUP_WINDOW_MS: 10000,
    /** Cleanup interval for recent events (ms) */
    CLEANUP_INTERVAL_MS: 60000,
  },

  /**
   * Iteration limits
   */
  ITERATIONS: {
    /** Default maximum iterations per task */
    DEFAULT_MAX: 10,
    /** Absolute maximum iterations (hard limit) */
    ABSOLUTE_MAX: 50,
    /** Warning threshold (percentage of max) */
    WARNING_THRESHOLD: 0.8,
  },

  /**
   * Timeouts
   */
  TIMEOUTS: {
    /** Timeout for output analysis (ms) */
    ANALYSIS_MS: 10000,
    /** Timeout for action execution (ms) */
    ACTION_MS: 30000,
    /** Timeout for prompt injection (ms) */
    PROMPT_INJECTION_MS: 15000,
  },

  /**
   * Output analysis patterns
   */
  PATTERNS: {
    /** Patterns indicating task completion */
    COMPLETION: [
      'task completed',
      'task done',
      'successfully completed',
      'implementation complete',
      'all tests pass',
      'ready for review',
    ],
    /** Patterns indicating agent is waiting */
    WAITING: [
      'waiting for',
      'awaiting',
      'blocked by',
      'need input',
      'please provide',
      'let me know',
    ],
    /** Patterns indicating errors */
    ERROR: [
      'error:',
      'failed:',
      'exception:',
      'cannot',
      'unable to',
      'permission denied',
    ],
  },

  /**
   * Confidence thresholds for analysis
   */
  CONFIDENCE: {
    /** Minimum confidence to take action */
    ACTION_THRESHOLD: 0.6,
    /** High confidence threshold */
    HIGH: 0.8,
    /** Medium confidence threshold */
    MEDIUM: 0.5,
    /** Low confidence threshold */
    LOW: 0.3,
  },
} as const;

/** Shorthand for debounce value */
export const EVENT_DEBOUNCE_MS = CONTINUATION_CONSTANTS.EVENTS.DEBOUNCE_MS;

// ========================= TYPE HELPERS =========================

/**
 * Type helpers for extracting literal types from constants
 */
export type AgentStatus =
	(typeof AGENTMUX_CONSTANTS.AGENT_STATUSES)[keyof typeof AGENTMUX_CONSTANTS.AGENT_STATUSES];
export type WorkingStatus =
	(typeof AGENTMUX_CONSTANTS.WORKING_STATUSES)[keyof typeof AGENTMUX_CONSTANTS.WORKING_STATUSES];
export type AgentRole = (typeof AGENTMUX_CONSTANTS.ROLES)[keyof typeof AGENTMUX_CONSTANTS.ROLES];
export type MessageType = (typeof MESSAGE_CONSTANTS.TYPES)[keyof typeof MESSAGE_CONSTANTS.TYPES];
export type OrchestratorCommand =
	(typeof BACKEND_CONSTANTS.ORCHESTRATOR_COMMANDS)[keyof typeof BACKEND_CONSTANTS.ORCHESTRATOR_COMMANDS];
export type HTTPStatusCode =
	(typeof BACKEND_CONSTANTS.NETWORK.HTTP_STATUS_CODES)[keyof typeof BACKEND_CONSTANTS.NETWORK.HTTP_STATUS_CODES];
export type AgentId = (typeof AGENTMUX_CONSTANTS.AGENT_IDS)[keyof typeof AGENTMUX_CONSTANTS.AGENT_IDS];
