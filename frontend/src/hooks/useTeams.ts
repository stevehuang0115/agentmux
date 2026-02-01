/**
 * useTeams Hook
 *
 * React hook for fetching and managing teams.
 *
 * @module hooks/useTeams
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Team, ApiResponse } from '../types';

const API_BASE = '/api';

/**
 * Result returned by the useTeams hook
 */
export interface UseTeamsResult {
  /** List of teams */
  teams: Team[];
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh the teams list */
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching teams data
 *
 * @returns Teams data and operations
 *
 * @example
 * ```tsx
 * const { teams, loading } = useTeams();
 * ```
 */
export function useTeams(): UseTeamsResult {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch teams from API
   */
  const fetchTeams = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get<ApiResponse<Team[]>>(`${API_BASE}/teams`);
      if (response.data.success) {
        setTeams(response.data.data || []);
      } else {
        setError(response.data.error || 'Failed to load teams');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load teams';
      setError(message);
      console.error('useTeams: Failed to fetch teams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  return {
    teams,
    loading,
    error,
    refresh: fetchTeams,
  };
}

export default useTeams;
