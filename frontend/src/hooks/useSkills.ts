/**
 * useSkills Hook
 *
 * React hook for managing skills data with real API integration.
 * Provides CRUD operations and skill execution.
 *
 * @module hooks/useSkills
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  SkillSummary,
  Skill,
  SkillCategory,
  CreateSkillInput,
  UpdateSkillInput,
} from '../types/skill.types';
import {
  getSkills,
  getSkillById,
  createSkill,
  updateSkill,
  deleteSkill,
  executeSkill,
  type SkillExecutionResult,
} from '../services/skills.service';

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
  /** Whether to fetch immediately on mount (default: true) */
  fetchOnMount?: boolean;
}

/**
 * Result returned by the useSkills hook
 */
export interface UseSkillsResult {
  /** List of skill summaries */
  skills: SkillSummary[];
  /** Currently selected skill (full details) */
  selectedSkill: Skill | null;
  /** Whether skills are loading */
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
  create: (skill: CreateSkillInput) => Promise<Skill>;
  /** Update an existing skill */
  update: (id: string, updates: UpdateSkillInput) => Promise<Skill>;
  /** Delete a skill */
  remove: (id: string) => Promise<void>;
  /** Execute a skill with optional context */
  execute: (id: string, context?: Record<string, unknown>) => Promise<SkillExecutionResult>;
}

/**
 * Hook for managing skills data.
 *
 * Fetches skills from the backend API with optional filtering,
 * and provides CRUD operations and skill execution.
 *
 * @param options - Configuration options
 * @returns Skills data and operations
 *
 * @example
 * ```tsx
 * // Fetch all skills
 * const { skills, loading, refresh } = useSkills();
 *
 * // Fetch skills filtered by category
 * const { skills } = useSkills({ category: 'development' });
 *
 * // Fetch skills for a specific role
 * const { skills } = useSkills({ roleId: 'frontend-developer' });
 *
 * // Create a new skill
 * const { create } = useSkills();
 * const newSkill = await create({
 *   name: 'code-review',
 *   description: 'Review code for quality',
 *   category: 'development',
 *   promptContent: '...',
 * });
 * ```
 */
export function useSkills(options: UseSkillsOptions = {}): UseSkillsResult {
  const { category, roleId, search, fetchOnMount = true } = options;

  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState<boolean>(fetchOnMount);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch skills from API with current filter options.
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
      console.error('[useSkills] Failed to fetch skills:', err);
    } finally {
      setLoading(false);
    }
  }, [category, roleId, search]);

  /**
   * Select a skill and load full details.
   *
   * @param id - Skill ID to select
   */
  const selectSkill = useCallback(async (id: string): Promise<void> => {
    try {
      const skill = await getSkillById(id);
      setSelectedSkill(skill);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load skill';
      setError(message);
      console.error('[useSkills] Failed to select skill:', err);
    }
  }, []);

  /**
   * Clear the selected skill.
   */
  const clearSelection = useCallback((): void => {
    setSelectedSkill(null);
  }, []);

  /**
   * Create a new skill.
   *
   * @param skill - Skill creation data
   * @returns Created skill
   */
  const create = useCallback(
    async (skill: CreateSkillInput): Promise<Skill> => {
      const created = await createSkill(skill);
      await fetchSkills(); // Refresh list after creation
      return created;
    },
    [fetchSkills]
  );

  /**
   * Update an existing skill.
   *
   * @param id - Skill ID to update
   * @param updates - Skill update data
   * @returns Updated skill
   */
  const update = useCallback(
    async (id: string, updates: UpdateSkillInput): Promise<Skill> => {
      const updated = await updateSkill(id, updates);
      await fetchSkills(); // Refresh list after update
      if (selectedSkill?.id === id) {
        setSelectedSkill(updated);
      }
      return updated;
    },
    [fetchSkills, selectedSkill?.id]
  );

  /**
   * Delete a skill.
   *
   * @param id - Skill ID to delete
   */
  const remove = useCallback(
    async (id: string): Promise<void> => {
      await deleteSkill(id);
      await fetchSkills(); // Refresh list after deletion
      if (selectedSkill?.id === id) {
        setSelectedSkill(null);
      }
    },
    [fetchSkills, selectedSkill?.id]
  );

  /**
   * Execute a skill with optional context.
   *
   * @param id - Skill ID to execute
   * @param context - Optional execution context
   * @returns Execution result
   */
  const execute = useCallback(
    async (
      id: string,
      context?: Record<string, unknown>
    ): Promise<SkillExecutionResult> => {
      return executeSkill(id, context);
    },
    []
  );

  // Fetch skills on mount if enabled
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
