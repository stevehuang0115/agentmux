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
AGENTMUX_CONSTANTS, MCP_CONSTANTS, WEB_CONSTANTS, TIMING_CONSTANTS, MESSAGE_CONSTANTS, ENV_CONSTANTS, BACKEND_CONSTANTS, } from './constants.js';
export { 
// Core system constants
AGENTMUX_CONSTANTS, MCP_CONSTANTS, WEB_CONSTANTS, TIMING_CONSTANTS, MESSAGE_CONSTANTS, ENV_CONSTANTS, BACKEND_CONSTANTS, };
// All backend constants have been consolidated into the main constants.ts file
// Use BACKEND_CONSTANTS from the main export above
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
    BACKEND: BACKEND_CONSTANTS,
};
//# sourceMappingURL=index.js.map