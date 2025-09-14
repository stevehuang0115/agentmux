/**
 * AgentMux Backend-Specific Constants
 *
 * This file contains constants that are specific to the backend domain.
 * For cross-domain constants, see ./constants.ts
 */
// ========================= ORCHESTRATOR CONSTANTS =========================
/**
 * Default orchestrator session name used across the application
 */
export const ORCHESTRATOR_SESSION_NAME = 'agentmux-orc';
/**
 * Display name for the orchestrator role
 */
export const ORCHESTRATOR_DISPLAY_NAME = 'Orchestrator';
/**
 * Orchestrator role identifier
 */
export const ORCHESTRATOR_ROLE = 'orchestrator';
/**
 * Default orchestrator window name in tmux
 */
export const ORCHESTRATOR_WINDOW_NAME = 'AgentMux Orchestrator';
// ========================= TIMEOUT CONSTANTS =========================
/**
 * Default timeout for orchestrator setup (30 seconds)
 */
export const ORCHESTRATOR_SETUP_TIMEOUT = 30000;
/**
 * Default timeout for agent initialization (90 seconds)
 */
export const AGENT_INITIALIZATION_TIMEOUT = 90000;
/**
 * Default timeout for Claude initialization (45 seconds)
 */
export const CLAUDE_INITIALIZATION_TIMEOUT = 45000;
/**
 * Timeout for waiting for Claude to be ready (45 seconds)
 */
export const CLAUDE_READY_TIMEOUT = 45000;
/**
 * Task monitoring and polling intervals
 */
export const TASK_MONITOR_POLL_INTERVAL_MS = 2000;
/**
 * MCP default timeout for operations
 */
export const MCP_DEFAULT_TIMEOUT = 30000;
/**
 * Health check monitoring interval
 */
export const HEALTH_CHECK_INTERVAL_MS = 30000;
/**
 * Health check timeout for individual checks
 */
export const HEALTH_CHECK_TIMEOUT_MS = 1000;
/**
 * Agent default timeout for operations (5 minutes)
 */
export const AGENT_DEFAULT_TIMEOUT_MS = 300000;
/**
 * Context refresh interval (30 minutes)
 */
export const CONTEXT_REFRESH_INTERVAL_MS = 1800000;
/**
 * WebSocket ping timeout
 */
export const WS_PING_TIMEOUT_MS = 60000;
/**
 * WebSocket ping interval
 */
export const WS_PING_INTERVAL_MS = 25000;
/**
 * Backup interval (1 hour)
 */
export const BACKUP_INTERVAL_MS = 3600000;
/**
 * Rate limit window (15 minutes)
 */
export const RATE_LIMIT_WINDOW_MS = 900000;
/**
 * Command timestamp offsets
 */
export const COMMAND_TIMESTAMP_OFFSET_MS = 300000; // 5 minutes
export const COMMAND_TIMESTAMP_OFFSET_MS_LONG = 600000; // 10 minutes
// ========================= DIRECTORY CONSTANTS =========================
/**
 * AgentMux home directory name
 */
export const AGENTMUX_HOME_DIR = '.agentmux';
/**
 * Configuration directory name
 */
export const CONFIG_DIR = 'config';
/**
 * Prompts directory name
 */
export const PROMPTS_DIR = 'prompts';
/**
 * Tasks directory name
 */
export const TASKS_DIR = 'tasks';
/**
 * Specs directory name
 */
export const SPECS_DIR = 'specs';
/**
 * Memory directory name
 */
export const MEMORY_DIR = 'memory';
/**
 * Additional directory names
 */
export const ADDITIONAL_DIRS = {
    LOGS: 'logs',
    DATA: 'data'
};
// ========================= FILE CONSTANTS =========================
/**
 * Teams configuration file name
 */
export const TEAMS_CONFIG_FILE = 'teams.json';
/**
 * Active projects tracking file name
 */
export const ACTIVE_PROJECTS_FILE = 'active_projects.json';
/**
 * Task tracking file name
 */
export const TASK_TRACKING_FILE = 'in_progress_tasks.json';
/**
 * Communication log file name
 */
export const COMMUNICATION_LOG_FILE = 'communication.log';
/**
 * Configuration file names
 */
export const CONFIG_FILE_NAMES = {
    CONFIG_JSON: 'config.json',
    APP_JSON: 'app.json'
};
/**
 * Log file naming patterns
 */
export const LOG_FILE_PREFIX = 'agentmux-';
export const LOG_FILE_EXTENSION = '.log';
// ========================= PORT CONSTANTS =========================
/**
 * Default web server port
 */
export const DEFAULT_WEB_PORT = 3000;
/**
 * Default MCP server port
 */
export const DEFAULT_MCP_PORT = 3001;
// ========================= ROLE CONSTANTS =========================
/**
 * Available agent roles
 */
export const AGENT_ROLES = {
    ORCHESTRATOR: 'orchestrator',
    PROJECT_MANAGER: 'pm',
    TECH_LEAD: 'tpm',
    DEVELOPER: 'developer',
    QA: 'qa',
    DEVOPS: 'devops'
};
/**
 * Role display names
 */
export const ROLE_DISPLAY_NAMES = {
    [AGENT_ROLES.ORCHESTRATOR]: 'Orchestrator',
    [AGENT_ROLES.PROJECT_MANAGER]: 'Project Manager',
    [AGENT_ROLES.TECH_LEAD]: 'Technical Project Manager',
    [AGENT_ROLES.DEVELOPER]: 'Developer',
    [AGENT_ROLES.QA]: 'Quality Assurance',
    [AGENT_ROLES.DEVOPS]: 'DevOps Engineer'
};
// ========================= STATUS VALUE CONSTANTS =========================
/**
 * Agent status values (extends AGENT_ROLES)
 */
export const AGENT_STATUS_VALUES = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    ACTIVATING: 'activating'
};
/**
 * Working status values
 */
export const WORKING_STATUS_VALUES = {
    IN_PROGRESS: 'in_progress',
    IDLE: 'idle'
};
/**
 * Default agent and working statuses
 */
export const DEFAULT_AGENT_STATUS = 'inactive';
export const DEFAULT_WORKING_STATUS = 'idle';
// ========================= SESSION PATTERN CONSTANTS =========================
/**
 * AgentMux session name prefix pattern
 */
export const AGENTMUX_SESSION_PREFIX = 'agentmux_';
// ========================= ENVIRONMENT CONSTANTS =========================
/**
 * Environment variable names
 */
export const ENV_VARS = {
    TMUX_SESSION_NAME: 'TMUX_SESSION_NAME',
    AGENTMUX_ROLE: 'AGENTMUX_ROLE',
    API_PORT: 'API_PORT',
    MCP_PORT: 'AGENTMUX_MCP_PORT',
    PROJECT_PATH: 'PROJECT_PATH',
    AGENT_ROLE: 'AGENT_ROLE'
};
/**
 * Additional environment variable names
 */
export const ADDITIONAL_ENV_VARS = {
    WEB_PORT: 'WEB_PORT',
    DEFAULT_CHECK_INTERVAL: 'DEFAULT_CHECK_INTERVAL',
    AUTO_COMMIT_INTERVAL: 'AUTO_COMMIT_INTERVAL',
    AGENTMUX_HOME: 'AGENTMUX_HOME'
};
// ========================= SCRIPT CONSTANTS =========================
/**
 * Initialization script file names
 */
export const INIT_SCRIPTS = {
    TMUX: 'initialize_tmux.sh',
    CLAUDE: 'initialize_claude.sh'
};
// ========================= DETECTION CONSTANTS =========================
/**
 * Claude detection timeout (30 seconds cache)
 */
export const CLAUDE_DETECTION_CACHE_TIMEOUT = 30000;
/**
 * Memory cleanup interval (5 minutes)
 */
export const MEMORY_CLEANUP_INTERVAL = 5 * 60 * 1000;
/**
 * Maximum buffer size for output streaming
 */
export const MAX_OUTPUT_BUFFER_SIZE = 100;
// ========================= MESSAGE CONSTANTS =========================
/**
 * Message chunking size for large messages
 */
export const MESSAGE_CHUNK_SIZE = 1500;
/**
 * Small chunk size to avoid paste detection
 */
export const SMALL_CHUNK_SIZE = 200;
// ========================= SIZE AND LIMIT CONSTANTS =========================
/**
 * Maximum file size for context loading (1MB)
 */
export const MAX_CONTEXT_FILE_SIZE_BYTES = 1048576;
/**
 * Maximum request body size (10MB)
 */
export const MAX_REQUEST_BODY_SIZE = '10mb';
/**
 * Default log entry limit
 */
export const DEFAULT_LOG_LIMIT = 100;
/**
 * Maximum concurrent monitoring jobs
 */
export const MAX_CONCURRENT_MONITORING_JOBS = 10;
/**
 * Default log file size limit
 */
export const DEFAULT_LOG_FILE_SIZE = '10m';
// ========================= ORCHESTRATOR COMMAND CONSTANTS =========================
/**
 * Orchestrator command identifiers
 */
export const ORCHESTRATOR_COMMANDS = {
    GET_TEAM_STATUS: 'get_team_status',
    LIST_PROJECTS: 'list_projects',
    LIST_SESSIONS: 'list_sessions',
    BROADCAST: 'broadcast',
    HELP: 'help'
};
/**
 * Tmux command templates
 */
export const TMUX_COMMANDS = {
    LIST_SESSIONS: 'tmux list-sessions -F "#{session_name}" 2>/dev/null || echo "No sessions"'
};
/**
 * Orchestrator help text
 */
export const ORCHESTRATOR_HELP_TEXT = `
Available commands:
- get_team_status: Get current status of all team members
- list_projects: List all available projects  
- list_sessions: List all tmux sessions
- broadcast [message]: Send message to all active agents
- help: Show this help message
`.trim();
// ========================= KEYBOARD AND INPUT CONSTANTS =========================
/**
 * Special key names
 */
export const SPECIAL_KEYS = {
    ENTER: 'Enter',
    CTRL_C: 'C-c'
};
// ========================= PATH AND FILE CONSTANTS =========================
/**
 * Frontend build directory path (relative to backend)
 */
export const FRONTEND_DIST_PATH = '../../frontend/dist';
// ========================= NETWORK AND HTTP CONSTANTS =========================
/**
 * Default CORS origin
 */
export const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';
/**
 * Allowed HTTP methods
 */
export const ALLOWED_HTTP_METHODS = ['GET', 'POST'];
/**
 * HTTP status codes used in the application
 */
export const HTTP_STATUS_CODES = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
};
// ========================= API ENDPOINTS =========================
/**
 * API endpoint paths
 */
export const API_ENDPOINTS = {
    ORCHESTRATOR_SETUP: '/api/orchestrator/setup',
    TEAMS: '/api/teams',
    TEAM_START: '/api/teams/:id/start',
    HEALTH: '/health',
    API_BASE: '/api',
    PROJECTS: '/projects',
    MONITORING: '/monitoring',
    SYSTEM: '/system'
};
//# sourceMappingURL=backend-constants.js.map