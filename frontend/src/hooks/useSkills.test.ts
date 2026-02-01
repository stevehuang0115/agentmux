/**
 * useSkills Hook Tests
 *
 * Tests for the skills management hook with mocked API service.
 *
 * @module hooks/useSkills.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSkills } from './useSkills';
import * as skillsService from '../services/skills.service';
import type { SkillSummary, Skill, SkillCategory } from '../types/skill.types';

vi.mock('../services/skills.service');

describe('useSkills', () => {
  const mockSkillSummaries: SkillSummary[] = [
    {
      id: 'skill-1',
      name: 'skill-1',
      description: 'Test Skill 1',
      category: 'development' as SkillCategory,
      executionType: 'prompt-only',
      triggerCount: 2,
      roleCount: 1,
      isBuiltin: true,
      isEnabled: true,
    },
    {
      id: 'skill-2',
      name: 'skill-2',
      description: 'Test Skill 2',
      category: 'design' as SkillCategory,
      executionType: 'script',
      triggerCount: 0,
      roleCount: 0,
      isBuiltin: false,
      isEnabled: true,
    },
  ];

  const mockFullSkill: Skill = {
    id: 'skill-1',
    name: 'skill-1',
    description: 'Test Skill 1',
    category: 'development' as SkillCategory,
    promptFile: '/prompts/skill-1.md',
    assignableRoles: ['developer'],
    triggers: ['code', 'review'],
    tags: ['development'],
    version: '1.0.0',
    isBuiltin: true,
    isEnabled: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(skillsService.getSkills).mockResolvedValue(mockSkillSummaries);
  });

  describe('initial fetch', () => {
    it('should fetch skills on mount', async () => {
      const { result } = renderHook(() => useSkills());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.skills).toEqual(mockSkillSummaries);
      expect(skillsService.getSkills).toHaveBeenCalledTimes(1);
    });

    it('should not fetch on mount when fetchOnMount is false', async () => {
      const { result } = renderHook(() => useSkills({ fetchOnMount: false }));

      expect(result.current.loading).toBe(false);
      expect(result.current.skills).toEqual([]);
      expect(skillsService.getSkills).not.toHaveBeenCalled();
    });
  });

  describe('filtering', () => {
    it('should filter by category', async () => {
      const { result } = renderHook(() =>
        useSkills({ category: 'development' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(skillsService.getSkills).toHaveBeenCalledWith({
        category: 'development',
        roleId: undefined,
        search: undefined,
      });
    });

    it('should filter by roleId', async () => {
      const { result } = renderHook(() => useSkills({ roleId: 'developer' }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(skillsService.getSkills).toHaveBeenCalledWith({
        category: undefined,
        roleId: 'developer',
        search: undefined,
      });
    });

    it('should filter by search query', async () => {
      const { result } = renderHook(() => useSkills({ search: 'test' }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(skillsService.getSkills).toHaveBeenCalledWith({
        category: undefined,
        roleId: undefined,
        search: 'test',
      });
    });
  });

  describe('error handling', () => {
    it('should handle fetch error', async () => {
      vi.mocked(skillsService.getSkills).mockRejectedValue(
        new Error('API Error')
      );

      const { result } = renderHook(() => useSkills());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('API Error');
      expect(result.current.skills).toEqual([]);
    });
  });

  describe('selectSkill', () => {
    it('should select a skill and load full details', async () => {
      vi.mocked(skillsService.getSkillById).mockResolvedValue(mockFullSkill);

      const { result } = renderHook(() => useSkills());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.selectSkill('skill-1');
      });

      expect(result.current.selectedSkill).toEqual(mockFullSkill);
      expect(skillsService.getSkillById).toHaveBeenCalledWith('skill-1');
    });

    it('should handle selectSkill error', async () => {
      vi.mocked(skillsService.getSkillById).mockRejectedValue(
        new Error('Not found')
      );

      const { result } = renderHook(() => useSkills());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.selectSkill('missing');
      });

      expect(result.current.error).toBe('Not found');
      expect(result.current.selectedSkill).toBeNull();
    });
  });

  describe('clearSelection', () => {
    it('should clear selected skill', async () => {
      vi.mocked(skillsService.getSkillById).mockResolvedValue(mockFullSkill);

      const { result } = renderHook(() => useSkills());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.selectSkill('skill-1');
      });

      expect(result.current.selectedSkill).not.toBeNull();

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedSkill).toBeNull();
    });
  });

  describe('refresh', () => {
    it('should refresh skills list', async () => {
      const { result } = renderHook(() => useSkills());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(skillsService.getSkills).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.refresh();
      });

      expect(skillsService.getSkills).toHaveBeenCalledTimes(2);
    });
  });

  describe('create', () => {
    it('should create a skill and refresh list', async () => {
      const newSkillInput = {
        name: 'new-skill',
        description: 'New skill',
        category: 'development' as SkillCategory,
        promptContent: 'Test prompt',
      };
      const createdSkill = { ...mockFullSkill, id: 'skill-3', ...newSkillInput };
      vi.mocked(skillsService.createSkill).mockResolvedValue(createdSkill);

      const { result } = renderHook(() => useSkills());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let created: Skill | undefined;
      await act(async () => {
        created = await result.current.create(newSkillInput);
      });

      expect(created).toEqual(createdSkill);
      expect(skillsService.createSkill).toHaveBeenCalledWith(newSkillInput);
      expect(skillsService.getSkills).toHaveBeenCalledTimes(2); // Initial + refresh
    });
  });

  describe('update', () => {
    it('should update a skill and refresh list', async () => {
      const updates = { description: 'Updated description' };
      const updatedSkill = { ...mockFullSkill, ...updates };
      vi.mocked(skillsService.updateSkill).mockResolvedValue(updatedSkill);

      const { result } = renderHook(() => useSkills());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.update('skill-1', updates);
      });

      expect(skillsService.updateSkill).toHaveBeenCalledWith('skill-1', updates);
      expect(skillsService.getSkills).toHaveBeenCalledTimes(2);
    });

    it('should update selectedSkill if it was the one updated', async () => {
      vi.mocked(skillsService.getSkillById).mockResolvedValue(mockFullSkill);

      const updates = { description: 'Updated description' };
      const updatedSkill = { ...mockFullSkill, ...updates };
      vi.mocked(skillsService.updateSkill).mockResolvedValue(updatedSkill);

      const { result } = renderHook(() => useSkills());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Select the skill first
      await act(async () => {
        await result.current.selectSkill('skill-1');
      });

      expect(result.current.selectedSkill?.id).toBe('skill-1');

      // Update it
      await act(async () => {
        await result.current.update('skill-1', updates);
      });

      expect(result.current.selectedSkill).toEqual(updatedSkill);
    });
  });

  describe('remove', () => {
    it('should delete a skill and refresh list', async () => {
      vi.mocked(skillsService.deleteSkill).mockResolvedValue(undefined);

      const { result } = renderHook(() => useSkills());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.remove('skill-1');
      });

      expect(skillsService.deleteSkill).toHaveBeenCalledWith('skill-1');
      expect(skillsService.getSkills).toHaveBeenCalledTimes(2);
    });

    it('should clear selectedSkill if it was the one deleted', async () => {
      vi.mocked(skillsService.getSkillById).mockResolvedValue(mockFullSkill);
      vi.mocked(skillsService.deleteSkill).mockResolvedValue(undefined);

      const { result } = renderHook(() => useSkills());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Select the skill first
      await act(async () => {
        await result.current.selectSkill('skill-1');
      });

      expect(result.current.selectedSkill?.id).toBe('skill-1');

      // Delete it
      await act(async () => {
        await result.current.remove('skill-1');
      });

      expect(result.current.selectedSkill).toBeNull();
    });
  });

  describe('execute', () => {
    it('should execute a skill with context', async () => {
      const mockResult = { success: true, output: 'Done' };
      vi.mocked(skillsService.executeSkill).mockResolvedValue(mockResult);

      const { result } = renderHook(() => useSkills());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const context = { input: 'test' };
      let execResult: skillsService.SkillExecutionResult | undefined;

      await act(async () => {
        execResult = await result.current.execute('skill-1', context);
      });

      expect(execResult).toEqual(mockResult);
      expect(skillsService.executeSkill).toHaveBeenCalledWith('skill-1', context);
    });

    it('should execute a skill without context', async () => {
      const mockResult = { success: true };
      vi.mocked(skillsService.executeSkill).mockResolvedValue(mockResult);

      const { result } = renderHook(() => useSkills());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.execute('skill-1');
      });

      expect(skillsService.executeSkill).toHaveBeenCalledWith('skill-1', undefined);
    });
  });
});
