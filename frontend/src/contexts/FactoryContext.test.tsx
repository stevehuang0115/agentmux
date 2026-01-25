/**
 * Tests for FactoryContext.
 *
 * Tests the factory state management, hooks, and provider behavior.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { FactoryProvider, useFactory } from './FactoryContext';
import { factoryService } from '../services/factory.service';

// Mock the factory service
vi.mock('../services/factory.service', () => ({
  factoryService: {
    getFactoryState: vi.fn(),
    getUsageStats: vi.fn(),
  },
}));

describe('FactoryContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFactory hook', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useFactory());
      }).toThrow('useFactory must be used within a FactoryProvider');

      spy.mockRestore();
    });

    it('should return context when used inside provider', async () => {
      (factoryService.getFactoryState as any).mockResolvedValue({
        agents: [],
        projects: [],
        stats: { activeCount: 0, idleCount: 0, dormantCount: 0, totalTokens: 0 },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FactoryProvider>{children}</FactoryProvider>
      );

      const { result } = renderHook(() => useFactory(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.agents).toBeInstanceOf(Map);
      expect(result.current.zones).toBeInstanceOf(Map);
      expect(result.current.lightingMode).toBe('auto');
      expect(result.current.stats).toBeDefined();
    });
  });

  describe('FactoryProvider', () => {
    it('should initialize with default values', async () => {
      (factoryService.getFactoryState as any).mockResolvedValue({
        agents: [],
        projects: [],
        stats: { activeCount: 0, idleCount: 0, dormantCount: 0, totalTokens: 0 },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FactoryProvider>{children}</FactoryProvider>
      );

      const { result } = renderHook(() => useFactory(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lightingMode).toBe('auto');
      expect(result.current.bossModeState.isActive).toBe(false);
      expect(result.current.projects).toHaveLength(0);
    });

    it('should fetch factory state on mount', async () => {
      const mockState = {
        agents: [
          {
            id: 'agent-1',
            sessionName: 'test-session',
            name: 'Test Agent',
            projectName: 'Test Project',
            status: 'active' as const,
            cpuPercent: 50,
            activity: 'Working...',
          },
        ],
        projects: ['Test Project'],
        stats: { activeCount: 1, idleCount: 0, dormantCount: 0, totalTokens: 100 },
      };

      (factoryService.getFactoryState as any).mockResolvedValue(mockState);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FactoryProvider>{children}</FactoryProvider>
      );

      const { result } = renderHook(() => useFactory(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(factoryService.getFactoryState).toHaveBeenCalled();
      expect(result.current.agents.size).toBe(1);
      expect(result.current.projects).toContain('Test Project');
    });

    it('should compute stats from agents', async () => {
      const mockState = {
        agents: [
          { id: '1', sessionName: 's1', name: 'A1', projectName: 'P1', status: 'active' as const, cpuPercent: 50 },
          { id: '2', sessionName: 's2', name: 'A2', projectName: 'P1', status: 'active' as const, cpuPercent: 30 },
          { id: '3', sessionName: 's3', name: 'A3', projectName: 'P1', status: 'idle' as const, cpuPercent: 0 },
          { id: '4', sessionName: 's4', name: 'A4', projectName: 'P1', status: 'dormant' as const, cpuPercent: 0 },
        ],
        projects: ['P1'],
        stats: { activeCount: 2, idleCount: 1, dormantCount: 1, totalTokens: 0 },
      };

      (factoryService.getFactoryState as any).mockResolvedValue(mockState);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FactoryProvider>{children}</FactoryProvider>
      );

      const { result } = renderHook(() => useFactory(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats.activeCount).toBe(2);
      expect(result.current.stats.idleCount).toBe(1);
      expect(result.current.stats.dormantCount).toBe(1);
    });

    it('should toggle lighting mode', async () => {
      (factoryService.getFactoryState as any).mockResolvedValue({
        agents: [],
        projects: [],
        stats: { activeCount: 0, idleCount: 0, dormantCount: 0, totalTokens: 0 },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FactoryProvider>{children}</FactoryProvider>
      );

      const { result } = renderHook(() => useFactory(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lightingMode).toBe('auto');

      act(() => {
        result.current.setLightingMode('day');
      });

      expect(result.current.lightingMode).toBe('day');

      act(() => {
        result.current.setLightingMode('night');
      });

      expect(result.current.lightingMode).toBe('night');
    });

    it('should toggle boss mode', async () => {
      (factoryService.getFactoryState as any).mockResolvedValue({
        agents: [],
        projects: ['Project A', 'Project B'],
        stats: { activeCount: 0, idleCount: 0, dormantCount: 0, totalTokens: 0 },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FactoryProvider>{children}</FactoryProvider>
      );

      const { result } = renderHook(() => useFactory(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.bossModeState.isActive).toBe(false);

      act(() => {
        result.current.toggleBossMode();
      });

      expect(result.current.bossModeState.isActive).toBe(true);

      act(() => {
        result.current.toggleBossMode();
      });

      expect(result.current.bossModeState.isActive).toBe(false);
    });

    it('should handle API errors gracefully', async () => {
      (factoryService.getFactoryState as any).mockRejectedValue(
        new Error('Network error')
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FactoryProvider>{children}</FactoryProvider>
      );

      const { result } = renderHook(() => useFactory(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
    });
  });
});
