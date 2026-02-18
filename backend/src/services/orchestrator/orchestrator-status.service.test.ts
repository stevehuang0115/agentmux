/**
 * Orchestrator Status Service Tests
 *
 * @module services/orchestrator/orchestrator-status.service.test
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

// Use a global mock data object that we can configure per-test
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockOrchestratorData: { value: any | null | Error } = { value: null };

// Whether the mock session backend reports the session as existing
const mockSessionState: { exists: boolean } = { exists: false };

// Mock storage service (using path without .js since moduleNameMapper strips it)
jest.mock('../core/storage.service', () => ({
  StorageService: {
    getInstance: () => ({
      getOrchestratorStatus: async () => {
        const data = mockOrchestratorData.value;
        if (data instanceof Error) {
          throw data;
        }
        return data;
      },
    }),
  },
}));

// Mock session backend to control sessionExists behavior
jest.mock('../session/index', () => ({
  getSessionBackendSync: () => ({
    sessionExists: () => mockSessionState.exists,
  }),
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

// Mock the config module to ensure constants are available
jest.mock('../../../../config/index.js', () => ({
  CREWLY_CONSTANTS: {
    AGENT_STATUSES: {
      INACTIVE: 'inactive',
      STARTING: 'starting',
      STARTED: 'started',
      ACTIVATING: 'activating',
      ACTIVE: 'active',
    },
    SESSIONS: {
      ORCHESTRATOR_NAME: 'crewly-orc',
    },
  },
  WEB_CONSTANTS: {
    PORTS: {
      FRONTEND: 8788,
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
   * Helper to create a mock orchestrator status for testing.
   *
   * @param agentStatus - The agent status (active, inactive, activating)
   * @returns A mock orchestrator status object suitable for testing
   */
  function createMockOrchestratorStatus(agentStatus: string): Record<string, unknown> {
    return {
      sessionName: 'crewly-orc',
      agentStatus,
      workingStatus: 'idle',
      runtimeType: 'claude-code',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  beforeEach(() => {
    // Reset mock data to null before each test
    mockOrchestratorData.value = null;
    mockSessionState.exists = false;
  });

  afterEach(() => {
    mockOrchestratorData.value = null;
    mockSessionState.exists = false;
  });

  describe('isOrchestratorActive', () => {
    it('should return true when orchestrator is active', async () => {
      mockOrchestratorData.value = createMockOrchestratorStatus('active');

      const result = await isOrchestratorActive();
      expect(result).toBe(true);
    });

    it('should return false when orchestrator is inactive', async () => {
      mockOrchestratorData.value = createMockOrchestratorStatus('inactive');

      const result = await isOrchestratorActive();
      expect(result).toBe(false);
    });

    it('should return false when orchestrator is not configured', async () => {
      mockOrchestratorData.value = null;

      const result = await isOrchestratorActive();
      expect(result).toBe(false);
    });

    it('should return false when orchestrator is activating', async () => {
      mockOrchestratorData.value = createMockOrchestratorStatus('activating');

      const result = await isOrchestratorActive();
      expect(result).toBe(false);
    });

    it('should return false when orchestrator is started but session does not exist', async () => {
      mockOrchestratorData.value = createMockOrchestratorStatus('started');
      mockSessionState.exists = false;

      const result = await isOrchestratorActive();
      expect(result).toBe(false);
    });

    it('should return true when orchestrator is started and session exists', async () => {
      mockOrchestratorData.value = createMockOrchestratorStatus('started');
      mockSessionState.exists = true;

      const result = await isOrchestratorActive();
      expect(result).toBe(true);
    });

    it('should return false when orchestrator is starting', async () => {
      mockOrchestratorData.value = createMockOrchestratorStatus('starting');

      const result = await isOrchestratorActive();
      expect(result).toBe(false);
    });
  });

  describe('getOrchestratorStatus', () => {
    it('should return active status with correct message', async () => {
      mockOrchestratorData.value = createMockOrchestratorStatus('active');

      const result = await getOrchestratorStatus();
      expect(result.isActive).toBe(true);
      expect(result.agentStatus).toBe('active');
      expect(result.message).toContain('active and ready');
    });

    it('should return activating status with appropriate message', async () => {
      mockOrchestratorData.value = createMockOrchestratorStatus('activating');

      const result = await getOrchestratorStatus();
      expect(result.isActive).toBe(false);
      expect(result.agentStatus).toBe('activating');
      expect(result.message).toContain('starting up');
    });

    it('should return started status with starting up message when session does not exist', async () => {
      mockOrchestratorData.value = createMockOrchestratorStatus('started');
      mockSessionState.exists = false;

      const result = await getOrchestratorStatus();
      expect(result.isActive).toBe(false);
      expect(result.agentStatus).toBe('started');
      expect(result.message).toContain('starting up');
    });

    it('should return active when started and session exists', async () => {
      mockOrchestratorData.value = createMockOrchestratorStatus('started');
      mockSessionState.exists = true;

      const result = await getOrchestratorStatus();
      expect(result.isActive).toBe(true);
      expect(result.agentStatus).toBe('active');
      expect(result.message).toContain('active and ready');
    });

    it('should return starting status with starting up message', async () => {
      mockOrchestratorData.value = createMockOrchestratorStatus('starting');

      const result = await getOrchestratorStatus();
      expect(result.isActive).toBe(false);
      expect(result.agentStatus).toBe('starting');
      expect(result.message).toContain('starting up');
    });

    it('should return inactive status with appropriate message', async () => {
      mockOrchestratorData.value = createMockOrchestratorStatus('inactive');

      const result = await getOrchestratorStatus();
      expect(result.isActive).toBe(false);
      expect(result.agentStatus).toBe('inactive');
      expect(result.message).toContain('not running');
    });

    it('should handle missing orchestrator status (null)', async () => {
      mockOrchestratorData.value = null;

      const result = await getOrchestratorStatus();
      expect(result.isActive).toBe(false);
      expect(result.agentStatus).toBeNull();
      expect(result.message).toContain('not configured');
    });

    it('should handle storage errors gracefully', async () => {
      mockOrchestratorData.value = new Error('Storage error');

      const result = await getOrchestratorStatus();
      expect(result.isActive).toBe(false);
      expect(result.message).toContain('Unable to check');
      expect(result.message).toContain('Storage error');
    });

    it('should use fallback session name when orchestratorStatus has no sessionName', async () => {
      // Simulate orchestratorStatus without sessionName (the root cause of the banner mismatch)
      mockOrchestratorData.value = {
        agentStatus: 'started',
        workingStatus: 'idle',
        runtimeType: 'claude-code',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // No sessionName field
      };
      mockSessionState.exists = true;

      const result = await getOrchestratorStatus();
      // Should detect the session via the fallback constant and report active
      expect(result.isActive).toBe(true);
      expect(result.agentStatus).toBe('active');
      expect(result.message).toContain('active and ready');
    });

    it('should report not running when sessionName is missing and session does not exist', async () => {
      mockOrchestratorData.value = {
        agentStatus: 'inactive',
        workingStatus: 'idle',
        runtimeType: 'claude-code',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // No sessionName field
      };
      mockSessionState.exists = false;

      const result = await getOrchestratorStatus();
      expect(result.isActive).toBe(false);
      expect(result.message).toContain('not running');
    });

    it('should default to inactive when agentStatus is undefined', async () => {
      // Create a mock status with undefined agentStatus
      const status = createMockOrchestratorStatus('active');
      delete (status as Record<string, unknown>).agentStatus;
      mockOrchestratorData.value = status;

      const result = await getOrchestratorStatus();
      expect(result.isActive).toBe(false);
      expect(result.agentStatus).toBe('inactive');
    });
  });

  describe('getOrchestratorOfflineMessage', () => {
    it('should include URL by default', () => {
      const message = getOrchestratorOfflineMessage();
      expect(message).toContain('http://localhost:');
    });

    it('should exclude URL when includeUrl is false', () => {
      const message = getOrchestratorOfflineMessage(false);
      expect(message).not.toContain('http://localhost:');
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
