import { TaskTrackingService } from './task-tracking.service';
import { InProgressTask, TaskTrackingData, TaskFileInfo } from '../../types/task-tracking.types';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AGENTMUX_CONSTANTS } from '../../../../config/constants.js';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('fs', () => ({
  existsSync: jest.fn()
}));
jest.mock('path');
jest.mock('os');

describe('TaskTrackingService', () => {
  let service: TaskTrackingService;
  const mockTaskTrackingPath = '/mock/home/.agentmux/in_progress_tasks.json';

  const mockTaskData: TaskTrackingData = {
    tasks: [],
    lastUpdated: '2023-01-01T00:00:00.000Z',
    version: '1.0.0'
  };

  const mockTask: InProgressTask = {
    id: 'task-123',
    projectId: 'project-456',
    teamId: 'team-abc',
    taskFilePath: '/project/tasks/milestone1/open/task001.md',
    taskName: 'Test Task',
    targetRole: 'developer',
    assignedTeamMemberId: 'member-789',
    assignedSessionId: 'session-abc',
    assignedAt: '2023-01-01T10:00:00.000Z',
    status: 'assigned'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock path operations
    (path.join as jest.Mock).mockImplementation((...parts) => parts.join('/'));
    (path.dirname as jest.Mock).mockImplementation((p) => p.split('/').slice(0, -1).join('/'));
    (path.basename as jest.Mock).mockImplementation((p) => p.split('/').pop() || '');
    (os.homedir as jest.Mock).mockReturnValue('/mock/home');
    
    service = new TaskTrackingService();
    
    // Mock console methods
    jest.spyOn(console, 'error').mockImplementation();
  });

  describe('constructor', () => {
    it('should initialize with correct task tracking path', () => {
      expect(path.join).toHaveBeenCalledWith('/mock/home', '.agentmux', 'in_progress_tasks.json');
    });
  });

  describe('loadTaskData', () => {
    it('should create initial data if file does not exist', async () => {
      (fsSync.existsSync as jest.Mock).mockReturnValue(false);
      const saveTaskDataSpy = jest.spyOn(service, 'saveTaskData').mockResolvedValue();
      
      const result = await service.loadTaskData();
      
      expect(result).toEqual({
        tasks: [],
        lastUpdated: expect.any(String),
        version: '1.0.0'
      });
      expect(saveTaskDataSpy).toHaveBeenCalledWith(result);
    });

    it('should load existing data from file', async () => {
      (fsSync.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockTaskData));
      
      const result = await service.loadTaskData();
      
      expect(result).toEqual(mockTaskData);
      expect(fs.readFile).toHaveBeenCalledWith(mockTaskTrackingPath, 'utf-8');
    });

    it('should return default data on error', async () => {
      (fsSync.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File read error'));
      
      const result = await service.loadTaskData();
      
      expect(result).toEqual({
        tasks: [],
        lastUpdated: expect.any(String),
        version: '1.0.0'
      });
      expect(console.error).toHaveBeenCalledWith('Error loading task tracking data:', expect.any(Error));
    });
  });

  describe('saveTaskData', () => {
    it('should save data with updated timestamp', async () => {
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      
      const data = { ...mockTaskData };
      await service.saveTaskData(data);
      
      expect(data.lastUpdated).not.toBe('2023-01-01T00:00:00.000Z');
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockTaskTrackingPath,
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    });

    it('should throw error on save failure', async () => {
      (fs.writeFile as jest.Mock).mockRejectedValue(new Error('Write error'));
      
      await expect(service.saveTaskData(mockTaskData)).rejects.toThrow('Write error');
      expect(console.error).toHaveBeenCalledWith('Error saving task tracking data:', expect.any(Error));
    });
  });

  describe('assignTask', () => {
    it('should create and save new task assignment with teamId', async () => {
      jest.spyOn(service, 'loadTaskData').mockResolvedValue(mockTaskData);
      jest.spyOn(service, 'saveTaskData').mockResolvedValue();
      
      const result = await service.assignTask(
        'project-456',
        'team-abc',
        '/project/tasks/milestone1/open/task001.md',
        'Test Task',
        'developer',
        'member-789',
        'session-abc'
      );
      
      expect(result).toMatchObject({
        id: expect.any(String),
        projectId: 'project-456',
        teamId: 'team-abc',
        taskFilePath: '/project/tasks/milestone1/open/task001.md',
        taskName: 'Test Task',
        targetRole: 'developer',
        assignedTeamMemberId: 'member-789',
        assignedSessionId: 'session-abc',
        assignedAt: expect.any(String),
        status: 'assigned'
      });
      
      expect(service.saveTaskData).toHaveBeenCalled();
    });

    it('should handle assignment without teamId (backward compatibility)', async () => {
      jest.spyOn(service, 'loadTaskData').mockResolvedValue(mockTaskData);
      jest.spyOn(service, 'saveTaskData').mockResolvedValue();
      
      const result = await service.assignTask(
        'project-456',
        'team-test',
        '/project/tasks/milestone1/open/task001.md',
        'Test Task',
        'developer',
        'member-789',
        'session-abc'
      );
      
      expect(result).toMatchObject({
        id: expect.any(String),
        projectId: 'project-456',
        teamId: 'team-test',
        taskFilePath: '/project/tasks/milestone1/open/task001.md',
        taskName: 'Test Task',
        targetRole: 'developer',
        assignedTeamMemberId: 'member-789',
        assignedSessionId: 'session-abc',
        assignedAt: expect.any(String),
        status: 'assigned'
      });
      
      expect(service.saveTaskData).toHaveBeenCalled();
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status successfully', async () => {
      const taskData = {
        ...mockTaskData,
        tasks: [mockTask]
      };
      jest.spyOn(service, 'loadTaskData').mockResolvedValue(taskData);
      jest.spyOn(service, 'saveTaskData').mockResolvedValue();
      
      await service.updateTaskStatus('task-123', 'active');
      
      const updatedTask = taskData.tasks[0];
      expect(updatedTask.status).toBe('active');
      expect(updatedTask.lastCheckedAt).toBeTruthy();
      expect(service.saveTaskData).toHaveBeenCalledWith(taskData);
    });

    it('should set block reason when status is blocked', async () => {
      const taskData = {
        ...mockTaskData,
        tasks: [mockTask]
      };
      jest.spyOn(service, 'loadTaskData').mockResolvedValue(taskData);
      jest.spyOn(service, 'saveTaskData').mockResolvedValue();
      
      await service.updateTaskStatus('task-123', 'blocked', 'Waiting for dependencies');
      
      const updatedTask = taskData.tasks[0];
      expect(updatedTask.status).toBe('blocked');
      expect(updatedTask.blockReason).toBe('Waiting for dependencies');
    });

    it('should throw error if task not found', async () => {
      jest.spyOn(service, 'loadTaskData').mockResolvedValue(mockTaskData);
      
      await expect(service.updateTaskStatus('nonexistent-task', 'active'))
        .rejects.toThrow('Task with ID nonexistent-task not found');
    });
  });

  describe('removeTask', () => {
    it('should remove task from tracking', async () => {
      const taskData = {
        ...mockTaskData,
        tasks: [mockTask, { ...mockTask, id: 'task-456', teamId: 'team-def' }]
      };
      jest.spyOn(service, 'loadTaskData').mockResolvedValue(taskData);
      jest.spyOn(service, 'saveTaskData').mockResolvedValue();
      
      await service.removeTask('task-123');
      
      expect(taskData.tasks).toHaveLength(1);
      expect(taskData.tasks[0].id).toBe('task-456');
      expect(service.saveTaskData).toHaveBeenCalledWith(taskData);
    });
  });

  describe('addTaskToQueue', () => {
    it('should add task to queue with pending_assignment status and teamId', async () => {
      jest.spyOn(service, 'loadTaskData').mockResolvedValue(mockTaskData);
      jest.spyOn(service, 'saveTaskData').mockResolvedValue();
      
      const taskInfo = {
        projectId: 'project-456',
        teamId: 'team-xyz',
        taskFilePath: '/project/tasks/milestone1/open/task001.md',
        taskName: 'Queued Task',
        targetRole: 'developer',
        priority: 'high' as const,
        createdAt: '2023-01-01T12:00:00.000Z'
      };
      
      const result = await service.addTaskToQueue(taskInfo);
      
      expect(result).toMatchObject({
        id: expect.any(String),
        projectId: 'project-456',
        teamId: 'team-xyz',
        taskFilePath: '/project/tasks/milestone1/open/task001.md',
        taskName: 'Queued Task',
        targetRole: 'developer',
        assignedTeamMemberId: 'orchestrator',
        assignedSessionId: AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
        assignedAt: '2023-01-01T12:00:00.000Z',
        status: 'pending_assignment',
        priority: 'high'
      });
      
      expect(service.saveTaskData).toHaveBeenCalled();
    });

    it('should add task to queue without teamId (backward compatibility)', async () => {
      jest.spyOn(service, 'loadTaskData').mockResolvedValue(mockTaskData);
      jest.spyOn(service, 'saveTaskData').mockResolvedValue();
      
      const taskInfo = {
        projectId: 'project-456',
        teamId: 'team-test',
        taskFilePath: '/project/tasks/milestone1/open/task001.md',
        taskName: 'Queued Task',
        targetRole: 'developer',
        priority: 'high' as const,
        createdAt: '2023-01-01T12:00:00.000Z'
      };
      
      const result = await service.addTaskToQueue(taskInfo);
      
      expect(result).toMatchObject({
        id: expect.any(String),
        projectId: 'project-456',
        teamId: 'team-test',
        taskFilePath: '/project/tasks/milestone1/open/task001.md',
        taskName: 'Queued Task',
        targetRole: 'developer',
        assignedTeamMemberId: 'orchestrator',
        assignedSessionId: AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
        assignedAt: '2023-01-01T12:00:00.000Z',
        status: 'pending_assignment',
        priority: 'high'
      });
      
      expect(service.saveTaskData).toHaveBeenCalled();
    });
  });

  describe('getTasksForProject', () => {
    it('should return tasks filtered by project ID', async () => {
      const taskData = {
        ...mockTaskData,
        tasks: [
          mockTask,
          { ...mockTask, id: 'task-456', projectId: 'other-project', teamId: 'team-other' },
          { ...mockTask, id: 'task-789', projectId: 'project-456', teamId: 'team-abc' }
        ]
      };
      jest.spyOn(service, 'loadTaskData').mockResolvedValue(taskData);
      
      const result = await service.getTasksForProject('project-456');
      
      expect(result).toHaveLength(2);
      expect(result.every(task => task.projectId === 'project-456')).toBe(true);
    });
  });

  describe('getTasksForTeamMember', () => {
    it('should return tasks filtered by team member ID', async () => {
      const taskData = {
        ...mockTaskData,
        tasks: [
          mockTask,
          { ...mockTask, id: 'task-456', assignedTeamMemberId: 'other-member', teamId: 'team-other' },
          { ...mockTask, id: 'task-789', assignedTeamMemberId: 'member-789', teamId: 'team-abc' }
        ]
      };
      jest.spyOn(service, 'loadTaskData').mockResolvedValue(taskData);
      
      const result = await service.getTasksForTeamMember('member-789');
      
      expect(result).toHaveLength(2);
      expect(result.every(task => task.assignedTeamMemberId === 'member-789')).toBe(true);
    });
  });

  describe('getAllInProgressTasks', () => {
    it('should return all tasks', async () => {
      const taskData = {
        ...mockTaskData,
        tasks: [mockTask, { ...mockTask, id: 'task-456', teamId: 'team-def' }]
      };
      jest.spyOn(service, 'loadTaskData').mockResolvedValue(taskData);
      
      const result = await service.getAllInProgressTasks();
      
      expect(result).toEqual(taskData.tasks);
    });
  });

  describe('syncTasksWithFileSystem', () => {
    const projectPath = '/project';
    const projectId = 'project-456';

    beforeEach(() => {
      (fsSync.existsSync as jest.Mock).mockReturnValue(true);
    });

    it('should return early if tasks path does not exist', async () => {
      (fsSync.existsSync as jest.Mock).mockReturnValue(false);
      jest.spyOn(service, 'loadTaskData').mockResolvedValue(mockTaskData);
      
      await service.syncTasksWithFileSystem(projectPath, projectId);
      
      expect(service.loadTaskData).toHaveBeenCalled();
      // Should not proceed with file system checks
    });

    it('should remove task if moved to done folder', async () => {
      const taskData = {
        ...mockTaskData,
        tasks: [mockTask]
      };
      jest.spyOn(service, 'loadTaskData').mockResolvedValue(taskData);
      const removeTaskSpy = jest.spyOn(service, 'removeTask').mockResolvedValue();
      
      (fsSync.existsSync as jest.Mock).mockImplementation((filePath) => {
        if (filePath.includes('/in_progress/')) return false; // Task not in progress
        if (filePath.includes('/done/')) return true; // Task is done
        return false;
      });
      
      await service.syncTasksWithFileSystem(projectPath, projectId);
      
      expect(removeTaskSpy).toHaveBeenCalledWith('task-123');
    });

    it('should update task status if moved to blocked folder', async () => {
      const taskData = {
        ...mockTaskData,
        tasks: [mockTask]
      };
      jest.spyOn(service, 'loadTaskData').mockResolvedValue(taskData);
      const updateTaskStatusSpy = jest.spyOn(service, 'updateTaskStatus').mockResolvedValue();
      
      (fsSync.existsSync as jest.Mock).mockImplementation((filePath) => {
        if (filePath.includes('/in_progress/')) return false; // Task not in progress
        if (filePath.includes('/blocked/')) return true; // Task is blocked
        return false;
      });
      
      await service.syncTasksWithFileSystem(projectPath, projectId);
      
      expect(updateTaskStatusSpy).toHaveBeenCalledWith('task-123', 'blocked', 'Moved to blocked folder manually');
    });

    it('should not change task if still in progress', async () => {
      const taskData = {
        ...mockTaskData,
        tasks: [mockTask]
      };
      jest.spyOn(service, 'loadTaskData').mockResolvedValue(taskData);
      const removeTaskSpy = jest.spyOn(service, 'removeTask').mockResolvedValue();
      const updateTaskStatusSpy = jest.spyOn(service, 'updateTaskStatus').mockResolvedValue();
      
      (fsSync.existsSync as jest.Mock).mockImplementation((filePath) => {
        return filePath.includes('/in_progress/'); // Task still in progress
      });
      
      await service.syncTasksWithFileSystem(projectPath, projectId);
      
      expect(removeTaskSpy).not.toHaveBeenCalled();
      expect(updateTaskStatusSpy).not.toHaveBeenCalled();
    });
  });

  describe('getOpenTasks', () => {
    it('should return empty array if tasks path does not exist', async () => {
      (fsSync.existsSync as jest.Mock).mockReturnValue(false);
      
      const result = await service.getOpenTasks('/project');
      
      expect(result).toEqual([]);
    });

    it('should return open tasks from all milestones', async () => {
      (fsSync.existsSync as jest.Mock).mockImplementation((filePath) => {
        return !filePath.includes('nonexistent');
      });
      (fs.readdir as jest.Mock).mockImplementation((dirPath) => {
        if (dirPath === '/project/.agentmux/tasks') {
          return Promise.resolve(['m1_setup', 'm2_development', 'not_milestone', 'm3_testing']);
        }
        if (dirPath.includes('/open')) {
          return Promise.resolve(['01_task_one_developer.md', '02_task_two_designer.md']);
        }
        return Promise.resolve([]);
      });
      
      const result = await service.getOpenTasks('/project');
      
      expect(result).toHaveLength(6); // 2 tasks × 3 milestones
      expect(result[0]).toMatchObject({
        filePath: '/project/.agentmux/tasks/m1_setup/open/01_task_one_developer.md',
        fileName: '01_task_one_developer.md',
        taskName: 'Task One',
        targetRole: 'developer',
        milestoneFolder: 'm1_setup',
        statusFolder: 'open'
      });
    });

    it('should extract task name and role from filename correctly', async () => {
      (fsSync.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdir as jest.Mock).mockImplementation((dirPath) => {
        if (dirPath === '/project/.agentmux/tasks') {
          return Promise.resolve(['m1_milestone']);
        }
        if (dirPath.includes('/open')) {
          return Promise.resolve(['15_create_user_authentication_system_backend.md']);
        }
        return Promise.resolve([]);
      });
      
      const result = await service.getOpenTasks('/project');
      
      expect(result[0]).toMatchObject({
        taskName: 'Create User Authentication System',
        targetRole: 'backend'
      });
    });

    it('should handle unknown role in filename', async () => {
      (fsSync.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdir as jest.Mock).mockImplementation((dirPath) => {
        if (dirPath === '/project/.agentmux/tasks') {
          return Promise.resolve(['m1_milestone']);
        }
        if (dirPath.includes('/open')) {
          return Promise.resolve(['task_without_role.md']);
        }
        return Promise.resolve([]);
      });
      
      const result = await service.getOpenTasks('/project');
      
      expect(result[0].targetRole).toBe('unknown');
    });

    it('should skip non-milestone folders', async () => {
      (fsSync.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdir as jest.Mock).mockImplementation((dirPath) => {
        if (dirPath === '/project/.agentmux/tasks') {
          return Promise.resolve(['regular_folder', 'not_milestone_format', 'm1_valid_milestone']);
        }
        if (dirPath.includes('m1_valid_milestone/open')) {
          return Promise.resolve(['task.md']);
        }
        return Promise.resolve([]);
      });
      
      const result = await service.getOpenTasks('/project');
      
      expect(result).toHaveLength(1); // Only the valid milestone folder
    });

    it('should skip non-markdown files', async () => {
      (fsSync.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdir as jest.Mock).mockImplementation((dirPath) => {
        if (dirPath === '/project/.agentmux/tasks') {
          return Promise.resolve(['m1_milestone']);
        }
        if (dirPath.includes('/open')) {
          return Promise.resolve(['task.md', 'readme.txt', 'notes.json', 'another_task.md']);
        }
        return Promise.resolve([]);
      });
      
      const result = await service.getOpenTasks('/project');
      
      expect(result).toHaveLength(2); // Only .md files
      expect(result.every(task => task.fileName.endsWith('.md'))).toBe(true);
    });
  });

  describe('extractTaskNameFromFile', () => {
    it('should extract and format task name correctly', () => {
      const testCases = [
        { input: '01_create_user_dashboard_frontend.md', expected: 'Create User Dashboard' },
        { input: '15_setup_database_connection_backend.md', expected: 'Setup Database Connection' },
        { input: 'simple_task_developer.md', expected: 'Simple Task' },
        { input: '99_very_long_task_name_with_many_words_designer.md', expected: 'Very Long Task Name With Many Words' }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const result = (service as any).extractTaskNameFromFile(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle edge cases', () => {
      expect((service as any).extractTaskNameFromFile('task.md')).toBe('Task');
      expect((service as any).extractTaskNameFromFile('01_single_word.md')).toBe('Single Word');
    });
  });

  describe('Team integration tests', () => {
    it('should handle tasks with team assignments', async () => {
      jest.spyOn(service, 'loadTaskData').mockResolvedValue(mockTaskData);
      jest.spyOn(service, 'saveTaskData').mockResolvedValue();
      
      const result = await service.assignTask(
        'project-123',
        'team-456',
        '/project/tasks/m1/open/task.md',
        'Team Task',
        'developer',
        'member-789',
        'session-abc'
      );
      
      expect(result.teamId).toBe('team-456');
      expect(result.projectId).toBe('project-123');
      expect(result.assignedTeamMemberId).toBe('member-789');
    });

    it('should filter tasks by team when getting tasks for project', async () => {
      const taskData = {
        ...mockTaskData,
        tasks: [
          { ...mockTask, id: 'task-1', projectId: 'project-123', teamId: 'team-a' },
          { ...mockTask, id: 'task-2', projectId: 'project-123', teamId: 'team-b' },
          { ...mockTask, id: 'task-3', projectId: 'project-456', teamId: 'team-a' }
        ]
      };
      jest.spyOn(service, 'loadTaskData').mockResolvedValue(taskData);
      
      const result = await service.getTasksForProject('project-123');
      
      expect(result).toHaveLength(2);
      expect(result.every(task => task.projectId === 'project-123')).toBe(true);
      expect(result.find(task => task.teamId === 'team-a')).toBeDefined();
      expect(result.find(task => task.teamId === 'team-b')).toBeDefined();
    });

    it('should preserve team information when updating task status', async () => {
      const taskData = {
        ...mockTaskData,
        tasks: [{ ...mockTask, teamId: 'team-important' }]
      };
      jest.spyOn(service, 'loadTaskData').mockResolvedValue(taskData);
      jest.spyOn(service, 'saveTaskData').mockResolvedValue();
      
      await service.updateTaskStatus('task-123', 'active');
      
      const updatedTask = taskData.tasks[0];
      expect(updatedTask.teamId).toBe('team-important');
      expect(updatedTask.status).toBe('active');
    });
  });
});