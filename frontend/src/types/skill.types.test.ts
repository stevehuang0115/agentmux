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
      expect(SKILL_CATEGORIES).toContain('management');
      expect(SKILL_CATEGORIES).toContain('monitoring');
      expect(SKILL_CATEGORIES).toContain('memory');
      expect(SKILL_CATEGORIES).toContain('system');
      expect(SKILL_CATEGORIES).toContain('task-management');
      expect(SKILL_CATEGORIES).toContain('quality');
    });

    it('should have exactly 14 categories', () => {
      expect(SKILL_CATEGORIES).toHaveLength(14);
    });
  });

  describe('EXECUTION_TYPES constant', () => {
    it('should contain all expected execution types', () => {
      expect(EXECUTION_TYPES).toContain('script');
      expect(EXECUTION_TYPES).toContain('browser');
      expect(EXECUTION_TYPES).toContain('composite');
      expect(EXECUTION_TYPES).toContain('prompt-only');
    });

    it('should have exactly 4 execution types', () => {
      expect(EXECUTION_TYPES).toHaveLength(4);
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
      expect(isValidSkillCategory('management')).toBe(true);
      expect(isValidSkillCategory('monitoring')).toBe(true);
      expect(isValidSkillCategory('memory')).toBe(true);
      expect(isValidSkillCategory('system')).toBe(true);
      expect(isValidSkillCategory('task-management')).toBe(true);
      expect(isValidSkillCategory('quality')).toBe(true);
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
      expect(getSkillCategoryLabel('management')).toBe('Management');
      expect(getSkillCategoryLabel('monitoring')).toBe('Monitoring');
      expect(getSkillCategoryLabel('memory')).toBe('Memory');
      expect(getSkillCategoryLabel('system')).toBe('System');
      expect(getSkillCategoryLabel('task-management')).toBe('Task Management');
      expect(getSkillCategoryLabel('quality')).toBe('Quality');
    });

    it('should return the category itself as fallback for unknown values', () => {
      // Type assertion to test fallback behavior
      expect(getSkillCategoryLabel('unknown' as SkillCategory)).toBe('unknown');
    });
  });

  describe('getSkillCategoryIcon', () => {
    it('should return correct icons for all categories', () => {
      expect(getSkillCategoryIcon('development')).toBe('\u{1F4BB}');
      expect(getSkillCategoryIcon('design')).toBe('\u{1F3A8}');
      expect(getSkillCategoryIcon('communication')).toBe('\u{1F4AC}');
      expect(getSkillCategoryIcon('research')).toBe('\u{1F50D}');
      expect(getSkillCategoryIcon('content-creation')).toBe('\u270D\uFE0F');
      expect(getSkillCategoryIcon('automation')).toBe('\u2699\uFE0F');
      expect(getSkillCategoryIcon('analysis')).toBe('\u{1F4CA}');
      expect(getSkillCategoryIcon('integration')).toBe('\u{1F517}');
      expect(getSkillCategoryIcon('management')).toBe('\u{1F4CB}');
      expect(getSkillCategoryIcon('monitoring')).toBe('\u{1F4E1}');
      expect(getSkillCategoryIcon('memory')).toBe('\u{1F9E0}');
      expect(getSkillCategoryIcon('system')).toBe('\u{1F5A5}\uFE0F');
      expect(getSkillCategoryIcon('task-management')).toBe('\u2611\uFE0F');
      expect(getSkillCategoryIcon('quality')).toBe('\u2705');
    });

    it('should return default icon for unknown category', () => {
      // Type assertion to test fallback behavior
      expect(getSkillCategoryIcon('unknown' as SkillCategory)).toBe('\u{1F4E6}');
    });
  });

  describe('getExecutionTypeLabel', () => {
    it('should return correct labels for all execution types', () => {
      expect(getExecutionTypeLabel('script')).toBe('Script');
      expect(getExecutionTypeLabel('browser')).toBe('Browser Automation');
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
        skillType: 'claude-skill',
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

    it('should allow creating a Skill with new categories', () => {
      const managementSkill: Skill = {
        id: 'skill-mgmt-001',
        name: 'Delegate Task',
        description: 'Delegates tasks to team members',
        category: 'management',
        skillType: 'claude-skill',
        promptFile: 'prompts/delegate-task.md',
        assignableRoles: ['orchestrator'],
        triggers: ['task-created'],
        tags: ['management', 'delegation'],
        version: '1.0.0',
        isBuiltin: true,
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(managementSkill.category).toBe('management');

      const monitoringSkill: Skill = {
        id: 'skill-mon-001',
        name: 'Agent Status',
        description: 'Gets agent status',
        category: 'monitoring',
        skillType: 'claude-skill',
        promptFile: 'prompts/agent-status.md',
        assignableRoles: ['orchestrator'],
        triggers: ['status-check'],
        tags: ['monitoring'],
        version: '1.0.0',
        isBuiltin: true,
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(monitoringSkill.category).toBe('monitoring');
    });

    it('should allow creating a valid SkillSummary object', () => {
      const summary: SkillSummary = {
        id: 'skill-001',
        name: 'Code Review',
        description: 'Performs automated code review',
        category: 'development',
        skillType: 'claude-skill',
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

    it('should allow filtering by new categories', () => {
      const managementFilter: SkillFilter = { category: 'management' };
      const monitoringFilter: SkillFilter = { category: 'monitoring' };
      const memoryFilter: SkillFilter = { category: 'memory' };
      const systemFilter: SkillFilter = { category: 'system' };
      const taskMgmtFilter: SkillFilter = { category: 'task-management' };
      const qualityFilter: SkillFilter = { category: 'quality' };

      expect(managementFilter.category).toBe('management');
      expect(monitoringFilter.category).toBe('monitoring');
      expect(memoryFilter.category).toBe('memory');
      expect(systemFilter.category).toBe('system');
      expect(taskMgmtFilter.category).toBe('task-management');
      expect(qualityFilter.category).toBe('quality');
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
