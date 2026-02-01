/**
 * useProjects Hook Tests
 *
 * Tests for the projects management hook with mocked API.
 *
 * @module hooks/useProjects.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import axios from 'axios';
import { useProjects } from './useProjects';
import type { Project } from '../types';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('useProjects', () => {
  const mockProjects: Project[] = [
    {
      id: 'project-1',
      name: 'Test Project 1',
      description: 'Description 1',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'project-2',
      name: 'Test Project 2',
      description: 'Description 2',
      status: 'inactive',
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    mockedAxios.get.mockResolvedValue({
      data: { success: true, data: mockProjects },
    });
  });

  describe('initial fetch', () => {
    it('should fetch projects on mount', async () => {
      const { result } = renderHook(() => useProjects());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.projects).toEqual(mockProjects);
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/projects');
    });

    it('should not fetch on mount when fetchOnMount is false', async () => {
      const { result } = renderHook(() => useProjects({ fetchOnMount: false }));

      expect(result.current.loading).toBe(false);
      expect(result.current.projects).toEqual([]);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle fetch error', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network Error'));

      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network Error');
      expect(result.current.projects).toEqual([]);
    });

    it('should handle unsuccessful response', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { success: false },
      });

      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load projects');
    });
  });

  describe('refresh', () => {
    it('should refresh projects list', async () => {
      const { result } = renderHook(() => useProjects());

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
    it('should handle empty projects array', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { success: true, data: [] },
      });

      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.projects).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should handle undefined data', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { success: true },
      });

      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.projects).toEqual([]);
    });
  });
});
