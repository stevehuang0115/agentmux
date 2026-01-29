---
id: 07-continuation-detection
title: Design Continuation Detection System
phase: 2
priority: P0
status: open
estimatedHours: 8
dependencies: [05-memory-prompt-integration, 06-memory-mcp-tools]
blocks: [08-output-analyzer, 09-continuation-service]
---

# Task: Design Continuation Detection System

## Objective
Design the system architecture for detecting when agents stop/idle and determining whether to continue their work automatically.

## Background
AgentMux controls agent sessions via PTY. We have:
- `PtySession.onExit()` - fires when process terminates
- `ActivityMonitorService` - polls every 2 minutes for output changes
- `AgentHeartbeatService` - tracks MCP tool calls (30-min stale threshold)

We need to tie these together into a coherent continuation system.

## Deliverables

### 1. Detection Event Types

```typescript
// backend/src/types/continuation.types.ts

type ContinuationTrigger =
  | 'pty_exit'           // PTY process exited
  | 'activity_idle'      // No output change for 2 polling cycles
  | 'heartbeat_stale'    // No MCP calls for 30+ minutes
  | 'explicit_request';  // Agent requested continuation

interface ContinuationEvent {
  trigger: ContinuationTrigger;
  sessionName: string;
  agentId: string;
  projectPath: string;
  timestamp: string;
  metadata: {
    exitCode?: number;        // For pty_exit
    lastOutput?: string;      // Last captured output
    lastHeartbeat?: string;   // Last MCP call timestamp
    idleDuration?: number;    // Minutes idle
  };
}
```

### 2. State Analysis Results

```typescript
type AgentConclusion =
  | 'TASK_COMPLETE'      // Agent finished the task successfully
  | 'WAITING_INPUT'      // Agent is waiting for user/other agent
  | 'STUCK_OR_ERROR'     // Agent hit an error or is stuck
  | 'INCOMPLETE'         // Task not done, can continue
  | 'MAX_ITERATIONS'     // Hit iteration limit
  | 'UNKNOWN';           // Can't determine state

interface AgentStateAnalysis {
  conclusion: AgentConclusion;
  confidence: number;        // 0-1 confidence in conclusion
  evidence: string[];        // Why we concluded this
  recommendation: ContinuationAction;
  currentTask?: TaskInfo;
  iterations: number;
  maxIterations: number;
}

type ContinuationAction =
  | 'inject_prompt'       // Send continuation prompt
  | 'assign_next_task'    // Complete current, assign next
  | 'notify_owner'        // Alert human for intervention
  | 'retry_with_hints'    // Retry with error hints
  | 'pause_agent'         // Stop the agent
  | 'no_action';          // Do nothing
```

### 3. Detection Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DETECTION SOURCES                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PtySession.onExit()     ActivityMonitor      Heartbeat     │
│         │                     │                   │         │
│         ▼                     ▼                   ▼         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              ContinuationEventEmitter                │   │
│  │                                                      │   │
│  │  • Normalizes events from all sources                │   │
│  │  • Deduplicates rapid-fire events                    │   │
│  │  • Emits ContinuationEvent                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              OutputAnalyzer (Task 08)                │   │
│  │                                                      │   │
│  │  • Analyzes terminal output                          │   │
│  │  • Detects completion signals                        │   │
│  │  • Detects error patterns                            │   │
│  │  • Returns AgentStateAnalysis                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            ContinuationService (Task 09)             │   │
│  │                                                      │   │
│  │  • Decides action based on analysis                  │   │
│  │  • Enforces iteration limits                         │   │
│  │  • Executes continuation action                      │   │
│  │  • Updates task iteration count                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4. Event Emitter Design

```typescript
// backend/src/services/continuation/continuation-events.service.ts

interface IContinuationEventEmitter {
  // Register event sources
  registerPtySession(session: PtySession, agentId: string, projectPath: string): void;
  registerActivityMonitor(monitor: ActivityMonitorService): void;
  registerHeartbeatService(heartbeat: AgentHeartbeatService): void;

  // Event subscription
  on(event: 'continuation', handler: (event: ContinuationEvent) => void): void;

  // Manual trigger (for testing or explicit requests)
  trigger(event: ContinuationEvent): void;
}

class ContinuationEventEmitter extends EventEmitter implements IContinuationEventEmitter {
  private pendingEvents: Map<string, NodeJS.Timeout> = new Map();
  private readonly DEBOUNCE_MS = 5000;  // 5 second debounce

  registerPtySession(session: PtySession, agentId: string, projectPath: string): void {
    session.onExit((exitCode) => {
      this.emitDebounced({
        trigger: 'pty_exit',
        sessionName: session.name,
        agentId,
        projectPath,
        timestamp: new Date().toISOString(),
        metadata: { exitCode },
      });
    });
  }

  private emitDebounced(event: ContinuationEvent): void {
    const key = `${event.sessionName}-${event.trigger}`;

    // Clear existing debounce timer
    if (this.pendingEvents.has(key)) {
      clearTimeout(this.pendingEvents.get(key)!);
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.pendingEvents.delete(key);
      this.emit('continuation', event);
    }, this.DEBOUNCE_MS);

    this.pendingEvents.set(key, timer);
  }
}
```

### 5. Integration Points

#### With PtySession

```typescript
// In PtySessionBackend or RuntimeServiceFactory

async createSession(config: SessionConfig): Promise<PtySession> {
  const session = await this.ptyBackend.createSession(config.name, options);

  // Register for continuation events
  continuationEventEmitter.registerPtySession(
    session,
    config.agentId,
    config.projectPath
  );

  return session;
}
```

#### With ActivityMonitorService

```typescript
// In ActivityMonitorService

class ActivityMonitorService {
  private continuationEmitter: ContinuationEventEmitter;

  async checkActivity(sessionName: string): Promise<void> {
    const currentOutput = await this.captureOutput(sessionName);
    const lastOutput = this.lastTerminalOutputs.get(sessionName);

    if (currentOutput === lastOutput) {
      // Session is idle - emit continuation event
      this.continuationEmitter.trigger({
        trigger: 'activity_idle',
        sessionName,
        agentId: await this.getAgentId(sessionName),
        projectPath: await this.getProjectPath(sessionName),
        timestamp: new Date().toISOString(),
        metadata: {
          lastOutput: currentOutput,
          idleDuration: this.getIdleDuration(sessionName),
        },
      });
    }

    this.lastTerminalOutputs.set(sessionName, currentOutput);
  }
}
```

### 6. Configuration

```typescript
// In config/constants.ts

export const CONTINUATION_CONSTANTS = {
  // Detection thresholds
  IDLE_CYCLES_BEFORE_CHECK: 2,      // 2 poll cycles = 4 minutes
  STALE_THRESHOLD_MINUTES: 30,

  // Debounce
  EVENT_DEBOUNCE_MS: 5000,

  // Limits
  DEFAULT_MAX_ITERATIONS: 10,
  ABSOLUTE_MAX_ITERATIONS: 50,

  // Timeouts
  ANALYSIS_TIMEOUT_MS: 10000,
  ACTION_TIMEOUT_MS: 30000,
};
```

## Implementation Steps

1. **Define type interfaces**
   - Create `continuation.types.ts`
   - Export all types

2. **Design event flow**
   - Document detection → analysis → action flow
   - Define integration points

3. **Create ContinuationEventEmitter**
   - Event normalization
   - Debouncing logic
   - Registration methods

4. **Define integration hooks**
   - Where to register PTY sessions
   - How to hook ActivityMonitor
   - How to hook HeartbeatService

5. **Add constants**
   - Thresholds and limits
   - Timeouts

6. **Document architecture**
   - Flow diagrams
   - Integration points
   - Configuration options

## Acceptance Criteria

- [ ] All TypeScript types defined
- [ ] Event emitter architecture documented
- [ ] Integration points identified
- [ ] Constants defined
- [ ] Architecture diagram complete
- [ ] Design reviewed and approved

## Notes

- Debouncing prevents rapid-fire events from overwhelming the system
- Events should capture enough context for analysis
- Consider adding event persistence for debugging
- Plan for graceful degradation if services unavailable
