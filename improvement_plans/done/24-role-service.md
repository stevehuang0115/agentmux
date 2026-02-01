# Task: Implement Role Management Service

## Overview

Create a backend service for managing AI agent roles. This service handles CRUD operations for roles, loading from configuration directories, and managing role-to-skill assignments.

## Priority

**Sprint 1** - Foundation (Settings + Roles)

## Dependencies

- `23-role-types.md` - Role type definitions must be complete

## Files to Create

### 1. `backend/src/services/settings/role.service.ts`

```typescript
import { promises as fs } from 'fs';
import path from 'path';
import {
  Role,
  RoleWithPrompt,
  RoleSummary,
  CreateRoleInput,
  UpdateRoleInput,
  RoleFilter,
  RoleStorageFormat,
  createDefaultRole,
  roleToSummary,
  validateCreateRoleInput,
} from '../../types/role.types.js';

/**
 * Service for managing AI agent roles
 *
 * Handles:
 * - Loading built-in roles from config/roles/
 * - Managing user-created roles in ~/.agentmux/roles/
 * - CRUD operations for roles
 * - Role-to-skill assignment management
 */
export class RoleService {
  private readonly builtinRolesDir: string;
  private readonly userRolesDir: string;
  private rolesCache: Map<string, Role> = new Map();
  private initialized = false;

  constructor(options?: {
    builtinRolesDir?: string;
    userRolesDir?: string;
  }) {
    this.builtinRolesDir = options?.builtinRolesDir ??
      path.join(process.cwd(), 'config', 'roles');
    this.userRolesDir = options?.userRolesDir ??
      path.join(process.env.HOME || '~', '.agentmux', 'roles');
  }

  /**
   * Initialize the service by loading all roles
   */
  async initialize(): Promise<void>;

  /**
   * Get all roles, optionally filtered
   */
  async listRoles(filter?: RoleFilter): Promise<RoleSummary[]>;

  /**
   * Get a role by ID with full prompt content
   */
  async getRole(id: string): Promise<RoleWithPrompt | null>;

  /**
   * Get a role by name
   */
  async getRoleByName(name: string): Promise<RoleWithPrompt | null>;

  /**
   * Create a new user-defined role
   */
  async createRole(input: CreateRoleInput): Promise<Role>;

  /**
   * Update an existing role (only user-created roles can be modified)
   */
  async updateRole(id: string, input: UpdateRoleInput): Promise<Role>;

  /**
   * Delete a user-created role (built-in roles cannot be deleted)
   */
  async deleteRole(id: string): Promise<void>;

  /**
   * Assign skills to a role
   */
  async assignSkills(roleId: string, skillIds: string[]): Promise<Role>;

  /**
   * Remove skills from a role
   */
  async removeSkills(roleId: string, skillIds: string[]): Promise<Role>;

  /**
   * Set the default role
   */
  async setDefaultRole(roleId: string): Promise<Role>;

  /**
   * Get the current default role
   */
  async getDefaultRole(): Promise<Role | null>;

  // Private methods
  private async loadBuiltinRoles(): Promise<Role[]>;
  private async loadUserRoles(): Promise<Role[]>;
  private async saveRole(role: Role, promptContent: string): Promise<void>;
  private async loadPromptContent(promptFile: string): Promise<string>;
  private async ensureUserRolesDir(): Promise<void>;
  private generateRoleId(name: string): string;
  private sanitizeRoleName(name: string): string;
}

// Singleton instance
let roleServiceInstance: RoleService | null = null;

export function getRoleService(): RoleService {
  if (!roleServiceInstance) {
    roleServiceInstance = new RoleService();
  }
  return roleServiceInstance;
}

export function resetRoleService(): void {
  roleServiceInstance = null;
}
```

### 2. `backend/src/services/settings/role.service.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { RoleService, getRoleService, resetRoleService } from './role.service.js';
import { CreateRoleInput, Role } from '../../types/role.types.js';

describe('RoleService', () => {
  let service: RoleService;
  let testDir: string;
  let builtinRolesDir: string;
  let userRolesDir: string;

  beforeEach(async () => {
    // Create temporary directories for testing
    testDir = path.join(os.tmpdir(), `role-service-test-${Date.now()}`);
    builtinRolesDir = path.join(testDir, 'builtin');
    userRolesDir = path.join(testDir, 'user');

    await fs.mkdir(builtinRolesDir, { recursive: true });
    await fs.mkdir(userRolesDir, { recursive: true });

    // Create a sample builtin role
    const sampleRole = {
      id: 'developer',
      name: 'developer',
      displayName: 'Developer',
      description: 'A software developer role',
      category: 'development',
      systemPromptFile: 'developer-prompt.md',
      assignedSkills: [],
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(
      path.join(builtinRolesDir, 'developer.json'),
      JSON.stringify(sampleRole, null, 2)
    );

    await fs.writeFile(
      path.join(builtinRolesDir, 'developer-prompt.md'),
      '# Developer Role\n\nYou are a software developer...'
    );

    service = new RoleService({
      builtinRolesDir,
      userRolesDir,
    });

    await service.initialize();
  });

  afterEach(async () => {
    // Cleanup test directory
    await fs.rm(testDir, { recursive: true, force: true });
    resetRoleService();
  });

  describe('initialize', () => {
    it('should load builtin roles from config directory', async () => {
      const roles = await service.listRoles();
      expect(roles.length).toBeGreaterThan(0);
      expect(roles.find(r => r.name === 'developer')).toBeDefined();
    });

    it('should mark builtin roles as isBuiltin: true', async () => {
      const role = await service.getRoleByName('developer');
      expect(role?.isBuiltin).toBe(true);
    });
  });

  describe('listRoles', () => {
    it('should return all roles without filter', async () => {
      const roles = await service.listRoles();
      expect(Array.isArray(roles)).toBe(true);
    });

    it('should filter by category', async () => {
      const roles = await service.listRoles({ category: 'development' });
      expect(roles.every(r => r.category === 'development')).toBe(true);
    });

    it('should filter by isBuiltin', async () => {
      const builtinRoles = await service.listRoles({ isBuiltin: true });
      expect(builtinRoles.every(r => r.isBuiltin)).toBe(true);
    });

    it('should filter by search term', async () => {
      const roles = await service.listRoles({ search: 'developer' });
      expect(roles.some(r =>
        r.displayName.toLowerCase().includes('developer') ||
        r.description.toLowerCase().includes('developer')
      )).toBe(true);
    });
  });

  describe('getRole', () => {
    it('should return role with prompt content', async () => {
      const role = await service.getRoleByName('developer');
      expect(role).not.toBeNull();
      expect(role?.systemPromptContent).toContain('Developer Role');
    });

    it('should return null for non-existent role', async () => {
      const role = await service.getRole('non-existent-id');
      expect(role).toBeNull();
    });
  });

  describe('createRole', () => {
    it('should create a new user role', async () => {
      const input: CreateRoleInput = {
        name: 'custom-role',
        displayName: 'Custom Role',
        description: 'A custom role',
        category: 'development',
        systemPromptContent: '# Custom Role\n\nYou are a custom role...',
      };

      const role = await service.createRole(input);

      expect(role.id).toBeDefined();
      expect(role.name).toBe('custom-role');
      expect(role.isBuiltin).toBe(false);
    });

    it('should save role to user roles directory', async () => {
      const input: CreateRoleInput = {
        name: 'saved-role',
        displayName: 'Saved Role',
        description: 'A saved role',
        category: 'development',
        systemPromptContent: '# Saved\n\nContent',
      };

      await service.createRole(input);

      const files = await fs.readdir(userRolesDir);
      expect(files.some(f => f.includes('saved-role'))).toBe(true);
    });

    it('should throw error for duplicate name', async () => {
      const input: CreateRoleInput = {
        name: 'developer',
        displayName: 'Developer Duplicate',
        description: 'Duplicate',
        category: 'development',
        systemPromptContent: 'Content',
      };

      await expect(service.createRole(input)).rejects.toThrow();
    });

    it('should throw error for invalid input', async () => {
      const input = {
        name: '',
        displayName: '',
        description: '',
        category: 'invalid' as any,
        systemPromptContent: '',
      };

      await expect(service.createRole(input)).rejects.toThrow();
    });
  });

  describe('updateRole', () => {
    it('should update user-created role', async () => {
      // First create a role
      const created = await service.createRole({
        name: 'update-test',
        displayName: 'Update Test',
        description: 'Test',
        category: 'development',
        systemPromptContent: 'Original content',
      });

      // Then update it
      const updated = await service.updateRole(created.id, {
        displayName: 'Updated Name',
        systemPromptContent: 'Updated content',
      });

      expect(updated.displayName).toBe('Updated Name');
    });

    it('should throw error when updating builtin role', async () => {
      const role = await service.getRoleByName('developer');

      await expect(
        service.updateRole(role!.id, { displayName: 'Modified' })
      ).rejects.toThrow(/builtin/i);
    });
  });

  describe('deleteRole', () => {
    it('should delete user-created role', async () => {
      const created = await service.createRole({
        name: 'delete-test',
        displayName: 'Delete Test',
        description: 'Test',
        category: 'development',
        systemPromptContent: 'Content',
      });

      await service.deleteRole(created.id);

      const role = await service.getRole(created.id);
      expect(role).toBeNull();
    });

    it('should throw error when deleting builtin role', async () => {
      const role = await service.getRoleByName('developer');

      await expect(service.deleteRole(role!.id)).rejects.toThrow(/builtin/i);
    });
  });

  describe('assignSkills', () => {
    it('should add skills to role', async () => {
      const created = await service.createRole({
        name: 'skill-test',
        displayName: 'Skill Test',
        description: 'Test',
        category: 'development',
        systemPromptContent: 'Content',
      });

      const updated = await service.assignSkills(created.id, ['skill-1', 'skill-2']);

      expect(updated.assignedSkills).toContain('skill-1');
      expect(updated.assignedSkills).toContain('skill-2');
    });

    it('should not duplicate existing skills', async () => {
      const created = await service.createRole({
        name: 'skill-dup-test',
        displayName: 'Skill Dup Test',
        description: 'Test',
        category: 'development',
        systemPromptContent: 'Content',
        assignedSkills: ['skill-1'],
      });

      const updated = await service.assignSkills(created.id, ['skill-1', 'skill-2']);

      expect(updated.assignedSkills.filter(s => s === 'skill-1').length).toBe(1);
    });
  });

  describe('removeSkills', () => {
    it('should remove skills from role', async () => {
      const created = await service.createRole({
        name: 'remove-skill-test',
        displayName: 'Remove Skill Test',
        description: 'Test',
        category: 'development',
        systemPromptContent: 'Content',
        assignedSkills: ['skill-1', 'skill-2', 'skill-3'],
      });

      const updated = await service.removeSkills(created.id, ['skill-2']);

      expect(updated.assignedSkills).toContain('skill-1');
      expect(updated.assignedSkills).not.toContain('skill-2');
      expect(updated.assignedSkills).toContain('skill-3');
    });
  });

  describe('setDefaultRole', () => {
    it('should set a role as default', async () => {
      const created = await service.createRole({
        name: 'default-test',
        displayName: 'Default Test',
        description: 'Test',
        category: 'development',
        systemPromptContent: 'Content',
      });

      await service.setDefaultRole(created.id);

      const defaultRole = await service.getDefaultRole();
      expect(defaultRole?.id).toBe(created.id);
    });

    it('should unset previous default role', async () => {
      const role1 = await service.createRole({
        name: 'default-1',
        displayName: 'Default 1',
        description: 'Test',
        category: 'development',
        systemPromptContent: 'Content',
        isDefault: true,
      });

      const role2 = await service.createRole({
        name: 'default-2',
        displayName: 'Default 2',
        description: 'Test',
        category: 'development',
        systemPromptContent: 'Content',
      });

      await service.setDefaultRole(role2.id);

      const updatedRole1 = await service.getRole(role1.id);
      expect(updatedRole1?.isDefault).toBe(false);
    });
  });

  describe('getDefaultRole', () => {
    it('should return the default role', async () => {
      const defaultRole = await service.getDefaultRole();
      expect(defaultRole).not.toBeNull();
      expect(defaultRole?.isDefault).toBe(true);
    });
  });
});

describe('getRoleService', () => {
  afterEach(() => {
    resetRoleService();
  });

  it('should return singleton instance', () => {
    const instance1 = getRoleService();
    const instance2 = getRoleService();
    expect(instance1).toBe(instance2);
  });
});
```

## Implementation Details

### Directory Structure

```
config/roles/                    # Built-in roles (read-only)
├── developer.json
├── developer-prompt.md
├── product-manager.json
├── product-manager-prompt.md
├── qa.json
├── qa-prompt.md
├── designer.json
├── designer-prompt.md
├── sales.json
├── sales-prompt.md
├── support.json
└── support-prompt.md

~/.agentmux/roles/               # User-created roles
├── custom-role-1.json
├── custom-role-1-prompt.md
└── ...
```

### JSON Role File Format

```json
{
  "id": "developer",
  "name": "developer",
  "displayName": "Developer",
  "description": "A software developer who writes clean, tested code",
  "category": "development",
  "systemPromptFile": "developer-prompt.md",
  "assignedSkills": ["code-review", "testing", "documentation"],
  "isDefault": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Error Handling

The service should throw descriptive errors:

```typescript
export class RoleNotFoundError extends Error {
  constructor(id: string) {
    super(`Role not found: ${id}`);
    this.name = 'RoleNotFoundError';
  }
}

export class RoleValidationError extends Error {
  constructor(errors: string[]) {
    super(`Role validation failed: ${errors.join(', ')}`);
    this.name = 'RoleValidationError';
  }
}

export class BuiltinRoleModificationError extends Error {
  constructor(action: string) {
    super(`Cannot ${action} a built-in role`);
    this.name = 'BuiltinRoleModificationError';
  }
}

export class DuplicateRoleNameError extends Error {
  constructor(name: string) {
    super(`A role with name "${name}" already exists`);
    this.name = 'DuplicateRoleNameError';
  }
}
```

## Default Role Prompts to Create

### 1. Developer (`config/roles/developer-prompt.md`)

```markdown
# Developer Role

You are a skilled software developer focused on writing clean, maintainable, and well-tested code.

## Core Responsibilities
- Write high-quality code following best practices
- Create comprehensive tests for all functionality
- Document code with clear comments and documentation
- Review code for quality and security issues
- Refactor code to improve maintainability

## Guidelines
- Always follow the project's coding standards
- Write tests before or alongside implementation
- Keep functions small and focused
- Use meaningful variable and function names
- Handle errors appropriately
```

### 2. Product Manager (`config/roles/product-manager-prompt.md`)

```markdown
# Product Manager Role

You are an experienced product manager focused on understanding user needs and translating them into actionable specifications.

## Core Responsibilities
- Gather and analyze requirements
- Create detailed product specifications
- Prioritize features based on user value
- Communicate with stakeholders
- Track progress and adjust plans

## Guidelines
- Focus on user outcomes, not just features
- Use data to inform decisions
- Keep specifications clear and unambiguous
- Consider technical constraints
- Maintain alignment with business goals
```

### 3-6. Create similar prompts for QA, Designer, Sales, and Support roles

## Acceptance Criteria

- [ ] RoleService class is fully implemented with all methods
- [ ] All CRUD operations work correctly
- [ ] Built-in roles are loaded from config/roles/
- [ ] User roles are saved to ~/.agentmux/roles/
- [ ] Built-in roles cannot be modified or deleted
- [ ] Skill assignment works correctly
- [ ] Default role management works
- [ ] Comprehensive test coverage (>80%)
- [ ] Error handling with descriptive error types
- [ ] All 6 default roles created with prompts

## Testing Requirements

1. Unit tests for all public methods
2. Integration tests for file operations
3. Edge case tests (empty directories, missing files)
4. Concurrent access tests (optional)
5. Test with mock file system for isolation

## Notes

- Use async/await for all file operations
- Cache roles in memory after loading (refresh on changes)
- Support both JSON and JSONC (JSON with comments) for role files
- Validate role files on load and report errors gracefully
