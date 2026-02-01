/**
 * useTeams Hook Tests
 *
 * @module hooks/useTeams.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import axios from 'axios';
import { useTeams } from './useTeams';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('useTeams', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should initialize with loading state', () => {
    mockedAxios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useTeams());

    expect(result.current.loading).toBe(true);
    expect(result.current.teams).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should fetch teams on mount', async () => {
    const mockTeams = [
      { id: 'team-1', name: 'Team Alpha', members: [] },
      { id: 'team-2', name: 'Team Beta', members: [] },
    ];

    mockedAxios.get.mockResolvedValueOnce({
      data: { success: true, data: mockTeams },
    });

    const { result } = renderHook(() => useTeams());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.teams).toEqual(mockTeams);
    expect(result.current.error).toBeNull();
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/teams', expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
  });

  it('should handle API success false', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { success: false, error: 'Access denied' },
    });

    const { result } = renderHook(() => useTeams());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.teams).toEqual([]);
    expect(result.current.error).toBe('Access denied');
  });

  it('should handle network error', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Connection failed'));

    const { result } = renderHook(() => useTeams());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.teams).toEqual([]);
    expect(result.current.error).toBe('Connection failed');
  });

  it('should refresh teams when refresh is called', async () => {
    const initialTeams = [{ id: 'team-1', name: 'Team Alpha', members: [] }];
    const updatedTeams = [
      { id: 'team-1', name: 'Team Alpha', members: [] },
      { id: 'team-2', name: 'Team Beta', members: [] },
    ];

    mockedAxios.get
      .mockResolvedValueOnce({ data: { success: true, data: initialTeams } })
      .mockResolvedValueOnce({ data: { success: true, data: updatedTeams } });

    const { result } = renderHook(() => useTeams());

    await waitFor(() => {
      expect(result.current.teams).toEqual(initialTeams);
    });

    await result.current.refresh();

    await waitFor(() => {
      expect(result.current.teams).toEqual(updatedTeams);
    });

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('should handle empty teams array', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { success: true, data: [] },
    });

    const { result } = renderHook(() => useTeams());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.teams).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should handle null data gracefully', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { success: true, data: null },
    });

    const { result } = renderHook(() => useTeams());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.teams).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
