/**
 * Tests for Skill Type Definitions
 *
 * @module types/skill.types.test
 */

// Jest globals are available automatically
import {
  Skill,
  SkillCategory,
  SkillExecutionType,
  ScriptInterpreter,
  CreateSkillInput,
  UpdateSkillInput,
  SkillSummary,
  SkillFilter,
  SkillExecutionConfig,
  SkillStorageFormat,
  SKILL_CATEGORIES,
  SKILL_CATEGORY_DISPLAY_NAMES,
  EXECUTION_TYPES,
  EXECUTION_TYPE_DISPLAY_NAMES,
  SCRIPT_INTERPRETERS,
  SKILL_CONSTANTS,
  isValidSkillCategory,
  isValidExecutionType,
  isValidScriptInterpreter,
  createDefaultSkill,
  skillToSummary,
  skillToStorageFormat,
  storageFormatToSkill,
  getSkillCategoryDisplayName,
  getExecutionTypeDisplayName,
  validateCreateSkillInput,
  validateUpdateSkillInput,
  validateSkillExecution,
  matchesSkillFilter,
} from './skill.types.js';

describe('Skill Types', () => {
  // ==========================================================================
  // Constants Tests
  // ==========================================================================

  describe('SKILL_CATEGORIES', () => {
    it('should have all expected categories', () => {
      const expectedCategories: SkillCategory[] = [
        'development',
        'design',
        'communication',
        'research',
        'content-creation',
        'automation',
        'analysis',
        'integration',
      ];

      expect(SKILL_CATEGORIES).toEqual(expectedCategories);
    });

    it('should have exactly 8 categories', () => {
      expect(SKILL_CATEGORIES).toHaveLength(8);
    });
  });

  describe('SKILL_CATEGORY_DISPLAY_NAMES', () => {
    it('should have display names for all categories', () => {
      SKILL_CATEGORIES.forEach((category) => {
        expect(SKILL_CATEGORY_DISPLAY_NAMES[category]).toBeDefined();
        expect(typeof SKILL_CATEGORY_DISPLAY_NAMES[category]).toBe('string');
      });
    });

    it('should have correct display names', () => {
      expect(SKILL_CATEGORY_DISPLAY_NAMES['development']).toBe('Development');
      expect(SKILL_CATEGORY_DISPLAY_NAMES['content-creation']).toBe('Content Creation');
    });
  });

  describe('EXECUTION_TYPES', () => {
    it('should have all expected execution types', () => {
      const expectedTypes: SkillExecutionType[] = [
        'script',
        'browser',
        'mcp-tool',
        'composite',
        'prompt-only',
      ];

      expect(EXECUTION_TYPES).toEqual(expectedTypes);
    });

    it('should have exactly 5 execution types', () => {
      expect(EXECUTION_TYPES).toHaveLength(5);
    });
  });

  describe('EXECUTION_TYPE_DISPLAY_NAMES', () => {
    it('should have display names for all execution types', () => {
      EXECUTION_TYPES.forEach((type) => {
        expect(EXECUTION_TYPE_DISPLAY_NAMES[type]).toBeDefined();
        expect(typeof EXECUTION_TYPE_DISPLAY_NAMES[type]).toBe('string');
      });
    });
  });

  describe('SCRIPT_INTERPRETERS', () => {
    it('should have all expected interpreters', () => {
      const expectedInterpreters: ScriptInterpreter[] = ['bash', 'python', 'node'];
      expect(SCRIPT_INTERPRETERS).toEqual(expectedInterpreters);
    });

    it('should have exactly 3 interpreters', () => {
      expect(SCRIPT_INTERPRETERS).toHaveLength(3);
    });
  });

  describe('SKILL_CONSTANTS', () => {
    it('should have paths configuration', () => {
      expect(SKILL_CONSTANTS.PATHS).toBeDefined();
      expect(SKILL_CONSTANTS.PATHS.SKILLS_DIR).toBe('skills');
      expect(SKILL_CONSTANTS.PATHS.INDEX_FILE).toBe('skills-index.json');
    });

    it('should have limits configuration', () => {
      expect(SKILL_CONSTANTS.LIMITS).toBeDefined();
      expect(SKILL_CONSTANTS.LIMITS.MAX_NAME_LENGTH).toBe(100);
      expect(SKILL_CONSTANTS.LIMITS.MAX_PROMPT_LENGTH).toBe(50000);
    });

    it('should have defaults configuration', () => {
      expect(SKILL_CONSTANTS.DEFAULTS).toBeDefined();
      expect(SKILL_CONSTANTS.DEFAULTS.VERSION).toBe('1.0.0');
      expect(SKILL_CONSTANTS.DEFAULTS.IS_ENABLED).toBe(true);
    });
  });

  // ==========================================================================
  // Interface Tests
  // ==========================================================================

  describe('Skill interface', () => {
    it('should define a minimal skill', () => {
      const skill: Skill = {
        id: 'test-skill',
        name: 'Test Skill',
        description: 'A test skill',
        category: 'development',
        promptFile: 'test-skill/instructions.md',
        assignableRoles: [],
        triggers: [],
        tags: [],
        version: '1.0.0',
        isBuiltin: false,
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(skill.id).toBe('test-skill');
      expect(skill.name).toBe('Test Skill');
      expect(skill.category).toBe('development');
      expect(skill.isEnabled).toBe(true);
    });

    it('should define a skill with execution config', () => {
      const skill: Skill = {
        id: 'script-skill',
        name: 'Script Skill',
        description: 'Runs a script',
        category: 'automation',
        promptFile: 'script-skill/instructions.md',
        execution: {
          type: 'script',
          script: {
            file: 'run.sh',
            interpreter: 'bash',
            timeoutMs: 30000,
          },
        },
        environment: {
          variables: { API_KEY: 'secret' },
          required: ['API_KEY'],
        },
        assignableRoles: ['developer', 'qa'],
        triggers: ['run script', 'execute'],
        tags: ['automation', 'script'],
        version: '1.0.0',
        isBuiltin: true,
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(skill.execution?.type).toBe('script');
      expect(skill.execution?.script?.interpreter).toBe('bash');
      expect(skill.environment?.required).toContain('API_KEY');
    });

    it('should define a skill with browser config', () => {
      const skill: Skill = {
        id: 'browser-skill',
        name: 'Browser Skill',
        description: 'Automates browser',
        category: 'automation',
        promptFile: 'browser-skill/instructions.md',
        execution: {
          type: 'browser',
          browser: {
            url: 'https://example.com',
            instructions: 'Click the button',
            actions: ['click', 'scroll'],
          },
        },
        assignableRoles: [],
        triggers: [],
        tags: [],
        version: '1.0.0',
        isBuiltin: false,
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(skill.execution?.type).toBe('browser');
      expect(skill.execution?.browser?.url).toBe('https://example.com');
    });
  });

  describe('SkillSummary interface', () => {
    it('should define a skill summary', () => {
      const summary: SkillSummary = {
        id: 'test-skill',
        name: 'Test Skill',
        description: 'A test skill',
        category: 'development',
        executionType: 'script',
        triggerCount: 3,
        roleCount: 2,
        isBuiltin: false,
        isEnabled: true,
      };

      expect(summary.executionType).toBe('script');
      expect(summary.triggerCount).toBe(3);
    });
  });

  // ==========================================================================
  // Type Guard Tests
  // ==========================================================================

  describe('isValidSkillCategory', () => {
    it('should return true for valid categories', () => {
      expect(isValidSkillCategory('development')).toBe(true);
      expect(isValidSkillCategory('design')).toBe(true);
      expect(isValidSkillCategory('content-creation')).toBe(true);
      expect(isValidSkillCategory('automation')).toBe(true);
    });

    it('should return false for invalid categories', () => {
      expect(isValidSkillCategory('invalid')).toBe(false);
      expect(isValidSkillCategory('')).toBe(false);
      expect(isValidSkillCategory('DEVELOPMENT')).toBe(false);
      expect(isValidSkillCategory('dev')).toBe(false);
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
      expect(isValidExecutionType('SCRIPT')).toBe(false);
    });
  });

  describe('isValidScriptInterpreter', () => {
    it('should return true for valid interpreters', () => {
      expect(isValidScriptInterpreter('bash')).toBe(true);
      expect(isValidScriptInterpreter('python')).toBe(true);
      expect(isValidScriptInterpreter('node')).toBe(true);
    });

    it('should return false for invalid interpreters', () => {
      expect(isValidScriptInterpreter('invalid')).toBe(false);
      expect(isValidScriptInterpreter('ruby')).toBe(false);
      expect(isValidScriptInterpreter('')).toBe(false);
    });
  });

  // ==========================================================================
  // Utility Function Tests
  // ==========================================================================

  describe('createDefaultSkill', () => {
    it('should create a skill with default values', () => {
      const skill = createDefaultSkill({
        name: 'Test Skill',
        description: 'A test skill',
        category: 'development',
        promptContent: '# Test\n\nInstructions here',
      });

      expect(skill.id).toBeDefined();
      expect(skill.id).toContain('skill-test-skill-');
      expect(skill.name).toBe('Test Skill');
      expect(skill.description).toBe('A test skill');
      expect(skill.category).toBe('development');
      expect(skill.isBuiltin).toBe(false);
      expect(skill.isEnabled).toBe(true);
      expect(skill.version).toBe('1.0.0');
      expect(skill.assignableRoles).toEqual([]);
      expect(skill.triggers).toEqual([]);
      expect(skill.tags).toEqual([]);
    });

    it('should generate unique IDs', () => {
      const skill1 = createDefaultSkill({
        name: 'Skill One',
        description: 'First',
        category: 'development',
        promptContent: 'Content',
      });

      const skill2 = createDefaultSkill({
        name: 'Skill Two',
        description: 'Second',
        category: 'development',
        promptContent: 'Content',
      });

      expect(skill1.id).not.toBe(skill2.id);
    });

    it('should handle names with special characters', () => {
      const skill = createDefaultSkill({
        name: 'My Special  Skill!',
        description: 'Test',
        category: 'automation',
        promptContent: 'Content',
      });

      // Multiple spaces become single hyphen due to \s+ regex
      expect(skill.id).toContain('my-special-skill!');
    });

    it('should set correct timestamps', () => {
      const before = new Date().toISOString();
      const skill = createDefaultSkill({
        name: 'Test',
        description: 'Test',
        category: 'development',
        promptContent: 'Content',
      });
      const after = new Date().toISOString();

      expect(skill.createdAt >= before).toBe(true);
      expect(skill.createdAt <= after).toBe(true);
      expect(skill.createdAt).toBe(skill.updatedAt);
    });
  });

  describe('skillToSummary', () => {
    const createTestSkill = (overrides: Partial<Skill> = {}): Skill => ({
      id: 'test-skill',
      name: 'Test Skill',
      description: 'A test',
      category: 'development',
      promptFile: 'instructions.md',
      assignableRoles: ['developer', 'qa'],
      triggers: ['test', 'run test'],
      tags: ['testing'],
      version: '1.0.0',
      isBuiltin: false,
      isEnabled: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      ...overrides,
    });

    it('should convert Skill to SkillSummary', () => {
      const skill = createTestSkill({
        execution: { type: 'script', script: { file: 'run.sh', interpreter: 'bash' } },
      });

      const summary = skillToSummary(skill);

      expect(summary.id).toBe('test-skill');
      expect(summary.name).toBe('Test Skill');
      expect(summary.description).toBe('A test');
      expect(summary.category).toBe('development');
      expect(summary.executionType).toBe('script');
      expect(summary.triggerCount).toBe(2);
      expect(summary.roleCount).toBe(2);
      expect(summary.isBuiltin).toBe(false);
      expect(summary.isEnabled).toBe(true);
    });

    it('should handle prompt-only skills', () => {
      const skill = createTestSkill();
      // No execution config means prompt-only

      const summary = skillToSummary(skill);
      expect(summary.executionType).toBe('prompt-only');
    });

    it('should handle skills with browser execution', () => {
      const skill = createTestSkill({
        execution: {
          type: 'browser',
          browser: { url: 'https://example.com', instructions: 'Click button' },
        },
      });

      const summary = skillToSummary(skill);
      expect(summary.executionType).toBe('browser');
    });

    it('should handle skills with empty arrays', () => {
      const skill = createTestSkill({
        assignableRoles: [],
        triggers: [],
      });

      const summary = skillToSummary(skill);
      expect(summary.triggerCount).toBe(0);
      expect(summary.roleCount).toBe(0);
    });
  });

  describe('skillToStorageFormat', () => {
    it('should convert Skill to storage format', () => {
      const skill: Skill = {
        id: 'test-skill',
        name: 'Test Skill',
        description: 'A test',
        category: 'development',
        promptFile: 'instructions.md',
        execution: { type: 'script', script: { file: 'run.sh', interpreter: 'bash' } },
        environment: { variables: { KEY: 'value' } },
        assignableRoles: ['developer'],
        triggers: ['test'],
        tags: ['tag1'],
        version: '1.0.0',
        isBuiltin: true,
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const storage = skillToStorageFormat(skill);

      expect(storage.id).toBe('test-skill');
      expect(storage.name).toBe('Test Skill');
      expect(storage.execution?.type).toBe('script');
      // Should not include isBuiltin or isEnabled
      expect('isBuiltin' in storage).toBe(false);
      expect('isEnabled' in storage).toBe(false);
    });
  });

  describe('storageFormatToSkill', () => {
    it('should convert storage format back to Skill', () => {
      const storage: SkillStorageFormat = {
        id: 'test-skill',
        name: 'Test Skill',
        description: 'A test',
        category: 'development',
        promptFile: 'instructions.md',
        assignableRoles: ['developer'],
        triggers: ['test'],
        tags: ['tag1'],
        version: '1.0.0',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const skill = storageFormatToSkill(storage, true);

      expect(skill.id).toBe('test-skill');
      expect(skill.isBuiltin).toBe(true);
      expect(skill.isEnabled).toBe(true);
    });

    it('should set isBuiltin based on parameter', () => {
      const storage: SkillStorageFormat = {
        id: 'custom-skill',
        name: 'Custom',
        description: 'Custom skill',
        category: 'development',
        promptFile: 'instructions.md',
        assignableRoles: [],
        triggers: [],
        tags: [],
        version: '1.0.0',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const builtinSkill = storageFormatToSkill(storage, true);
      const customSkill = storageFormatToSkill(storage, false);

      expect(builtinSkill.isBuiltin).toBe(true);
      expect(customSkill.isBuiltin).toBe(false);
    });
  });

  describe('getSkillCategoryDisplayName', () => {
    it('should return correct display names', () => {
      expect(getSkillCategoryDisplayName('development')).toBe('Development');
      expect(getSkillCategoryDisplayName('content-creation')).toBe('Content Creation');
      expect(getSkillCategoryDisplayName('analysis')).toBe('Analysis');
    });
  });

  describe('getExecutionTypeDisplayName', () => {
    it('should return correct display names', () => {
      expect(getExecutionTypeDisplayName('script')).toBe('Script Execution');
      expect(getExecutionTypeDisplayName('browser')).toBe('Browser Automation');
      expect(getExecutionTypeDisplayName('mcp-tool')).toBe('MCP Tool');
      expect(getExecutionTypeDisplayName('prompt-only')).toBe('Prompt Only');
    });
  });

  // ==========================================================================
  // Validation Tests
  // ==========================================================================

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

    it('should detect whitespace-only name', () => {
      const input = {
        name: '   ',
        description: 'Description',
        category: 'development' as const,
        promptContent: 'Content',
      };

      const errors = validateCreateSkillInput(input);
      expect(errors.some((e) => e.includes('Name'))).toBe(true);
    });

    it('should detect missing description', () => {
      const input = {
        name: 'Skill',
        description: '',
        category: 'development' as const,
        promptContent: 'Content',
      };

      const errors = validateCreateSkillInput(input);
      expect(errors.some((e) => e.includes('Description'))).toBe(true);
    });

    it('should detect invalid category', () => {
      const input = {
        name: 'Skill',
        description: 'Description',
        category: 'invalid' as any,
        promptContent: 'Content',
      };

      const errors = validateCreateSkillInput(input);
      expect(errors.some((e) => e.toLowerCase().includes('category'))).toBe(true);
    });

    it('should detect missing prompt content', () => {
      const input = {
        name: 'Skill',
        description: 'Description',
        category: 'development' as const,
        promptContent: '',
      };

      const errors = validateCreateSkillInput(input);
      expect(errors.some((e) => e.includes('Prompt'))).toBe(true);
    });

    it('should detect name exceeding max length', () => {
      const input = {
        name: 'A'.repeat(101),
        description: 'Description',
        category: 'development' as const,
        promptContent: 'Content',
      };

      const errors = validateCreateSkillInput(input);
      expect(errors.some((e) => e.includes('100'))).toBe(true);
    });

    it('should detect too many triggers', () => {
      const input = {
        name: 'Skill',
        description: 'Description',
        category: 'development' as const,
        promptContent: 'Content',
        triggers: Array(51).fill('trigger'),
      };

      const errors = validateCreateSkillInput(input);
      expect(errors.some((e) => e.includes('triggers'))).toBe(true);
    });

    it('should validate execution config if provided', () => {
      const input: CreateSkillInput = {
        name: 'Skill',
        description: 'Description',
        category: 'development',
        promptContent: 'Content',
        execution: {
          type: 'script',
          // Missing script config
        },
      };

      const errors = validateCreateSkillInput(input);
      expect(errors.some((e) => e.toLowerCase().includes('script'))).toBe(true);
    });
  });

  describe('validateUpdateSkillInput', () => {
    it('should validate empty update (no changes)', () => {
      const input: UpdateSkillInput = {};
      const errors = validateUpdateSkillInput(input);
      expect(errors).toHaveLength(0);
    });

    it('should validate valid partial update', () => {
      const input: UpdateSkillInput = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      const errors = validateUpdateSkillInput(input);
      expect(errors).toHaveLength(0);
    });

    it('should detect empty name when provided', () => {
      const input: UpdateSkillInput = {
        name: '',
      };

      const errors = validateUpdateSkillInput(input);
      expect(errors.some((e) => e.includes('Name'))).toBe(true);
    });

    it('should detect invalid category when provided', () => {
      const input: UpdateSkillInput = {
        category: 'invalid' as any,
      };

      const errors = validateUpdateSkillInput(input);
      expect(errors.some((e) => e.toLowerCase().includes('category'))).toBe(true);
    });

    it('should allow isEnabled to be set', () => {
      const input: UpdateSkillInput = {
        isEnabled: false,
      };

      const errors = validateUpdateSkillInput(input);
      expect(errors).toHaveLength(0);
    });
  });

  describe('validateSkillExecution', () => {
    describe('script execution', () => {
      it('should validate valid script config', () => {
        const config: SkillExecutionConfig = {
          type: 'script',
          script: {
            file: 'run.sh',
            interpreter: 'bash',
          },
        };

        const errors = validateSkillExecution(config);
        expect(errors).toHaveLength(0);
      });

      it('should validate script config with all options', () => {
        const config: SkillExecutionConfig = {
          type: 'script',
          script: {
            file: 'run.py',
            interpreter: 'python',
            workingDir: '/tmp',
            timeoutMs: 30000,
          },
        };

        const errors = validateSkillExecution(config);
        expect(errors).toHaveLength(0);
      });

      it('should detect missing script config for script type', () => {
        const config: SkillExecutionConfig = {
          type: 'script',
        };

        const errors = validateSkillExecution(config);
        expect(errors.some((e) => e.toLowerCase().includes('script'))).toBe(true);
      });

      it('should detect missing script file', () => {
        const config: SkillExecutionConfig = {
          type: 'script',
          script: {
            file: '',
            interpreter: 'bash',
          },
        };

        const errors = validateSkillExecution(config);
        expect(errors.some((e) => e.toLowerCase().includes('file'))).toBe(true);
      });

      it('should detect invalid interpreter', () => {
        const config: SkillExecutionConfig = {
          type: 'script',
          script: {
            file: 'run.rb',
            interpreter: 'ruby' as any,
          },
        };

        const errors = validateSkillExecution(config);
        expect(errors.some((e) => e.toLowerCase().includes('interpreter'))).toBe(true);
      });

      it('should detect timeout exceeding maximum', () => {
        const config: SkillExecutionConfig = {
          type: 'script',
          script: {
            file: 'run.sh',
            interpreter: 'bash',
            timeoutMs: 400000,
          },
        };

        const errors = validateSkillExecution(config);
        expect(errors.some((e) => e.toLowerCase().includes('timeout'))).toBe(true);
      });
    });

    describe('browser execution', () => {
      it('should validate valid browser config', () => {
        const config: SkillExecutionConfig = {
          type: 'browser',
          browser: {
            url: 'https://example.com',
            instructions: 'Click the button',
          },
        };

        const errors = validateSkillExecution(config);
        expect(errors).toHaveLength(0);
      });

      it('should validate browser config with actions', () => {
        const config: SkillExecutionConfig = {
          type: 'browser',
          browser: {
            url: 'https://example.com',
            instructions: 'Do something',
            actions: ['click', 'scroll', 'type'],
          },
        };

        const errors = validateSkillExecution(config);
        expect(errors).toHaveLength(0);
      });

      it('should detect missing browser config for browser type', () => {
        const config: SkillExecutionConfig = {
          type: 'browser',
        };

        const errors = validateSkillExecution(config);
        expect(errors.some((e) => e.toLowerCase().includes('browser'))).toBe(true);
      });

      it('should detect missing URL for browser type', () => {
        const config: SkillExecutionConfig = {
          type: 'browser',
          browser: {
            url: '',
            instructions: 'Do something',
          },
        };

        const errors = validateSkillExecution(config);
        expect(errors.some((e) => e.toLowerCase().includes('url'))).toBe(true);
      });

      it('should detect missing instructions for browser type', () => {
        const config: SkillExecutionConfig = {
          type: 'browser',
          browser: {
            url: 'https://example.com',
            instructions: '',
          },
        };

        const errors = validateSkillExecution(config);
        expect(errors.some((e) => e.toLowerCase().includes('instruction'))).toBe(true);
      });
    });

    describe('mcp-tool execution', () => {
      it('should validate valid mcp-tool config', () => {
        const config: SkillExecutionConfig = {
          type: 'mcp-tool',
          mcpTool: {
            toolName: 'read_file',
          },
        };

        const errors = validateSkillExecution(config);
        expect(errors).toHaveLength(0);
      });

      it('should validate mcp-tool config with default params', () => {
        const config: SkillExecutionConfig = {
          type: 'mcp-tool',
          mcpTool: {
            toolName: 'search',
            defaultParams: { limit: 10 },
          },
        };

        const errors = validateSkillExecution(config);
        expect(errors).toHaveLength(0);
      });

      it('should detect missing mcp-tool config', () => {
        const config: SkillExecutionConfig = {
          type: 'mcp-tool',
        };

        const errors = validateSkillExecution(config);
        expect(errors.some((e) => e.toLowerCase().includes('mcp'))).toBe(true);
      });

      it('should detect missing tool name', () => {
        const config: SkillExecutionConfig = {
          type: 'mcp-tool',
          mcpTool: {
            toolName: '',
          },
        };

        const errors = validateSkillExecution(config);
        expect(errors.some((e) => e.toLowerCase().includes('tool name'))).toBe(true);
      });
    });

    describe('composite execution', () => {
      it('should validate valid composite config', () => {
        const config: SkillExecutionConfig = {
          type: 'composite',
          composite: {
            skillSequence: ['skill-1', 'skill-2'],
          },
        };

        const errors = validateSkillExecution(config);
        expect(errors).toHaveLength(0);
      });

      it('should validate composite config with continueOnError', () => {
        const config: SkillExecutionConfig = {
          type: 'composite',
          composite: {
            skillSequence: ['skill-1'],
            continueOnError: true,
          },
        };

        const errors = validateSkillExecution(config);
        expect(errors).toHaveLength(0);
      });

      it('should detect missing composite config', () => {
        const config: SkillExecutionConfig = {
          type: 'composite',
        };

        const errors = validateSkillExecution(config);
        expect(errors.some((e) => e.toLowerCase().includes('composite'))).toBe(true);
      });

      it('should detect empty skill sequence', () => {
        const config: SkillExecutionConfig = {
          type: 'composite',
          composite: {
            skillSequence: [],
          },
        };

        const errors = validateSkillExecution(config);
        expect(errors.some((e) => e.toLowerCase().includes('at least one'))).toBe(true);
      });

      it('should detect too many skills in sequence', () => {
        const config: SkillExecutionConfig = {
          type: 'composite',
          composite: {
            skillSequence: Array(11).fill('skill'),
          },
        };

        const errors = validateSkillExecution(config);
        expect(errors.some((e) => e.includes('10'))).toBe(true);
      });
    });

    describe('prompt-only execution', () => {
      it('should validate prompt-only config', () => {
        const config: SkillExecutionConfig = {
          type: 'prompt-only',
        };

        const errors = validateSkillExecution(config);
        expect(errors).toHaveLength(0);
      });
    });

    describe('invalid execution type', () => {
      it('should detect invalid execution type', () => {
        const config = {
          type: 'invalid' as any,
        };

        const errors = validateSkillExecution(config);
        expect(errors.some((e) => e.toLowerCase().includes('type'))).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Filter Tests
  // ==========================================================================

  describe('matchesSkillFilter', () => {
    const createTestSkill = (overrides: Partial<Skill> = {}): Skill => ({
      id: 'test-skill',
      name: 'Test Skill',
      description: 'A test skill for testing',
      category: 'development',
      promptFile: 'instructions.md',
      execution: { type: 'script', script: { file: 'run.sh', interpreter: 'bash' } },
      assignableRoles: ['developer', 'qa'],
      triggers: ['test', 'run tests'],
      tags: ['testing', 'automation'],
      version: '1.0.0',
      isBuiltin: false,
      isEnabled: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      ...overrides,
    });

    it('should match with empty filter', () => {
      const skill = createTestSkill();
      const filter: SkillFilter = {};

      expect(matchesSkillFilter(skill, filter)).toBe(true);
    });

    it('should filter by category', () => {
      const skill = createTestSkill({ category: 'development' });

      expect(matchesSkillFilter(skill, { category: 'development' })).toBe(true);
      expect(matchesSkillFilter(skill, { category: 'design' })).toBe(false);
    });

    it('should filter by execution type', () => {
      const scriptSkill = createTestSkill({
        execution: { type: 'script', script: { file: 'run.sh', interpreter: 'bash' } },
      });
      const promptSkill = createTestSkill({ execution: undefined });

      expect(matchesSkillFilter(scriptSkill, { executionType: 'script' })).toBe(true);
      expect(matchesSkillFilter(scriptSkill, { executionType: 'browser' })).toBe(false);
      expect(matchesSkillFilter(promptSkill, { executionType: 'prompt-only' })).toBe(true);
    });

    it('should filter by role ID', () => {
      const skill = createTestSkill({ assignableRoles: ['developer', 'qa'] });

      expect(matchesSkillFilter(skill, { roleId: 'developer' })).toBe(true);
      expect(matchesSkillFilter(skill, { roleId: 'designer' })).toBe(false);
    });

    it('should filter by isBuiltin', () => {
      const builtinSkill = createTestSkill({ isBuiltin: true });
      const customSkill = createTestSkill({ isBuiltin: false });

      expect(matchesSkillFilter(builtinSkill, { isBuiltin: true })).toBe(true);
      expect(matchesSkillFilter(builtinSkill, { isBuiltin: false })).toBe(false);
      expect(matchesSkillFilter(customSkill, { isBuiltin: false })).toBe(true);
    });

    it('should filter by isEnabled', () => {
      const enabledSkill = createTestSkill({ isEnabled: true });
      const disabledSkill = createTestSkill({ isEnabled: false });

      expect(matchesSkillFilter(enabledSkill, { isEnabled: true })).toBe(true);
      expect(matchesSkillFilter(disabledSkill, { isEnabled: true })).toBe(false);
    });

    it('should filter by search term in name', () => {
      const skill = createTestSkill({ name: 'File Operations Skill' });

      expect(matchesSkillFilter(skill, { search: 'file' })).toBe(true);
      expect(matchesSkillFilter(skill, { search: 'FILE' })).toBe(true);
      expect(matchesSkillFilter(skill, { search: 'xyz' })).toBe(false);
    });

    it('should filter by search term in description', () => {
      const skill = createTestSkill({ description: 'Handles file operations' });

      expect(matchesSkillFilter(skill, { search: 'handles' })).toBe(true);
      expect(matchesSkillFilter(skill, { search: 'operations' })).toBe(true);
    });

    it('should filter by search term in triggers', () => {
      const skill = createTestSkill({ triggers: ['run tests', 'execute suite'] });

      expect(matchesSkillFilter(skill, { search: 'suite' })).toBe(true);
      expect(matchesSkillFilter(skill, { search: 'xyz' })).toBe(false);
    });

    it('should filter by tags (all must match)', () => {
      const skill = createTestSkill({ tags: ['testing', 'automation', 'ci'] });

      expect(matchesSkillFilter(skill, { tags: ['testing'] })).toBe(true);
      expect(matchesSkillFilter(skill, { tags: ['testing', 'ci'] })).toBe(true);
      expect(matchesSkillFilter(skill, { tags: ['testing', 'unknown'] })).toBe(false);
    });

    it('should handle empty search string', () => {
      const skill = createTestSkill();

      expect(matchesSkillFilter(skill, { search: '' })).toBe(true);
      expect(matchesSkillFilter(skill, { search: '   ' })).toBe(true);
    });

    it('should handle empty tags array', () => {
      const skill = createTestSkill({ tags: ['testing'] });

      expect(matchesSkillFilter(skill, { tags: [] })).toBe(true);
    });

    it('should combine multiple filter criteria', () => {
      const skill = createTestSkill({
        category: 'development',
        isBuiltin: false,
        isEnabled: true,
        assignableRoles: ['developer'],
        tags: ['testing'],
      });

      const matchingFilter: SkillFilter = {
        category: 'development',
        isBuiltin: false,
        isEnabled: true,
        roleId: 'developer',
        tags: ['testing'],
      };

      const nonMatchingFilter: SkillFilter = {
        category: 'development',
        isBuiltin: true, // Doesn't match
        isEnabled: true,
      };

      expect(matchesSkillFilter(skill, matchingFilter)).toBe(true);
      expect(matchesSkillFilter(skill, nonMatchingFilter)).toBe(false);
    });
  });
});
