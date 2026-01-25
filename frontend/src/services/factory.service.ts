/**
 * Factory Service - API calls for the 3D factory visualization.
 *
 * Handles communication with the backend for factory state,
 * agent data, and usage statistics.
 */

import axios from 'axios';
import {
  FactoryStateResponse,
  FactoryUsageResponse,
  FactoryAgentResponse,
  ApiResponse,
} from '../types';

const API_BASE = '/api';

/**
 * Service class for factory-related API operations
 */
class FactoryService {
  /**
   * Fetches the current factory state including all agents and projects.
   *
   * @returns Promise resolving to factory state with agents and projects
   * @throws Error if API call fails
   *
   * @example
   * ```typescript
   * const state = await factoryService.getFactoryState();
   * console.log(`${state.agents.length} agents active`);
   * ```
   */
  async getFactoryState(): Promise<FactoryStateResponse> {
    try {
      const response = await axios.get<ApiResponse<FactoryStateResponse>>(
        `${API_BASE}/factory/state`
      );

      // Check if response is valid JSON with success field
      // (HTML fallback pages won't have this structure)
      if (
        typeof response.data !== 'object' ||
        response.data === null ||
        !('success' in response.data)
      ) {
        // Response is not valid API JSON, fall back to legacy endpoints
        return this.buildFactoryStateFromLegacyEndpoints();
      }

      if (!response.data.success || !response.data.data) {
        // API returned error or no data, fall back to legacy endpoints
        return this.buildFactoryStateFromLegacyEndpoints();
      }

      return response.data.data;
    } catch (error) {
      // If endpoint doesn't exist, try to build from other endpoints
      return this.buildFactoryStateFromLegacyEndpoints();
    }
  }

  /**
   * Builds factory state from legacy endpoints when /factory/state doesn't exist.
   * Falls back to fetching from /teams endpoint.
   *
   * @returns Promise resolving to factory state
   */
  private async buildFactoryStateFromLegacyEndpoints(): Promise<FactoryStateResponse> {
    try {
      // Try to get teams and build agent list
      const teamsResponse = await axios.get<ApiResponse<any[]>>(`${API_BASE}/teams`);
      const teams = teamsResponse.data.data || [];

      const agents: FactoryAgentResponse[] = [];
      const projectSet = new Set<string>();

      teams.forEach((team: any) => {
        const projectName = team.currentProject || team.name || 'Unassigned';
        projectSet.add(projectName);

        if (team.members) {
          team.members.forEach((member: any) => {
            agents.push({
              id: member.id,
              sessionName: member.sessionName,
              name: member.name,
              projectName,
              status: this.mapAgentStatus(member.agentStatus, member.workingStatus),
              cpuPercent: member.workingStatus === 'in_progress' ? 50 : 0,
              activity: member.workingStatus === 'in_progress' ? 'Working...' : undefined,
              sessionTokens: 0,
            });
          });
        }
      });

      return {
        agents,
        projects: Array.from(projectSet),
        stats: {
          activeCount: agents.filter((a) => a.status === 'active').length,
          idleCount: agents.filter((a) => a.status === 'idle').length,
          dormantCount: agents.filter((a) => a.status === 'dormant').length,
          totalTokens: 0,
        },
      };
    } catch {
      return {
        agents: [],
        projects: [],
        stats: {
          activeCount: 0,
          idleCount: 0,
          dormantCount: 0,
          totalTokens: 0,
        },
      };
    }
  }

  /**
   * Maps backend agent status to factory visualization status.
   *
   * @param agentStatus - Agent connection status
   * @param workingStatus - Agent working status
   * @returns Mapped status for factory visualization
   */
  private mapAgentStatus(
    agentStatus: string,
    workingStatus: string
  ): 'active' | 'idle' | 'dormant' {
    if (agentStatus === 'inactive') {
      return 'dormant';
    }
    if (workingStatus === 'in_progress') {
      return 'active';
    }
    return 'idle';
  }

  /**
   * Fetches usage statistics for the factory display.
   *
   * @returns Promise resolving to usage statistics
   * @throws Error if API call fails
   *
   * @example
   * ```typescript
   * const usage = await factoryService.getUsageStats();
   * console.log(`Today: ${usage.today.tokens} tokens`);
   * ```
   */
  async getUsageStats(): Promise<FactoryUsageResponse> {
    try {
      const response = await axios.get<FactoryUsageResponse>(`${API_BASE}/factory/usage`);
      return response.data;
    } catch {
      // Return empty stats if endpoint fails
      return {
        today: {
          messages: 0,
          tokens: 0,
          toolCalls: 0,
        },
        totals: {
          sessions: 0,
          messages: 0,
        },
        recentDays: [],
      };
    }
  }

  /**
   * Fetches detailed information for a specific agent.
   *
   * @param agentId - ID of the agent to fetch
   * @returns Promise resolving to agent data
   * @throws Error if agent not found or API call fails
   */
  async getAgent(agentId: string): Promise<FactoryAgentResponse> {
    const response = await axios.get<ApiResponse<FactoryAgentResponse>>(
      `${API_BASE}/factory/agents/${agentId}`
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Agent not found');
    }

    return response.data.data;
  }

  /**
   * Fetches terminal logs for a specific agent session.
   *
   * @param sessionName - Session name of the agent
   * @param lines - Number of lines to fetch (default 50)
   * @returns Promise resolving to array of log lines
   */
  async getAgentLogs(sessionName: string, lines = 50): Promise<string[]> {
    try {
      const response = await axios.get<ApiResponse<{ logs: string[] }>>(
        `${API_BASE}/sessions/${sessionName}/logs`,
        { params: { lines } }
      );

      return response.data.data?.logs || [];
    } catch {
      return [];
    }
  }

  /**
   * Subscribes to real-time factory updates via WebSocket.
   * Returns a cleanup function to disconnect.
   *
   * @param onUpdate - Callback when factory state updates
   * @returns Cleanup function to disconnect WebSocket
   *
   * @example
   * ```typescript
   * const cleanup = factoryService.subscribeToUpdates((state) => {
   *   console.log('Factory updated:', state);
   * });
   *
   * // Later: cleanup();
   * ```
   */
  subscribeToUpdates(
    onUpdate: (state: FactoryStateResponse) => void
  ): () => void {
    // WebSocket subscription could be implemented here
    // For now, we use polling in FactoryContext

    // Return no-op cleanup function
    return () => {};
  }
}

/** Singleton instance of FactoryService */
export const factoryService = new FactoryService();
