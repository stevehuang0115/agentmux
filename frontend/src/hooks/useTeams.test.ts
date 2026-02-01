/**
 * useTeams Hook Tests
 *
 * Tests for the teams management hook with mocked API.
 *
 * @module hooks/useTeams.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import axios from 'axios';
import { useTeams } from './useTeams';
import type { Team } from '../types';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('useTeams', () => {
  const mockTeams: Team[] = [
    {
      id: 'team-1',
      name: 'Frontend Team',
      members: [
        { id: 'agent-1', name: 'Dev Agent', role: 'developer', agentStatus: 'active' },
      ],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'team-2',
      name: 'Backend Team',
      members: [],
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    mockedAxios.get.mockResolvedValue({
      data: { success: true, data: mockTeams },
    });
  });

  describe('initial fetch', () => {
    it('should fetch teams on mount', async () => {
      const { result } = renderHook(() => useTeams());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.teams).toEqual(mockTeams);
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/teams');
    });

    it('should not fetch on mount when fetchOnMount is false', async () => {
      const { result } = renderHook(() => useTeams({ fetchOnMount: false }));

      expect(result.current.loading).toBe(false);
      expect(result.current.teams).toEqual([]);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle fetch error', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network Error'));

      const { result } = renderHook(() => useTeams());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network Error');
      expect(result.current.teams).toEqual([]);
    });

    it('should handle unsuccessful response', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { success: false },
      });

      const { result } = renderHook(() => useTeams());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load teams');
    });
  });

  describe('refresh', () => {
    it('should refresh teams list', async () => {
      const { result } = renderHook(() => useTeams());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('empty data handling', () => {
    it('should handle empty teams array', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { success: true, data: [] },
      });

      const { result } = renderHook(() => useTeams());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.teams).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should handle undefined data', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { success: true },
      });

      const { result } = renderHook(() => useTeams());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.teams).toEqual([]);
    });
  });
});
