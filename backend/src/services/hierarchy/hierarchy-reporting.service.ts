/**
 * Hierarchy Reporting Service
 *
 * Handles the hierarchical reporting chain: Workers report to Team Leaders,
 * Team Leaders aggregate and report up to the Orchestrator.
 *
 * Key responsibilities:
 * - Receive worker status reports and route them to the Team Leader
 * - Aggregate multiple worker reports into a single TL report
 * - Generate AggregatedReport format for Orchestrator consumption
 * - Emit hierarchy:report_up events when reports flow upward
 *
 * @module services/hierarchy/hierarchy-reporting
 */

import type { TeamMember, Team } from '../../types/index.js';
import type { InProgressTask, TaskArtifact, InProgressTaskStatus } from '../../types/task-tracking.types.js';
import type { StatusReport } from '../../types/hierarchy-message.types.js';
import type { EventBusService } from '../event-bus/event-bus.service.js';
import type { AgentEvent } from '../../types/event-bus.types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Aggregated report from Team Leader to Orchestrator.
 * Summarizes the status of all subtasks under a parent goal.
 */
export interface AggregatedReport {
  /** Message type identifier */
  type: 'aggregated_report';

  /** The goal/task that Orchestrator originally delegated */
  parentTaskId: string;

  /** Overall status of the aggregated work */
  overallState: InProgressTaskStatus;

  /** Summary written by Team Leader */
  summary: string;

  /** Per-worker task breakdown */
  subtaskSummary: {
    total: number;
    completed: number;
    failed: number;
    inProgress: number;
    blocked: number;
  };

  /** Key artifacts curated by Team Leader */
  keyArtifacts?: TaskArtifact[];

  /** Issues requiring Orchestrator attention */
  escalations?: string[];

  /** Team Leader's assessment of quality */
  qualityAssessment?: 'pass' | 'partial' | 'fail';

  /** Session name of the reporting Team Leader */
  reportedBy: string;

  /** ISO timestamp of the report */
  timestamp: string;
}

/**
 * A stored worker report awaiting aggregation.
 */
export interface StoredWorkerReport {
  /** The original status report */
  report: StatusReport;

  /** ISO timestamp when received */
  receivedAt: string;

  /** Session name of the worker */
  workerSession: string;
}

// =============================================================================
// Service
// =============================================================================

/**
 * HierarchyReportingService manages the upward reporting chain.
 * Singleton pattern matching other Crewly services.
 */
export class HierarchyReportingService {
  private static instance: HierarchyReportingService | null = null;

  /** Stored worker reports indexed by parentTaskId */
  private workerReports: Map<string, StoredWorkerReport[]> = new Map();

  /** Event bus reference for emitting hierarchy events */
  private eventBus: EventBusService | null = null;

  private constructor() {}

  /**
   * Get the singleton instance of HierarchyReportingService.
   *
   * @returns The singleton instance
   */
  static getInstance(): HierarchyReportingService {
    if (!HierarchyReportingService.instance) {
      HierarchyReportingService.instance = new HierarchyReportingService();
    }
    return HierarchyReportingService.instance;
  }

  /**
   * Clear the singleton instance (for testing).
   */
  static clearInstance(): void {
    HierarchyReportingService.instance = null;
  }

  /**
   * Set the EventBusService reference for emitting events.
   *
   * @param eventBus - The EventBusService instance
   */
  setEventBus(eventBus: EventBusService): void {
    this.eventBus = eventBus;
  }

  /**
   * Receive a worker's status report and store it for aggregation.
   * Called when a Worker sends a StatusReport to their Team Leader.
   *
   * @param report - The worker's status report
   * @param workerSession - Session name of the reporting worker
   * @param parentTaskId - The parent task ID this report belongs to
   * @returns The stored report entry
   */
  receiveWorkerReport(
    report: StatusReport,
    workerSession: string,
    parentTaskId: string
  ): StoredWorkerReport {
    const entry: StoredWorkerReport = {
      report,
      receivedAt: new Date().toISOString(),
      workerSession,
    };

    const existing = this.workerReports.get(parentTaskId) ?? [];
    existing.push(entry);
    this.workerReports.set(parentTaskId, existing);

    return entry;
  }

  /**
   * Aggregate all stored worker reports for a parent task and generate
   * an AggregatedReport for the Orchestrator.
   *
   * @param parentTaskId - The parent task to aggregate reports for
   * @param subtasks - All subtasks under this parent task
   * @param tlSummary - Team Leader's summary of the aggregated work
   * @param tlSession - Team Leader's session name
   * @param teamInfo - Team and member info for event emission
   * @returns The aggregated report, or null if no reports exist
   */
  aggregateAndReportUp(
    parentTaskId: string,
    subtasks: InProgressTask[],
    tlSummary: string,
    tlSession: string,
    teamInfo?: { teamId: string; teamName: string; memberId: string; memberName: string }
  ): AggregatedReport | null {
    const report = this.generateAggregatedReport(
      parentTaskId,
      subtasks,
      tlSummary,
      tlSession
    );

    if (!report) {
      return null;
    }

    // Emit hierarchy:report_up event
    if (this.eventBus && teamInfo) {
      const event: AgentEvent = {
        id: crypto.randomUUID(),
        type: 'hierarchy:report_up',
        timestamp: new Date().toISOString(),
        teamId: teamInfo.teamId,
        teamName: teamInfo.teamName,
        memberId: teamInfo.memberId,
        memberName: teamInfo.memberName,
        sessionName: tlSession,
        previousValue: '',
        newValue: report.overallState,
        changedField: 'hierarchyAction',
        taskId: parentTaskId,
      };
      this.eventBus.publish(event);
    }

    // Clean up stored reports after aggregation
    this.workerReports.delete(parentTaskId);

    return report;
  }

  /**
   * Generate an AggregatedReport from subtask data.
   * Computes the overall state, subtask summary, and collects key artifacts.
   *
   * @param parentTaskId - The parent task ID
   * @param subtasks - All subtasks under this parent task
   * @param tlSummary - Team Leader's written summary
   * @param tlSession - Team Leader's session name
   * @returns The aggregated report, or null if no subtasks
   */
  generateAggregatedReport(
    parentTaskId: string,
    subtasks: InProgressTask[],
    tlSummary: string,
    tlSession: string
  ): AggregatedReport | null {
    if (subtasks.length === 0) {
      return null;
    }

    const summary = this.computeSubtaskSummary(subtasks);
    const overallState = this.computeOverallState(summary);
    const keyArtifacts = this.collectKeyArtifacts(subtasks);
    const qualityAssessment = this.assessQuality(summary);

    return {
      type: 'aggregated_report',
      parentTaskId,
      overallState,
      summary: tlSummary,
      subtaskSummary: summary,
      ...(keyArtifacts.length > 0 ? { keyArtifacts } : {}),
      qualityAssessment,
      reportedBy: tlSession,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get stored worker reports for a parent task.
   *
   * @param parentTaskId - The parent task ID
   * @returns Array of stored worker reports
   */
  getWorkerReports(parentTaskId: string): StoredWorkerReport[] {
    return this.workerReports.get(parentTaskId) ?? [];
  }

  /**
   * Clear all stored reports (for cleanup/testing).
   */
  clearReports(): void {
    this.workerReports.clear();
  }

  /**
   * Serialize an AggregatedReport to markdown for PTY delivery.
   *
   * @param report - The aggregated report to serialize
   * @returns Markdown-formatted string with [AGGREGATED REPORT] header
   */
  serializeAggregatedReport(report: AggregatedReport): string {
    const lines: string[] = [
      '---',
      '[AGGREGATED REPORT]',
      `Parent Task: ${report.parentTaskId}`,
      `Overall Status: ${report.overallState}`,
      ...(report.qualityAssessment ? [`Quality: ${report.qualityAssessment}`] : []),
      `Reported by: ${report.reportedBy}`,
      '---',
      '',
      '## Summary',
      report.summary,
      '',
      '## Subtask Breakdown',
      `- Total: ${report.subtaskSummary.total} | Completed: ${report.subtaskSummary.completed} | Failed: ${report.subtaskSummary.failed} | In Progress: ${report.subtaskSummary.inProgress} | Blocked: ${report.subtaskSummary.blocked}`,
    ];

    if (report.keyArtifacts && report.keyArtifacts.length > 0) {
      lines.push('', '## Key Deliverables');
      for (const artifact of report.keyArtifacts) {
        lines.push(`- ${artifact.content} (${artifact.type})`);
      }
    }

    if (report.escalations && report.escalations.length > 0) {
      lines.push('', '## Escalations');
      for (const esc of report.escalations) {
        lines.push(`- ${esc}`);
      }
    }

    return lines.join('\n');
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  /**
   * Compute the subtask summary counts from task list.
   */
  private computeSubtaskSummary(subtasks: InProgressTask[]): AggregatedReport['subtaskSummary'] {
    let completed = 0;
    let failed = 0;
    let inProgress = 0;
    let blocked = 0;

    for (const task of subtasks) {
      switch (task.status) {
        case 'completed':
          completed++;
          break;
        case 'failed':
        case 'cancelled':
          failed++;
          break;
        case 'blocked':
        case 'input_required':
          blocked++;
          break;
        case 'active':
        case 'working':
        case 'assigned':
        case 'submitted':
        case 'verifying':
          inProgress++;
          break;
        default:
          inProgress++;
          break;
      }
    }

    return {
      total: subtasks.length,
      completed,
      failed,
      inProgress,
      blocked,
    };
  }

  /**
   * Determine the overall state from subtask summary.
   */
  private computeOverallState(summary: AggregatedReport['subtaskSummary']): InProgressTaskStatus {
    if (summary.total === 0) return 'pending_assignment';
    if (summary.completed === summary.total) return 'completed';
    if (summary.failed > 0 && summary.inProgress === 0 && summary.completed + summary.failed === summary.total) return 'failed';
    if (summary.blocked > 0 && summary.inProgress === 0) return 'blocked';
    return 'working';
  }

  /**
   * Collect key artifacts from completed subtasks.
   */
  private collectKeyArtifacts(subtasks: InProgressTask[]): TaskArtifact[] {
    const artifacts: TaskArtifact[] = [];
    for (const task of subtasks) {
      if (task.artifacts) {
        artifacts.push(...task.artifacts);
      }
    }
    return artifacts;
  }

  /**
   * Assess overall quality from subtask completion rates.
   */
  private assessQuality(summary: AggregatedReport['subtaskSummary']): 'pass' | 'partial' | 'fail' {
    if (summary.total === 0) return 'fail';
    if (summary.completed === summary.total) return 'pass';
    if (summary.failed === summary.total) return 'fail';
    return 'partial';
  }
}
