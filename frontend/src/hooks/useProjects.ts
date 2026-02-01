/**
 * useProjects Hook
 *
 * Custom hook for fetching and managing projects.
 * Centralizes project data fetching to avoid duplication across components.
 *
 * @module hooks/useProjects
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Project } from '../types';

/**
 * Simplified project data for selection dropdowns
 */
export interface ProjectOption {
  id: string;
  name: string;
  path: string;
}

/**
 * Return type for useProjects hook
 */
export interface UseProjectsResult {
  /** Full project data */
  projects: Project[];
  /** Simplified project options for dropdowns */
  projectOptions: ProjectOption[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Refetch projects */
  refetch: () => Promise<void>;
}

/**
 * Custom hook for fetching and managing projects.
 *
 * Fetches projects from the API and provides both full project data
 * and simplified options for use in dropdowns.
 *
 * @returns Object containing projects, loading state, and refetch function
 *
 * @example
 * ```tsx
 * const { projects, projectOptions, isLoading, error, refetch } = useProjects();
 * ```
 */
export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      const result = await response.json();
      const projectsData = result.success ? (result.data || []) : (result || []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch projects';
      setError(errorMessage);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Create simplified options for dropdowns, memoized to avoid recalculation
  const projectOptions: ProjectOption[] = useMemo(
    () => projects.map(p => ({
      id: p.id,
      name: p.name,
      path: p.path,
    })),
    [projects]
  );

  return {
    projects,
    projectOptions,
    isLoading,
    error,
    refetch: fetchProjects,
  };
}

export default useProjects;
