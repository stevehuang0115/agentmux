export interface InProgressTask {
  id: string;
  projectId: string;
  teamId: string;
  taskFilePath: string; // e.g. "/path/to/project/.crewly/tasks/m1_foundation/open/01_setup_tpm.md"
  taskName: string;
  targetRole: string; // tpm, pgm, dev, qa
  assignedTeamMemberId: string;
  assignedSessionName: string;
  assignedAt: string; // ISO timestamp
  status: 'assigned' | 'active' | 'blocked' | 'pending_assignment' | 'completed';
  lastCheckedAt?: string;
  blockReason?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface TaskTrackingData {
  tasks: InProgressTask[];
  lastUpdated: string;
  version: string;
}

export interface TaskStatus {
  status: 'open' | 'in_progress' | 'done' | 'blocked';
  folder: string; // open/, in_progress/, done/, blocked/
}

export interface TaskFileInfo {
  filePath: string;
  fileName: string;
  taskName: string;
  targetRole: string;
  milestoneFolder: string;
  statusFolder: 'open' | 'in_progress' | 'done' | 'blocked';
}

// ============================================
// Iteration Tracking
// ============================================

/**
 * Record of a single continuation iteration
 */
export interface IterationRecord {
  /** ISO timestamp of the iteration */
  timestamp: string;
  /** What triggered this iteration */
  trigger: 'pty_exit' | 'activity_idle' | 'heartbeat_stale' | 'explicit_request';
  /** Action taken in response */
  action: 'inject_prompt' | 'assign_next_task' | 'notify_owner' | 'retry_with_hints' | 'pause_agent' | 'no_action';
  /** Conclusion of the analysis */
  conclusion: 'TASK_COMPLETE' | 'WAITING_INPUT' | 'STUCK_OR_ERROR' | 'INCOMPLETE' | 'MAX_ITERATIONS' | 'UNKNOWN';
  /** Optional notes about this iteration */
  notes?: string;
}

/**
 * Continuation tracking data stored with a ticket
 */
export interface ContinuationTrackingData {
  /** Current iteration count */
  iterations: number;
  /** Maximum allowed iterations */
  maxIterations: number;
  /** ISO timestamp of last iteration */
  lastIteration?: string;
  /** History of iterations (max 20) */
  iterationHistory: IterationRecord[];
}

// ============================================
// Quality Gates
// ============================================

/**
 * Status of a single quality gate
 */
export interface QualityGateStatus {
  /** Whether the gate passed */
  passed: boolean;
  /** ISO timestamp of last run */
  lastRun?: string;
  /** Output from the gate (truncated if too long) */
  output?: string;
}

/**
 * Collection of quality gates for a ticket
 */
export interface QualityGates {
  /** TypeScript type checking */
  typecheck?: QualityGateStatus;
  /** Test suite */
  tests?: QualityGateStatus;
  /** Lint check */
  lint?: QualityGateStatus;
  /** Build check */
  build?: QualityGateStatus;
  /** Allow custom gates */
  [customGate: string]: QualityGateStatus | undefined;
}

/**
 * Required gates that must pass for task completion
 */
export const REQUIRED_QUALITY_GATES = ['typecheck', 'tests', 'build'] as const;