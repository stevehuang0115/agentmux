/**
 * useSkills Hook
 *
 * React hook for managing skills with real API integration.
 * Provides CRUD operations and skill execution functionality.
 *
 * @module hooks/useSkills
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getSkills,
  getSkillById,
  createSkill,
  updateSkill,
  deleteSkill,
  executeSkill,
  refreshSkillsFromDisk,
  type SkillWithPrompt,
  type CreateSkillInput,
  type UpdateSkillInput,
  type SkillFilterOptions,
  type SkillExecutionResult,
} from '../services/skills.service';
import type { SkillSummary, SkillCategory } from '../types/skill.types';

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
  /** List of skills */
  skills: SkillSummary[];
  /** Currently selected skill (full details) */
  selectedSkill: SkillWithPrompt | null;
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
  create: (skill: CreateSkillInput) => Promise<SkillWithPrompt>;
  /** Update an existing skill */
  update: (id: string, updates: UpdateSkillInput) => Promise<SkillWithPrompt>;
  /** Delete a skill */
  remove: (id: string) => Promise<void>;
  /** Execute a skill */
  execute: (id: string, context?: Record<string, unknown>) => Promise<SkillExecutionResult>;
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
 *
 * return (
 *   <ul>
 *     {skills.map(skill => (
 *       <li key={skill.id}>{skill.displayName}</li>
 *     ))}
 *   </ul>
 * );
 * ```
 */
export function useSkills(options: UseSkillsOptions = {}): UseSkillsResult {
  const { category, roleId, search, fetchOnMount = true } = options;

  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<SkillWithPrompt | null>(null);
  const [loading, setLoading] = useState<boolean>(fetchOnMount);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch skills from API
   *
   * @param reloadFromDisk - If true, tells backend to reload skills from filesystem first
   */
  const fetchSkills = useCallback(async (reloadFromDisk = false): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // If reloadFromDisk is true, tell the backend to rescan the skills directories
      if (reloadFromDisk) {
        await refreshSkillsFromDisk();
      }

      const filterOptions: SkillFilterOptions = {};
      if (category) filterOptions.category = category;
      if (roleId) filterOptions.roleId = roleId;
      if (search) filterOptions.search = search;

      const data = await getSkills(filterOptions);
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
  const create = useCallback(
    async (skill: CreateSkillInput): Promise<SkillWithPrompt> => {
      const created = await createSkill(skill);
      await fetchSkills(); // Refresh list
      return created;
    },
    [fetchSkills]
  );

  /**
   * Update an existing skill
   */
  const update = useCallback(
    async (id: string, updates: UpdateSkillInput): Promise<SkillWithPrompt> => {
      const updated = await updateSkill(id, updates);
      await fetchSkills(); // Refresh list
      if (selectedSkill?.id === id) {
        setSelectedSkill(updated);
      }
      return updated;
    },
    [fetchSkills, selectedSkill?.id]
  );

  /**
   * Delete a skill
   */
  const remove = useCallback(
    async (id: string): Promise<void> => {
      await deleteSkill(id);
      await fetchSkills(); // Refresh list
      if (selectedSkill?.id === id) {
        setSelectedSkill(null);
      }
    },
    [fetchSkills, selectedSkill?.id]
  );

  /**
   * Execute a skill
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

  /**
   * Refresh skills from disk - reloads all skills from the filesystem
   */
  const refreshFromDisk = useCallback(async (): Promise<void> => {
    await fetchSkills(true);
  }, [fetchSkills]);

  // Fetch on mount if enabled
  useEffect(() => {
    if (fetchOnMount) {
      fetchSkills(false);
    }
  }, [fetchOnMount, fetchSkills]);

  return {
    skills,
    selectedSkill,
    loading,
    error,
    refresh: refreshFromDisk, // Now refreshes from disk by default
    selectSkill,
    clearSelection,
    create,
    update,
    remove,
    execute,
  };
}

export default useSkills;
