import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inProgressTasksService, InProgressTask } from './in-progress-tasks.service';
import { apiService } from './api.service';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock apiService.getTeams
vi.mock('./api.service', () => ({
  apiService: {
    getTeams: vi.fn()
  }
}));

describe('InProgressTasksService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inProgressTasksService.clearCache();
  });

  const mockInProgressTasks: InProgressTask[] = [
    {
      id: 'task-1',
      taskPath: '/project/.crewly/tasks/m1/in_progress/01_setup_backend.md',
      taskName: '01_setup_backend',
      assignedSessionName: 'backend-dev-1',
      assignedMemberId: 'member-123',
      assignedAt: '2025-01-15T10:00:00Z',
      status: 'in_progress',
      originalPath: '/project/.crewly/tasks/m1/open/01_setup_backend.md'
    },
    {
      id: 'task-2',
      taskPath: '/project/.crewly/tasks/m1/in_progress/02_frontend_setup.md',
      taskName: '02_frontend_setup',
      assignedSessionName: 'frontend-dev-1',
      assignedMemberId: 'member-456',
      assignedAt: '2025-01-15T11:00:00Z',
      status: 'in_progress',
      originalPath: '/project/.crewly/tasks/m1/open/02_frontend_setup.md'
    }
  ];

  describe('getInProgressTasks', () => {
    it('should fetch and return in-progress tasks', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          tasks: mockInProgressTasks,
          lastUpdated: '2025-01-15T12:00:00Z',
          version: '1.0.0'
        })
      });

      const tasks = await inProgressTasksService.getInProgressTasks();

      expect(tasks).toEqual(mockInProgressTasks);
      expect(mockFetch).toHaveBeenCalledWith('/api/in-progress-tasks');
    });

    it('should return empty array when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      });

      const tasks = await inProgressTasksService.getInProgressTasks();

      expect(tasks).toEqual([]);
    });

    it('should use cached data within timeout period', async () => {
      // First call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          tasks: mockInProgressTasks,
          lastUpdated: '2025-01-15T12:00:00Z',
          version: '1.0.0'
        })
      });

      const tasks1 = await inProgressTasksService.getInProgressTasks();

      // Second call should use cache
      const tasks2 = await inProgressTasksService.getInProgressTasks();

      expect(tasks1).toEqual(mockInProgressTasks);
      expect(tasks2).toEqual(mockInProgressTasks);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTaskAssignedMember', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          tasks: mockInProgressTasks,
          lastUpdated: '2025-01-15T12:00:00Z',
          version: '1.0.0'
        })
      });
    });

    it('should find task by exact task path', async () => {
      const task = await inProgressTasksService.getTaskAssignedMember(
        '/project/.crewly/tasks/m1/in_progress/01_setup_backend.md'
      );

      expect(task).toEqual(mockInProgressTasks[0]);
    });

    it('should find task by original path', async () => {
      const task = await inProgressTasksService.getTaskAssignedMember(
        '/project/.crewly/tasks/m1/open/01_setup_backend.md'
      );

      expect(task).toEqual(mockInProgressTasks[0]);
    });

    it('should return null when task not found', async () => {
      const task = await inProgressTasksService.getTaskAssignedMember(
        '/project/.crewly/tasks/m1/open/non_existent_task.md'
      );

      expect(task).toBeNull();
    });
  });

  describe('getTaskAssignedMemberDetails', () => {
    const mockTeams = [
      {
        id: 'team-1',
        name: 'Backend Team',
        members: [
          {
            id: 'member-123',
            name: 'Alice Backend',
            sessionName: 'backend-dev-1'
          }
        ]
      },
      {
        id: 'team-2',
        name: 'Frontend Team',
        members: [
          {
            id: 'member-456',
            name: 'Bob Frontend',
            sessionName: 'frontend-dev-1'
          }
        ]
      }
    ];

    beforeEach(() => {
      // Mock in-progress tasks response
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          tasks: mockInProgressTasks,
          lastUpdated: '2025-01-15T12:00:00Z',
          version: '1.0.0'
        })
      });

      // Mock apiService.getTeams to return teams
      vi.mocked(apiService.getTeams).mockResolvedValue(mockTeams);
    });

    it('should return member details with team information', async () => {
      const details = await inProgressTasksService.getTaskAssignedMemberDetails(
        '/project/.crewly/tasks/m1/in_progress/01_setup_backend.md'
      );

      expect(details).toEqual({
        memberName: 'Alice Backend',
        sessionName: 'backend-dev-1',
        teamName: 'Backend Team'
      });
    });

    it('should return empty object when task not found', async () => {
      const details = await inProgressTasksService.getTaskAssignedMemberDetails(
        '/project/.crewly/tasks/m1/open/non_existent_task.md'
      );

      expect(details).toEqual({});
    });

    it('should handle teams API failure gracefully', async () => {
      // Mock apiService.getTeams to throw error
      vi.mocked(apiService.getTeams).mockRejectedValue(new Error('API Error'));

      const details = await inProgressTasksService.getTaskAssignedMemberDetails(
        '/project/.crewly/tasks/m1/in_progress/01_setup_backend.md'
      );

      // When teams API fails, the service catches the error and returns empty object
      expect(details).toEqual({});
    });

    it('should return sessionName when member not found in teams', async () => {
      // Mock empty teams array
      vi.mocked(apiService.getTeams).mockResolvedValue([]);

      const details = await inProgressTasksService.getTaskAssignedMemberDetails(
        '/project/.crewly/tasks/m1/in_progress/01_setup_backend.md'
      );

      // When member is not found, return sessionName from the task
      expect(details).toEqual({
        sessionName: 'backend-dev-1'
      });
    });
  });

  describe('clearCache', () => {
    it('should clear cached data', async () => {
      // First call to populate cache
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          tasks: mockInProgressTasks,
          lastUpdated: '2025-01-15T12:00:00Z',
          version: '1.0.0'
        })
      });

      await inProgressTasksService.getInProgressTasks();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Clear cache
      inProgressTasksService.clearCache();

      // Next call should fetch again
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          tasks: [],
          lastUpdated: '2025-01-15T13:00:00Z',
          version: '1.0.0'
        })
      });

      await inProgressTasksService.getInProgressTasks();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});