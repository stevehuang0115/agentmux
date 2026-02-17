/**
 * AgentMux Constants - Centralized Export
 * 
 * This file provides a single import point for all AgentMux constants across domains.
 * 
 * Usage examples:
 * ```typescript
 * // Cross-domain constants
 * import { AGENTMUX_CONSTANTS, WEB_CONSTANTS } from '../config';
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
  AGENTMUX_CONSTANTS,
  WEB_CONSTANTS,
  TIMING_CONSTANTS,
  MESSAGE_CONSTANTS,
  ENV_CONSTANTS,
  BACKEND_CONSTANTS,

  // Type helpers
  type AgentStatus,
  type WorkingStatus,
  type AgentRole,
  type MessageType,
  type OrchestratorCommand,
  type HTTPStatusCode,
} from './constants.js';

export {
  // Core system constants
  AGENTMUX_CONSTANTS,
  WEB_CONSTANTS,
  TIMING_CONSTANTS,
  MESSAGE_CONSTANTS,
  ENV_CONSTANTS,
  BACKEND_CONSTANTS,

  // Type helpers
  type AgentStatus,
  type WorkingStatus,
  type AgentRole,
  type MessageType,
  type OrchestratorCommand,
  type HTTPStatusCode,
};

// All backend constants have been consolidated into the main constants.ts file
// Use BACKEND_CONSTANTS from the main export above

// ========================= DOMAIN-SPECIFIC CONVENIENCE EXPORTS =========================

/**
 * All cross-domain constants grouped for easy access
 */
export const CROSS_DOMAIN_CONSTANTS = {
  AGENTMUX: AGENTMUX_CONSTANTS,
  WEB: WEB_CONSTANTS,
  TIMING: TIMING_CONSTANTS,
  MESSAGES: MESSAGE_CONSTANTS,
  ENV: ENV_CONSTANTS,
  BACKEND: BACKEND_CONSTANTS,
} as const;