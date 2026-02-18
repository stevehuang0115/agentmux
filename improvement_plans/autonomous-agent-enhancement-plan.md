# Crewly Autonomous Agent Enhancement Plan (Revised)

## Incorporating Ideas from Moltbot & Ralph Loop

**Document Version:** 2.0
**Date:** January 29, 2026
**Goal:** Transform Crewly into a fully autonomous one-man company platform

---

## Executive Summary

This revised plan incorporates learnings from Moltbot and Ralph Loop while leveraging Crewly's **existing infrastructure**:

- **Crewly already has**: PTY session management, activity monitoring, heartbeat tracking, ticket system, scheduled check-ins, context loading, prompt building, and memory logs
- **What we need to add**: Structured persistent memory (agent + project scoped), automatic "continue work" mechanism, quality gates, learnings accumulation

**Key Insight:** Crewly doesn't need Claude Code's stop hook because it directly controls PTY sessions and can detect when agents stop via `onExit()` callbacks and activity monitoring.

---

## Part 1: Current Crewly Capabilities

### What Already Exists

```
Crewly Infrastructure:
├── PTY Session Management
│   ├── PtySession class with onData() and onExit() listeners
│   ├── PtyTerminalBuffer with xterm.js output parsing
│   └── Session existence checks and output capture
│
├── Activity Monitoring
│   ├── ActivityMonitorService - polls every 2 minutes
│   ├── AgentHeartbeatService - tracks MCP tool calls
│   ├── 30-minute stale threshold detection
│   └── teamWorkingStatus.json tracking
│
├── Ticket System (10+ MCP tools)
│   ├── Statuses: open → in_progress → review → done (+ blocked)
│   ├── File-based status (files move between folders)
│   ├── YAML frontmatter + Markdown body
│   └── Assignment, delegation, blocking, completion
│
├── Memory & Context
│   ├── project/.crewly/memory/ logs (progress, communication, delegations)
│   ├── ContextLoaderService - loads specs, tickets, git, dependencies
│   ├── PromptBuilderService - role + project context assembly
│   └── Scheduled check-ins via SchedulerService
│
└── Storage Structure
    ├── ~/.crewly/ - global (teams, projects, runtime)
    └── project/.crewly/ - project-specific (specs, tasks, memory, prompts)
```

### Current Gaps

| Gap | Impact | Solution |
|-----|--------|----------|
| **Unstructured memory** | Logs accumulate but aren't queryable | Structured memory service |
| **No project-scoped knowledge** | Each project starts fresh | Project knowledge base |
| **No auto-continue** | Agents stop, need manual restart | Continuation service |
| **No quality gates** | Tasks complete without verification | Gate validation |
| **No learnings extraction** | Knowledge buried in logs | Learnings service |
| **Stale detection → no action** | Detected but no automatic response | Auto-continue trigger |

---

## Part 2: Revised Architecture

### 2.1 Two-Level Memory System

Since Crewly is **project-based**, memory needs to exist at two levels:

```
Memory Architecture:
│
├── Agent-Level Memory (~/.crewly/agents/{agentId}/)
│   ├── role-knowledge.json     # Role-specific learnings
│   │   └── "Always run npm install before npm test"
│   ├── preferences.json        # Working style preferences
│   │   └── "Prefers TypeScript, uses Jest for testing"
│   ├── sop-custom/             # Agent-created SOPs
│   │   └── my-debugging-steps.md
│   └── performance.json        # Success rates, common errors
│
└── Project-Level Memory (project/.crewly/knowledge/)
    ├── patterns.json           # Project code patterns
    │   └── "API calls use apiService.fetch()"
    ├── decisions.json          # Architecture decisions
    │   └── "Using Redux for state, decided 2024-01-15"
    ├── gotchas.json            # Known issues/workarounds
    │   └── "Must restart server after env changes"
    ├── relationships.json      # Component relationships
    │   └── "UserService depends on AuthService"
    └── learnings.md            # Append-only learnings log
```

### 2.2 Continuation Detection & Response

Crewly can detect agent completion/idle through existing infrastructure:

```
Detection Points (Already Exist):
├── PTY onExit() callback           # Process terminated
├── ActivityMonitor (2-min poll)    # No output change → idle
├── HeartbeatService (30-min)       # No MCP calls → stale
└── Session existence check         # Session not found

NEW: Continuation Service
├── Listen for detection events
├── Analyze terminal output for completion signals
├── Determine if task is done or needs continuation
├── Inject continuation prompt if needed
└── Track iteration count for safety limits
```

**Continuation Logic:**

```typescript
// When agent stops/goes idle
async function handleAgentIdle(sessionName: string): Promise<void> {
  const status = await analyzeAgentState(sessionName);

  switch (status.conclusion) {
    case 'TASK_COMPLETE':
      // Move ticket to done, assign next task
      await completeCurrentTask(sessionName);
      await assignNextTask(sessionName);
      break;

    case 'WAITING_INPUT':
      // Agent is waiting for user/other agent
      await notifyOwner(sessionName, status.waitingFor);
      break;

    case 'STUCK_OR_ERROR':
      // Need intervention or retry
      await handleStuckAgent(sessionName, status.error);
      break;

    case 'INCOMPLETE':
      // Task not done, continue work
      if (status.iterations < MAX_ITERATIONS) {
        await injectContinuationPrompt(sessionName);
      } else {
        await notifyIterationLimit(sessionName);
      }
      break;
  }
}
```

### 2.3 Quality Gates (Enhance Existing Ticket System)

Add quality gates to the existing ticket workflow:

```yaml
# Enhanced ticket format: project/.crewly/tasks/milestone/in_progress/task.md
---
id: implement-user-auth
title: Implement user authentication
status: in_progress
assignedTo: backend-dev
priority: high
iterations: 2              # NEW: Track iterations
maxIterations: 10          # NEW: Safety limit
qualityGates:              # NEW: Required checks
  typecheck: false
  tests: false
  lint: false
  build: false
verification:              # NEW: Verification status
  required: true
  verifiedBy: null
  verifiedAt: null
---
```

**Gate Validation Flow:**

```
Agent calls: complete_task(taskPath)
    ↓
ContinuationService.validateCompletion(taskPath)
    ↓
For each gate in task.qualityGates:
    ↓
    Run: npm run {gateCommand}
    ↓
    Record: pass/fail
    ↓
All gates pass?
    ├── YES → Move to done/ folder
    └── NO → Increment iterations, continue work
```

### 2.4 Storage Schema (Revised)

```
~/.crewly/
├── teams.json                     # (existing)
├── projects.json                  # (existing)
├── runtime.json                   # (existing)
├── agents/                        # NEW: Agent-level memory
│   └── {agentId}/
│       ├── role-knowledge.json
│       ├── preferences.json
│       ├── performance.json
│       └── sop-custom/
└── sops/                          # NEW: Global SOPs
    ├── pm/
    ├── developer/
    └── qa/

project/.crewly/
├── specs/                         # (existing)
├── tasks/                         # (existing - enhanced)
├── memory/                        # (existing)
│   ├── progress.log
│   └── communication.log
├── prompts/                       # (existing)
├── context/                       # (existing)
└── knowledge/                     # NEW: Project knowledge base
    ├── patterns.json
    ├── decisions.json
    ├── gotchas.json
    ├── relationships.json
    └── learnings.md
```

---

## Part 3: Implementation Plan

### Phase 1: Structured Memory System (Week 1-2)

**Goal:** Replace unstructured logs with queryable memory

#### 1.1 Memory Service

```typescript
// backend/src/services/memory/memory.service.ts

interface MemoryService {
  // Agent-level memory
  rememberAgentFact(agentId: string, fact: string, category: string): Promise<void>;
  recallAgentMemory(agentId: string, context: string): Promise<string[]>;

  // Project-level memory
  rememberProjectPattern(projectPath: string, pattern: PatternEntry): Promise<void>;
  rememberProjectDecision(projectPath: string, decision: DecisionEntry): Promise<void>;
  rememberProjectGotcha(projectPath: string, gotcha: GotchaEntry): Promise<void>;
  recordLearning(projectPath: string, agentId: string, learning: string): Promise<void>;

  // Context generation
  getAgentContext(agentId: string): Promise<string>;
  getProjectContext(projectPath: string): Promise<string>;
  getFullContext(agentId: string, projectPath: string): Promise<string>;
}
```

#### 1.2 New MCP Tools for Memory

```typescript
// MCP tools for agents to manage memory

// Agent remembers something
'remember': {
  params: { content: string, category: 'fact' | 'pattern' | 'gotcha' | 'decision' },
  action: 'Store in appropriate memory location'
}

// Agent recalls relevant memories
'recall': {
  params: { context: string, scope: 'agent' | 'project' | 'both' },
  action: 'Return relevant memories for context'
}

// Record a learning
'record_learning': {
  params: { learning: string, relatedTask?: string },
  action: 'Append to learnings.md with timestamp'
}
```

#### 1.3 Prompt Builder Integration

Modify `PromptBuilderService` to include memories:

```typescript
async buildSystemPrompt(teamMember: TeamMember, project: Project): Promise<string> {
  const basePrompt = await this.loadRolePrompt(teamMember.role);
  const projectContext = await this.contextLoader.loadProjectContext(project.path);

  // NEW: Add memory context
  const agentMemory = await this.memoryService.getAgentContext(teamMember.id);
  const projectMemory = await this.memoryService.getProjectContext(project.path);

  return `
${basePrompt}

## Your Knowledge Base (Agent Level)
${agentMemory}

## Project Knowledge
${projectMemory}

## Current Project Context
${projectContext}
  `;
}
```

**Deliverables:**
- `MemoryService` with agent + project memory
- New MCP tools: `remember`, `recall`, `record_learning`
- Updated `PromptBuilderService` with memory injection
- Memory storage files created automatically

---

### Phase 2: Continuation Service (Week 3-4)

**Goal:** Automatically continue work when agents stop prematurely

#### 2.1 Completion Detection

Enhance existing activity monitoring:

```typescript
// backend/src/services/continuation/continuation.service.ts

interface ContinuationService {
  // Subscribe to agent lifecycle events
  watchAgent(sessionName: string): void;

  // Analyze current state
  analyzeAgentState(sessionName: string): Promise<AgentStateAnalysis>;

  // Take action based on state
  handleAgentIdle(sessionName: string): Promise<void>;
  handleAgentExit(sessionName: string, exitCode: number): Promise<void>;

  // Inject continuation prompt
  injectContinuationPrompt(sessionName: string): Promise<void>;
}

interface AgentStateAnalysis {
  conclusion: 'TASK_COMPLETE' | 'WAITING_INPUT' | 'STUCK_OR_ERROR' | 'INCOMPLETE';
  confidence: number;
  evidence: string[];
  currentTask?: string;
  iterations: number;
  lastOutput: string;
}
```

#### 2.2 Terminal Output Analysis

```typescript
// Analyze terminal output for completion signals
function analyzeTerminalOutput(output: string): CompletionAnalysis {
  const signals = {
    // Positive completion signals
    taskComplete: /task\s+(completed?|done|finished)/i.test(output),
    allTestsPass: /\d+\s+pass(ed|ing)?,?\s+0\s+fail/i.test(output),
    buildSuccess: /build\s+(succeeded|successful|complete)/i.test(output),
    commitMade: /\[\w+\s+[a-f0-9]+\]/.test(output),  // Git commit hash

    // Waiting signals
    waitingForInput: /waiting\s+for|please\s+provide|need\s+more\s+info/i.test(output),
    askingQuestion: /\?\s*$/.test(output.trim()),

    // Error signals
    hasError: /error:|exception:|failed:|fatal:/i.test(output),
    testsFailed: /\d+\s+fail(ed|ing)?/i.test(output),

    // Claude Code specific
    claudeExited: /Claude\s+(Code\s+)?exited/i.test(output),
    idlePrompt: /\$\s*$/.test(output.trim()),  // Shell prompt
  };

  return determineConclusion(signals);
}
```

#### 2.3 Continuation Prompt Template

```markdown
<!-- config/continuation/continue-work.md -->

# Continue Your Work

You were working on: {{CURRENT_TASK}}

## Current Status
- Iterations: {{ITERATIONS}}/{{MAX_ITERATIONS}}
- Last activity: {{LAST_ACTIVITY}}

## Quality Gates Status
{{#each QUALITY_GATES}}
- {{name}}: {{#if passed}}✅ Passed{{else}}❌ Not passed{{/if}}
{{/each}}

## Instructions
1. Review your progress so far
2. Continue working on the task
3. Run quality checks before marking complete
4. Call `complete_task` when ALL gates pass

## Your Project Knowledge
{{PROJECT_KNOWLEDGE}}

## Your Learnings So Far
{{LEARNINGS}}
```

#### 2.4 Integration with PTY Session

```typescript
// Hook into PtySession onExit
async function setupContinuationHooks(session: PtySession, config: ContinuationConfig) {
  // When PTY process exits
  session.onExit((exitCode) => {
    continuationService.handleAgentExit(session.name, exitCode);
  });

  // When activity monitor detects idle
  activityMonitor.on('agent_idle', (sessionName) => {
    if (sessionName === session.name) {
      continuationService.handleAgentIdle(sessionName);
    }
  });
}
```

**Deliverables:**
- `ContinuationService` with state analysis
- Terminal output analyzer for completion detection
- Continuation prompt templates
- Integration with PTY `onExit()` and `ActivityMonitorService`
- Iteration tracking in ticket YAML

---

### Phase 3: Quality Gates (Week 5-6)

**Goal:** Ensure tasks are verified before completion

#### 3.1 Quality Gate Service

```typescript
// backend/src/services/quality/quality-gate.service.ts

interface QualityGate {
  name: string;
  command: string;
  required: boolean;
  timeout: number;
}

const DEFAULT_GATES: QualityGate[] = [
  { name: 'typecheck', command: 'npm run typecheck', required: true, timeout: 60000 },
  { name: 'lint', command: 'npm run lint', required: false, timeout: 30000 },
  { name: 'tests', command: 'npm test', required: true, timeout: 120000 },
  { name: 'build', command: 'npm run build', required: true, timeout: 120000 },
];

interface QualityGateService {
  // Run all gates for a task
  runGates(projectPath: string, task: EnhancedTicket): Promise<GateResults>;

  // Run specific gate
  runGate(projectPath: string, gate: QualityGate): Promise<GateResult>;

  // Get gate configuration for project
  getGateConfig(projectPath: string): Promise<QualityGate[]>;
}
```

#### 3.2 Enhanced Complete Task Flow

```typescript
// Modify existing complete_task MCP tool
async function completeTask(params: CompleteTaskParams): Promise<MCPToolResult> {
  const task = await loadTask(params.taskPath);

  // NEW: Run quality gates
  const gateResults = await qualityGateService.runGates(
    params.projectPath,
    task
  );

  if (!gateResults.allRequiredPassed) {
    // Update task with gate results
    task.qualityGates = gateResults.results;
    task.iterations++;
    await saveTask(task);

    return {
      success: false,
      message: `Quality gates failed. Fix issues and try again.`,
      failedGates: gateResults.failed,
      iterations: task.iterations,
    };
  }

  // All gates passed - complete the task
  await moveTaskToDone(task);
  await recordLearning(params.sessionName, task);

  return {
    success: true,
    message: 'Task completed successfully!',
    gateResults: gateResults.results,
  };
}
```

#### 3.3 Project Gate Configuration

```yaml
# project/.crewly/config/quality-gates.yaml

gates:
  - name: typecheck
    command: npm run typecheck
    required: true
    timeout: 60000

  - name: tests
    command: npm test -- --passWithNoTests
    required: true
    timeout: 120000

  - name: lint
    command: npm run lint
    required: false
    timeout: 30000

  - name: build
    command: npm run build
    required: true
    timeout: 180000

# Custom project-specific gates
custom:
  - name: e2e
    command: npm run test:e2e
    required: false
    timeout: 300000
```

**Deliverables:**
- `QualityGateService` with configurable gates
- Enhanced `complete_task` MCP tool with gate validation
- Project-level gate configuration
- Gate results tracking in ticket YAML

---

### Phase 4: SOP System (Week 7-8)

**Goal:** Standardize agent behavior with role-specific procedures

#### 4.1 SOP Storage & Loading

```typescript
// backend/src/services/sop/sop.service.ts

interface SOP {
  id: string;
  role: string;
  category: 'workflow' | 'quality' | 'communication' | 'escalation';
  title: string;
  content: string;  // Markdown
  triggers: string[];  // Keywords that trigger this SOP
  priority: number;
}

interface SOPService {
  // Get SOPs for a role
  getRoleSOPs(role: string): Promise<SOP[]>;

  // Find relevant SOPs for a task
  findRelevantSOPs(role: string, taskContext: string): Promise<SOP[]>;

  // Generate SOP section for prompt
  generateSOPPromptSection(role: string, taskContext: string): Promise<string>;

  // Agent creates custom SOP
  createAgentSOP(agentId: string, sop: Omit<SOP, 'id'>): Promise<SOP>;
}
```

#### 4.2 Default SOPs

```
~/.crewly/sops/
├── developer/
│   ├── coding-standards.md
│   ├── testing-requirements.md
│   ├── git-workflow.md
│   └── code-review-checklist.md
├── pm/
│   ├── task-decomposition.md
│   ├── priority-assessment.md
│   ├── progress-tracking.md
│   └── escalation-criteria.md
├── qa/
│   ├── testing-procedures.md
│   ├── bug-reporting.md
│   └── acceptance-criteria.md
└── common/
    ├── communication-protocol.md
    ├── blocker-handling.md
    └── handoff-procedures.md
```

**Example SOP:**

```markdown
<!-- ~/.crewly/sops/developer/git-workflow.md -->
---
id: dev-git-workflow
role: developer
category: workflow
title: Git Workflow
triggers: ['commit', 'push', 'branch', 'merge']
priority: 10
---

# Git Workflow SOP

## Before Starting Work
1. Pull latest from main branch
2. Create feature branch: `feat/{ticket-id}-{short-description}`

## During Work
1. Commit frequently (at least every 30 minutes)
2. Use conventional commits: `feat:`, `fix:`, `refactor:`, etc.
3. Include ticket ID in commit message

## Before Marking Complete
1. Ensure all tests pass
2. Run linter and fix issues
3. Squash commits if needed
4. Create PR with description

## Commit Message Format
```
{type}({scope}): {description}

- {detail 1}
- {detail 2}

Refs: #{ticket-id}
```
```

**Deliverables:**
- `SOPService` with role-based SOP management
- Default SOP library for PM, Dev, QA roles
- Agent-created custom SOPs
- SOP injection into prompts

---

### Phase 5: Autonomous Operations (Week 9-10)

**Goal:** Enable 24/7 autonomous operation with safety controls

#### 5.1 Task Queue & Auto-Assignment

```typescript
// backend/src/services/autonomous/auto-assign.service.ts

interface AutoAssignService {
  // Check for idle agents and unassigned tasks
  runAssignmentCycle(): Promise<AssignmentResult[]>;

  // Get next task for an agent based on role and priority
  getNextTaskForAgent(agentId: string, role: string): Promise<Task | null>;

  // Auto-start when agent completes a task
  handleTaskCompleted(agentId: string, completedTask: Task): Promise<void>;
}
```

#### 5.2 Budget & Safety Controls

```typescript
// backend/src/services/autonomous/budget.service.ts

interface BudgetService {
  // Track token usage
  recordUsage(agentId: string, tokens: number): Promise<void>;

  // Check if within budget
  checkBudget(agentId: string): Promise<BudgetStatus>;

  // Pause agent if over budget
  enforceBudgetLimits(): Promise<void>;
}

interface SafetyConfig {
  maxIterationsPerTask: number;      // Default: 10
  maxTokensPerDay: number;           // Default: 1M
  maxCostPerDay: number;             // Default: $50
  requireApprovalForDestructive: boolean;
  notifyOnHighCost: number;          // Notify at $20
}
```

#### 5.3 Improved Scheduled Check-ins

Review and improve existing `SchedulerService` for PTY:

```typescript
// Enhancements to existing SchedulerService

interface EnhancedSchedulerService extends SchedulerService {
  // Adaptive check-in based on agent activity
  scheduleAdaptiveCheckin(sessionName: string): void;

  // Progress check with continuation trigger
  scheduleProgressCheck(sessionName: string, callback: () => void): void;

  // Commit reminder (existing, verify PTY compatibility)
  scheduleCommitReminder(sessionName: string): void;
}
```

**Deliverables:**
- `AutoAssignService` for task queue management
- `BudgetService` for cost tracking
- Safety controls and limits
- Enhanced `SchedulerService` for PTY compatibility

---

## Part 4: MCP Tool Summary

### New MCP Tools

| Tool | Purpose | Parameters |
|------|---------|------------|
| `remember` | Store agent/project memory | `content`, `category`, `scope` |
| `recall` | Retrieve relevant memories | `context`, `scope` |
| `record_learning` | Log a learning | `learning`, `relatedTask` |
| `get_my_context` | Get full context (memory + project) | none |
| `check_quality_gates` | Run quality gates | `taskPath` |
| `get_sops` | Get relevant SOPs | `context` |
| `request_continuation` | Request more iterations | `reason` |
| `report_idle` | Signal waiting for work | `reason` |

### Enhanced Existing Tools

| Tool | Enhancement |
|------|-------------|
| `complete_task` | Run quality gates before completion |
| `accept_task` | Initialize iteration counter |
| `update_ticket` | Track iteration count |
| `report_progress` | Auto-record to learnings |

---

## Part 5: Priority & Timeline

### P0: Critical (Weeks 1-4)
1. **Structured Memory System** - Replace logs with queryable memory
2. **Continuation Service** - Auto-continue on agent idle/stop

### P1: High Priority (Weeks 5-8)
3. **Quality Gates** - Verify before task completion
4. **SOP System** - Standardize agent behavior

### P2: Nice to Have (Weeks 9+)
5. **Auto-Assignment** - Task queue management
6. **Budget Controls** - Cost tracking and limits
7. **External Channels** - Telegram/Slack integration
8. **Self-Writing Tools** - Agents create their own tools

---

## Part 6: Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Tasks completed without intervention** | >70% | Auto-completed / Total |
| **Quality gate pass rate** | >85% | Gates passed / Total runs |
| **Average iterations per task** | <5 | Total iterations / Tasks |
| **Memory recall accuracy** | >80% | Relevant / Retrieved |
| **Continuation success rate** | >90% | Successful continues / Attempts |

---

## Part 7: Key Differences from Original Plan

| Original | Revised |
|----------|---------|
| Stop hook integration | Use Crewly's PTY control |
| Ralph PRD system | Enhance existing ticket system |
| Multi-channel P0 | Multi-channel P2 |
| Generic memory | Agent + Project scoped memory |
| Self-writing extensions P0 | Self-writing extensions P2 |
| External daemon mode | Crewly already is daemon-like |

---

## Appendix: File Structure Summary

```
CHANGES TO EXISTING FILES:
├── backend/src/services/ai/prompt-builder.service.ts
│   └── Add memory/SOP injection
├── backend/src/services/monitoring/activity-monitor.service.ts
│   └── Add continuation triggers
├── mcp-server/src/server.ts
│   └── Add new tools, enhance complete_task

NEW FILES:
├── backend/src/services/memory/
│   ├── memory.service.ts
│   └── memory.types.ts
├── backend/src/services/continuation/
│   ├── continuation.service.ts
│   ├── output-analyzer.ts
│   └── continuation.types.ts
├── backend/src/services/quality/
│   ├── quality-gate.service.ts
│   └── quality-gate.types.ts
├── backend/src/services/sop/
│   ├── sop.service.ts
│   └── sop.types.ts
├── config/continuation/
│   └── continue-work.md
├── config/quality-gates/
│   └── default-gates.yaml
└── ~/.crewly/sops/
    ├── developer/
    ├── pm/
    └── qa/
```

---

## References

**Moltbot Concepts Adopted:**
- Persistent memory across sessions
- Project-scoped knowledge base
- Proactive behavior (enhanced check-ins)

**Ralph Loop Concepts Adopted:**
- Iteration tracking per task
- Quality gates before completion
- Learnings accumulation
- Fresh context per iteration (Crewly already does this)

**Crewly Native Approaches:**
- PTY `onExit()` for completion detection (not stop hooks)
- Activity monitoring for idle detection
- Existing ticket system enhanced (not Ralph PRD)
- Web dashboard access from phone (not Telegram/Slack initially)
