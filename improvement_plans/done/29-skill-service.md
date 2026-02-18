# Task: Implement Skill Service

## Overview

Create a backend service for managing Skills, the evolution of the SOP system. This service handles CRUD operations, skill loading from directories, and skill matching for agent prompts.

## Priority

**Sprint 2** - Skills System

## Dependencies

- `28-skill-types.md` - Skill type definitions must be complete
- `24-role-service.md` - For role-skill relationships

## Files to Create

### 1. `backend/src/services/skill/skill.service.ts`

```typescript
import { promises as fs } from 'fs';
import path from 'path';
import {
  Skill,
  SkillWithPrompt,
  SkillSummary,
  CreateSkillInput,
  UpdateSkillInput,
  SkillFilter,
  SkillStorageFormat,
  createDefaultSkill,
  skillToSummary,
  validateCreateSkillInput,
} from '../../types/skill.types.js';

/**
 * Service for managing AI agent skills
 *
 * Handles:
 * - Loading built-in skills from config/skills/
 * - Managing user-created skills in ~/.crewly/skills/
 * - CRUD operations for skills
 * - Skill matching for prompts
 * - Integration with role service for skill assignment
 */
export class SkillService {
  private readonly builtinSkillsDir: string;
  private readonly userSkillsDir: string;
  private skillsCache: Map<string, Skill> = new Map();
  private initialized = false;

  constructor(options?: {
    builtinSkillsDir?: string;
    userSkillsDir?: string;
  }) {
    this.builtinSkillsDir = options?.builtinSkillsDir ??
      path.join(process.cwd(), 'config', 'skills');
    this.userSkillsDir = options?.userSkillsDir ??
      path.join(process.env.HOME || '~', '.crewly', 'skills');
  }

  /**
   * Initialize the service by loading all skills
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.ensureUserSkillsDir();
    await this.loadAllSkills();
    this.initialized = true;
  }

  /**
   * Get all skills, optionally filtered
   */
  async listSkills(filter?: SkillFilter): Promise<SkillSummary[]> {
    await this.ensureInitialized();

    let skills = Array.from(this.skillsCache.values());

    if (filter) {
      if (filter.category) {
        skills = skills.filter((s) => s.category === filter.category);
      }
      if (filter.executionType) {
        skills = skills.filter((s) =>
          (s.execution?.type ?? 'prompt-only') === filter.executionType
        );
      }
      if (filter.roleId) {
        skills = skills.filter((s) => s.assignableRoles.includes(filter.roleId!));
      }
      if (filter.isBuiltin !== undefined) {
        skills = skills.filter((s) => s.isBuiltin === filter.isBuiltin);
      }
      if (filter.isEnabled !== undefined) {
        skills = skills.filter((s) => s.isEnabled === filter.isEnabled);
      }
      if (filter.tags?.length) {
        skills = skills.filter((s) =>
          filter.tags!.some((tag) => s.tags.includes(tag))
        );
      }
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        skills = skills.filter((s) =>
          s.name.toLowerCase().includes(searchLower) ||
          s.description.toLowerCase().includes(searchLower) ||
          s.triggers.some((t) => t.toLowerCase().includes(searchLower))
        );
      }
    }

    return skills.map(skillToSummary);
  }

  /**
   * Get a skill by ID with full prompt content
   */
  async getSkill(id: string): Promise<SkillWithPrompt | null> {
    await this.ensureInitialized();

    const skill = this.skillsCache.get(id);
    if (!skill) return null;

    const promptContent = await this.loadPromptContent(skill);
    return { ...skill, promptContent };
  }

  /**
   * Get skills matching a prompt/input
   * Used by agents to find relevant skills for a task
   */
  async matchSkills(
    input: string,
    roleId?: string,
    maxResults = 5
  ): Promise<SkillWithPrompt[]> {
    await this.ensureInitialized();

    const inputLower = input.toLowerCase();
    const matches: { skill: Skill; score: number }[] = [];

    for (const skill of this.skillsCache.values()) {
      if (!skill.isEnabled) continue;

      // Check role assignment if provided
      if (roleId && !skill.assignableRoles.includes(roleId) &&
          skill.assignableRoles.length > 0) {
        continue;
      }

      let score = 0;

      // Check triggers (highest priority)
      for (const trigger of skill.triggers) {
        if (inputLower.includes(trigger.toLowerCase())) {
          score += 10;
        }
      }

      // Check tags
      for (const tag of skill.tags) {
        if (inputLower.includes(tag.toLowerCase())) {
          score += 3;
        }
      }

      // Check name
      if (inputLower.includes(skill.name.toLowerCase())) {
        score += 5;
      }

      // Check description keywords
      const descWords = skill.description.toLowerCase().split(/\s+/);
      for (const word of descWords) {
        if (word.length > 3 && inputLower.includes(word)) {
          score += 1;
        }
      }

      if (score > 0) {
        matches.push({ skill, score });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    // Get top results with prompt content
    const topMatches = matches.slice(0, maxResults);
    return Promise.all(
      topMatches.map(async ({ skill }) => ({
        ...skill,
        promptContent: await this.loadPromptContent(skill),
      }))
    );
  }

  /**
   * Create a new user-defined skill
   */
  async createSkill(input: CreateSkillInput): Promise<Skill> {
    await this.ensureInitialized();

    const errors = validateCreateSkillInput(input);
    if (errors.length > 0) {
      throw new SkillValidationError(errors);
    }

    const skill = createDefaultSkill(input);
    skill.execution = input.execution;
    skill.environment = input.environment;
    skill.assignableRoles = input.assignableRoles ?? [];
    skill.triggers = input.triggers ?? [];
    skill.tags = input.tags ?? [];

    await this.saveSkill(skill, input.promptContent);
    this.skillsCache.set(skill.id, skill);

    return skill;
  }

  /**
   * Update an existing skill
   */
  async updateSkill(id: string, input: UpdateSkillInput): Promise<Skill> {
    await this.ensureInitialized();

    const existing = this.skillsCache.get(id);
    if (!existing) {
      throw new SkillNotFoundError(id);
    }

    if (existing.isBuiltin) {
      throw new BuiltinSkillModificationError('update');
    }

    const updated: Skill = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      category: input.category ?? existing.category,
      execution: input.execution ?? existing.execution,
      environment: input.environment ?? existing.environment,
      assignableRoles: input.assignableRoles ?? existing.assignableRoles,
      triggers: input.triggers ?? existing.triggers,
      tags: input.tags ?? existing.tags,
      isEnabled: input.isEnabled ?? existing.isEnabled,
      updatedAt: new Date().toISOString(),
    };

    await this.saveSkill(updated, input.promptContent);
    this.skillsCache.set(id, updated);

    return updated;
  }

  /**
   * Delete a user-created skill
   */
  async deleteSkill(id: string): Promise<void> {
    await this.ensureInitialized();

    const skill = this.skillsCache.get(id);
    if (!skill) {
      throw new SkillNotFoundError(id);
    }

    if (skill.isBuiltin) {
      throw new BuiltinSkillModificationError('delete');
    }

    const skillDir = path.join(this.userSkillsDir, id);
    await fs.rm(skillDir, { recursive: true, force: true });
    this.skillsCache.delete(id);
  }

  /**
   * Enable or disable a skill
   */
  async setSkillEnabled(id: string, enabled: boolean): Promise<Skill> {
    return this.updateSkill(id, { isEnabled: enabled });
  }

  /**
   * Get skills assigned to a specific role
   */
  async getSkillsForRole(roleId: string): Promise<SkillSummary[]> {
    return this.listSkills({ roleId, isEnabled: true });
  }

  /**
   * Refresh skills from disk (reload)
   */
  async refresh(): Promise<void> {
    this.skillsCache.clear();
    this.initialized = false;
    await this.initialize();
  }

  // Private methods

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async ensureUserSkillsDir(): Promise<void> {
    await fs.mkdir(this.userSkillsDir, { recursive: true });
  }

  private async loadAllSkills(): Promise<void> {
    // Load built-in skills
    try {
      const builtinSkills = await this.loadSkillsFromDir(this.builtinSkillsDir, true);
      for (const skill of builtinSkills) {
        this.skillsCache.set(skill.id, skill);
      }
    } catch (error) {
      console.warn('No built-in skills found:', error);
    }

    // Load user skills
    try {
      const userSkills = await this.loadSkillsFromDir(this.userSkillsDir, false);
      for (const skill of userSkills) {
        this.skillsCache.set(skill.id, skill);
      }
    } catch (error) {
      console.warn('No user skills found:', error);
    }
  }

  private async loadSkillsFromDir(dir: string, isBuiltin: boolean): Promise<Skill[]> {
    const skills: Skill[] = [];

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDir = path.join(dir, entry.name);
      const skillJsonPath = path.join(skillDir, 'skill.json');

      try {
        const content = await fs.readFile(skillJsonPath, 'utf-8');
        const data: SkillStorageFormat = JSON.parse(content);

        const skill: Skill = {
          ...data,
          isBuiltin,
          isEnabled: true,
          promptFile: path.join(skillDir, data.promptFile || 'instructions.md'),
        };

        skills.push(skill);
      } catch (error) {
        console.warn(`Failed to load skill from ${skillDir}:`, error);
      }
    }

    return skills;
  }

  private async loadPromptContent(skill: Skill): Promise<string> {
    try {
      return await fs.readFile(skill.promptFile, 'utf-8');
    } catch (error) {
      console.warn(`Failed to load prompt for skill ${skill.id}:`, error);
      return '';
    }
  }

  private async saveSkill(skill: Skill, promptContent?: string): Promise<void> {
    const skillDir = path.join(this.userSkillsDir, skill.id);
    await fs.mkdir(skillDir, { recursive: true });

    // Save skill.json
    const storageData: SkillStorageFormat = {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      promptFile: 'instructions.md',
      execution: skill.execution,
      environment: skill.environment,
      assignableRoles: skill.assignableRoles,
      triggers: skill.triggers,
      tags: skill.tags,
      version: skill.version,
      createdAt: skill.createdAt,
      updatedAt: skill.updatedAt,
    };

    await fs.writeFile(
      path.join(skillDir, 'skill.json'),
      JSON.stringify(storageData, null, 2)
    );

    // Save prompt content if provided
    if (promptContent !== undefined) {
      await fs.writeFile(
        path.join(skillDir, 'instructions.md'),
        promptContent
      );
    }

    // Update skill's prompt file path
    skill.promptFile = path.join(skillDir, 'instructions.md');
  }
}

// Error classes
export class SkillNotFoundError extends Error {
  constructor(id: string) {
    super(`Skill not found: ${id}`);
    this.name = 'SkillNotFoundError';
  }
}

export class SkillValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Skill validation failed: ${errors.join(', ')}`);
    this.name = 'SkillValidationError';
  }
}

export class BuiltinSkillModificationError extends Error {
  constructor(action: string) {
    super(`Cannot ${action} a built-in skill`);
    this.name = 'BuiltinSkillModificationError';
  }
}

// Singleton
let skillServiceInstance: SkillService | null = null;

export function getSkillService(): SkillService {
  if (!skillServiceInstance) {
    skillServiceInstance = new SkillService();
  }
  return skillServiceInstance;
}

export function resetSkillService(): void {
  skillServiceInstance = null;
}
```

### 2. `backend/src/services/skill/skill.service.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  SkillService,
  getSkillService,
  resetSkillService,
  SkillNotFoundError,
  SkillValidationError,
  BuiltinSkillModificationError,
} from './skill.service.js';
import { CreateSkillInput } from '../../types/skill.types.js';

describe('SkillService', () => {
  let service: SkillService;
  let testDir: string;
  let builtinSkillsDir: string;
  let userSkillsDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `skill-service-test-${Date.now()}`);
    builtinSkillsDir = path.join(testDir, 'builtin');
    userSkillsDir = path.join(testDir, 'user');

    await fs.mkdir(builtinSkillsDir, { recursive: true });
    await fs.mkdir(userSkillsDir, { recursive: true });

    // Create a sample builtin skill
    const codeReviewDir = path.join(builtinSkillsDir, 'code-review');
    await fs.mkdir(codeReviewDir, { recursive: true });

    await fs.writeFile(
      path.join(codeReviewDir, 'skill.json'),
      JSON.stringify({
        id: 'code-review',
        name: 'Code Review',
        description: 'Review code for quality and security',
        category: 'development',
        promptFile: 'instructions.md',
        triggers: ['review', 'code review', 'check code'],
        tags: ['code', 'quality'],
        assignableRoles: ['developer', 'qa'],
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, null, 2)
    );

    await fs.writeFile(
      path.join(codeReviewDir, 'instructions.md'),
      '# Code Review\n\nReview the code for:\n- Security issues\n- Best practices'
    );

    service = new SkillService({
      builtinSkillsDir,
      userSkillsDir,
    });

    await service.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    resetSkillService();
  });

  describe('initialize', () => {
    it('should load builtin skills from directory', async () => {
      const skills = await service.listSkills();
      expect(skills.length).toBeGreaterThan(0);
      expect(skills.find((s) => s.id === 'code-review')).toBeDefined();
    });

    it('should mark builtin skills as isBuiltin: true', async () => {
      const skill = await service.getSkill('code-review');
      expect(skill?.isBuiltin).toBe(true);
    });
  });

  describe('listSkills', () => {
    it('should return all skills without filter', async () => {
      const skills = await service.listSkills();
      expect(Array.isArray(skills)).toBe(true);
    });

    it('should filter by category', async () => {
      const skills = await service.listSkills({ category: 'development' });
      expect(skills.every((s) => s.category === 'development')).toBe(true);
    });

    it('should filter by roleId', async () => {
      const skills = await service.listSkills({ roleId: 'developer' });
      expect(skills.length).toBeGreaterThan(0);
    });

    it('should filter by search term', async () => {
      const skills = await service.listSkills({ search: 'code' });
      expect(skills.length).toBeGreaterThan(0);
    });

    it('should filter by tags', async () => {
      const skills = await service.listSkills({ tags: ['code'] });
      expect(skills.length).toBeGreaterThan(0);
    });
  });

  describe('getSkill', () => {
    it('should return skill with prompt content', async () => {
      const skill = await service.getSkill('code-review');
      expect(skill).not.toBeNull();
      expect(skill?.promptContent).toContain('Code Review');
    });

    it('should return null for non-existent skill', async () => {
      const skill = await service.getSkill('non-existent');
      expect(skill).toBeNull();
    });
  });

  describe('matchSkills', () => {
    it('should match skills by trigger keywords', async () => {
      const matches = await service.matchSkills('I need to review this code');
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].id).toBe('code-review');
    });

    it('should filter by roleId', async () => {
      const matches = await service.matchSkills('review code', 'developer');
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should return empty for no matches', async () => {
      const matches = await service.matchSkills('xyz completely unrelated');
      expect(matches).toHaveLength(0);
    });

    it('should limit results', async () => {
      const matches = await service.matchSkills('code', undefined, 1);
      expect(matches.length).toBeLessThanOrEqual(1);
    });
  });

  describe('createSkill', () => {
    it('should create a new skill', async () => {
      const input: CreateSkillInput = {
        name: 'Test Skill',
        description: 'A test skill',
        category: 'development',
        promptContent: '# Test\n\nInstructions here',
        triggers: ['test'],
      };

      const skill = await service.createSkill(input);

      expect(skill.id).toBeDefined();
      expect(skill.name).toBe('Test Skill');
      expect(skill.isBuiltin).toBe(false);
    });

    it('should save skill to disk', async () => {
      const input: CreateSkillInput = {
        name: 'Saved Skill',
        description: 'Will be saved',
        category: 'automation',
        promptContent: 'Content here',
      };

      const skill = await service.createSkill(input);

      const files = await fs.readdir(userSkillsDir);
      expect(files.some((f) => f.includes('saved-skill'))).toBe(true);
    });

    it('should throw for invalid input', async () => {
      const input = {
        name: '',
        description: '',
        category: 'invalid' as any,
        promptContent: '',
      };

      await expect(service.createSkill(input)).rejects.toThrow(SkillValidationError);
    });
  });

  describe('updateSkill', () => {
    let createdSkillId: string;

    beforeEach(async () => {
      const skill = await service.createSkill({
        name: 'Update Test',
        description: 'Will be updated',
        category: 'development',
        promptContent: 'Original',
      });
      createdSkillId = skill.id;
    });

    it('should update skill properties', async () => {
      const updated = await service.updateSkill(createdSkillId, {
        description: 'Updated description',
      });

      expect(updated.description).toBe('Updated description');
    });

    it('should throw for builtin skill', async () => {
      await expect(
        service.updateSkill('code-review', { description: 'Modified' })
      ).rejects.toThrow(BuiltinSkillModificationError);
    });

    it('should throw for non-existent skill', async () => {
      await expect(
        service.updateSkill('non-existent', { description: 'Test' })
      ).rejects.toThrow(SkillNotFoundError);
    });
  });

  describe('deleteSkill', () => {
    let createdSkillId: string;

    beforeEach(async () => {
      const skill = await service.createSkill({
        name: 'Delete Test',
        description: 'Will be deleted',
        category: 'development',
        promptContent: 'Content',
      });
      createdSkillId = skill.id;
    });

    it('should delete user-created skill', async () => {
      await service.deleteSkill(createdSkillId);
      const skill = await service.getSkill(createdSkillId);
      expect(skill).toBeNull();
    });

    it('should throw for builtin skill', async () => {
      await expect(service.deleteSkill('code-review'))
        .rejects.toThrow(BuiltinSkillModificationError);
    });
  });

  describe('getSkillsForRole', () => {
    it('should return skills assigned to role', async () => {
      const skills = await service.getSkillsForRole('developer');
      expect(skills.length).toBeGreaterThan(0);
    });
  });

  describe('refresh', () => {
    it('should reload skills from disk', async () => {
      // Create a skill
      await service.createSkill({
        name: 'Refresh Test',
        description: 'Test',
        category: 'development',
        promptContent: 'Content',
      });

      // Manually clear and refresh
      await service.refresh();

      const skills = await service.listSkills();
      expect(skills.find((s) => s.name === 'Refresh Test')).toBeDefined();
    });
  });
});

describe('getSkillService', () => {
  afterEach(() => {
    resetSkillService();
  });

  it('should return singleton instance', () => {
    const instance1 = getSkillService();
    const instance2 = getSkillService();
    expect(instance1).toBe(instance2);
  });
});
```

## Directory Structure for Built-in Skills

```
config/skills/
├── development/
│   ├── code-review/
│   │   ├── skill.json
│   │   └── instructions.md
│   ├── testing/
│   │   ├── skill.json
│   │   └── instructions.md
│   └── documentation/
│       ├── skill.json
│       └── instructions.md
├── design/
│   ├── image-generation/
│   │   ├── skill.json
│   │   ├── instructions.md
│   │   └── generate.sh          # Optional script
│   └── video-generation/
│       ├── skill.json
│       └── instructions.md      # Browser automation instructions
└── integration/
    ├── github/
    │   ├── skill.json
    │   └── instructions.md
    └── slack/
        ├── skill.json
        └── instructions.md
```

## Acceptance Criteria

- [ ] SkillService loads skills from both builtin and user directories
- [ ] All CRUD operations work correctly
- [ ] Built-in skills cannot be modified or deleted
- [ ] Skill matching works with triggers, tags, and content
- [ ] Role-based skill filtering works
- [ ] Comprehensive test coverage (>80%)
- [ ] Error handling with descriptive errors
- [ ] Skills are persisted correctly to disk

## Testing Requirements

1. Unit tests for all public methods
2. Integration tests for file operations
3. Skill matching algorithm tests
4. Edge case tests (missing files, invalid JSON)
5. Performance tests for matching with many skills

## Notes

- Cache skills in memory after loading
- Support JSONC (JSON with comments) for skill.json files
- Validate skill files on load
- Log warnings for invalid skills rather than failing completely
- Consider adding skill versioning for updates
