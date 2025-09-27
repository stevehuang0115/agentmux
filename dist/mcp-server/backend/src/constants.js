/**
 * Backend-specific constants
 * Re-exported from the main config constants for backend use
 */
// Import from config directory for cross-domain constants
import { AGENTMUX_CONSTANTS as CONFIG_AGENTMUX_CONSTANTS, AGENT_IDENTITY_CONSTANTS as CONFIG_AGENT_IDENTITY_CONSTANTS, TIMING_CONSTANTS as CONFIG_TIMING_CONSTANTS } from '../../config/constants.js';
// Re-export the cross-domain constants for backend use
export const AGENT_IDENTITY_CONSTANTS = CONFIG_AGENT_IDENTITY_CONSTANTS;
export const TIMING_CONSTANTS = CONFIG_TIMING_CONSTANTS;
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