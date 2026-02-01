/**
 * Tests for Role Type Definitions
 *
 * @module types/role.types.test
 */

// Jest globals are available automatically
import {
  Role,
  RoleCategory,
  CreateRoleInput,
  UpdateRoleInput,
  RoleWithPrompt,
  RoleSummary,
  RoleFilter,
  RoleStorageFormat,
  ROLE_CATEGORIES,
  isValidRoleCategory,
  createDefaultRole,
  roleToSummary,
  validateCreateRoleInput,
  validateUpdateRoleInput,
  matchesRoleFilter,
  roleToStorageFormat,
  storageFormatToRole,
} from './role.types.js';

describe('Role Types', () => {
  describe('RoleCategory', () => {
    it('should have all expected categories', () => {
      const expectedCategories: RoleCategory[] = [
        'development',
        'management',
        'quality',
        'design',
        'sales',
        'support',
      ];

      expect(ROLE_CATEGORIES).toEqual(expectedCategories);
    });

    it('should have exactly 6 categories', () => {
      expect(ROLE_CATEGORIES).toHaveLength(6);
    });
  });

  describe('Role interface', () => {
    it('should define a minimal role', () => {
      const role: Role = {
        id: 'test-id',
        name: 'developer',
        displayName: 'Developer',
        description: 'A software developer',
        category: 'development',
        systemPromptFile: '/path/to/prompt.md',
        assignedSkills: [],
        isDefault: false,
        isBuiltin: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(role.id).toBe('test-id');
      expect(role.name).toBe('developer');
      expect(role.category).toBe('development');
    });

    it('should define a role with all fields', () => {
      const role: Role = {
        id: 'complete-id',
        name: 'product-manager',
        displayName: 'Product Manager',
        description: 'Manages product development',
        category: 'management',
        systemPromptFile: '/prompts/pm.md',
        assignedSkills: ['skill-1', 'skill-2', 'skill-3'],
        isDefault: true,
        isBuiltin: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-06-01T12:00:00Z',
      };

      expect(role.assignedSkills).toHaveLength(3);
      expect(role.isDefault).toBe(true);
      expect(role.isBuiltin).toBe(true);
    });
  });

  describe('CreateRoleInput interface', () => {
    it('should define required fields', () => {
      const input: CreateRoleInput = {
        name: 'new-role',
        displayName: 'New Role',
        description: 'A new custom role',
        category: 'development',
        systemPromptContent: 'You are a helpful assistant.',
      };

      expect(input.name).toBe('new-role');
      expect(input.systemPromptContent).toBeDefined();
    });

    it('should define optional fields', () => {
      const input: CreateRoleInput = {
        name: 'new-role',
        displayName: 'New Role',
        description: 'A new custom role',
        category: 'development',
        systemPromptContent: 'You are a helpful assistant.',
        assignedSkills: ['skill-1'],
        isDefault: true,
      };

      expect(input.assignedSkills).toEqual(['skill-1']);
      expect(input.isDefault).toBe(true);
    });
  });

  describe('UpdateRoleInput interface', () => {
    it('should allow partial updates', () => {
      const input: UpdateRoleInput = {
        displayName: 'Updated Name',
      };

      expect(input.displayName).toBe('Updated Name');
      expect(input.category).toBeUndefined();
    });

    it('should allow all fields to be updated', () => {
      const input: UpdateRoleInput = {
        displayName: 'Updated Name',
        description: 'Updated description',
        category: 'quality',
        systemPromptContent: 'Updated prompt',
        assignedSkills: ['new-skill'],
        isDefault: false,
      };

      expect(input.category).toBe('quality');
      expect(input.assignedSkills).toEqual(['new-skill']);
    });
  });

  describe('RoleWithPrompt interface', () => {
    it('should extend Role with prompt content', () => {
      const roleWithPrompt: RoleWithPrompt = {
        id: 'test-id',
        name: 'developer',
        displayName: 'Developer',
        description: 'A software developer',
        category: 'development',
        systemPromptFile: '/path/to/prompt.md',
        assignedSkills: [],
        isDefault: false,
        isBuiltin: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        systemPromptContent: 'You are a skilled software developer.',
      };

      expect(roleWithPrompt.systemPromptContent).toBe('You are a skilled software developer.');
    });
  });

  describe('RoleSummary interface', () => {
    it('should have skill count instead of skill array', () => {
      const summary: RoleSummary = {
        id: 'test-id',
        name: 'developer',
        displayName: 'Developer',
        description: 'A software developer',
        category: 'development',
        skillCount: 5,
        isDefault: false,
        isBuiltin: true,
      };

      expect(summary.skillCount).toBe(5);
      expect(summary).not.toHaveProperty('assignedSkills');
      expect(summary).not.toHaveProperty('systemPromptFile');
    });
  });

  describe('RoleFilter interface', () => {
    it('should allow filtering by single criteria', () => {
      const filter: RoleFilter = {
        category: 'development',
      };

      expect(filter.category).toBe('development');
    });

    it('should allow filtering by multiple criteria', () => {
      const filter: RoleFilter = {
        category: 'management',
        isBuiltin: true,
        hasSkill: 'skill-1',
        search: 'product',
      };

      expect(filter.category).toBe('management');
      expect(filter.isBuiltin).toBe(true);
      expect(filter.hasSkill).toBe('skill-1');
      expect(filter.search).toBe('product');
    });
  });

  describe('RoleStorageFormat interface', () => {
    it('should not include isBuiltin', () => {
      const stored: RoleStorageFormat = {
        id: 'test-id',
        name: 'developer',
        displayName: 'Developer',
        description: 'A software developer',
        category: 'development',
        systemPromptFile: '/path/to/prompt.md',
        assignedSkills: [],
        isDefault: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(stored).not.toHaveProperty('isBuiltin');
    });
  });

  describe('isValidRoleCategory', () => {
    it('should return true for all valid categories', () => {
      expect(isValidRoleCategory('development')).toBe(true);
      expect(isValidRoleCategory('management')).toBe(true);
      expect(isValidRoleCategory('quality')).toBe(true);
      expect(isValidRoleCategory('design')).toBe(true);
      expect(isValidRoleCategory('sales')).toBe(true);
      expect(isValidRoleCategory('support')).toBe(true);
    });

    it('should return false for invalid categories', () => {
      expect(isValidRoleCategory('invalid')).toBe(false);
      expect(isValidRoleCategory('')).toBe(false);
      expect(isValidRoleCategory('DEVELOPMENT')).toBe(false);
      expect(isValidRoleCategory('dev')).toBe(false);
    });

    it('should return false for non-string types coerced to string', () => {
      expect(isValidRoleCategory(String(null))).toBe(false);
      expect(isValidRoleCategory(String(undefined))).toBe(false);
      expect(isValidRoleCategory(String(123))).toBe(false);
    });
  });

  describe('createDefaultRole', () => {
    it('should create a role with required fields only', () => {
      const role = createDefaultRole({
        name: 'test-role',
        displayName: 'Test Role',
      });

      expect(role.name).toBe('test-role');
      expect(role.displayName).toBe('Test Role');
      expect(role.id).toBeDefined();
      expect(role.id.length).toBeGreaterThan(0);
      expect(role.description).toBe('');
      expect(role.category).toBe('development');
      expect(role.systemPromptFile).toBe('');
      expect(role.assignedSkills).toEqual([]);
      expect(role.isDefault).toBe(false);
      expect(role.isBuiltin).toBe(false);
      expect(role.createdAt).toBeDefined();
      expect(role.updatedAt).toBeDefined();
    });

    it('should allow overriding default values', () => {
      const role = createDefaultRole({
        name: 'custom-role',
        displayName: 'Custom Role',
        description: 'A custom role',
        category: 'quality',
        systemPromptFile: '/custom/prompt.md',
        assignedSkills: ['skill-1', 'skill-2'],
        isDefault: true,
      });

      expect(role.description).toBe('A custom role');
      expect(role.category).toBe('quality');
      expect(role.systemPromptFile).toBe('/custom/prompt.md');
      expect(role.assignedSkills).toEqual(['skill-1', 'skill-2']);
      expect(role.isDefault).toBe(true);
    });

    it('should generate unique IDs', () => {
      const role1 = createDefaultRole({ name: 'role-1', displayName: 'Role 1' });
      const role2 = createDefaultRole({ name: 'role-2', displayName: 'Role 2' });

      expect(role1.id).not.toBe(role2.id);
    });

    it('should use provided ID if given', () => {
      const role = createDefaultRole({
        id: 'custom-id',
        name: 'test-role',
        displayName: 'Test Role',
      });

      expect(role.id).toBe('custom-id');
    });

    it('should always set isBuiltin to false', () => {
      // isBuiltin is intentionally not overridable via createDefaultRole
      // as built-in roles are loaded from system files
      const role = createDefaultRole({
        name: 'test-role',
        displayName: 'Test Role',
      });

      expect(role.isBuiltin).toBe(false);
    });

    it('should set matching createdAt and updatedAt timestamps', () => {
      const role = createDefaultRole({
        name: 'test-role',
        displayName: 'Test Role',
      });

      expect(role.createdAt).toBe(role.updatedAt);
    });
  });

  describe('roleToSummary', () => {
    const testRole: Role = {
      id: 'test-id',
      name: 'developer',
      displayName: 'Developer',
      description: 'A software developer',
      category: 'development',
      systemPromptFile: '/path/to/prompt.md',
      assignedSkills: ['skill-1', 'skill-2'],
      isDefault: false,
      isBuiltin: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    it('should convert Role to RoleSummary', () => {
      const summary = roleToSummary(testRole);

      expect(summary.id).toBe('test-id');
      expect(summary.name).toBe('developer');
      expect(summary.displayName).toBe('Developer');
      expect(summary.description).toBe('A software developer');
      expect(summary.category).toBe('development');
      expect(summary.skillCount).toBe(2);
      expect(summary.isDefault).toBe(false);
      expect(summary.isBuiltin).toBe(true);
    });

    it('should not include systemPromptFile', () => {
      const summary = roleToSummary(testRole);
      expect(summary).not.toHaveProperty('systemPromptFile');
    });

    it('should not include createdAt or updatedAt', () => {
      const summary = roleToSummary(testRole);
      expect(summary).not.toHaveProperty('createdAt');
      expect(summary).not.toHaveProperty('updatedAt');
    });

    it('should not include assignedSkills array', () => {
      const summary = roleToSummary(testRole);
      expect(summary).not.toHaveProperty('assignedSkills');
    });

    it('should handle role with no skills', () => {
      const roleNoSkills: Role = { ...testRole, assignedSkills: [] };
      const summary = roleToSummary(roleNoSkills);
      expect(summary.skillCount).toBe(0);
    });
  });

  describe('validateCreateRoleInput', () => {
    const validInput: CreateRoleInput = {
      name: 'test-role',
      displayName: 'Test Role',
      description: 'A test role',
      category: 'development',
      systemPromptContent: 'You are a helpful assistant.',
    };

    it('should return empty array for valid input', () => {
      const errors = validateCreateRoleInput(validInput);
      expect(errors).toEqual([]);
    });

    it('should require name', () => {
      const input = { ...validInput, name: '' };
      const errors = validateCreateRoleInput(input);
      expect(errors).toContain('Name is required');
    });

    it('should require name to be lowercase with hyphens only', () => {
      const input = { ...validInput, name: 'Invalid Name' };
      const errors = validateCreateRoleInput(input);
      expect(errors).toContain('Name must contain only lowercase letters, numbers, and hyphens');
    });

    it('should allow hyphens and numbers in name', () => {
      const input = { ...validInput, name: 'test-role-123' };
      const errors = validateCreateRoleInput(input);
      expect(errors).toEqual([]);
    });

    it('should require displayName', () => {
      const input = { ...validInput, displayName: '' };
      const errors = validateCreateRoleInput(input);
      expect(errors).toContain('Display name is required');
    });

    it('should require description', () => {
      const input = { ...validInput, description: '' };
      const errors = validateCreateRoleInput(input);
      expect(errors).toContain('Description is required');
    });

    it('should require valid category', () => {
      const input = { ...validInput, category: 'invalid' as RoleCategory };
      const errors = validateCreateRoleInput(input);
      expect(errors).toContain('Invalid category: invalid');
    });

    it('should require systemPromptContent', () => {
      const input = { ...validInput, systemPromptContent: '' };
      const errors = validateCreateRoleInput(input);
      expect(errors).toContain('System prompt content is required');
    });

    it('should validate assignedSkills is an array', () => {
      const input = { ...validInput, assignedSkills: 'not-an-array' as unknown as string[] };
      const errors = validateCreateRoleInput(input);
      expect(errors).toContain('Assigned skills must be an array');
    });

    it('should accept valid assignedSkills array', () => {
      const input = { ...validInput, assignedSkills: ['skill-1', 'skill-2'] };
      const errors = validateCreateRoleInput(input);
      expect(errors).toEqual([]);
    });

    it('should return multiple errors for multiple invalid fields', () => {
      const input: CreateRoleInput = {
        name: '',
        displayName: '',
        description: '',
        category: 'invalid' as RoleCategory,
        systemPromptContent: '',
      };
      const errors = validateCreateRoleInput(input);
      expect(errors.length).toBeGreaterThanOrEqual(5);
    });

    it('should trim whitespace when checking for empty values', () => {
      const input = { ...validInput, name: '   ' };
      const errors = validateCreateRoleInput(input);
      expect(errors).toContain('Name is required');
    });
  });

  describe('validateUpdateRoleInput', () => {
    it('should return empty array for valid partial update', () => {
      const input: UpdateRoleInput = { displayName: 'New Name' };
      const errors = validateUpdateRoleInput(input);
      expect(errors).toEqual([]);
    });

    it('should return empty array for empty input', () => {
      const input: UpdateRoleInput = {};
      const errors = validateUpdateRoleInput(input);
      expect(errors).toEqual([]);
    });

    it('should not allow empty displayName', () => {
      const input: UpdateRoleInput = { displayName: '' };
      const errors = validateUpdateRoleInput(input);
      expect(errors).toContain('Display name cannot be empty');
    });

    it('should validate category if provided', () => {
      const input: UpdateRoleInput = { category: 'invalid' as RoleCategory };
      const errors = validateUpdateRoleInput(input);
      expect(errors).toContain('Invalid category: invalid');
    });

    it('should not allow empty systemPromptContent', () => {
      const input: UpdateRoleInput = { systemPromptContent: '' };
      const errors = validateUpdateRoleInput(input);
      expect(errors).toContain('System prompt content cannot be empty');
    });

    it('should validate assignedSkills is an array if provided', () => {
      const input: UpdateRoleInput = { assignedSkills: 'not-array' as unknown as string[] };
      const errors = validateUpdateRoleInput(input);
      expect(errors).toContain('Assigned skills must be an array');
    });

    it('should accept valid full update', () => {
      const input: UpdateRoleInput = {
        displayName: 'Updated Name',
        description: 'Updated description',
        category: 'quality',
        systemPromptContent: 'Updated prompt',
        assignedSkills: ['skill-1'],
        isDefault: true,
      };
      const errors = validateUpdateRoleInput(input);
      expect(errors).toEqual([]);
    });
  });

  describe('matchesRoleFilter', () => {
    const testRole: Role = {
      id: 'test-id',
      name: 'developer',
      displayName: 'Software Developer',
      description: 'Writes code and builds features',
      category: 'development',
      systemPromptFile: '/path/to/prompt.md',
      assignedSkills: ['code-review', 'testing'],
      isDefault: false,
      isBuiltin: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    it('should match when filter is empty', () => {
      expect(matchesRoleFilter(testRole, {})).toBe(true);
    });

    it('should filter by category', () => {
      expect(matchesRoleFilter(testRole, { category: 'development' })).toBe(true);
      expect(matchesRoleFilter(testRole, { category: 'management' })).toBe(false);
    });

    it('should filter by isBuiltin', () => {
      expect(matchesRoleFilter(testRole, { isBuiltin: true })).toBe(true);
      expect(matchesRoleFilter(testRole, { isBuiltin: false })).toBe(false);
    });

    it('should filter by hasSkill', () => {
      expect(matchesRoleFilter(testRole, { hasSkill: 'code-review' })).toBe(true);
      expect(matchesRoleFilter(testRole, { hasSkill: 'testing' })).toBe(true);
      expect(matchesRoleFilter(testRole, { hasSkill: 'design' })).toBe(false);
    });

    it('should filter by search in name', () => {
      expect(matchesRoleFilter(testRole, { search: 'developer' })).toBe(true);
      expect(matchesRoleFilter(testRole, { search: 'dev' })).toBe(true);
    });

    it('should filter by search in displayName', () => {
      expect(matchesRoleFilter(testRole, { search: 'Software' })).toBe(true);
    });

    it('should filter by search in description', () => {
      expect(matchesRoleFilter(testRole, { search: 'code' })).toBe(true);
      expect(matchesRoleFilter(testRole, { search: 'builds' })).toBe(true);
    });

    it('should be case-insensitive for search', () => {
      expect(matchesRoleFilter(testRole, { search: 'DEVELOPER' })).toBe(true);
      expect(matchesRoleFilter(testRole, { search: 'software' })).toBe(true);
    });

    it('should return false when search does not match', () => {
      expect(matchesRoleFilter(testRole, { search: 'manager' })).toBe(false);
    });

    it('should combine multiple filter criteria with AND', () => {
      expect(matchesRoleFilter(testRole, { category: 'development', isBuiltin: true })).toBe(true);
      expect(matchesRoleFilter(testRole, { category: 'development', isBuiltin: false })).toBe(false);
      expect(matchesRoleFilter(testRole, { category: 'management', isBuiltin: true })).toBe(false);
    });

    it('should ignore empty search string', () => {
      expect(matchesRoleFilter(testRole, { search: '' })).toBe(true);
      expect(matchesRoleFilter(testRole, { search: '   ' })).toBe(true);
    });
  });

  describe('roleToStorageFormat', () => {
    const testRole: Role = {
      id: 'test-id',
      name: 'developer',
      displayName: 'Developer',
      description: 'A software developer',
      category: 'development',
      systemPromptFile: '/path/to/prompt.md',
      assignedSkills: ['skill-1', 'skill-2'],
      isDefault: false,
      isBuiltin: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    it('should convert Role to storage format', () => {
      const stored = roleToStorageFormat(testRole);

      expect(stored.id).toBe('test-id');
      expect(stored.name).toBe('developer');
      expect(stored.displayName).toBe('Developer');
      expect(stored.description).toBe('A software developer');
      expect(stored.category).toBe('development');
      expect(stored.systemPromptFile).toBe('/path/to/prompt.md');
      expect(stored.assignedSkills).toEqual(['skill-1', 'skill-2']);
      expect(stored.isDefault).toBe(false);
      expect(stored.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(stored.updatedAt).toBe('2024-01-01T00:00:00Z');
    });

    it('should not include isBuiltin in storage format', () => {
      const stored = roleToStorageFormat(testRole);
      expect(stored).not.toHaveProperty('isBuiltin');
    });
  });

  describe('storageFormatToRole', () => {
    const storedRole: RoleStorageFormat = {
      id: 'test-id',
      name: 'developer',
      displayName: 'Developer',
      description: 'A software developer',
      category: 'development',
      systemPromptFile: '/path/to/prompt.md',
      assignedSkills: ['skill-1', 'skill-2'],
      isDefault: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    it('should convert storage format to Role with isBuiltin true', () => {
      const role = storageFormatToRole(storedRole, true);

      expect(role.id).toBe('test-id');
      expect(role.name).toBe('developer');
      expect(role.isBuiltin).toBe(true);
    });

    it('should convert storage format to Role with isBuiltin false', () => {
      const role = storageFormatToRole(storedRole, false);

      expect(role.isBuiltin).toBe(false);
    });

    it('should preserve all other fields', () => {
      const role = storageFormatToRole(storedRole, true);

      expect(role.displayName).toBe('Developer');
      expect(role.description).toBe('A software developer');
      expect(role.category).toBe('development');
      expect(role.systemPromptFile).toBe('/path/to/prompt.md');
      expect(role.assignedSkills).toEqual(['skill-1', 'skill-2']);
      expect(role.isDefault).toBe(false);
      expect(role.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(role.updatedAt).toBe('2024-01-01T00:00:00Z');
    });
  });
});
