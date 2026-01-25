/**
 * Tests for FactoryService.
 *
 * Tests API calls for factory state and usage statistics.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { factoryService } from './factory.service';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe('FactoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFactoryState', () => {
    it('should return factory state from API', async () => {
      const mockData = {
        agents: [
          {
            id: 'agent-1',
            sessionName: 'test-session',
            name: 'Test Agent',
            projectName: 'Test Project',
            status: 'active',
            cpuPercent: 50,
            activity: 'Working...',
          },
        ],
        projects: ['Test Project'],
        stats: { activeCount: 1, idleCount: 0, dormantCount: 0, totalTokens: 100 },
      };

      mockedAxios.get = vi.fn().mockResolvedValue({
        data: { success: true, data: mockData },
      });

      const result = await factoryService.getFactoryState();

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/factory/state');
      expect(result.agents).toHaveLength(1);
      expect(result.projects).toContain('Test Project');
    });

    it('should return empty state when API returns no data', async () => {
      mockedAxios.get = vi.fn().mockResolvedValue({
        data: { success: true, data: null },
      });

      const result = await factoryService.getFactoryState();

      expect(result.agents).toHaveLength(0);
      expect(result.projects).toHaveLength(0);
    });

    it('should fall back to teams endpoint when factory/state fails', async () => {
      // First call fails (factory/state)
      mockedAxios.get = vi.fn()
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: [
              {
                name: 'Team 1',
                currentProject: 'Project A',
                members: [
                  {
                    id: 'member-1',
                    name: 'Member 1',
                    sessionName: 'session-1',
                    agentStatus: 'active',
                    workingStatus: 'in_progress',
                  },
                ],
              },
            ],
          },
        });

      const result = await factoryService.getFactoryState();

      expect(result.agents).toHaveLength(1);
      expect(result.projects).toContain('Project A');
    });

    it('should return empty state when all endpoints fail', async () => {
      mockedAxios.get = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await factoryService.getFactoryState();

      expect(result.agents).toHaveLength(0);
      expect(result.projects).toHaveLength(0);
      expect(result.stats.activeCount).toBe(0);
    });

    it('should return empty state when API returns success=false', async () => {
      mockedAxios.get = vi.fn().mockResolvedValue({
        data: { success: false, error: 'Not authorized' },
      });

      const result = await factoryService.getFactoryState();

      expect(result.agents).toHaveLength(0);
      expect(result.projects).toHaveLength(0);
    });
  });

  describe('buildFactoryStateFromLegacyEndpoints (via getFactoryState fallback)', () => {
    it('should map inactive agentStatus to dormant', async () => {
      mockedAxios.get = vi.fn()
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: [{
              name: 'Team',
              currentProject: 'Project',
              members: [{
                id: '1',
                name: 'Agent',
                sessionName: 'session',
                agentStatus: 'inactive',
                workingStatus: 'idle',
              }],
            }],
          },
        });

      const result = await factoryService.getFactoryState();
      expect(result.agents[0].status).toBe('dormant');
    });

    it('should map active agentStatus with in_progress workingStatus to active', async () => {
      mockedAxios.get = vi.fn()
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: [{
              name: 'Team',
              currentProject: 'Project',
              members: [{
                id: '1',
                name: 'Agent',
                sessionName: 'session',
                agentStatus: 'active',
                workingStatus: 'in_progress',
              }],
            }],
          },
        });

      const result = await factoryService.getFactoryState();
      expect(result.agents[0].status).toBe('active');
      expect(result.agents[0].cpuPercent).toBe(50);
      expect(result.agents[0].activity).toBe('Working...');
    });

    it('should map active agentStatus with idle workingStatus to idle', async () => {
      mockedAxios.get = vi.fn()
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: [{
              name: 'Team',
              currentProject: 'Project',
              members: [{
                id: '1',
                name: 'Agent',
                sessionName: 'session',
                agentStatus: 'active',
                workingStatus: 'idle',
              }],
            }],
          },
        });

      const result = await factoryService.getFactoryState();
      expect(result.agents[0].status).toBe('idle');
      expect(result.agents[0].cpuPercent).toBe(0);
      expect(result.agents[0].activity).toBeUndefined();
    });

    it('should use team name when currentProject is missing', async () => {
      mockedAxios.get = vi.fn()
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: [{
              name: 'My Team',
              members: [{
                id: '1',
                name: 'Agent',
                sessionName: 'session',
                agentStatus: 'active',
                workingStatus: 'idle',
              }],
            }],
          },
        });

      const result = await factoryService.getFactoryState();
      expect(result.agents[0].projectName).toBe('My Team');
      expect(result.projects).toContain('My Team');
    });

    it('should use Unassigned when both currentProject and name are missing', async () => {
      mockedAxios.get = vi.fn()
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: [{
              members: [{
                id: '1',
                name: 'Agent',
                sessionName: 'session',
                agentStatus: 'active',
                workingStatus: 'idle',
              }],
            }],
          },
        });

      const result = await factoryService.getFactoryState();
      expect(result.agents[0].projectName).toBe('Unassigned');
    });

    it('should handle teams with no members array', async () => {
      mockedAxios.get = vi.fn()
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: [{
              name: 'Empty Team',
              currentProject: 'Project',
            }],
          },
        });

      const result = await factoryService.getFactoryState();
      expect(result.agents).toHaveLength(0);
      expect(result.projects).toContain('Project');
    });

    it('should correctly count agent statuses in stats', async () => {
      mockedAxios.get = vi.fn()
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: [{
              name: 'Team',
              currentProject: 'Project',
              members: [
                { id: '1', name: 'A1', sessionName: 's1', agentStatus: 'active', workingStatus: 'in_progress' },
                { id: '2', name: 'A2', sessionName: 's2', agentStatus: 'active', workingStatus: 'idle' },
                { id: '3', name: 'A3', sessionName: 's3', agentStatus: 'inactive', workingStatus: 'idle' },
              ],
            }],
          },
        });

      const result = await factoryService.getFactoryState();
      expect(result.stats.activeCount).toBe(1);
      expect(result.stats.idleCount).toBe(1);
      expect(result.stats.dormantCount).toBe(1);
    });

    it('should handle empty teams array', async () => {
      mockedAxios.get = vi.fn()
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce({
          data: { success: true, data: [] },
        });

      const result = await factoryService.getFactoryState();
      expect(result.agents).toHaveLength(0);
      expect(result.projects).toHaveLength(0);
    });
  });

  describe('getUsageStats', () => {
    it('should return usage statistics', async () => {
      const mockStats = {
        today: { messages: 100, tokens: 50000, toolCalls: 200 },
        totals: { sessions: 10, messages: 500 },
        recentDays: [
          { date: '2024-01-01', tokens: 10000 },
          { date: '2024-01-02', tokens: 15000 },
        ],
      };

      mockedAxios.get = vi.fn().mockResolvedValue({ data: mockStats });

      const result = await factoryService.getUsageStats();

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/factory/usage');
      expect(result.today.messages).toBe(100);
      expect(result.totals.sessions).toBe(10);
    });

    it('should return empty stats on error', async () => {
      mockedAxios.get = vi.fn().mockRejectedValue(new Error('Failed'));

      const result = await factoryService.getUsageStats();

      expect(result.today.tokens).toBe(0);
      expect(result.totals.sessions).toBe(0);
    });
  });

  describe('getAgentLogs', () => {
    it('should return agent logs', async () => {
      const mockLogs = ['line 1', 'line 2', 'line 3'];

      mockedAxios.get = vi.fn().mockResolvedValue({
        data: { success: true, data: { logs: mockLogs } },
      });

      const result = await factoryService.getAgentLogs('test-session', 50);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        '/api/sessions/test-session/logs',
        { params: { lines: 50 } }
      );
      expect(result).toEqual(mockLogs);
    });

    it('should return empty array on error', async () => {
      mockedAxios.get = vi.fn().mockRejectedValue(new Error('Failed'));

      const result = await factoryService.getAgentLogs('test-session');

      expect(result).toEqual([]);
    });
  });

  describe('subscribeToUpdates', () => {
    it('should return a cleanup function', () => {
      const callback = vi.fn();
      const cleanup = factoryService.subscribeToUpdates(callback);

      expect(typeof cleanup).toBe('function');

      // Calling cleanup should not throw
      expect(() => cleanup()).not.toThrow();
    });
  });
});
