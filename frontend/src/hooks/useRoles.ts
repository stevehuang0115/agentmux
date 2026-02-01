/**
 * useRoles Hook
 *
 * React hook for managing agent roles.
 * Provides CRUD operations and state management for roles list.
 *
 * @module hooks/useRoles
 */

import { useState, useEffect, useCallback } from 'react';
import { rolesService } from '../services/roles.service';
import {
  RoleSummary,
  CreateRoleInput,
  UpdateRoleInput,
} from '../types/role.types';

/**
 * Return type for useRoles hook
 */
export interface UseRolesResult {
  /** List of role summaries */
  roles: RoleSummary[] | null;
  /** Whether roles are loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Create a new role */
  createRole: (input: CreateRoleInput) => Promise<void>;
  /** Update an existing role */
  updateRole: (id: string, input: UpdateRoleInput) => Promise<void>;
  /** Delete a role */
  deleteRole: (id: string) => Promise<void>;
  /** Refresh roles from server */
  refreshRoles: () => Promise<void>;
}

/**
 * Hook for managing agent roles list
 *
 * @returns Roles state and operations
 *
 * @example
 * ```tsx
 * const { roles, createRole, isLoading } = useRoles();
 *
 * const handleCreate = async () => {
 *   await createRole({
 *     name: 'custom-role',
 *     displayName: 'Custom Role',
 *     description: 'A custom role',
 *     category: 'development',
 *     systemPromptContent: '# Custom Role\nYou are...',
 *   });
 * };
 * ```
 */
export function useRoles(): UseRolesResult {
  const [roles, setRoles] = useState<RoleSummary[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch roles from server
   */
  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await rolesService.listRoles();
      setRoles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Create a new role
   */
  const createRole = useCallback(async (input: CreateRoleInput): Promise<void> => {
    await rolesService.createRole(input);
    await fetchRoles();
  }, [fetchRoles]);

  /**
   * Update an existing role
   */
  const updateRole = useCallback(async (id: string, input: UpdateRoleInput): Promise<void> => {
    await rolesService.updateRole(id, input);
    await fetchRoles();
  }, [fetchRoles]);

  /**
   * Delete a role
   */
  const deleteRole = useCallback(async (id: string): Promise<void> => {
    await rolesService.deleteRole(id);
    await fetchRoles();
  }, [fetchRoles]);

  /**
   * Refresh roles from server
   */
  const refreshRoles = useCallback(async (): Promise<void> => {
    await fetchRoles();
  }, [fetchRoles]);

  // Load roles on mount
  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return {
    roles,
    isLoading,
    error,
    createRole,
    updateRole,
    deleteRole,
    refreshRoles,
  };
}

export default useRoles;
