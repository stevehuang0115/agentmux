/**
 * useTeams Hook
 *
 * React hook for managing teams data with API integration.
 *
 * @module hooks/useTeams
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type { Team, ApiResponse } from '../types';

const API_BASE = '/api';

/**
 * Options for the useTeams hook
 */
export interface UseTeamsOptions {
  /** Whether to fetch immediately on mount (default: true) */
  fetchOnMount?: boolean;
}

/**
 * Result returned by the useTeams hook
 */
export interface UseTeamsResult {
  /** List of teams */
  teams: Team[];
  /** Whether teams are loading */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh the teams list */
  refresh: () => Promise<void>;
}

/**
 * Hook for managing teams data.
 *
 * Fetches teams from the backend API and provides
 * state management for the team list.
 *
 * @param options - Configuration options
 * @returns Teams data and operations
 *
 * @example
 * ```tsx
 * const { teams, loading, error, refresh } = useTeams();
 *
 * if (loading) return <div>Loading...</div>;
 *
 * return (
 *   <ul>
 *     {teams.map(t => <li key={t.id}>{t.name}</li>)}
 *   </ul>
 * );
 * ```
 */
export function useTeams(options: UseTeamsOptions = {}): UseTeamsResult {
  const { fetchOnMount = true } = options;

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState<boolean>(fetchOnMount);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch teams from API.
   */
  const fetchTeams = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get<ApiResponse<Team[]>>(`${API_BASE}/teams`);
      if (response.data.success) {
        setTeams(response.data.data || []);
      } else {
        setError('Failed to load teams');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load teams';
      setError(message);
      console.error('[useTeams] Failed to fetch teams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch teams on mount if enabled
  useEffect(() => {
    if (fetchOnMount) {
      fetchTeams();
    }
  }, [fetchOnMount, fetchTeams]);

  return {
    teams,
    loading,
    error,
    refresh: fetchTeams,
  };
}

export default useTeams;
