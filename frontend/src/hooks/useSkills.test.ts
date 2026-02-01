/**
 * useSkills Hook Tests
 *
 * Tests for the useSkills hook with real API integration.
 *
 * @module hooks/useSkills.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSkills } from './useSkills';
import * as skillsService from '../services/skills.service';

vi.mock('../services/skills.service');

describe('useSkills', () => {
  const mockSkills = [
    {
      id: 'skill-1',
      name: 'skill-1',
      displayName: 'Skill 1',
      description: 'Test skill',
      category: 'development',
      isEnabled: true,
      isBuiltin: true,
    },
    {
      id: 'skill-2',
      name: 'skill-2',
      displayName: 'Skill 2',
      description: 'Another skill',
      category: 'design',
      isEnabled: true,
      isBuiltin: false,
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(skillsService.getSkills).mockResolvedValue(mockSkills);
  });

  it('should fetch skills on mount', async () => {
    const { result } = renderHook(() => useSkills());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.skills).toEqual(mockSkills);
    expect(skillsService.getSkills).toHaveBeenCalledTimes(1);
  });

  it('should not fetch on mount when fetchOnMount is false', async () => {
    const { result } = renderHook(() => useSkills({ fetchOnMount: false }));

    expect(result.current.loading).toBe(false);
    expect(result.current.skills).toEqual([]);
    expect(skillsService.getSkills).not.toHaveBeenCalled();
  });

  it('should filter by category', async () => {
    const { result } = renderHook(() => useSkills({ category: 'development' }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(skillsService.getSkills).toHaveBeenCalledWith({
      category: 'development',
    });
  });

  it('should filter by roleId', async () => {
    const { result } = renderHook(() => useSkills({ roleId: 'developer' }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(skillsService.getSkills).toHaveBeenCalledWith({
      roleId: 'developer',
    });
  });

  it('should filter by search', async () => {
    const { result } = renderHook(() => useSkills({ search: 'test' }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(skillsService.getSkills).toHaveBeenCalledWith({
      search: 'test',
    });
  });

  it('should handle fetch error', async () => {
    vi.mocked(skillsService.getSkills).mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useSkills());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('API Error');
    expect(result.current.skills).toEqual([]);
  });

  it('should select a skill and load details', async () => {
    const fullSkill = {
      ...mockSkills[0],
      promptContent: 'Test prompt content',
    };
    vi.mocked(skillsService.getSkillById).mockResolvedValue(fullSkill);

    const { result } = renderHook(() => useSkills());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.selectSkill('skill-1');
    });

    expect(result.current.selectedSkill).toEqual(fullSkill);
    expect(skillsService.getSkillById).toHaveBeenCalledWith('skill-1');
  });

  it('should clear selection', async () => {
    const fullSkill = { ...mockSkills[0], promptContent: 'Test' };
    vi.mocked(skillsService.getSkillById).mockResolvedValue(fullSkill);

    const { result } = renderHook(() => useSkills());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.selectSkill('skill-1');
    });

    expect(result.current.selectedSkill).toBeTruthy();

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedSkill).toBeNull();
  });

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

  it('should create a skill and refresh list', async () => {
    const newSkill = {
      name: 'new-skill',
      displayName: 'New Skill',
      description: 'Test',
      category: 'development' as const,
    };
    const createdSkill = { id: 'skill-3', ...newSkill, isEnabled: true, isBuiltin: false };
    vi.mocked(skillsService.createSkill).mockResolvedValue(createdSkill);

    const { result } = renderHook(() => useSkills());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.create(newSkill);
    });

    expect(skillsService.createSkill).toHaveBeenCalledWith(newSkill);
    expect(skillsService.getSkills).toHaveBeenCalledTimes(2); // Initial + refresh
  });

  it('should update a skill and refresh list', async () => {
    const updates = { displayName: 'Updated Skill' };
    const updatedSkill = { ...mockSkills[0], ...updates };
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

  it('should execute a skill', async () => {
    const mockResult = { success: true, output: 'Done' };
    vi.mocked(skillsService.executeSkill).mockResolvedValue(mockResult);

    const { result } = renderHook(() => useSkills());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const execResult = await result.current.execute('skill-1', { input: 'test' });

    expect(execResult).toEqual(mockResult);
    expect(skillsService.executeSkill).toHaveBeenCalledWith('skill-1', { input: 'test' });
  });

  it('should clear selected skill when deleting selected', async () => {
    const fullSkill = { ...mockSkills[0], promptContent: 'Test' };
    vi.mocked(skillsService.getSkillById).mockResolvedValue(fullSkill);
    vi.mocked(skillsService.deleteSkill).mockResolvedValue(undefined);

    const { result } = renderHook(() => useSkills());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.selectSkill('skill-1');
    });

    expect(result.current.selectedSkill?.id).toBe('skill-1');

    await act(async () => {
      await result.current.remove('skill-1');
    });

    expect(result.current.selectedSkill).toBeNull();
  });
});
