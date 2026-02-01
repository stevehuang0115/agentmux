# Task 58: Frontend Skills Service

## Overview

Create the frontend skills service to communicate with the backend `/api/skills` endpoints.

## Problem

The frontend has a `useSkills` hook that uses mock data because there's no `skills.service.ts` to make actual API calls.

## Current State

```typescript
// frontend/src/hooks/useSkills.ts
// Uses hardcoded mock data instead of API calls
const mockSkills: SkillSummary[] = [
  { id: 'file-operations', ... },
  // ... mock data
];
```

**Missing file**: `frontend/src/services/skills.service.ts`

## Implementation

### Create Skills Service

**`frontend/src/services/skills.service.ts`**

```typescript
/**
 * Skills Service
 *
 * Frontend service for skill management API calls.
 *
 * @module services/skills
 */

import type { Skill, SkillSummary, SkillCategory, CreateSkillRequest, UpdateSkillRequest } from '../types/skill.types.js';

const API_BASE = '/api/skills';

/**
 * Fetch all skills with optional filtering
 *
 * @param options - Filter options
 * @returns Promise resolving to array of skill summaries
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

  return response.json();
}

/**
 * Fetch a single skill by ID
 *
 * @param id - Skill ID
 * @returns Promise resolving to full skill details
 */
export async function getSkillById(id: string): Promise<Skill> {
  const response = await fetch(`${API_BASE}/${id}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Skill not found: ${id}`);
    }
    throw new Error(`Failed to fetch skill: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create a new skill
 *
 * @param skill - Skill creation data
 * @returns Promise resolving to created skill
 */
export async function createSkill(skill: CreateSkillRequest): Promise<Skill> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(skill),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create skill: ${error}`);
  }

  return response.json();
}

/**
 * Update an existing skill
 *
 * @param id - Skill ID
 * @param updates - Skill update data
 * @returns Promise resolving to updated skill
 */
export async function updateSkill(id: string, updates: UpdateSkillRequest): Promise<Skill> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update skill: ${error}`);
  }

  return response.json();
}

/**
 * Delete a skill
 *
 * @param id - Skill ID
 * @returns Promise resolving when deleted
 */
export async function deleteSkill(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete skill: ${response.statusText}`);
  }
}

/**
 * Get skills by category
 *
 * @param category - Skill category
 * @returns Promise resolving to skills in category
 */
export async function getSkillsByCategory(category: SkillCategory): Promise<SkillSummary[]> {
  return getSkills({ category });
}

/**
 * Get skills assigned to a role
 *
 * @param roleId - Role ID
 * @returns Promise resolving to skills for role
 */
export async function getSkillsForRole(roleId: string): Promise<SkillSummary[]> {
  return getSkills({ roleId });
}

/**
 * Execute a skill
 *
 * @param id - Skill ID
 * @param context - Execution context
 * @returns Promise resolving to execution result
 */
export async function executeSkill(id: string, context?: Record<string, unknown>): Promise<{
  success: boolean;
  output?: string;
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/${id}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to execute skill: ${error}`);
  }

  return response.json();
}

/**
 * Skills service object for convenience
 */
export const skillsService = {
  getAll: getSkills,
  getById: getSkillById,
  create: createSkill,
  update: updateSkill,
  delete: deleteSkill,
  getByCategory: getSkillsByCategory,
  getForRole: getSkillsForRole,
  execute: executeSkill,
};

export default skillsService;
```

### Create Test File

**`frontend/src/services/skills.service.test.ts`**

```typescript
/**
 * Skills Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSkills,
  getSkillById,
  createSkill,
  updateSkill,
  deleteSkill,
  executeSkill,
} from './skills.service.js';

describe('skills.service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getSkills', () => {
    it('should fetch all skills', async () => {
      const mockSkills = [{ id: '1', name: 'test-skill' }];
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSkills),
      });

      const result = await getSkills();

      expect(fetch).toHaveBeenCalledWith('/api/skills');
      expect(result).toEqual(mockSkills);
    });

    it('should include query params when provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await getSkills({ category: 'development', search: 'test' });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('category=development')
      );
    });

    it('should throw on error response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Server Error',
      });

      await expect(getSkills()).rejects.toThrow('Failed to fetch skills');
    });
  });

  describe('getSkillById', () => {
    it('should fetch skill by id', async () => {
      const mockSkill = { id: 'skill-1', name: 'Test Skill' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSkill),
      });

      const result = await getSkillById('skill-1');

      expect(fetch).toHaveBeenCalledWith('/api/skills/skill-1');
      expect(result).toEqual(mockSkill);
    });

    it('should throw on 404', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(getSkillById('missing')).rejects.toThrow('Skill not found');
    });
  });

  describe('createSkill', () => {
    it('should create a new skill', async () => {
      const newSkill = { name: 'new-skill', description: 'Test' };
      const createdSkill = { id: 'skill-1', ...newSkill };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createdSkill),
      });

      const result = await createSkill(newSkill);

      expect(fetch).toHaveBeenCalledWith('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSkill),
      });
      expect(result).toEqual(createdSkill);
    });
  });

  describe('executeSkill', () => {
    it('should execute skill with context', async () => {
      const mockResult = { success: true, output: 'Done' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResult),
      });

      const result = await executeSkill('skill-1', { input: 'test' });

      expect(fetch).toHaveBeenCalledWith('/api/skills/skill-1/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: { input: 'test' } }),
      });
      expect(result).toEqual(mockResult);
    });
  });
});
```

## Files to Create

| File | Action |
|------|--------|
| `frontend/src/services/skills.service.ts` | Create |
| `frontend/src/services/skills.service.test.ts` | Create |

## Update Services Index

**`frontend/src/services/index.ts`** (if exists)

```typescript
export * from './skills.service.js';
export * from './chat.service.js';
export * from './roles.service.js';
export * from './settings.service.js';
```

## Acceptance Criteria

- [ ] Skills service created with all CRUD operations
- [ ] Service includes skill execution function
- [ ] All functions have proper TypeScript types
- [ ] Error handling for all API calls
- [ ] Test file with comprehensive coverage
- [ ] JSDoc comments on all functions

## Dependencies

- Task 29: Skill Service (backend)
- Task 42: Skill Controller (backend)
- Task 39: Frontend Skill Types

## Priority

**High** - Required for useSkills hook to work properly
