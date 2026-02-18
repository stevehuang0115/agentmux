# Task: Create Orchestrator State Persistence Types

## Overview

Define TypeScript types for persisting orchestrator state across restarts. This enables the orchestrator to resume work after Crewly restarts, maintaining conversation context and task progress.

## Priority

**High** - Foundation for self-improvement capability

## Dependencies

- None (foundation task)

## Files to Create

### 1. Create `backend/src/types/orchestrator-state.types.ts`

```typescript
/**
 * Orchestrator State Persistence Types
 *
 * Types for saving and restoring orchestrator state across
 * restarts, enabling continuous operation and self-improvement.
 *
 * @module types/orchestrator-state
 */

/**
 * Overall orchestrator state
 */
export interface OrchestratorState {
  /** Unique state ID */
  id: string;
  /** Version for migration compatibility */
  version: string;
  /** State checkpoint timestamp */
  checkpointedAt: string;
  /** Reason for checkpoint */
  checkpointReason: CheckpointReason;

  /** Active conversation contexts */
  conversations: ConversationState[];
  /** Pending/in-progress tasks */
  tasks: TaskState[];
  /** Agent assignments and status */
  agents: AgentState[];
  /** Project contexts */
  projects: ProjectState[];

  /** Self-improvement specific state */
  selfImprovement?: SelfImprovementState;

  /** Metadata */
  metadata: OrchestratorMetadata;
}

/**
 * Reasons for state checkpoint
 */
export type CheckpointReason =
  | 'scheduled'           // Periodic checkpoint
  | 'before_restart'      // Graceful shutdown
  | 'task_completed'      // Major task milestone
  | 'user_request'        // Manual checkpoint
  | 'self_improvement'    // Before code changes
  | 'error_recovery';     // After error

/**
 * Conversation state for persistence
 */
export interface ConversationState {
  id: string;
  source: 'chat' | 'slack' | 'api';
  /** Last N messages for context */
  recentMessages: PersistedMessage[];
  /** Summary of older conversation */
  summary?: string;
  /** User ID if applicable */
  userId?: string;
  /** Channel/thread info for Slack */
  slackContext?: {
    channelId: string;
    threadTs: string;
  };
  /** Conversation topic/intent */
  currentTopic?: string;
  lastActivityAt: string;
}

/**
 * Persisted message (minimal for storage)
 */
export interface PersistedMessage {
  role: 'user' | 'orchestrator' | 'agent';
  content: string;
  timestamp: string;
  /** Agent name if from agent */
  agentName?: string;
}

/**
 * Task state for persistence
 */
export interface TaskState {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'paused' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'critical';

  /** Assignment info */
  assignedTo?: string;  // Agent session name
  teamId?: string;
  projectId?: string;

  /** Progress tracking */
  progress: TaskProgress;

  /** Dependencies */
  blockedBy?: string[];
  blocks?: string[];

  /** Timestamps */
  createdAt: string;
  startedAt?: string;
  lastActivityAt?: string;
  completedAt?: string;

  /** Checkpoint for resume */
  checkpoint?: TaskCheckpoint;
}

/**
 * Task progress information
 */
export interface TaskProgress {
  /** Percentage complete (0-100) */
  percentComplete: number;
  /** Current step description */
  currentStep?: string;
  /** Completed steps */
  completedSteps: string[];
  /** Remaining steps */
  remainingSteps?: string[];
  /** Any blockers */
  blockers?: string[];
}

/**
 * Task checkpoint for detailed resume
 */
export interface TaskCheckpoint {
  /** Step index when checkpointed */
  stepIndex: number;
  /** Partial work data */
  workData?: Record<string, unknown>;
  /** Files modified */
  modifiedFiles?: string[];
  /** Agent context */
  agentContext?: string;
  /** Commands/actions pending */
  pendingActions?: string[];
}

/**
 * Agent state for persistence
 */
export interface AgentState {
  sessionName: string;
  agentId: string;
  role: string;
  status: 'active' | 'inactive' | 'busy' | 'error';

  /** Current work */
  currentTaskId?: string;
  currentProjectPath?: string;

  /** Context for resume */
  contextSummary?: string;

  /** Last known position */
  lastActivity?: {
    type: string;
    timestamp: string;
    description?: string;
  };
}

/**
 * Project state for persistence
 */
export interface ProjectState {
  id: string;
  name: string;
  path: string;
  status: 'active' | 'paused' | 'completed';

  /** Current focus areas */
  activeTasks: string[];
  activeAgents: string[];

  /** Git state */
  gitState?: {
    branch: string;
    lastCommit: string;
    hasUncommittedChanges: boolean;
  };

  /** Build/test state */
  buildState?: {
    lastBuildStatus: 'success' | 'failed' | 'unknown';
    lastBuildAt?: string;
    testsPass: boolean;
  };
}

/**
 * Self-improvement specific state
 */
export interface SelfImprovementState {
  /** Current improvement task */
  currentTask?: {
    id: string;
    description: string;
    targetFiles: string[];
    plannedChanges: PlannedChange[];
    status: 'planning' | 'implementing' | 'testing' | 'validating' | 'completed' | 'rolled_back';
  };

  /** Backup state before changes */
  backup?: {
    id: string;
    createdAt: string;
    files: FileBackup[];
    gitCommit?: string;
  };

  /** Validation requirements */
  validationChecks: ValidationCheck[];

  /** Rollback instructions */
  rollbackPlan?: {
    steps: string[];
    gitCommit?: string;
  };
}

/**
 * Planned code change
 */
export interface PlannedChange {
  file: string;
  type: 'create' | 'modify' | 'delete';
  description: string;
  /** Estimated risk level */
  risk: 'low' | 'medium' | 'high';
}

/**
 * File backup for rollback
 */
export interface FileBackup {
  path: string;
  originalContent: string;
  backupPath: string;
  checksum: string;
}

/**
 * Validation check definition
 */
export interface ValidationCheck {
  name: string;
  type: 'build' | 'test' | 'lint' | 'custom';
  command?: string;
  required: boolean;
  passed?: boolean;
  output?: string;
}

/**
 * Orchestrator metadata
 */
export interface OrchestratorMetadata {
  /** Crewly version */
  version: string;
  /** Hostname for identification */
  hostname: string;
  /** Process ID */
  pid: number;
  /** Start time */
  startedAt: string;
  /** Total uptime before checkpoint */
  uptimeSeconds: number;
  /** Number of restarts */
  restartCount: number;
}

/**
 * State diff for incremental updates
 */
export interface StateDiff {
  timestamp: string;
  changes: StateChange[];
}

/**
 * Individual state change
 */
export interface StateChange {
  type: 'conversation' | 'task' | 'agent' | 'project' | 'self_improvement';
  operation: 'add' | 'update' | 'delete';
  id: string;
  data?: unknown;
}

/**
 * Resume instructions after restart
 */
export interface ResumeInstructions {
  /** Priority order for resumption */
  resumeOrder: string[];
  /** Conversations to re-engage */
  conversationsToResume: {
    id: string;
    resumeMessage?: string;
  }[];
  /** Tasks to continue */
  tasksToResume: {
    id: string;
    resumeFromCheckpoint: boolean;
  }[];
  /** Notifications to send */
  notifications: {
    type: 'slack' | 'log';
    message: string;
  }[];
}

/**
 * State file paths configuration
 */
export const STATE_PATHS = {
  STATE_DIR: '.crewly/state',
  CURRENT_STATE: 'orchestrator-state.json',
  BACKUP_DIR: 'backups',
  SELF_IMPROVEMENT_DIR: 'self-improvement',
} as const;

/**
 * State version for migrations
 */
export const STATE_VERSION = '1.0.0';

/**
 * Maximum messages to persist per conversation
 */
export const MAX_PERSISTED_MESSAGES = 50;

/**
 * Checkpoint interval in milliseconds
 */
export const CHECKPOINT_INTERVAL_MS = 60000; // 1 minute
```

### 2. Create `backend/src/types/orchestrator-state.types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  STATE_PATHS,
  STATE_VERSION,
  MAX_PERSISTED_MESSAGES,
  CHECKPOINT_INTERVAL_MS,
  OrchestratorState,
  TaskState,
  ConversationState,
} from './orchestrator-state.types.js';

describe('Orchestrator State Types', () => {
  describe('Constants', () => {
    it('should have correct STATE_PATHS', () => {
      expect(STATE_PATHS.STATE_DIR).toBe('.crewly/state');
      expect(STATE_PATHS.CURRENT_STATE).toBe('orchestrator-state.json');
      expect(STATE_PATHS.BACKUP_DIR).toBe('backups');
    });

    it('should have valid STATE_VERSION', () => {
      expect(STATE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should have reasonable MAX_PERSISTED_MESSAGES', () => {
      expect(MAX_PERSISTED_MESSAGES).toBeGreaterThan(10);
      expect(MAX_PERSISTED_MESSAGES).toBeLessThanOrEqual(100);
    });

    it('should have reasonable CHECKPOINT_INTERVAL_MS', () => {
      expect(CHECKPOINT_INTERVAL_MS).toBeGreaterThanOrEqual(30000);
      expect(CHECKPOINT_INTERVAL_MS).toBeLessThanOrEqual(300000);
    });
  });

  describe('Type validation helpers', () => {
    it('should validate OrchestratorState structure', () => {
      const state: OrchestratorState = {
        id: 'state-123',
        version: '1.0.0',
        checkpointedAt: new Date().toISOString(),
        checkpointReason: 'scheduled',
        conversations: [],
        tasks: [],
        agents: [],
        projects: [],
        metadata: {
          version: '1.0.0',
          hostname: 'test-host',
          pid: 12345,
          startedAt: new Date().toISOString(),
          uptimeSeconds: 3600,
          restartCount: 0,
        },
      };

      expect(state.id).toBe('state-123');
      expect(state.conversations).toHaveLength(0);
    });

    it('should validate TaskState with checkpoint', () => {
      const task: TaskState = {
        id: 'task-123',
        title: 'Fix bug',
        description: 'Fix the login bug',
        status: 'in_progress',
        priority: 'high',
        progress: {
          percentComplete: 50,
          currentStep: 'Testing fix',
          completedSteps: ['Analyzed issue', 'Implemented fix'],
        },
        createdAt: new Date().toISOString(),
        checkpoint: {
          stepIndex: 2,
          modifiedFiles: ['src/auth.ts'],
          pendingActions: ['Run tests'],
        },
      };

      expect(task.checkpoint?.stepIndex).toBe(2);
      expect(task.progress.percentComplete).toBe(50);
    });

    it('should validate ConversationState', () => {
      const conversation: ConversationState = {
        id: 'conv-123',
        source: 'slack',
        recentMessages: [
          { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
          { role: 'orchestrator', content: 'Hi there!', timestamp: new Date().toISOString() },
        ],
        slackContext: {
          channelId: 'C123',
          threadTs: '1234567890.123456',
        },
        lastActivityAt: new Date().toISOString(),
      };

      expect(conversation.source).toBe('slack');
      expect(conversation.recentMessages).toHaveLength(2);
    });
  });
});
```

## Acceptance Criteria

- [ ] `backend/src/types/orchestrator-state.types.ts` created
- [ ] `backend/src/types/orchestrator-state.types.test.ts` created
- [ ] Types cover full orchestrator state
- [ ] Task checkpoint structure supports granular resume
- [ ] Conversation state supports multiple sources (chat, slack)
- [ ] Self-improvement state tracks code changes
- [ ] File backup structure supports rollback
- [ ] Constants defined for configuration
- [ ] TypeScript compilation passes
- [ ] All tests pass

## Testing Requirements

- Type validation tests
- Constant value tests

## Estimated Effort

15 minutes

## Notes

- State version enables future migrations
- Checkpoint reason helps with debugging
- Self-improvement state isolates risky operations
- Message limit prevents unbounded storage growth
