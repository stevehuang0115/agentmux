/**
 * AgentMux Application Constants
 * 
 * This file contains all hardcoded values used throughout the application
 * to ensure consistency and make maintenance easier.
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
} as const;

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
} as const;

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
} as const;

// ========================= SCRIPT CONSTANTS =========================

/**
 * Initialization script file names
 */
export const INIT_SCRIPTS = {
  TMUX: 'initialize_tmux.sh',
  CLAUDE: 'initialize_claude.sh'
} as const;

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

// ========================= API ENDPOINTS =========================

/**
 * API endpoint paths
 */
export const API_ENDPOINTS = {
  ORCHESTRATOR_SETUP: '/api/orchestrator/setup',
  TEAMS: '/api/teams',
  TEAM_START: '/api/teams/:id/start',
  HEALTH: '/health'
} as const;