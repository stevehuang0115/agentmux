/**
 * Scheduler Type Definitions
 *
 * Types for the enhanced scheduler service with PTY compatibility,
 * continuation-aware scheduling, and adaptive scheduling.
 *
 * @module types/scheduler.types
 */

// ============================================
// Scheduled Message Types
// ============================================

/**
 * Types of scheduled messages
 */
export type ScheduledMessageType =
  | 'check-in'          // General check-in
  | 'commit-reminder'   // Git commit reminder
  | 'progress-check'    // Progress status request
  | 'continuation'      // Continuation trigger
  | 'custom';           // Custom message

/**
 * Enhanced scheduled message with type information
 */
export interface EnhancedScheduledMessage {
  /** Unique message identifier */
  id: string;
  /** Target session name */
  sessionName: string;
  /** Message content (empty for continuation type) */
  message: string;
  /** Scheduled execution time */
  scheduledFor: Date;
  /** Type of scheduled message */
  type: ScheduledMessageType;
  /** Recurring configuration */
  recurring?: RecurringConfig;
  /** Additional metadata */
  metadata?: ScheduledMessageMetadata;
  /** ISO timestamp of creation */
  createdAt: string;
  /** Optional session name of the agent being monitored for status enrichment */
  watchedSession?: string;
}

/**
 * Information emitted when a stuck agent is detected by the scheduler
 */
export interface StuckAgentAlert {
  /** Session name of the stuck agent */
  watchedSession: string;
  /** Reason for the stuck detection */
  reason: 'session_dead' | 'not_yet_active' | 'idle_too_long';
  /** Current agent lifecycle status */
  agentStatus: string;
  /** Current working status */
  workingStatus: string;
  /** Number of consecutive checks where agent was idle */
  consecutiveIdleChecks: number;
}

/**
 * Configuration for recurring messages
 */
export interface RecurringConfig {
  /** Interval in minutes */
  interval: number;
  /** Maximum number of occurrences (undefined = unlimited) */
  maxOccurrences?: number;
  /** Current occurrence count */
  currentOccurrence?: number;
}

/**
 * Metadata for scheduled messages
 */
export interface ScheduledMessageMetadata {
  /** Associated task ID */
  taskId?: string;
  /** Current iteration number */
  iteration?: number;
  /** Whether to trigger continuation logic */
  triggerContinuation?: boolean;
  /** Agent ID */
  agentId?: string;
  /** Project path */
  projectPath?: string;
  /** Custom data */
  [key: string]: unknown;
}

// ============================================
// Adaptive Scheduling Types
// ============================================

/**
 * Configuration for adaptive scheduling
 */
export interface AdaptiveScheduleConfig {
  /** Base check interval in minutes */
  baseInterval: number;
  /** Minimum interval in minutes */
  minInterval: number;
  /** Maximum interval in minutes */
  maxInterval: number;
  /** Factor to adjust interval by */
  adjustmentFactor: number;
}

/**
 * Activity information for adaptive scheduling
 */
export interface ActivityInfo {
  /** Whether the agent is highly active */
  isHighlyActive: boolean;
  /** Whether the agent is idle */
  isIdle: boolean;
  /** Last activity timestamp */
  lastActivityAt?: string;
  /** Activity level (0-1) */
  activityLevel?: number;
}

// ============================================
// Schedule Parameters
// ============================================

/**
 * Parameters for scheduling a one-time check
 */
export interface ScheduleCheckParams {
  /** Target session name */
  sessionName: string;
  /** Delay in minutes */
  delayMinutes: number;
  /** Message to send */
  message: string;
  /** Type of scheduled message */
  type?: ScheduledMessageType;
  /** Additional metadata */
  metadata?: ScheduledMessageMetadata;
}

/**
 * Parameters for scheduling a recurring check
 */
export interface ScheduleRecurringParams {
  /** Target session name */
  sessionName: string;
  /** Interval in minutes */
  interval: number;
  /** Message to send */
  message: string;
  /** Type of scheduled message */
  type?: ScheduledMessageType;
  /** Maximum occurrences */
  maxOccurrences?: number;
  /** Additional metadata */
  metadata?: ScheduledMessageMetadata;
}

/**
 * Parameters for scheduling a continuation check
 */
export interface ScheduleContinuationParams {
  /** Target session name */
  sessionName: string;
  /** Delay in minutes */
  delayMinutes: number;
  /** Agent ID */
  agentId?: string;
  /** Project path */
  projectPath?: string;
}

// ============================================
// Default Schedules
// ============================================

/**
 * Default scheduling intervals
 */
export const DEFAULT_SCHEDULES = {
  /** Initial check-in delay in minutes */
  initialCheck: 5,
  /** Progress check interval in minutes */
  progressCheck: 30,
  /** Commit reminder interval in minutes */
  commitReminder: 25,
} as const;

/**
 * Default adaptive schedule configuration
 */
export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveScheduleConfig = {
  baseInterval: 15,
  minInterval: 5,
  maxInterval: 60,
  adjustmentFactor: 1.5,
};

// ============================================
// Service Interface
// ============================================

/**
 * Interface for the enhanced SchedulerService
 */
export interface ISchedulerService {
  /**
   * Schedule a one-time check
   *
   * @param targetSession - Target session name
   * @param minutes - Delay in minutes
   * @param message - Message to send
   * @returns Check ID
   */
  scheduleCheck(targetSession: string, minutes: number, message: string): string;

  /**
   * Schedule a recurring check
   *
   * @param targetSession - Target session name
   * @param intervalMinutes - Interval in minutes
   * @param message - Message to send
   * @returns Check ID
   */
  scheduleRecurringCheck(
    targetSession: string,
    intervalMinutes: number,
    message: string
  ): string;

  /**
   * Schedule default check-ins for a session
   *
   * @param sessionName - Session name
   * @returns Array of check IDs
   */
  scheduleDefaultCheckins(sessionName: string): string[];

  /**
   * Schedule a continuation check
   *
   * @param params - Continuation parameters
   * @returns Check ID
   */
  scheduleContinuationCheck(params: ScheduleContinuationParams): string;

  /**
   * Schedule an adaptive check-in based on activity
   *
   * @param sessionName - Session name
   * @param config - Adaptive configuration
   * @returns Check ID
   */
  scheduleAdaptiveCheckin(
    sessionName: string,
    config?: AdaptiveScheduleConfig
  ): Promise<string>;

  /**
   * Cancel a scheduled check
   *
   * @param checkId - Check ID to cancel
   */
  cancelCheck(checkId: string): void;

  /**
   * Cancel all checks for a session
   *
   * @param sessionName - Session name
   */
  cancelAllChecksForSession(sessionName: string): void;

  /**
   * Get scheduled checks for a session
   *
   * @param sessionName - Session name
   * @returns Array of scheduled checks
   */
  getChecksForSession(sessionName: string): EnhancedScheduledMessage[];

  /**
   * Get scheduler statistics
   *
   * @returns Statistics object
   */
  getStats(): SchedulerStats;

  /**
   * Clean up all scheduled checks
   */
  cleanup(): void;
}

/**
 * Scheduler statistics
 */
export interface SchedulerStats {
  /** Number of one-time checks */
  oneTimeChecks: number;
  /** Number of recurring checks */
  recurringChecks: number;
  /** Total unique sessions with active schedules */
  totalActiveSessions: number;
  /** Number of continuation checks */
  continuationChecks?: number;
  /** Number of adaptive checks */
  adaptiveChecks?: number;
}
