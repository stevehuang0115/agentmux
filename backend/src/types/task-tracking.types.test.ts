import type {
  InProgressTask,
  TaskTrackingData,
  TaskStatus,
  TaskFileInfo,
  IterationRecord,
  ContinuationTrackingData,
  QualityGateStatus,
  QualityGates,
} from './task-tracking.types';
import { REQUIRED_QUALITY_GATES } from './task-tracking.types';

describe('Task Tracking Types', () => {
  describe('InProgressTask', () => {
    it('should accept a valid task with all required fields', () => {
      const task: InProgressTask = {
        id: 'task-123',
        projectId: 'project-456',
        teamId: 'team-abc',
        taskFilePath: '/project/.crewly/tasks/m1/open/task.md',
        taskName: 'Test Task',
        targetRole: 'developer',
        assignedTeamMemberId: 'member-789',
        assignedSessionName: 'session-abc',
        assignedAt: '2026-01-01T00:00:00.000Z',
        status: 'assigned',
      };

      expect(task.id).toBe('task-123');
      expect(task.status).toBe('assigned');
    });

    it('should accept optional monitoring fields', () => {
      const task: InProgressTask = {
        id: 'task-123',
        projectId: 'project-456',
        teamId: 'team-abc',
        taskFilePath: '/project/.crewly/tasks/m1/open/task.md',
        taskName: 'Test Task',
        targetRole: 'developer',
        assignedTeamMemberId: 'member-789',
        assignedSessionName: 'session-abc',
        assignedAt: '2026-01-01T00:00:00.000Z',
        status: 'assigned',
        scheduleIds: ['sched-1', 'sched-2'],
        subscriptionIds: ['sub-1'],
      };

      expect(task.scheduleIds).toEqual(['sched-1', 'sched-2']);
      expect(task.subscriptionIds).toEqual(['sub-1']);
    });

    it('should accept all valid status values', () => {
      const validStatuses: InProgressTask['status'][] = [
        'assigned', 'active', 'blocked', 'pending_assignment', 'completed',
      ];

      validStatuses.forEach(status => {
        const task: InProgressTask = {
          id: 'task-1',
          projectId: 'p',
          teamId: 't',
          taskFilePath: '/path',
          taskName: 'test',
          targetRole: 'dev',
          assignedTeamMemberId: 'm',
          assignedSessionName: 's',
          assignedAt: '2026-01-01',
          status,
        };
        expect(task.status).toBe(status);
      });
    });

    it('should accept optional priority field', () => {
      const priorities: Array<InProgressTask['priority']> = ['low', 'medium', 'high', undefined];

      priorities.forEach(priority => {
        const task: InProgressTask = {
          id: 'task-1',
          projectId: 'p',
          teamId: 't',
          taskFilePath: '/path',
          taskName: 'test',
          targetRole: 'dev',
          assignedTeamMemberId: 'm',
          assignedSessionName: 's',
          assignedAt: '2026-01-01',
          status: 'assigned',
          priority,
        };
        expect(task.priority).toBe(priority);
      });
    });
  });

  describe('TaskTrackingData', () => {
    it('should accept valid tracking data', () => {
      const data: TaskTrackingData = {
        tasks: [],
        lastUpdated: '2026-01-01T00:00:00.000Z',
        version: '1.0.0',
      };

      expect(data.tasks).toEqual([]);
      expect(data.version).toBe('1.0.0');
    });
  });

  describe('TaskFileInfo', () => {
    it('should accept all valid status folders', () => {
      const validFolders: TaskFileInfo['statusFolder'][] = ['open', 'in_progress', 'done', 'blocked'];

      validFolders.forEach(statusFolder => {
        const info: TaskFileInfo = {
          filePath: '/path/to/task.md',
          fileName: 'task.md',
          taskName: 'Test',
          targetRole: 'developer',
          milestoneFolder: 'm1_setup',
          statusFolder,
        };
        expect(info.statusFolder).toBe(statusFolder);
      });
    });
  });

  describe('REQUIRED_QUALITY_GATES', () => {
    it('should contain expected gates', () => {
      expect(REQUIRED_QUALITY_GATES).toContain('typecheck');
      expect(REQUIRED_QUALITY_GATES).toContain('tests');
      expect(REQUIRED_QUALITY_GATES).toContain('build');
    });

    it('should have exactly 3 required gates', () => {
      expect(REQUIRED_QUALITY_GATES).toHaveLength(3);
    });
  });
});
