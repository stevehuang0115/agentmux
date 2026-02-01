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
   */
  const fetchProjects = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get<ApiResponse<Project[]>>(`${API_BASE}/projects`);
      if (response.data.success) {
        setProjects(response.data.data || []);
      } else {
        setError(response.data.error || 'Failed to load projects');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load projects';
      setError(message);
      console.error('useProjects: Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    loading,
    error,
    refresh: fetchProjects,
  };
}

export default useProjects;
