/**
 * Tests for Skill Executor Service
 *
 * @module services/skill/skill-executor.service.test
 */

// Jest globals are available automatically
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  SkillExecutorService,
  getSkillExecutorService,
  resetSkillExecutorService,
} from './skill-executor.service.js';
import { SkillWithPrompt, SkillExecutionContext } from '../../types/skill.types.js';
import * as skillService from './skill.service.js';
import * as settingsService from '../settings/settings.service.js';

// Mock the skill service
jest.mock('./skill.service.js', () => ({
  getSkillService: jest.fn(),
}));

// Mock the settings service
jest.mock('../settings/settings.service.js', () => ({
  getSettingsService: jest.fn(),
}));

describe('SkillExecutorService', () => {
  let executor: SkillExecutorService;
  let testDir: string;

  const mockContext: SkillExecutionContext = {
    agentId: 'test-agent',
    roleId: 'developer',
    projectId: 'test-project',
    taskId: 'test-task',
    userInput: 'Test input',
  };

  const mockSettings = {
    skills: {
      enableScriptExecution: true,
      enableBrowserAutomation: true,
      skillExecutionTimeoutMs: 60000,
    },
  };

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `skill-executor-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create instructions.md file
    await fs.writeFile(path.join(testDir, 'instructions.md'), '# Test Instructions');

    executor = new SkillExecutorService();

    // Setup default mocks
    const mockSettingsServiceInstance = {
      getSettings: jest.fn().mockResolvedValue(mockSettings),
    };
    (settingsService.getSettingsService as jest.Mock).mockReturnValue(mockSettingsServiceInstance);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    resetSkillExecutorService();
    jest.clearAllMocks();
  });

  // ===========================================================================
  // executeSkillInternal Tests
  // ===========================================================================

  describe('executeSkillInternal', () => {
    describe('prompt-only skills', () => {
      it('should return prompt content for prompt-only skill', async () => {
        const skill: SkillWithPrompt = {
          id: 'prompt-skill',
          name: 'Prompt Skill',
          description: 'Just instructions',
          category: 'development',
          promptFile: path.join(testDir, 'instructions.md'),
          promptContent: '# Test Prompt\n\nDo this thing.',
          assignableRoles: [],
          triggers: [],
          tags: [],
          version: '1.0.0',
          isBuiltin: false,
          isEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await executor.executeSkillInternal(skill, mockContext);

        expect(result.success).toBe(true);
        expect(result.output).toBe('# Test Prompt\n\nDo this thing.');
        expect(result.data?.type).toBe('prompt-only');
      });

      it('should handle prompt-only skill with no execution config', async () => {
        const skill: SkillWithPrompt = {
          id: 'simple-prompt',
          name: 'Simple Prompt',
          description: 'Basic skill',
          category: 'development',
          promptFile: path.join(testDir, 'instructions.md'),
          promptContent: 'Simple instructions',
          assignableRoles: [],
          triggers: [],
          tags: [],
          version: '1.0.0',
          isBuiltin: false,
          isEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await executor.executeSkillInternal(skill, mockContext);

        expect(result.success).toBe(true);
        expect(result.output).toBe('Simple instructions');
      });
    });

    describe('script skills', () => {
      it('should execute bash script successfully', async () => {
        // Create test script
        const scriptPath = path.join(testDir, 'test.sh');
        await fs.writeFile(scriptPath, '#!/bin/bash\necho "Hello World"');
        await fs.chmod(scriptPath, 0o755);

        const skill: SkillWithPrompt = {
          id: 'script-skill',
          name: 'Script Skill',
          description: 'Runs a script',
          category: 'automation',
          promptFile: path.join(testDir, 'instructions.md'),
          promptContent: '# Script Skill',
          execution: {
            type: 'script',
            script: {
              file: 'test.sh',
              interpreter: 'bash',
            },
          },
          assignableRoles: [],
          triggers: [],
          tags: [],
          version: '1.0.0',
          isBuiltin: false,
          isEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await executor.executeSkillInternal(skill, mockContext);

        expect(result.success).toBe(true);
        expect(result.output?.trim()).toBe('Hello World');
      });

      it('should inject environment variables', async () => {
        const scriptPath = path.join(testDir, 'env-test.sh');
        await fs.writeFile(scriptPath, '#!/bin/bash\necho $AGENTMUX_AGENT_ID');
        await fs.chmod(scriptPath, 0o755);

        const skill: SkillWithPrompt = {
          id: 'env-skill',
          name: 'Env Skill',
          description: 'Uses env vars',
          category: 'automation',
          promptFile: path.join(testDir, 'instructions.md'),
          promptContent: '# Env Skill',
          execution: {
            type: 'script',
            script: {
              file: 'env-test.sh',
              interpreter: 'bash',
            },
          },
          assignableRoles: [],
          triggers: [],
          tags: [],
          version: '1.0.0',
          isBuiltin: false,
          isEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await executor.executeSkillInternal(skill, mockContext);

        expect(result.success).toBe(true);
        expect(result.output?.trim()).toBe('test-agent');
      });

      it('should inject custom environment variables', async () => {
        const scriptPath = path.join(testDir, 'custom-env.sh');
        await fs.writeFile(scriptPath, '#!/bin/bash\necho $CUSTOM_VAR');
        await fs.chmod(scriptPath, 0o755);

        const skill: SkillWithPrompt = {
          id: 'custom-env-skill',
          name: 'Custom Env Skill',
          description: 'Uses custom env vars',
          category: 'automation',
          promptFile: path.join(testDir, 'instructions.md'),
          promptContent: '# Custom Env',
          execution: {
            type: 'script',
            script: {
              file: 'custom-env.sh',
              interpreter: 'bash',
            },
          },
          environment: {
            variables: { CUSTOM_VAR: 'custom-value' },
          },
          assignableRoles: [],
          triggers: [],
          tags: [],
          version: '1.0.0',
          isBuiltin: false,
          isEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await executor.executeSkillInternal(skill, mockContext);

        expect(result.success).toBe(true);
        expect(result.output?.trim()).toBe('custom-value');
      });

      it('should load environment variables from .env file', async () => {
        const scriptPath = path.join(testDir, 'env-file-test.sh');
        await fs.writeFile(scriptPath, '#!/bin/bash\necho $FROM_FILE');
        await fs.chmod(scriptPath, 0o755);

        // Create .env file
        await fs.writeFile(path.join(testDir, '.env'), 'FROM_FILE=loaded-from-file');

        const skill: SkillWithPrompt = {
          id: 'env-file-skill',
          name: 'Env File Skill',
          description: 'Loads env from file',
          category: 'automation',
          promptFile: path.join(testDir, 'instructions.md'),
          promptContent: '# Env File',
          execution: {
            type: 'script',
            script: {
              file: 'env-file-test.sh',
              interpreter: 'bash',
            },
          },
          environment: {
            file: '.env',
          },
          assignableRoles: [],
          triggers: [],
          tags: [],
          version: '1.0.0',
          isBuiltin: false,
          isEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await executor.executeSkillInternal(skill, mockContext);

        expect(result.success).toBe(true);
        expect(result.output?.trim()).toBe('loaded-from-file');
      });

      it('should return error for failed script', async () => {
        const scriptPath = path.join(testDir, 'fail.sh');
        await fs.writeFile(scriptPath, '#!/bin/bash\nexit 1');
        await fs.chmod(scriptPath, 0o755);

        const skill: SkillWithPrompt = {
          id: 'fail-skill',
          name: 'Fail Skill',
          description: 'Will fail',
          category: 'automation',
          promptFile: path.join(testDir, 'instructions.md'),
          promptContent: '# Fail',
          execution: {
            type: 'script',
            script: {
              file: 'fail.sh',
              interpreter: 'bash',
            },
          },
          assignableRoles: [],
          triggers: [],
          tags: [],
          version: '1.0.0',
          isBuiltin: false,
          isEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await executor.executeSkillInternal(skill, mockContext);

        expect(result.success).toBe(false);
        expect(result.data?.exitCode).toBe(1);
      });

      it('should return error for missing script configuration', async () => {
        const skill: SkillWithPrompt = {
          id: 'no-script-config',
          name: 'No Script Config',
          description: 'Missing config',
          category: 'automation',
          promptFile: path.join(testDir, 'instructions.md'),
          promptContent: '# No Config',
          execution: {
            type: 'script',
            // Missing script config
          },
          assignableRoles: [],
          triggers: [],
          tags: [],
          version: '1.0.0',
          isBuiltin: false,
          isEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await executor.executeSkillInternal(skill, mockContext);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Script configuration missing');
      });

      it('should return error for missing script file', async () => {
        const skill: SkillWithPrompt = {
          id: 'missing-file',
          name: 'Missing File',
          description: 'File does not exist',
          category: 'automation',
          promptFile: path.join(testDir, 'instructions.md'),
          promptContent: '# Missing File',
          execution: {
            type: 'script',
            script: {
              file: 'nonexistent.sh',
              interpreter: 'bash',
            },
          },
          assignableRoles: [],
          triggers: [],
          tags: [],
          version: '1.0.0',
          isBuiltin: false,
          isEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await executor.executeSkillInternal(skill, mockContext);

        expect(result.success).toBe(false);
      });

      it('should block script execution when disabled in settings', async () => {
        const mockSettingsServiceInstance = {
          getSettings: jest.fn().mockResolvedValue({
            skills: {
              enableScriptExecution: false,
              enableBrowserAutomation: true,
            },
          }),
        };
        (settingsService.getSettingsService as jest.Mock).mockReturnValue(
          mockSettingsServiceInstance
        );

        const skill: SkillWithPrompt = {
          id: 'blocked-script',
          name: 'Blocked Script',
          description: 'Should be blocked',
          category: 'automation',
          promptFile: path.join(testDir, 'instructions.md'),
          promptContent: '# Blocked',
          execution: {
            type: 'script',
            script: {
              file: 'test.sh',
              interpreter: 'bash',
            },
          },
          assignableRoles: [],
          triggers: [],
          tags: [],
          version: '1.0.0',
          isBuiltin: false,
          isEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await executor.executeSkillInternal(skill, mockContext);

        expect(result.success).toBe(false);
        expect(result.error).toContain('disabled');
      });
    });

    describe('browser skills', () => {
      it('should return browser automation prompt', async () => {
        const skill: SkillWithPrompt = {
          id: 'browser-skill',
          name: 'Browser Skill',
          description: 'Uses browser',
          category: 'automation',
          promptFile: path.join(testDir, 'instructions.md'),
          promptContent: '# Browser',
          execution: {
            type: 'browser',
            browser: {
              url: 'https://example.com',
              instructions: 'Click the button',
              actions: ['Step 1', 'Step 2'],
            },
          },
          assignableRoles: [],
          triggers: [],
          tags: [],
          version: '1.0.0',
          isBuiltin: false,
          isEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await executor.executeSkillInternal(skill, mockContext);

        expect(result.success).toBe(true);
        expect(result.output).toContain('https://example.com');
        expect(result.output).toContain('Click the button');
        expect(result.output).toContain('Claude Chrome MCP');
        expect(result.data?.requiresChromeMcp).toBe(true);
      });

      it('should include user context in browser prompt', async () => {
        const skill: SkillWithPrompt = {
          id: 'browser-context',
          name: 'Browser Context',
          description: 'With context',
          category: 'automation',
          promptFile: path.join(testDir, 'instructions.md'),
          promptContent: '# Browser Context',
          execution: {
            type: 'browser',
            browser: {
              url: 'https://example.com',
              instructions: 'Do something',
            },
          },
          assignableRoles: [],
          triggers: [],
          tags: [],
          version: '1.0.0',
          isBuiltin: false,
          isEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await executor.executeSkillInternal(skill, mockContext);

        expect(result.success).toBe(true);
        expect(result.output).toContain('Test input');
      });

      it('should return error for missing browser configuration', async () => {
        const skill: SkillWithPrompt = {
          id: 'no-browser-config',
          name: 'No Browser Config',
          description: 'Missing config',
          category: 'automation',
          promptFile: path.join(testDir, 'instructions.md'),
          promptContent: '# No Config',
          execution: {
            type: 'browser',
            // Missing browser config
          },
          assignableRoles: [],
          triggers: [],
          tags: [],
          version: '1.0.0',
          isBuiltin: false,
          isEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await executor.executeSkillInternal(skill, mockContext);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Browser configuration missing');
      });

      it('should block browser automation when disabled in settings', async () => {
        const mockSettingsServiceInstance = {
          getSettings: jest.fn().mockResolvedValue({
            skills: {
              enableScriptExecution: true,
              enableBrowserAutomation: false,
            },
          }),
        };
        (settingsService.getSettingsService as jest.Mock).mockReturnValue(
          mockSettingsServiceInstance
        );

        const skill: SkillWithPrompt = {
          id: 'blocked-browser',
          name: 'Blocked Browser',
          description: 'Should be blocked',
          category: 'automation',
          promptFile: path.join(testDir, 'instructions.md'),
          promptContent: '# Blocked',
          execution: {
            type: 'browser',
            browser: {
              url: 'https://example.com',
              instructions: 'Click',
            },
          },
          assignableRoles: [],
          triggers: [],
          tags: [],
          version: '1.0.0',
          isBuiltin: false,
          isEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await executor.executeSkillInternal(skill, mockContext);

        expect(result.success).toBe(false);
        expect(result.error).toContain('disabled');
      });
    });

    describe('mcp-tool skills', () => {
      it('should return MCP tool invocation prompt', async () => {
        const skill: SkillWithPrompt = {
          id: 'mcp-skill',
          name: 'MCP Skill',
          description: 'Calls MCP tool',
          category: 'integration',
          promptFile: path.join(testDir, 'instructions.md'),
          promptContent: '# MCP',
          execution: {
            type: 'mcp-tool',
            mcpTool: {
              toolName: 'get_tasks',
              defaultParams: { status: 'open' },
            },
          },
          assignableRoles: [],
          triggers: [],
          tags: [],
          version: '1.0.0',
          isBuiltin: false,
          isEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await executor.executeSkillInternal(skill, mockContext);

        expect(result.success).toBe(true);
        expect(result.output).toContain('get_tasks');
        expect(result.output).toContain('"status": "open"');
        expect(result.data?.toolName).toBe('get_tasks');
      });

      it('should return error for missing MCP tool configuration', async () => {
        const skill: SkillWithPrompt = {
          id: 'no-mcp-config',
          name: 'No MCP Config',
          description: 'Missing config',
          category: 'integration',
          promptFile: path.join(testDir, 'instructions.md'),
          promptContent: '# No Config',
          execution: {
            type: 'mcp-tool',
            // Missing mcpTool config
          },
          assignableRoles: [],
          triggers: [],
          tags: [],
          version: '1.0.0',
          isBuiltin: false,
          isEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await executor.executeSkillInternal(skill, mockContext);

        expect(result.success).toBe(false);
        expect(result.error).toContain('MCP tool configuration missing');
      });
    });

    describe('composite skills', () => {
      it('should return error for missing composite configuration', async () => {
        const skill: SkillWithPrompt = {
          id: 'no-composite-config',
          name: 'No Composite Config',
          description: 'Missing config',
          category: 'automation',
          promptFile: path.join(testDir, 'instructions.md'),
          promptContent: '# No Config',
          execution: {
            type: 'composite',
            // Missing composite config
          },
          assignableRoles: [],
          triggers: [],
          tags: [],
          version: '1.0.0',
          isBuiltin: false,
          isEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await executor.executeSkillInternal(skill, mockContext);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Composite configuration missing');
      });

      it('should return error for empty skill sequence', async () => {
        const skill: SkillWithPrompt = {
          id: 'empty-composite',
          name: 'Empty Composite',
          description: 'Empty sequence',
          category: 'automation',
          promptFile: path.join(testDir, 'instructions.md'),
          promptContent: '# Empty',
          execution: {
            type: 'composite',
            composite: {
              skillSequence: [],
            },
          },
          assignableRoles: [],
          triggers: [],
          tags: [],
          version: '1.0.0',
          isBuiltin: false,
          isEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await executor.executeSkillInternal(skill, mockContext);

        expect(result.success).toBe(false);
        expect(result.error).toContain('empty');
      });
    });

    describe('disabled skills', () => {
      it('should return error for disabled skill', async () => {
        const skill: SkillWithPrompt = {
          id: 'disabled-skill',
          name: 'Disabled',
          description: 'Is disabled',
          category: 'development',
          promptFile: path.join(testDir, 'instructions.md'),
          promptContent: '# Disabled',
          assignableRoles: [],
          triggers: [],
          tags: [],
          version: '1.0.0',
          isBuiltin: false,
          isEnabled: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await executor.executeSkillInternal(skill, mockContext);

        expect(result.success).toBe(false);
        expect(result.error).toContain('disabled');
      });
    });

    describe('unknown execution type', () => {
      it('should return error for unknown execution type', async () => {
        const skill: SkillWithPrompt = {
          id: 'unknown-type',
          name: 'Unknown Type',
          description: 'Unknown execution',
          category: 'development',
          promptFile: path.join(testDir, 'instructions.md'),
          promptContent: '# Unknown',
          execution: {
            type: 'unknown-type' as any,
          },
          assignableRoles: [],
          triggers: [],
          tags: [],
          version: '1.0.0',
          isBuiltin: false,
          isEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await executor.executeSkillInternal(skill, mockContext);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Unknown execution type');
      });
    });
  });

  // ===========================================================================
  // executeSkill Tests
  // ===========================================================================

  describe('executeSkill', () => {
    it('should return error for non-existent skill', async () => {
      const mockSkillServiceInstance = {
        getSkill: jest.fn().mockResolvedValue(null),
      };
      (skillService.getSkillService as jest.Mock).mockReturnValue(mockSkillServiceInstance);

      const result = await executor.executeSkill('non-existent', mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error for disabled skill', async () => {
      const disabledSkill: SkillWithPrompt = {
        id: 'disabled',
        name: 'Disabled',
        description: 'Disabled skill',
        category: 'development',
        promptFile: path.join(testDir, 'instructions.md'),
        promptContent: '# Disabled',
        assignableRoles: [],
        triggers: [],
        tags: [],
        version: '1.0.0',
        isBuiltin: false,
        isEnabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockSkillServiceInstance = {
        getSkill: jest.fn().mockResolvedValue(disabledSkill),
      };
      (skillService.getSkillService as jest.Mock).mockReturnValue(mockSkillServiceInstance);

      const result = await executor.executeSkill('disabled', mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });

    it('should execute skill successfully', async () => {
      const promptSkill: SkillWithPrompt = {
        id: 'prompt',
        name: 'Prompt',
        description: 'Prompt skill',
        category: 'development',
        promptFile: path.join(testDir, 'instructions.md'),
        promptContent: '# Test Prompt',
        assignableRoles: [],
        triggers: [],
        tags: [],
        version: '1.0.0',
        isBuiltin: false,
        isEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockSkillServiceInstance = {
        getSkill: jest.fn().mockResolvedValue(promptSkill),
      };
      (skillService.getSkillService as jest.Mock).mockReturnValue(mockSkillServiceInstance);

      const result = await executor.executeSkill('prompt', mockContext);

      expect(result.success).toBe(true);
      expect(result.output).toBe('# Test Prompt');
    });
  });
});

// =============================================================================
// Singleton Tests
// =============================================================================

describe('SkillExecutorService Singleton', () => {
  afterEach(() => {
    resetSkillExecutorService();
  });

  describe('getSkillExecutorService', () => {
    it('should return singleton instance', () => {
      const instance1 = getSkillExecutorService();
      const instance2 = getSkillExecutorService();
      expect(instance1).toBe(instance2);
    });

    it('should return SkillExecutorService instance', () => {
      const instance = getSkillExecutorService();
      expect(instance).toBeInstanceOf(SkillExecutorService);
    });
  });

  describe('resetSkillExecutorService', () => {
    it('should reset singleton instance', () => {
      const instance1 = getSkillExecutorService();
      resetSkillExecutorService();
      const instance2 = getSkillExecutorService();
      expect(instance1).not.toBe(instance2);
    });
  });
});
