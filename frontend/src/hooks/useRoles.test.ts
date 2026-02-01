/**
 * Tests for useRoles Hook
 *
 * @module hooks/useRoles.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRoles } from './useRoles';
import { rolesService } from '../services/roles.service';
import { RoleSummary, CreateRoleInput } from '../types/role.types';

vi.mock('../services/roles.service');

describe('useRoles Hook', () => {
  const mockRoles: RoleSummary[] = [
    {
      id: 'developer',
      name: 'developer',
      displayName: 'Developer',
      description: 'Software developer role',
      category: 'development',
      skillCount: 3,
      isDefault: true,
      isBuiltin: true,
    },
    {
      id: 'custom-role',
      name: 'custom-role',
      displayName: 'Custom Role',
      description: 'A custom role',
      category: 'development',
      skillCount: 1,
      isDefault: false,
      isBuiltin: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rolesService.listRoles).mockResolvedValue(mockRoles);
  });

  describe('Initial Load', () => {
    it('should start with loading state', () => {
      const { result } = renderHook(() => useRoles());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.roles).toBe(null);
    });

    it('should load roles on mount', async () => {
      const { result } = renderHook(() => useRoles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.roles).toEqual(mockRoles);
      expect(rolesService.listRoles).toHaveBeenCalledTimes(1);
    });

    it('should set error when load fails', async () => {
      vi.mocked(rolesService.listRoles).mockRejectedValue(new Error('Failed to load'));

      const { result } = renderHook(() => useRoles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load');
      expect(result.current.roles).toBe(null);
    });
  });

  describe('createRole', () => {
    it('should create role and refresh list', async () => {
      const input: CreateRoleInput = {
        name: 'new-role',
        displayName: 'New Role',
        description: 'A new role',
        category: 'development',
        systemPromptContent: '# New Role',
      };

      vi.mocked(rolesService.createRole).mockResolvedValue({
        id: 'new-role',
        name: 'new-role',
        displayName: 'New Role',
        description: 'A new role',
        category: 'development',
        systemPromptFile: 'new-role-prompt.md',
        assignedSkills: [],
        isDefault: false,
        isBuiltin: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });

      const { result } = renderHook(() => useRoles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.createRole(input);
      });

      expect(rolesService.createRole).toHaveBeenCalledWith(input);
      // Should refresh list after create
      expect(rolesService.listRoles).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateRole', () => {
    it('should update role and refresh list', async () => {
      vi.mocked(rolesService.updateRole).mockResolvedValue({
        ...mockRoles[1],
        id: 'custom-role',
        name: 'custom-role',
        displayName: 'Updated Role',
        systemPromptFile: 'custom-role-prompt.md',
        assignedSkills: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });

      const { result } = renderHook(() => useRoles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateRole('custom-role', { displayName: 'Updated Role' });
      });

      expect(rolesService.updateRole).toHaveBeenCalledWith('custom-role', { displayName: 'Updated Role' });
      // Should refresh list after update
      expect(rolesService.listRoles).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteRole', () => {
    it('should delete role and refresh list', async () => {
      vi.mocked(rolesService.deleteRole).mockResolvedValue(undefined);

      const { result } = renderHook(() => useRoles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.deleteRole('custom-role');
      });

      expect(rolesService.deleteRole).toHaveBeenCalledWith('custom-role');
      // Should refresh list after delete
      expect(rolesService.listRoles).toHaveBeenCalledTimes(2);
    });
  });

  describe('refreshRoles', () => {
    it('should refresh roles from server', async () => {
      const { result } = renderHook(() => useRoles());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(rolesService.listRoles).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.refreshRoles();
      });

      expect(rolesService.listRoles).toHaveBeenCalledTimes(2);
    });
  });
});
