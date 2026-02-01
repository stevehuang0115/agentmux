/**
 * Orchestrator Status Service Tests
 *
 * @module services/orchestrator/orchestrator-status.service.test
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

// Use a global mock data object that we can configure per-test
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTeamsData: { value: any[] | Error } = { value: [] };

// Mock storage service (using path without .js since moduleNameMapper strips it)
jest.mock('../core/storage.service', () => ({
  StorageService: {
    getInstance: () => ({
      getTeams: async () => {
        const data = mockTeamsData.value;
        if (data instanceof Error) {
          throw data;
        }
        return data;
      },
    }),
  },
}));

jest.mock('../core/logger.service.js', () => ({
  LoggerService: {
    getInstance: () => ({
      createComponentLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      }),
    }),
  },
}));

// Mock the config module to ensure AGENTMUX_CONSTANTS is available
jest.mock('../../../../config/index.js', () => ({
  AGENTMUX_CONSTANTS: {
    AGENT_STATUSES: {
      INACTIVE: 'inactive',
      ACTIVATING: 'activating',
      ACTIVE: 'active',
    },
  },
}));

// Import after mocks are defined
import {
  isOrchestratorActive,
  getOrchestratorStatus,
  getOrchestratorOfflineMessage,
} from './orchestrator-status.service.js';

describe('OrchestratorStatusService', () => {
  /**
   * Helper to create a mock team for testing.
   *
   * @param id - The team ID
   * @param members - Array of partial member objects with optional agentStatus
   * @returns A mock team object suitable for testing
   */
  function createMockTeam(
    id: string,
    members: Array<{ agentStatus?: string }>
  ): Record<string, unknown> {
    return {
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      members: members.map((m) => ({
        id: `${id}-member`,
        name: `${id} member`,
        sessionName: `${id}-session`,
        role: 'worker',
        capabilities: [],
        agentStatus: m.agentStatus,
        workingStatus: 'idle',
        currentTask: '',
        promptId: '',
        model: 'default',
        systemPrompt: '',
        runtimeType: 'local',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  beforeEach(() => {
    // Reset mock data to empty array before each test
    mockTeamsData.value = [];
  });

  afterEach(() => {
    mockTeamsData.value = [];
  });

  describe('isOrchestratorActive', () => {
    it('should return true when orchestrator is active', async () => {
      mockTeamsData.value = [createMockTeam('orchestrator', [{ agentStatus: 'active' }])];

      const result = await isOrchestratorActive();
      expect(result).toBe(true);
    });

    it('should return false when orchestrator is inactive', async () => {
      mockTeamsData.value = [createMockTeam('orchestrator', [{ agentStatus: 'inactive' }])];

      const result = await isOrchestratorActive();
      expect(result).toBe(false);
    });

    it('should return false when orchestrator team not found', async () => {
      mockTeamsData.value = [];

      const result = await isOrchestratorActive();
      expect(result).toBe(false);
    });

    it('should return false when orchestrator has no members', async () => {
      const team = createMockTeam('orchestrator', []);
      team.members = []; // Override to have no members
      mockTeamsData.value = [team];

      const result = await isOrchestratorActive();
      expect(result).toBe(false);
    });
  });

  describe('getOrchestratorStatus', () => {
    it('should return active status with correct message', async () => {
      mockTeamsData.value = [createMockTeam('orchestrator', [{ agentStatus: 'active' }])];

      const result = await getOrchestratorStatus();
      expect(result.isActive).toBe(true);
      expect(result.agentStatus).toBe('active');
      expect(result.message).toContain('active and ready');
    });

    it('should return activating status with appropriate message', async () => {
      mockTeamsData.value = [createMockTeam('orchestrator', [{ agentStatus: 'activating' }])];

      const result = await getOrchestratorStatus();
      expect(result.isActive).toBe(false);
      expect(result.agentStatus).toBe('activating');
      expect(result.message).toContain('starting up');
    });

    it('should return inactive status with appropriate message', async () => {
      mockTeamsData.value = [createMockTeam('orchestrator', [{ agentStatus: 'inactive' }])];

      const result = await getOrchestratorStatus();
      expect(result.isActive).toBe(false);
      expect(result.agentStatus).toBe('inactive');
      expect(result.message).toContain('not running');
    });

    it('should handle missing orchestrator team', async () => {
      const team = createMockTeam('other-team', []);
      team.members = [];
      mockTeamsData.value = [team];

      const result = await getOrchestratorStatus();
      expect(result.isActive).toBe(false);
      expect(result.agentStatus).toBeNull();
      expect(result.message).toContain('not found');
    });

    it('should handle missing orchestrator member', async () => {
      const team = createMockTeam('orchestrator', []);
      team.members = [];
      mockTeamsData.value = [team];

      const result = await getOrchestratorStatus();
      expect(result.isActive).toBe(false);
      expect(result.agentStatus).toBeNull();
      expect(result.message).toContain('not configured');
    });

    it('should handle storage errors gracefully', async () => {
      mockTeamsData.value = new Error('Storage error');

      const result = await getOrchestratorStatus();
      expect(result.isActive).toBe(false);
      expect(result.message).toContain('Unable to check');
      expect(result.message).toContain('Storage error');
    });

    it('should default to inactive when agentStatus is undefined', async () => {
      // Create a mock team with a member that has no agentStatus
      const team = createMockTeam('orchestrator', [{}]);
      // Remove the agentStatus property to test the default behavior
      const members = team.members as Array<Record<string, unknown>>;
      delete members[0].agentStatus;
      mockTeamsData.value = [team];

      const result = await getOrchestratorStatus();
      expect(result.isActive).toBe(false);
      expect(result.agentStatus).toBe('inactive');
    });
  });

  describe('getOrchestratorOfflineMessage', () => {
    it('should include URL by default', () => {
      const message = getOrchestratorOfflineMessage();
      expect(message).toContain('http://localhost:8788');
    });

    it('should exclude URL when includeUrl is false', () => {
      const message = getOrchestratorOfflineMessage(false);
      expect(message).not.toContain('http://localhost:8788');
      expect(message).toContain('dashboard');
    });

    it('should always mention orchestrator is offline', () => {
      const messageWithUrl = getOrchestratorOfflineMessage(true);
      const messageWithoutUrl = getOrchestratorOfflineMessage(false);

      expect(messageWithUrl).toContain('offline');
      expect(messageWithoutUrl).toContain('offline');
    });
  });
});
