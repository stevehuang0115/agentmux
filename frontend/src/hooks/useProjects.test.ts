/**
 * useProjects Hook Tests
 *
 * Unit tests for the useProjects custom hook.
 *
 * @module hooks/useProjects.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProjects } from './useProjects';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useProjects', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch projects on mount', async () => {
    const mockProjects = [
      { id: '1', name: 'Project 1', path: '/path/1', status: 'active', teams: {}, createdAt: '', updatedAt: '' },
      { id: '2', name: 'Project 2', path: '/path/2', status: 'active', teams: {}, createdAt: '', updatedAt: '' },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockProjects }),
    });

    const { result } = renderHook(() => useProjects());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.projects).toHaveLength(2);
    expect(result.current.projectOptions).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
    });

    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.projects).toHaveLength(0);
    expect(result.current.error).toBe('Failed to fetch projects: Internal Server Error');
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.projects).toHaveLength(0);
    expect(result.current.error).toBe('Network error');
  });

  it('should create projectOptions from projects', async () => {
    const mockProjects = [
      { id: 'p1', name: 'Alpha', path: '/alpha', status: 'active', teams: {}, createdAt: '', updatedAt: '' },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockProjects }),
    });

    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.projectOptions).toEqual([
      { id: 'p1', name: 'Alpha', path: '/alpha' },
    ]);
  });

  it('should handle non-array response data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: null }),
    });

    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.projects).toHaveLength(0);
  });

  it('should allow refetch', async () => {
    const mockProjects1 = [{ id: '1', name: 'P1', path: '/p1', status: 'active', teams: {}, createdAt: '', updatedAt: '' }];
    const mockProjects2 = [
      { id: '1', name: 'P1', path: '/p1', status: 'active', teams: {}, createdAt: '', updatedAt: '' },
      { id: '2', name: 'P2', path: '/p2', status: 'active', teams: {}, createdAt: '', updatedAt: '' },
    ];

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockProjects1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockProjects2 }),
      });

    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.projects).toHaveLength(1);
    });

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.projects).toHaveLength(2);
    });
  });
});
