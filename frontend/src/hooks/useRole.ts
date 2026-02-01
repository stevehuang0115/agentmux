/**
 * useRole Hook
 *
 * React hook for fetching a single role with its prompt content.
 *
 * @module hooks/useRole
 */

import { useState, useEffect, useCallback } from 'react';
import { rolesService } from '../services/roles.service';
import { RoleWithPrompt } from '../types/role.types';

/**
 * Return type for useRole hook
 */
export interface UseRoleResult {
  /** Role with prompt content */
  role: RoleWithPrompt | null;
  /** Whether role is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh role from server */
  refreshRole: () => Promise<void>;
}

/**
 * Hook for fetching a single role with its prompt content
 *
 * @param roleId - Role ID to fetch (null to skip fetching)
 * @returns Role state and operations
 *
 * @example
 * ```tsx
 * const { role, isLoading, error } = useRole('developer');
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error} />;
 * if (!role) return null;
 *
 * return <RoleDetail role={role} />;
 * ```
 */
export function useRole(roleId: string | null): UseRoleResult {
  const [role, setRole] = useState<RoleWithPrompt | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch role from server
   */
  const fetchRole = useCallback(async () => {
    if (!roleId) {
      setRole(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await rolesService.getRole(roleId);
      setRole(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load role');
      setRole(null);
    } finally {
      setIsLoading(false);
    }
  }, [roleId]);

  /**
   * Refresh role from server
   */
  const refreshRole = useCallback(async (): Promise<void> => {
    await fetchRole();
  }, [fetchRole]);

  // Load role when roleId changes
  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  return {
    role,
    isLoading,
    error,
    refreshRole,
  };
}

export default useRole;
