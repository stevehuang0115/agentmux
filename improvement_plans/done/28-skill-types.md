# Task: Create Skill Type Definitions

## Overview

Create TypeScript type definitions for the Skills system, which evolves from the existing SOP (Standard Operating Procedures) system. Skills combine prompts, scripts, environment variables, and browser automation capabilities.

## Priority

**Sprint 2** - Skills System

## Dependencies

- None (can be developed in parallel)

## Files to Create

### 1. `backend/src/types/skill.types.ts`

```typescript
/**
 * Skill category for grouping and filtering skills
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
export type SkillExecutionType = 'script' | 'browser' | 'mcp-tool' | 'composite' | 'prompt-only';

/**
 * Script interpreter options
 */
export type ScriptInterpreter = 'bash' | 'python' | 'node';

/**
 * Script execution configuration
 */
export interface SkillScriptConfig {
  /** Path to the script file (.sh, .py, .js) */
  file: string;

  /** Script interpreter to use */
  interpreter: ScriptInterpreter;

  /** Working directory for script execution */
  workingDir?: string;

  /** Script timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Browser automation configuration
 * Uses Claude's Chrome extension (claude-in-chrome MCP) for execution
 */
export interface SkillBrowserConfig {
  /** Target URL to navigate to */
  url: string;

  /** Natural language instructions for Claude to follow */
  instructions: string;

  /** Optional: specific actions to perform */
  actions?: string[];
}

/**
 * MCP tool invocation configuration
 */
export interface SkillMcpToolConfig {
  /** Name of the MCP tool to invoke */
  toolName: string;

  /** Default parameters for the tool */
  defaultParams?: Record<string, unknown>;
}

/**
 * Composite skill configuration (combines multiple skills)
 */
export interface SkillCompositeConfig {
  /** Ordered list of skill IDs to execute */
  skillSequence: string[];

  /** Whether to continue on error */
  continueOnError?: boolean;
}

/**
 * Skill execution configuration - only one type per skill
 */
export interface SkillExecutionConfig {
  /** Type of execution */
  type: SkillExecutionType;

  /** Script execution config (when type is 'script') */
  script?: SkillScriptConfig;

  /** Browser automation config (when type is 'browser') */
  browser?: SkillBrowserConfig;

  /** MCP tool config (when type is 'mcp-tool') */
  mcpTool?: SkillMcpToolConfig;

  /** Composite skill config (when type is 'composite') */
  composite?: SkillCompositeConfig;
}

/**
 * Environment variable configuration for skill execution
 */
export interface SkillEnvironmentConfig {
  /** Path to .env file (relative to skill directory) */
  file?: string;

  /** Inline environment variables */
  variables?: Record<string, string>;

  /** Required environment variables (will error if not set) */
  required?: string[];
}

/**
 * Full Skill definition
 */
export interface Skill {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Detailed description of what this skill does */
  description: string;

  /** Category for grouping */
  category: SkillCategory;

  /** Path to .md file with detailed instructions */
  promptFile: string;

  /** Execution configuration (optional - prompt-only skills don't need this) */
  execution?: SkillExecutionConfig;

  /** Environment configuration */
  environment?: SkillEnvironmentConfig;

  /** Role IDs that can use this skill */
  assignableRoles: string[];

  /** Keywords for matching in prompts */
  triggers: string[];

  /** Searchable tags */
  tags: string[];

  /** Skill version for updates */
  version: string;

  /** Whether this is a built-in skill */
  isBuiltin: boolean;

  /** Whether this skill is enabled */
  isEnabled: boolean;

  /** ISO timestamp of creation */
  createdAt: string;

  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Skill with resolved prompt content
 */
export interface SkillWithPrompt extends Skill {
  /** The actual content of the prompt file */
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
 * Skill execution context - data passed when executing a skill
 */
export interface SkillExecutionContext {
  /** ID of the agent executing the skill */
  agentId: string;

  /** ID of the role the agent is using */
  roleId: string;

  /** Current project context */
  projectId?: string;

  /** Current task context */
  taskId?: string;

  /** User-provided input for the skill */
  userInput?: string;

  /** Additional context data */
  metadata?: Record<string, unknown>;
}

/**
 * Result of skill execution
 */
export interface SkillExecutionResult {
  /** Whether execution was successful */
  success: boolean;

  /** Output from the skill execution */
  output?: string;

  /** Error message if failed */
  error?: string;

  /** Execution duration in milliseconds */
  durationMs: number;

  /** Additional result data */
  data?: Record<string, unknown>;
}

/**
 * Storage format for skill JSON files
 */
export interface SkillStorageFormat {
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
  createdAt: string;
  updatedAt: string;
}
```

### 2. `backend/src/types/skill.types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  Skill,
  SkillCategory,
  SkillExecutionType,
  CreateSkillInput,
  isValidSkillCategory,
  isValidExecutionType,
  createDefaultSkill,
  skillToSummary,
  validateCreateSkillInput,
  validateSkillExecution,
} from './skill.types.js';

describe('Skill Types', () => {
  describe('SkillCategory', () => {
    it('should have all expected categories', () => {
      const categories: SkillCategory[] = [
        'development',
        'design',
        'communication',
        'research',
        'content-creation',
        'automation',
        'analysis',
        'integration',
      ];

      categories.forEach((cat) => {
        expect(isValidSkillCategory(cat)).toBe(true);
      });
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
    it('should return true for valid execution types', () => {
      expect(isValidExecutionType('script')).toBe(true);
      expect(isValidExecutionType('browser')).toBe(true);
      expect(isValidExecutionType('mcp-tool')).toBe(true);
      expect(isValidExecutionType('composite')).toBe(true);
      expect(isValidExecutionType('prompt-only')).toBe(true);
    });

    it('should return false for invalid types', () => {
      expect(isValidExecutionType('invalid')).toBe(false);
    });
  });

  describe('createDefaultSkill', () => {
    it('should create a skill with default values', () => {
      const skill = createDefaultSkill({
        name: 'Test Skill',
        description: 'A test skill',
        category: 'development',
        promptContent: '# Test\n\nInstructions here',
      });

      expect(skill.id).toBeDefined();
      expect(skill.name).toBe('Test Skill');
      expect(skill.isBuiltin).toBe(false);
      expect(skill.isEnabled).toBe(true);
      expect(skill.version).toBe('1.0.0');
    });
  });

  describe('skillToSummary', () => {
    it('should convert Skill to SkillSummary', () => {
      const skill: Skill = {
        id: 'test-skill',
        name: 'Test Skill',
        description: 'A test',
        category: 'development',
        promptFile: 'instructions.md',
        execution: { type: 'script', script: { file: 'run.sh', interpreter: 'bash' } },
        assignableRoles: ['developer', 'qa'],
        triggers: ['test', 'run test'],
        tags: ['testing'],
        version: '1.0.0',
        isBuiltin: false,
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const summary = skillToSummary(skill);

      expect(summary.id).toBe('test-skill');
      expect(summary.executionType).toBe('script');
      expect(summary.triggerCount).toBe(2);
      expect(summary.roleCount).toBe(2);
    });

    it('should handle prompt-only skills', () => {
      const skill: Skill = {
        id: 'prompt-skill',
        name: 'Prompt Skill',
        description: 'Just instructions',
        category: 'development',
        promptFile: 'instructions.md',
        assignableRoles: [],
        triggers: [],
        tags: [],
        version: '1.0.0',
        isBuiltin: true,
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const summary = skillToSummary(skill);
      expect(summary.executionType).toBe('prompt-only');
    });
  });

  describe('validateCreateSkillInput', () => {
    it('should validate correct input', () => {
      const input: CreateSkillInput = {
        name: 'Valid Skill',
        description: 'A valid skill',
        category: 'development',
        promptContent: '# Instructions\n\nDo this...',
      };

      const errors = validateCreateSkillInput(input);
      expect(errors).toHaveLength(0);
    });

    it('should detect missing name', () => {
      const input = {
        name: '',
        description: 'Description',
        category: 'development' as const,
        promptContent: 'Content',
      };

      const errors = validateCreateSkillInput(input);
      expect(errors.some((e) => e.includes('Name'))).toBe(true);
    });

    it('should detect invalid category', () => {
      const input = {
        name: 'Skill',
        description: 'Description',
        category: 'invalid' as any,
        promptContent: 'Content',
      };

      const errors = validateCreateSkillInput(input);
      expect(errors.some((e) => e.includes('category'))).toBe(true);
    });
  });

  describe('validateSkillExecution', () => {
    it('should validate script execution config', () => {
      const config = {
        type: 'script' as const,
        script: {
          file: 'run.sh',
          interpreter: 'bash' as const,
        },
      };

      const errors = validateSkillExecution(config);
      expect(errors).toHaveLength(0);
    });

    it('should detect missing script config for script type', () => {
      const config = {
        type: 'script' as const,
      };

      const errors = validateSkillExecution(config);
      expect(errors.some((e) => e.includes('script'))).toBe(true);
    });

    it('should validate browser execution config', () => {
      const config = {
        type: 'browser' as const,
        browser: {
          url: 'https://example.com',
          instructions: 'Click the button',
        },
      };

      const errors = validateSkillExecution(config);
      expect(errors).toHaveLength(0);
    });

    it('should detect missing URL for browser type', () => {
      const config = {
        type: 'browser' as const,
        browser: {
          url: '',
          instructions: 'Do something',
        },
      };

      const errors = validateSkillExecution(config);
      expect(errors.some((e) => e.includes('URL'))).toBe(true);
    });
  });
});
```

## Utility Functions to Include

Add these functions to the types file:

```typescript
/**
 * Valid skill categories
 */
const SKILL_CATEGORIES: SkillCategory[] = [
  'development', 'design', 'communication', 'research',
  'content-creation', 'automation', 'analysis', 'integration',
];

/**
 * Valid execution types
 */
const EXECUTION_TYPES: SkillExecutionType[] = [
  'script', 'browser', 'mcp-tool', 'composite', 'prompt-only',
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
 * Create a skill with default values
 */
export function createDefaultSkill(
  input: Pick<CreateSkillInput, 'name' | 'description' | 'category' | 'promptContent'>
): Skill {
  const now = new Date().toISOString();
  const id = `skill-${input.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

  return {
    id,
    name: input.name,
    description: input.description,
    category: input.category,
    promptFile: `${id}/instructions.md`,
    assignableRoles: [],
    triggers: [],
    tags: [],
    version: '1.0.0',
    isBuiltin: false,
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Convert Skill to SkillSummary
 */
export function skillToSummary(skill: Skill): SkillSummary {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    category: skill.category,
    executionType: skill.execution?.type ?? 'prompt-only',
    triggerCount: skill.triggers.length,
    roleCount: skill.assignableRoles.length,
    isBuiltin: skill.isBuiltin,
    isEnabled: skill.isEnabled,
  };
}

/**
 * Validate CreateSkillInput
 */
export function validateCreateSkillInput(input: CreateSkillInput): string[] {
  const errors: string[] = [];

  if (!input.name || input.name.trim().length === 0) {
    errors.push('Name is required');
  }

  if (!input.description || input.description.trim().length === 0) {
    errors.push('Description is required');
  }

  if (!isValidSkillCategory(input.category)) {
    errors.push('Invalid category');
  }

  if (!input.promptContent || input.promptContent.trim().length === 0) {
    errors.push('Prompt content is required');
  }

  if (input.execution) {
    errors.push(...validateSkillExecution(input.execution));
  }

  return errors;
}

/**
 * Validate skill execution configuration
 */
export function validateSkillExecution(config: SkillExecutionConfig): string[] {
  const errors: string[] = [];

  if (!isValidExecutionType(config.type)) {
    errors.push('Invalid execution type');
    return errors;
  }

  switch (config.type) {
    case 'script':
      if (!config.script) {
        errors.push('Script configuration required for script type');
      } else {
        if (!config.script.file) {
          errors.push('Script file path is required');
        }
        if (!['bash', 'python', 'node'].includes(config.script.interpreter)) {
          errors.push('Invalid script interpreter');
        }
      }
      break;

    case 'browser':
      if (!config.browser) {
        errors.push('Browser configuration required for browser type');
      } else {
        if (!config.browser.url) {
          errors.push('Browser URL is required');
        }
        if (!config.browser.instructions) {
          errors.push('Browser instructions are required');
        }
      }
      break;

    case 'mcp-tool':
      if (!config.mcpTool) {
        errors.push('MCP tool configuration required');
      } else if (!config.mcpTool.toolName) {
        errors.push('MCP tool name is required');
      }
      break;

    case 'composite':
      if (!config.composite) {
        errors.push('Composite configuration required');
      } else if (!config.composite.skillSequence?.length) {
        errors.push('Composite skill must have at least one skill in sequence');
      }
      break;
  }

  return errors;
}
```

## Acceptance Criteria

- [ ] All skill type definitions are complete with JSDoc comments
- [ ] Support for all execution types (script, browser, mcp-tool, composite, prompt-only)
- [ ] Type guard functions implemented and tested
- [ ] Utility functions (createDefaultSkill, skillToSummary, validation) work correctly
- [ ] Test coverage >80%
- [ ] Types are compatible with existing SOP system for migration
- [ ] No TypeScript errors

## Testing Requirements

1. Unit tests for all type guard functions
2. Unit tests for all utility functions
3. Validation tests for each execution type
4. Edge case tests (empty values, missing configs)
5. Test skill-to-summary conversion

## Notes

- Skills evolve from the existing SOP system
- Maintain compatibility with existing SOP format for migration
- Browser automation uses Claude's Chrome extension (claude-in-chrome MCP)
- Scripts execute in isolated environments with injected env vars
- Consider security implications for script execution
