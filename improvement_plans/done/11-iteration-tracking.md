---
id: 11-iteration-tracking
title: Add Iteration Tracking to Ticket System
phase: 2
priority: P0
status: open
estimatedHours: 6
dependencies: [09-continuation-service]
blocks: [12-quality-gate-design]
---

# Task: Add Iteration Tracking to Ticket System

## Objective
Enhance the existing ticket/task system to track iteration counts and quality gate status.

## Background
The continuation system needs to track:
- How many times an agent has attempted a task
- Maximum allowed iterations
- Quality gate pass/fail status
- Iteration history for debugging

## Deliverables

### 1. Enhanced Ticket Schema

Update the ticket YAML format:

```yaml
# project/.agentmux/tasks/milestone/in_progress/task.md
---
id: implement-feature-x
title: Implement Feature X
description: |
  Detailed description here...
status: in_progress
assignedTo: backend-dev
priority: high
createdAt: 2026-01-29T10:00:00Z
updatedAt: 2026-01-29T14:30:00Z

# NEW: Continuation tracking
continuation:
  iterations: 3
  maxIterations: 10
  lastIteration: 2026-01-29T14:30:00Z
  iterationHistory:
    - timestamp: 2026-01-29T10:15:00Z
      trigger: pty_exit
      action: inject_prompt
      conclusion: INCOMPLETE
    - timestamp: 2026-01-29T12:00:00Z
      trigger: activity_idle
      action: inject_prompt
      conclusion: STUCK_OR_ERROR
    - timestamp: 2026-01-29T14:30:00Z
      trigger: activity_idle
      action: retry_with_hints
      conclusion: STUCK_OR_ERROR

# NEW: Quality gates
qualityGates:
  typecheck:
    passed: true
    lastRun: 2026-01-29T14:25:00Z
  tests:
    passed: false
    lastRun: 2026-01-29T14:26:00Z
    output: "2 tests failed"
  lint:
    passed: true
    lastRun: 2026-01-29T14:25:00Z
  build:
    passed: false
    lastRun: 2026-01-29T14:27:00Z
    output: "Type error in component.tsx"

# Existing fields...
subtasks: []
labels: []
---

# Task Content

Markdown content here...
```

### 2. Type Definitions

```typescript
// backend/src/types/ticket.types.ts (additions)

interface ContinuationTracking {
  iterations: number;
  maxIterations: number;
  lastIteration?: string;
  iterationHistory: IterationRecord[];
}

interface IterationRecord {
  timestamp: string;
  trigger: ContinuationTrigger;
  action: ContinuationAction;
  conclusion: AgentConclusion;
  notes?: string;
}

interface QualityGateStatus {
  passed: boolean;
  lastRun?: string;
  output?: string;
}

interface QualityGates {
  typecheck?: QualityGateStatus;
  tests?: QualityGateStatus;
  lint?: QualityGateStatus;
  build?: QualityGateStatus;
  [customGate: string]: QualityGateStatus | undefined;
}

// Updated Ticket interface
interface EnhancedTicket extends Ticket {
  continuation?: ContinuationTracking;
  qualityGates?: QualityGates;
}
```

### 3. TicketEditorService Enhancements

```typescript
// backend/src/services/project/ticket-editor.service.ts (additions)

class TicketEditorService {
  // Existing methods...

  // NEW: Iteration management
  async incrementIteration(ticketPath: string, record: Omit<IterationRecord, 'timestamp'>): Promise<number> {
    const ticket = await this.loadTicket(ticketPath);

    // Initialize if needed
    if (!ticket.continuation) {
      ticket.continuation = {
        iterations: 0,
        maxIterations: CONTINUATION_CONSTANTS.DEFAULT_MAX_ITERATIONS,
        iterationHistory: [],
      };
    }

    // Increment and record
    ticket.continuation.iterations++;
    ticket.continuation.lastIteration = new Date().toISOString();
    ticket.continuation.iterationHistory.push({
      ...record,
      timestamp: new Date().toISOString(),
    });

    // Trim history if too long (keep last 20)
    if (ticket.continuation.iterationHistory.length > 20) {
      ticket.continuation.iterationHistory = ticket.continuation.iterationHistory.slice(-20);
    }

    await this.saveTicket(ticketPath, ticket);
    return ticket.continuation.iterations;
  }

  async setMaxIterations(ticketPath: string, max: number): Promise<void> {
    const ticket = await this.loadTicket(ticketPath);

    if (!ticket.continuation) {
      ticket.continuation = {
        iterations: 0,
        maxIterations: max,
        iterationHistory: [],
      };
    } else {
      ticket.continuation.maxIterations = max;
    }

    await this.saveTicket(ticketPath, ticket);
  }

  async getIterationCount(ticketPath: string): Promise<{ current: number; max: number }> {
    const ticket = await this.loadTicket(ticketPath);

    return {
      current: ticket.continuation?.iterations || 0,
      max: ticket.continuation?.maxIterations || CONTINUATION_CONSTANTS.DEFAULT_MAX_ITERATIONS,
    };
  }

  // NEW: Quality gate management
  async updateQualityGate(
    ticketPath: string,
    gateName: string,
    status: QualityGateStatus
  ): Promise<void> {
    const ticket = await this.loadTicket(ticketPath);

    if (!ticket.qualityGates) {
      ticket.qualityGates = {};
    }

    ticket.qualityGates[gateName] = {
      ...status,
      lastRun: new Date().toISOString(),
    };

    await this.saveTicket(ticketPath, ticket);
  }

  async getQualityGates(ticketPath: string): Promise<QualityGates> {
    const ticket = await this.loadTicket(ticketPath);
    return ticket.qualityGates || {};
  }

  async areAllGatesPassing(ticketPath: string): Promise<boolean> {
    const gates = await this.getQualityGates(ticketPath);
    const requiredGates = ['typecheck', 'tests', 'build'];

    return requiredGates.every(gate => gates[gate]?.passed === true);
  }

  async resetIterations(ticketPath: string): Promise<void> {
    const ticket = await this.loadTicket(ticketPath);

    if (ticket.continuation) {
      ticket.continuation.iterations = 0;
      ticket.continuation.iterationHistory = [];
    }

    if (ticket.qualityGates) {
      for (const gate of Object.keys(ticket.qualityGates)) {
        ticket.qualityGates[gate] = { passed: false };
      }
    }

    await this.saveTicket(ticketPath, ticket);
  }
}
```

### 4. Integration with TaskTrackingService

```typescript
// backend/src/services/project/task-tracking.service.ts (additions)

class TaskTrackingService {
  private ticketEditor: TicketEditorService;

  // When task is assigned, initialize continuation tracking
  async assignTask(taskPath: string, sessionName: string): Promise<void> {
    // Existing assignment logic...

    // Initialize continuation tracking
    const ticket = await this.ticketEditor.loadTicket(taskPath);
    if (!ticket.continuation) {
      await this.ticketEditor.incrementIteration(taskPath, {
        trigger: 'explicit_request',
        action: 'no_action',
        conclusion: 'INCOMPLETE',
        notes: 'Task assigned',
      });
    }
  }

  // When task is completed, verify gates passed
  async completeTask(taskPath: string, sessionName: string): Promise<CompleteResult> {
    const gatesPassing = await this.ticketEditor.areAllGatesPassing(taskPath);

    if (!gatesPassing) {
      return {
        success: false,
        reason: 'Quality gates not passing',
        gates: await this.ticketEditor.getQualityGates(taskPath),
      };
    }

    // Proceed with completion...
    return { success: true };
  }
}
```

### 5. API Endpoints

```typescript
// backend/src/controllers/task-management/tickets.controller.ts (additions)

// GET /api/tickets/:ticketId/iterations
async getIterations(req: Request, res: Response) {
  const { ticketId } = req.params;
  const ticketPath = await this.resolveTicketPath(ticketId);
  const iterations = await this.ticketEditor.getIterationCount(ticketPath);
  res.json(iterations);
}

// POST /api/tickets/:ticketId/iterations/increment
async incrementIteration(req: Request, res: Response) {
  const { ticketId } = req.params;
  const record = req.body;
  const ticketPath = await this.resolveTicketPath(ticketId);
  const newCount = await this.ticketEditor.incrementIteration(ticketPath, record);
  res.json({ iterations: newCount });
}

// GET /api/tickets/:ticketId/quality-gates
async getQualityGates(req: Request, res: Response) {
  const { ticketId } = req.params;
  const ticketPath = await this.resolveTicketPath(ticketId);
  const gates = await this.ticketEditor.getQualityGates(ticketPath);
  res.json(gates);
}

// PATCH /api/tickets/:ticketId/quality-gates/:gateName
async updateQualityGate(req: Request, res: Response) {
  const { ticketId, gateName } = req.params;
  const status = req.body;
  const ticketPath = await this.resolveTicketPath(ticketId);
  await this.ticketEditor.updateQualityGate(ticketPath, gateName, status);
  res.json({ success: true });
}
```

## Implementation Steps

1. **Update type definitions**
   - Add ContinuationTracking
   - Add QualityGates
   - Update EnhancedTicket

2. **Update TicketEditorService**
   - Iteration management methods
   - Quality gate methods
   - YAML parsing updates

3. **Update TaskTrackingService**
   - Initialize on assignment
   - Check gates on completion

4. **Add API endpoints**
   - Iteration endpoints
   - Quality gate endpoints

5. **Update existing MCP tools**
   - `complete_task` checks gates
   - `accept_task` initializes tracking

6. **Write tests**
   - Iteration tracking tests
   - Quality gate tests
   - API endpoint tests

## Acceptance Criteria

- [ ] Ticket schema extended with continuation tracking
- [ ] Iteration increment/get methods work
- [ ] Quality gate update/get methods work
- [ ] `complete_task` enforces gates
- [ ] API endpoints functional
- [ ] Iteration history capped at 20 entries
- [ ] Tests passing

## Notes

- Maintain backward compatibility with existing tickets
- Initialize tracking on first access if missing
- Keep iteration history for debugging
- Quality gate output truncated if too long
