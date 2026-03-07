/**
 * Standardized message types for hierarchical team communication.
 *
 * These 4 message types replace free-text task delegation with structured,
 * trackable messages. Serialized to markdown for PTY delivery, parsed back
 * to structs on the agent side.
 *
 * Communication paths:
 * - TaskAssignment:       Orc → TL  or  TL → Worker
 * - StatusReport:         Worker → TL  or  TL → Orc
 * - VerificationRequest:  Worker → TL  or  TL → Orc
 * - VerificationResult:   TL → Worker  or  Orc → TL
 */

import type { InProgressTaskStatus, TaskArtifact } from './task-tracking.types.js';

/** Union of all hierarchy message type identifiers */
export type HierarchyMessageType =
  | 'task_assignment'
  | 'status_report'
  | 'verification_request'
  | 'verification_result';

/**
 * Task assignment message sent by a delegator to an assignee.
 * Replaces the previous free-text task delegation.
 */
export interface TaskAssignment {
  /** Message type identifier */
  type: 'task_assignment';

  /** Unique task ID for tracking */
  taskId: string;

  /** Human-readable task title */
  title: string;

  /** Detailed instructions */
  description: string;

  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical';

  /** Parent task this was decomposed from */
  parentTaskId?: string;

  /** Expected deliverables */
  expectedArtifacts?: string[];

  /** Context files the assignee should read */
  contextFiles?: string[];

  /** Deadline hint (not enforced, for prioritization) */
  deadlineHint?: string;

  /** Session name or member ID of the delegator */
  delegatedBy: string;
}

/**
 * Status report sent by an assignee back to their delegator.
 * Contains task progress, deliverables, and blockers.
 */
export interface StatusReport {
  /** Message type identifier */
  type: 'status_report';

  /** Task ID this report refers to */
  taskId: string;

  /** Current task state */
  state: InProgressTaskStatus;

  /** Progress percentage (0-100) */
  progress?: number;

  /** Human-readable status update */
  message: string;

  /** Completed deliverables */
  artifacts?: TaskArtifact[];

  /** Current blockers preventing progress */
  blockers?: string[];

  /** Session name or member ID of the reporter */
  reportedBy: string;
}

/**
 * Verification request sent when a task is completed and needs review.
 * Triggers the TL's verify-output workflow.
 */
export interface VerificationRequest {
  /** Message type identifier */
  type: 'verification_request';

  /** Task ID to verify */
  taskId: string;

  /** Artifacts to verify */
  artifacts: TaskArtifact[];

  /** Summary of work done */
  summary: string;

  /** Test output if applicable */
  testResults?: string;

  /** Session name or member ID of the requester */
  requestedBy: string;
}

/**
 * Verification result sent by a reviewer back to the assignee.
 * Contains the verdict and feedback for revision.
 */
export interface VerificationResult {
  /** Message type identifier */
  type: 'verification_result';

  /** Task ID that was verified */
  taskId: string;

  /** Verification outcome */
  verdict: 'approved' | 'rejected' | 'revision_needed';

  /** Feedback or instructions for revision */
  feedback?: string;

  /** Session name or member ID of the verifier */
  verifiedBy: string;
}

/** Union type of all hierarchy messages */
export type HierarchyMessage =
  | TaskAssignment
  | StatusReport
  | VerificationRequest
  | VerificationResult;
