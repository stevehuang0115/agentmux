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
        INACTIVE: 'inactive',
        ACTIVATING: 'activating',
        ACTIVE: 'active',
    },
    WORKING_STATUSES: {
        IDLE: 'idle',
        IN_PROGRESS: 'in_progress',
    },
    INIT_SCRIPTS: {
        TMUX: 'initialize_tmux.sh',
        CLAUDE: 'initialize_claude.sh',
        TMUX_ROBOSEND: 'tmux_robosend.sh',
    },
};
// Environment variable names (duplicated from config/constants.ts for backend use)
export const ENV_CONSTANTS = {
    TMUX_SESSION_NAME: 'TMUX_SESSION_NAME',
    AGENTMUX_ROLE: 'AGENTMUX_ROLE',
};
// Agent-specific timeout values (in milliseconds)
export const AGENT_TIMEOUTS = {
    ORCHESTRATOR_INITIALIZATION: 120000, // 2 minutes for orchestrator
    REGULAR_AGENT_INITIALIZATION: 75000, // 75 seconds for regular agents
};
// Agent runtime types
export const RUNTIME_TYPES = {
    CLAUDE_CODE: 'claude-code',
    GEMINI_CLI: 'gemini-cli',
    CODEX_CLI: 'codex-cli',
};
//# sourceMappingURL=constants.js.map