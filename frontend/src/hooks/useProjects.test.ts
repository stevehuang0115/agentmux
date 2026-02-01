/**
 * useProjects Hook Tests
 *
 * @module hooks/useProjects.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import axios from 'axios';
import { useProjects } from './useProjects';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('useProjects', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should initialize with loading state', () => {
    mockedAxios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useProjects());

    expect(result.current.loading).toBe(true);
    expect(result.current.projects).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should fetch projects on mount', async () => {
    const mockProjects = [
      { id: 'proj-1', name: 'Project 1', status: 'active' },
      { id: 'proj-2', name: 'Project 2', status: 'paused' },
    ];

    mockedAxios.get.mockResolvedValueOnce({
      data: { success: true, data: mockProjects },
    });

    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.projects).toEqual(mockProjects);
    expect(result.current.error).toBeNull();
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/projects');
  });

  it('should handle API success false', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { success: false, error: 'Not authorized' },
    });

    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.projects).toEqual([]);
    expect(result.current.error).toBe('Not authorized');
  });

  it('should handle network error', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.projects).toEqual([]);
    expect(result.current.error).toBe('Network error');
  });

  it('should refresh projects when refresh is called', async () => {
    const initialProjects = [{ id: 'proj-1', name: 'Project 1', status: 'active' }];
    const updatedProjects = [
      { id: 'proj-1', name: 'Project 1', status: 'active' },
      { id: 'proj-2', name: 'Project 2', status: 'active' },
    ];

    mockedAxios.get
      .mockResolvedValueOnce({ data: { success: true, data: initialProjects } })
      .mockResolvedValueOnce({ data: { success: true, data: updatedProjects } });

    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.projects).toEqual(initialProjects);
    });

    await result.current.refresh();

    await waitFor(() => {
      expect(result.current.projects).toEqual(updatedProjects);
    });

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('should handle empty projects array', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { success: true, data: [] },
    });

    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.projects).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should handle null data gracefully', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { success: true, data: null },
    });

    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.projects).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
