# Task: Create Orchestrator State Persistence Service

## Overview

Create a service that saves and restores orchestrator state to/from disk. This enables the orchestrator to resume conversations, tasks, and work after AgentMux restarts.

## Priority

**High** - Required for resuming after restart

## Dependencies

- `47-orchestrator-state-types.md` - State types

## Files to Create

### 1. Create `backend/src/services/orchestrator/state-persistence.service.ts`

```typescript
/**
 * State Persistence Service
 *
 * Manages saving and restoring orchestrator state for
 * continuous operation across restarts.
 *
 * @module services/orchestrator/state-persistence
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  OrchestratorState,
  ConversationState,
  TaskState,
  AgentState,
  ProjectState,
  SelfImprovementState,
  OrchestratorMetadata,
  CheckpointReason,
  ResumeInstructions,
  STATE_PATHS,
  STATE_VERSION,
  MAX_PERSISTED_MESSAGES,
  CHECKPOINT_INTERVAL_MS,
} from '../../types/orchestrator-state.types.js';

/**
 * State persistence service singleton
 */
let statePersistenceInstance: StatePersistenceService | null = null;

/**
 * StatePersistenceService class
 */
export class StatePersistenceService {
  private stateDir: string;
  private currentState: OrchestratorState | null = null;
  private checkpointTimer: NodeJS.Timeout | null = null;
  private startTime: Date;
  private restartCount: number = 0;

  constructor(baseDir?: string) {
    this.stateDir = path.join(
      baseDir || os.homedir(),
      STATE_PATHS.STATE_DIR
    );
    this.startTime = new Date();
  }

  /**
   * Initialize the state persistence service
   *
   * @returns Previous state if available, null otherwise
   */
  async initialize(): Promise<OrchestratorState | null> {
    // Ensure state directory exists
    await fs.mkdir(this.stateDir, { recursive: true });
    await fs.mkdir(path.join(this.stateDir, STATE_PATHS.BACKUP_DIR), { recursive: true });
    await fs.mkdir(path.join(this.stateDir, STATE_PATHS.SELF_IMPROVEMENT_DIR), { recursive: true });

    // Try to load existing state
    const previousState = await this.loadState();

    if (previousState) {
      this.restartCount = (previousState.metadata.restartCount || 0) + 1;
      console.log(`[StatePersistence] Loaded state from ${previousState.checkpointedAt}`);
      console.log(`[StatePersistence] Restart count: ${this.restartCount}`);
    }

    // Initialize current state
    this.currentState = this.createEmptyState();

    // Start periodic checkpointing
    this.startPeriodicCheckpoint();

    return previousState;
  }

  /**
   * Create empty state structure
   */
  private createEmptyState(): OrchestratorState {
    return {
      id: `state-${Date.now()}`,
      version: STATE_VERSION,
      checkpointedAt: new Date().toISOString(),
      checkpointReason: 'scheduled',
      conversations: [],
      tasks: [],
      agents: [],
      projects: [],
      metadata: this.createMetadata(),
    };
  }

  /**
   * Create metadata
   */
  private createMetadata(): OrchestratorMetadata {
    return {
      version: STATE_VERSION,
      hostname: os.hostname(),
      pid: process.pid,
      startedAt: this.startTime.toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      restartCount: this.restartCount,
    };
  }

  /**
   * Load state from disk
   */
  private async loadState(): Promise<OrchestratorState | null> {
    const statePath = path.join(this.stateDir, STATE_PATHS.CURRENT_STATE);

    try {
      const data = await fs.readFile(statePath, 'utf-8');
      const state = JSON.parse(data) as OrchestratorState;

      // Version check
      if (state.version !== STATE_VERSION) {
        console.log(`[StatePersistence] State version mismatch, migration needed`);
        return await this.migrateState(state);
      }

      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null; // No previous state
      }
      console.error('[StatePersistence] Error loading state:', error);
      return null;
    }
  }

  /**
   * Save current state to disk
   */
  async saveState(reason: CheckpointReason = 'scheduled'): Promise<void> {
    if (!this.currentState) return;

    this.currentState.checkpointedAt = new Date().toISOString();
    this.currentState.checkpointReason = reason;
    this.currentState.metadata = this.createMetadata();

    const statePath = path.join(this.stateDir, STATE_PATHS.CURRENT_STATE);

    // Write to temp file first, then rename (atomic)
    const tempPath = `${statePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(this.currentState, null, 2));
    await fs.rename(tempPath, statePath);

    console.log(`[StatePersistence] Checkpointed state (${reason})`);
  }

  /**
   * Create backup before risky operations
   */
  async createBackup(label: string): Promise<string> {
    const backupId = `backup-${Date.now()}-${label}`;
    const backupPath = path.join(
      this.stateDir,
      STATE_PATHS.BACKUP_DIR,
      `${backupId}.json`
    );

    await this.saveState('scheduled');

    // Copy current state to backup
    const statePath = path.join(this.stateDir, STATE_PATHS.CURRENT_STATE);
    await fs.copyFile(statePath, backupPath);

    console.log(`[StatePersistence] Created backup: ${backupId}`);
    return backupId;
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupId: string): Promise<boolean> {
    const backupPath = path.join(
      this.stateDir,
      STATE_PATHS.BACKUP_DIR,
      `${backupId}.json`
    );

    try {
      const data = await fs.readFile(backupPath, 'utf-8');
      this.currentState = JSON.parse(data);

      // Save restored state as current
      await this.saveState('error_recovery');

      console.log(`[StatePersistence] Restored from backup: ${backupId}`);
      return true;
    } catch (error) {
      console.error('[StatePersistence] Failed to restore backup:', error);
      return false;
    }
  }

  /**
   * Update conversation state
   */
  updateConversation(conversation: ConversationState): void {
    if (!this.currentState) return;

    // Trim messages to max
    if (conversation.recentMessages.length > MAX_PERSISTED_MESSAGES) {
      conversation.recentMessages = conversation.recentMessages.slice(
        -MAX_PERSISTED_MESSAGES
      );
    }

    const index = this.currentState.conversations.findIndex(
      c => c.id === conversation.id
    );

    if (index >= 0) {
      this.currentState.conversations[index] = conversation;
    } else {
      this.currentState.conversations.push(conversation);
    }
  }

  /**
   * Update task state
   */
  updateTask(task: TaskState): void {
    if (!this.currentState) return;

    const index = this.currentState.tasks.findIndex(t => t.id === task.id);

    if (index >= 0) {
      this.currentState.tasks[index] = task;
    } else {
      this.currentState.tasks.push(task);
    }
  }

  /**
   * Update agent state
   */
  updateAgent(agent: AgentState): void {
    if (!this.currentState) return;

    const index = this.currentState.agents.findIndex(
      a => a.sessionName === agent.sessionName
    );

    if (index >= 0) {
      this.currentState.agents[index] = agent;
    } else {
      this.currentState.agents.push(agent);
    }
  }

  /**
   * Update project state
   */
  updateProject(project: ProjectState): void {
    if (!this.currentState) return;

    const index = this.currentState.projects.findIndex(p => p.id === project.id);

    if (index >= 0) {
      this.currentState.projects[index] = project;
    } else {
      this.currentState.projects.push(project);
    }
  }

  /**
   * Update self-improvement state
   */
  updateSelfImprovement(state: SelfImprovementState): void {
    if (!this.currentState) return;
    this.currentState.selfImprovement = state;
  }

  /**
   * Generate resume instructions from previous state
   */
  generateResumeInstructions(
    previousState: OrchestratorState
  ): ResumeInstructions {
    const instructions: ResumeInstructions = {
      resumeOrder: [],
      conversationsToResume: [],
      tasksToResume: [],
      notifications: [],
    };

    // Find in-progress tasks to resume
    const inProgressTasks = previousState.tasks.filter(
      t => t.status === 'in_progress' || t.status === 'paused'
    );

    for (const task of inProgressTasks) {
      instructions.tasksToResume.push({
        id: task.id,
        resumeFromCheckpoint: !!task.checkpoint,
      });
      instructions.resumeOrder.push(`task:${task.id}`);
    }

    // Find active conversations (activity in last hour)
    const oneHourAgo = Date.now() - 3600000;
    const activeConversations = previousState.conversations.filter(
      c => new Date(c.lastActivityAt).getTime() > oneHourAgo
    );

    for (const conv of activeConversations) {
      instructions.conversationsToResume.push({
        id: conv.id,
        resumeMessage: `I'm back after a restart. Let me continue where we left off.`,
      });
    }

    // Add notification about restart
    instructions.notifications.push({
      type: 'slack',
      message: `AgentMux has restarted (restart #${previousState.metadata.restartCount + 1}). Resuming ${inProgressTasks.length} tasks and ${activeConversations.length} conversations.`,
    });

    // Check for self-improvement state
    if (previousState.selfImprovement?.currentTask) {
      const siTask = previousState.selfImprovement.currentTask;
      if (siTask.status === 'implementing' || siTask.status === 'testing') {
        instructions.notifications.push({
          type: 'slack',
          message: `:warning: Self-improvement task "${siTask.description}" was in progress. Status: ${siTask.status}. Please verify the changes.`,
        });
      }
    }

    return instructions;
  }

  /**
   * Start periodic checkpoint timer
   */
  private startPeriodicCheckpoint(): void {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
    }

    this.checkpointTimer = setInterval(async () => {
      await this.saveState('scheduled');
    }, CHECKPOINT_INTERVAL_MS);
  }

  /**
   * Get current state (for inspection)
   */
  getState(): OrchestratorState | null {
    return this.currentState;
  }

  /**
   * Prepare for shutdown
   */
  async prepareForShutdown(): Promise<void> {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
    }

    await this.saveState('before_restart');
    console.log('[StatePersistence] State saved before shutdown');
  }

  /**
   * Migrate state from older version
   */
  private async migrateState(
    oldState: OrchestratorState
  ): Promise<OrchestratorState | null> {
    // For now, just return the state as-is
    // Add migration logic as versions evolve
    console.log(`[StatePersistence] Migrating from version ${oldState.version}`);
    return oldState;
  }

  /**
   * Clean up old backups
   */
  async cleanupOldBackups(keepCount: number = 10): Promise<void> {
    const backupDir = path.join(this.stateDir, STATE_PATHS.BACKUP_DIR);

    try {
      const files = await fs.readdir(backupDir);
      const backupFiles = files
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();

      // Delete oldest backups beyond keepCount
      for (const file of backupFiles.slice(keepCount)) {
        await fs.unlink(path.join(backupDir, file));
        console.log(`[StatePersistence] Deleted old backup: ${file}`);
      }
    } catch (error) {
      console.error('[StatePersistence] Error cleaning backups:', error);
    }
  }
}

/**
 * Get singleton instance
 */
export function getStatePersistenceService(): StatePersistenceService {
  if (!statePersistenceInstance) {
    statePersistenceInstance = new StatePersistenceService();
  }
  return statePersistenceInstance;
}

/**
 * Reset instance (for testing)
 */
export function resetStatePersistenceService(): void {
  if (statePersistenceInstance) {
    statePersistenceInstance.prepareForShutdown().catch(() => {});
  }
  statePersistenceInstance = null;
}
```

### 2. Create `backend/src/services/orchestrator/index.ts`

```typescript
export {
  StatePersistenceService,
  getStatePersistenceService,
  resetStatePersistenceService,
} from './state-persistence.service.js';
```

### 3. Create `backend/src/services/orchestrator/state-persistence.service.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  StatePersistenceService,
  getStatePersistenceService,
  resetStatePersistenceService,
} from './state-persistence.service.js';

describe('StatePersistenceService', () => {
  let testDir: string;
  let service: StatePersistenceService;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `state-test-${Date.now()}`);
    service = new StatePersistenceService(testDir);
    resetStatePersistenceService();
  });

  afterEach(async () => {
    resetStatePersistenceService();
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('initialize', () => {
    it('should create state directories', async () => {
      await service.initialize();

      const stateDir = path.join(testDir, '.agentmux/state');
      const stat = await fs.stat(stateDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should return null when no previous state', async () => {
      const previousState = await service.initialize();
      expect(previousState).toBeNull();
    });
  });

  describe('saveState and loadState', () => {
    it('should save and load state', async () => {
      await service.initialize();

      // Update some state
      service.updateConversation({
        id: 'conv-1',
        source: 'chat',
        recentMessages: [
          { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
        ],
        lastActivityAt: new Date().toISOString(),
      });

      await service.saveState('user_request');

      // Create new service instance to test loading
      const service2 = new StatePersistenceService(testDir);
      const loadedState = await service2.initialize();

      expect(loadedState).not.toBeNull();
      expect(loadedState?.conversations).toHaveLength(1);
      expect(loadedState?.conversations[0].id).toBe('conv-1');
    });
  });

  describe('updateConversation', () => {
    it('should add new conversation', async () => {
      await service.initialize();

      service.updateConversation({
        id: 'conv-1',
        source: 'slack',
        recentMessages: [],
        lastActivityAt: new Date().toISOString(),
      });

      const state = service.getState();
      expect(state?.conversations).toHaveLength(1);
    });

    it('should update existing conversation', async () => {
      await service.initialize();

      service.updateConversation({
        id: 'conv-1',
        source: 'slack',
        recentMessages: [],
        lastActivityAt: new Date().toISOString(),
      });

      service.updateConversation({
        id: 'conv-1',
        source: 'slack',
        recentMessages: [{ role: 'user', content: 'Hi', timestamp: new Date().toISOString() }],
        lastActivityAt: new Date().toISOString(),
      });

      const state = service.getState();
      expect(state?.conversations).toHaveLength(1);
      expect(state?.conversations[0].recentMessages).toHaveLength(1);
    });

    it('should trim messages to max limit', async () => {
      await service.initialize();

      const manyMessages = Array.from({ length: 100 }, (_, i) => ({
        role: 'user' as const,
        content: `Message ${i}`,
        timestamp: new Date().toISOString(),
      }));

      service.updateConversation({
        id: 'conv-1',
        source: 'chat',
        recentMessages: manyMessages,
        lastActivityAt: new Date().toISOString(),
      });

      const state = service.getState();
      expect(state?.conversations[0].recentMessages.length).toBeLessThanOrEqual(50);
    });
  });

  describe('updateTask', () => {
    it('should add and update tasks', async () => {
      await service.initialize();

      service.updateTask({
        id: 'task-1',
        title: 'Test task',
        description: 'Testing',
        status: 'pending',
        priority: 'medium',
        progress: { percentComplete: 0, completedSteps: [] },
        createdAt: new Date().toISOString(),
      });

      const state = service.getState();
      expect(state?.tasks).toHaveLength(1);
    });
  });

  describe('createBackup and restoreFromBackup', () => {
    it('should create and restore backups', async () => {
      await service.initialize();

      service.updateConversation({
        id: 'conv-1',
        source: 'chat',
        recentMessages: [],
        lastActivityAt: new Date().toISOString(),
      });

      const backupId = await service.createBackup('test');

      // Modify state
      service.updateConversation({
        id: 'conv-2',
        source: 'slack',
        recentMessages: [],
        lastActivityAt: new Date().toISOString(),
      });

      expect(service.getState()?.conversations).toHaveLength(2);

      // Restore
      const restored = await service.restoreFromBackup(backupId);
      expect(restored).toBe(true);
      expect(service.getState()?.conversations).toHaveLength(1);
    });
  });

  describe('generateResumeInstructions', () => {
    it('should generate instructions for in-progress tasks', async () => {
      await service.initialize();

      const previousState = {
        id: 'state-1',
        version: '1.0.0',
        checkpointedAt: new Date().toISOString(),
        checkpointReason: 'before_restart' as const,
        conversations: [],
        tasks: [
          {
            id: 'task-1',
            title: 'In progress task',
            description: 'Testing',
            status: 'in_progress' as const,
            priority: 'high' as const,
            progress: { percentComplete: 50, completedSteps: [] },
            createdAt: new Date().toISOString(),
          },
        ],
        agents: [],
        projects: [],
        metadata: {
          version: '1.0.0',
          hostname: 'test',
          pid: 1234,
          startedAt: new Date().toISOString(),
          uptimeSeconds: 100,
          restartCount: 0,
        },
      };

      const instructions = service.generateResumeInstructions(previousState);

      expect(instructions.tasksToResume).toHaveLength(1);
      expect(instructions.tasksToResume[0].id).toBe('task-1');
    });
  });
});
```

## Acceptance Criteria

- [ ] Service saves state to `~/.agentmux/state/`
- [ ] State loads correctly on restart
- [ ] Periodic checkpointing works
- [ ] Backup creation and restoration works
- [ ] Conversation, task, agent, project updates work
- [ ] Resume instructions generated correctly
- [ ] Old backup cleanup works
- [ ] Atomic file writes prevent corruption
- [ ] TypeScript compilation passes
- [ ] All tests pass

## Testing Requirements

- Unit tests for all methods
- File system operation tests
- Backup/restore tests
- Resume instruction tests

## Estimated Effort

45 minutes

## Notes

- Uses atomic file writes (temp file + rename)
- Periodic checkpoint prevents data loss
- Backup system enables rollback
- Resume instructions help orchestrator recover context
