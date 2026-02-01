/**
 * Tests for useRole Hook
 *
 * @module hooks/useRole.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRole } from './useRole';
import { rolesService } from '../services/roles.service';
import { RoleWithPrompt } from '../types/role.types';

vi.mock('../services/roles.service');

describe('useRole Hook', () => {
  const mockRoleWithPrompt: RoleWithPrompt = {
    id: 'developer',
    name: 'developer',
    displayName: 'Developer',
    description: 'Software developer role',
    category: 'development',
    systemPromptFile: 'developer-prompt.md',
    systemPromptContent: '# Developer\n\nYou are a developer...',
    assignedSkills: ['file-ops', 'git-ops'],
    isDefault: true,
    isBuiltin: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('With Role ID', () => {
    it('should start with loading state when roleId provided', () => {
      vi.mocked(rolesService.getRole).mockResolvedValue(mockRoleWithPrompt);

      const { result } = renderHook(() => useRole('developer'));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.role).toBe(null);
    });

    it('should load role when roleId provided', async () => {
      vi.mocked(rolesService.getRole).mockResolvedValue(mockRoleWithPrompt);

      const { result } = renderHook(() => useRole('developer'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.role).toEqual(mockRoleWithPrompt);
      expect(rolesService.getRole).toHaveBeenCalledWith('developer');
    });

    it('should set error when load fails', async () => {
      vi.mocked(rolesService.getRole).mockRejectedValue(new Error('Role not found'));

      const { result } = renderHook(() => useRole('nonexistent'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Role not found');
      expect(result.current.role).toBe(null);
    });
  });

  describe('Without Role ID', () => {
    it('should not load when roleId is null', async () => {
      const { result } = renderHook(() => useRole(null));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.role).toBe(null);
      expect(rolesService.getRole).not.toHaveBeenCalled();
    });
  });

  describe('Role ID Change', () => {
    it('should reload when roleId changes', async () => {
      vi.mocked(rolesService.getRole).mockResolvedValue(mockRoleWithPrompt);

      const { result, rerender } = renderHook(({ roleId }) => useRole(roleId), {
        initialProps: { roleId: 'developer' as string | null },
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(rolesService.getRole).toHaveBeenCalledWith('developer');

      // Change to different role
      const anotherRole = { ...mockRoleWithPrompt, id: 'qa', name: 'qa' };
      vi.mocked(rolesService.getRole).mockResolvedValue(anotherRole);

      rerender({ roleId: 'qa' });

      await waitFor(() => {
        expect(result.current.role?.id).toBe('qa');
      });

      expect(rolesService.getRole).toHaveBeenCalledWith('qa');
    });

    it('should clear role when roleId changes to null', async () => {
      vi.mocked(rolesService.getRole).mockResolvedValue(mockRoleWithPrompt);

      const { result, rerender } = renderHook(({ roleId }) => useRole(roleId), {
        initialProps: { roleId: 'developer' as string | null },
      });

      await waitFor(() => {
        expect(result.current.role).toEqual(mockRoleWithPrompt);
      });

      rerender({ roleId: null });

      await waitFor(() => {
        expect(result.current.role).toBe(null);
      });
    });
  });

  describe('refreshRole', () => {
    it('should refresh role from server', async () => {
      vi.mocked(rolesService.getRole).mockResolvedValue(mockRoleWithPrompt);

      const { result } = renderHook(() => useRole('developer'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(rolesService.getRole).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.refreshRole();
      });

      expect(rolesService.getRole).toHaveBeenCalledTimes(2);
    });

    it('should do nothing when roleId is null', async () => {
      const { result } = renderHook(() => useRole(null));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshRole();
      });

      expect(rolesService.getRole).not.toHaveBeenCalled();
    });
  });
});
