---
id: 19-auto-assign-design
title: Design Auto-Assignment System
phase: 5
priority: P2
status: open
estimatedHours: 6
dependencies: [09-continuation-service, 11-iteration-tracking]
blocks: [20-auto-assign-service]
---

# Task: Design Auto-Assignment System

## Objective
Design the system for automatically assigning tasks to idle agents.

## Background
When agents complete tasks or become idle, they should automatically receive the next appropriate task. This enables truly autonomous operation.

## Deliverables

### 1. Auto-Assignment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  AUTO-ASSIGNMENT FLOW                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Agent completes task / becomes idle                        │
│                           │                                 │
│                           ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         AutoAssignService.findNextTask()             │   │
│  │                                                      │   │
│  │  1. Get agent's role                                 │   │
│  │  2. Get open tasks matching role                     │   │
│  │  3. Sort by priority                                 │   │
│  │  4. Check dependencies                               │   │
│  │  5. Return highest priority unblocked task           │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                 │
│              ┌────────────┴────────────┐                    │
│              ▼                         ▼                    │
│       Task Available            No Task Available           │
│              │                         │                    │
│              ▼                         ▼                    │
│  ┌─────────────────────┐   ┌─────────────────────────────┐  │
│  │ Assign task         │   │ Agent enters idle state     │  │
│  │ Inject prompt       │   │ Notify owner (optional)     │  │
│  │ Update tracking     │   │ Wait for new tasks          │  │
│  └─────────────────────┘   └─────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Assignment Strategy

```typescript
// backend/src/types/auto-assign.types.ts

interface AssignmentStrategy {
  // How tasks are prioritized
  prioritization: 'fifo' | 'priority' | 'deadline' | 'custom';

  // Role matching rules
  roleMatching: RoleMatchRule[];

  // Load balancing
  loadBalancing: {
    enabled: boolean;
    maxConcurrentTasks: number;
    preferIdleAgents: boolean;
  };

  // Dependency handling
  dependencies: {
    respectBlocking: boolean;
    waitForDependencies: boolean;
  };
}

interface RoleMatchRule {
  role: string;
  taskTypes: string[];       // Task types this role can handle
  priority: number;          // Preference order
  exclusive?: boolean;       // Only this role can do these tasks
}

interface TaskAssignmentResult {
  taskId: string;
  taskPath: string;
  agentId: string;
  assignedAt: string;
  estimatedCompletion?: string;
}
```

### 3. Task Queue Model

```typescript
interface TaskQueue {
  projectPath: string;

  // All open tasks, sorted
  tasks: QueuedTask[];

  // Assignment history
  assignments: TaskAssignment[];

  // Config
  config: AssignmentStrategy;
}

interface QueuedTask {
  taskId: string;
  taskPath: string;
  title: string;
  priority: number;
  taskType?: string;
  requiredRole?: string;
  dependencies: string[];     // Task IDs that must complete first
  blockedBy: string[];        // Currently blocking tasks
  createdAt: string;
  estimatedHours?: number;
}

interface TaskAssignment {
  taskId: string;
  agentId: string;
  sessionName: string;
  assignedAt: string;
  status: 'active' | 'completed' | 'failed' | 'reassigned';
  completedAt?: string;
  iterations?: number;
}
```

### 4. Assignment Events

```typescript
// Events emitted by AutoAssignService

interface AssignmentEvent {
  type: 'task_assigned' | 'task_completed' | 'task_failed' | 'agent_idle' | 'no_tasks';
  agentId: string;
  sessionName: string;
  taskId?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}
```

### 5. Default Assignment Strategy

```typescript
const DEFAULT_ASSIGNMENT_STRATEGY: AssignmentStrategy = {
  prioritization: 'priority',

  roleMatching: [
    {
      role: 'developer',
      taskTypes: ['feature', 'fix', 'refactor', 'test'],
      priority: 1,
    },
    {
      role: 'frontend-developer',
      taskTypes: ['feature', 'fix', 'ui', 'component'],
      priority: 1,
    },
    {
      role: 'backend-developer',
      taskTypes: ['feature', 'fix', 'api', 'service'],
      priority: 1,
    },
    {
      role: 'qa',
      taskTypes: ['test', 'review', 'verify'],
      priority: 1,
      exclusive: true,
    },
    {
      role: 'pm',
      taskTypes: ['planning', 'review', 'coordination'],
      priority: 1,
    },
  ],

  loadBalancing: {
    enabled: true,
    maxConcurrentTasks: 1,      // One task per agent at a time
    preferIdleAgents: true,
  },

  dependencies: {
    respectBlocking: true,
    waitForDependencies: true,
  },
};
```

### 6. Configuration

```yaml
# project/.crewly/config/auto-assign.yaml

enabled: true

strategy:
  prioritization: priority

  roleMatching:
    - role: developer
      taskTypes: [feature, fix]
      priority: 1

  loadBalancing:
    enabled: true
    maxConcurrentTasks: 1
    preferIdleAgents: true

  dependencies:
    respectBlocking: true
    waitForDependencies: true

notifications:
  notifyOnIdle: true
  idleThresholdMinutes: 5
  notifyOnNoTasks: true

limits:
  maxAssignmentsPerDay: 50
  cooldownBetweenTasks: 60  # seconds
```

### 7. Integration Points

#### With ContinuationService

```typescript
// When task completes, trigger auto-assignment
continuationService.on('task_completed', async (sessionName, taskId) => {
  const config = await autoAssignService.getConfig(projectPath);
  if (config.enabled) {
    await autoAssignService.assignNextTask(sessionName);
  }
});
```

#### With ActivityMonitorService

```typescript
// When agent goes idle, check for tasks
activityMonitor.on('agent_idle', async (sessionName) => {
  const hasActiveTask = await taskTrackingService.hasActiveTask(sessionName);
  if (!hasActiveTask) {
    await autoAssignService.assignNextTask(sessionName);
  }
});
```

## Implementation Steps

1. **Define type interfaces**
   - AssignmentStrategy
   - TaskQueue, QueuedTask
   - Events

2. **Design priority algorithm**
   - FIFO, priority, deadline
   - Role matching

3. **Design dependency handling**
   - Check blocking tasks
   - Wait or skip

4. **Define configuration format**
   - Project-level config
   - Defaults

5. **Plan integration points**
   - ContinuationService
   - ActivityMonitorService
   - TaskTrackingService

## Acceptance Criteria

- [ ] Type definitions complete
- [ ] Assignment strategy documented
- [ ] Configuration format defined
- [ ] Integration points identified
- [ ] Default strategy defined

## Notes

- Balance automation with control
- Allow manual override
- Log all assignments
- Consider fairness in distribution
