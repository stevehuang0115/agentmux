/**
 * Skill Types Tests
 *
 * Unit tests for skill type guards and utility functions.
 *
 * @module types/skill.types.test
 */

import { describe, it, expect } from 'vitest';
import {
  SKILL_CATEGORIES,
  EXECUTION_TYPES,
  isValidSkillCategory,
  isValidExecutionType,
  getSkillCategoryLabel,
  getSkillCategoryIcon,
  getExecutionTypeLabel,
  type SkillCategory,
  type SkillExecutionType,
  type Skill,
  type SkillSummary,
  type SkillFilter,
  type CreateSkillInput,
  type UpdateSkillInput,
} from './skill.types';

describe('Skill Types', () => {
  describe('SKILL_CATEGORIES constant', () => {
    it('should contain all expected categories', () => {
      expect(SKILL_CATEGORIES).toContain('development');
      expect(SKILL_CATEGORIES).toContain('design');
      expect(SKILL_CATEGORIES).toContain('communication');
      expect(SKILL_CATEGORIES).toContain('research');
      expect(SKILL_CATEGORIES).toContain('content-creation');
      expect(SKILL_CATEGORIES).toContain('automation');
      expect(SKILL_CATEGORIES).toContain('analysis');
      expect(SKILL_CATEGORIES).toContain('integration');
    });

    it('should have exactly 8 categories', () => {
      expect(SKILL_CATEGORIES).toHaveLength(8);
    });
  });

  describe('EXECUTION_TYPES constant', () => {
    it('should contain all expected execution types', () => {
      expect(EXECUTION_TYPES).toContain('script');
      expect(EXECUTION_TYPES).toContain('browser');
      expect(EXECUTION_TYPES).toContain('mcp-tool');
      expect(EXECUTION_TYPES).toContain('composite');
      expect(EXECUTION_TYPES).toContain('prompt-only');
    });

    it('should have exactly 5 execution types', () => {
      expect(EXECUTION_TYPES).toHaveLength(5);
    });
  });

  describe('isValidSkillCategory', () => {
    it('should return true for valid categories', () => {
      expect(isValidSkillCategory('development')).toBe(true);
      expect(isValidSkillCategory('design')).toBe(true);
      expect(isValidSkillCategory('communication')).toBe(true);
      expect(isValidSkillCategory('research')).toBe(true);
      expect(isValidSkillCategory('content-creation')).toBe(true);
      expect(isValidSkillCategory('automation')).toBe(true);
      expect(isValidSkillCategory('analysis')).toBe(true);
      expect(isValidSkillCategory('integration')).toBe(true);
    });

    it('should return false for invalid categories', () => {
      expect(isValidSkillCategory('invalid')).toBe(false);
      expect(isValidSkillCategory('')).toBe(false);
      expect(isValidSkillCategory('Development')).toBe(false);
      expect(isValidSkillCategory('DEVELOPMENT')).toBe(false);
      expect(isValidSkillCategory('dev')).toBe(false);
    });

    it('should work as a type guard', () => {
      const value: string = 'development';
      if (isValidSkillCategory(value)) {
        // TypeScript should recognize value as SkillCategory here
        const category: SkillCategory = value;
        expect(category).toBe('development');
      }
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

    it('should return false for invalid execution types', () => {
      expect(isValidExecutionType('invalid')).toBe(false);
      expect(isValidExecutionType('')).toBe(false);
      expect(isValidExecutionType('Script')).toBe(false);
      expect(isValidExecutionType('SCRIPT')).toBe(false);
      expect(isValidExecutionType('api')).toBe(false);
    });

    it('should work as a type guard', () => {
      const value: string = 'script';
      if (isValidExecutionType(value)) {
        // TypeScript should recognize value as SkillExecutionType here
        const execType: SkillExecutionType = value;
        expect(execType).toBe('script');
      }
    });
  });

  describe('getSkillCategoryLabel', () => {
    it('should return correct labels for all categories', () => {
      expect(getSkillCategoryLabel('development')).toBe('Development');
      expect(getSkillCategoryLabel('design')).toBe('Design');
      expect(getSkillCategoryLabel('communication')).toBe('Communication');
      expect(getSkillCategoryLabel('research')).toBe('Research');
      expect(getSkillCategoryLabel('content-creation')).toBe('Content Creation');
      expect(getSkillCategoryLabel('automation')).toBe('Automation');
      expect(getSkillCategoryLabel('analysis')).toBe('Analysis');
      expect(getSkillCategoryLabel('integration')).toBe('Integration');
    });

    it('should return the category itself as fallback for unknown values', () => {
      // Type assertion to test fallback behavior
      expect(getSkillCategoryLabel('unknown' as SkillCategory)).toBe('unknown');
    });
  });

  describe('getSkillCategoryIcon', () => {
    it('should return correct icons for all categories', () => {
      expect(getSkillCategoryIcon('development')).toBe('💻');
      expect(getSkillCategoryIcon('design')).toBe('🎨');
      expect(getSkillCategoryIcon('communication')).toBe('💬');
      expect(getSkillCategoryIcon('research')).toBe('🔍');
      expect(getSkillCategoryIcon('content-creation')).toBe('✍️');
      expect(getSkillCategoryIcon('automation')).toBe('⚙️');
      expect(getSkillCategoryIcon('analysis')).toBe('📊');
      expect(getSkillCategoryIcon('integration')).toBe('🔗');
    });

    it('should return default icon for unknown category', () => {
      // Type assertion to test fallback behavior
      expect(getSkillCategoryIcon('unknown' as SkillCategory)).toBe('📦');
    });
  });

  describe('getExecutionTypeLabel', () => {
    it('should return correct labels for all execution types', () => {
      expect(getExecutionTypeLabel('script')).toBe('Script');
      expect(getExecutionTypeLabel('browser')).toBe('Browser Automation');
      expect(getExecutionTypeLabel('mcp-tool')).toBe('MCP Tool');
      expect(getExecutionTypeLabel('composite')).toBe('Composite');
      expect(getExecutionTypeLabel('prompt-only')).toBe('Prompt Only');
    });

    it('should return the type itself as fallback for unknown values', () => {
      // Type assertion to test fallback behavior
      expect(getExecutionTypeLabel('unknown' as SkillExecutionType)).toBe('unknown');
    });
  });

  describe('Type Interfaces', () => {
    it('should allow creating a valid Skill object', () => {
      const skill: Skill = {
        id: 'skill-001',
        name: 'Code Review',
        description: 'Performs automated code review',
        category: 'development',
        promptFile: 'prompts/code-review.md',
        execution: {
          type: 'script',
          script: {
            file: 'scripts/review.sh',
            interpreter: 'bash',
            timeoutMs: 30000,
          },
        },
        environment: {
          required: ['GITHUB_TOKEN'],
        },
        assignableRoles: ['developer', 'reviewer'],
        triggers: ['pr-opened', 'pr-updated'],
        tags: ['code', 'review', 'quality'],
        version: '1.0.0',
        isBuiltin: true,
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(skill.id).toBe('skill-001');
      expect(skill.category).toBe('development');
      expect(skill.execution?.type).toBe('script');
    });

    it('should allow creating a valid SkillSummary object', () => {
      const summary: SkillSummary = {
        id: 'skill-001',
        name: 'Code Review',
        description: 'Performs automated code review',
        category: 'development',
        executionType: 'script',
        triggerCount: 2,
        roleCount: 2,
        isBuiltin: true,
        isEnabled: true,
      };

      expect(summary.id).toBe('skill-001');
      expect(summary.executionType).toBe('script');
      expect(summary.triggerCount).toBe(2);
    });

    it('should allow creating a valid SkillFilter object', () => {
      const filter: SkillFilter = {
        category: 'development',
        executionType: 'script',
        roleId: 'developer',
        isBuiltin: true,
        isEnabled: true,
        search: 'review',
        tags: ['code', 'quality'],
      };

      expect(filter.category).toBe('development');
      expect(filter.tags).toContain('code');
    });

    it('should allow creating a valid CreateSkillInput object', () => {
      const input: CreateSkillInput = {
        name: 'New Skill',
        description: 'A new skill',
        category: 'automation',
        promptContent: 'Do something automated',
        execution: {
          type: 'prompt-only',
        },
        assignableRoles: ['developer'],
        triggers: ['manual'],
        tags: ['new'],
      };

      expect(input.name).toBe('New Skill');
      expect(input.category).toBe('automation');
    });

    it('should allow creating a valid UpdateSkillInput object with partial data', () => {
      const input: UpdateSkillInput = {
        name: 'Updated Name',
        isEnabled: false,
      };

      expect(input.name).toBe('Updated Name');
      expect(input.isEnabled).toBe(false);
      expect(input.description).toBeUndefined();
    });
  });
});
