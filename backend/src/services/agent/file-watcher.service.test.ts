import { FileWatcherService, FileChangeEvent, WatcherStats } from './file-watcher.service';
import { LoggerService } from '../core/logger.service';
import { ConfigService } from '../core/config.service';
import { StorageService } from '../core/storage.service';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('../core/logger.service');
jest.mock('../core/config.service');
jest.mock('../core/storage.service');

describe('FileWatcherService', () => {
  let service: FileWatcherService;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockConfig: jest.Mocked<ConfigService>;
  let mockStorage: jest.Mocked<StorageService>;
  let mockWatcher: jest.Mocked<fs.FSWatcher>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    (LoggerService.getInstance as jest.Mock).mockReturnValue(mockLogger);

    // Setup mock config
    mockConfig = {} as jest.Mocked<ConfigService>;
    (ConfigService.getInstance as jest.Mock).mockReturnValue(mockConfig);

    // Setup mock storage - source uses StorageService.getInstance()
    mockStorage = {
      getProjects: jest.fn()
    } as any;
    (StorageService.getInstance as jest.Mock).mockReturnValue(mockStorage);

    // Setup mock FSWatcher
    mockWatcher = {
      close: jest.fn(),
      on: jest.fn()
    } as any;

    (fs.watch as jest.Mock).mockReturnValue(mockWatcher);
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    service = new FileWatcherService();
  });

  afterEach(() => {
    jest.useRealTimers();
    service.cleanup();
  });

  describe('constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(LoggerService.getInstance).toHaveBeenCalled();
      expect(ConfigService.getInstance).toHaveBeenCalled();
      expect(StorageService.getInstance).toHaveBeenCalled();
    });
  });

  describe('watchProject', () => {
    beforeEach(() => {
      (path.resolve as jest.Mock).mockImplementation((p) => `/resolved${p}`);
      (path.join as jest.Mock).mockImplementation((...parts) => parts.join('/'));
    });

    it('should watch project agentmux directory and subdirectories', async () => {
      const projectId = 'test-project';
      const projectPath = '/test/project';

      await service.watchProject(projectId, projectPath);

      // Should check if .agentmux directory exists
      expect(fs.existsSync).toHaveBeenCalledWith('/resolved/test/project/.agentmux');

      // Should create watchers for main directory and subdirectories
      expect(fs.watch).toHaveBeenCalledTimes(5); // main + 4 subdirs
      expect(fs.watch).toHaveBeenCalledWith('/resolved/test/project/.agentmux', { recursive: true }, expect.any(Function));
      expect(fs.watch).toHaveBeenCalledWith('/resolved/test/project/.agentmux/specs', { recursive: true }, expect.any(Function));
      expect(fs.watch).toHaveBeenCalledWith('/resolved/test/project/.agentmux/tasks', { recursive: true }, expect.any(Function));
      expect(fs.watch).toHaveBeenCalledWith('/resolved/test/project/.agentmux/memory', { recursive: true }, expect.any(Function));
      expect(fs.watch).toHaveBeenCalledWith('/resolved/test/project/.agentmux/prompts', { recursive: true }, expect.any(Function));

      expect(service.isWatching(projectId)).toBe(true);
    });

    it('should warn and return early if agentmux directory does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await service.watchProject('test-project', '/test/project');

      expect(mockLogger.warn).toHaveBeenCalledWith('AgentMux directory does not exist: /resolved/test/project/.agentmux');
      expect(fs.watch).not.toHaveBeenCalled();
    });

    it('should stop existing watcher before creating new one', async () => {
      const stopWatchingSpy = jest.spyOn(service, 'stopWatchingProject').mockResolvedValue();

      await service.watchProject('test-project', '/test/project');

      expect(stopWatchingSpy).toHaveBeenCalledWith('test-project');
    });

    it('should handle errors and rethrow', async () => {
      (fs.existsSync as jest.Mock).mockImplementation(() => {
        throw new Error('File system error');
      });

      await expect(service.watchProject('test-project', '/test/project')).rejects.toThrow('File system error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to start watching project test-project:',
        { error: 'File system error', projectId: 'test-project' }
      );
    });
  });

  describe('stopWatchingProject', () => {
    beforeEach(async () => {
      (path.resolve as jest.Mock).mockImplementation((p) => `/resolved${p}`);
      (path.join as jest.Mock).mockImplementation((...parts) => parts.join('/'));
      await service.watchProject('test-project', '/test/project');
    });

    it('should close all watchers for the project', async () => {
      await service.stopWatchingProject('test-project');

      expect(mockWatcher.close).toHaveBeenCalledTimes(5); // main + 4 subdirs
      expect(service.isWatching('test-project')).toBe(false);
    });

    it('should log when stopping watchers', async () => {
      await service.stopWatchingProject('test-project');

      expect(mockLogger.info).toHaveBeenCalledWith('Stopped file watching for project test-project');
    });
  });

  describe('handleFileChange', () => {
    let eventCallback: (eventType: string, filename?: string) => void;

    beforeEach(async () => {
      (path.resolve as jest.Mock).mockImplementation((p) => `/resolved${p}`);
      (path.join as jest.Mock).mockImplementation((...parts) => parts.join('/'));
      (path.relative as jest.Mock).mockImplementation((from, to) => to.replace(from, ''));

      await service.watchProject('test-project', '/test/project');

      // Get the callback function passed to fs.watch
      eventCallback = (fs.watch as jest.Mock).mock.calls[0][2];
    });

    it('should ignore files without filename', () => {
      const handleFileChangeSpy = jest.spyOn(service as any, 'handleFileChange');

      eventCallback('change'); // No filename

      expect(handleFileChangeSpy).not.toHaveBeenCalled();
    });

    it('should filter out ignored files', () => {
      const shouldIgnoreFileSpy = jest.spyOn(service as any, 'shouldIgnoreFile').mockReturnValue(true);
      const handleFileChangeSpy = jest.spyOn(service as any, 'handleFileChange');

      eventCallback('change', '.hidden-file');

      expect(shouldIgnoreFileSpy).toHaveBeenCalledWith('.hidden-file', expect.any(String));
      expect(handleFileChangeSpy).not.toHaveBeenCalled();
    });

    it('should debounce file change events', () => {
      const processFileChangeSpy = jest.spyOn(service as any, 'processFileChange').mockResolvedValue(undefined);

      eventCallback('change', 'test-file.txt');
      eventCallback('change', 'test-file.txt'); // Second event should be debounced

      // Fast forward past debounce time
      jest.advanceTimersByTime(600);

      expect(processFileChangeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('processFileChange', () => {
    beforeEach(() => {
      (path.relative as jest.Mock).mockReturnValue('specs/test-spec.md');
    });

    it('should create file change event for created file', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      const emitSpy = jest.spyOn(service, 'emit');

      await (service as any).processFileChange(
        'rename',
        '/project/.agentmux/specs/test-spec.md',
        'specs/test-spec.md',
        'test-project',
        'specs'
      );

      expect(emitSpy).toHaveBeenCalledWith('fileChange', expect.objectContaining({
        type: 'created',
        filepath: '/project/.agentmux/specs/test-spec.md',
        relativePath: 'specs/test-spec.md',
        projectId: 'test-project',
        category: 'specs'
      }));
    });

    it('should create file change event for deleted file', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      const emitSpy = jest.spyOn(service, 'emit');

      await (service as any).processFileChange(
        'rename',
        '/project/.agentmux/specs/test-spec.md',
        'specs/test-spec.md',
        'test-project',
        'specs'
      );

      expect(emitSpy).toHaveBeenCalledWith('fileChange', expect.objectContaining({
        type: 'deleted'
      }));
    });

    it('should create file change event for modified file', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      const emitSpy = jest.spyOn(service, 'emit');

      await (service as any).processFileChange(
        'change',
        '/project/.agentmux/specs/test-spec.md',
        'specs/test-spec.md',
        'test-project',
        'specs'
      );

      expect(emitSpy).toHaveBeenCalledWith('fileChange', expect.objectContaining({
        type: 'modified'
      }));
    });

    it('should trigger specific actions based on file category', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      const emitSpy = jest.spyOn(service, 'emit');

      await (service as any).processFileChange(
        'change',
        '/project/.agentmux/specs/test-spec.md',
        'specs/test-spec.md',
        'test-project',
        'specs'
      );

      expect(emitSpy).toHaveBeenCalledWith('contextRefresh', { projectId: 'test-project', reason: 'specs_changed' });
      expect(emitSpy).toHaveBeenCalledWith('projectChanged', {
        projectId: 'test-project',
        category: 'specs',
        changeType: 'modified'
      });
    });
  });

  describe('triggerFileSpecificActions', () => {
    it('should trigger tasks changed event for tasks category', async () => {
      const emitSpy = jest.spyOn(service, 'emit');
      const event: FileChangeEvent = {
        type: 'modified',
        filepath: '/test/file.md',
        relativePath: 'file.md',
        timestamp: new Date(),
        projectId: 'test-project',
        category: 'tasks'
      };

      await (service as any).triggerFileSpecificActions(event);

      expect(emitSpy).toHaveBeenCalledWith('tasksChanged', {
        projectId: 'test-project',
        filepath: '/test/file.md'
      });
    });

    it('should trigger memory updated event for memory category', async () => {
      const emitSpy = jest.spyOn(service, 'emit');
      const event: FileChangeEvent = {
        type: 'modified',
        filepath: '/test/file.md',
        relativePath: 'file.md',
        timestamp: new Date(),
        projectId: 'test-project',
        category: 'memory'
      };

      await (service as any).triggerFileSpecificActions(event);

      expect(emitSpy).toHaveBeenCalledWith('memoryUpdated', {
        projectId: 'test-project',
        filepath: '/test/file.md'
      });
    });

    it('should trigger prompts changed event for prompts category', async () => {
      const emitSpy = jest.spyOn(service, 'emit');
      const event: FileChangeEvent = {
        type: 'modified',
        filepath: '/test/file.md',
        relativePath: 'file.md',
        timestamp: new Date(),
        projectId: 'test-project',
        category: 'prompts'
      };

      await (service as any).triggerFileSpecificActions(event);

      expect(emitSpy).toHaveBeenCalledWith('promptsChanged', {
        projectId: 'test-project',
        filepath: '/test/file.md'
      });
    });

    it('should always emit project changed event', async () => {
      const emitSpy = jest.spyOn(service, 'emit');
      const event: FileChangeEvent = {
        type: 'modified',
        filepath: '/test/file.md',
        relativePath: 'file.md',
        timestamp: new Date(),
        projectId: 'test-project',
        category: 'tasks'
      };

      await (service as any).triggerFileSpecificActions(event);

      expect(emitSpy).toHaveBeenCalledWith('projectChanged', {
        projectId: 'test-project',
        category: 'tasks',
        changeType: 'modified'
      });
    });

    it('should handle errors gracefully', async () => {
      const emitSpy = jest.spyOn(service, 'emit').mockImplementation(() => {
        throw new Error('Emit error');
      });
      const event: FileChangeEvent = {
        type: 'modified',
        filepath: '/test/file.md',
        relativePath: 'file.md',
        timestamp: new Date(),
        projectId: 'test-project',
        category: 'tasks'
      };

      await (service as any).triggerFileSpecificActions(event);

      expect(mockLogger.error).toHaveBeenCalledWith('Error triggering file-specific actions:', {
        error: 'Emit error'
      });
    });
  });

  describe('categorizeFile', () => {
    it('should categorize files based on directory', () => {
      expect((service as any).categorizeFile('specs/test.md')).toBe('specs');
      expect((service as any).categorizeFile('tasks/task.md')).toBe('tasks');
      expect((service as any).categorizeFile('memory/note.md')).toBe('memory');
      expect((service as any).categorizeFile('prompts/prompt.md')).toBe('prompts');
      expect((service as any).categorizeFile('other/file.md')).toBe('other');
    });
  });

  describe('shouldIgnoreFile', () => {
    it('should ignore hidden files', () => {
      expect((service as any).shouldIgnoreFile('.hidden', '.hidden')).toBe(true);
      expect((service as any).shouldIgnoreFile('.DS_Store', '.DS_Store')).toBe(true);
    });

    it('should ignore backup and temporary files', () => {
      expect((service as any).shouldIgnoreFile('file.txt~', 'file.txt~')).toBe(true);
      expect((service as any).shouldIgnoreFile('file.tmp', 'file.tmp')).toBe(true);
      expect((service as any).shouldIgnoreFile('file.lock', 'file.lock')).toBe(true);
    });

    it('should ignore node_modules and .git directories', () => {
      expect((service as any).shouldIgnoreFile('file.js', 'node_modules/file.js')).toBe(true);
      expect((service as any).shouldIgnoreFile('config', '.git/config')).toBe(true);
    });

    it('should not ignore normal files', () => {
      expect((service as any).shouldIgnoreFile('normal-file.md', 'specs/normal-file.md')).toBe(false);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      // Mock updateStats method to populate event counts
      jest.spyOn(service as any, 'updateStats').mockImplementation((...args: any[]) => {
        const projectId = args[0] as string;
        const event = args[1] as FileChangeEvent;
        const today = new Date().toDateString();
        const key = `${projectId}:${today}`;
        (service as any).eventCounts.set(key, 1);
        (service as any).lastEvents.set(projectId, event.timestamp);
      });
    });

    it('should return watcher statistics', () => {
      // Simulate some watchers and events
      (service as any).watchers.set('watcher1', mockWatcher);
      (service as any).watchers.set('watcher2', mockWatcher);
      (service as any).projectWatchers.set('project1', new Set());
      (service as any).projectWatchers.set('project2', new Set());

      // Simulate events
      const mockEvent: FileChangeEvent = {
        type: 'created',
        filepath: '/test',
        relativePath: 'test',
        timestamp: new Date(),
        projectId: 'project1',
        category: 'specs'
      };
      (service as any).updateStats('project1', mockEvent);

      const stats = service.getStats();

      expect(stats).toEqual({
        totalWatched: 2,
        activeProjects: 2,
        eventsToday: 1,
        lastEvent: expect.any(Date)
      });
    });

    it('should return null for lastEvent if no events', () => {
      const stats = service.getStats();

      expect(stats.lastEvent).toBeNull();
    });
  });

  describe('getWatchedProjects', () => {
    it('should return array of watched project IDs', async () => {
      (path.resolve as jest.Mock).mockImplementation((p) => `/resolved${p}`);
      (path.join as jest.Mock).mockImplementation((...parts) => parts.join('/'));

      await service.watchProject('project1', '/test1');
      await service.watchProject('project2', '/test2');

      const projects = service.getWatchedProjects();

      expect(projects).toEqual(['project1', 'project2']);
    });
  });

  describe('watchAllProjects', () => {
    const mockProjects = [
      { id: 'project1', status: 'active', path: '/project1' },
      { id: 'project2', status: 'inactive', path: '/project2' },
      { id: 'project3', status: 'active', path: '/nonexistent' }
    ];

    beforeEach(() => {
      mockStorage.getProjects.mockResolvedValue(mockProjects as any);
      (fs.existsSync as jest.Mock).mockImplementation((p: string) => p !== '/nonexistent');
      jest.spyOn(service, 'watchProject').mockResolvedValue();
    });

    it('should watch all active projects with existing paths', async () => {
      await service.watchAllProjects();

      expect(service.watchProject).toHaveBeenCalledWith('project1', '/project1');
      expect(service.watchProject).not.toHaveBeenCalledWith('project2', '/project2'); // inactive
      expect(service.watchProject).not.toHaveBeenCalledWith('project3', '/nonexistent'); // path doesn't exist
    });

    it('should handle errors gracefully', async () => {
      mockStorage.getProjects.mockRejectedValue(new Error('Storage error'));

      await service.watchAllProjects();

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to watch all projects:', {
        error: 'Storage error'
      });
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      (path.resolve as jest.Mock).mockImplementation((p) => `/resolved${p}`);
      (path.join as jest.Mock).mockImplementation((...parts) => parts.join('/'));
      await service.watchProject('test-project', '/test/project');
    });

    it('should cleanup all watchers and timers', async () => {
      // Simulate some debounce timers
      const mockTimer = setTimeout(() => {}, 1000) as any;
      (service as any).debounceTimers.set('test', mockTimer);

      await service.cleanup();

      expect(mockWatcher.close).toHaveBeenCalledTimes(5); // All watchers closed
      expect(mockLogger.info).toHaveBeenCalledWith('Cleaning up file watchers...');
      expect(mockLogger.info).toHaveBeenCalledWith('File watcher cleanup complete');
    });

    it('should handle watcher close errors gracefully', async () => {
      mockWatcher.close.mockImplementation(() => {
        throw new Error('Close error');
      });

      await service.cleanup();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error closing watcher'),
        expect.objectContaining({ error: 'Close error' })
      );
    });
  });
});
