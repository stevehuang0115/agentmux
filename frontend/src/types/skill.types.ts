/**
 * Skill Types for Frontend
 *
 * Mirrors backend skill types for type-safe API interactions.
 *
 * @module types/skill
 */

/**
 * Skill category for grouping and filtering.
 * Includes both original categories and categories used by built-in skill.json files
 * (management, monitoring, memory, system, task-management, quality).
 */
export type SkillCategory =
  | 'development'
  | 'design'
  | 'communication'
  | 'research'
  | 'content-creation'
  | 'automation'
  | 'analysis'
  | 'integration'
  | 'management'
  | 'monitoring'
  | 'memory'
  | 'system'
  | 'task-management'
  | 'quality';

/**
 * Skill type - defines the nature of the skill
 * - claude-skill: Specialized domain knowledge with optional bash scripts
 * - web-page: Page-specific skills with domain knowledge and actions
 */
export type SkillType = 'claude-skill' | 'web-page';

/**
 * Type of skill execution
 */
export type SkillExecutionType =
  | 'script'
  | 'browser'
  | 'composite'
  | 'prompt-only';

/**
 * Script interpreter options
 */
export type ScriptInterpreter = 'bash' | 'python' | 'node';

/**
 * Script execution configuration
 */
export interface SkillScriptConfig {
  file: string;
  interpreter: ScriptInterpreter;
  workingDir?: string;
  timeoutMs?: number;
}

/**
 * Browser automation configuration
 */
export interface SkillBrowserConfig {
  url: string;
  instructions: string;
  actions?: string[];
}

/**
 * Composite skill configuration
 */
export interface SkillCompositeConfig {
  skillSequence: string[];
  continueOnError?: boolean;
}

/**
 * Skill execution configuration
 */
export interface SkillExecutionConfig {
  type: SkillExecutionType;
  script?: SkillScriptConfig;
  browser?: SkillBrowserConfig;
  composite?: SkillCompositeConfig;
}

/**
 * Environment configuration for skill execution
 */
export interface SkillEnvironmentConfig {
  file?: string;
  variables?: Record<string, string>;
  required?: string[];
}

/**
 * Runtime configuration for skills that modify agent startup
 */
export interface SkillRuntimeConfig {
  /** Runtime this skill is compatible with (e.g., 'claude-code') */
  runtime?: string;
  /** Additional flags to pass to the runtime (e.g., ['--chrome']) */
  flags?: string[];
}

/**
 * User notice configuration for skills
 */
export interface SkillNotice {
  /** Notice type for styling */
  type: 'info' | 'warning' | 'requirement';
  /** Notice title */
  title: string;
  /** Notice message */
  message: string;
  /** Optional link for more information */
  link?: string;
  /** Link text */
  linkText?: string;
}

/**
 * Full Skill definition
 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  skillType: SkillType;
  promptFile: string;
  execution?: SkillExecutionConfig;
  environment?: SkillEnvironmentConfig;
  runtime?: SkillRuntimeConfig;
  notices?: SkillNotice[];
  assignableRoles: string[];
  triggers: string[];
  tags: string[];
  version: string;
  isBuiltin: boolean;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Skill with resolved prompt content
 */
export interface SkillWithPrompt extends Skill {
  promptContent: string;
}

/**
 * Skill summary for list views
 */
export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  skillType: SkillType;
  executionType: SkillExecutionType;
  triggerCount: number;
  roleCount: number;
  isBuiltin: boolean;
  isEnabled: boolean;
  notices?: SkillNotice[];
  runtime?: SkillRuntimeConfig;
}

/**
 * Input for creating a new skill
 */
export interface CreateSkillInput {
  name: string;
  description: string;
  category: SkillCategory;
  skillType?: SkillType;
  promptContent: string;
  execution?: SkillExecutionConfig;
  environment?: SkillEnvironmentConfig;
  runtime?: SkillRuntimeConfig;
  notices?: SkillNotice[];
  assignableRoles?: string[];
  triggers?: string[];
  tags?: string[];
}

/**
 * Input for updating a skill
 */
export interface UpdateSkillInput {
  name?: string;
  description?: string;
  category?: SkillCategory;
  skillType?: SkillType;
  promptContent?: string;
  execution?: SkillExecutionConfig;
  environment?: SkillEnvironmentConfig;
  runtime?: SkillRuntimeConfig;
  notices?: SkillNotice[];
  assignableRoles?: string[];
  triggers?: string[];
  tags?: string[];
  isEnabled?: boolean;
}

/**
 * Filter options for querying skills
 */
export interface SkillFilter {
  category?: SkillCategory;
  executionType?: SkillExecutionType;
  roleId?: string;
  isBuiltin?: boolean;
  isEnabled?: boolean;
  search?: string;
  tags?: string[];
}

/**
 * Valid skill categories list
 */
export const SKILL_CATEGORIES: SkillCategory[] = [
  'development',
  'design',
  'communication',
  'research',
  'content-creation',
  'automation',
  'analysis',
  'integration',
  'management',
  'monitoring',
  'memory',
  'system',
  'task-management',
  'quality',
];

/**
 * Valid skill types list
 */
export const SKILL_TYPES: SkillType[] = ['claude-skill', 'web-page'];

/**
 * Valid execution types list
 */
export const EXECUTION_TYPES: SkillExecutionType[] = [
  'script',
  'browser',
  'composite',
  'prompt-only',
];

/**
 * Check if a value is a valid skill category
 *
 * @param value - String to check
 * @returns True if value is a valid SkillCategory
 */
export function isValidSkillCategory(value: string): value is SkillCategory {
  return SKILL_CATEGORIES.includes(value as SkillCategory);
}

/**
 * Check if a value is a valid skill type
 *
 * @param value - String to check
 * @returns True if value is a valid SkillType
 */
export function isValidSkillType(value: string): value is SkillType {
  return SKILL_TYPES.includes(value as SkillType);
}

/**
 * Check if a value is a valid execution type
 *
 * @param value - String to check
 * @returns True if value is a valid SkillExecutionType
 */
export function isValidExecutionType(value: string): value is SkillExecutionType {
  return EXECUTION_TYPES.includes(value as SkillExecutionType);
}

/**
 * Get display label for skill category
 *
 * @param category - Skill category
 * @returns Human-readable label
 */
export function getSkillCategoryLabel(category: SkillCategory): string {
  const labels: Record<SkillCategory, string> = {
    development: 'Development',
    design: 'Design',
    communication: 'Communication',
    research: 'Research',
    'content-creation': 'Content Creation',
    automation: 'Automation',
    analysis: 'Analysis',
    integration: 'Integration',
    management: 'Management',
    monitoring: 'Monitoring',
    memory: 'Memory',
    system: 'System',
    'task-management': 'Task Management',
    quality: 'Quality',
  };
  return labels[category] || category;
}

/**
 * Get emoji icon for skill category
 *
 * @param category - Skill category
 * @returns Emoji icon string
 */
export function getSkillCategoryIcon(category: SkillCategory): string {
  const icons: Record<SkillCategory, string> = {
    development: '\u{1F4BB}',
    design: '\u{1F3A8}',
    communication: '\u{1F4AC}',
    research: '\u{1F50D}',
    'content-creation': '\u270D\uFE0F',
    automation: '\u2699\uFE0F',
    analysis: '\u{1F4CA}',
    integration: '\u{1F517}',
    management: '\u{1F4CB}',
    monitoring: '\u{1F4E1}',
    memory: '\u{1F9E0}',
    system: '\u{1F5A5}\uFE0F',
    'task-management': '\u2611\uFE0F',
    quality: '\u2705',
  };
  return icons[category] || '\u{1F4E6}';
}

/**
 * Get display label for skill type
 *
 * @param skillType - Skill type
 * @returns Human-readable label
 */
export function getSkillTypeLabel(skillType: SkillType): string {
  const labels: Record<SkillType, string> = {
    'claude-skill': 'Claude Skill',
    'web-page': 'Web Page',
  };
  return labels[skillType] || skillType;
}

/**
 * Get display label for execution type
 *
 * @param type - Execution type
 * @returns Human-readable label
 */
export function getExecutionTypeLabel(type: SkillExecutionType): string {
  const labels: Record<SkillExecutionType, string> = {
    script: 'Script',
    browser: 'Browser Automation',
    composite: 'Composite',
    'prompt-only': 'Prompt Only',
  };
  return labels[type] || type;
}
