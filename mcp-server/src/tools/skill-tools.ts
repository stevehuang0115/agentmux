/**
 * Skill Management Tool Handlers
 *
 * Handles MCP tool calls for skill management operations including
 * creating, executing, and listing skills.
 *
 * @module tools/skill-tools
 */

import {
  CreateSkillToolParams,
  ExecuteSkillToolParams,
  ListSkillsToolParams,
  ToolResultData,
} from '../types.js';

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

/**
 * API response wrapper type
 */
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

/**
 * Skill data from API
 */
interface SkillData {
  id: string;
  name: string;
  description?: string;
  category: string;
  executionType?: string;
  triggerCount?: number;
  isBuiltin?: boolean;
  isEnabled?: boolean;
}

/**
 * Skill execution result from API
 */
interface SkillExecutionData {
  success: boolean;
  output?: string;
  durationMs?: number;
  data?: Record<string, unknown>;
}

/**
 * Handle the create_skill MCP tool call
 *
 * Creates a new skill with instructions and optional execution configuration.
 *
 * @param params - Skill creation parameters
 * @returns Tool result with created skill information
 *
 * @example
 * ```typescript
 * const result = await handleCreateSkill({
 *   name: 'API Documentation Generator',
 *   description: 'Generates OpenAPI documentation from code',
 *   category: 'development',
 *   promptContent: '# API Documentation\nAnalyze the codebase...',
 *   triggers: ['api docs', 'documentation'],
 * });
 * ```
 */
export async function handleCreateSkill(params: CreateSkillToolParams): Promise<ToolResultData> {
  try {
    const skillPayload: Record<string, unknown> = {
      name: params.name,
      description: params.description,
      category: params.category,
      promptContent: params.promptContent,
      triggers: params.triggers || [],
      tags: params.tags || [],
    };

    // Add execution configuration if specified
    if (params.executionType && params.executionType !== 'prompt-only') {
      const execution: Record<string, unknown> = {
        type: params.executionType,
      };

      if (params.scriptConfig) {
        execution.script = params.scriptConfig;
      }

      if (params.browserConfig) {
        execution.browser = params.browserConfig;
      }

      skillPayload.execution = execution;
    }

    const response = await fetch(`${BACKEND_API_URL}/api/settings/skills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(skillPayload),
    });

    const data = (await response.json()) as ApiResponse<SkillData>;

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Failed to create skill: ${response.statusText}`,
      };
    }

    const skillData = data.data;
    if (!skillData) {
      return {
        success: false,
        error: 'No skill data returned from server',
      };
    }

    return {
      success: true,
      message: `Skill "${params.name}" created successfully`,
      skill: {
        id: skillData.id,
        name: skillData.name,
        category: skillData.category,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating skill',
    };
  }
}

/**
 * Handle the execute_skill MCP tool call
 *
 * Executes a skill with the provided context.
 *
 * @param params - Skill execution parameters
 * @returns Tool result with execution output
 *
 * @example
 * ```typescript
 * const result = await handleExecuteSkill({
 *   skillId: 'skill-123',
 *   context: {
 *     agentId: 'agent-1',
 *     roleId: 'developer',
 *     userInput: 'Generate docs for the auth module',
 *   },
 * });
 * ```
 */
export async function handleExecuteSkill(params: ExecuteSkillToolParams): Promise<ToolResultData> {
  try {
    const executionContext = {
      agentId: params.context?.agentId || 'orchestrator',
      roleId: params.context?.roleId || 'orchestrator',
      projectId: params.context?.projectId,
      taskId: params.context?.taskId,
      userInput: params.context?.userInput,
    };

    const response = await fetch(`${BACKEND_API_URL}/api/settings/skills/${params.skillId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ context: executionContext }),
    });

    const data = (await response.json()) as ApiResponse<SkillExecutionData>;

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Failed to execute skill: ${response.statusText}`,
      };
    }

    const execResult = data.data;
    if (!execResult) {
      return {
        success: false,
        error: 'No execution result returned from server',
      };
    }

    return {
      success: execResult.success,
      output: execResult.output,
      durationMs: execResult.durationMs,
      data: execResult.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error executing skill',
    };
  }
}

/**
 * Handle the list_skills MCP tool call
 *
 * Lists available skills, optionally filtered by category, role, or search term.
 *
 * @param params - Skill list filter parameters
 * @returns Tool result with list of skills
 *
 * @example
 * ```typescript
 * const result = await handleListSkills({
 *   category: 'development',
 *   search: 'documentation',
 * });
 * ```
 */
export async function handleListSkills(params: ListSkillsToolParams): Promise<ToolResultData> {
  try {
    const queryParams = new URLSearchParams();
    if (params.category) queryParams.set('category', params.category);
    if (params.roleId) queryParams.set('roleId', params.roleId);
    if (params.search) queryParams.set('search', params.search);

    const url = `${BACKEND_API_URL}/api/settings/skills${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = (await response.json()) as ApiResponse<SkillData[]>;

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Failed to list skills: ${response.statusText}`,
      };
    }

    const skills = data.data || [];

    return {
      success: true,
      skills: skills.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category,
        executionType: s.executionType,
        triggerCount: s.triggerCount,
        isBuiltin: s.isBuiltin,
        isEnabled: s.isEnabled,
      })),
      count: skills.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error listing skills',
    };
  }
}
