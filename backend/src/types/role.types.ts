/**
 * Role Type Definitions
 *
 * Types for the Role system that powers agent personas with default prompts and assigned skills.
 *
 * @module types/role.types
 */

import { randomUUID } from 'crypto';

/**
 * Role category for grouping and filtering roles
 */
export type RoleCategory =
  | 'development'
  | 'management'
  | 'quality'
  | 'design'
  | 'sales'
  | 'support'
  | 'automation';

/**
 * Array of all valid role categories
 */
export const ROLE_CATEGORIES: readonly RoleCategory[] = [
  'development',
  'management',
  'quality',
  'design',
  'sales',
  'support',
  'automation',
] as const;

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

  /** Whether this role is hidden from the UI (e.g., orchestrator) */
  isHidden: boolean;

  /** Whether this role is built-in (system) or user-created */
  isBuiltin: boolean;

  /** Whether this builtin role has a user override in ~/.agentmux/roles/ */
  hasOverride?: boolean;

  /** ISO timestamp of role creation */
  createdAt: string;

  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Input for creating a new role
 */
export interface CreateRoleInput {
  /** Internal name used for file references */
  name: string;

  /** Human-readable display name */
  displayName: string;

  /** Description of the role's purpose */
  description: string;

  /** Category for grouping */
  category: RoleCategory;

  /** The actual prompt content (will be saved to file) */
  systemPromptContent: string;

  /** Array of Skill IDs to assign (optional) */
  assignedSkills?: string[];

  /** Whether this should be the default role (optional) */
  isDefault?: boolean;
}

/**
 * Input for updating an existing role
 */
export interface UpdateRoleInput {
  /** Human-readable display name */
  displayName?: string;

  /** Description of the role's purpose */
  description?: string;

  /** Category for grouping */
  category?: RoleCategory;

  /** The actual prompt content (will be saved to file) */
  systemPromptContent?: string;

  /** Array of Skill IDs to assign */
  assignedSkills?: string[];

  /** Whether this should be the default role */
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
  /** Unique identifier */
  id: string;

  /** Internal name */
  name: string;

  /** Human-readable display name */
  displayName: string;

  /** Description of the role */
  description: string;

  /** Category for grouping */
  category: RoleCategory;

  /** Number of assigned skills */
  skillCount: number;

  /** Whether this is the default role */
  isDefault: boolean;

  /** Whether this role is hidden from UI */
  isHidden: boolean;

  /** Whether this builtin role has a user override */
  hasOverride?: boolean;

  /** Whether this is a built-in role */
  isBuiltin: boolean;
}

/**
 * Role filter options for querying roles
 */
export interface RoleFilter {
  /** Filter by category */
  category?: RoleCategory;

  /** Filter by built-in status */
  isBuiltin?: boolean;

  /** Filter by having a specific skill */
  hasSkill?: string;

  /** Search term for name/displayName/description */
  search?: string;
}

/**
 * Role storage format (JSON file structure)
 */
export interface RoleStorageFormat {
  /** Unique identifier */
  id: string;

  /** Internal name */
  name: string;

  /** Human-readable display name */
  displayName: string;

  /** Description of the role */
  description: string;

  /** Category for grouping */
  category: RoleCategory;

  /** Path to the prompt file */
  systemPromptFile: string;

  /** Array of assigned skill IDs */
  assignedSkills: string[];

  /** Whether this is the default role */
  isDefault: boolean;

  /** Whether this role is hidden from UI */
  isHidden?: boolean;

  /** ISO timestamp of creation */
  createdAt: string;

  /** ISO timestamp of last update */
  updatedAt: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Type guard to check if a string is a valid RoleCategory
 *
 * @param value - The string to check
 * @returns True if the value is a valid RoleCategory
 *
 * @example
 * ```typescript
 * if (isValidRoleCategory(input)) {
 *   // input is typed as RoleCategory
 * }
 * ```
 */
export function isValidRoleCategory(value: string): value is RoleCategory {
  return ROLE_CATEGORIES.includes(value as RoleCategory);
}

/**
 * Create a new Role with default values
 *
 * @param input - Required name and displayName, with optional overrides for other fields
 * @returns A complete Role object with generated ID and timestamps
 *
 * @example
 * ```typescript
 * const role = createDefaultRole({
 *   name: 'my-role',
 *   displayName: 'My Role',
 *   category: 'development',
 * });
 * ```
 */
export function createDefaultRole(
  input: Pick<Role, 'name' | 'displayName'> & Partial<Role>
): Role {
  const now = new Date().toISOString();
  return {
    id: input.id ?? randomUUID(),
    name: input.name,
    displayName: input.displayName,
    description: input.description ?? '',
    category: input.category ?? 'development',
    systemPromptFile: input.systemPromptFile ?? '',
    assignedSkills: input.assignedSkills ?? [],
    isDefault: input.isDefault ?? false,
    isHidden: input.isHidden ?? false,
    isBuiltin: input.isBuiltin ?? false,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}

/**
 * Convert a Role to a RoleSummary (for list views)
 *
 * Strips out detailed information like timestamps and prompt file path,
 * and replaces assignedSkills array with a count.
 *
 * @param role - The full Role object
 * @returns A RoleSummary with essential fields only
 *
 * @example
 * ```typescript
 * const roles = await roleService.getAll();
 * const summaries = roles.map(roleToSummary);
 * ```
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
    isHidden: role.isHidden,
    hasOverride: role.hasOverride,
    isBuiltin: role.isBuiltin,
  };
}

/**
 * Validate CreateRoleInput and return an array of error messages
 *
 * @param input - The CreateRoleInput to validate
 * @returns Array of error messages (empty if valid)
 *
 * @example
 * ```typescript
 * const errors = validateCreateRoleInput(input);
 * if (errors.length > 0) {
 *   throw new ValidationError(errors.join(', '));
 * }
 * ```
 */
export function validateCreateRoleInput(input: CreateRoleInput): string[] {
  const errors: string[] = [];

  if (!input.name || input.name.trim().length === 0) {
    errors.push('Name is required');
  } else if (!/^[a-z0-9-]+$/.test(input.name)) {
    errors.push('Name must contain only lowercase letters, numbers, and hyphens');
  }

  if (!input.displayName || input.displayName.trim().length === 0) {
    errors.push('Display name is required');
  }

  if (!input.description || input.description.trim().length === 0) {
    errors.push('Description is required');
  }

  if (!isValidRoleCategory(input.category)) {
    errors.push(`Invalid category: ${input.category}`);
  }

  if (!input.systemPromptContent || input.systemPromptContent.trim().length === 0) {
    errors.push('System prompt content is required');
  }

  if (input.assignedSkills && !Array.isArray(input.assignedSkills)) {
    errors.push('Assigned skills must be an array');
  }

  return errors;
}

/**
 * Validate UpdateRoleInput and return an array of error messages
 *
 * @param input - The UpdateRoleInput to validate
 * @returns Array of error messages (empty if valid)
 *
 * @example
 * ```typescript
 * const errors = validateUpdateRoleInput(input);
 * if (errors.length > 0) {
 *   throw new ValidationError(errors.join(', '));
 * }
 * ```
 */
export function validateUpdateRoleInput(input: UpdateRoleInput): string[] {
  const errors: string[] = [];

  if (input.displayName !== undefined && input.displayName.trim().length === 0) {
    errors.push('Display name cannot be empty');
  }

  if (input.category !== undefined && !isValidRoleCategory(input.category)) {
    errors.push(`Invalid category: ${input.category}`);
  }

  if (input.systemPromptContent !== undefined && input.systemPromptContent.trim().length === 0) {
    errors.push('System prompt content cannot be empty');
  }

  if (input.assignedSkills !== undefined && !Array.isArray(input.assignedSkills)) {
    errors.push('Assigned skills must be an array');
  }

  return errors;
}

/**
 * Check if a Role matches the given filter criteria
 *
 * @param role - The role to check
 * @param filter - The filter criteria
 * @returns True if the role matches all filter criteria
 *
 * @example
 * ```typescript
 * const filteredRoles = roles.filter(role => matchesRoleFilter(role, filter));
 * ```
 */
export function matchesRoleFilter(role: Role, filter: RoleFilter): boolean {
  if (filter.category !== undefined && role.category !== filter.category) {
    return false;
  }

  if (filter.isBuiltin !== undefined && role.isBuiltin !== filter.isBuiltin) {
    return false;
  }

  if (filter.hasSkill !== undefined && !role.assignedSkills.includes(filter.hasSkill)) {
    return false;
  }

  if (filter.search !== undefined && filter.search.trim().length > 0) {
    const searchLower = filter.search.toLowerCase();
    const matchesName = role.name.toLowerCase().includes(searchLower);
    const matchesDisplayName = role.displayName.toLowerCase().includes(searchLower);
    const matchesDescription = role.description.toLowerCase().includes(searchLower);

    if (!matchesName && !matchesDisplayName && !matchesDescription) {
      return false;
    }
  }

  return true;
}

/**
 * Convert a Role to RoleStorageFormat for persistence
 *
 * @param role - The role to convert
 * @returns A RoleStorageFormat object ready for JSON serialization
 */
export function roleToStorageFormat(role: Role): RoleStorageFormat {
  return {
    id: role.id,
    name: role.name,
    displayName: role.displayName,
    description: role.description,
    category: role.category,
    systemPromptFile: role.systemPromptFile,
    assignedSkills: role.assignedSkills,
    isDefault: role.isDefault,
    isHidden: role.isHidden,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

/**
 * Convert a RoleStorageFormat back to a Role
 *
 * @param stored - The stored role data
 * @param isBuiltin - Whether this role is built-in
 * @returns A complete Role object
 */
export function storageFormatToRole(stored: RoleStorageFormat, isBuiltin: boolean): Role {
  return {
    ...stored,
    isHidden: stored.isHidden ?? false,
    isBuiltin,
  };
}
