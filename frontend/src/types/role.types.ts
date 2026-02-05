/**
 * Frontend Role Types
 *
 * Type definitions for role management in AgentMux.
 * These types mirror the backend role types.
 *
 * @module types/role.types
 */

/**
 * Role category types
 */
export type RoleCategory = 'development' | 'management' | 'quality' | 'design' | 'sales' | 'support' | 'automation';

/**
 * Available role categories
 */
export const ROLE_CATEGORIES: RoleCategory[] = [
  'development',
  'management',
  'quality',
  'design',
  'sales',
  'support',
  'automation',
];

/**
 * Role category display names
 */
export const ROLE_CATEGORY_DISPLAY_NAMES: Record<RoleCategory, string> = {
  development: 'Development',
  management: 'Management',
  quality: 'Quality',
  design: 'Design',
  sales: 'Sales',
  support: 'Support',
  automation: 'Automation',
};

/**
 * Role category icons
 */
export const ROLE_CATEGORY_ICONS: Record<RoleCategory, string> = {
  development: '💻',
  management: '📋',
  quality: '✅',
  design: '🎨',
  sales: '💼',
  support: '🎧',
  automation: '🤖',
};

/**
 * Full role object
 */
export interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: RoleCategory;
  systemPromptFile: string;
  assignedSkills: string[];
  isDefault: boolean;
  isHidden: boolean;
  isBuiltin: boolean;
  hasOverride?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Role with prompt content
 */
export interface RoleWithPrompt extends Role {
  systemPromptContent: string;
}

/**
 * Summary of a role for list display
 */
export interface RoleSummary {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: RoleCategory;
  skillCount: number;
  isDefault: boolean;
  isHidden: boolean;
  isBuiltin: boolean;
  hasOverride?: boolean;
}

/**
 * Input for creating a new role
 */
export interface CreateRoleInput {
  name: string;
  displayName: string;
  description: string;
  category: RoleCategory;
  systemPromptContent: string;
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
 * Check if a value is a valid role category
 *
 * @param value - Value to check
 * @returns True if valid category
 */
export function isValidRoleCategory(value: string): value is RoleCategory {
  return ROLE_CATEGORIES.includes(value as RoleCategory);
}

/**
 * Get display name for a role category
 *
 * @param category - Role category
 * @returns Display name for the category
 */
export function getRoleCategoryDisplayName(category: RoleCategory): string {
  return ROLE_CATEGORY_DISPLAY_NAMES[category] || category;
}

/**
 * Get icon for a role category
 *
 * @param category - Role category
 * @returns Icon emoji for the category
 */
export function getRoleCategoryIcon(category: RoleCategory): string {
  return ROLE_CATEGORY_ICONS[category] || '👤';
}
