---
id: 20-auto-assign-service
title: Implement AutoAssignService
phase: 5
priority: P2
status: open
estimatedHours: 10
dependencies: [19-auto-assign-design]
blocks: []
---

# Task: Implement AutoAssignService

## Objective
Create the service that automatically assigns tasks to idle agents.

## Deliverables

### 1. AutoAssignService Interface

```typescript
// backend/src/services/autonomous/auto-assign.service.ts

interface IAutoAssignService {
  // Configuration
  initialize(projectPath: string): Promise<void>;
  getConfig(projectPath: string): Promise<AssignmentStrategy>;
  setConfig(projectPath: string, config: Partial<AssignmentStrategy>): Promise<void>;

  // Assignment
  assignNextTask(sessionName: string): Promise<TaskAssignmentResult | null>;
  findNextTask(role: string, projectPath: string): Promise<QueuedTask | null>;
  assignTask(taskPath: string, sessionName: string): Promise<TaskAssignmentResult>;

  // Queue management
  getTaskQueue(projectPath: string): Promise<TaskQueue>;
  refreshQueue(projectPath: string): Promise<void>;
  getAgentWorkload(sessionName: string): Promise<AgentWorkload>;

  // Events
  onTaskAssigned(handler: (event: AssignmentEvent) => void): void;
  onAgentIdle(handler: (event: AssignmentEvent) => void): void;

  // Manual control
  pauseAutoAssign(projectPath: string): Promise<void>;
  resumeAutoAssign(projectPath: string): Promise<void>;
  isAutoAssignEnabled(projectPath: string): Promise<boolean>;
}

interface AgentWorkload {
  sessionName: string;
  agentId: string;
  role: string;
  currentTasks: string[];
  completedToday: number;
  averageIterations: number;
}
```

### 2. Implementation

```typescript
class AutoAssignService extends EventEmitter implements IAutoAssignService {
  private static instance: AutoAssignService;
  private taskService: TaskService;
  private taskTrackingService: TaskTrackingService;
  private continuationService: ContinuationService;
  private logger: Logger;

  private configs: Map<string, AssignmentStrategy> = new Map();
  private queues: Map<string, TaskQueue> = new Map();
  private paused: Set<string> = new Set();

  static getInstance(): AutoAssignService {
    if (!AutoAssignService.instance) {
      AutoAssignService.instance = new AutoAssignService();
    }
    return AutoAssignService.instance;
  }

  async initialize(projectPath: string): Promise<void> {
    // Load or create config
    const config = await this.loadConfig(projectPath);
    this.configs.set(projectPath, config);

    // Build initial queue
    await this.refreshQueue(projectPath);

    // Subscribe to events
    this.subscribeToEvents(projectPath);

    this.logger.info('AutoAssignService initialized', { projectPath });
  }

  async assignNextTask(sessionName: string): Promise<TaskAssignmentResult | null> {
    const projectPath = await this.getProjectPath(sessionName);

    // Check if auto-assign is enabled and not paused
    if (!await this.isAutoAssignEnabled(projectPath)) {
      this.logger.debug('Auto-assign disabled or paused', { projectPath });
      return null;
    }

    // Check agent workload
    const workload = await this.getAgentWorkload(sessionName);
    const config = await this.getConfig(projectPath);

    if (workload.currentTasks.length >= config.loadBalancing.maxConcurrentTasks) {
      this.logger.debug('Agent at max capacity', { sessionName });
      return null;
    }

    // Find next task
    const task = await this.findNextTask(workload.role, projectPath);

    if (!task) {
      this.emitEvent({
        type: 'no_tasks',
        agentId: workload.agentId,
        sessionName,
        timestamp: new Date().toISOString(),
      });
      return null;
    }

    // Assign the task
    return this.assignTask(task.taskPath, sessionName);
  }

  async findNextTask(role: string, projectPath: string): Promise<QueuedTask | null> {
    const queue = await this.getTaskQueue(projectPath);
    const config = await this.getConfig(projectPath);

    // Filter tasks by role
    const eligibleTasks = queue.tasks.filter(task => {
      // Check role match
      if (task.requiredRole && task.requiredRole !== role) {
        if (!this.canRoleHandleTask(role, task, config)) {
          return false;
        }
      }

      // Check dependencies
      if (config.dependencies.respectBlocking && task.blockedBy.length > 0) {
        return false;
      }

      return true;
    });

    if (eligibleTasks.length === 0) {
      return null;
    }

    // Sort by priority
    eligibleTasks.sort((a, b) => {
      if (config.prioritization === 'priority') {
        return b.priority - a.priority;
      } else if (config.prioritization === 'fifo') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return 0;
    });

    return eligibleTasks[0];
  }

  async assignTask(taskPath: string, sessionName: string): Promise<TaskAssignmentResult> {
    const agentId = await this.getAgentId(sessionName);
    const projectPath = await this.getProjectPath(sessionName);

    // Assign in task tracking
    await this.taskTrackingService.assignTask(taskPath, sessionName);

    // Load task for prompt
    const task = await this.taskService.loadTask(taskPath);

    // Build assignment prompt
    const prompt = await this.buildAssignmentPrompt(task, sessionName);

    // Inject prompt
    await this.continuationService.injectPrompt(sessionName, prompt);

    const result: TaskAssignmentResult = {
      taskId: task.id,
      taskPath,
      agentId,
      assignedAt: new Date().toISOString(),
    };

    // Emit event
    this.emitEvent({
      type: 'task_assigned',
      agentId,
      sessionName,
      taskId: task.id,
      timestamp: result.assignedAt,
    });

    // Update queue
    await this.refreshQueue(projectPath);

    this.logger.info('Task auto-assigned', { taskId: task.id, sessionName });

    return result;
  }

  async getTaskQueue(projectPath: string): Promise<TaskQueue> {
    if (!this.queues.has(projectPath)) {
      await this.refreshQueue(projectPath);
    }
    return this.queues.get(projectPath)!;
  }

  async refreshQueue(projectPath: string): Promise<void> {
    // Get all open tasks
    const openTasks = await this.taskService.getTasksByStatus(projectPath, 'open');

    // Get in-progress tasks to check dependencies
    const inProgressTasks = await this.taskService.getTasksByStatus(projectPath, 'in_progress');
    const inProgressIds = new Set(inProgressTasks.map(t => t.id));

    // Build queue
    const queuedTasks: QueuedTask[] = openTasks.map(task => ({
      taskId: task.id,
      taskPath: task.path,
      title: task.title,
      priority: this.getPriorityValue(task.priority),
      taskType: task.type,
      requiredRole: task.requiredRole,
      dependencies: task.dependencies || [],
      blockedBy: (task.dependencies || []).filter(d => inProgressIds.has(d) || openTasks.some(t => t.id === d)),
      createdAt: task.createdAt,
      estimatedHours: task.estimatedHours,
    }));

    // Get assignment history
    const assignments = await this.getAssignmentHistory(projectPath);

    this.queues.set(projectPath, {
      projectPath,
      tasks: queuedTasks,
      assignments,
      config: await this.getConfig(projectPath),
    });
  }

  private canRoleHandleTask(role: string, task: QueuedTask, config: AssignmentStrategy): boolean {
    const rule = config.roleMatching.find(r => r.role === role);
    if (!rule) return false;

    if (task.taskType && !rule.taskTypes.includes(task.taskType)) {
      return false;
    }

    return true;
  }

  private getPriorityValue(priority: string): number {
    const values: Record<string, number> = {
      critical: 100,
      high: 75,
      medium: 50,
      low: 25,
    };
    return values[priority] || 50;
  }

  private subscribeToEvents(projectPath: string): void {
    // Listen for task completions
    this.taskTrackingService.on('task_completed', async (sessionName) => {
      const taskProjectPath = await this.getProjectPath(sessionName);
      if (taskProjectPath === projectPath) {
        await this.assignNextTask(sessionName);
      }
    });
  }
}
```

### 3. File Structure

```
backend/src/services/autonomous/
├── auto-assign.service.ts
├── auto-assign.service.test.ts
├── auto-assign.types.ts
└── index.ts
```

## Implementation Steps

1. **Create service class**
   - Singleton pattern
   - Event emitter

2. **Implement configuration**
   - Load from file
   - Merge with defaults

3. **Implement queue management**
   - Load open tasks
   - Calculate blocked by
   - Sort by priority

4. **Implement task finding**
   - Role matching
   - Dependency checking
   - Priority sorting

5. **Implement assignment**
   - Update tracking
   - Inject prompt
   - Emit events

6. **Implement event handling**
   - Subscribe to completions
   - Trigger next assignment

7. **Write tests**
   - Queue building
   - Task finding
   - Assignment flow

## Acceptance Criteria

- [ ] Service initializes correctly
- [ ] Queue builds from tasks
- [ ] Role matching works
- [ ] Dependencies respected
- [ ] Assignment succeeds
- [ ] Events emitted
- [ ] Tests passing

## Notes

- Consider cooldown between assignments
- Log all assignment decisions
- Allow manual override
- Handle edge cases (no tasks, all blocked)
