import { ActivityMonitorService } from './activity-monitor.service';
import { StorageService } from './storage.service';
import { TmuxService } from '../agent/tmux.service.js';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { AGENTMUX_CONSTANTS } from '../../../../config/constants.js';

// Mock dependencies
jest.mock('./storage.service');
jest.mock('../agent/tmux.service.js');
jest.mock('./logger.service');
jest.mock('fs/promises');
jest.mock('path');
jest.mock('os');

describe('ActivityMonitorService', () => {
  let service: ActivityMonitorService;
  let mockLogger: jest.Mocked<ComponentLogger>;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockTmuxService: jest.Mocked<TmuxService>;
  let mockLoggerService: jest.Mocked<LoggerService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton instance
    (ActivityMonitorService as any).instance = undefined;
    
    // Setup mocks
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as jest.Mocked<ComponentLogger>;
    
    mockLoggerService = {
      createComponentLogger: jest.fn().mockReturnValue(mockLogger)
    } as jest.Mocked<LoggerService>;
    
    (LoggerService.getInstance as jest.Mock).mockReturnValue(mockLoggerService);
    
    mockStorageService = new StorageService() as jest.Mocked<StorageService>;
    mockTmuxService = new TmuxService() as jest.Mocked<TmuxService>;
    
    (StorageService as jest.MockedClass<typeof StorageService>).mockImplementation(() => mockStorageService);
    (TmuxService as jest.MockedClass<typeof TmuxService>).mockImplementation(() => mockTmuxService);
    
    service = ActivityMonitorService.getInstance();
  });

  afterEach(() => {
    // Clean up any running intervals
    service.stopPolling();
    jest.clearAllTimers();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ActivityMonitorService.getInstance();
      const instance2 = ActivityMonitorService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should initialize logger and services', () => {
      expect(LoggerService.getInstance).toHaveBeenCalled();
      expect(mockLoggerService.createComponentLogger).toHaveBeenCalledWith('ActivityMonitor');
    });
  });

  describe('startPolling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start polling with immediate first check', () => {
      const performActivityCheckSpy = jest.spyOn(service as any, 'performActivityCheck').mockResolvedValue();
      
      service.startPolling();
      
      expect(performActivityCheckSpy).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith('Starting activity monitoring with 30-second intervals');
      expect(service.isRunning()).toBe(true);
    });

    it('should set up recurring polling', () => {
      const performActivityCheckSpy = jest.spyOn(service as any, 'performActivityCheck').mockResolvedValue();
      
      service.startPolling();
      
      // Fast forward 30 seconds
      jest.advanceTimersByTime(30000);
      
      expect(performActivityCheckSpy).toHaveBeenCalledTimes(2); // Initial + 1 interval
    });

    it('should warn if already running', () => {
      service.startPolling();
      service.startPolling();
      
      expect(mockLogger.warn).toHaveBeenCalledWith('Activity monitoring already running');
    });
  });

  describe('stopPolling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should stop polling and clear interval', () => {
      service.startPolling();
      expect(service.isRunning()).toBe(true);
      
      service.stopPolling();
      
      expect(service.isRunning()).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Activity monitoring stopped');
    });

    it('should do nothing if not running', () => {
      service.stopPolling();
      
      expect(mockLogger.info).not.toHaveBeenCalledWith('Activity monitoring stopped');
    });
  });

  describe('performActivityCheck', () => {
    const mockTeam = {
      id: 'test-team',
      members: [
        {
          id: 'member-1',
          name: 'Test Member 1',
          agentStatus: 'active',
          workingStatus: 'idle',
          sessionName: 'test-session-1',
          lastActivityCheck: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z'
        },
        {
          id: 'member-2',
          name: 'Test Member 2',
          agentStatus: 'inactive',
          workingStatus: 'idle',
          sessionName: 'test-session-2'
        }
      ]
    };

    const mockOrchestratorStatus = {
      status: 'inactive',
      agentStatus: 'inactive',
      workingStatus: 'idle'
    };

    beforeEach(() => {
      mockStorageService.getOrchestratorStatus.mockResolvedValue(mockOrchestratorStatus);
      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
      mockStorageService.saveTeam.mockResolvedValue();
      mockTmuxService.sessionExists.mockResolvedValue(true);
      mockTmuxService.capturePane.mockResolvedValue('some terminal output');
    });

    it('should check orchestrator status and update if changed', async () => {
      mockTmuxService.sessionExists.mockResolvedValueOnce(true); // orchestrator session
      const updateOrchestratorSpy = jest.spyOn(service as any, 'updateOrchestratorWithStatuses').mockResolvedValue();
      
      await (service as any).performActivityCheck();
      
      expect(mockTmuxService.sessionExists).toHaveBeenCalledWith(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME);
      expect(updateOrchestratorSpy).toHaveBeenCalledWith('active', 'active', 'idle');
    });

    it('should not update orchestrator if status unchanged', async () => {
      mockOrchestratorStatus.status = 'active';
      mockOrchestratorStatus.agentStatus = 'active';
      mockTmuxService.sessionExists.mockResolvedValueOnce(true); // orchestrator session
      const updateOrchestratorSpy = jest.spyOn(service as any, 'updateOrchestratorWithStatuses').mockResolvedValue();
      
      await (service as any).performActivityCheck();
      
      expect(updateOrchestratorSpy).not.toHaveBeenCalled();
    });

    it('should check active team member sessions', async () => {
      mockTmuxService.sessionExists.mockResolvedValueOnce(false); // orchestrator session (inactive)
      mockTmuxService.sessionExists.mockResolvedValueOnce(true); // member session
      
      await (service as any).performActivityCheck();
      
      expect(mockTmuxService.sessionExists).toHaveBeenCalledWith('test-session-1');
      expect(mockTmuxService.capturePane).toHaveBeenCalledWith('test-session-1', 50);
    });

    it('should mark member as inactive if session no longer exists', async () => {
      mockTmuxService.sessionExists.mockResolvedValueOnce(false); // orchestrator session
      mockTmuxService.sessionExists.mockResolvedValueOnce(false); // member session doesn't exist
      
      await (service as any).performActivityCheck();
      
      expect(mockTeam.members[0].agentStatus).toBe('inactive');
      expect(mockTeam.members[0].workingStatus).toBe('idle');
      expect(mockTeam.members[0].lastActivityCheck).toBeDefined();
      expect(mockTeam.members[0].updatedAt).toBeDefined();
      expect(mockStorageService.saveTeam).toHaveBeenCalledWith(mockTeam);
    });

    it('should detect activity and update working status', async () => {
      mockTmuxService.sessionExists.mockResolvedValueOnce(false); // orchestrator session
      mockTmuxService.sessionExists.mockResolvedValueOnce(true); // member session exists
      mockTmuxService.capturePane.mockResolvedValue('new terminal output');
      
      // Set previous output different from current
      (mockTeam.members[0] as any).lastTerminalOutput = 'old terminal output';
      
      await (service as any).performActivityCheck();
      
      expect(mockTeam.members[0].workingStatus).toBe('in_progress');
      expect((mockTeam.members[0] as any).lastTerminalOutput).toBe('new terminal output');
      expect(mockStorageService.saveTeam).toHaveBeenCalledWith(mockTeam);
    });

    it('should not update status if no activity detected', async () => {
      const originalWorkingStatus = mockTeam.members[0].workingStatus;
      mockTmuxService.sessionExists.mockResolvedValueOnce(false); // orchestrator session
      mockTmuxService.sessionExists.mockResolvedValueOnce(true); // member session exists
      mockTmuxService.capturePane.mockResolvedValue('same terminal output');
      
      // Set previous output same as current
      (mockTeam.members[0] as any).lastTerminalOutput = 'same terminal output';
      
      await (service as any).performActivityCheck();
      
      expect(mockTeam.members[0].workingStatus).toBe(originalWorkingStatus);
      expect(mockStorageService.saveTeam).not.toHaveBeenCalled();
    });

    it('should skip inactive members', async () => {
      mockTmuxService.sessionExists.mockResolvedValueOnce(false); // orchestrator session
      
      await (service as any).performActivityCheck();
      
      // Should only check session for active member (member-1), not inactive member (member-2)
      expect(mockTmuxService.sessionExists).toHaveBeenCalledTimes(2); // orchestrator + member-1
      expect(mockTmuxService.sessionExists).not.toHaveBeenCalledWith('test-session-2');
    });

    it('should handle member activity check errors gracefully', async () => {
      mockTmuxService.sessionExists.mockResolvedValueOnce(false); // orchestrator session
      mockTmuxService.sessionExists.mockResolvedValueOnce(true); // member session exists
      mockTmuxService.capturePane.mockRejectedValue(new Error('Capture pane error'));
      
      await (service as any).performActivityCheck();
      
      expect(mockLogger.error).toHaveBeenCalledWith('Error checking member activity', {
        teamId: 'test-team',
        memberId: 'member-1',
        memberName: 'Test Member 1',
        sessionName: 'test-session-1',
        error: 'Capture pane error'
      });
    });

    it('should handle overall activity check errors gracefully', async () => {
      mockStorageService.getOrchestratorStatus.mockRejectedValue(new Error('Storage error'));
      
      await (service as any).performActivityCheck();
      
      expect(mockLogger.error).toHaveBeenCalledWith('Error during activity check', {
        error: 'Storage error'
      });
    });
  });

  describe('updateOrchestratorWithStatuses', () => {
    const mockTeamsFilePath = '/mock/home/.agentmux/teams.json';
    const mockTeamsData = {
      orchestrator: {
        sessionId: AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
        status: 'inactive',
        agentStatus: 'inactive',
        workingStatus: 'idle',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }
    };

    beforeEach(() => {
      (homedir as jest.Mock).mockReturnValue('/mock/home');
      (join as jest.Mock).mockReturnValue(mockTeamsFilePath);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockTeamsData));
      (writeFile as jest.Mock).mockResolvedValue(undefined);
    });

    it('should update existing orchestrator status', async () => {
      await (service as any).updateOrchestratorWithStatuses('active', 'active', 'in_progress');
      
      expect(readFile).toHaveBeenCalledWith(mockTeamsFilePath, 'utf-8');
      expect(writeFile).toHaveBeenCalledWith(
        mockTeamsFilePath,
        expect.stringContaining('"status":"active"')
      );
      expect(writeFile).toHaveBeenCalledWith(
        mockTeamsFilePath,
        expect.stringContaining('"agentStatus":"active"')
      );
      expect(writeFile).toHaveBeenCalledWith(
        mockTeamsFilePath,
        expect.stringContaining('"workingStatus":"in_progress"')
      );
    });

    it('should create orchestrator status if it does not exist', async () => {
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify({}));
      
      await (service as any).updateOrchestratorWithStatuses('active', 'active', 'idle');
      
      expect(writeFile).toHaveBeenCalledWith(
        mockTeamsFilePath,
        expect.stringContaining(`"sessionId":"${AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME}"`)
      );
    });

    it('should handle file read/write errors gracefully', async () => {
      (readFile as jest.Mock).mockRejectedValue(new Error('File read error'));
      
      await (service as any).updateOrchestratorWithStatuses('active', 'active', 'idle');
      
      expect(mockLogger.error).toHaveBeenCalledWith('Error updating orchestrator with statuses', {
        error: 'File read error'
      });
    });
  });

  describe('isRunning', () => {
    it('should return false initially', () => {
      expect(service.isRunning()).toBe(false);
    });

    it('should return true when polling is active', () => {
      jest.useFakeTimers();
      service.startPolling();
      
      expect(service.isRunning()).toBe(true);
      
      jest.useRealTimers();
      service.stopPolling();
    });
  });

  describe('getPollingInterval', () => {
    it('should return the correct polling interval', () => {
      expect(service.getPollingInterval()).toBe(30000);
    });
  });
});