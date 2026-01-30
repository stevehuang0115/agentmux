/**
 * Tests for Scheduler Type Definitions
 *
 * @module types/scheduler.types.test
 */

import {
  ScheduledMessageType,
  EnhancedScheduledMessage,
  RecurringConfig,
  ScheduledMessageMetadata,
  AdaptiveScheduleConfig,
  ActivityInfo,
  ScheduleCheckParams,
  ScheduleRecurringParams,
  ScheduleContinuationParams,
  DEFAULT_SCHEDULES,
  DEFAULT_ADAPTIVE_CONFIG,
  ISchedulerService,
  SchedulerStats,
} from './scheduler.types.js';

describe('Scheduler Types', () => {
  describe('ScheduledMessageType', () => {
    it('should support all scheduled message types', () => {
      const types: ScheduledMessageType[] = [
        'check-in',
        'commit-reminder',
        'progress-check',
        'continuation',
        'custom',
      ];

      expect(types).toHaveLength(5);
      types.forEach((type) => {
        expect(typeof type).toBe('string');
      });
    });
  });

  describe('EnhancedScheduledMessage', () => {
    it('should create a valid enhanced scheduled message', () => {
      const message: EnhancedScheduledMessage = {
        id: 'msg-123',
        sessionName: 'test-session',
        message: 'Test message',
        scheduledFor: new Date(),
        type: 'check-in',
        createdAt: new Date().toISOString(),
      };

      expect(message.id).toBe('msg-123');
      expect(message.sessionName).toBe('test-session');
      expect(message.message).toBe('Test message');
      expect(message.type).toBe('check-in');
      expect(message.scheduledFor).toBeInstanceOf(Date);
      expect(typeof message.createdAt).toBe('string');
    });

    it('should support recurring configuration', () => {
      const message: EnhancedScheduledMessage = {
        id: 'msg-456',
        sessionName: 'recurring-session',
        message: 'Recurring message',
        scheduledFor: new Date(),
        type: 'progress-check',
        recurring: {
          interval: 30,
          maxOccurrences: 10,
          currentOccurrence: 1,
        },
        createdAt: new Date().toISOString(),
      };

      expect(message.recurring).toBeDefined();
      expect(message.recurring?.interval).toBe(30);
      expect(message.recurring?.maxOccurrences).toBe(10);
      expect(message.recurring?.currentOccurrence).toBe(1);
    });

    it('should support metadata', () => {
      const message: EnhancedScheduledMessage = {
        id: 'msg-789',
        sessionName: 'metadata-session',
        message: '',
        scheduledFor: new Date(),
        type: 'continuation',
        metadata: {
          taskId: 'task-001',
          iteration: 3,
          triggerContinuation: true,
          agentId: 'agent-1',
          projectPath: '/path/to/project',
        },
        createdAt: new Date().toISOString(),
      };

      expect(message.metadata).toBeDefined();
      expect(message.metadata?.taskId).toBe('task-001');
      expect(message.metadata?.iteration).toBe(3);
      expect(message.metadata?.triggerContinuation).toBe(true);
      expect(message.metadata?.agentId).toBe('agent-1');
      expect(message.metadata?.projectPath).toBe('/path/to/project');
    });
  });

  describe('RecurringConfig', () => {
    it('should create a valid recurring config with required fields', () => {
      const config: RecurringConfig = {
        interval: 15,
      };

      expect(config.interval).toBe(15);
      expect(config.maxOccurrences).toBeUndefined();
      expect(config.currentOccurrence).toBeUndefined();
    });

    it('should support optional fields', () => {
      const config: RecurringConfig = {
        interval: 30,
        maxOccurrences: 100,
        currentOccurrence: 5,
      };

      expect(config.interval).toBe(30);
      expect(config.maxOccurrences).toBe(100);
      expect(config.currentOccurrence).toBe(5);
    });
  });

  describe('ScheduledMessageMetadata', () => {
    it('should allow arbitrary string keys', () => {
      const metadata: ScheduledMessageMetadata = {
        taskId: 'task-123',
        customField: 'custom-value',
        numericField: 42,
        booleanField: true,
      };

      expect(metadata.taskId).toBe('task-123');
      expect(metadata['customField']).toBe('custom-value');
      expect(metadata['numericField']).toBe(42);
      expect(metadata['booleanField']).toBe(true);
    });
  });

  describe('AdaptiveScheduleConfig', () => {
    it('should create a valid adaptive schedule config', () => {
      const config: AdaptiveScheduleConfig = {
        baseInterval: 20,
        minInterval: 5,
        maxInterval: 60,
        adjustmentFactor: 2.0,
      };

      expect(config.baseInterval).toBe(20);
      expect(config.minInterval).toBe(5);
      expect(config.maxInterval).toBe(60);
      expect(config.adjustmentFactor).toBe(2.0);
    });

    it('should validate constraint that minInterval < baseInterval < maxInterval', () => {
      const config: AdaptiveScheduleConfig = {
        baseInterval: 15,
        minInterval: 5,
        maxInterval: 60,
        adjustmentFactor: 1.5,
      };

      expect(config.minInterval).toBeLessThan(config.baseInterval);
      expect(config.baseInterval).toBeLessThan(config.maxInterval);
    });
  });

  describe('ActivityInfo', () => {
    it('should create activity info for highly active agent', () => {
      const info: ActivityInfo = {
        isHighlyActive: true,
        isIdle: false,
        lastActivityAt: new Date().toISOString(),
        activityLevel: 0.9,
      };

      expect(info.isHighlyActive).toBe(true);
      expect(info.isIdle).toBe(false);
      expect(info.activityLevel).toBe(0.9);
    });

    it('should create activity info for idle agent', () => {
      const info: ActivityInfo = {
        isHighlyActive: false,
        isIdle: true,
        lastActivityAt: new Date(Date.now() - 3600000).toISOString(),
        activityLevel: 0.1,
      };

      expect(info.isHighlyActive).toBe(false);
      expect(info.isIdle).toBe(true);
      expect(info.activityLevel).toBe(0.1);
    });

    it('should support minimal activity info', () => {
      const info: ActivityInfo = {
        isHighlyActive: false,
        isIdle: false,
      };

      expect(info.lastActivityAt).toBeUndefined();
      expect(info.activityLevel).toBeUndefined();
    });
  });

  describe('ScheduleCheckParams', () => {
    it('should create valid schedule check params', () => {
      const params: ScheduleCheckParams = {
        sessionName: 'test-session',
        delayMinutes: 10,
        message: 'Check-in message',
        type: 'check-in',
      };

      expect(params.sessionName).toBe('test-session');
      expect(params.delayMinutes).toBe(10);
      expect(params.message).toBe('Check-in message');
      expect(params.type).toBe('check-in');
    });

    it('should support optional fields', () => {
      const params: ScheduleCheckParams = {
        sessionName: 'test-session',
        delayMinutes: 5,
        message: 'Message',
        metadata: {
          taskId: 'task-001',
        },
      };

      expect(params.type).toBeUndefined();
      expect(params.metadata?.taskId).toBe('task-001');
    });
  });

  describe('ScheduleRecurringParams', () => {
    it('should create valid recurring params', () => {
      const params: ScheduleRecurringParams = {
        sessionName: 'recurring-session',
        interval: 30,
        message: 'Recurring message',
        type: 'progress-check',
        maxOccurrences: 50,
      };

      expect(params.sessionName).toBe('recurring-session');
      expect(params.interval).toBe(30);
      expect(params.message).toBe('Recurring message');
      expect(params.type).toBe('progress-check');
      expect(params.maxOccurrences).toBe(50);
    });
  });

  describe('ScheduleContinuationParams', () => {
    it('should create valid continuation params', () => {
      const params: ScheduleContinuationParams = {
        sessionName: 'continuation-session',
        delayMinutes: 5,
        agentId: 'agent-123',
        projectPath: '/path/to/project',
      };

      expect(params.sessionName).toBe('continuation-session');
      expect(params.delayMinutes).toBe(5);
      expect(params.agentId).toBe('agent-123');
      expect(params.projectPath).toBe('/path/to/project');
    });

    it('should allow minimal params', () => {
      const params: ScheduleContinuationParams = {
        sessionName: 'simple-session',
        delayMinutes: 10,
      };

      expect(params.agentId).toBeUndefined();
      expect(params.projectPath).toBeUndefined();
    });
  });

  describe('DEFAULT_SCHEDULES', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_SCHEDULES.initialCheck).toBe(5);
      expect(DEFAULT_SCHEDULES.progressCheck).toBe(30);
      expect(DEFAULT_SCHEDULES.commitReminder).toBe(25);
    });

    it('should be immutable (readonly)', () => {
      // TypeScript would prevent mutation at compile time
      // This test documents the expected structure
      expect(Object.keys(DEFAULT_SCHEDULES)).toEqual([
        'initialCheck',
        'progressCheck',
        'commitReminder',
      ]);
    });
  });

  describe('DEFAULT_ADAPTIVE_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_ADAPTIVE_CONFIG.baseInterval).toBe(15);
      expect(DEFAULT_ADAPTIVE_CONFIG.minInterval).toBe(5);
      expect(DEFAULT_ADAPTIVE_CONFIG.maxInterval).toBe(60);
      expect(DEFAULT_ADAPTIVE_CONFIG.adjustmentFactor).toBe(1.5);
    });

    it('should have valid interval relationships', () => {
      expect(DEFAULT_ADAPTIVE_CONFIG.minInterval).toBeLessThan(
        DEFAULT_ADAPTIVE_CONFIG.baseInterval
      );
      expect(DEFAULT_ADAPTIVE_CONFIG.baseInterval).toBeLessThan(
        DEFAULT_ADAPTIVE_CONFIG.maxInterval
      );
    });
  });

  describe('ISchedulerService interface', () => {
    it('should document required methods', () => {
      // This test documents the expected interface methods
      const expectedMethods = [
        'scheduleCheck',
        'scheduleRecurringCheck',
        'scheduleDefaultCheckins',
        'scheduleContinuationCheck',
        'scheduleAdaptiveCheckin',
        'cancelCheck',
        'cancelAllChecksForSession',
        'getChecksForSession',
        'getStats',
        'cleanup',
      ];

      // Interface validation is done at compile time
      // This test just documents expected methods
      expect(expectedMethods).toHaveLength(10);
    });
  });

  describe('SchedulerStats', () => {
    it('should create valid scheduler stats', () => {
      const stats: SchedulerStats = {
        oneTimeChecks: 5,
        recurringChecks: 3,
        totalActiveSessions: 4,
        continuationChecks: 2,
        adaptiveChecks: 1,
      };

      expect(stats.oneTimeChecks).toBe(5);
      expect(stats.recurringChecks).toBe(3);
      expect(stats.totalActiveSessions).toBe(4);
      expect(stats.continuationChecks).toBe(2);
      expect(stats.adaptiveChecks).toBe(1);
    });

    it('should support minimal stats', () => {
      const stats: SchedulerStats = {
        oneTimeChecks: 0,
        recurringChecks: 0,
        totalActiveSessions: 0,
      };

      expect(stats.continuationChecks).toBeUndefined();
      expect(stats.adaptiveChecks).toBeUndefined();
    });
  });
});
