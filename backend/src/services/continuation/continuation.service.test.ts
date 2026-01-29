/**
 * Tests for ContinuationService
 *
 * @module services/continuation/continuation.service.test
 */

import { ContinuationService } from './continuation.service.js';
import { ContinuationEventEmitter } from './continuation-events.service.js';
import { OutputAnalyzer } from './output-analyzer.service.js';
import { ContinuationEvent, AgentStateAnalysis } from '../../types/continuation.types.js';

// Mock LoggerService
jest.mock('../core/logger.service.js', () => ({
  LoggerService: {
    getInstance: jest.fn(() => ({
      createComponentLogger: jest.fn(() => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      })),
    })),
  },
}));

// Mock the dependencies
jest.mock('./continuation-events.service.js');
jest.mock('./output-analyzer.service.js');

describe('ContinuationService', () => {
  let service: ContinuationService;
  let mockEventEmitter: jest.Mocked<ContinuationEventEmitter>;
  let mockOutputAnalyzer: jest.Mocked<OutputAnalyzer>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock event emitter
    mockEventEmitter = {
      on: jest.fn(),
      off: jest.fn(),
    } as unknown as jest.Mocked<ContinuationEventEmitter>;

    (ContinuationEventEmitter.getInstance as jest.Mock).mockReturnValue(mockEventEmitter);

    // Setup mock output analyzer
    mockOutputAnalyzer = {
      analyze: jest.fn(),
    } as unknown as jest.Mocked<OutputAnalyzer>;

    (OutputAnalyzer.getInstance as jest.Mock).mockReturnValue(mockOutputAnalyzer);

    // Clear and get fresh service instance
    ContinuationService.clearInstance();
    service = ContinuationService.getInstance();
  });

  afterEach(() => {
    ContinuationService.clearInstance();
  });

  describe('getInstance', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = ContinuationService.getInstance();
      const instance2 = ContinuationService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create a new instance after clearInstance', () => {
      const instance1 = ContinuationService.getInstance();
      ContinuationService.clearInstance();
      const instance2 = ContinuationService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('start/stop', () => {
    it('should start the service and subscribe to events', async () => {
      await service.start();

      expect(mockEventEmitter.on).toHaveBeenCalledWith('continuation', expect.any(Function));
      expect(service.isServiceRunning()).toBe(true);
    });

    it('should not start twice', async () => {
      await service.start();
      await service.start();

      expect(mockEventEmitter.on).toHaveBeenCalledTimes(1);
    });

    it('should stop the service and unsubscribe from events', async () => {
      await service.start();
      await service.stop();

      expect(mockEventEmitter.off).toHaveBeenCalledWith('continuation', expect.any(Function));
      expect(service.isServiceRunning()).toBe(false);
    });

    it('should handle stop when not running', async () => {
      await service.stop();
      expect(mockEventEmitter.off).not.toHaveBeenCalled();
    });
  });

  describe('handleEvent', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should handle continuation event and return result', async () => {
      const mockAnalysis: AgentStateAnalysis = {
        conclusion: 'INCOMPLETE',
        confidence: 0.7,
        evidence: ['Session appears idle'],
        recommendation: 'inject_prompt',
        iterations: 1,
        maxIterations: 10,
      };

      mockOutputAnalyzer.analyze.mockResolvedValue(mockAnalysis);

      const event: ContinuationEvent = {
        trigger: 'activity_idle',
        sessionName: 'test-session',
        agentId: 'agent-001',
        projectPath: '/path/to/project',
        timestamp: new Date().toISOString(),
        metadata: { lastOutput: 'some output' },
      };

      const result = await service.handleEvent(event);

      expect(result.success).toBe(true);
      expect(result.action).toBe('inject_prompt');
      expect(mockOutputAnalyzer.analyze).toHaveBeenCalledWith('test-session', 'some output', expect.any(Object));
    });

    it('should return no_action when continuation is disabled', async () => {
      const config = await service.getSessionConfig('test-session');
      config.enabled = false;

      const event: ContinuationEvent = {
        trigger: 'activity_idle',
        sessionName: 'test-session',
        agentId: 'agent-001',
        projectPath: '/path/to/project',
        timestamp: new Date().toISOString(),
        metadata: {},
      };

      const result = await service.handleEvent(event);

      expect(result.success).toBe(true);
      expect(result.action).toBe('no_action');
      expect(result.message).toContain('disabled');
    });

    it('should handle TASK_COMPLETE with auto-assign', async () => {
      const mockAnalysis: AgentStateAnalysis = {
        conclusion: 'TASK_COMPLETE',
        confidence: 0.95,
        evidence: ['Agent called complete_task'],
        recommendation: 'assign_next_task',
        iterations: 5,
        maxIterations: 10,
      };

      mockOutputAnalyzer.analyze.mockResolvedValue(mockAnalysis);

      const event: ContinuationEvent = {
        trigger: 'explicit_request',
        sessionName: 'test-session',
        agentId: 'agent-001',
        projectPath: '/path/to/project',
        timestamp: new Date().toISOString(),
        metadata: {},
      };

      const result = await service.handleEvent(event);

      expect(result.success).toBe(true);
      expect(result.action).toBe('assign_next_task');
    });

    it('should notify owner when auto-assign is disabled', async () => {
      const config = await service.getSessionConfig('test-session');
      config.autoAssignNext = false;

      const mockAnalysis: AgentStateAnalysis = {
        conclusion: 'TASK_COMPLETE',
        confidence: 0.95,
        evidence: ['Task completed'],
        recommendation: 'assign_next_task',
        iterations: 5,
        maxIterations: 10,
      };

      mockOutputAnalyzer.analyze.mockResolvedValue(mockAnalysis);

      const event: ContinuationEvent = {
        trigger: 'explicit_request',
        sessionName: 'test-session',
        agentId: 'agent-001',
        projectPath: '/path/to/project',
        timestamp: new Date().toISOString(),
        metadata: {},
      };

      const result = await service.handleEvent(event);

      expect(result.success).toBe(true);
      expect(result.action).toBe('notify_owner');
    });

    it('should handle STUCK_OR_ERROR with retry hints', async () => {
      const mockAnalysis: AgentStateAnalysis = {
        conclusion: 'STUCK_OR_ERROR',
        confidence: 0.8,
        evidence: ['Error detected: compile'],
        recommendation: 'retry_with_hints',
        iterations: 2,
        maxIterations: 10,
      };

      mockOutputAnalyzer.analyze.mockResolvedValue(mockAnalysis);

      const event: ContinuationEvent = {
        trigger: 'pty_exit',
        sessionName: 'test-session',
        agentId: 'agent-001',
        projectPath: '/path/to/project',
        timestamp: new Date().toISOString(),
        metadata: { exitCode: 1 },
      };

      const result = await service.handleEvent(event);

      expect(result.success).toBe(true);
      expect(result.action).toBe('retry_with_hints');
    });

    it('should handle WAITING_INPUT with notification', async () => {
      const mockAnalysis: AgentStateAnalysis = {
        conclusion: 'WAITING_INPUT',
        confidence: 0.75,
        evidence: ['Agent is asking a question'],
        recommendation: 'notify_owner',
        iterations: 1,
        maxIterations: 10,
      };

      mockOutputAnalyzer.analyze.mockResolvedValue(mockAnalysis);

      const event: ContinuationEvent = {
        trigger: 'activity_idle',
        sessionName: 'test-session',
        agentId: 'agent-001',
        projectPath: '/path/to/project',
        timestamp: new Date().toISOString(),
        metadata: { lastOutput: 'What should I do?' },
      };

      const result = await service.handleEvent(event);

      expect(result.success).toBe(true);
      expect(result.action).toBe('notify_owner');
    });

    it('should handle MAX_ITERATIONS', async () => {
      const mockAnalysis: AgentStateAnalysis = {
        conclusion: 'MAX_ITERATIONS',
        confidence: 1.0,
        evidence: ['Reached 10/10 iterations'],
        recommendation: 'notify_owner',
        iterations: 10,
        maxIterations: 10,
      };

      mockOutputAnalyzer.analyze.mockResolvedValue(mockAnalysis);

      const event: ContinuationEvent = {
        trigger: 'activity_idle',
        sessionName: 'test-session',
        agentId: 'agent-001',
        projectPath: '/path/to/project',
        timestamp: new Date().toISOString(),
        metadata: {},
      };

      const result = await service.handleEvent(event);

      expect(result.success).toBe(true);
      expect(result.action).toBe('notify_owner');
    });

    it('should handle errors gracefully', async () => {
      mockOutputAnalyzer.analyze.mockRejectedValue(new Error('Analysis failed'));

      const event: ContinuationEvent = {
        trigger: 'activity_idle',
        sessionName: 'test-session',
        agentId: 'agent-001',
        projectPath: '/path/to/project',
        timestamp: new Date().toISOString(),
        metadata: {},
      };

      const result = await service.handleEvent(event);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Analysis failed');
    });
  });

  describe('iteration tracking', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should track iterations across events', async () => {
      const mockAnalysis: AgentStateAnalysis = {
        conclusion: 'INCOMPLETE',
        confidence: 0.7,
        evidence: ['Idle'],
        recommendation: 'inject_prompt',
        iterations: 0,
        maxIterations: 10,
      };

      mockOutputAnalyzer.analyze.mockResolvedValue(mockAnalysis);

      const event: ContinuationEvent = {
        trigger: 'activity_idle',
        sessionName: 'test-session',
        agentId: 'agent-001',
        projectPath: '/path/to/project',
        timestamp: new Date().toISOString(),
        metadata: {},
      };

      // First event
      await service.handleEvent(event);

      const tracking1 = await service.getIterationTracking('test-session');
      expect(tracking1).toBeDefined();
      expect(tracking1!.iterations).toBe(1);

      // Second event
      await service.handleEvent(event);

      const tracking2 = await service.getIterationTracking('test-session');
      expect(tracking2!.iterations).toBe(2);
    });

    it('should reset iterations', async () => {
      const mockAnalysis: AgentStateAnalysis = {
        conclusion: 'INCOMPLETE',
        confidence: 0.7,
        evidence: ['Idle'],
        recommendation: 'inject_prompt',
        iterations: 0,
        maxIterations: 10,
      };

      mockOutputAnalyzer.analyze.mockResolvedValue(mockAnalysis);

      const event: ContinuationEvent = {
        trigger: 'activity_idle',
        sessionName: 'test-session',
        agentId: 'agent-001',
        projectPath: '/path/to/project',
        timestamp: new Date().toISOString(),
        metadata: {},
      };

      await service.handleEvent(event);
      await service.handleEvent(event);

      await service.resetIterations('test-session');

      const tracking = await service.getIterationTracking('test-session');
      expect(tracking!.iterations).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should return default config for new session', async () => {
      const config = await service.getSessionConfig('new-session');

      expect(config.enabled).toBe(true);
      expect(config.autoAssignNext).toBe(true);
      expect(config.maxIterations).toBe(10);
    });

    it('should set max iterations', async () => {
      await service.setMaxIterations('test-session', 20);

      const config = await service.getSessionConfig('test-session');
      expect(config.maxIterations).toBe(20);
    });

    it('should cap max iterations at absolute max', async () => {
      await service.setMaxIterations('test-session', 1000);

      const config = await service.getSessionConfig('test-session');
      expect(config.maxIterations).toBe(50); // ABSOLUTE_MAX
    });
  });

  describe('notifications', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should store notifications', async () => {
      const mockAnalysis: AgentStateAnalysis = {
        conclusion: 'WAITING_INPUT',
        confidence: 0.75,
        evidence: ['Waiting for input'],
        recommendation: 'notify_owner',
        iterations: 1,
        maxIterations: 10,
      };

      mockOutputAnalyzer.analyze.mockResolvedValue(mockAnalysis);

      const event: ContinuationEvent = {
        trigger: 'activity_idle',
        sessionName: 'test-session',
        agentId: 'agent-001',
        projectPath: '/path/to/project',
        timestamp: new Date().toISOString(),
        metadata: {},
      };

      await service.handleEvent(event);

      const notifications = service.getNotifications();
      expect(notifications.length).toBe(1);
      expect(notifications[0].sessionName).toBe('test-session');
      expect(notifications[0].acknowledged).toBe(false);
    });

    it('should get unacknowledged notifications only', async () => {
      const mockAnalysis: AgentStateAnalysis = {
        conclusion: 'WAITING_INPUT',
        confidence: 0.75,
        evidence: ['Waiting'],
        recommendation: 'notify_owner',
        iterations: 1,
        maxIterations: 10,
      };

      mockOutputAnalyzer.analyze.mockResolvedValue(mockAnalysis);

      const event: ContinuationEvent = {
        trigger: 'activity_idle',
        sessionName: 'test-session',
        agentId: 'agent-001',
        projectPath: '/path/to/project',
        timestamp: new Date().toISOString(),
        metadata: {},
      };

      await service.handleEvent(event);

      const notifications = service.getNotifications();
      service.acknowledgeNotification(notifications[0].timestamp);

      const unacknowledged = service.getNotifications(true);
      expect(unacknowledged.length).toBe(0);
    });
  });

  describe('session status', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should update session status after event', async () => {
      const mockAnalysis: AgentStateAnalysis = {
        conclusion: 'INCOMPLETE',
        confidence: 0.7,
        evidence: ['Idle'],
        recommendation: 'inject_prompt',
        iterations: 0,
        maxIterations: 10,
      };

      mockOutputAnalyzer.analyze.mockResolvedValue(mockAnalysis);

      const event: ContinuationEvent = {
        trigger: 'activity_idle',
        sessionName: 'test-session',
        agentId: 'agent-001',
        projectPath: '/path/to/project',
        timestamp: new Date().toISOString(),
        metadata: {},
      };

      await service.handleEvent(event);

      const status = await service.getSessionStatus('test-session');
      expect(status).toBeDefined();
      expect(status!.isMonitored).toBe(true);
      expect(status!.lastAnalysis?.conclusion).toBe('INCOMPLETE');
    });

    it('should return active monitors', async () => {
      const mockAnalysis: AgentStateAnalysis = {
        conclusion: 'INCOMPLETE',
        confidence: 0.7,
        evidence: ['Idle'],
        recommendation: 'inject_prompt',
        iterations: 0,
        maxIterations: 10,
      };

      mockOutputAnalyzer.analyze.mockResolvedValue(mockAnalysis);

      const event1: ContinuationEvent = {
        trigger: 'activity_idle',
        sessionName: 'session-1',
        agentId: 'agent-001',
        projectPath: '/path/to/project',
        timestamp: new Date().toISOString(),
        metadata: {},
      };

      const event2: ContinuationEvent = {
        trigger: 'activity_idle',
        sessionName: 'session-2',
        agentId: 'agent-002',
        projectPath: '/path/to/project',
        timestamp: new Date().toISOString(),
        metadata: {},
      };

      await service.handleEvent(event1);
      await service.handleEvent(event2);

      const monitors = service.getActiveMonitors();
      expect(monitors).toContain('session-1');
      expect(monitors).toContain('session-2');
    });

    it('should return null for unknown session', async () => {
      const status = await service.getSessionStatus('unknown-session');
      expect(status).toBeNull();
    });
  });
});
