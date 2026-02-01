/**
 * useProjects Hook
 *
 * React hook for managing projects data with API integration.
 *
 * @module hooks/useProjects
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type { Project, ApiResponse } from '../types';

const API_BASE = '/api';

/**
 * Options for the useProjects hook
 */
export interface UseProjectsOptions {
  /** Whether to fetch immediately on mount (default: true) */
  fetchOnMount?: boolean;
}

/**
 * Result returned by the useProjects hook
 */
export interface UseProjectsResult {
  /** List of projects */
  projects: Project[];
  /** Whether projects are loading */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh the projects list */
  refresh: () => Promise<void>;
}

/**
 * Hook for managing projects data.
 *
 * Fetches projects from the backend API and provides
 * state management for the project list.
 *
 * @param options - Configuration options
 * @returns Projects data and operations
 *
 * @example
 * ```tsx
 * const { projects, loading, error, refresh } = useProjects();
 *
 * if (loading) return <div>Loading...</div>;
 *
 * return (
 *   <ul>
 *     {projects.map(p => <li key={p.id}>{p.name}</li>)}
 *   </ul>
 * );
 * ```
 */
export function useProjects(options: UseProjectsOptions = {}): UseProjectsResult {
  const { fetchOnMount = true } = options;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(fetchOnMount);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch projects from API.
   */
  const fetchProjects = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get<ApiResponse<Project[]>>(`${API_BASE}/projects`);
      if (response.data.success) {
        setProjects(response.data.data || []);
      } else {
        setError('Failed to load projects');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load projects';
      setError(message);
      console.error('[useProjects] Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch projects on mount if enabled
  useEffect(() => {
    if (fetchOnMount) {
      fetchProjects();
    }
  }, [fetchOnMount, fetchProjects]);

  return {
    projects,
    loading,
    error,
    refresh: fetchProjects,
  };
}

export default useProjects;
