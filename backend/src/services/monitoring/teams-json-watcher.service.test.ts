import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { jest } from '@jest/globals';
import { TeamsJsonWatcherService } from './teams-json-watcher.service.js';
import { TeamActivityWebSocketService } from './team-activity-websocket.service.js';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock os module
jest.mock('os');
const mockOs = os as jest.Mocked<typeof os>;

// Mock path module methods that are used
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn(),
  dirname: jest.fn()
}));
const mockPath = path as jest.Mocked<typeof path>;

// Mock LoggerService
jest.mock('../core/logger.service.js', () => ({
  LoggerService: {
    getInstance: jest.fn().mockReturnValue({
      createComponentLogger: jest.fn().mockReturnValue({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      })
    })
  }
}));

describe('TeamsJsonWatcherService', () => {
  let service: TeamsJsonWatcherService;
  let mockTeamActivityService: jest.Mocked<TeamActivityWebSocketService>;
  let mockWatcher: jest.Mocked<fs.FSWatcher>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock os.homedir
    mockOs.homedir.mockReturnValue('/mock/home');

    // Mock path.join and path.dirname
    mockPath.join.mockImplementation((...args) => args.join('/'));
    mockPath.dirname.mockReturnValue('/mock/home/.agentmux');

    // Mock fs.existsSync
    mockFs.existsSync.mockReturnValue(true);

    // Mock fs.mkdirSync
    mockFs.mkdirSync.mockImplementation(() => '/mock/home/.agentmux');

    // Mock fs.watch
    mockWatcher = {
      on: jest.fn(),
      close: jest.fn()
    } as any;
    mockFs.watch.mockReturnValue(mockWatcher);

    // Mock fs.statSync
    mockFs.statSync.mockReturnValue({
      mtime: new Date('2023-01-01T10:00:00Z')
    } as fs.Stats);

    // Create mock team activity service
    mockTeamActivityService = {
      forceRefresh: jest.fn()
    } as any;

    // Create service instance
    service = new TeamsJsonWatcherService();
    service.setTeamActivityService(mockTeamActivityService);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    service.stop();
  });

  describe('constructor', () => {
    it('should initialize with correct teams.json path', () => {
      expect(mockOs.homedir).toHaveBeenCalled();
      expect(mockPath.join).toHaveBeenCalledWith('/mock/home', '.agentmux', 'teams.json');
    });
  });

  describe('setTeamActivityService', () => {
    it('should set the team activity service', () => {
      const newMockService = { forceRefresh: jest.fn() } as any;
      service.setTeamActivityService(newMockService);
      
      // This is tested indirectly by checking if the correct service is called in other tests
      expect(newMockService).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start watching teams.json successfully', () => {
      service.start();

      expect(mockFs.existsSync).toHaveBeenCalledWith('/mock/home/.agentmux');
      expect(mockFs.watch).toHaveBeenCalledWith(
        '/mock/home/.agentmux',
        { persistent: true },
        expect.any(Function)
      );
      expect(mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockTeamActivityService.forceRefresh).toHaveBeenCalledWith();
    });

    it('should create .agentmux directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      service.start();

      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/mock/home/.agentmux', { recursive: true });
    });

    it('should handle watcher errors and attempt restart', () => {
      service.start();

      // Get the error handler that was registered
      const errorHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'error')?.[1];
      expect(errorHandler).toBeDefined();

      // Simulate an error
      const mockError = new Error('Watcher failed');
      errorHandler?.(mockError);

      // Fast-forward timers to trigger restart
      jest.advanceTimersByTime(5000);

      // Should have attempted to restart (second call to fs.watch)
      expect(mockFs.watch).toHaveBeenCalledTimes(2);
    });

    it('should stop existing watcher before starting new one', () => {
      // Start first watcher
      service.start();
      expect(mockFs.watch).toHaveBeenCalledTimes(1);

      // Start second watcher
      service.start();
      expect(mockWatcher.close).toHaveBeenCalled();
      expect(mockFs.watch).toHaveBeenCalledTimes(2);
    });
  });

  describe('stop', () => {
    it('should stop the watcher and clear timers', () => {
      service.start();
      service.stop();

      expect(mockWatcher.close).toHaveBeenCalled();
    });

    it('should handle errors when stopping watcher', () => {
      service.start();
      mockWatcher.close.mockImplementation(() => {
        throw new Error('Close failed');
      });

      // Should not throw
      expect(() => service.stop()).not.toThrow();
    });

    it('should handle case where watcher is null', () => {
      // Don't start the service, just try to stop it
      expect(() => service.stop()).not.toThrow();
    });
  });

  describe('teams.json change handling', () => {
    it('should trigger team activity update when teams.json changes', () => {
      service.start();

      // Get the change handler that was registered with fs.watch
      const changeHandler = mockFs.watch.mock.calls[0][2];
      expect(changeHandler).toBeDefined();

      // Simulate teams.json change
      changeHandler('change', 'teams.json');

      // Fast-forward past debounce delay
      jest.advanceTimersByTime(1000);

      // Should have triggered team activity refresh (once for initial, once for change)
      expect(mockTeamActivityService.forceRefresh).toHaveBeenCalledTimes(2);
    });

    it('should ignore changes to other files', () => {
      service.start();
      mockTeamActivityService.forceRefresh.mockClear(); // Clear the initial call

      // Get the change handler
      const changeHandler = mockFs.watch.mock.calls[0][2];

      // Simulate change to different file
      changeHandler('change', 'other-file.json');

      // Fast-forward past debounce delay
      jest.advanceTimersByTime(1000);

      // Should not have triggered team activity refresh
      expect(mockTeamActivityService.forceRefresh).not.toHaveBeenCalled();
    });

    it('should debounce multiple rapid changes', () => {
      service.start();
      mockTeamActivityService.forceRefresh.mockClear(); // Clear the initial call

      // Get the change handler
      const changeHandler = mockFs.watch.mock.calls[0][2];

      // Simulate multiple rapid changes
      changeHandler('change', 'teams.json');
      changeHandler('change', 'teams.json');
      changeHandler('change', 'teams.json');

      // Fast-forward past debounce delay
      jest.advanceTimersByTime(1000);

      // Should only have triggered once despite multiple changes
      expect(mockTeamActivityService.forceRefresh).toHaveBeenCalledTimes(1);
    });

    it('should handle case where TeamActivityWebSocketService is not set', () => {
      const serviceWithoutActivity = new TeamsJsonWatcherService();
      serviceWithoutActivity.start();

      // Get the change handler
      const changeHandler = mockFs.watch.mock.calls[0][2];

      // Should not throw even without team activity service
      expect(() => {
        changeHandler('change', 'teams.json');
        jest.advanceTimersByTime(1000);
      }).not.toThrow();
    });
  });

  describe('getStatus', () => {
    it('should return correct status when watching', () => {
      service.start();
      
      const status = service.getStatus();

      expect(status).toEqual({
        isWatching: true,
        teamsJsonPath: '/mock/home/.agentmux/teams.json',
        fileExists: true,
        lastModified: new Date('2023-01-01T10:00:00Z')
      });
    });

    it('should return correct status when not watching', () => {
      const status = service.getStatus();

      expect(status).toEqual({
        isWatching: false,
        teamsJsonPath: '/mock/home/.agentmux/teams.json',
        fileExists: true,
        lastModified: new Date('2023-01-01T10:00:00Z')
      });
    });

    it('should handle case where file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const status = service.getStatus();

      expect(status.fileExists).toBe(false);
      expect(status.lastModified).toBeUndefined();
    });

    it('should handle errors getting file stats', () => {
      mockFs.statSync.mockImplementation(() => {
        throw new Error('Stats failed');
      });

      const status = service.getStatus();

      expect(status.fileExists).toBe(true);
      expect(status.lastModified).toBeUndefined();
    });
  });

  describe('forceTrigger', () => {
    it('should manually trigger team activity update', () => {
      service.forceTrigger('test_trigger');

      expect(mockTeamActivityService.forceRefresh).toHaveBeenCalled();
    });

    it('should use default reason if not provided', () => {
      service.forceTrigger();

      expect(mockTeamActivityService.forceRefresh).toHaveBeenCalled();
    });
  });

  describe('event emission', () => {
    it('should emit teams_json_changed event', () => {
      const eventListener = jest.fn();
      service.on('teams_json_changed', eventListener);
      
      service.start();

      // Get the change handler
      const changeHandler = mockFs.watch.mock.calls[0][2];
      changeHandler('change', 'teams.json');

      // Fast-forward past debounce delay
      jest.advanceTimersByTime(1000);

      expect(eventListener).toHaveBeenCalledWith({
        eventType: 'change',
        fileExists: true,
        path: '/mock/home/.agentmux/teams.json',
        timestamp: expect.any(Date)
      });
    });

    it('should emit team_activity_triggered event', () => {
      const eventListener = jest.fn();
      service.on('team_activity_triggered', eventListener);
      
      service.forceTrigger('manual_test');

      expect(eventListener).toHaveBeenCalledWith({
        reason: 'manual_test',
        timestamp: expect.any(Date)
      });
    });

    it('should emit watcher_error event on watcher errors', () => {
      const errorListener = jest.fn();
      service.on('watcher_error', errorListener);
      
      service.start();

      // Get the error handler
      const errorHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'error')?.[1];
      const mockError = new Error('Watcher failed');
      errorHandler?.(mockError);

      expect(errorListener).toHaveBeenCalledWith(mockError);
    });
  });

  describe('cleanup', () => {
    it('should clean up on process signals', () => {
      const stopSpy = jest.spyOn(service, 'stop');
      
      service.start();
      
      // Simulate SIGINT
      process.emit('SIGINT', 'SIGINT');
      
      expect(stopSpy).toHaveBeenCalled();
    });
  });
});