import { MessageSchedulerService } from './message-scheduler.service';
import { TmuxService } from '../agent/tmux.service.js';
import { StorageService } from '../core/storage.service.js';
import { ScheduledMessage, MessageDeliveryLog } from '../../types/index';
import { MessageDeliveryLogModel } from '../../models/ScheduledMessage';
import { AGENTMUX_CONSTANTS } from '../../constants.js';

// Mock dependencies
jest.mock('../agent/tmux.service.js');
jest.mock('../core/storage.service.js');
jest.mock('../../models/ScheduledMessage');

describe('MessageSchedulerService', () => {
  let service: MessageSchedulerService;
  let mockTmuxService: jest.Mocked<TmuxService>;
  let mockStorageService: jest.Mocked<StorageService>;

  const mockScheduledMessage: ScheduledMessage = {
    id: 'test-message-1',
    name: 'Test Message',
    targetTeam: 'test-team',
    targetProject: 'test-project',
    message: 'Hello World',
    delayAmount: 5,
    delayUnit: 'minutes',
    isRecurring: false,
    isActive: true,
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z'
  };

  const mockDeliveryLog: MessageDeliveryLog = {
    id: 'log-1',
    scheduledMessageId: 'test-message-1',
    messageName: 'Test Message',
    targetTeam: 'test-team',
    targetProject: 'test-project',
    message: 'Hello World',
    sentAt: '2023-01-01T00:05:00.000Z',
    success: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockTmuxService = {
      sessionExists: jest.fn(),
      sendMessage: jest.fn()
    } as any;
    
    mockStorageService = {
      getScheduledMessages: jest.fn(),
      saveScheduledMessage: jest.fn(),
      saveDeliveryLog: jest.fn()
    } as any;
    
    (MessageDeliveryLogModel.create as jest.Mock).mockReturnValue(mockDeliveryLog);
    
    service = new MessageSchedulerService(mockTmuxService, mockStorageService);
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.useRealTimers();
    service.cleanup();
  });

  describe('constructor', () => {
    it('should initialize with required services', () => {
      expect(service).toBeInstanceOf(MessageSchedulerService);
    });
  });

  describe('start', () => {
    it('should start scheduler and load messages', async () => {
      mockStorageService.getScheduledMessages.mockResolvedValue([mockScheduledMessage]);
      const scheduleMessageSpy = jest.spyOn(service, 'scheduleMessage').mockImplementation();
      
      await service.start();
      
      expect(console.log).toHaveBeenCalledWith('Starting message scheduler service...');
      expect(console.log).toHaveBeenCalledWith('Message scheduler service started');
      expect(mockStorageService.getScheduledMessages).toHaveBeenCalled();
      expect(scheduleMessageSpy).toHaveBeenCalledWith(mockScheduledMessage);
    });

    it('should handle error during message loading', async () => {
      mockStorageService.getScheduledMessages.mockRejectedValue(new Error('Storage error'));
      
      await service.start();
      
      expect(console.error).toHaveBeenCalledWith('Error loading scheduled messages:', expect.any(Error));
    });
  });

  describe('scheduleMessage', () => {
    it('should not schedule inactive messages', () => {
      const inactiveMessage = { ...mockScheduledMessage, isActive: false };
      const cancelMessageSpy = jest.spyOn(service, 'cancelMessage').mockImplementation();
      
      service.scheduleMessage(inactiveMessage);
      
      expect(cancelMessageSpy).not.toHaveBeenCalled();
      expect(service.getStats().activeSchedules).toBe(0);
    });

    it('should schedule one-time message', () => {
      service.scheduleMessage(mockScheduledMessage);
      
      expect(service.getStats().activeSchedules).toBe(1);
      expect(service.getStats().scheduledMessageIds).toContain('test-message-1');
      expect(console.log).toHaveBeenCalledWith(
        'Scheduled message "Test Message" for project test-project to run in 5 minutes'
      );
    });

    it('should schedule recurring message', () => {
      const recurringMessage = { ...mockScheduledMessage, isRecurring: true };
      
      service.scheduleMessage(recurringMessage);
      
      expect(service.getStats().activeSchedules).toBe(1);
      expect(console.log).toHaveBeenCalledWith(
        'Scheduled message "Test Message" for project test-project to run in 5 minutes (recurring)'
      );
    });

    it('should cancel existing message before scheduling', () => {
      const cancelMessageSpy = jest.spyOn(service, 'cancelMessage').mockImplementation();
      
      service.scheduleMessage(mockScheduledMessage);
      
      expect(cancelMessageSpy).toHaveBeenCalledWith('test-message-1');
    });

    it('should execute message after delay', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(true);
      mockTmuxService.sendMessage.mockResolvedValue();
      mockStorageService.saveDeliveryLog.mockResolvedValue();
      mockStorageService.saveScheduledMessage.mockResolvedValue();
      
      service.scheduleMessage(mockScheduledMessage);
      
      // Fast forward past the delay (5 minutes = 300000ms)
      jest.advanceTimersByTime(300000);
      
      // Wait for async operations
      await jest.runAllTimersAsync();
      
      expect(mockTmuxService.sendMessage).toHaveBeenCalledWith('test-team', expect.stringContaining('Hello World'));
      expect(mockTmuxService.sendMessage).toHaveBeenCalledWith('test-team', expect.stringContaining('SCHEDULED CHECK-IN'));
      expect(mockTmuxService.sendMessage).toHaveBeenCalledWith('test-team', expect.stringContaining('CONTINUE'));
      expect(mockTmuxService.sendMessage).toHaveBeenCalledWith('test-team', expect.stringContaining('resume that work now'));
      expect(mockStorageService.saveDeliveryLog).toHaveBeenCalled();
      expect(mockStorageService.saveScheduledMessage).toHaveBeenCalled();
    });

    it('should reschedule recurring messages', async () => {
      const recurringMessage = { ...mockScheduledMessage, isRecurring: true };
      mockTmuxService.sessionExists.mockResolvedValue(true);
      mockTmuxService.sendMessage.mockResolvedValue();
      mockStorageService.saveDeliveryLog.mockResolvedValue();
      mockStorageService.saveScheduledMessage.mockResolvedValue();
      
      service.scheduleMessage(recurringMessage);
      
      // Execute first occurrence
      jest.advanceTimersByTime(300000);
      await Promise.resolve(); // Allow async operations to complete
      
      // Should still have an active schedule for next occurrence
      expect(service.getStats().activeSchedules).toBe(1);
    });

    it('should remove one-time messages after execution', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(true);
      mockTmuxService.sendMessage.mockResolvedValue();
      mockStorageService.saveDeliveryLog.mockResolvedValue();
      mockStorageService.saveScheduledMessage.mockResolvedValue();
      
      service.scheduleMessage(mockScheduledMessage);
      
      // Execute the message
      jest.advanceTimersByTime(300000);
      await jest.runAllTimersAsync();
      
      // Should be removed from active schedules
      expect(service.getStats().activeSchedules).toBe(0);
    });
  });

  describe('cancelMessage', () => {
    it('should cancel scheduled message', () => {
      service.scheduleMessage(mockScheduledMessage);
      expect(service.getStats().activeSchedules).toBe(1);
      
      service.cancelMessage('test-message-1');
      
      expect(service.getStats().activeSchedules).toBe(0);
      expect(console.log).toHaveBeenCalledWith('Cancelled scheduled message: test-message-1');
    });

    it('should do nothing if message does not exist', () => {
      service.cancelMessage('nonexistent-message');
      
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('Cancelled'));
    });
  });

  describe('rescheduleAllMessages', () => {
    it('should cancel all and reload messages', async () => {
      mockStorageService.getScheduledMessages.mockResolvedValue([mockScheduledMessage]);
      const cancelAllSpy = jest.spyOn(service, 'cancelAllMessages').mockImplementation();
      const scheduleMessageSpy = jest.spyOn(service, 'scheduleMessage').mockImplementation();
      
      await service.rescheduleAllMessages();
      
      expect(console.log).toHaveBeenCalledWith('Rescheduling all messages...');
      expect(cancelAllSpy).toHaveBeenCalled();
      expect(mockStorageService.getScheduledMessages).toHaveBeenCalled();
      expect(scheduleMessageSpy).toHaveBeenCalledWith(mockScheduledMessage);
    });
  });

  describe('cancelAllMessages', () => {
    it('should cancel all scheduled messages', () => {
      service.scheduleMessage(mockScheduledMessage);
      service.scheduleMessage({ ...mockScheduledMessage, id: 'test-message-2' });
      expect(service.getStats().activeSchedules).toBe(2);
      
      service.cancelAllMessages();
      
      expect(service.getStats().activeSchedules).toBe(0);
      expect(console.log).toHaveBeenCalledWith('Cancelled all scheduled messages');
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      service.scheduleMessage(mockScheduledMessage);
      service.scheduleMessage({ ...mockScheduledMessage, id: 'test-message-2' });
      
      const stats = service.getStats();
      
      expect(stats).toEqual({
        activeSchedules: 2,
        scheduledMessageIds: ['test-message-1', 'test-message-2']
      });
    });
  });

  describe('executeMessage', () => {
    beforeEach(() => {
      mockTmuxService.sessionExists.mockResolvedValue(true);
      mockTmuxService.sendMessage.mockResolvedValue();
      mockStorageService.saveDeliveryLog.mockResolvedValue();
      mockStorageService.saveScheduledMessage.mockResolvedValue();
    });

    it('should execute message for orchestrator team', async () => {
      const orchestratorMessage = { ...mockScheduledMessage, targetTeam: 'orchestrator' };
      
      await (service as any).executeMessage(orchestratorMessage);
      
      expect(mockTmuxService.sessionExists).toHaveBeenCalledWith(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME);
      expect(mockTmuxService.sendMessage).toHaveBeenCalledWith(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME, expect.stringContaining('Hello World'));
      expect(mockTmuxService.sendMessage).toHaveBeenCalledWith(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME, expect.stringContaining('SCHEDULED CHECK-IN'));
    });

    it('should execute message for regular team', async () => {
      await (service as any).executeMessage(mockScheduledMessage);
      
      expect(mockTmuxService.sessionExists).toHaveBeenCalledWith('test-team');
      expect(mockTmuxService.sendMessage).toHaveBeenCalledWith('test-team', expect.stringContaining('Hello World'));
      expect(mockTmuxService.sendMessage).toHaveBeenCalledWith('test-team', expect.stringContaining('SCHEDULED CHECK-IN'));
      expect(mockTmuxService.sendMessage).toHaveBeenCalledWith('test-team', expect.stringContaining('CONTINUE'));
      expect(mockTmuxService.sendMessage).toHaveBeenCalledWith('test-team', expect.stringContaining('resume that work now'));
    });

    it('should handle session not existing', async () => {
      mockTmuxService.sessionExists.mockResolvedValue(false);
      
      await (service as any).executeMessage(mockScheduledMessage);
      
      expect(mockTmuxService.sendMessage).not.toHaveBeenCalled();
      expect(MessageDeliveryLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Target session "test-team" does not exist'
        })
      );
    });

    it('should handle message sending error', async () => {
      mockTmuxService.sendMessage.mockRejectedValue(new Error('Send error'));
      
      await (service as any).executeMessage(mockScheduledMessage);
      
      expect(MessageDeliveryLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Send error'
        })
      );
    });

    it('should create delivery log', async () => {
      await (service as any).executeMessage(mockScheduledMessage);
      
      expect(MessageDeliveryLogModel.create).toHaveBeenCalledWith({
        scheduledMessageId: 'test-message-1',
        messageName: 'Test Message',
        targetTeam: 'test-team',
        targetProject: 'test-project',
        message: expect.stringContaining('Hello World'),
        success: true,
        error: undefined
      });
      expect(mockStorageService.saveDeliveryLog).toHaveBeenCalledWith(mockDeliveryLog);
    });

    it('should handle delivery log save error', async () => {
      mockStorageService.saveDeliveryLog.mockRejectedValue(new Error('Log save error'));
      
      await (service as any).executeMessage(mockScheduledMessage);
      
      expect(console.error).toHaveBeenCalledWith('Error saving delivery log:', expect.any(Error));
    });

    it('should update message last run time', async () => {
      await (service as any).executeMessage(mockScheduledMessage);
      
      expect(mockStorageService.saveScheduledMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          lastRun: expect.any(String),
          updatedAt: expect.any(String)
        })
      );
    });

    it('should deactivate one-time messages after execution', async () => {
      await (service as any).executeMessage(mockScheduledMessage);
      
      expect(mockStorageService.saveScheduledMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false
        })
      );
      expect(console.log).toHaveBeenCalledWith('One-off message "Test Message" has been deactivated after execution');
    });

    it('should keep recurring messages active', async () => {
      const recurringMessage = { ...mockScheduledMessage, isRecurring: true };
      
      await (service as any).executeMessage(recurringMessage);
      
      expect(mockStorageService.saveScheduledMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true
        })
      );
    });

    it('should handle message update error', async () => {
      mockStorageService.saveScheduledMessage.mockRejectedValue(new Error('Update error'));
      
      await (service as any).executeMessage(mockScheduledMessage);
      
      expect(console.error).toHaveBeenCalledWith('Error updating message last run time:', expect.any(Error));
    });

    it('should emit message_executed event', async () => {
      const emitSpy = jest.spyOn(service, 'emit');
      
      await (service as any).executeMessage(mockScheduledMessage);
      
      expect(emitSpy).toHaveBeenCalledWith('message_executed', {
        message: mockScheduledMessage,
        deliveryLog: mockDeliveryLog,
        success: true
      });
    });
  });

  describe('getDelayInMilliseconds', () => {
    it('should convert seconds to milliseconds', () => {
      const result = (service as any).getDelayInMilliseconds(30, 'seconds');
      expect(result).toBe(30000);
    });

    it('should convert minutes to milliseconds', () => {
      const result = (service as any).getDelayInMilliseconds(5, 'minutes');
      expect(result).toBe(300000);
    });

    it('should convert hours to milliseconds', () => {
      const result = (service as any).getDelayInMilliseconds(2, 'hours');
      expect(result).toBe(7200000);
    });

    it('should throw error for invalid unit', () => {
      expect(() => {
        (service as any).getDelayInMilliseconds(1, 'days' as any);
      }).toThrow('Invalid delay unit: days');
    });
  });

  describe('loadAndScheduleAllMessages', () => {
    it('should load and schedule all active messages', async () => {
      const messages = [
        mockScheduledMessage,
        { ...mockScheduledMessage, id: 'message-2', isActive: false },
        { ...mockScheduledMessage, id: 'message-3', isActive: true }
      ];
      mockStorageService.getScheduledMessages.mockResolvedValue(messages);
      const scheduleMessageSpy = jest.spyOn(service, 'scheduleMessage').mockImplementation();
      
      await (service as any).loadAndScheduleAllMessages();
      
      expect(console.log).toHaveBeenCalledWith('Found 2 active scheduled messages to schedule');
      expect(scheduleMessageSpy).toHaveBeenCalledTimes(2);
      expect(scheduleMessageSpy).toHaveBeenCalledWith(mockScheduledMessage);
      expect(scheduleMessageSpy).toHaveBeenCalledWith({ ...mockScheduledMessage, id: 'message-3', isActive: true });
    });

    it('should handle storage error', async () => {
      mockStorageService.getScheduledMessages.mockRejectedValue(new Error('Storage error'));
      
      await (service as any).loadAndScheduleAllMessages();
      
      expect(console.error).toHaveBeenCalledWith('Error loading scheduled messages:', expect.any(Error));
    });
  });

  describe('cleanup', () => {
    it('should cleanup all timers', () => {
      service.scheduleMessage(mockScheduledMessage);
      service.scheduleMessage({ ...mockScheduledMessage, id: 'message-2' });
      expect(service.getStats().activeSchedules).toBe(2);
      
      service.cleanup();
      
      expect(service.getStats().activeSchedules).toBe(0);
      expect(console.log).toHaveBeenCalledWith('Message scheduler service cleaned up');
    });
  });

  describe('Sequential Message Processing', () => {
    const mockAutoAssignmentMessage: ScheduledMessage = {
      id: 'auto-assign-project-123',
      name: 'Auto Task Assignment - Test Project',
      targetTeam: AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
      targetProject: 'project-123',
      message: 'Auto assignment check message',
      delayAmount: 15,
      delayUnit: 'minutes',
      isRecurring: true,
      isActive: true,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z'
    };

    beforeEach(() => {
      // Setup mocks for successful execution
      mockTmuxService.sessionExists.mockResolvedValue(true);
      mockTmuxService.sendMessage.mockResolvedValue(undefined);
      mockStorageService.saveDeliveryLog.mockResolvedValue(undefined);
      mockStorageService.saveScheduledMessage.mockResolvedValue(undefined);
      (MessageDeliveryLogModel.create as jest.Mock).mockReturnValue(mockDeliveryLog);
    });

    it('should identify auto-assignment messages and process them sequentially', async () => {
      const executeMessageSpy = jest.spyOn(service as any, 'executeMessage');
      const executeMessageSequentiallySpy = jest.spyOn(service as any, 'executeMessageSequentially').mockResolvedValue(undefined);

      // Schedule the auto-assignment message
      service.scheduleMessage(mockAutoAssignmentMessage);

      // Fast forward to trigger execution
      jest.advanceTimersByTime(15 * 60 * 1000);
      await Promise.resolve(); // Allow async execution

      expect(executeMessageSequentiallySpy).toHaveBeenCalledWith(mockAutoAssignmentMessage);
      expect(executeMessageSpy).not.toHaveBeenCalledWith(mockAutoAssignmentMessage);
    });

    it('should process regular messages through queue (all messages go through queue now)', async () => {
      const regularMessage = { ...mockScheduledMessage, delayAmount: 1, delayUnit: 'seconds' as const };
      const executeMessageSpy = jest.spyOn(service as any, 'executeMessage');
      const executeMessageSequentiallySpy = jest.spyOn(service as any, 'executeMessageSequentially').mockResolvedValue(undefined);

      // Schedule regular message
      service.scheduleMessage(regularMessage);

      // Fast forward to trigger execution
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(executeMessageSequentiallySpy).toHaveBeenCalledWith(regularMessage);
      expect(executeMessageSpy).not.toHaveBeenCalledWith(regularMessage);
    });

    it.skip('should process multiple auto-assignment messages sequentially', async () => {
      const message1 = { ...mockAutoAssignmentMessage, id: 'auto-assign-1', targetProject: 'project-1' };
      const message2 = { ...mockAutoAssignmentMessage, id: 'auto-assign-2', targetProject: 'project-2' };
      const message3 = { ...mockAutoAssignmentMessage, id: 'auto-assign-3', targetProject: 'project-3' };

      const executionOrder: string[] = [];
      jest.spyOn(service as any, 'executeMessage').mockImplementation(async (...args: any[]) => {
        const msg = args[0] as ScheduledMessage;
        executionOrder.push(msg.id);
        // No artificial delay needed for testing
        await Promise.resolve();
      });

      // Process messages through sequential queue
      const promises = [
        (service as any).executeMessageSequentially(message1),
        (service as any).executeMessageSequentially(message2),
        (service as any).executeMessageSequentially(message3)
      ];

      // Start the processing
      const completionPromise = Promise.all(promises);
      
      // Advance timers to allow sequential processing with delays
      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(2000);
        await Promise.resolve(); // Allow async operations to complete
      }
      
      await completionPromise;

      // Verify they were processed in order
      expect(executionOrder).toEqual(['auto-assign-1', 'auto-assign-2', 'auto-assign-3']);
    });

    it('should handle errors in sequential processing', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const failingMessage = { ...mockAutoAssignmentMessage, id: 'failing-message' };
      
      jest.spyOn(service as any, 'executeMessage').mockRejectedValue(new Error('Execution failed'));

      await expect((service as any).executeMessageSequentially(failingMessage))
        .rejects.toThrow('Execution failed');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error processing queued message "Auto Task Assignment - Test Project":',
        expect.any(Error)
      );
    });

    it.skip('should add delay between sequential executions', async () => {
      const message1 = { ...mockAutoAssignmentMessage, id: 'auto-assign-delay-1' };
      const message2 = { ...mockAutoAssignmentMessage, id: 'auto-assign-delay-2' };

      let executeCallCount = 0;
      jest.spyOn(service as any, 'executeMessage').mockImplementation(async () => {
        executeCallCount++;
      });

      const promises = [
        (service as any).executeMessageSequentially(message1),
        (service as any).executeMessageSequentially(message2)
      ];

      // Start the promises (first will start processing immediately)
      const promiseCompletion = Promise.all(promises);

      // Advance past the first execution delay
      jest.advanceTimersByTime(2000);
      await Promise.resolve(); // Let the first execution complete

      // Advance past the second execution delay  
      jest.advanceTimersByTime(2000);
      await promiseCompletion;

      // Verify both messages were processed
      expect(executeCallCount).toBe(2);
    });

    it.skip('should log queue processing information', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const queueMessage = { ...mockAutoAssignmentMessage, targetProject: 'test-project-queue' };

      const executionPromise = (service as any).executeMessageSequentially(queueMessage);
      
      // Advance timers to allow the delay in queue processing
      jest.advanceTimersByTime(2000);
      await executionPromise;

      expect(consoleSpy).toHaveBeenCalledWith(
        'Processing auto-assignment message for project test-project-queue (queue length: 0)'
      );
      expect(consoleSpy).toHaveBeenCalledWith('Finished processing message queue');
    });
  });
});