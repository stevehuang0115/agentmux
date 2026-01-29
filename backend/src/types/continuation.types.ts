/**
 * Continuation Detection Type Definitions
 *
 * Types for the system that detects when agents stop/idle and determines
 * whether to continue their work automatically.
 *
 * @module types/continuation.types
 */

// ============================================
// Continuation Triggers
// ============================================

/**
 * Types of events that can trigger continuation analysis
 */
export type ContinuationTrigger =
  | 'pty_exit'           // PTY process exited
  | 'activity_idle'      // No output change for multiple polling cycles
  | 'heartbeat_stale'    // No MCP calls for extended period
  | 'explicit_request';  // Agent or user requested continuation

/**
 * Event emitted when a continuation trigger is detected
 */
export interface ContinuationEvent {
  /** Type of trigger that caused this event */
  trigger: ContinuationTrigger;
  /** Name of the session */
  sessionName: string;
  /** Agent identifier */
  agentId: string;
  /** Path to the project */
  projectPath: string;
  /** ISO timestamp when the event occurred */
  timestamp: string;
  /** Additional context about the event */
  metadata: ContinuationEventMetadata;
}

/**
 * Metadata attached to continuation events
 */
export interface ContinuationEventMetadata {
  /** Exit code if trigger was pty_exit */
  exitCode?: number;
  /** Last captured terminal output */
  lastOutput?: string;
  /** ISO timestamp of last MCP heartbeat */
  lastHeartbeat?: string;
  /** Number of minutes the agent has been idle */
  idleDuration?: number;
  /** Number of idle poll cycles */
  idleCycles?: number;
  /** Reason for explicit request */
  requestReason?: string;
}

// ============================================
// Agent State Analysis
// ============================================

/**
 * Conclusions about the agent's current state
 */
export type AgentConclusion =
  | 'TASK_COMPLETE'      // Agent finished the task successfully
  | 'WAITING_INPUT'      // Agent is waiting for user/other agent
  | 'STUCK_OR_ERROR'     // Agent hit an error or is stuck
  | 'INCOMPLETE'         // Task not done, can continue
  | 'MAX_ITERATIONS'     // Hit iteration limit
  | 'UNKNOWN';           // Can't determine state

/**
 * Result of analyzing agent state
 */
export interface AgentStateAnalysis {
  /** Conclusion about agent's current state */
  conclusion: AgentConclusion;
  /** Confidence in the conclusion (0-1) */
  confidence: number;
  /** Evidence supporting the conclusion */
  evidence: string[];
  /** Recommended action to take */
  recommendation: ContinuationAction;
  /** Information about current task if known */
  currentTask?: TaskInfo;
  /** Number of continuation iterations so far */
  iterations: number;
  /** Maximum iterations allowed */
  maxIterations: number;
}

/**
 * Brief information about a task
 */
export interface TaskInfo {
  /** Task identifier */
  id: string;
  /** Task title */
  title: string;
  /** Task status */
  status: 'open' | 'in_progress' | 'blocked' | 'done';
  /** File path to the task */
  path: string;
}

// ============================================
// Continuation Actions
// ============================================

/**
 * Actions that can be taken in response to a continuation event
 */
export type ContinuationAction =
  | 'inject_prompt'       // Send continuation prompt to agent
  | 'assign_next_task'    // Mark current task complete, assign next
  | 'notify_owner'        // Alert human for intervention
  | 'retry_with_hints'    // Retry with error hints from analysis
  | 'pause_agent'         // Stop the agent session
  | 'no_action';          // Do nothing

/**
 * Configuration for a continuation action
 */
export interface ContinuationActionConfig {
  /** Action to perform */
  action: ContinuationAction;
  /** Parameters specific to the action */
  params?: {
    /** Prompt to inject for inject_prompt action */
    prompt?: string;
    /** Error hints for retry_with_hints action */
    hints?: string[];
    /** Notification message for notify_owner action */
    message?: string;
    /** Next task ID for assign_next_task action */
    nextTaskId?: string;
    /** Reason for pausing */
    pauseReason?: string;
  };
  /** Delay before executing action (ms) */
  delay?: number;
}

/**
 * Result of executing a continuation action
 */
export interface ContinuationActionResult {
  /** Whether the action was successful */
  success: boolean;
  /** Action that was taken */
  action: ContinuationAction;
  /** Message describing the result */
  message: string;
  /** Error if action failed */
  error?: string;
  /** ISO timestamp when action was executed */
  executedAt: string;
}

// ============================================
// Iteration Tracking
// ============================================

/**
 * Tracking data for a task's continuation iterations
 */
export interface IterationTracking {
  /** Session name */
  sessionName: string;
  /** Agent identifier */
  agentId: string;
  /** Task identifier */
  taskId: string;
  /** Current iteration count */
  iterations: number;
  /** Maximum iterations allowed */
  maxIterations: number;
  /** ISO timestamp of first iteration */
  startedAt: string;
  /** ISO timestamp of last iteration */
  lastIterationAt: string;
  /** History of iterations */
  history: IterationHistoryEntry[];
}

/**
 * Single entry in iteration history
 */
export interface IterationHistoryEntry {
  /** Iteration number */
  iteration: number;
  /** Trigger that caused this iteration */
  trigger: ContinuationTrigger;
  /** Conclusion from analysis */
  conclusion: AgentConclusion;
  /** Action taken */
  action: ContinuationAction;
  /** ISO timestamp */
  timestamp: string;
}

// ============================================
// Service Interfaces
// ============================================

/**
 * Interface for the ContinuationEventEmitter service
 */
export interface IContinuationEventEmitter {
  /**
   * Subscribe to continuation events
   *
   * @param event - Event name (always 'continuation')
   * @param handler - Handler function for events
   */
  on(event: 'continuation', handler: (event: ContinuationEvent) => void): void;

  /**
   * Unsubscribe from continuation events
   *
   * @param event - Event name
   * @param handler - Handler function to remove
   */
  off(event: 'continuation', handler: (event: ContinuationEvent) => void): void;

  /**
   * Manually trigger a continuation event
   *
   * @param event - The continuation event to emit
   */
  trigger(event: ContinuationEvent): void;
}

/**
 * Interface for the OutputAnalyzer service
 */
export interface IOutputAnalyzer {
  /**
   * Analyze agent output to determine state
   *
   * @param sessionName - Session to analyze
   * @param output - Terminal output to analyze
   * @param context - Additional context for analysis
   * @returns Analysis result
   */
  analyze(
    sessionName: string,
    output: string,
    context?: OutputAnalysisContext
  ): Promise<AgentStateAnalysis>;
}

/**
 * Context for output analysis
 */
export interface OutputAnalysisContext {
  /** Current task being worked on */
  currentTask?: TaskInfo;
  /** Agent's role */
  agentRole?: string;
  /** Number of iterations so far */
  iterations?: number;
  /** Recent MCP tool calls */
  recentToolCalls?: string[];
}

/**
 * Interface for the ContinuationService
 */
export interface IContinuationService {
  /**
   * Handle a continuation event
   *
   * @param event - The continuation event
   * @returns Action result
   */
  handleEvent(event: ContinuationEvent): Promise<ContinuationActionResult>;

  /**
   * Get iteration tracking for a session
   *
   * @param sessionName - Session name
   * @returns Iteration tracking data or null
   */
  getIterationTracking(sessionName: string): Promise<IterationTracking | null>;

  /**
   * Reset iteration count for a session
   *
   * @param sessionName - Session name
   */
  resetIterations(sessionName: string): Promise<void>;
}
