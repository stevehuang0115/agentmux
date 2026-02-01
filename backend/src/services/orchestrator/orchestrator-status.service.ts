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
import { AGENTMUX_CONSTANTS } from '../../../../config/index.js';
import type { Team } from '../../types/index.js';

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
    const teams = await storageService.getTeams();

    // Find the orchestrator team
    const orchestratorTeam = teams.find((t: Team) => t.id === 'orchestrator');

    if (!orchestratorTeam) {
      return {
        isActive: false,
        agentStatus: null,
        message: 'Orchestrator team not found. Please create an orchestrator team first.',
      };
    }

    // Get the orchestrator member (should be the first/only member)
    const orchestrator = orchestratorTeam.members?.[0];

    if (!orchestrator) {
      return {
        isActive: false,
        agentStatus: null,
        message: 'Orchestrator not configured. Please add an orchestrator member to the team.',
      };
    }

    const agentStatus = orchestrator.agentStatus || AGENTMUX_CONSTANTS.AGENT_STATUSES.INACTIVE;
    const isActive = agentStatus === AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVE;

    if (isActive) {
      return {
        isActive: true,
        agentStatus,
        message: 'Orchestrator is active and ready.',
      };
    }

    // Provide context-appropriate message based on status
    if (agentStatus === AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVATING) {
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
    return `${baseMessage} Please start it from the AgentMux dashboard at http://localhost:8788`;
  }
  return `${baseMessage} Please start it from the AgentMux dashboard.`;
}
