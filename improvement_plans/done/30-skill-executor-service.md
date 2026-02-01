# Task: Implement Skill Executor Service

## Overview

Create a service responsible for executing skills, including script execution with environment variable injection, browser automation coordination, and MCP tool invocation.

## Priority

**Sprint 2** - Skills System

## Dependencies

- `28-skill-types.md` - Skill type definitions
- `29-skill-service.md` - Skill service for loading skill data

## Files to Create

### 1. `backend/src/services/skill/skill-executor.service.ts`

```typescript
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import {
  Skill,
  SkillWithPrompt,
  SkillExecutionContext,
  SkillExecutionResult,
  SkillScriptConfig,
  SkillBrowserConfig,
  SkillMcpToolConfig,
  SkillEnvironmentConfig,
} from '../../types/skill.types.js';
import { getSkillService } from './skill.service.js';
import { getSettingsService } from '../settings/settings.service.js';

/**
 * Service for executing skills
 *
 * Handles:
 * - Script execution with environment variable injection
 * - Browser automation via Claude's Chrome MCP
 * - MCP tool invocation
 * - Composite skill orchestration
 */
export class SkillExecutorService {
  private readonly defaultTimeoutMs: number = 60000;

  /**
   * Execute a skill by ID
   */
  async executeSkill(
    skillId: string,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();

    try {
      const skillService = getSkillService();
      const skill = await skillService.getSkill(skillId);

      if (!skill) {
        return {
          success: false,
          error: `Skill not found: ${skillId}`,
          durationMs: Date.now() - startTime,
        };
      }

      if (!skill.isEnabled) {
        return {
          success: false,
          error: `Skill is disabled: ${skill.name}`,
          durationMs: Date.now() - startTime,
        };
      }

      return await this.executeSkillInternal(skill, context);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a skill with the full skill object
   */
  async executeSkillInternal(
    skill: SkillWithPrompt,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();

    // Check if skill execution is enabled in settings
    const settings = await getSettingsService().getSettings();
    if (!settings.skills.enableScriptExecution && skill.execution?.type === 'script') {
      return {
        success: false,
        error: 'Script execution is disabled in settings',
        durationMs: Date.now() - startTime,
      };
    }

    if (!settings.skills.enableBrowserAutomation && skill.execution?.type === 'browser') {
      return {
        success: false,
        error: 'Browser automation is disabled in settings',
        durationMs: Date.now() - startTime,
      };
    }

    const executionType = skill.execution?.type ?? 'prompt-only';

    switch (executionType) {
      case 'script':
        return this.executeScript(skill, context);

      case 'browser':
        return this.executeBrowserAutomation(skill, context);

      case 'mcp-tool':
        return this.executeMcpTool(skill, context);

      case 'composite':
        return this.executeComposite(skill, context);

      case 'prompt-only':
        return {
          success: true,
          output: skill.promptContent,
          durationMs: Date.now() - startTime,
          data: { type: 'prompt-only' },
        };

      default:
        return {
          success: false,
          error: `Unknown execution type: ${executionType}`,
          durationMs: Date.now() - startTime,
        };
    }
  }

  /**
   * Execute a script-based skill
   */
  private async executeScript(
    skill: SkillWithPrompt,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();
    const scriptConfig = skill.execution?.script;

    if (!scriptConfig) {
      return {
        success: false,
        error: 'Script configuration missing',
        durationMs: Date.now() - startTime,
      };
    }

    try {
      // Load environment variables
      const env = await this.buildEnvironment(skill, context);

      // Determine script path
      const skillDir = path.dirname(skill.promptFile);
      const scriptPath = path.isAbsolute(scriptConfig.file)
        ? scriptConfig.file
        : path.join(skillDir, scriptConfig.file);

      // Verify script exists
      await fs.access(scriptPath);

      // Build command based on interpreter
      const { command, args } = this.getInterpreterCommand(
        scriptConfig.interpreter,
        scriptPath
      );

      // Execute script
      const result = await this.spawnProcess(
        command,
        args,
        {
          cwd: scriptConfig.workingDir || skillDir,
          env,
          timeout: scriptConfig.timeoutMs || this.defaultTimeoutMs,
        }
      );

      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.exitCode !== 0 ? result.stderr : undefined,
        durationMs: Date.now() - startTime,
        data: {
          exitCode: result.exitCode,
          stderr: result.stderr,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Script execution failed',
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute browser automation skill
   * This returns instructions for Claude to use with the Chrome MCP
   */
  private async executeBrowserAutomation(
    skill: SkillWithPrompt,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();
    const browserConfig = skill.execution?.browser;

    if (!browserConfig) {
      return {
        success: false,
        error: 'Browser configuration missing',
        durationMs: Date.now() - startTime,
      };
    }

    // Build browser automation prompt for Claude
    const browserPrompt = this.buildBrowserAutomationPrompt(browserConfig, context);

    return {
      success: true,
      output: browserPrompt,
      durationMs: Date.now() - startTime,
      data: {
        type: 'browser-automation',
        url: browserConfig.url,
        requiresChromeMcp: true,
      },
    };
  }

  /**
   * Execute MCP tool skill
   */
  private async executeMcpTool(
    skill: SkillWithPrompt,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();
    const mcpConfig = skill.execution?.mcpTool;

    if (!mcpConfig) {
      return {
        success: false,
        error: 'MCP tool configuration missing',
        durationMs: Date.now() - startTime,
      };
    }

    // Build MCP tool invocation instructions
    const mcpPrompt = this.buildMcpToolPrompt(mcpConfig, context);

    return {
      success: true,
      output: mcpPrompt,
      durationMs: Date.now() - startTime,
      data: {
        type: 'mcp-tool',
        toolName: mcpConfig.toolName,
        defaultParams: mcpConfig.defaultParams,
      },
    };
  }

  /**
   * Execute composite skill (sequence of other skills)
   */
  private async executeComposite(
    skill: SkillWithPrompt,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();
    const compositeConfig = skill.execution?.composite;

    if (!compositeConfig || !compositeConfig.skillSequence.length) {
      return {
        success: false,
        error: 'Composite configuration missing or empty',
        durationMs: Date.now() - startTime,
      };
    }

    const results: SkillExecutionResult[] = [];
    const outputs: string[] = [];

    for (const skillId of compositeConfig.skillSequence) {
      const result = await this.executeSkill(skillId, context);
      results.push(result);

      if (result.output) {
        outputs.push(result.output);
      }

      if (!result.success && !compositeConfig.continueOnError) {
        return {
          success: false,
          error: `Skill ${skillId} failed: ${result.error}`,
          output: outputs.join('\n\n---\n\n'),
          durationMs: Date.now() - startTime,
          data: { results },
        };
      }
    }

    const allSucceeded = results.every((r) => r.success);

    return {
      success: allSucceeded,
      output: outputs.join('\n\n---\n\n'),
      durationMs: Date.now() - startTime,
      data: { results },
    };
  }

  /**
   * Build environment variables for script execution
   */
  private async buildEnvironment(
    skill: SkillWithPrompt,
    context: SkillExecutionContext
  ): Promise<NodeJS.ProcessEnv> {
    const env: NodeJS.ProcessEnv = { ...process.env };

    // Add context variables
    env.AGENTMUX_AGENT_ID = context.agentId;
    env.AGENTMUX_ROLE_ID = context.roleId;
    if (context.projectId) env.AGENTMUX_PROJECT_ID = context.projectId;
    if (context.taskId) env.AGENTMUX_TASK_ID = context.taskId;
    if (context.userInput) env.AGENTMUX_USER_INPUT = context.userInput;

    const envConfig = skill.environment;
    if (!envConfig) return env;

    // Load from .env file if specified
    if (envConfig.file) {
      const skillDir = path.dirname(skill.promptFile);
      const envFilePath = path.join(skillDir, envConfig.file);

      try {
        const envContent = await fs.readFile(envFilePath, 'utf-8');
        const parsed = this.parseEnvFile(envContent);
        Object.assign(env, parsed);
      } catch (error) {
        console.warn(`Failed to load env file: ${envFilePath}`);
      }
    }

    // Add inline variables (override file values)
    if (envConfig.variables) {
      Object.assign(env, envConfig.variables);
    }

    // Check required variables
    if (envConfig.required) {
      for (const varName of envConfig.required) {
        if (!env[varName]) {
          throw new Error(`Required environment variable missing: ${varName}`);
        }
      }
    }

    return env;
  }

  /**
   * Parse .env file content
   */
  private parseEnvFile(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Get interpreter command and args
   */
  private getInterpreterCommand(
    interpreter: string,
    scriptPath: string
  ): { command: string; args: string[] } {
    switch (interpreter) {
      case 'bash':
        return { command: 'bash', args: [scriptPath] };
      case 'python':
        return { command: 'python3', args: [scriptPath] };
      case 'node':
        return { command: 'node', args: [scriptPath] };
      default:
        return { command: interpreter, args: [scriptPath] };
    }
  }

  /**
   * Spawn a process and capture output
   */
  private spawnProcess(
    command: string,
    args: string[],
    options: {
      cwd?: string;
      env?: NodeJS.ProcessEnv;
      timeout?: number;
    }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        shell: false,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Process timed out after ${options.timeout}ms`));
      }, options.timeout || 60000);

      child.on('close', (exitCode) => {
        clearTimeout(timeoutId);
        resolve({
          stdout,
          stderr,
          exitCode: exitCode ?? 1,
        });
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Build browser automation prompt for Claude
   */
  private buildBrowserAutomationPrompt(
    config: SkillBrowserConfig,
    context: SkillExecutionContext
  ): string {
    let prompt = `## Browser Automation Task\n\n`;
    prompt += `Navigate to: ${config.url}\n\n`;
    prompt += `### Instructions\n${config.instructions}\n\n`;

    if (config.actions?.length) {
      prompt += `### Specific Actions\n`;
      config.actions.forEach((action, i) => {
        prompt += `${i + 1}. ${action}\n`;
      });
    }

    if (context.userInput) {
      prompt += `\n### User Context\n${context.userInput}\n`;
    }

    prompt += `\n*Use the Claude Chrome MCP tools (mcp__claude-in-chrome__*) to complete this task.*`;

    return prompt;
  }

  /**
   * Build MCP tool invocation prompt
   */
  private buildMcpToolPrompt(
    config: SkillMcpToolConfig,
    context: SkillExecutionContext
  ): string {
    let prompt = `## MCP Tool Invocation\n\n`;
    prompt += `Tool: ${config.toolName}\n\n`;

    if (config.defaultParams) {
      prompt += `### Default Parameters\n`;
      prompt += '```json\n';
      prompt += JSON.stringify(config.defaultParams, null, 2);
      prompt += '\n```\n\n';
    }

    if (context.userInput) {
      prompt += `### User Context\n${context.userInput}\n`;
    }

    return prompt;
  }
}

// Singleton
let executorInstance: SkillExecutorService | null = null;

export function getSkillExecutorService(): SkillExecutorService {
  if (!executorInstance) {
    executorInstance = new SkillExecutorService();
  }
  return executorInstance;
}

export function resetSkillExecutorService(): void {
  executorInstance = null;
}
```

### 2. `backend/src/services/skill/skill-executor.service.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  SkillExecutorService,
  getSkillExecutorService,
  resetSkillExecutorService,
} from './skill-executor.service.js';
import { SkillWithPrompt, SkillExecutionContext } from '../../types/skill.types.js';

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

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `skill-executor-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    executor = new SkillExecutorService();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    resetSkillExecutorService();
  });

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
        expect(result.data?.toolName).toBe('get_tasks');
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
  });
});

describe('getSkillExecutorService', () => {
  afterEach(() => {
    resetSkillExecutorService();
  });

  it('should return singleton instance', () => {
    const instance1 = getSkillExecutorService();
    const instance2 = getSkillExecutorService();
    expect(instance1).toBe(instance2);
  });
});
```

## Acceptance Criteria

- [ ] Script execution works with bash, python, and node interpreters
- [ ] Environment variables are correctly injected from context and .env files
- [ ] Browser automation returns proper prompts for Chrome MCP
- [ ] MCP tool invocation returns proper prompts
- [ ] Composite skills execute in sequence
- [ ] Timeout handling works correctly
- [ ] Disabled skills return appropriate error
- [ ] Settings are respected (script/browser execution toggles)
- [ ] Comprehensive test coverage (>80%)

## Security Considerations

1. **Script Sandboxing**: Consider running scripts in isolated environments
2. **Path Validation**: Ensure script paths are within allowed directories
3. **Environment Sanitization**: Don't leak sensitive env vars
4. **Timeout Enforcement**: Prevent runaway scripts
5. **Input Validation**: Sanitize user input before passing to scripts

## Testing Requirements

1. Unit tests for each execution type
2. Integration tests for actual script execution
3. Timeout tests
4. Environment variable injection tests
5. Error handling tests

## Notes

- Browser automation relies on Claude's Chrome MCP - this service just provides the prompts
- Agents decide when to execute skills - no approval workflow needed
- Consider adding execution logging for debugging
- May need to handle Windows-specific paths and interpreters
