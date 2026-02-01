# Task 59: useSkills Real API Integration

## Overview

Update the `useSkills` hook to use the skills service instead of mock data.

## Problem

The `useSkills` hook currently returns hardcoded mock data instead of fetching from the backend API.

## Current State

```typescript
// frontend/src/hooks/useSkills.ts

// Placeholder mock data until Skills API is implemented
const mockSkills: SkillSummary[] = [
  { id: 'file-operations', name: 'file-operations', displayName: 'File Operations', ... },
  { id: 'github-integration', name: 'github-integration', ... },
  // ... hardcoded data
];

export function useSkills(options?: UseSkillsOptions): UseSkillsResult {
  // Returns mock data instead of real API data
  return {
    skills: mockSkills,
    loading: false,
    error: null,
    // ...
  };
}
```

## Implementation

### Update useSkills Hook

**`frontend/src/hooks/useSkills.ts`**

```typescript
/**
 * useSkills Hook
 *
 * React hook for managing skills data with real API integration.
 *
 * @module hooks/useSkills
 */

import { useState, useEffect, useCallback } from 'react';
import type { SkillSummary, Skill, SkillCategory } from '../types/skill.types.js';
import {
  getSkills,
  getSkillById,
  createSkill,
  updateSkill,
  deleteSkill,
  executeSkill,
} from '../services/skills.service.js';

/**
 * Options for the useSkills hook
 */
export interface UseSkillsOptions {
  /** Filter by category */
  category?: SkillCategory;
  /** Filter by role ID */
  roleId?: string;
  /** Search query */
  search?: string;
  /** Whether to fetch immediately on mount */
  fetchOnMount?: boolean;
}

/**
 * Result returned by the useSkills hook
 */
export interface UseSkillsResult {
  /** List of skills */
  skills: SkillSummary[];
  /** Currently selected skill (full details) */
  selectedSkill: Skill | null;
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh the skills list */
  refresh: () => Promise<void>;
  /** Select a skill and load full details */
  selectSkill: (id: string) => Promise<void>;
  /** Clear selected skill */
  clearSelection: () => void;
  /** Create a new skill */
  create: (skill: Partial<Skill>) => Promise<Skill>;
  /** Update an existing skill */
  update: (id: string, updates: Partial<Skill>) => Promise<Skill>;
  /** Delete a skill */
  remove: (id: string) => Promise<void>;
  /** Execute a skill */
  execute: (id: string, context?: Record<string, unknown>) => Promise<{
    success: boolean;
    output?: string;
    error?: string;
  }>;
}

/**
 * Hook for managing skills data
 *
 * Fetches skills from the backend API with optional filtering,
 * and provides CRUD operations.
 *
 * @param options - Configuration options
 * @returns Skills data and operations
 *
 * @example
 * ```tsx
 * const { skills, loading, refresh } = useSkills({ category: 'development' });
 * ```
 */
export function useSkills(options: UseSkillsOptions = {}): UseSkillsResult {
  const { category, roleId, search, fetchOnMount = true } = options;

  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState<boolean>(fetchOnMount);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch skills from API
   */
  const fetchSkills = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const data = await getSkills({ category, roleId, search });
      setSkills(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load skills';
      setError(message);
      console.error('useSkills: Failed to fetch skills:', err);
    } finally {
      setLoading(false);
    }
  }, [category, roleId, search]);

  /**
   * Load full skill details
   */
  const selectSkill = useCallback(async (id: string): Promise<void> => {
    try {
      const skill = await getSkillById(id);
      setSelectedSkill(skill);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load skill';
      setError(message);
      console.error('useSkills: Failed to select skill:', err);
    }
  }, []);

  /**
   * Clear selected skill
   */
  const clearSelection = useCallback((): void => {
    setSelectedSkill(null);
  }, []);

  /**
   * Create a new skill
   */
  const create = useCallback(async (skill: Partial<Skill>): Promise<Skill> => {
    const created = await createSkill(skill as never);
    await fetchSkills(); // Refresh list
    return created;
  }, [fetchSkills]);

  /**
   * Update an existing skill
   */
  const update = useCallback(async (id: string, updates: Partial<Skill>): Promise<Skill> => {
    const updated = await updateSkill(id, updates as never);
    await fetchSkills(); // Refresh list
    if (selectedSkill?.id === id) {
      setSelectedSkill(updated);
    }
    return updated;
  }, [fetchSkills, selectedSkill?.id]);

  /**
   * Delete a skill
   */
  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteSkill(id);
    await fetchSkills(); // Refresh list
    if (selectedSkill?.id === id) {
      setSelectedSkill(null);
    }
  }, [fetchSkills, selectedSkill?.id]);

  /**
   * Execute a skill
   */
  const execute = useCallback(async (
    id: string,
    context?: Record<string, unknown>
  ): Promise<{ success: boolean; output?: string; error?: string }> => {
    return executeSkill(id, context);
  }, []);

  // Fetch on mount if enabled
  useEffect(() => {
    if (fetchOnMount) {
      fetchSkills();
    }
  }, [fetchOnMount, fetchSkills]);

  return {
    skills,
    selectedSkill,
    loading,
    error,
    refresh: fetchSkills,
    selectSkill,
    clearSelection,
    create,
    update,
    remove,
    execute,
  };
}

export default useSkills;
```

### Update Test File

**`frontend/src/hooks/useSkills.test.ts`**

```typescript
/**
 * useSkills Hook Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSkills } from './useSkills.js';
import * as skillsService from '../services/skills.service.js';

vi.mock('../services/skills.service.js');

describe('useSkills', () => {
  const mockSkills = [
    { id: 'skill-1', name: 'skill-1', displayName: 'Skill 1', category: 'development' },
    { id: 'skill-2', name: 'skill-2', displayName: 'Skill 2', category: 'design' },
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
      roleId: undefined,
      search: undefined,
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
    const fullSkill = { ...mockSkills[0], promptFile: '/path/to/prompt.md' };
    vi.mocked(skillsService.getSkillById).mockResolvedValue(fullSkill);

    const { result } = renderHook(() => useSkills());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.selectSkill('skill-1');
    });

    expect(result.current.selectedSkill).toEqual(fullSkill);
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
    const newSkill = { name: 'new-skill', description: 'Test' };
    const createdSkill = { id: 'skill-3', ...newSkill };
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
});
```

## Files to Modify

| File | Action |
|------|--------|
| `frontend/src/hooks/useSkills.ts` | Replace mock data with API calls |
| `frontend/src/hooks/useSkills.test.ts` | Update tests for real API |

## Acceptance Criteria

- [ ] useSkills fetches from `/api/skills` on mount
- [ ] Filter options (category, roleId, search) are passed to API
- [ ] Loading state is properly managed
- [ ] Error handling displays meaningful messages
- [ ] CRUD operations work through the hook
- [ ] Skill execution works through the hook
- [ ] All tests pass with mocked service
- [ ] No more mock data in production code

## Dependencies

- Task 58: Frontend Skills Service

## Priority

**High** - Required for SkillsTab to display real data
