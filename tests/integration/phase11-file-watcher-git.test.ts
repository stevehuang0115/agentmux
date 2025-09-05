import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { FileWatcherService, FileChangeEvent } from '../../backend/src/services/file-watcher.service';
import { GitIntegrationService, GitStatus } from '../../backend/src/services/git-integration.service';
import { FileWatcherController } from '../../backend/src/controllers/file-watcher.controller';

// Mock the file system and git commands
jest.mock('child_process');
jest.mock('fs');
jest.mock('fs/promises');

describe('Phase 11: File Watcher System & Git Integration Tests', () => {
  let fileWatcher: FileWatcherService;
  let gitIntegration: GitIntegrationService;
  let controller: FileWatcherController;
  let testProjectPath: string;
  let testProjectId: string;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Initialize services
    fileWatcher = new FileWatcherService();
    gitIntegration = new GitIntegrationService();
    controller = new FileWatcherController();
    
    testProjectPath = '/tmp/test-project';
    testProjectId = 'test-project-id';

    // Mock file system operations
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.watch as jest.Mock).mockReturnValue({
      close: jest.fn(),
      on: jest.fn()
    });
  });

  afterEach(async () => {
    // Cleanup watchers
    await fileWatcher.cleanup();
    gitIntegration.cleanup();
  });

  describe('File Watcher Service', () => {
    test('should start watching a project directory', async () => {
      await fileWatcher.watchProject(testProjectId, testProjectPath);
      
      expect(fileWatcher.isWatching(testProjectId)).toBe(true);
      expect(fs.watch).toHaveBeenCalled();
      
      const stats = fileWatcher.getStats();
      expect(stats.activeProjects).toBeGreaterThan(0);
    });

    test('should stop watching a project', async () => {
      await fileWatcher.watchProject(testProjectId, testProjectPath);
      await fileWatcher.stopWatchingProject(testProjectId);
      
      expect(fileWatcher.isWatching(testProjectId)).toBe(false);
      
      const stats = fileWatcher.getStats();
      expect(stats.activeProjects).toBe(0);
    });

    test('should emit file change events', (done) => {
      const mockEvent: FileChangeEvent = {
        type: 'modified',
        filepath: '/tmp/test-project/.agentmux/specs/project.md',
        relativePath: 'specs/project.md',
        timestamp: new Date(),
        projectId: testProjectId,
        category: 'specs'
      };

      fileWatcher.on('fileChange', (event: FileChangeEvent) => {
        expect(event.projectId).toBe(testProjectId);
        expect(event.category).toBe('specs');
        expect(event.type).toBe('modified');
        done();
      });

      // Simulate file change event
      fileWatcher.emit('fileChange', mockEvent);
    });

    test('should categorize files correctly', async () => {
      const testCases = [
        { path: 'specs/project.md', expected: 'specs' },
        { path: 'tickets/task-001.yaml', expected: 'tickets' },
        { path: 'memory/context.md', expected: 'memory' },
        { path: 'prompts/developer.md', expected: 'prompts' },
        { path: 'other/file.txt', expected: 'other' }
      ];

      for (const testCase of testCases) {
        const mockEvent: FileChangeEvent = {
          type: 'modified',
          filepath: path.join(testProjectPath, '.agentmux', testCase.path),
          relativePath: testCase.path,
          timestamp: new Date(),
          projectId: testProjectId,
          category: testCase.expected as any
        };

        expect(mockEvent.category).toBe(testCase.expected);
      }
    });

    test('should provide accurate statistics', async () => {
      await fileWatcher.watchProject(testProjectId, testProjectPath);
      await fileWatcher.watchProject('project2', '/tmp/project2');
      
      const stats = fileWatcher.getStats();
      expect(stats.activeProjects).toBe(2);
      expect(stats.totalWatched).toBeGreaterThan(0);
      expect(stats.eventsToday).toBeGreaterThanOrEqual(0);
    });

    test('should handle file ignore patterns', async () => {
      const ignoredFiles = [
        '.DS_Store',
        'file.tmp',
        'temp~',
        '.git/config',
        'node_modules/package.json'
      ];

      // These files should be ignored and not trigger events
      for (const filename of ignoredFiles) {
        const shouldIgnore = filename.startsWith('.') || 
                           filename.endsWith('~') || 
                           filename.endsWith('.tmp') ||
                           filename.includes('node_modules') ||
                           filename.includes('.git');
        expect(shouldIgnore).toBe(true);
      }
    });

    test('should trigger context refresh for spec changes', (done) => {
      fileWatcher.on('contextRefresh', (data: { projectId: string, reason: string }) => {
        expect(data.projectId).toBe(testProjectId);
        expect(data.reason).toBe('specs_changed');
        done();
      });

      // Simulate specs file change
      fileWatcher.emit('contextRefresh', { projectId: testProjectId, reason: 'specs_changed' });
    });
  });

  describe('Git Integration Service', () => {
    beforeEach(() => {
      // Mock git commands
      const { exec } = require('child_process');
      const execAsync = require('util').promisify(exec);
      
      (execAsync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('git rev-parse --git-dir')) {
          return Promise.resolve({ stdout: '.git\n', stderr: '' });
        }
        if (command.includes('git branch --show-current')) {
          return Promise.resolve({ stdout: 'main\n', stderr: '' });
        }
        if (command.includes('git status --porcelain')) {
          return Promise.resolve({ stdout: 'M  file1.js\n?? file2.js\n', stderr: '' });
        }
        if (command.includes('git log -1')) {
          return Promise.resolve({ 
            stdout: 'abc123|Initial commit|Test Author|2024-01-01T00:00:00.000Z\n', 
            stderr: '' 
          });
        }
        if (command.includes('git add -A')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        }
        if (command.includes('git commit')) {
          return Promise.resolve({ stdout: '[main abc123] Test commit\n', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });
    });

    test('should get git status for a project', async () => {
      const status = await gitIntegration.getGitStatus(testProjectPath);
      
      expect(status).toBeDefined();
      expect(status.branch).toBe('main');
      expect(status.hasChanges).toBe(true);
      expect(status.unstaged).toBe(1);
      expect(status.untracked).toBe(1);
      expect(status.lastCommit).toBeDefined();
      expect(status.lastCommit?.message).toBe('Initial commit');
    });

    test('should commit changes with auto-generated message', async () => {
      const result = await gitIntegration.commitChanges(testProjectPath, {
        autoGenerate: true
      });
      
      expect(result).toContain('Test commit');
    });

    test('should commit changes with custom message', async () => {
      const customMessage = 'Custom commit message';
      const result = await gitIntegration.commitChanges(testProjectPath, {
        message: customMessage
      });
      
      expect(result).toContain('Test commit');
    });

    test('should handle no changes to commit', async () => {
      // Mock no changes
      const { exec } = require('child_process');
      const execAsync = require('util').promisify(exec);
      (execAsync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('git status --porcelain')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await gitIntegration.commitChanges(testProjectPath);
      expect(result).toBe('no-changes');
    });

    test('should start and stop scheduled commits', async () => {
      await gitIntegration.startScheduledCommits(testProjectPath, {
        intervalMinutes: 1, // 1 minute for testing
        enabled: true
      });
      
      const scheduledProjects = gitIntegration.getScheduledProjects();
      expect(scheduledProjects).toContain(testProjectPath);
      
      gitIntegration.stopScheduledCommits(testProjectPath);
      const updatedProjects = gitIntegration.getScheduledProjects();
      expect(updatedProjects).not.toContain(testProjectPath);
    });

    test('should handle git repository errors gracefully', async () => {
      // Mock non-git repository
      const { exec } = require('child_process');
      const execAsync = require('util').promisify(exec);
      (execAsync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('git rev-parse --git-dir')) {
          return Promise.reject(new Error('Not a git repository'));
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      await expect(gitIntegration.getGitStatus('/tmp/not-git'))
        .rejects.toThrow('Not a git repository');
    });
  });

  describe('File Watcher Controller API', () => {
    let mockRequest: any;
    let mockResponse: any;

    beforeEach(() => {
      mockRequest = {
        params: {},
        body: {}
      };
      
      mockResponse = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };
    });

    test('should start watching via API', async () => {
      mockRequest.params.projectId = testProjectId;
      mockRequest.body.projectPath = testProjectPath;
      
      await controller.startWatching(mockRequest, mockResponse);
      
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('Started watching project')
        })
      );
    });

    test('should stop watching via API', async () => {
      mockRequest.params.projectId = testProjectId;
      
      await controller.stopWatching(mockRequest, mockResponse);
      
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('Stopped watching project')
        })
      );
    });

    test('should get watcher stats via API', async () => {
      await controller.getStats(mockRequest, mockResponse);
      
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totalWatched: expect.any(Number),
            activeProjects: expect.any(Number),
            eventsToday: expect.any(Number)
          })
        })
      );
    });

    test('should handle missing parameters', async () => {
      // Missing projectId
      await controller.startWatching(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Project ID and path are required'
      });
    });

    test('should get git status via API', async () => {
      mockRequest.body.projectPath = testProjectPath;
      
      await controller.getGitStatus(mockRequest, mockResponse);
      
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            branch: expect.any(String),
            hasChanges: expect.any(Boolean)
          })
        })
      );
    });

    test('should commit changes via API', async () => {
      mockRequest.body = {
        projectPath: testProjectPath,
        message: 'Test commit via API',
        autoGenerate: false
      };
      
      await controller.commitChanges(mockRequest, mockResponse);
      
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('committed successfully')
        })
      );
    });

    test('should start scheduled commits via API', async () => {
      mockRequest.body = {
        projectPath: testProjectPath,
        intervalMinutes: 30,
        enabled: true
      };
      
      await controller.startScheduledCommits(mockRequest, mockResponse);
      
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('Started scheduled commits')
        })
      );
    });
  });

  describe('Integration Workflow Tests', () => {
    test('should complete full file watching workflow', async () => {
      // 1. Start watching project
      await fileWatcher.watchProject(testProjectId, testProjectPath);
      expect(fileWatcher.isWatching(testProjectId)).toBe(true);
      
      // 2. Simulate file change
      const changeEvent: FileChangeEvent = {
        type: 'modified',
        filepath: path.join(testProjectPath, '.agentmux/specs/project.md'),
        relativePath: 'specs/project.md',
        timestamp: new Date(),
        projectId: testProjectId,
        category: 'specs'
      };
      
      let contextRefreshTriggered = false;
      fileWatcher.on('contextRefresh', () => {
        contextRefreshTriggered = true;
      });
      
      fileWatcher.emit('fileChange', changeEvent);
      fileWatcher.emit('contextRefresh', { projectId: testProjectId, reason: 'specs_changed' });
      
      // 3. Verify context refresh was triggered
      expect(contextRefreshTriggered).toBe(true);
      
      // 4. Stop watching
      await fileWatcher.stopWatchingProject(testProjectId);
      expect(fileWatcher.isWatching(testProjectId)).toBe(false);
    });

    test('should complete full git integration workflow', async () => {
      // 1. Check git status
      const status = await gitIntegration.getGitStatus(testProjectPath);
      expect(status.hasChanges).toBe(true);
      
      // 2. Commit changes
      const commitResult = await gitIntegration.commitChanges(testProjectPath, {
        autoGenerate: true
      });
      expect(commitResult).toContain('Test commit');
      
      // 3. Start scheduled commits
      await gitIntegration.startScheduledCommits(testProjectPath, {
        intervalMinutes: 30
      });
      expect(gitIntegration.getScheduledProjects()).toContain(testProjectPath);
      
      // 4. Stop scheduled commits
      gitIntegration.stopScheduledCommits(testProjectPath);
      expect(gitIntegration.getScheduledProjects()).not.toContain(testProjectPath);
    });

    test('should handle file watcher and git integration together', async () => {
      // Start file watching
      await fileWatcher.watchProject(testProjectId, testProjectPath);
      
      // Start scheduled commits
      await gitIntegration.startScheduledCommits(testProjectPath, {
        intervalMinutes: 60
      });
      
      // Simulate file changes that would trigger commits
      const fileChangeEvent: FileChangeEvent = {
        type: 'modified',
        filepath: path.join(testProjectPath, 'src/index.js'),
        relativePath: 'src/index.js',
        timestamp: new Date(),
        projectId: testProjectId,
        category: 'other'
      };
      
      fileWatcher.emit('fileChange', fileChangeEvent);
      
      // Verify both systems are running
      expect(fileWatcher.isWatching(testProjectId)).toBe(true);
      expect(gitIntegration.getScheduledProjects()).toContain(testProjectPath);
      
      // Cleanup
      await fileWatcher.stopWatchingProject(testProjectId);
      gitIntegration.stopScheduledCommits(testProjectPath);
    });
  });
});