/**
 * Tests for Role Management Service
 *
 * @module services/settings/role.service.test
 */

// Jest globals are available automatically
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  RoleService,
  getRoleService,
  resetRoleService,
  RoleNotFoundError,
  RoleValidationError,
  BuiltinRoleModificationError,
  DuplicateRoleNameError,
} from './role.service.js';
import { CreateRoleInput, Role, RoleStorageFormat } from '../../types/role.types.js';

describe('RoleService', () => {
  let service: RoleService;
  let testDir: string;
  let builtinRolesDir: string;
  let userRolesDir: string;

  beforeEach(async () => {
    // Create temporary directories for testing
    testDir = path.join(os.tmpdir(), `role-service-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    builtinRolesDir = path.join(testDir, 'builtin');
    userRolesDir = path.join(testDir, 'user');

    await fs.mkdir(builtinRolesDir, { recursive: true });
    await fs.mkdir(userRolesDir, { recursive: true });

    // Create a sample builtin role in subdirectory structure
    const developerDir = path.join(builtinRolesDir, 'developer');
    await fs.mkdir(developerDir, { recursive: true });

    const sampleRole: RoleStorageFormat = {
      id: 'developer',
      name: 'developer',
      displayName: 'Developer',
      description: 'A software developer role',
      category: 'development',
      systemPromptFile: 'prompt.md',
      assignedSkills: [],
      isDefault: true,
      isHidden: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(
      path.join(developerDir, 'role.json'),
      JSON.stringify(sampleRole, null, 2)
    );

    await fs.writeFile(
      path.join(developerDir, 'prompt.md'),
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
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
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

    it('should be idempotent (calling multiple times is safe)', async () => {
      await service.initialize();
      await service.initialize();

      const roles = await service.listRoles();
      const developerRoles = roles.filter(r => r.name === 'developer');
      expect(developerRoles).toHaveLength(1);
    });

    it('should handle empty directories gracefully', async () => {
      const emptyBuiltinDir = path.join(testDir, 'empty-builtin');
      const emptyUserDir = path.join(testDir, 'empty-user');

      await fs.mkdir(emptyBuiltinDir, { recursive: true });
      await fs.mkdir(emptyUserDir, { recursive: true });

      const emptyService = new RoleService({
        builtinRolesDir: emptyBuiltinDir,
        userRolesDir: emptyUserDir,
      });

      await emptyService.initialize();
      const roles = await emptyService.listRoles();
      expect(roles).toHaveLength(0);
    });

    it('should handle missing directories gracefully', async () => {
      const missingService = new RoleService({
        builtinRolesDir: '/nonexistent/builtin',
        userRolesDir: '/nonexistent/user',
      });

      await missingService.initialize();
      const roles = await missingService.listRoles();
      expect(roles).toHaveLength(0);
    });
  });

  describe('listRoles', () => {
    it('should return all roles without filter', async () => {
      const roles = await service.listRoles();
      expect(Array.isArray(roles)).toBe(true);
      expect(roles.length).toBeGreaterThan(0);
    });

    it('should filter by category', async () => {
      const roles = await service.listRoles({ category: 'development' });
      expect(roles.every(r => r.category === 'development')).toBe(true);
    });

    it('should return empty array for non-matching category', async () => {
      const roles = await service.listRoles({ category: 'sales' });
      expect(roles).toHaveLength(0);
    });

    it('should filter by isBuiltin', async () => {
      const builtinRoles = await service.listRoles({ isBuiltin: true });
      expect(builtinRoles.every(r => r.isBuiltin)).toBe(true);
    });

    it('should filter by search term in name', async () => {
      const roles = await service.listRoles({ search: 'developer' });
      expect(roles.length).toBeGreaterThan(0);
    });

    it('should filter by search term in displayName', async () => {
      const roles = await service.listRoles({ search: 'Developer' });
      expect(roles.length).toBeGreaterThan(0);
    });

    it('should filter by search term in description', async () => {
      const roles = await service.listRoles({ search: 'software' });
      expect(roles.some(r => r.description.toLowerCase().includes('software'))).toBe(true);
    });

    it('should combine multiple filters with AND logic', async () => {
      const roles = await service.listRoles({
        category: 'development',
        isBuiltin: true,
        search: 'developer',
      });
      expect(roles.every(r =>
        r.category === 'development' &&
        r.isBuiltin === true
      )).toBe(true);
    });

    it('should return RoleSummary objects', async () => {
      const roles = await service.listRoles();
      const role = roles[0];

      expect(role).toHaveProperty('id');
      expect(role).toHaveProperty('name');
      expect(role).toHaveProperty('displayName');
      expect(role).toHaveProperty('description');
      expect(role).toHaveProperty('category');
      expect(role).toHaveProperty('skillCount');
      expect(role).toHaveProperty('isDefault');
      expect(role).toHaveProperty('isBuiltin');
      expect(role).not.toHaveProperty('systemPromptFile');
      expect(role).not.toHaveProperty('assignedSkills');
    });

    it('should auto-initialize when listRoles is called', async () => {
      const uninitializedService = new RoleService({
        builtinRolesDir,
        userRolesDir,
      });

      // RoleService uses lazy initialization - listRoles will auto-initialize
      const roles = await uninitializedService.listRoles();
      expect(Array.isArray(roles)).toBe(true);
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

    it('should include all Role fields', async () => {
      const role = await service.getRoleByName('developer');

      expect(role).toHaveProperty('id');
      expect(role).toHaveProperty('name');
      expect(role).toHaveProperty('displayName');
      expect(role).toHaveProperty('description');
      expect(role).toHaveProperty('category');
      expect(role).toHaveProperty('systemPromptFile');
      expect(role).toHaveProperty('assignedSkills');
      expect(role).toHaveProperty('isDefault');
      expect(role).toHaveProperty('isBuiltin');
      expect(role).toHaveProperty('createdAt');
      expect(role).toHaveProperty('updatedAt');
      expect(role).toHaveProperty('systemPromptContent');
    });
  });

  describe('getRoleByName', () => {
    it('should find role by name', async () => {
      const role = await service.getRoleByName('developer');
      expect(role).not.toBeNull();
      expect(role?.name).toBe('developer');
    });

    it('should return null for non-existent name', async () => {
      const role = await service.getRoleByName('non-existent');
      expect(role).toBeNull();
    });

    it('should be case-sensitive', async () => {
      const role = await service.getRoleByName('Developer');
      expect(role).toBeNull();
    });
  });

  describe('createRole', () => {
    const validInput: CreateRoleInput = {
      name: 'custom-role',
      displayName: 'Custom Role',
      description: 'A custom role',
      category: 'development',
      systemPromptContent: '# Custom Role\n\nYou are a custom role...',
    };

    it('should create a new user role', async () => {
      const role = await service.createRole(validInput);

      expect(role.id).toBeDefined();
      expect(role.name).toBe('custom-role');
      expect(role.displayName).toBe('Custom Role');
      expect(role.isBuiltin).toBe(false);
    });

    it('should save role to user roles directory', async () => {
      await service.createRole(validInput);

      const files = await fs.readdir(userRolesDir);
      expect(files.some(f => f.includes('custom-role'))).toBe(true);
    });

    it('should save prompt file', async () => {
      await service.createRole(validInput);

      const files = await fs.readdir(userRolesDir);
      expect(files.some(f => f.includes('-prompt.md'))).toBe(true);
    });

    it('should generate unique IDs', async () => {
      const role1 = await service.createRole(validInput);
      const role2 = await service.createRole({
        ...validInput,
        name: 'another-role',
      });

      expect(role1.id).not.toBe(role2.id);
    });

    it('should throw DuplicateRoleNameError for duplicate name', async () => {
      await service.createRole(validInput);

      await expect(service.createRole(validInput)).rejects.toThrow(DuplicateRoleNameError);
    });

    it('should throw DuplicateRoleNameError for builtin role name', async () => {
      const input = { ...validInput, name: 'developer' };

      await expect(service.createRole(input)).rejects.toThrow(DuplicateRoleNameError);
    });

    it('should throw RoleValidationError for invalid input', async () => {
      const input = {
        name: '',
        displayName: '',
        description: '',
        category: 'invalid' as any,
        systemPromptContent: '',
      };

      await expect(service.createRole(input)).rejects.toThrow(RoleValidationError);
    });

    it('should throw RoleValidationError with error details', async () => {
      const input = {
        name: '',
        displayName: '',
        description: '',
        category: 'development' as any,
        systemPromptContent: '',
      };

      try {
        await service.createRole(input);
        fail('Expected RoleValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(RoleValidationError);
        expect((err as RoleValidationError).errors.length).toBeGreaterThan(0);
      }
    });

    it('should assign skills when provided', async () => {
      const input = {
        ...validInput,
        name: 'skilled-role',
        assignedSkills: ['skill-1', 'skill-2'],
      };

      const role = await service.createRole(input);
      expect(role.assignedSkills).toEqual(['skill-1', 'skill-2']);
    });

    it('should set isDefault when provided', async () => {
      const input = {
        ...validInput,
        name: 'default-role',
        isDefault: true,
      };

      const role = await service.createRole(input);
      expect(role.isDefault).toBe(true);
    });

    it('should unset other defaults when creating default role', async () => {
      const input = {
        ...validInput,
        name: 'new-default',
        isDefault: true,
      };

      await service.createRole(input);

      const developerRole = await service.getRoleByName('developer');
      expect(developerRole?.isDefault).toBe(false);
    });

    it('should be retrievable after creation', async () => {
      const created = await service.createRole(validInput);
      const retrieved = await service.getRole(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.systemPromptContent).toContain('Custom Role');
    });
  });

  describe('updateRole', () => {
    let createdRole: Role;

    beforeEach(async () => {
      createdRole = await service.createRole({
        name: 'update-test',
        displayName: 'Update Test',
        description: 'Test role for updates',
        category: 'development',
        systemPromptContent: 'Original content',
      });
    });

    it('should update user-created role', async () => {
      const updated = await service.updateRole(createdRole.id, {
        displayName: 'Updated Name',
      });

      expect(updated.displayName).toBe('Updated Name');
    });

    it('should update multiple fields', async () => {
      const updated = await service.updateRole(createdRole.id, {
        displayName: 'New Name',
        description: 'New description',
        category: 'quality',
      });

      expect(updated.displayName).toBe('New Name');
      expect(updated.description).toBe('New description');
      expect(updated.category).toBe('quality');
    });

    it('should update prompt content', async () => {
      await service.updateRole(createdRole.id, {
        systemPromptContent: 'Updated prompt content',
      });

      const role = await service.getRole(createdRole.id);
      expect(role?.systemPromptContent).toBe('Updated prompt content');
    });

    it('should update updatedAt timestamp', async () => {
      const originalUpdatedAt = createdRole.updatedAt;

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await service.updateRole(createdRole.id, {
        displayName: 'New Name',
      });

      expect(updated.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('should throw RoleNotFoundError for non-existent role', async () => {
      await expect(
        service.updateRole('non-existent-id', { displayName: 'New Name' })
      ).rejects.toThrow(RoleNotFoundError);
    });

    it('should throw BuiltinRoleModificationError for builtin role', async () => {
      const developerRole = await service.getRoleByName('developer');

      await expect(
        service.updateRole(developerRole!.id, { displayName: 'Modified' })
      ).rejects.toThrow(BuiltinRoleModificationError);
    });

    it('should throw RoleValidationError for invalid input', async () => {
      await expect(
        service.updateRole(createdRole.id, { category: 'invalid' as any })
      ).rejects.toThrow(RoleValidationError);
    });

    it('should persist changes to disk', async () => {
      await service.updateRole(createdRole.id, {
        displayName: 'Persisted Name',
      });

      // Refresh and check
      await service.refresh();
      const role = await service.getRole(createdRole.id);
      expect(role?.displayName).toBe('Persisted Name');
    });
  });

  describe('deleteRole', () => {
    let createdRole: Role;

    beforeEach(async () => {
      createdRole = await service.createRole({
        name: 'delete-test',
        displayName: 'Delete Test',
        description: 'Test role for deletion',
        category: 'development',
        systemPromptContent: 'Content to delete',
      });
    });

    it('should delete user-created role', async () => {
      await service.deleteRole(createdRole.id);

      const role = await service.getRole(createdRole.id);
      expect(role).toBeNull();
    });

    it('should remove role from list', async () => {
      await service.deleteRole(createdRole.id);

      const roles = await service.listRoles();
      expect(roles.find(r => r.id === createdRole.id)).toBeUndefined();
    });

    it('should delete files from disk', async () => {
      await service.deleteRole(createdRole.id);

      const files = await fs.readdir(userRolesDir);
      expect(files.some(f => f.includes('delete-test'))).toBe(false);
    });

    it('should throw RoleNotFoundError for non-existent role', async () => {
      await expect(service.deleteRole('non-existent-id')).rejects.toThrow(RoleNotFoundError);
    });

    it('should throw BuiltinRoleModificationError for builtin role', async () => {
      const developerRole = await service.getRoleByName('developer');

      await expect(service.deleteRole(developerRole!.id)).rejects.toThrow(BuiltinRoleModificationError);
    });

    it('should handle already deleted role gracefully', async () => {
      await service.deleteRole(createdRole.id);

      await expect(service.deleteRole(createdRole.id)).rejects.toThrow(RoleNotFoundError);
    });
  });

  describe('assignSkills', () => {
    let createdRole: Role;

    beforeEach(async () => {
      createdRole = await service.createRole({
        name: 'skill-test',
        displayName: 'Skill Test',
        description: 'Test role for skills',
        category: 'development',
        systemPromptContent: 'Content',
      });
    });

    it('should add skills to role', async () => {
      const updated = await service.assignSkills(createdRole.id, ['skill-1', 'skill-2']);

      expect(updated.assignedSkills).toContain('skill-1');
      expect(updated.assignedSkills).toContain('skill-2');
    });

    it('should not duplicate existing skills', async () => {
      await service.assignSkills(createdRole.id, ['skill-1']);
      const updated = await service.assignSkills(createdRole.id, ['skill-1', 'skill-2']);

      expect(updated.assignedSkills.filter(s => s === 'skill-1').length).toBe(1);
      expect(updated.assignedSkills).toContain('skill-2');
    });

    it('should throw RoleNotFoundError for non-existent role', async () => {
      await expect(
        service.assignSkills('non-existent-id', ['skill-1'])
      ).rejects.toThrow(RoleNotFoundError);
    });

    it('should throw BuiltinRoleModificationError for builtin role', async () => {
      const developerRole = await service.getRoleByName('developer');

      await expect(
        service.assignSkills(developerRole!.id, ['skill-1'])
      ).rejects.toThrow(BuiltinRoleModificationError);
    });

    it('should persist changes', async () => {
      await service.assignSkills(createdRole.id, ['skill-1']);

      await service.refresh();
      const role = await service.getRole(createdRole.id);
      expect(role?.assignedSkills).toContain('skill-1');
    });
  });

  describe('removeSkills', () => {
    let createdRole: Role;

    beforeEach(async () => {
      createdRole = await service.createRole({
        name: 'remove-skill-test',
        displayName: 'Remove Skill Test',
        description: 'Test role for removing skills',
        category: 'development',
        systemPromptContent: 'Content',
        assignedSkills: ['skill-1', 'skill-2', 'skill-3'],
      });
    });

    it('should remove skills from role', async () => {
      const updated = await service.removeSkills(createdRole.id, ['skill-2']);

      expect(updated.assignedSkills).toContain('skill-1');
      expect(updated.assignedSkills).not.toContain('skill-2');
      expect(updated.assignedSkills).toContain('skill-3');
    });

    it('should remove multiple skills', async () => {
      const updated = await service.removeSkills(createdRole.id, ['skill-1', 'skill-3']);

      expect(updated.assignedSkills).toEqual(['skill-2']);
    });

    it('should handle removing non-existent skills gracefully', async () => {
      const updated = await service.removeSkills(createdRole.id, ['non-existent']);

      expect(updated.assignedSkills).toEqual(['skill-1', 'skill-2', 'skill-3']);
    });

    it('should throw RoleNotFoundError for non-existent role', async () => {
      await expect(
        service.removeSkills('non-existent-id', ['skill-1'])
      ).rejects.toThrow(RoleNotFoundError);
    });

    it('should throw BuiltinRoleModificationError for builtin role', async () => {
      const developerRole = await service.getRoleByName('developer');

      await expect(
        service.removeSkills(developerRole!.id, ['skill-1'])
      ).rejects.toThrow(BuiltinRoleModificationError);
    });
  });

  describe('setDefaultRole', () => {
    let createdRole: Role;

    beforeEach(async () => {
      createdRole = await service.createRole({
        name: 'default-test',
        displayName: 'Default Test',
        description: 'Test role for default',
        category: 'development',
        systemPromptContent: 'Content',
      });
    });

    it('should set a role as default', async () => {
      const updated = await service.setDefaultRole(createdRole.id);

      expect(updated.isDefault).toBe(true);
    });

    it('should unset previous default role', async () => {
      // Developer is default initially
      await service.setDefaultRole(createdRole.id);

      const developerRole = await service.getRoleByName('developer');
      expect(developerRole?.isDefault).toBe(false);
    });

    it('should update getDefaultRole result', async () => {
      await service.setDefaultRole(createdRole.id);

      const defaultRole = await service.getDefaultRole();
      expect(defaultRole?.id).toBe(createdRole.id);
    });

    it('should throw RoleNotFoundError for non-existent role', async () => {
      await expect(service.setDefaultRole('non-existent-id')).rejects.toThrow(RoleNotFoundError);
    });

    it('should work with builtin roles', async () => {
      const developerRole = await service.getRoleByName('developer');

      // First, set a different role as default
      await service.setDefaultRole(createdRole.id);

      // Then set builtin role as default (should work)
      const updated = await service.setDefaultRole(developerRole!.id);
      expect(updated.isDefault).toBe(true);
    });
  });

  describe('getDefaultRole', () => {
    it('should return the default role', async () => {
      const defaultRole = await service.getDefaultRole();
      expect(defaultRole).not.toBeNull();
      expect(defaultRole?.isDefault).toBe(true);
    });

    it('should return developer as initial default', async () => {
      const defaultRole = await service.getDefaultRole();
      expect(defaultRole?.name).toBe('developer');
    });

    it('should return null when no default is set', async () => {
      // Create a new service with no roles
      const emptyDir = path.join(testDir, 'empty');
      await fs.mkdir(emptyDir, { recursive: true });

      const emptyService = new RoleService({
        builtinRolesDir: emptyDir,
        userRolesDir: emptyDir,
      });
      await emptyService.initialize();

      const defaultRole = await emptyService.getDefaultRole();
      expect(defaultRole).toBeNull();
    });
  });

  describe('refresh', () => {
    it('should reload roles from disk', async () => {
      // Create a role directly on disk
      const newRole: RoleStorageFormat = {
        id: 'disk-created',
        name: 'disk-created',
        displayName: 'Disk Created',
        description: 'Created directly on disk',
        category: 'development',
        systemPromptFile: 'disk-created-prompt.md',
        assignedSkills: [],
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await fs.writeFile(
        path.join(userRolesDir, 'disk-created.json'),
        JSON.stringify(newRole, null, 2)
      );
      await fs.writeFile(
        path.join(userRolesDir, 'disk-created-prompt.md'),
        'Disk created prompt'
      );

      // Refresh and check
      await service.refresh();
      const role = await service.getRoleByName('disk-created');
      expect(role).not.toBeNull();
    });

    it('should reflect deleted roles', async () => {
      const created = await service.createRole({
        name: 'to-delete-externally',
        displayName: 'To Delete Externally',
        description: 'Will be deleted outside service',
        category: 'development',
        systemPromptContent: 'Content',
      });

      // Delete directly from disk
      await fs.unlink(path.join(userRolesDir, 'to-delete-externally.json'));
      await fs.unlink(path.join(userRolesDir, 'to-delete-externally-prompt.md'));

      // Refresh and check
      await service.refresh();
      const role = await service.getRole(created.id);
      expect(role).toBeNull();
    });
  });
});

describe('Error Classes', () => {
  describe('RoleNotFoundError', () => {
    it('should have correct name and message', () => {
      const error = new RoleNotFoundError('test-id');
      expect(error.name).toBe('RoleNotFoundError');
      expect(error.message).toContain('test-id');
    });

    it('should be instanceof Error', () => {
      const error = new RoleNotFoundError('test-id');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('RoleValidationError', () => {
    it('should have correct name and message', () => {
      const error = new RoleValidationError(['Error 1', 'Error 2']);
      expect(error.name).toBe('RoleValidationError');
      expect(error.message).toContain('Error 1');
      expect(error.message).toContain('Error 2');
    });

    it('should expose errors array', () => {
      const errors = ['Error 1', 'Error 2'];
      const error = new RoleValidationError(errors);
      expect(error.errors).toEqual(errors);
    });
  });

  describe('BuiltinRoleModificationError', () => {
    it('should have correct name and message', () => {
      const error = new BuiltinRoleModificationError('delete');
      expect(error.name).toBe('BuiltinRoleModificationError');
      expect(error.message).toContain('delete');
      expect(error.message).toContain('built-in');
    });
  });

  describe('DuplicateRoleNameError', () => {
    it('should have correct name and message', () => {
      const error = new DuplicateRoleNameError('test-role');
      expect(error.name).toBe('DuplicateRoleNameError');
      expect(error.message).toContain('test-role');
      expect(error.message).toContain('already exists');
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

  it('should return different instance after reset', () => {
    const instance1 = getRoleService();
    resetRoleService();
    const instance2 = getRoleService();
    expect(instance1).not.toBe(instance2);
  });
});

describe('resetRoleService', () => {
  it('should clear the singleton instance', () => {
    const instance1 = getRoleService();
    resetRoleService();
    const instance2 = getRoleService();
    expect(instance1).not.toBe(instance2);
  });
});
