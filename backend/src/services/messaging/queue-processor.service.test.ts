/**
 * Tests for QueueProcessorService
 *
 * @module services/messaging/queue-processor.test
 */

import { EventEmitter } from 'events';
import { QueueProcessorService } from './queue-processor.service.js';
import { MessageQueueService } from './message-queue.service.js';
import { ResponseRouterService } from './response-router.service.js';

// Mock constants
jest.mock('../../constants.js', () => ({
  MESSAGE_QUEUE_CONSTANTS: {
    MAX_QUEUE_SIZE: 100,
    DEFAULT_MESSAGE_TIMEOUT: 5000,
    MAX_HISTORY_SIZE: 50,
    INTER_MESSAGE_DELAY: 10,
    PERSISTENCE_FILE: 'message-queue.json',
    PERSISTENCE_DIR: 'queue',
    SOCKET_EVENTS: {
      MESSAGE_ENQUEUED: 'queue:message_enqueued',
      MESSAGE_PROCESSING: 'queue:message_processing',
      MESSAGE_COMPLETED: 'queue:message_completed',
      MESSAGE_FAILED: 'queue:message_failed',
      MESSAGE_CANCELLED: 'queue:message_cancelled',
      STATUS_UPDATE: 'queue:status_update',
    },
  },
  ORCHESTRATOR_SESSION_NAME: 'agentmux-orc',
  CHAT_CONSTANTS: {
    MESSAGE_PREFIX: 'CHAT',
  },
  EVENT_DELIVERY_CONSTANTS: {
    AGENT_READY_TIMEOUT: 5000,
    AGENT_READY_POLL_INTERVAL: 500,
    PROMPT_DETECTION_TIMEOUT: 5000,
    TOTAL_DELIVERY_TIMEOUT: 10000,
  },
}));

// Mock LoggerService
jest.mock('../core/logger.service.js', () => ({
  LoggerService: {
    getInstance: () => ({
      createComponentLogger: () => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }),
    }),
  },
}));

// Create a mock chat service that extends EventEmitter
const mockChatService = new EventEmitter();
(mockChatService as any).addSystemMessage = jest.fn().mockResolvedValue(undefined);

jest.mock('../chat/chat.service.js', () => ({
  getChatService: () => mockChatService,
}));

// Mock terminal gateway
const mockSetActiveConversationId = jest.fn();
jest.mock('../../websocket/terminal.gateway.js', () => ({
  getTerminalGateway: () => ({
    setActiveConversationId: mockSetActiveConversationId,
  }),
}));

describe('QueueProcessorService', () => {
  let queueService: MessageQueueService;
  let responseRouter: ResponseRouterService;
  let mockAgentRegistrationService: any;
  let processor: QueueProcessorService;

  beforeEach(() => {
    jest.useFakeTimers();
    queueService = new MessageQueueService();
    responseRouter = new ResponseRouterService();
    mockAgentRegistrationService = {
      sendMessageToAgent: jest.fn().mockResolvedValue({ success: true }),
      waitForAgentReady: jest.fn().mockResolvedValue(true),
    };

    processor = new QueueProcessorService(
      queueService,
      responseRouter,
      mockAgentRegistrationService
    );

    jest.clearAllMocks();
    mockChatService.removeAllListeners();
  });

  afterEach(() => {
    processor.stop();
    jest.useRealTimers();
  });

  describe('start/stop', () => {
    it('should start the processor', () => {
      processor.start();
      expect(processor.isRunning()).toBe(true);
    });

    it('should be idempotent on start', () => {
      processor.start();
      processor.start();
      expect(processor.isRunning()).toBe(true);
    });

    it('should stop the processor', () => {
      processor.start();
      processor.stop();
      expect(processor.isRunning()).toBe(false);
    });

    it('should be idempotent on stop', () => {
      processor.stop();
      expect(processor.isRunning()).toBe(false);
    });
  });

  describe('isProcessingMessage', () => {
    it('should return false when idle', () => {
      expect(processor.isProcessingMessage()).toBe(false);
    });
  });

  describe('message processing', () => {
    it('should process enqueued messages', async () => {
      processor.start();

      queueService.enqueue({
        content: 'Hello',
        conversationId: 'conv-1',
        source: 'web_chat',
      });

      // Advance timers to trigger processNext
      jest.advanceTimersByTime(0);
      await Promise.resolve(); // flush microtasks

      expect(mockAgentRegistrationService.sendMessageToAgent).toHaveBeenCalledWith(
        'agentmux-orc',
        '[CHAT:conv-1] Hello'
      );
    });

    it('should set active conversation ID before delivering', async () => {
      processor.start();

      queueService.enqueue({
        content: 'Test',
        conversationId: 'conv-42',
        source: 'web_chat',
      });

      jest.advanceTimersByTime(0);
      await Promise.resolve();

      expect(mockSetActiveConversationId).toHaveBeenCalledWith('conv-42');
    });

    it('should handle delivery failure', async () => {
      mockAgentRegistrationService.sendMessageToAgent.mockResolvedValue({
        success: false,
        error: 'Session not found',
      });

      const routeErrorSpy = jest.spyOn(responseRouter, 'routeError');

      processor.start();

      queueService.enqueue({
        content: 'Test',
        conversationId: 'conv-1',
        source: 'web_chat',
      });

      jest.advanceTimersByTime(0);
      // Need extra microtask flushing for the async chain
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(routeErrorSpy).toHaveBeenCalled();
    });

    it('should complete message when response arrives', async () => {
      processor.start();

      queueService.enqueue({
        content: 'Test',
        conversationId: 'conv-1',
        source: 'web_chat',
      });

      jest.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();

      // Simulate orchestrator response via chat service event
      mockChatService.emit('message', {
        conversationId: 'conv-1',
        from: { type: 'orchestrator' },
        content: 'Here is the response',
      });

      await Promise.resolve();
      await Promise.resolve();

      const status = queueService.getStatus();
      expect(status.totalProcessed).toBe(1);
      expect(status.isProcessing).toBe(false);
    });

    it('should timeout if no response arrives', async () => {
      processor.start();

      queueService.enqueue({
        content: 'Test',
        conversationId: 'conv-1',
        source: 'web_chat',
      });

      jest.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();

      // Advance past the timeout (5000ms in mock constants)
      jest.advanceTimersByTime(6000);
      await Promise.resolve();
      await Promise.resolve();

      const status = queueService.getStatus();
      expect(status.totalProcessed).toBe(1);
    });

    it('should route slack response via slackResolve', async () => {
      const slackResolve = jest.fn();

      processor.start();

      queueService.enqueue({
        content: 'Slack message',
        conversationId: 'conv-slack',
        source: 'slack',
        sourceMetadata: { slackResolve },
      });

      jest.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();

      // Simulate response
      mockChatService.emit('message', {
        conversationId: 'conv-slack',
        from: { type: 'orchestrator' },
        content: 'Slack response',
      });

      await Promise.resolve();
      await Promise.resolve();

      expect(slackResolve).toHaveBeenCalledWith('Slack response');
    });

    it('should not process when stopped', async () => {
      processor.start();
      processor.stop();

      queueService.enqueue({
        content: 'Test',
        conversationId: 'conv-1',
        source: 'web_chat',
      });

      jest.advanceTimersByTime(100);
      await Promise.resolve();

      expect(mockAgentRegistrationService.sendMessageToAgent).not.toHaveBeenCalled();
    });

    it('should process messages sequentially with delay', async () => {
      const routeResponseSpy = jest.spyOn(responseRouter, 'routeResponse');

      processor.start();

      queueService.enqueue({
        content: 'First',
        conversationId: 'conv-1',
        source: 'web_chat',
      });
      queueService.enqueue({
        content: 'Second',
        conversationId: 'conv-2',
        source: 'web_chat',
      });

      // Process first message
      jest.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();

      mockChatService.emit('message', {
        conversationId: 'conv-1',
        from: { type: 'orchestrator' },
        content: 'Response 1',
      });

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(routeResponseSpy).toHaveBeenCalledTimes(1);

      // Advance past INTER_MESSAGE_DELAY (10ms in mock)
      jest.advanceTimersByTime(20);
      await Promise.resolve();
      await Promise.resolve();

      // Second message should now be processing
      expect(mockAgentRegistrationService.sendMessageToAgent).toHaveBeenCalledTimes(2);
    });

    it('should handle sendMessageToAgent throwing', async () => {
      mockAgentRegistrationService.sendMessageToAgent.mockRejectedValue(
        new Error('Network error')
      );

      processor.start();

      queueService.enqueue({
        content: 'Test',
        conversationId: 'conv-1',
        source: 'web_chat',
      });

      jest.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(queueService.getStatus().totalFailed).toBe(1);
    });

    it('should process existing pending messages on start', async () => {
      // Enqueue before starting
      queueService.enqueue({
        content: 'Existing',
        conversationId: 'conv-1',
        source: 'web_chat',
      });

      processor.start();

      jest.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockAgentRegistrationService.sendMessageToAgent).toHaveBeenCalled();
    });

    it('should wait for idle after chat response', async () => {
      processor.start();

      queueService.enqueue({
        content: 'Hello',
        conversationId: 'conv-1',
        source: 'web_chat',
      });

      jest.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();

      // First call: pre-delivery ready check
      expect(mockAgentRegistrationService.waitForAgentReady).toHaveBeenCalledTimes(1);

      // Simulate orchestrator response
      mockChatService.emit('message', {
        conversationId: 'conv-1',
        from: { type: 'orchestrator' },
        content: 'Response',
      });

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Second call: post-completion idle wait
      expect(mockAgentRegistrationService.waitForAgentReady).toHaveBeenCalledTimes(2);
    });

    it('should wait for idle after system event', async () => {
      processor.start();

      queueService.enqueue({
        content: 'event payload',
        conversationId: 'conv-sys',
        source: 'system_event',
      });

      jest.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Two calls: pre-delivery ready check + post-completion idle wait
      expect(mockAgentRegistrationService.waitForAgentReady).toHaveBeenCalledTimes(2);
    });

    it('should NOT wait for idle after delivery failure', async () => {
      mockAgentRegistrationService.sendMessageToAgent.mockResolvedValue({
        success: false,
        error: 'Session not found',
      });

      processor.start();

      queueService.enqueue({
        content: 'Test',
        conversationId: 'conv-1',
        source: 'web_chat',
      });

      jest.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Only one call: pre-delivery ready check. No post-completion idle wait.
      expect(mockAgentRegistrationService.waitForAgentReady).toHaveBeenCalledTimes(1);
    });

    it('should proceed to next message even if post-completion idle wait times out', async () => {
      // First waitForAgentReady (pre-delivery) succeeds, second (post-completion) fails
      mockAgentRegistrationService.waitForAgentReady
        .mockResolvedValueOnce(true)   // pre-delivery: ready
        .mockResolvedValueOnce(false)  // post-completion idle: timed out
        .mockResolvedValueOnce(true);  // next message pre-delivery: ready

      processor.start();

      queueService.enqueue({
        content: 'First',
        conversationId: 'conv-1',
        source: 'web_chat',
      });
      queueService.enqueue({
        content: 'Second',
        conversationId: 'conv-2',
        source: 'web_chat',
      });

      // Process first message
      jest.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();

      mockChatService.emit('message', {
        conversationId: 'conv-1',
        from: { type: 'orchestrator' },
        content: 'Response 1',
      });

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Advance past INTER_MESSAGE_DELAY
      jest.advanceTimersByTime(20);
      await Promise.resolve();
      await Promise.resolve();

      // Second message should still be delivered despite idle wait returning false
      expect(mockAgentRegistrationService.sendMessageToAgent).toHaveBeenCalledTimes(2);
      expect(mockAgentRegistrationService.sendMessageToAgent).toHaveBeenCalledWith(
        'agentmux-orc',
        '[CHAT:conv-2] Second'
      );
    });

    it('should re-queue message when agent is not ready', async () => {
      mockAgentRegistrationService.waitForAgentReady.mockResolvedValue(false);

      processor.start();

      queueService.enqueue({
        content: 'Test',
        conversationId: 'conv-1',
        source: 'web_chat',
      });

      jest.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Should NOT have attempted delivery
      expect(mockAgentRegistrationService.sendMessageToAgent).not.toHaveBeenCalled();
      // Message should still be pending in the queue
      expect(queueService.hasPending()).toBe(true);
    });

    it('should retry after re-queue when agent becomes ready', async () => {
      // First attempt: not ready; second attempt: ready
      mockAgentRegistrationService.waitForAgentReady
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      processor.start();

      queueService.enqueue({
        content: 'Retry me',
        conversationId: 'conv-1',
        source: 'web_chat',
      });

      // First attempt
      jest.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockAgentRegistrationService.sendMessageToAgent).not.toHaveBeenCalled();

      // Advance past the retry delay (AGENT_READY_POLL_INTERVAL = 500ms in mock)
      jest.advanceTimersByTime(600);
      await Promise.resolve();
      await Promise.resolve();

      // Second attempt should succeed
      expect(mockAgentRegistrationService.sendMessageToAgent).toHaveBeenCalledWith(
        'agentmux-orc',
        '[CHAT:conv-1] Retry me'
      );
    });
  });
});
