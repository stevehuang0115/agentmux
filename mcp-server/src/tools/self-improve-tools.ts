/**
 * Self-Improvement Tool Handlers
 *
 * Handles MCP tool calls for self-improvement operations including
 * planning, executing, checking status, and rolling back changes.
 *
 * @module tools/self-improve-tools
 */

import {
  SelfImproveToolParams,
  SelfImprovePlanParams,
  SelfImproveExecuteParams,
  SelfImproveRollbackParams,
  ToolResultData,
} from '../types.js';

// Backend API URL for self-improvement endpoints
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8787';

/**
 * API response wrapper type
 */
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

/**
 * Self-improvement plan data from API
 */
interface PlanData {
  id: string;
  description: string;
  targetFiles: string[];
  riskLevel: 'low' | 'medium' | 'high';
  requiresRestart: boolean;
}

/**
 * Self-improvement status data from API
 */
interface StatusData {
  id: string;
  description: string;
  phase: string;
  restartCount: number;
  targetFiles: string[];
  lastUpdatedAt: string;
}

/**
 * Handle the self_improve MCP tool call
 *
 * Routes to the appropriate action handler based on the action type.
 *
 * @param params - Self-improvement parameters
 * @returns Tool result with operation outcome
 *
 * @example
 * ```typescript
 * // Create a plan
 * const result = await handleSelfImprove({
 *   action: 'plan',
 *   description: 'Fix bug in team service',
 *   files: [{ path: 'src/team.ts', operation: 'modify', content: '...' }],
 * });
 *
 * // Check status
 * const status = await handleSelfImprove({ action: 'status' });
 * ```
 */
export async function handleSelfImprove(params: SelfImproveToolParams): Promise<ToolResultData> {
  switch (params.action) {
    case 'plan':
      return handlePlan(params);
    case 'execute':
      return handleExecute(params);
    case 'status':
      return handleStatus();
    case 'rollback':
      return handleRollback(params);
    case 'cancel':
      return handleCancel();
    default:
      return {
        success: false,
        error: `Unknown action: ${(params as { action: string }).action}`,
      };
  }
}

/**
 * Handle plan action - creates a new improvement plan
 *
 * @param params - Plan parameters
 * @returns Tool result with plan information
 */
async function handlePlan(params: SelfImprovePlanParams): Promise<ToolResultData> {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/self-improvement/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: params.description,
        targetFiles: params.files.map((f) => f.path),
        changes: params.files.map((f) => ({
          file: f.path,
          type: f.operation,
          description: f.description || `${f.operation} ${f.path}`,
          content: f.content,
        })),
      }),
    });

    const data = (await response.json()) as ApiResponse<PlanData>;

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Failed to create plan: ${response.statusText}`,
      };
    }

    const planData = data.data;
    if (!planData) {
      return {
        success: false,
        error: 'No plan data returned from server',
      };
    }

    return {
      success: true,
      message: `Improvement plan created`,
      plan: {
        id: planData.id,
        description: planData.description,
        filesAffected: planData.targetFiles.length,
        riskLevel: planData.riskLevel,
        requiresRestart: planData.requiresRestart,
      },
      nextSteps: `Use { action: "execute", planId: "${planData.id}" } to apply changes.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating plan',
    };
  }
}

/**
 * Handle execute action - executes a planned improvement
 *
 * @param params - Execute parameters
 * @returns Tool result with execution outcome
 */
async function handleExecute(params: SelfImproveExecuteParams): Promise<ToolResultData> {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/self-improvement/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: params.planId,
      }),
    });

    const data = (await response.json()) as ApiResponse<{
      started: boolean;
      message: string;
      taskId: string;
    }>;

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Failed to execute plan: ${response.statusText}`,
      };
    }

    const result = data.data;
    if (!result) {
      return {
        success: false,
        error: 'No result data returned from server',
      };
    }

    return {
      success: result.started,
      message: result.message,
      taskId: result.taskId,
      note: 'Changes are being applied. Hot-reload will restart the process. ' +
            'Validation runs automatically on startup. Check status later.',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error executing plan',
    };
  }
}

/**
 * Handle status action - gets current self-improvement status
 *
 * @returns Tool result with current status
 */
async function handleStatus(): Promise<ToolResultData> {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/self-improvement/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = (await response.json()) as ApiResponse<StatusData | null>;

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Failed to get status: ${response.statusText}`,
      };
    }

    const status = data.data;
    if (!status) {
      return {
        success: true,
        message: 'No active self-improvement',
        hasActive: false,
      };
    }

    return {
      success: true,
      message: `Active improvement: ${status.description}`,
      hasActive: true,
      improvement: {
        id: status.id,
        description: status.description,
        phase: status.phase,
        restartCount: status.restartCount,
        filesAffected: status.targetFiles.length,
        lastUpdated: status.lastUpdatedAt,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error getting status',
    };
  }
}

/**
 * Handle rollback action - rolls back the last improvement
 *
 * @param params - Rollback parameters
 * @returns Tool result with rollback outcome
 */
async function handleRollback(params: SelfImproveRollbackParams): Promise<ToolResultData> {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/self-improvement/rollback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: params.reason,
      }),
    });

    const data = (await response.json()) as ApiResponse<{
      success: boolean;
      filesRestored: number;
      gitReset: boolean;
    }>;

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Failed to rollback: ${response.statusText}`,
      };
    }

    const result = data.data;
    if (!result) {
      return {
        success: false,
        error: 'No rollback result returned from server',
      };
    }

    return {
      success: result.success,
      message: `Rollback completed`,
      filesRestored: result.filesRestored,
      gitReset: result.gitReset,
      reason: params.reason,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during rollback',
    };
  }
}

/**
 * Handle cancel action - cancels a pending improvement
 *
 * @returns Tool result with cancellation outcome
 */
async function handleCancel(): Promise<ToolResultData> {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/self-improvement/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = (await response.json()) as ApiResponse<{ cancelled: boolean }>;

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Failed to cancel: ${response.statusText}`,
      };
    }

    return {
      success: true,
      message: 'Improvement cancelled',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error cancelling improvement',
    };
  }
}
