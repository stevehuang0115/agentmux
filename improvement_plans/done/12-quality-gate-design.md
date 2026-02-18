---
id: 12-quality-gate-design
title: Design Quality Gate System
phase: 3
priority: P1
status: open
estimatedHours: 6
dependencies: [11-iteration-tracking]
blocks: [13-quality-gate-service, 14-complete-task-enhancement]
---

# Task: Design Quality Gate System

## Objective
Design the architecture for enforcing quality gates before task completion.

## Background
Quality gates ensure that tasks meet minimum quality standards before being marked complete:
- TypeScript compilation passes
- Tests pass
- Linting passes
- Build succeeds
- Custom project-specific checks

## Deliverables

### 1. Quality Gate Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    QUALITY GATE FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Agent calls: complete_task(taskPath)                       │
│                           │                                 │
│                           ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           QualityGateService.runGates()              │   │
│  │                                                      │   │
│  │  1. Load gate config (project or default)            │   │
│  │  2. Run each gate in sequence                        │   │
│  │  3. Collect results                                  │   │
│  │  4. Return pass/fail status                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                 │
│              ┌────────────┴────────────┐                    │
│              ▼                         ▼                    │
│      All Gates Pass            Some Gates Fail              │
│              │                         │                    │
│              ▼                         ▼                    │
│  ┌─────────────────────┐   ┌─────────────────────────────┐  │
│  │ Complete the task   │   │ Return failure with details │  │
│  │ Move to done/       │   │ Update ticket with results  │  │
│  │ Record learnings    │   │ Increment iteration         │  │
│  │ Assign next task    │   │ Continue work               │  │
│  └─────────────────────┘   └─────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Gate Configuration Schema

```yaml
# project/.crewly/config/quality-gates.yaml

# Global settings
settings:
  runInParallel: false          # Sequential by default
  stopOnFirstFailure: false     # Run all gates
  timeout: 300000               # 5 minutes total timeout

# Required gates (must all pass)
required:
  - name: typecheck
    command: npm run typecheck
    timeout: 60000
    description: TypeScript compilation check

  - name: tests
    command: npm test -- --passWithNoTests
    timeout: 120000
    description: Run unit tests
    env:
      CI: "true"

  - name: build
    command: npm run build
    timeout: 180000
    description: Production build

# Optional gates (warning only)
optional:
  - name: lint
    command: npm run lint
    timeout: 30000
    description: Code linting
    allowFailure: true

  - name: coverage
    command: npm run test:coverage
    timeout: 120000
    description: Code coverage check
    threshold:
      lines: 80
      branches: 70

# Custom gates (project-specific)
custom:
  - name: e2e
    command: npm run test:e2e
    timeout: 300000
    description: End-to-end tests
    required: false
    runOn: ['feature/*', 'main']  # Only on these branches

  - name: security
    command: npm audit --audit-level=high
    timeout: 30000
    description: Security vulnerability check
    required: false
```

### 3. Type Definitions

```typescript
// backend/src/types/quality-gate.types.ts

interface QualityGate {
  name: string;
  command: string;
  timeout: number;
  description?: string;
  required: boolean;
  allowFailure?: boolean;
  env?: Record<string, string>;
  runOn?: string[];  // Branch patterns
  threshold?: Record<string, number>;
}

interface GateConfig {
  settings: {
    runInParallel: boolean;
    stopOnFirstFailure: boolean;
    timeout: number;
  };
  required: QualityGate[];
  optional: QualityGate[];
  custom: QualityGate[];
}

interface GateResult {
  name: string;
  passed: boolean;
  required: boolean;
  duration: number;
  output: string;
  exitCode: number;
  error?: string;
}

interface GateRunResults {
  allRequiredPassed: boolean;
  allPassed: boolean;
  results: GateResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  duration: number;
}
```

### 4. Default Gate Configuration

```typescript
// config/quality-gates/default-gates.ts

export const DEFAULT_GATES: GateConfig = {
  settings: {
    runInParallel: false,
    stopOnFirstFailure: false,
    timeout: 300000,
  },
  required: [
    {
      name: 'typecheck',
      command: 'npm run typecheck',
      timeout: 60000,
      required: true,
      description: 'TypeScript compilation',
    },
    {
      name: 'tests',
      command: 'npm test -- --passWithNoTests',
      timeout: 120000,
      required: true,
      description: 'Unit tests',
    },
    {
      name: 'build',
      command: 'npm run build',
      timeout: 180000,
      required: true,
      description: 'Production build',
    },
  ],
  optional: [
    {
      name: 'lint',
      command: 'npm run lint',
      timeout: 30000,
      required: false,
      description: 'Code linting',
    },
  ],
  custom: [],
};
```

### 5. Gate Runner Design

```typescript
interface IGateRunner {
  // Run a single gate
  runGate(gate: QualityGate, projectPath: string): Promise<GateResult>;

  // Run all gates according to config
  runAllGates(config: GateConfig, projectPath: string): Promise<GateRunResults>;

  // Check if gate should run (branch matching)
  shouldRunGate(gate: QualityGate, currentBranch: string): boolean;
}
```

### 6. Integration Points

#### With complete_task MCP Tool

```typescript
// When agent calls complete_task
async function completeTask(params: CompleteTaskParams): Promise<MCPToolResult> {
  const projectPath = await this.getProjectPath(params.sessionName);

  // Run quality gates
  const gateResults = await this.qualityGateService.runAllGates(projectPath);

  if (!gateResults.allRequiredPassed) {
    // Update ticket with results
    await this.ticketEditor.updateQualityGates(params.taskPath, gateResults);

    // Trigger continuation with gate failure info
    await this.continuationService.handleGateFailure(
      params.sessionName,
      params.taskPath,
      gateResults
    );

    return {
      success: false,
      message: 'Quality gates failed',
      failedGates: gateResults.results.filter(r => !r.passed),
    };
  }

  // Gates passed - complete the task
  return this.doCompleteTask(params);
}
```

#### With ContinuationService

```typescript
// In ContinuationService
async handleGateFailure(
  sessionName: string,
  taskPath: string,
  gateResults: GateRunResults
): Promise<void> {
  // Increment iteration
  await this.ticketEditor.incrementIteration(taskPath, {
    trigger: 'explicit_request',
    action: 'retry_with_hints',
    conclusion: 'STUCK_OR_ERROR',
    notes: `Gates failed: ${gateResults.results.filter(r => !r.passed).map(r => r.name).join(', ')}`,
  });

  // Inject retry prompt
  const prompt = await this.buildGateFailurePrompt(taskPath, gateResults);
  await this.injectPrompt(sessionName, prompt);
}
```

## Implementation Steps

1. **Define type interfaces**
   - GateConfig, GateResult, GateRunResults
   - Export from types/

2. **Design configuration format**
   - YAML schema
   - Required vs optional vs custom

3. **Create default configuration**
   - Standard gates for TypeScript projects
   - Reasonable timeouts

4. **Design gate runner**
   - Sequential execution
   - Timeout handling
   - Output capture

5. **Plan integration**
   - With complete_task
   - With ContinuationService
   - With TicketEditorService

6. **Document configuration**
   - How to customize
   - Available options

## Acceptance Criteria

- [ ] Type definitions complete
- [ ] Configuration schema documented
- [ ] Default gates defined
- [ ] Integration points identified
- [ ] Architecture diagram complete

## Notes

- Gates run in project directory
- Capture both stdout and stderr
- Truncate long output
- Consider caching gate results
