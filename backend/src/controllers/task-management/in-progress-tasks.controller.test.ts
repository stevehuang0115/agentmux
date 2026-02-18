import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import * as inProgressController from './in-progress-tasks.controller.js';
import { ApiController } from '../api.controller.js';

// Mock fs/promises
const mockReadFile = jest.fn<any>();
jest.mock('fs/promises', () => ({
  readFile: (...args: any[]) => mockReadFile(...args)
}));

// Mock fs existsSync
const mockExistsSync = jest.fn<any>();
jest.mock('fs', () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args)
}));

// Mock os
jest.mock('os', () => ({
  homedir: () => '/mock/home'
}));

describe('InProgressTasksController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonSpy: jest.Mock<any>;
  let statusSpy: jest.Mock<any>;
  let apiController: ApiController;

  beforeEach(() => {
    jest.clearAllMocks();

    jsonSpy = jest.fn<any>();
    statusSpy = jest.fn<any>(() => ({ json: jsonSpy }));

    mockReq = {};
    mockRes = {
      json: jsonSpy,
      status: statusSpy
    } as any;

    // Mock ApiController (we don't need actual implementation for this test)
    apiController = {} as ApiController;
  });

  describe('getInProgressTasks', () => {
    it('should return in-progress tasks when file exists', async () => {
      const mockTasksData = {
        tasks: [
          {
            id: 'task-1',
            taskPath: '/project/.agentmux/tasks/m1/in_progress/01_setup.md',
            taskName: '01_setup',
            assignedSessionName: 'dev-1',
            assignedMemberId: 'member-123',
            assignedAt: '2025-01-15T10:00:00Z',
            status: 'in_progress',
            originalPath: '/project/.agentmux/tasks/m1/open/01_setup.md'
          }
        ],
        lastUpdated: '2025-01-15T12:00:00Z',
        version: '1.0.0'
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(JSON.stringify(mockTasksData));

      await inProgressController.getInProgressTasks.call(
        apiController,
        mockReq as Request,
        mockRes as Response
      );

      expect(mockExistsSync).toHaveBeenCalledWith('/mock/home/.agentmux/in_progress_tasks.json');
      expect(mockReadFile).toHaveBeenCalledWith('/mock/home/.agentmux/in_progress_tasks.json', 'utf-8');
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        ...mockTasksData
      });
    });

    it('should return empty tasks array when file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      await inProgressController.getInProgressTasks.call(
        apiController,
        mockReq as Request,
        mockRes as Response
      );

      expect(mockExistsSync).toHaveBeenCalledWith('/mock/home/.agentmux/in_progress_tasks.json');
      expect(mockReadFile).not.toHaveBeenCalled();
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        tasks: [],
        lastUpdated: expect.any(String),
        version: '1.0.0'
      });
    });

    it('should handle file read errors gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockRejectedValue(new Error('Permission denied'));

      await inProgressController.getInProgressTasks.call(
        apiController,
        mockReq as Request,
        mockRes as Response
      );

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to read in-progress tasks data',
        tasks: [],
        lastUpdated: expect.any(String),
        version: '1.0.0'
      });
    });

    it('should handle invalid JSON gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue('invalid json');

      await inProgressController.getInProgressTasks.call(
        apiController,
        mockReq as Request,
        mockRes as Response
      );

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to read in-progress tasks data',
        tasks: [],
        lastUpdated: expect.any(String),
        version: '1.0.0'
      });
    });
  });
});
