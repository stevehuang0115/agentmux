/**
 * AgentMux Constants - Centralized Export
 *
 * This file provides a single import point for all AgentMux constants across domains.
 *
 * Usage examples:
 * ```typescript
 * // Cross-domain constants
 * import { AGENTMUX_CONSTANTS, MCP_CONSTANTS } from '../config';
 *
 * // Backend-specific constants
 * import { BACKEND_CONSTANTS } from '../config';
 *
 * // All constants
 * import * as CONFIG from '../config';
 * ```
 */
// ========================= CROSS-DOMAIN CONSTANTS =========================
import { 
// Core system constants
AGENTMUX_CONSTANTS, MCP_CONSTANTS, WEB_CONSTANTS, TIMING_CONSTANTS, MESSAGE_CONSTANTS, ENV_CONSTANTS, } from './constants.js';
export { 
// Core system constants
AGENTMUX_CONSTANTS, MCP_CONSTANTS, WEB_CONSTANTS, TIMING_CONSTANTS, MESSAGE_CONSTANTS, ENV_CONSTANTS, };
// ========================= BACKEND-SPECIFIC CONSTANTS =========================
import * as BackendConstants from './backend-constants.js';
export * from './backend-constants.js';
// ========================= CONVENIENCE EXPORTS =========================
/**
 * Grouped backend constants for easier access
 */
export const BACKEND_CONSTANTS = {
    // Orchestrator
    ORCHESTRATOR: {
        SESSION_NAME: BackendConstants.ORCHESTRATOR_SESSION_NAME,
        DISPLAY_NAME: BackendConstants.ORCHESTRATOR_DISPLAY_NAME,
        ROLE: BackendConstants.ORCHESTRATOR_ROLE,
        WINDOW_NAME: BackendConstants.ORCHESTRATOR_WINDOW_NAME,
    },
    // Timeouts
    TIMEOUTS: {
        ORCHESTRATOR_SETUP: BackendConstants.ORCHESTRATOR_SETUP_TIMEOUT,
        AGENT_INITIALIZATION: BackendConstants.AGENT_INITIALIZATION_TIMEOUT,
        CLAUDE_INITIALIZATION: BackendConstants.CLAUDE_INITIALIZATION_TIMEOUT,
        CLAUDE_READY: BackendConstants.CLAUDE_READY_TIMEOUT,
        TASK_MONITOR_POLL_INTERVAL: BackendConstants.TASK_MONITOR_POLL_INTERVAL_MS,
        MCP_DEFAULT: BackendConstants.MCP_DEFAULT_TIMEOUT,
        HEALTH_CHECK_INTERVAL: BackendConstants.HEALTH_CHECK_INTERVAL_MS,
        HEALTH_CHECK: BackendConstants.HEALTH_CHECK_TIMEOUT_MS,
        AGENT_DEFAULT: BackendConstants.AGENT_DEFAULT_TIMEOUT_MS,
        CONTEXT_REFRESH_INTERVAL: BackendConstants.CONTEXT_REFRESH_INTERVAL_MS,
        WS_PING: BackendConstants.WS_PING_TIMEOUT_MS,
        WS_PING_INTERVAL: BackendConstants.WS_PING_INTERVAL_MS,
        BACKUP_INTERVAL: BackendConstants.BACKUP_INTERVAL_MS,
        RATE_LIMIT_WINDOW: BackendConstants.RATE_LIMIT_WINDOW_MS,
        COMMAND_TIMESTAMP_OFFSET: BackendConstants.COMMAND_TIMESTAMP_OFFSET_MS,
        COMMAND_TIMESTAMP_OFFSET_LONG: BackendConstants.COMMAND_TIMESTAMP_OFFSET_MS_LONG,
    },
    // Directories and files
    PATHS: {
        AGENTMUX_HOME_DIR: BackendConstants.AGENTMUX_HOME_DIR,
        CONFIG_DIR: BackendConstants.CONFIG_DIR,
        PROMPTS_DIR: BackendConstants.PROMPTS_DIR,
        TASKS_DIR: BackendConstants.TASKS_DIR,
        SPECS_DIR: BackendConstants.SPECS_DIR,
        MEMORY_DIR: BackendConstants.MEMORY_DIR,
        ADDITIONAL_DIRS: BackendConstants.ADDITIONAL_DIRS,
        FRONTEND_DIST_PATH: BackendConstants.FRONTEND_DIST_PATH,
    },
    FILES: {
        TEAMS_CONFIG_FILE: BackendConstants.TEAMS_CONFIG_FILE,
        ACTIVE_PROJECTS_FILE: BackendConstants.ACTIVE_PROJECTS_FILE,
        TASK_TRACKING_FILE: BackendConstants.TASK_TRACKING_FILE,
        COMMUNICATION_LOG_FILE: BackendConstants.COMMUNICATION_LOG_FILE,
        CONFIG_FILE_NAMES: BackendConstants.CONFIG_FILE_NAMES,
        LOG_FILE_PREFIX: BackendConstants.LOG_FILE_PREFIX,
        LOG_FILE_EXTENSION: BackendConstants.LOG_FILE_EXTENSION,
    },
    // Network
    PORTS: {
        DEFAULT_WEB_PORT: BackendConstants.DEFAULT_WEB_PORT,
        DEFAULT_MCP_PORT: BackendConstants.DEFAULT_MCP_PORT,
    },
    NETWORK: {
        DEFAULT_CORS_ORIGIN: BackendConstants.DEFAULT_CORS_ORIGIN,
        ALLOWED_HTTP_METHODS: BackendConstants.ALLOWED_HTTP_METHODS,
        HTTP_STATUS_CODES: BackendConstants.HTTP_STATUS_CODES,
    },
    // Roles and statuses
    ROLES: BackendConstants.AGENT_ROLES,
    ROLE_DISPLAY_NAMES: BackendConstants.ROLE_DISPLAY_NAMES,
    AGENT_STATUS_VALUES: BackendConstants.AGENT_STATUS_VALUES,
    WORKING_STATUS_VALUES: BackendConstants.WORKING_STATUS_VALUES,
    DEFAULTS: {
        AGENT_STATUS: BackendConstants.DEFAULT_AGENT_STATUS,
        WORKING_STATUS: BackendConstants.DEFAULT_WORKING_STATUS,
    },
    // Sessions and commands
    SESSIONS: {
        PREFIX: BackendConstants.AGENTMUX_SESSION_PREFIX,
    },
    COMMANDS: {
        ORCHESTRATOR_COMMANDS: BackendConstants.ORCHESTRATOR_COMMANDS,
        TMUX_COMMANDS: BackendConstants.TMUX_COMMANDS,
        ORCHESTRATOR_HELP_TEXT: BackendConstants.ORCHESTRATOR_HELP_TEXT,
        SPECIAL_KEYS: BackendConstants.SPECIAL_KEYS,
    },
    // Environment variables
    ENV: {
        ...BackendConstants.ENV_VARS,
        ...BackendConstants.ADDITIONAL_ENV_VARS,
    },
    // Scripts and detection
    SCRIPTS: BackendConstants.INIT_SCRIPTS,
    DETECTION: {
        CLAUDE_DETECTION_CACHE_TIMEOUT: BackendConstants.CLAUDE_DETECTION_CACHE_TIMEOUT,
        MEMORY_CLEANUP_INTERVAL: BackendConstants.MEMORY_CLEANUP_INTERVAL,
        MAX_OUTPUT_BUFFER_SIZE: BackendConstants.MAX_OUTPUT_BUFFER_SIZE,
    },
    // Messages and limits
    MESSAGES: {
        MESSAGE_CHUNK_SIZE: BackendConstants.MESSAGE_CHUNK_SIZE,
        SMALL_CHUNK_SIZE: BackendConstants.SMALL_CHUNK_SIZE,
    },
    LIMITS: {
        MAX_CONTEXT_FILE_SIZE_BYTES: BackendConstants.MAX_CONTEXT_FILE_SIZE_BYTES,
        MAX_REQUEST_BODY_SIZE: BackendConstants.MAX_REQUEST_BODY_SIZE,
        DEFAULT_LOG_LIMIT: BackendConstants.DEFAULT_LOG_LIMIT,
        MAX_CONCURRENT_MONITORING_JOBS: BackendConstants.MAX_CONCURRENT_MONITORING_JOBS,
        DEFAULT_LOG_FILE_SIZE: BackendConstants.DEFAULT_LOG_FILE_SIZE,
    },
    // API endpoints
    API: BackendConstants.API_ENDPOINTS,
};
// ========================= DOMAIN-SPECIFIC CONVENIENCE EXPORTS =========================
/**
 * All cross-domain constants grouped for easy access
 */
export const CROSS_DOMAIN_CONSTANTS = {
    AGENTMUX: AGENTMUX_CONSTANTS,
    MCP: MCP_CONSTANTS,
    WEB: WEB_CONSTANTS,
    TIMING: TIMING_CONSTANTS,
    MESSAGES: MESSAGE_CONSTANTS,
    ENV: ENV_CONSTANTS,
};
//# sourceMappingURL=index.js.map