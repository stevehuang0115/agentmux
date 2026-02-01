# Task 56: Self-Improve MCP Tool

## Overview

Add the `self_improve` MCP tool to enable the orchestrator to safely modify the AgentMux codebase.

## Problem

The SelfImprovementService is implemented but there's no MCP tool for the orchestrator to invoke it. The orchestrator cannot trigger self-improvement workflows.

## Current State

```typescript
// mcp-server/src/tools/index.ts
// Has role, skill, project tools but NO self_improve tool
```

## Implementation

### Create Self-Improve Tool

**`mcp-server/src/tools/self-improve.tool.ts`**

```typescript
/**
 * Self-Improve MCP Tool
 *
 * Enables the orchestrator to safely modify the AgentMux codebase.
 *
 * @module tools/self-improve
 */

import { z } from 'zod';
import type { McpTool, ToolContext } from '../types/index.js';

/**
 * Input schema for self-improvement request
 */
const SelfImproveInputSchema = z.object({
  action: z.enum(['plan', 'execute', 'status', 'rollback', 'approve']),
  description: z.string().optional(),
  planId: z.string().optional(),
  files: z.array(z.object({
    path: z.string(),
    operation: z.enum(['create', 'modify', 'delete']),
    content: z.string().optional(),
  })).optional(),
  reason: z.string().optional(),
});

type SelfImproveInput = z.infer<typeof SelfImproveInputSchema>;

/**
 * Self-improvement MCP tool definition
 */
export const selfImproveTool: McpTool = {
  name: 'self_improve',
  description: `Safely modify the AgentMux codebase with automatic backup and rollback.

Actions:
- plan: Create an improvement plan describing changes to make
- execute: Execute an approved improvement plan
- status: Check status of current/pending improvements
- rollback: Revert the last improvement if issues detected
- approve: Mark a plan as approved for execution

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
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['plan', 'execute', 'status', 'rollback', 'approve'],
        description: 'The action to perform',
      },
      description: {
        type: 'string',
        description: 'Description of the improvement (for plan action)',
      },
      planId: {
        type: 'string',
        description: 'ID of the plan to execute/approve (for execute/approve actions)',
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
          },
          required: ['path', 'operation'],
        },
      },
      reason: {
        type: 'string',
        description: 'Reason for rollback (for rollback action)',
      },
    },
    required: ['action'],
  },

  handler: async (input: unknown, context: ToolContext): Promise<string> => {
    const parsed = SelfImproveInputSchema.parse(input);

    try {
      const response = await fetch(`${context.backendUrl}/api/self-improvement/${parsed.action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      if (!response.ok) {
        const error = await response.text();
        return `Self-improvement ${parsed.action} failed: ${error}`;
      }

      const result = await response.json();
      return formatResult(parsed.action, result);
    } catch (error) {
      return `Self-improvement error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
};

/**
 * Format the result based on action type
 */
function formatResult(action: string, result: unknown): string {
  const data = result as Record<string, unknown>;

  switch (action) {
    case 'plan':
      return `Improvement plan created:
- Plan ID: ${data.planId}
- Description: ${data.description}
- Files affected: ${(data.files as unknown[])?.length || 0}
- Status: ${data.status}

Use { action: "approve", planId: "${data.planId}" } to approve, then { action: "execute", planId: "${data.planId}" } to apply changes.`;

    case 'execute':
      return `Improvement execution ${data.success ? 'succeeded' : 'failed'}:
- Plan ID: ${data.planId}
- Files modified: ${data.filesModified || 0}
- Validation: ${data.validationPassed ? 'PASSED' : 'FAILED'}
- Tests: ${data.testsPassed ? 'PASSED' : 'FAILED'}
${data.rollbackPerformed ? '- ROLLBACK PERFORMED due to validation failure' : ''}`;

    case 'status':
      return `Self-improvement status:
- Pending plans: ${(data.pendingPlans as unknown[])?.length || 0}
- Last execution: ${data.lastExecution || 'None'}
- Active improvement: ${data.activeImprovement || 'None'}`;

    case 'rollback':
      return `Rollback ${data.success ? 'completed' : 'failed'}:
- Reason: ${data.reason}
- Files restored: ${data.filesRestored || 0}`;

    case 'approve':
      return `Plan ${data.planId} approved for execution.
Use { action: "execute", planId: "${data.planId}" } to apply changes.`;

    default:
      return JSON.stringify(result, null, 2);
  }
}
```

### Register Tool in Index

**Update `mcp-server/src/tools/index.ts`**

```typescript
import { selfImproveTool } from './self-improve.tool.js';

export const allTools: McpTool[] = [
  // ... existing tools ...
  selfImproveTool,
];
```

### Create Backend Controller

**`backend/src/controllers/self-improvement/self-improvement.controller.ts`**

```typescript
/**
 * Self-Improvement Controller
 *
 * REST API endpoints for self-improvement operations.
 *
 * @module controllers/self-improvement
 */

import { Router, Request, Response } from 'express';
import { getSelfImprovementService } from '../../services/orchestrator/index.js';

const router = Router();

/**
 * POST /api/self-improvement/plan
 * Create an improvement plan
 */
router.post('/plan', async (req: Request, res: Response) => {
  try {
    const service = getSelfImprovementService();
    const plan = await service.createPlan(req.body);
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/self-improvement/approve
 * Approve a plan for execution
 */
router.post('/approve', async (req: Request, res: Response) => {
  try {
    const service = getSelfImprovementService();
    const result = await service.approvePlan(req.body.planId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/self-improvement/execute
 * Execute an approved plan
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const service = getSelfImprovementService();
    const result = await service.executePlan(req.body.planId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/self-improvement/status
 * Get current status
 */
router.post('/status', async (_req: Request, res: Response) => {
  try {
    const service = getSelfImprovementService();
    const status = await service.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/self-improvement/rollback
 * Rollback last improvement
 */
router.post('/rollback', async (req: Request, res: Response) => {
  try {
    const service = getSelfImprovementService();
    const result = await service.rollback(req.body.reason);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `mcp-server/src/tools/self-improve.tool.ts` | Create |
| `mcp-server/src/tools/self-improve.tool.test.ts` | Create |
| `mcp-server/src/tools/index.ts` | Add export |
| `backend/src/controllers/self-improvement/self-improvement.controller.ts` | Create |
| `backend/src/controllers/self-improvement/index.ts` | Create barrel export |
| `backend/src/controllers/index.ts` | Add route |

## Acceptance Criteria

- [ ] `self_improve` tool available in MCP server
- [ ] All actions work: plan, approve, execute, status, rollback
- [ ] Backend controller handles all endpoints
- [ ] Tool provides clear formatted responses
- [ ] Error handling for all failure cases
- [ ] Tests for tool and controller

## Dependencies

- Task 50: Self-Improvement Service
- Task 51-53: Hot-Reload Resilience

## Priority

**High** - Core functionality for orchestrator self-improvement
