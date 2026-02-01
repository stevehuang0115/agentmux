/**
 * Skills Service
 *
 * Frontend service for skill management API calls.
 * Handles CRUD operations for skills and skill execution.
 *
 * @module services/skills
 */

import type {
  Skill,
  SkillSummary,
  SkillCategory,
  CreateSkillInput,
  UpdateSkillInput,
  SkillWithPrompt,
} from '../types/skill.types';

const API_BASE = '/api/skills';

/**
 * API response wrapper interface
 */
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

/**
 * Fetch all skills with optional filtering.
 *
 * @param options - Filter options
 * @returns Promise resolving to array of skill summaries
 * @throws Error if the API request fails
 *
 * @example
 * ```typescript
 * const skills = await getSkills({ category: 'development' });
 * ```
 */
export async function getSkills(options?: {
  category?: SkillCategory;
  roleId?: string;
  search?: string;
}): Promise<SkillSummary[]> {
  const params = new URLSearchParams();
  if (options?.category) params.set('category', options.category);
  if (options?.roleId) params.set('roleId', options.roleId);
  if (options?.search) params.set('search', options.search);

  const url = params.toString() ? `${API_BASE}?${params}` : API_BASE;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch skills: ${response.statusText}`);
  }

  const data: ApiResponse<SkillSummary[]> = await response.json();
  return data.data || [];
}

/**
 * Fetch a single skill by ID.
 *
 * @param id - Skill ID
 * @returns Promise resolving to full skill details
 * @throws Error if the skill is not found or request fails
 *
 * @example
 * ```typescript
 * const skill = await getSkillById('file-operations');
 * ```
 */
export async function getSkillById(id: string): Promise<Skill> {
  const response = await fetch(`${API_BASE}/${id}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Skill not found: ${id}`);
    }
    throw new Error(`Failed to fetch skill: ${response.statusText}`);
  }

  const data: ApiResponse<Skill> = await response.json();
  if (!data.data) {
    throw new Error('Invalid response: missing skill data');
  }
  return data.data;
}

/**
 * Fetch a skill with its resolved prompt content.
 *
 * @param id - Skill ID
 * @returns Promise resolving to skill with prompt content
 * @throws Error if the skill is not found or request fails
 */
export async function getSkillWithPrompt(id: string): Promise<SkillWithPrompt> {
  const response = await fetch(`${API_BASE}/${id}/prompt`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Skill not found: ${id}`);
    }
    throw new Error(`Failed to fetch skill prompt: ${response.statusText}`);
  }

  const data: ApiResponse<SkillWithPrompt> = await response.json();
  if (!data.data) {
    throw new Error('Invalid response: missing skill data');
  }
  return data.data;
}

/**
 * Create a new skill.
 *
 * @param skill - Skill creation data
 * @returns Promise resolving to created skill
 * @throws Error if creation fails
 *
 * @example
 * ```typescript
 * const skill = await createSkill({
 *   name: 'code-review',
 *   description: 'Review code for quality',
 *   category: 'development',
 *   promptContent: '...',
 * });
 * ```
 */
export async function createSkill(skill: CreateSkillInput): Promise<Skill> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(skill),
  });

  if (!response.ok) {
    const errorData: ApiResponse<never> = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to create skill: ${response.statusText}`);
  }

  const data: ApiResponse<Skill> = await response.json();
  if (!data.data) {
    throw new Error('Invalid response: missing created skill data');
  }
  return data.data;
}

/**
 * Update an existing skill.
 *
 * @param id - Skill ID
 * @param updates - Skill update data
 * @returns Promise resolving to updated skill
 * @throws Error if update fails
 *
 * @example
 * ```typescript
 * const skill = await updateSkill('code-review', {
 *   description: 'Updated description',
 * });
 * ```
 */
export async function updateSkill(id: string, updates: UpdateSkillInput): Promise<Skill> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const errorData: ApiResponse<never> = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to update skill: ${response.statusText}`);
  }

  const data: ApiResponse<Skill> = await response.json();
  if (!data.data) {
    throw new Error('Invalid response: missing updated skill data');
  }
  return data.data;
}

/**
 * Delete a skill.
 *
 * @param id - Skill ID
 * @returns Promise resolving when deleted
 * @throws Error if deletion fails
 */
export async function deleteSkill(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData: ApiResponse<never> = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to delete skill: ${response.statusText}`);
  }
}

/**
 * Get skills filtered by category.
 *
 * @param category - Skill category
 * @returns Promise resolving to skills in category
 */
export async function getSkillsByCategory(category: SkillCategory): Promise<SkillSummary[]> {
  return getSkills({ category });
}

/**
 * Get skills assigned to a role.
 *
 * @param roleId - Role ID
 * @returns Promise resolving to skills for role
 */
export async function getSkillsForRole(roleId: string): Promise<SkillSummary[]> {
  return getSkills({ roleId });
}

/**
 * Skill execution result
 */
export interface SkillExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  duration?: number;
}

/**
 * Execute a skill with optional context.
 *
 * @param id - Skill ID
 * @param context - Execution context
 * @returns Promise resolving to execution result
 * @throws Error if execution fails
 *
 * @example
 * ```typescript
 * const result = await executeSkill('code-review', {
 *   filePath: 'src/index.ts',
 *   userInput: 'Check for bugs',
 * });
 * ```
 */
export async function executeSkill(
  id: string,
  context?: Record<string, unknown>
): Promise<SkillExecutionResult> {
  const response = await fetch(`${API_BASE}/${id}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context }),
  });

  if (!response.ok) {
    const errorData: ApiResponse<never> = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to execute skill: ${response.statusText}`);
  }

  const data: ApiResponse<SkillExecutionResult> = await response.json();
  return data.data || { success: false, error: 'Unknown error' };
}

/**
 * Skills service object for convenience.
 * Provides a single object with all skill operations.
 */
export const skillsService = {
  getAll: getSkills,
  getById: getSkillById,
  getWithPrompt: getSkillWithPrompt,
  create: createSkill,
  update: updateSkill,
  delete: deleteSkill,
  getByCategory: getSkillsByCategory,
  getForRole: getSkillsForRole,
  execute: executeSkill,
};

export default skillsService;
