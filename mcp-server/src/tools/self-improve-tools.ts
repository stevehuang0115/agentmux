/**
 * Self-Improve MCP Tools
 *
 * MCP tool handlers for self-improvement operations.
 * Enables the orchestrator to safely modify the AgentMux codebase.
 *
 * @module tools/self-improve
 */

import { z } from 'zod';

const BACKEND_BASE_URL = process.env.BACKEND_URL || 'http://localhost:8787';

/**
 * Plan response interface
 */
interface PlanResponse {
  id: string;
  description: string;
  targetFiles?: string[];
  riskLevel: string;
  requiresRestart: boolean;
}

/**
 * Execute response interface
 */
interface ExecuteResponse {
  started: boolean;
  taskId?: string;
  message: string;
}

/**
 * Status response interface
 */
interface StatusResponse {
  id: string;
  description: string;
  phase: string;
  targetFiles?: string[];
  startedAt: string;
  changes?: Array<{ file: string; type: string; description: string; applied: boolean }>;
}

/**
 * Rollback response interface
 */
interface RollbackResponse {
  success: boolean;
  filesRestored: number;
  message?: string;
}

/**
 * History item interface
 */
interface HistoryItem {
  id: string;
  description: string;
  phase: string;
  startedAt: string;
}

/**
 * Input schema for plan action
 */
const PlanInputSchema = z.object({
  description: z.string().describe('Description of the improvement'),
  files: z.array(z.object({
    path: z.string().describe('File path relative to project root'),
    operation: z.enum(['create', 'modify', 'delete']),
    content: z.string().optional().describe('New file content (for create/modify)'),
    description: z.string().describe('What this change does'),
  })).describe('Files to modify'),
});

/**
 * Input schema for execute action
 */
const ExecuteInputSchema = z.object({
  planId: z.string().describe('ID of the plan to execute'),
});

/**
 * Input schema for rollback action
 */
const RollbackInputSchema = z.object({
  reason: z.string().describe('Reason for rollback'),
});

/**
 * Handle plan action - create an improvement plan
 *
 * @param input - Plan input with description and files
 * @returns Formatted plan result
 */
export async function handleSelfImprovePlan(input: unknown): Promise<string> {
  const parsed = PlanInputSchema.parse(input);

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/self-improvement/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: parsed.description,
        targetFiles: parsed.files.map(f => f.path),
        changes: parsed.files.map(f => ({
          file: f.path,
          type: f.operation,
          description: f.description,
          content: f.content,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return `Failed to create improvement plan: ${error}`;
    }

    const plan = (await response.json()) as PlanResponse;

    return `Improvement plan created:

- Plan ID: ${plan.id}
- Description: ${plan.description}
- Files affected: ${plan.targetFiles?.length || 0}
- Risk level: ${plan.riskLevel}
- Requires restart: ${plan.requiresRestart}

To execute this plan, use:
{ action: "execute", planId: "${plan.id}" }

To cancel:
{ action: "cancel" }`;
  } catch (error) {
    return `Error creating plan: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Handle execute action - execute an improvement plan
 *
 * @param input - Execute input with plan ID
 * @returns Formatted execution result
 */
export async function handleSelfImproveExecute(input: unknown): Promise<string> {
  const parsed = ExecuteInputSchema.parse(input);

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/self-improvement/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: parsed.planId }),
    });

    if (!response.ok) {
      const error = await response.text();
      return `Failed to execute improvement: ${error}`;
    }

    const result = (await response.json()) as ExecuteResponse;

    return `Improvement execution ${result.started ? 'started' : 'failed'}:

- Task ID: ${result.taskId || 'N/A'}
- Message: ${result.message}

Note: Hot-reload will restart the process. Validation runs automatically on startup.
If validation fails, changes will be rolled back automatically.`;
  } catch (error) {
    return `Error executing improvement: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Handle status action - get current improvement status
 *
 * @returns Formatted status result
 */
export async function handleSelfImproveStatus(): Promise<string> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/self-improvement/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.text();
      return `Failed to get status: ${error}`;
    }

    const status = (await response.json()) as StatusResponse | null;

    if (!status || !status.id) {
      return 'No pending self-improvement tasks.';
    }

    return `Current self-improvement status:

- Task ID: ${status.id}
- Description: ${status.description}
- Phase: ${status.phase}
- Files: ${status.targetFiles?.join(', ') || 'N/A'}
- Started: ${status.startedAt}
- Changes applied: ${status.changes?.filter(c => c.applied).length || 0}`;
  } catch (error) {
    return `Error getting status: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Handle cancel action - cancel a planned improvement
 *
 * @returns Formatted cancel result
 */
export async function handleSelfImproveCancel(): Promise<string> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/self-improvement/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.text();
      return `Failed to cancel improvement: ${error}`;
    }

    return 'Improvement cancelled successfully.';
  } catch (error) {
    return `Error cancelling improvement: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Handle rollback action - rollback last improvement
 *
 * @param input - Rollback input with reason
 * @returns Formatted rollback result
 */
export async function handleSelfImproveRollback(input: unknown): Promise<string> {
  const parsed = RollbackInputSchema.parse(input);

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/self-improvement/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: parsed.reason }),
    });

    if (!response.ok) {
      const error = await response.text();
      return `Failed to rollback: ${error}`;
    }

    const result = (await response.json()) as RollbackResponse;

    return `Rollback ${result.success ? 'completed' : 'failed'}:

- Reason: ${parsed.reason}
- Files restored: ${result.filesRestored || 0}
- Message: ${result.message || 'Changes have been reverted.'}`;
  } catch (error) {
    return `Error during rollback: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Handle history action - get improvement history
 *
 * @returns Formatted history result
 */
export async function handleSelfImproveHistory(): Promise<string> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/self-improvement/history`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.text();
      return `Failed to get history: ${error}`;
    }

    const history = (await response.json()) as HistoryItem[];

    if (!history || history.length === 0) {
      return 'No improvement history found.';
    }

    const entries = history.slice(0, 5).map((item: HistoryItem) =>
      `- ${item.id}: ${item.description} (${item.phase}) - ${item.startedAt}`
    ).join('\n');

    return `Recent improvement history:\n\n${entries}`;
  } catch (error) {
    return `Error getting history: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Self-improve tool definition for MCP tools/list response
 */
export const selfImproveToolDefinition = {
  name: 'self_improve',
  description: `Safely modify the AgentMux codebase with automatic backup and rollback.

Actions:
- plan: Create an improvement plan describing changes to make
- execute: Execute an approved improvement plan
- status: Check status of current/pending improvements
- cancel: Cancel a planned improvement
- rollback: Revert the last improvement if issues detected
- history: View recent improvement history

Safety features:
- All changes are backed up before modification
- Automatic rollback on validation failure
- TypeScript compilation check after changes
- Test execution to verify changes don't break functionality

Examples:
- Create a plan: { action: "plan", description: "Fix bug in team service", files: [...] }
- Execute plan: { action: "execute", planId: "plan-123" }
- Check status: { action: "status" }
- Rollback: { action: "rollback", reason: "Tests failing" }`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['plan', 'execute', 'status', 'cancel', 'rollback', 'history'],
        description: 'The action to perform',
      },
      description: {
        type: 'string',
        description: 'Description of the improvement (for plan action)',
      },
      planId: {
        type: 'string',
        description: 'ID of the plan to execute (for execute action)',
      },
      files: {
        type: 'array',
        description: 'Files to modify (for plan action)',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to project root' },
            operation: { type: 'string', enum: ['create', 'modify', 'delete'] },
            content: { type: 'string', description: 'New file content (for create/modify)' },
            description: { type: 'string', description: 'What this change does' },
          },
          required: ['path', 'operation', 'description'],
        },
      },
      reason: {
        type: 'string',
        description: 'Reason for rollback (for rollback action)',
      },
    },
    required: ['action'],
  },
};
