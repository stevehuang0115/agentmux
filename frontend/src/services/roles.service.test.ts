/**
 * Tests for Roles Service
 *
 * @module services/roles.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { rolesService } from './roles.service';
import { Role, RoleSummary, RoleWithPrompt, CreateRoleInput, UpdateRoleInput } from '../types/role.types';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('RolesService', () => {
  const mockRoleSummary: RoleSummary = {
    id: 'developer',
    name: 'developer',
    displayName: 'Developer',
    description: 'Software developer role',
    category: 'development',
    skillCount: 3,
    isDefault: true,
    isBuiltin: true,
  };

  const mockRole: Role = {
    id: 'developer',
    name: 'developer',
    displayName: 'Developer',
    description: 'Software developer role',
    category: 'development',
    systemPromptFile: 'developer-prompt.md',
    assignedSkills: ['file-ops', 'git-ops'],
    isDefault: true,
    isBuiltin: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const mockRoleWithPrompt: RoleWithPrompt = {
    ...mockRole,
    systemPromptContent: '# Developer\n\nYou are a developer...',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listRoles', () => {
    it('should fetch roles successfully', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { success: true, data: [mockRoleSummary] },
      });

      const result = await rolesService.listRoles();

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/settings/roles');
      expect(result).toEqual([mockRoleSummary]);
    });

    it('should throw error when request fails', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { success: false, error: 'Failed to get roles' },
      });

      await expect(rolesService.listRoles()).rejects.toThrow('Failed to get roles');
    });
  });

  describe('getRole', () => {
    it('should fetch role with prompt successfully', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { success: true, data: mockRoleWithPrompt },
      });

      const result = await rolesService.getRole('developer');

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/settings/roles/developer');
      expect(result).toEqual(mockRoleWithPrompt);
    });

    it('should throw error when role not found', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { success: false, error: 'Role not found' },
      });

      await expect(rolesService.getRole('nonexistent')).rejects.toThrow('Role not found');
    });
  });

  describe('createRole', () => {
    it('should create role successfully', async () => {
      const input: CreateRoleInput = {
        name: 'custom-role',
        displayName: 'Custom Role',
        description: 'A custom role',
        category: 'development',
        systemPromptContent: '# Custom Role\n\nYou are...',
      };

      const createdRole: Role = {
        ...mockRole,
        id: 'custom-role',
        name: 'custom-role',
        displayName: 'Custom Role',
        description: 'A custom role',
        isBuiltin: false,
        isDefault: false,
      };

      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: createdRole },
      });

      const result = await rolesService.createRole(input);

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/settings/roles', input);
      expect(result.name).toBe('custom-role');
    });

    it('should throw error when creation fails', async () => {
      const input: CreateRoleInput = {
        name: 'custom-role',
        displayName: 'Custom Role',
        description: 'A custom role',
        category: 'development',
        systemPromptContent: '# Custom Role',
      };

      mockedAxios.post.mockResolvedValue({
        data: { success: false, error: 'Duplicate name' },
      });

      await expect(rolesService.createRole(input)).rejects.toThrow('Duplicate name');
    });
  });

  describe('updateRole', () => {
    it('should update role successfully', async () => {
      const input: UpdateRoleInput = {
        displayName: 'Updated Developer',
      };

      const updatedRole: Role = {
        ...mockRole,
        displayName: 'Updated Developer',
      };

      mockedAxios.put.mockResolvedValue({
        data: { success: true, data: updatedRole },
      });

      const result = await rolesService.updateRole('developer', input);

      expect(mockedAxios.put).toHaveBeenCalledWith('/api/settings/roles/developer', input);
      expect(result.displayName).toBe('Updated Developer');
    });

    it('should throw error when update fails', async () => {
      mockedAxios.put.mockResolvedValue({
        data: { success: false, error: 'Cannot modify builtin role' },
      });

      await expect(rolesService.updateRole('developer', {})).rejects.toThrow('Cannot modify builtin role');
    });
  });

  describe('deleteRole', () => {
    it('should delete role successfully', async () => {
      mockedAxios.delete.mockResolvedValue({
        data: { success: true },
      });

      await rolesService.deleteRole('custom-role');

      expect(mockedAxios.delete).toHaveBeenCalledWith('/api/settings/roles/custom-role');
    });

    it('should throw error when delete fails', async () => {
      mockedAxios.delete.mockResolvedValue({
        data: { success: false, error: 'Cannot delete builtin role' },
      });

      await expect(rolesService.deleteRole('developer')).rejects.toThrow('Cannot delete builtin role');
    });
  });

  describe('assignSkills', () => {
    it('should assign skills successfully', async () => {
      const skillIds = ['new-skill-1', 'new-skill-2'];

      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: mockRole },
      });

      const result = await rolesService.assignSkills('developer', skillIds);

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/settings/roles/developer/skills', { skillIds });
      expect(result).toEqual(mockRole);
    });

    it('should throw error when assignment fails', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { success: false, error: 'Cannot modify builtin role' },
      });

      await expect(rolesService.assignSkills('developer', ['skill'])).rejects.toThrow('Cannot modify builtin role');
    });
  });

  describe('removeSkills', () => {
    it('should remove skills successfully', async () => {
      const skillIds = ['skill-to-remove'];

      mockedAxios.delete.mockResolvedValue({
        data: { success: true, data: mockRole },
      });

      const result = await rolesService.removeSkills('developer', skillIds);

      expect(mockedAxios.delete).toHaveBeenCalledWith('/api/settings/roles/developer/skills', { data: { skillIds } });
      expect(result).toEqual(mockRole);
    });

    it('should throw error when removal fails', async () => {
      mockedAxios.delete.mockResolvedValue({
        data: { success: false, error: 'Failed to remove skills' },
      });

      await expect(rolesService.removeSkills('developer', ['skill'])).rejects.toThrow('Failed to remove skills');
    });
  });

  describe('setDefaultRole', () => {
    it('should set default role successfully', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: mockRole },
      });

      const result = await rolesService.setDefaultRole('developer');

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/settings/roles/developer/default');
      expect(result).toEqual(mockRole);
    });

    it('should throw error when setting default fails', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { success: false, error: 'Role not found' },
      });

      await expect(rolesService.setDefaultRole('nonexistent')).rejects.toThrow('Role not found');
    });
  });
});
