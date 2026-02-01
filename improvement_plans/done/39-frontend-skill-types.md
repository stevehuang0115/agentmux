# Task: Create Frontend Skill Types

## Overview

Create the skill types file for the frontend that mirrors the backend skill types. Role, settings, and chat types exist in the frontend, but skill types are missing.

## Priority

**Medium** - Required for Skills tab and skill-related features

## Dependencies

- `28-skill-types.md` - Backend skill types to mirror

## Gap Identified

The following frontend type files exist:
- `frontend/src/types/role.types.ts` ✓
- `frontend/src/types/settings.types.ts` ✓
- `frontend/src/types/chat.types.ts` ✓
- `frontend/src/types/skill.types.ts` ✗ **MISSING**

## Files to Create

### 1. Create `frontend/src/types/skill.types.ts`

```typescript
/**
 * Skill Types for Frontend
 *
 * Mirrors backend skill types for type-safe API interactions.
 *
 * @module types/skill
 */

/**
 * Skill category for grouping and filtering
 */
export type SkillCategory =
  | 'development'
  | 'design'
  | 'communication'
  | 'research'
  | 'content-creation'
  | 'automation'
  | 'analysis'
  | 'integration';

/**
 * Type of skill execution
 */
export type SkillExecutionType =
  | 'script'
  | 'browser'
  | 'mcp-tool'
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
 * MCP tool invocation configuration
 */
export interface SkillMcpToolConfig {
  toolName: string;
  defaultParams?: Record<string, unknown>;
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
  mcpTool?: SkillMcpToolConfig;
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
 * Full Skill definition
 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  promptFile: string;
  execution?: SkillExecutionConfig;
  environment?: SkillEnvironmentConfig;
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
  executionType: SkillExecutionType;
  triggerCount: number;
  roleCount: number;
  isBuiltin: boolean;
  isEnabled: boolean;
}

/**
 * Input for creating a new skill
 */
export interface CreateSkillInput {
  name: string;
  description: string;
  category: SkillCategory;
  promptContent: string;
  execution?: SkillExecutionConfig;
  environment?: SkillEnvironmentConfig;
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
  promptContent?: string;
  execution?: SkillExecutionConfig;
  environment?: SkillEnvironmentConfig;
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
];

/**
 * Valid execution types list
 */
export const EXECUTION_TYPES: SkillExecutionType[] = [
  'script',
  'browser',
  'mcp-tool',
  'composite',
  'prompt-only',
];

/**
 * Check if a value is a valid skill category
 */
export function isValidSkillCategory(value: string): value is SkillCategory {
  return SKILL_CATEGORIES.includes(value as SkillCategory);
}

/**
 * Check if a value is a valid execution type
 */
export function isValidExecutionType(value: string): value is SkillExecutionType {
  return EXECUTION_TYPES.includes(value as SkillExecutionType);
}

/**
 * Get display label for skill category
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
  };
  return labels[category] || category;
}

/**
 * Get icon for skill category
 */
export function getSkillCategoryIcon(category: SkillCategory): string {
  const icons: Record<SkillCategory, string> = {
    development: '💻',
    design: '🎨',
    communication: '💬',
    research: '🔍',
    'content-creation': '✍️',
    automation: '⚙️',
    analysis: '📊',
    integration: '🔗',
  };
  return icons[category] || '📦';
}

/**
 * Get display label for execution type
 */
export function getExecutionTypeLabel(type: SkillExecutionType): string {
  const labels: Record<SkillExecutionType, string> = {
    script: 'Script',
    browser: 'Browser Automation',
    'mcp-tool': 'MCP Tool',
    composite: 'Composite',
    'prompt-only': 'Prompt Only',
  };
  return labels[type] || type;
}
```

### 2. Create `frontend/src/types/skill.types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  SkillCategory,
  SkillExecutionType,
  SKILL_CATEGORIES,
  EXECUTION_TYPES,
  isValidSkillCategory,
  isValidExecutionType,
  getSkillCategoryLabel,
  getSkillCategoryIcon,
  getExecutionTypeLabel,
} from './skill.types';

describe('Skill Types', () => {
  describe('SKILL_CATEGORIES', () => {
    it('should contain all expected categories', () => {
      expect(SKILL_CATEGORIES).toContain('development');
      expect(SKILL_CATEGORIES).toContain('design');
      expect(SKILL_CATEGORIES).toContain('automation');
      expect(SKILL_CATEGORIES.length).toBe(8);
    });
  });

  describe('EXECUTION_TYPES', () => {
    it('should contain all expected execution types', () => {
      expect(EXECUTION_TYPES).toContain('script');
      expect(EXECUTION_TYPES).toContain('browser');
      expect(EXECUTION_TYPES).toContain('prompt-only');
      expect(EXECUTION_TYPES.length).toBe(5);
    });
  });

  describe('isValidSkillCategory', () => {
    it('should return true for valid categories', () => {
      expect(isValidSkillCategory('development')).toBe(true);
      expect(isValidSkillCategory('design')).toBe(true);
    });

    it('should return false for invalid categories', () => {
      expect(isValidSkillCategory('invalid')).toBe(false);
      expect(isValidSkillCategory('')).toBe(false);
    });
  });

  describe('isValidExecutionType', () => {
    it('should return true for valid types', () => {
      expect(isValidExecutionType('script')).toBe(true);
      expect(isValidExecutionType('browser')).toBe(true);
    });

    it('should return false for invalid types', () => {
      expect(isValidExecutionType('invalid')).toBe(false);
    });
  });

  describe('getSkillCategoryLabel', () => {
    it('should return correct labels', () => {
      expect(getSkillCategoryLabel('development')).toBe('Development');
      expect(getSkillCategoryLabel('content-creation')).toBe('Content Creation');
    });
  });

  describe('getSkillCategoryIcon', () => {
    it('should return correct icons', () => {
      expect(getSkillCategoryIcon('development')).toBe('💻');
      expect(getSkillCategoryIcon('design')).toBe('🎨');
    });
  });

  describe('getExecutionTypeLabel', () => {
    it('should return correct labels', () => {
      expect(getExecutionTypeLabel('script')).toBe('Script');
      expect(getExecutionTypeLabel('browser')).toBe('Browser Automation');
    });
  });
});
```

## Acceptance Criteria

- [ ] `frontend/src/types/skill.types.ts` created with all interfaces
- [ ] `frontend/src/types/skill.types.test.ts` created with tests
- [ ] Types mirror backend skill types
- [ ] Utility functions included (isValid*, getLabel, getIcon)
- [ ] TypeScript compilation passes
- [ ] All tests pass

## Testing Requirements

- Unit tests for all type guard functions
- Unit tests for utility functions
- Verify type compatibility with backend types

## Estimated Effort

10 minutes

## Notes

- Keep types in sync with `backend/src/types/skill.types.ts`
- Include display helpers for UI components
- Follow existing frontend type patterns
