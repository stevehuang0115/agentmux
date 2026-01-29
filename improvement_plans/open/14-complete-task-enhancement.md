---
id: 14-complete-task-enhancement
title: Enhance complete_task MCP Tool with Quality Gates
phase: 3
priority: P1
status: open
estimatedHours: 8
dependencies: [13-quality-gate-service]
blocks: []
---

# Task: Enhance complete_task MCP Tool with Quality Gates

## Objective
Modify the existing `complete_task` MCP tool to run quality gates before allowing task completion.

## Background
Currently, `complete_task` simply moves a task to the done folder. We need to:
1. Run quality gates first
2. Only complete if all required gates pass
3. Trigger continuation if gates fail

## Deliverables

### 1. Enhanced complete_task Tool

```typescript
// In mcp-server/src/server.ts

const completeTaskTool: MCPToolDefinition = {
  name: 'complete_task',
  description: `Mark a task as complete after verifying quality gates pass.

This tool will:
1. Run all required quality gates (typecheck, tests, build)
2. If all gates pass, move the task to done
3. If gates fail, return the failures and continue working

**Important:** Do not call this until you believe ALL gates will pass.
Run tests and typecheck locally first.`,

  inputSchema: {
    type: 'object',
    properties: {
      absoluteTaskPath: {
        type: 'string',
        description: 'Absolute path to the task file',
      },
      skipGates: {
        type: 'boolean',
        default: false,
        description: 'Skip quality gates (not recommended)',
      },
      summary: {
        type: 'string',
        description: 'Summary of what was accomplished',
      },
    },
    required: ['absoluteTaskPath'],
  },
};

async function handleCompleteTask(params: CompleteTaskParams): Promise<MCPToolResult> {
  const sessionName = this.getCallerSession();
  const projectPath = await this.getProjectPath(sessionName);
  const agentId = await this.getAgentIdFromSession(sessionName);

  this.logger.info('complete_task called', {
    sessionName,
    taskPath: params.absoluteTaskPath,
    skipGates: params.skipGates,
  });

  // Validate task exists and is in_progress
  const task = await this.taskService.loadTask(params.absoluteTaskPath);
  if (!task) {
    return {
      success: false,
      message: `Task not found: ${params.absoluteTaskPath}`,
    };
  }

  if (task.status !== 'in_progress') {
    return {
      success: false,
      message: `Task is not in_progress (current status: ${task.status})`,
    };
  }

  // Run quality gates unless skipped
  if (!params.skipGates) {
    const gateResults = await this.qualityGateService.runAllGates(projectPath);

    // Update task with gate results
    await this.ticketEditor.updateMultipleQualityGates(
      params.absoluteTaskPath,
      gateResults.results.reduce((acc, r) => {
        acc[r.name] = {
          passed: r.passed,
          lastRun: new Date().toISOString(),
          output: r.output.substring(0, 500),  // Truncate for storage
        };
        return acc;
      }, {} as Record<string, QualityGateStatus>)
    );

    if (!gateResults.allRequiredPassed) {
      // Gates failed - increment iteration and return failure
      await this.ticketEditor.incrementIteration(params.absoluteTaskPath, {
        trigger: 'explicit_request',
        action: 'retry_with_hints',
        conclusion: 'STUCK_OR_ERROR',
        notes: `Quality gates failed: ${gateResults.results.filter(r => !r.passed).map(r => r.name).join(', ')}`,
      });

      const failedGates = gateResults.results.filter(r => !r.passed && r.required);

      return {
        success: false,
        message: this.formatGateFailureMessage(failedGates),
        data: {
          failedGates: failedGates.map(g => ({
            name: g.name,
            output: g.output,
            exitCode: g.exitCode,
          })),
          iterations: task.continuation?.iterations || 0,
          maxIterations: task.continuation?.maxIterations || 10,
        },
      };
    }

    this.logger.info('All quality gates passed', { sessionName, taskPath: params.absoluteTaskPath });
  }

  // Gates passed (or skipped) - complete the task
  try {
    // Move task to done
    await this.taskService.moveTaskToDone(params.absoluteTaskPath, sessionName);

    // Record learnings
    if (params.summary) {
      await this.memoryService.recordLearning({
        agentId,
        projectPath,
        learning: `Completed task "${task.title}": ${params.summary}`,
        relatedTask: task.id,
      });
    }

    // Record successful completion in agent performance
    await this.memoryService.getAgentMemory().recordTaskCompletion(agentId, {
      iterations: task.continuation?.iterations || 1,
      gatesPassed: true,
    });

    // Remove from in-progress tracking
    await this.taskTrackingService.removeFromTracking(params.absoluteTaskPath);

    return {
      success: true,
      message: `Task completed successfully! ${params.summary || ''}`,
      data: {
        taskId: task.id,
        iterations: task.continuation?.iterations || 1,
        gatesPassed: true,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to complete task: ${error.message}`,
    };
  }
}

private formatGateFailureMessage(failedGates: GateResult[]): string {
  let message = `Quality gates failed. Please fix the following issues:\n\n`;

  for (const gate of failedGates) {
    message += `## ${gate.name} (FAILED)\n`;
    message += `\`\`\`\n${gate.output.substring(0, 1000)}\n\`\`\`\n\n`;
  }

  message += `\n**Instructions:**\n`;
  message += `1. Review the errors above\n`;
  message += `2. Fix the issues in your code\n`;
  message += `3. Run the checks locally to verify\n`;
  message += `4. Call complete_task again when all checks pass\n`;

  return message;
}
```

### 2. Add check_quality_gates Tool

Allow agents to check gates without completing:

```typescript
const checkQualityGatesTool: MCPToolDefinition = {
  name: 'check_quality_gates',
  description: `Run quality gates without completing the task.

Use this to verify your code will pass before calling complete_task.
Saves time by catching issues early.`,

  inputSchema: {
    type: 'object',
    properties: {
      gates: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific gates to run (default: all)',
      },
    },
    required: [],
  },
};

async function handleCheckQualityGates(params: CheckGatesParams): Promise<MCPToolResult> {
  const sessionName = this.getCallerSession();
  const projectPath = await this.getProjectPath(sessionName);

  const gateResults = await this.qualityGateService.runAllGates(projectPath, {
    gateNames: params.gates,
  });

  const summary = gateResults.results.map(r =>
    `${r.passed ? '✅' : '❌'} ${r.name}: ${r.passed ? 'PASSED' : 'FAILED'}`
  ).join('\n');

  return {
    success: gateResults.allRequiredPassed,
    message: gateResults.allRequiredPassed
      ? `All required gates passed!\n\n${summary}`
      : `Some gates failed:\n\n${summary}`,
    data: {
      allPassed: gateResults.allPassed,
      allRequiredPassed: gateResults.allRequiredPassed,
      results: gateResults.results.map(r => ({
        name: r.name,
        passed: r.passed,
        required: r.required,
        duration: r.duration,
        output: r.passed ? undefined : r.output.substring(0, 500),
      })),
    },
  };
}
```

### 3. Update Tool Registration

```typescript
// In MCP server initialization
registerTools() {
  // Existing tools...

  // Quality gate tools
  this.addTool('complete_task', this.handleCompleteTask.bind(this));  // Enhanced
  this.addTool('check_quality_gates', this.handleCheckQualityGates.bind(this));  // New
}
```

### 4. Integration with ContinuationService

When gates fail, trigger continuation:

```typescript
// In complete_task handler after gates fail
if (!gateResults.allRequiredPassed) {
  // Notify continuation service
  this.continuationService.handleGateFailure(
    sessionName,
    params.absoluteTaskPath,
    gateResults
  );

  // Return will include failure details for agent
}
```

## Implementation Steps

1. **Update complete_task handler**
   - Add gate execution
   - Handle pass/fail scenarios
   - Update task with results

2. **Implement check_quality_gates**
   - Run gates without completion
   - Return detailed results

3. **Add formatting helpers**
   - Format failure messages
   - Truncate output appropriately

4. **Integrate with ContinuationService**
   - Trigger continuation on failure
   - Update iteration count

5. **Update tool registration**
   - Register enhanced complete_task
   - Register new check_quality_gates

6. **Write tests**
   - Test gate integration
   - Test failure handling
   - Test skip gates option

## Acceptance Criteria

- [ ] complete_task runs gates before completion
- [ ] Gates failing prevents completion
- [ ] Failure message is clear and helpful
- [ ] check_quality_gates tool works
- [ ] Iteration count updates on failure
- [ ] skipGates option works (with warning)
- [ ] Tests passing

## Notes

- Gates should run in project directory
- Truncate output for storage
- Log gate results for debugging
- Consider timeout for very slow gates
