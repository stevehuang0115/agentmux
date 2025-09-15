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
        /** Default shell for tmux sessions, /bin/bash, /bin/zsh */
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
    /**
     * Orchestrator-specific configuration
     */
    ORCHESTRATOR: {
        /** Display name for the orchestrator role */
        DISPLAY_NAME: 'Orchestrator',
        /** Default orchestrator window name in tmux */
        WINDOW_NAME: 'AgentMux Orchestrator',
        /** AgentMux session name prefix pattern */
        SESSION_PREFIX: 'agentmux_',
    },
};
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
};
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
};
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
        /** Orchestrator setup timeout (30 seconds) */
        ORCHESTRATOR_SETUP: 30000,
        /** Task monitoring and polling intervals (2 seconds) */
        TASK_MONITOR_POLL: 2000,
        /** Health check timeout for individual checks (1 second) */
        HEALTH_CHECK_TIMEOUT: 1000,
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
};
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
};
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
};
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
        DEFAULT_CORS_ORIGIN: 'http://localhost:3000',
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
     * Tmux command templates
     */
    TMUX_COMMANDS: {
        LIST_SESSIONS: 'tmux list-sessions -F "#{session_name}" 2>/dev/null || echo "No sessions"',
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
        TMUX: 'initialize_tmux.sh',
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
- list_sessions: List all tmux sessions
- broadcast [message]: Send message to all active agents
- help: Show this help message
`.trim(),
};
//# sourceMappingURL=constants.js.map