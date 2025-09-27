import { ActivityMonitorService, TeamWorkingStatusFile } from './activity-monitor.service';
import { StorageService } from '../core/storage.service.js';
import { TmuxService } from '../agent/tmux.service.js';
import { AgentHeartbeatService } from '../agent/agent-heartbeat.service.js';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { AGENTMUX_CONSTANTS } from '../../constants.js';

// Mock dependencies
jest.mock('../core/storage.service.js');
jest.mock('../agent/tmux.service.js');
jest.mock('../agent/agent-heartbeat.service.js');
jest.mock('../core/logger.service.js');
jest.mock('fs/promises');
jest.mock('fs');
jest.mock('path');
jest.mock('os');

describe('ActivityMonitorService', () => {
  let service: ActivityMonitorService;
  let mockLogger: jest.Mocked<ComponentLogger>;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockTmuxService: jest.Mocked<TmuxService>;
  let mockAgentHeartbeatService: jest.Mocked<AgentHeartbeatService>;
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
    } as any;

    mockLoggerService = {
      createComponentLogger: jest.fn().mockReturnValue(mockLogger)
    } as any;
    
    (LoggerService.getInstance as jest.Mock).mockReturnValue(mockLoggerService);
    
    mockStorageService = new StorageService() as jest.Mocked<StorageService>;
    mockTmuxService = new TmuxService() as jest.Mocked<TmuxService>;
    mockAgentHeartbeatService = {
      detectStaleAgents: jest.fn().mockResolvedValue([]),
      getInstance: jest.fn()
    } as any;

    (StorageService as jest.MockedClass<typeof StorageService>).mockImplementation(() => mockStorageService);
    (TmuxService as jest.MockedClass<typeof TmuxService>).mockImplementation(() => mockTmuxService);
    (AgentHeartbeatService.getInstance as jest.Mock).mockReturnValue(mockAgentHeartbeatService);

    // Mock file system
    (existsSync as jest.Mock).mockReturnValue(false);
    (homedir as jest.Mock).mockReturnValue('/mock/home');
    (join as jest.Mock).mockImplementation((...args) => args.join('/'));
    
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
      const performActivityCheckSpy = jest.spyOn(service as any, 'performActivityCheck').mockResolvedValue(undefined);
      
      service.startPolling();
      
      expect(performActivityCheckSpy).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith('Starting activity monitoring with 2-minute intervals (NEW ARCHITECTURE: workingStatus only)');
      expect(service.isRunning()).toBe(true);
    });

    it('should set up recurring polling', () => {
      const performActivityCheckSpy = jest.spyOn(service as any, 'performActivityCheck').mockResolvedValue(undefined);
      
      service.startPolling();
      
      // Fast forward 2 minutes
      jest.advanceTimersByTime(120000);
      
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
      name: 'Test Team',
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      members: [
        {
          id: 'member-1',
          name: 'Test Member 1',
          role: 'developer' as const,
          runtimeType: 'claude-code' as const,
          systemPrompt: 'Test prompt',
          agentStatus: 'active' as const,
          workingStatus: 'idle' as const,
          sessionName: 'test-session-1',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z'
        },
        {
          id: 'member-2',
          name: 'Test Member 2',
          role: 'qa' as const,
          runtimeType: 'claude-code' as const,
          systemPrompt: 'Test prompt 2',
          agentStatus: 'inactive' as const,
          workingStatus: 'idle' as const,
          sessionName: 'test-session-2',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z'
        }
      ]
    };

    const mockWorkingStatusData: TeamWorkingStatusFile = {
      orchestrator: {
        sessionName: AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
        workingStatus: 'idle',
        lastActivityCheck: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      },
      teamMembers: {},
      metadata: {
        lastUpdated: '2023-01-01T00:00:00.000Z',
        version: '1.0.0'
      }
    };

    beforeEach(() => {
      mockStorageService.getTeams.mockResolvedValue([mockTeam]);
      mockTmuxService.sessionExists.mockResolvedValue(true);
      mockTmuxService.capturePane.mockResolvedValue('some terminal output');
      mockAgentHeartbeatService.detectStaleAgents.mockResolvedValue([]);

      // Mock file operations
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockWorkingStatusData));
      (writeFile as jest.Mock).mockResolvedValue(undefined);
      (existsSync as jest.Mock).mockReturnValue(true);
    });

    it('should detect stale agents using AgentHeartbeatService', async () => {
      const staleAgents = ['member-1', 'member-2'];
      mockAgentHeartbeatService.detectStaleAgents.mockResolvedValue(staleAgents);

      await (service as any).performActivityCheck();

      expect(mockAgentHeartbeatService.detectStaleAgents).toHaveBeenCalledWith(30);
      expect(mockLogger.info).toHaveBeenCalledWith('Detected stale agents for potential inactivity', {
        staleAgents,
        thresholdMinutes: 30
      });
    });

    it('should check orchestrator working status and update teamWorkingStatus.json', async () => {
      mockTmuxService.sessionExists.mockResolvedValueOnce(true); // orchestrator session
      mockTmuxService.capturePane.mockResolvedValue('new terminal output');

      await (service as any).performActivityCheck();

      expect(mockTmuxService.sessionExists).toHaveBeenCalledWith(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME);
      expect(mockTmuxService.capturePane).toHaveBeenCalledWith(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME, 5);
    });

    it('should check team member sessions for working status', async () => {
      mockTmuxService.sessionExists.mockResolvedValueOnce(false); // orchestrator session (inactive)
      mockTmuxService.sessionExists.mockResolvedValueOnce(true); // member session

      await (service as any).performActivityCheck();

      expect(mockTmuxService.sessionExists).toHaveBeenCalledWith('test-session-1');
      expect(mockTmuxService.capturePane).toHaveBeenCalledWith('test-session-1', 5);
    });

    it('should set member working status to idle if session no longer exists', async () => {
      mockTmuxService.sessionExists.mockResolvedValueOnce(false); // orchestrator session
      mockTmuxService.sessionExists.mockResolvedValueOnce(false); // member session doesn't exist

      await (service as any).performActivityCheck();

      expect(writeFile).toHaveBeenCalled();
      const savedData = JSON.parse((writeFile as jest.Mock).mock.calls[0][1]);
      expect(savedData.teamMembers['test-session-1'].workingStatus).toBe('idle');
    });

    it('should detect activity and update working status to in_progress', async () => {
      mockTmuxService.sessionExists.mockResolvedValueOnce(false); // orchestrator session
      mockTmuxService.sessionExists.mockResolvedValueOnce(true); // member session exists
      mockTmuxService.capturePane.mockResolvedValue('new terminal output');

      // Simulate different output from cache (activity detected)
      (service as any).lastTerminalOutputs.set('test-session-1', 'old terminal output');

      await (service as any).performActivityCheck();

      expect(writeFile).toHaveBeenCalled();
      const savedData = JSON.parse((writeFile as jest.Mock).mock.calls[0][1]);
      expect(savedData.teamMembers['test-session-1'].workingStatus).toBe('in_progress');
    });

    it('should not update status if no activity detected (same output)', async () => {
      mockTmuxService.sessionExists.mockResolvedValueOnce(false); // orchestrator session
      mockTmuxService.sessionExists.mockResolvedValueOnce(true); // member session exists
      mockTmuxService.capturePane.mockResolvedValue('same terminal output');

      // Simulate same output as cache (no activity)
      (service as any).lastTerminalOutputs.set('test-session-1', 'same terminal output');

      await (service as any).performActivityCheck();

      // Should still update metadata but status should remain idle
      expect(writeFile).toHaveBeenCalled();
      const savedData = JSON.parse((writeFile as jest.Mock).mock.calls[0][1]);
      expect(savedData.teamMembers['test-session-1'].workingStatus).toBe('idle');
    });

    it('should check all members with sessions regardless of status', async () => {
      mockTmuxService.sessionExists.mockResolvedValueOnce(false); // orchestrator session
      mockTmuxService.sessionExists.mockResolvedValueOnce(true); // member-1 session
      mockTmuxService.sessionExists.mockResolvedValueOnce(true); // member-2 session

      await (service as any).performActivityCheck();

      expect(mockTmuxService.sessionExists).toHaveBeenCalledWith('test-session-1');
      expect(mockTmuxService.sessionExists).toHaveBeenCalledWith('test-session-2');
    });

    it('should handle member working status check errors gracefully', async () => {
      mockTmuxService.sessionExists.mockResolvedValueOnce(false); // orchestrator session
      mockTmuxService.sessionExists.mockResolvedValueOnce(true); // member session exists
      mockTmuxService.capturePane.mockRejectedValue(new Error('Capture pane error'));

      await (service as any).performActivityCheck();

      expect(mockLogger.error).toHaveBeenCalledWith('Error checking member working status', {
        teamId: 'test-team',
        memberId: 'member-1',
        memberName: 'Test Member 1',
        sessionName: 'test-session-1',
        error: 'Capture pane error'
      });
    });

    it('should handle overall activity check errors gracefully', async () => {
      mockAgentHeartbeatService.detectStaleAgents.mockRejectedValue(new Error('Heartbeat service error'));

      await (service as any).performActivityCheck();

      expect(mockLogger.error).toHaveBeenCalledWith('Error during activity check', {
        error: 'Heartbeat service error'
      });
    });
  });

  describe('teamWorkingStatus.json file management', () => {
    it('should create default teamWorkingStatus.json if it does not exist', async () => {
      (existsSync as jest.Mock).mockReturnValue(false);

      const result = await (service as any).loadTeamWorkingStatusFile();

      expect(result.orchestrator.sessionName).toBe(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME);
      expect(result.orchestrator.workingStatus).toBe('idle');
      expect(result.teamMembers).toEqual({});
      expect(result.metadata.version).toBe('1.0.0');
    });

    it('should load existing teamWorkingStatus.json file', async () => {
      const mockData = {
        orchestrator: {
          sessionName: AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
          workingStatus: 'in_progress',
          lastActivityCheck: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z'
        },
        teamMembers: {},
        metadata: {
          lastUpdated: '2023-01-01T00:00:00.000Z',
          version: '1.0.0'
        }
      };
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockData));

      const result = await (service as any).loadTeamWorkingStatusFile();

      expect(result.orchestrator.workingStatus).toBe('in_progress');
      expect(result.metadata.version).toBe('1.0.0');
    });

    it('should handle corrupted teamWorkingStatus.json file', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue('invalid json');

      const result = await (service as any).loadTeamWorkingStatusFile();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load teamWorkingStatus.json, creating new file',
        expect.objectContaining({ error: expect.any(String) })
      );
      expect(result.orchestrator.workingStatus).toBe('idle');
    });
  });

  describe('getTeamWorkingStatus', () => {
    it('should return current team working status data', async () => {
      const mockData = {
        orchestrator: {
          sessionName: AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
          workingStatus: 'idle',
          lastActivityCheck: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z'
        },
        teamMembers: {},
        metadata: {
          lastUpdated: '2023-01-01T00:00:00.000Z',
          version: '1.0.0'
        }
      };
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockData));

      const result = await service.getTeamWorkingStatus();

      expect(result).toEqual(mockData);
    });
  });

  describe('getWorkingStatusForSession', () => {
    beforeEach(() => {
      const mockData = {
        orchestrator: {
          sessionName: AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
          workingStatus: 'in_progress',
          lastActivityCheck: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z'
        },
        teamMembers: {
          'test-session': {
            sessionName: 'test-session',
            teamMemberId: 'member-1',
            workingStatus: 'idle',
            lastActivityCheck: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z'
          }
        },
        metadata: {
          lastUpdated: '2023-01-01T00:00:00.000Z',
          version: '1.0.0'
        }
      };
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockData));
    });

    it('should return orchestrator working status', async () => {
      const result = await service.getWorkingStatusForSession(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME);
      expect(result).toBe('in_progress');
    });

    it('should return team member working status', async () => {
      const result = await service.getWorkingStatusForSession('test-session');
      expect(result).toBe('idle');
    });

    it('should return null for non-existent session', async () => {
      const result = await service.getWorkingStatusForSession('non-existent-session');
      expect(result).toBe(null);
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
      expect(service.getPollingInterval()).toBe(120000); // 2 minutes
    });
  });
});