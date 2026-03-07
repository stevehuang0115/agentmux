/**
 * Tests for Hierarchy Reporting Service
 *
 * Covers:
 * - Worker report ingestion
 * - Aggregated report generation
 * - Subtask summary computation
 * - Overall state determination
 * - Quality assessment
 * - Markdown serialization
 * - Event emission on report_up
 *
 * @module services/hierarchy/hierarchy-reporting.test
 */

import { HierarchyReportingService } from './hierarchy-reporting.service.js';
import type { AggregatedReport, StoredWorkerReport } from './hierarchy-reporting.service.js';
import type { StatusReport } from '../../types/hierarchy-message.types.js';
import type { InProgressTask } from '../../types/task-tracking.types.js';

// Mock EventBusService
const mockPublish = jest.fn();
const mockEventBus = {
  publish: mockPublish,
} as any;

/**
 * Create a minimal InProgressTask for testing.
 */
function createTestTask(overrides?: Partial<InProgressTask>): InProgressTask {
  return {
    id: 'task-1',
    projectId: 'proj-1',
    teamId: 'team-1',
    taskFilePath: '/path/to/task.md',
    taskName: 'Test task',
    targetRole: 'developer',
    assignedTeamMemberId: 'member-1',
    assignedSessionName: 'dev-session-1',
    assignedAt: '2026-03-06T10:00:00.000Z',
    status: 'completed',
    ...overrides,
  };
}

/**
 * Create a minimal StatusReport for testing.
 */
function createTestStatusReport(overrides?: Partial<StatusReport>): StatusReport {
  return {
    type: 'status_report',
    taskId: 'task-1',
    state: 'completed',
    message: 'Task done',
    reportedBy: 'dev-session-1',
    ...overrides,
  };
}

describe('HierarchyReportingService', () => {
  let service: HierarchyReportingService;

  beforeEach(() => {
    HierarchyReportingService.clearInstance();
    service = HierarchyReportingService.getInstance();
    service.setEventBus(mockEventBus);
    mockPublish.mockClear();
  });

  afterEach(() => {
    service.clearReports();
    HierarchyReportingService.clearInstance();
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const a = HierarchyReportingService.getInstance();
      const b = HierarchyReportingService.getInstance();
      expect(a).toBe(b);
    });

    it('should return new instance after clearInstance', () => {
      const a = HierarchyReportingService.getInstance();
      HierarchyReportingService.clearInstance();
      const b = HierarchyReportingService.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe('receiveWorkerReport', () => {
    it('should store a worker report', () => {
      const report = createTestStatusReport();
      const entry = service.receiveWorkerReport(report, 'worker-1', 'parent-task-1');

      expect(entry.report).toBe(report);
      expect(entry.workerSession).toBe('worker-1');
      expect(entry.receivedAt).toBeDefined();
    });

    it('should accumulate multiple reports under the same parent', () => {
      service.receiveWorkerReport(createTestStatusReport({ taskId: 't1' }), 'worker-1', 'parent-1');
      service.receiveWorkerReport(createTestStatusReport({ taskId: 't2' }), 'worker-2', 'parent-1');

      const reports = service.getWorkerReports('parent-1');
      expect(reports).toHaveLength(2);
    });

    it('should store reports under different parent tasks separately', () => {
      service.receiveWorkerReport(createTestStatusReport(), 'worker-1', 'parent-1');
      service.receiveWorkerReport(createTestStatusReport(), 'worker-2', 'parent-2');

      expect(service.getWorkerReports('parent-1')).toHaveLength(1);
      expect(service.getWorkerReports('parent-2')).toHaveLength(1);
    });
  });

  describe('generateAggregatedReport', () => {
    it('should return null for empty subtasks', () => {
      const report = service.generateAggregatedReport('parent-1', [], 'Summary', 'tl-session');
      expect(report).toBeNull();
    });

    it('should compute correct summary for all-completed subtasks', () => {
      const subtasks = [
        createTestTask({ id: 't1', status: 'completed' }),
        createTestTask({ id: 't2', status: 'completed' }),
        createTestTask({ id: 't3', status: 'completed' }),
      ];

      const report = service.generateAggregatedReport('parent-1', subtasks, 'All done', 'tl-1');
      expect(report).not.toBeNull();
      expect(report!.overallState).toBe('completed');
      expect(report!.subtaskSummary.total).toBe(3);
      expect(report!.subtaskSummary.completed).toBe(3);
      expect(report!.subtaskSummary.failed).toBe(0);
      expect(report!.subtaskSummary.inProgress).toBe(0);
      expect(report!.subtaskSummary.blocked).toBe(0);
      expect(report!.qualityAssessment).toBe('pass');
    });

    it('should detect mixed state as working', () => {
      const subtasks = [
        createTestTask({ id: 't1', status: 'completed' }),
        createTestTask({ id: 't2', status: 'working' }),
        createTestTask({ id: 't3', status: 'assigned' }),
      ];

      const report = service.generateAggregatedReport('parent-1', subtasks, 'In progress', 'tl-1');
      expect(report!.overallState).toBe('working');
      expect(report!.subtaskSummary.completed).toBe(1);
      expect(report!.subtaskSummary.inProgress).toBe(2);
      expect(report!.qualityAssessment).toBe('partial');
    });

    it('should detect all-failed state', () => {
      const subtasks = [
        createTestTask({ id: 't1', status: 'failed' }),
        createTestTask({ id: 't2', status: 'cancelled' }),
      ];

      const report = service.generateAggregatedReport('parent-1', subtasks, 'Failed', 'tl-1');
      expect(report!.overallState).toBe('failed');
      expect(report!.subtaskSummary.failed).toBe(2);
      expect(report!.qualityAssessment).toBe('fail');
    });

    it('should detect blocked state when all remaining tasks are blocked', () => {
      const subtasks = [
        createTestTask({ id: 't1', status: 'completed' }),
        createTestTask({ id: 't2', status: 'blocked' }),
        createTestTask({ id: 't3', status: 'input_required' }),
      ];

      const report = service.generateAggregatedReport('parent-1', subtasks, 'Blocked', 'tl-1');
      expect(report!.overallState).toBe('blocked');
      expect(report!.subtaskSummary.blocked).toBe(2);
    });

    it('should collect artifacts from completed subtasks', () => {
      const subtasks = [
        createTestTask({
          id: 't1',
          status: 'completed',
          artifacts: [
            { id: 'a1', name: 'LoginForm.tsx', type: 'file', content: 'src/LoginForm.tsx', createdAt: '2026-03-06' },
          ],
        }),
        createTestTask({
          id: 't2',
          status: 'completed',
          artifacts: [
            { id: 'a2', name: 'auth.ts', type: 'file', content: 'src/auth.ts', createdAt: '2026-03-06' },
          ],
        }),
      ];

      const report = service.generateAggregatedReport('parent-1', subtasks, 'Done', 'tl-1');
      expect(report!.keyArtifacts).toHaveLength(2);
      expect(report!.keyArtifacts![0].name).toBe('LoginForm.tsx');
      expect(report!.keyArtifacts![1].name).toBe('auth.ts');
    });

    it('should omit keyArtifacts when none exist', () => {
      const subtasks = [createTestTask({ id: 't1', status: 'completed' })];
      const report = service.generateAggregatedReport('parent-1', subtasks, 'Done', 'tl-1');
      expect(report!.keyArtifacts).toBeUndefined();
    });
  });

  describe('aggregateAndReportUp', () => {
    it('should generate report and emit hierarchy:report_up event', () => {
      const subtasks = [createTestTask({ id: 't1', status: 'completed' })];
      const teamInfo = { teamId: 'team-1', teamName: 'FE Team', memberId: 'tl-member-1', memberName: 'TL-Joe' };

      const report = service.aggregateAndReportUp('parent-1', subtasks, 'All done', 'tl-session', teamInfo);

      expect(report).not.toBeNull();
      expect(report!.overallState).toBe('completed');

      expect(mockPublish).toHaveBeenCalledTimes(1);
      const publishedEvent = mockPublish.mock.calls[0][0];
      expect(publishedEvent.type).toBe('hierarchy:report_up');
      expect(publishedEvent.taskId).toBe('parent-1');
      expect(publishedEvent.sessionName).toBe('tl-session');
    });

    it('should return null and skip event when no subtasks', () => {
      const report = service.aggregateAndReportUp('parent-1', [], 'Empty', 'tl-session');
      expect(report).toBeNull();
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it('should clean up stored worker reports after aggregation', () => {
      service.receiveWorkerReport(createTestStatusReport(), 'worker-1', 'parent-1');
      expect(service.getWorkerReports('parent-1')).toHaveLength(1);

      service.aggregateAndReportUp(
        'parent-1',
        [createTestTask()],
        'Done',
        'tl-session',
        { teamId: 'team-1', teamName: 'FE', memberId: 'm1', memberName: 'TL' }
      );

      expect(service.getWorkerReports('parent-1')).toHaveLength(0);
    });
  });

  describe('serializeAggregatedReport', () => {
    it('should serialize to markdown with [AGGREGATED REPORT] header', () => {
      const report: AggregatedReport = {
        type: 'aggregated_report',
        parentTaskId: 'task-fe-001',
        overallState: 'completed',
        summary: 'All frontend tasks completed successfully.',
        subtaskSummary: { total: 3, completed: 3, failed: 0, inProgress: 0, blocked: 0 },
        keyArtifacts: [
          { id: 'a1', name: 'LoginForm.tsx', type: 'file', content: 'src/LoginForm.tsx', createdAt: '2026-03-06' },
        ],
        qualityAssessment: 'pass',
        reportedBy: 'tl-session-1',
        timestamp: '2026-03-06T15:00:00.000Z',
      };

      const md = service.serializeAggregatedReport(report);

      expect(md).toContain('[AGGREGATED REPORT]');
      expect(md).toContain('Parent Task: task-fe-001');
      expect(md).toContain('Overall Status: completed');
      expect(md).toContain('Quality: pass');
      expect(md).toContain('Reported by: tl-session-1');
      expect(md).toContain('## Summary');
      expect(md).toContain('All frontend tasks completed successfully.');
      expect(md).toContain('## Subtask Breakdown');
      expect(md).toContain('Total: 3');
      expect(md).toContain('## Key Deliverables');
      expect(md).toContain('src/LoginForm.tsx (file)');
    });

    it('should omit optional sections when empty', () => {
      const report: AggregatedReport = {
        type: 'aggregated_report',
        parentTaskId: 'task-1',
        overallState: 'working',
        summary: 'In progress',
        subtaskSummary: { total: 1, completed: 0, failed: 0, inProgress: 1, blocked: 0 },
        reportedBy: 'tl-1',
        timestamp: '2026-03-06T15:00:00.000Z',
      };

      const md = service.serializeAggregatedReport(report);

      expect(md).not.toContain('## Key Deliverables');
      expect(md).not.toContain('## Escalations');
      expect(md).not.toContain('Quality:');
    });

    it('should include escalations when present', () => {
      const report: AggregatedReport = {
        type: 'aggregated_report',
        parentTaskId: 'task-1',
        overallState: 'blocked',
        summary: 'Blocked by dependency',
        subtaskSummary: { total: 2, completed: 1, failed: 0, inProgress: 0, blocked: 1 },
        escalations: ['Worker dev-2 is blocked waiting for API spec'],
        qualityAssessment: 'partial',
        reportedBy: 'tl-1',
        timestamp: '2026-03-06T15:00:00.000Z',
      };

      const md = service.serializeAggregatedReport(report);

      expect(md).toContain('## Escalations');
      expect(md).toContain('Worker dev-2 is blocked waiting for API spec');
    });
  });
});
