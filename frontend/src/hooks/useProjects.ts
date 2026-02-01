/**
 * useProjects Hook
 *
 * React hook for fetching and managing projects.
 *
 * @module hooks/useProjects
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Project, ApiResponse } from '../types';

const API_BASE = '/api';

/**
 * Result returned by the useProjects hook
 */
export interface UseProjectsResult {
  /** List of projects */
  projects: Project[];
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh the projects list */
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching projects data
 *
 * @returns Projects data and operations
 *
 * @example
 * ```tsx
 * const { projects, loading } = useProjects();
 * ```
 */
export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch projects from API
   *
   * @param signal - Optional AbortSignal for request cancellation
   */
  const fetchProjects = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.get<ApiResponse<Project[]>>(
          `${API_BASE}/projects`,
          { signal }
        );
        if (response.data.success) {
          setProjects(response.data.data || []);
        } else {
          setError(response.data.error || 'Failed to load projects');
        }
      } catch (err) {
        // Don't set error state if request was cancelled
        if (axios.isCancel(err)) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Failed to load projects';
        setError(message);
        console.error('useProjects: Failed to fetch projects:', err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Fetch on mount with cleanup
  useEffect(() => {
    const controller = new AbortController();
    fetchProjects(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchProjects]);

  /**
   * Manual refresh without abort signal
   */
  const refresh = useCallback(async (): Promise<void> => {
    await fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    loading,
    error,
    refresh,
  };
}

export default useProjects;
