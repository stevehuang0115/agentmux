# Task: Create Role Type Definitions

## Overview

Create TypeScript type definitions for the Role system that will power the Settings page role management functionality. Roles define agent personas with default prompts and assigned skills.

## Priority

**Sprint 1** - Foundation (Settings + Roles)

## Dependencies

- None (this is a foundational task)

## Files to Create

### 1. `backend/src/types/role.types.ts`

```typescript
/**
 * Role category for grouping and filtering roles
 */
export type RoleCategory =
  | 'development'
  | 'management'
  | 'quality'
  | 'design'
  | 'sales'
  | 'support';

/**
 * Role definition for AI agent personas
 * Roles define the default behavior, prompts, and available skills for agents
 */
export interface Role {
  /** Unique identifier for the role */
  id: string;

  /** Internal name used for file references (e.g., "developer", "product-manager") */
  name: string;

  /** Human-readable display name (e.g., "Developer", "Product Manager") */
  displayName: string;

  /** Description of the role's purpose and capabilities */
  description: string;

  /** Category for grouping similar roles */
  category: RoleCategory;

  /** Path to the .md file containing the system prompt */
  systemPromptFile: string;

  /** Array of Skill IDs that this role can use */
  assignedSkills: string[];

  /** Whether this is the default role for new agents */
  isDefault: boolean;

  /** Whether this role is built-in (system) or user-created */
  isBuiltin: boolean;

  /** ISO timestamp of role creation */
  createdAt: string;

  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Input for creating a new role
 */
export interface CreateRoleInput {
  name: string;
  displayName: string;
  description: string;
  category: RoleCategory;
  systemPromptContent: string;  // The actual prompt content (will be saved to file)
  assignedSkills?: string[];
  isDefault?: boolean;
}

/**
 * Input for updating an existing role
 */
export interface UpdateRoleInput {
  displayName?: string;
  description?: string;
  category?: RoleCategory;
  systemPromptContent?: string;
  assignedSkills?: string[];
  isDefault?: boolean;
}

/**
 * Role with resolved prompt content (for API responses)
 */
export interface RoleWithPrompt extends Role {
  /** The actual content of the system prompt file */
  systemPromptContent: string;
}

/**
 * Role summary for list views (without full prompt content)
 */
export interface RoleSummary {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: RoleCategory;
  skillCount: number;
  isDefault: boolean;
  isBuiltin: boolean;
}

/**
 * Role filter options for querying roles
 */
export interface RoleFilter {
  category?: RoleCategory;
  isBuiltin?: boolean;
  hasSkill?: string;
  search?: string;
}

/**
 * Role storage format (JSON file structure)
 */
export interface RoleStorageFormat {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: RoleCategory;
  systemPromptFile: string;
  assignedSkills: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 2. `backend/src/types/role.types.test.ts`

Create comprehensive tests for:
- Type guard functions (if implemented)
- Validation utility functions
- Default value factories
- Type conversion utilities

```typescript
import { describe, it, expect } from 'vitest';
import {
  Role,
  RoleCategory,
  CreateRoleInput,
  UpdateRoleInput,
  RoleWithPrompt,
  RoleSummary,
  RoleFilter,
  isValidRoleCategory,
  createDefaultRole,
  roleToSummary,
} from './role.types.js';

describe('Role Types', () => {
  describe('RoleCategory', () => {
    it('should have all expected categories', () => {
      const categories: RoleCategory[] = [
        'development',
        'management',
        'quality',
        'design',
        'sales',
        'support',
      ];
      // Test each category is valid
    });
  });

  describe('isValidRoleCategory', () => {
    it('should return true for valid categories', () => {
      expect(isValidRoleCategory('development')).toBe(true);
      expect(isValidRoleCategory('management')).toBe(true);
    });

    it('should return false for invalid categories', () => {
      expect(isValidRoleCategory('invalid')).toBe(false);
      expect(isValidRoleCategory('')).toBe(false);
    });
  });

  describe('createDefaultRole', () => {
    it('should create a role with default values', () => {
      const role = createDefaultRole({
        name: 'test-role',
        displayName: 'Test Role',
      });

      expect(role.id).toBeDefined();
      expect(role.isBuiltin).toBe(false);
      expect(role.assignedSkills).toEqual([]);
    });
  });

  describe('roleToSummary', () => {
    it('should convert Role to RoleSummary', () => {
      const role: Role = {
        id: 'test-id',
        name: 'developer',
        displayName: 'Developer',
        description: 'A software developer',
        category: 'development',
        systemPromptFile: '/path/to/prompt.md',
        assignedSkills: ['skill-1', 'skill-2'],
        isDefault: false,
        isBuiltin: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const summary = roleToSummary(role);

      expect(summary.skillCount).toBe(2);
      expect(summary).not.toHaveProperty('systemPromptFile');
      expect(summary).not.toHaveProperty('createdAt');
    });
  });
});
```

## Utility Functions to Include

Add these utility functions to the types file:

```typescript
/**
 * Type guard to check if a string is a valid RoleCategory
 */
export function isValidRoleCategory(value: string): value is RoleCategory {
  return ['development', 'management', 'quality', 'design', 'sales', 'support'].includes(value);
}

/**
 * Create a new Role with default values
 */
export function createDefaultRole(
  input: Pick<Role, 'name' | 'displayName'> & Partial<Role>
): Role {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: input.name,
    displayName: input.displayName,
    description: input.description ?? '',
    category: input.category ?? 'development',
    systemPromptFile: input.systemPromptFile ?? '',
    assignedSkills: input.assignedSkills ?? [],
    isDefault: input.isDefault ?? false,
    isBuiltin: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Convert a Role to a RoleSummary (for list views)
 */
export function roleToSummary(role: Role): RoleSummary {
  return {
    id: role.id,
    name: role.name,
    displayName: role.displayName,
    description: role.description,
    category: role.category,
    skillCount: role.assignedSkills.length,
    isDefault: role.isDefault,
    isBuiltin: role.isBuiltin,
  };
}

/**
 * Validate CreateRoleInput
 */
export function validateCreateRoleInput(input: CreateRoleInput): string[] {
  const errors: string[] = [];

  if (!input.name || input.name.trim().length === 0) {
    errors.push('Name is required');
  }

  if (!input.displayName || input.displayName.trim().length === 0) {
    errors.push('Display name is required');
  }

  if (!isValidRoleCategory(input.category)) {
    errors.push('Invalid category');
  }

  if (!input.systemPromptContent || input.systemPromptContent.trim().length === 0) {
    errors.push('System prompt content is required');
  }

  return errors;
}
```

## Default Roles to Create

Create JSON files in `config/roles/`:

1. **developer.json** - Software Developer role
2. **product-manager.json** - Product Manager role
3. **qa.json** - QA Engineer role
4. **designer.json** - UI/UX Designer role
5. **sales.json** - Sales Representative role
6. **support.json** - Customer Support role

Each should have a corresponding prompt file (e.g., `developer-prompt.md`).

## Acceptance Criteria

- [ ] All type definitions are complete with JSDoc comments
- [ ] Type guard functions are implemented and tested
- [ ] Utility functions (createDefaultRole, roleToSummary, validateCreateRoleInput) are implemented
- [ ] Test file covers all utility functions with >80% coverage
- [ ] Types are exported from a central index file
- [ ] No TypeScript errors (`npm run typecheck` passes)

## Testing Requirements

1. Unit tests for all type guard functions
2. Unit tests for all utility functions
3. Test edge cases (empty strings, invalid values, etc.)
4. Test that default role creation works correctly

## Notes

- Use `crypto.randomUUID()` for ID generation (Node.js built-in)
- All dates should be ISO 8601 format strings
- Follow existing type patterns in `backend/src/types/`
- Keep types serializable (no Date objects, use strings)
