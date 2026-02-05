/**
 * Orchestrator Status Service
 *
 * Provides utilities to check the status of the orchestrator.
 * Used by Chat and Slack services to provide appropriate feedback
 * when the orchestrator is not running.
 *
 * @module services/orchestrator/orchestrator-status.service
 */

import { StorageService } from '../core/storage.service.js';
import { AGENTMUX_CONSTANTS, WEB_CONSTANTS } from '../../../../config/index.js';
import { getSessionBackendSync } from '../session/index.js';

/** Dashboard URL for user-facing messages */
const DASHBOARD_URL = `http://localhost:${WEB_CONSTANTS.PORTS.FRONTEND}`;

/**
 * Result of an orchestrator status check
 */
export interface OrchestratorStatusResult {
  /** Whether the orchestrator is active and ready to receive messages */
  isActive: boolean;
  /** The current agent status of the orchestrator */
  agentStatus: string | null;
  /** Human-readable status message */
  message: string;
}

/**
 * Check if the orchestrator is currently active and ready to receive messages.
 *
 * @returns Promise resolving to true if orchestrator is active
 *
 * @example
 * ```typescript
 * if (await isOrchestratorActive()) {
 *   // Safe to send message to orchestrator
 * } else {
 *   // Show user-friendly offline message
 * }
 * ```
 */
export async function isOrchestratorActive(): Promise<boolean> {
  const status = await getOrchestratorStatus();
  return status.isActive;
}

/**
 * Get detailed orchestrator status information.
 *
 * Uses the storageService.getOrchestratorStatus() method which reads the
 * orchestrator data directly from storage (not from the teams array).
 *
 * @returns Promise resolving to status details including active state and message
 *
 * @example
 * ```typescript
 * const status = await getOrchestratorStatus();
 * if (!status.isActive) {
 *   showError(status.message);
 * }
 * ```
 */
export async function getOrchestratorStatus(): Promise<OrchestratorStatusResult> {
  try {
    const storageService = StorageService.getInstance();

    // Use getOrchestratorStatus which reads the orchestrator data directly
    // The orchestrator is stored separately from the teams array
    const orchestratorStatus = await storageService.getOrchestratorStatus();

    // Also check if the PTY session exists - this provides a real-time view
    // of whether the orchestrator is actually running
    let sessionExists = false;
    try {
      const sessionBackend = getSessionBackendSync();
      if (sessionBackend && orchestratorStatus?.sessionName) {
        sessionExists = sessionBackend.sessionExists(orchestratorStatus.sessionName);
      }
    } catch {
      // Ignore session check errors - fall back to storage-based status
    }

    if (!orchestratorStatus) {
      return {
        isActive: false,
        agentStatus: null,
        message: 'Orchestrator not configured. Please set up the orchestrator from the Dashboard.',
      };
    }

    const agentStatus = orchestratorStatus.agentStatus || AGENTMUX_CONSTANTS.AGENT_STATUSES.INACTIVE;

    // Consider the orchestrator active if:
    // 1. The storage status is 'active', OR
    // 2. The PTY session exists AND status is 'started' (runtime running, awaiting registration)
    const isActive = agentStatus === AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVE ||
                     (sessionExists && agentStatus === AGENTMUX_CONSTANTS.AGENT_STATUSES.STARTED);

    if (isActive) {
      return {
        isActive: true,
        agentStatus: AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVE,
        message: 'Orchestrator is active and ready.',
      };
    }

    // Provide context-appropriate message based on status
    if (agentStatus === AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVATING ||
        agentStatus === AGENTMUX_CONSTANTS.AGENT_STATUSES.STARTING) {
      return {
        isActive: false,
        agentStatus,
        message: 'Orchestrator is starting up. Please wait a moment and try again.',
      };
    }

    // If session exists but status is not active/started, it may be initializing
    if (sessionExists) {
      return {
        isActive: false,
        agentStatus,
        message: 'Orchestrator is starting up. Please wait a moment and try again.',
      };
    }

    return {
      isActive: false,
      agentStatus,
      message: 'Orchestrator is not running. Please start the orchestrator from the Dashboard.',
    };
  } catch (error) {
    return {
      isActive: false,
      agentStatus: null,
      message: `Unable to check orchestrator status: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get a user-friendly message for when the orchestrator is offline.
 * Useful for Slack and Chat responses.
 *
 * @param includeUrl - Whether to include the dashboard URL in the message
 * @returns A user-friendly offline message
 */
export function getOrchestratorOfflineMessage(includeUrl = true): string {
  const baseMessage = 'The orchestrator is currently offline.';
  if (includeUrl) {
    return `${baseMessage} Please start it from the AgentMux dashboard at ${DASHBOARD_URL}`;
  }
  return `${baseMessage} Please start it from the AgentMux dashboard.`;
}
