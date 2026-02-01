/**
 * Skill Tools Tests
 *
 * Unit tests for the skill management MCP tool handlers.
 *
 * @module tools/skill-tools.test
 */

import { handleCreateSkill, handleExecuteSkill, handleListSkills } from './skill-tools.js';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('Skill Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCreateSkill', () => {
    it('should create a skill successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: 'skill-123',
              name: 'API Documentation Generator',
              category: 'development',
            },
          }),
      });

      const result = await handleCreateSkill({
        name: 'API Documentation Generator',
        description: 'Generates OpenAPI documentation from code',
        category: 'development',
        promptContent: '# API Documentation\nAnalyze the codebase...',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('API Documentation Generator');
      expect(result.skill).toBeDefined();
    });

    it('should handle creation with triggers and tags', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: 'skill-123',
              name: 'Test Skill',
              category: 'development',
            },
          }),
      });

      await handleCreateSkill({
        name: 'Test Skill',
        description: 'A test skill',
        category: 'development',
        promptContent: '# Test',
        triggers: ['test', 'testing'],
        tags: ['unit', 'integration'],
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.triggers).toEqual(['test', 'testing']);
      expect(callBody.tags).toEqual(['unit', 'integration']);
    });

    it('should handle script execution type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: 'skill-123',
              name: 'Script Skill',
              category: 'automation',
            },
          }),
      });

      await handleCreateSkill({
        name: 'Script Skill',
        description: 'Runs a bash script',
        category: 'automation',
        promptContent: '# Script Skill',
        executionType: 'script',
        scriptConfig: {
          file: 'scripts/run.sh',
          interpreter: 'bash',
        },
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.execution).toBeDefined();
      expect(callBody.execution.type).toBe('script');
      expect(callBody.execution.script).toEqual({
        file: 'scripts/run.sh',
        interpreter: 'bash',
      });
    });

    it('should handle browser execution type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: 'skill-123',
              name: 'Browser Skill',
              category: 'automation',
            },
          }),
      });

      await handleCreateSkill({
        name: 'Browser Skill',
        description: 'Automates browser actions',
        category: 'automation',
        promptContent: '# Browser Skill',
        executionType: 'browser',
        browserConfig: {
          url: 'https://example.com',
          instructions: 'Click the login button',
        },
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.execution).toBeDefined();
      expect(callBody.execution.type).toBe('browser');
      expect(callBody.execution.browser).toEqual({
        url: 'https://example.com',
        instructions: 'Click the login button',
      });
    });

    it('should not include execution for prompt-only type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: 'skill-123',
              name: 'Prompt Skill',
              category: 'development',
            },
          }),
      });

      await handleCreateSkill({
        name: 'Prompt Skill',
        description: 'A prompt-only skill',
        category: 'development',
        promptContent: '# Prompt Skill',
        executionType: 'prompt-only',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.execution).toBeUndefined();
    });

    it('should handle creation failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: () =>
          Promise.resolve({
            error: 'Skill name already exists',
          }),
      });

      const result = await handleCreateSkill({
        name: 'Duplicate Skill',
        description: 'A duplicate skill',
        category: 'development',
        promptContent: '# Duplicate',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await handleCreateSkill({
        name: 'Test Skill',
        description: 'A test skill',
        category: 'development',
        promptContent: '# Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
    });
  });

  describe('handleExecuteSkill', () => {
    it('should execute a skill successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              success: true,
              output: 'Skill executed successfully',
              durationMs: 150,
            },
          }),
      });

      const result = await handleExecuteSkill({
        skillId: 'skill-123',
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Skill executed successfully');
      expect(result.durationMs).toBe(150);
    });

    it('should pass execution context', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              success: true,
              output: 'Done',
              durationMs: 100,
            },
          }),
      });

      await handleExecuteSkill({
        skillId: 'skill-123',
        context: {
          agentId: 'agent-1',
          roleId: 'developer',
          projectId: 'project-1',
          taskId: 'task-1',
          userInput: 'Generate docs for auth module',
        },
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.context.agentId).toBe('agent-1');
      expect(callBody.context.roleId).toBe('developer');
      expect(callBody.context.projectId).toBe('project-1');
      expect(callBody.context.taskId).toBe('task-1');
      expect(callBody.context.userInput).toBe('Generate docs for auth module');
    });

    it('should use default context values when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              success: true,
              output: 'Done',
              durationMs: 100,
            },
          }),
      });

      await handleExecuteSkill({
        skillId: 'skill-123',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.context.agentId).toBe('orchestrator');
      expect(callBody.context.roleId).toBe('orchestrator');
    });

    it('should handle execution failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: () =>
          Promise.resolve({
            error: 'Skill not found',
          }),
      });

      const result = await handleExecuteSkill({
        skillId: 'nonexistent-skill',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('handleListSkills', () => {
    it('should list all skills', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: 'skill-1',
                name: 'Code Review',
                description: 'Performs code review',
                category: 'development',
                executionType: 'prompt-only',
                triggerCount: 3,
                isBuiltin: true,
                isEnabled: true,
              },
              {
                id: 'skill-2',
                name: 'Deploy Script',
                description: 'Deploys to production',
                category: 'automation',
                executionType: 'script',
                triggerCount: 2,
                isBuiltin: false,
                isEnabled: true,
              },
            ],
          }),
      });

      const result = await handleListSkills({});

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(Array.isArray(result.skills)).toBe(true);
    });

    it('should filter by category', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [],
          }),
      });

      await handleListSkills({ category: 'automation' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('category=automation'),
        expect.any(Object)
      );
    });

    it('should filter by role ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [],
          }),
      });

      await handleListSkills({ roleId: 'developer' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('roleId=developer'),
        expect.any(Object)
      );
    });

    it('should filter by search term', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [],
          }),
      });

      await handleListSkills({ search: 'deploy' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=deploy'),
        expect.any(Object)
      );
    });

    it('should handle empty results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [],
          }),
      });

      const result = await handleListSkills({ search: 'nonexistent' });

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
      expect(result.skills).toEqual([]);
    });

    it('should handle list failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: () =>
          Promise.resolve({
            error: 'Database error',
          }),
      });

      const result = await handleListSkills({});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
