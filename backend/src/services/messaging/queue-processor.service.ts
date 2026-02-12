/**
 * Queue Processor Service
 *
 * Processes messages from the queue one-at-a-time. Dequeues the next message,
 * delivers it to the orchestrator via AgentRegistrationService, waits for
 * the response via ChatService events, and routes the response back.
 *
 * @module services/messaging/queue-processor
 */

import { EventEmitter } from 'events';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import { MessageQueueService } from './message-queue.service.js';
import { ResponseRouterService } from './response-router.service.js';
import { AgentRegistrationService } from '../agent/agent-registration.service.js';
import { getChatService } from '../chat/chat.service.js';
import { getTerminalGateway } from '../../websocket/terminal.gateway.js';
import {
  MESSAGE_QUEUE_CONSTANTS,
  ORCHESTRATOR_SESSION_NAME,
  CHAT_CONSTANTS,
  EVENT_DELIVERY_CONSTANTS,
  RUNTIME_TYPES,
  type RuntimeType,
} from '../../constants.js';
import { StorageService } from '../core/storage.service.js';
import type { ChatMessage } from '../../types/chat.types.js';

/**
 * QueueProcessorService dequeues messages one-at-a-time, delivers them
 * to the orchestrator, waits for a response, and routes it back.
 *
 * @example
 * ```typescript
 * const processor = new QueueProcessorService(
 *   queueService,
 *   responseRouter,
 *   agentRegistrationService
 * );
 * processor.start();
 * ```
 */
export class QueueProcessorService extends EventEmitter {
  private logger: ComponentLogger;
  private queueService: MessageQueueService;
  private responseRouter: ResponseRouterService;
  private agentRegistrationService: AgentRegistrationService;
  private running = false;
  private processing = false;
  private processNextTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Set to true when an early-return path has already scheduled the next run. */
  private nextAlreadyScheduled = false;

  constructor(
    queueService: MessageQueueService,
    responseRouter: ResponseRouterService,
    agentRegistrationService: AgentRegistrationService
  ) {
    super();
    this.logger = LoggerService.getInstance().createComponentLogger('QueueProcessor');
    this.queueService = queueService;
    this.responseRouter = responseRouter;
    this.agentRegistrationService = agentRegistrationService;
  }

  /**
   * Start the processor. Listens to queue 'enqueued' events and
   * triggers processing.
   */
  start(): void {
    if (this.running) return;

    this.running = true;
    this.queueService.on('enqueued', this.onMessageEnqueued);
    this.logger.info('Queue processor started');

    // Process any messages already in the queue
    if (this.queueService.hasPending()) {
      this.scheduleProcessNext(0);
    }
  }

  /**
   * Stop the processor. Clears timers and removes listeners.
   */
  stop(): void {
    if (!this.running) return;

    this.running = false;
    this.queueService.removeListener('enqueued', this.onMessageEnqueued);

    if (this.processNextTimeout) {
      clearTimeout(this.processNextTimeout);
      this.processNextTimeout = null;
    }

    this.logger.info('Queue processor stopped');
  }

  /**
   * Check if the processor is currently running.
   *
   * @returns True if running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Check if a message is currently being processed.
   *
   * @returns True if processing
   */
  isProcessingMessage(): boolean {
    return this.processing;
  }

  /**
   * Handler for queue 'enqueued' events. Triggers processing if idle.
   */
  private onMessageEnqueued = (): void => {
    if (!this.processing) {
      this.scheduleProcessNext(0);
    }
  };

  /**
   * Schedule the next message processing after a delay.
   *
   * @param delayMs - Delay in milliseconds before processing
   */
  private scheduleProcessNext(delayMs: number): void {
    if (this.processNextTimeout) {
      clearTimeout(this.processNextTimeout);
    }

    this.processNextTimeout = setTimeout(() => {
      this.processNextTimeout = null;
      this.processNext().catch((error) => {
        this.logger.error('Unhandled error in processNext', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, delayMs);
  }

  /**
   * Process the next message in the queue.
   * This is the core processing loop.
   */
  private async processNext(): Promise<void> {
    if (!this.running || this.processing) {
      return;
    }

    // Don't process messages until orchestrator has finished initialization.
    // During init, the runtime may be at a prompt but postInitialize (e.g. /dir add)
    // is still running. Sending messages during init causes interleaved commands.
    const orchestratorInfo = await StorageService.getInstance().getOrchestratorStatus();
    const agentStatus = orchestratorInfo?.agentStatus;
    if (!agentStatus || (agentStatus !== 'started' && agentStatus !== 'active')) {
      // Schedule retry — orchestrator not ready yet
      this.scheduleProcessNext(EVENT_DELIVERY_CONSTANTS.AGENT_READY_POLL_INTERVAL);
      return;
    }

    const message = this.queueService.dequeue();
    if (!message) {
      return;
    }

    this.processing = true;

    try {
      this.logger.info('Processing message', {
        messageId: message.id,
        source: message.source,
        conversationId: message.conversationId,
      });

      const isSystemEvent = message.source === 'system_event';

      // Set active conversation ID for response routing (skip for system events)
      if (!isSystemEvent) {
        const terminalGateway = getTerminalGateway();
        if (terminalGateway) {
          terminalGateway.setActiveConversationId(message.conversationId);
        }
      }

      // Wait for orchestrator to be at prompt before attempting delivery.
      // After processing a previous message the orchestrator may still be busy
      // (managing agents, running commands) before returning to the input prompt.
      const isReady = await this.agentRegistrationService.waitForAgentReady(
        ORCHESTRATOR_SESSION_NAME,
        EVENT_DELIVERY_CONSTANTS.AGENT_READY_TIMEOUT
      );

      // Check if message was force-cancelled while waiting for agent readiness
      if (message.status === 'cancelled') {
        this.logger.info('Message was cancelled during processing, skipping delivery', {
          messageId: message.id,
        });
        return;
      }

      if (!isReady) {
        this.logger.warn('Agent not ready, re-queuing message for retry', {
          messageId: message.id,
          timeoutMs: EVENT_DELIVERY_CONSTANTS.AGENT_READY_TIMEOUT,
        });

        // Re-enqueue the message so it gets retried instead of permanently failing
        this.queueService.requeue(message);

        // Use a longer delay before retrying to give the orchestrator more time.
        // Mark as already scheduled so the finally block doesn't overwrite with
        // a shorter INTER_MESSAGE_DELAY.
        this.scheduleProcessNext(EVENT_DELIVERY_CONSTANTS.AGENT_READY_POLL_INTERVAL);
        this.nextAlreadyScheduled = true;
        return;
      }

      // Format message: system events use raw content, chat uses [CHAT:id] prefix
      const deliveryContent = isSystemEvent
        ? message.content
        : `[${CHAT_CONSTANTS.MESSAGE_PREFIX}:${message.conversationId}] ${message.content}`;

      // Look up the orchestrator's runtime type for runtime-aware terminal clearing.
      // Gemini CLI exits on Ctrl+C so we need Escape+Ctrl+U instead.
      const orchestratorStatus = await StorageService.getInstance().getOrchestratorStatus();
      const runtimeType: RuntimeType =
        (orchestratorStatus?.runtimeType as RuntimeType) || RUNTIME_TYPES.CLAUDE_CODE;

      const deliveryResult = await this.agentRegistrationService.sendMessageToAgent(
        ORCHESTRATOR_SESSION_NAME,
        deliveryContent,
        runtimeType
      );

      if (!deliveryResult.success) {
        const errorMsg = deliveryResult.error || 'Failed to deliver message to orchestrator';
        this.logger.warn('Message delivery failed', {
          messageId: message.id,
          error: errorMsg,
        });

        this.queueService.markFailed(message.id, errorMsg);
        this.responseRouter.routeError(message, errorMsg);

        // Post a system message to the conversation so the user sees the error
        // (skip for system events — no user conversation to notify)
        if (!isSystemEvent) {
          try {
            const chatService = getChatService();
            await chatService.addSystemMessage(
              message.conversationId,
              `Failed to deliver message to orchestrator: ${errorMsg}. Please try again.`
            );
          } catch (sysErr) {
            this.logger.warn('Failed to send delivery-failure system message', {
              error: sysErr instanceof Error ? sysErr.message : String(sysErr),
            });
          }
        }

        return;
      }

      if (isSystemEvent) {
        // Fire-and-forget: no response expected for system events
        this.queueService.markCompleted(message.id, '');

        this.logger.info('System event delivered successfully', {
          messageId: message.id,
        });
      } else {
        // Wait for orchestrator response
        const response = await this.waitForResponse(
          message.conversationId,
          MESSAGE_QUEUE_CONSTANTS.DEFAULT_MESSAGE_TIMEOUT
        );

        this.queueService.markCompleted(message.id, response);
        this.responseRouter.routeResponse(message, response);

        this.logger.info('Message processed successfully', {
          messageId: message.id,
          responseLength: response.length,
        });
      }

      // Wait for orchestrator to finish all post-response work before next message.
      // The orchestrator may continue managing agents or running commands after
      // emitting its chat response.
      await this.agentRegistrationService.waitForAgentReady(
        ORCHESTRATOR_SESSION_NAME,
        EVENT_DELIVERY_CONSTANTS.AGENT_READY_TIMEOUT
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('Error processing message', {
        messageId: message.id,
        error: errorMsg,
      });

      this.queueService.markFailed(message.id, errorMsg);
      this.responseRouter.routeError(message, errorMsg);
    } finally {
      this.processing = false;
      if (this.nextAlreadyScheduled) {
        this.nextAlreadyScheduled = false;
      } else {
        this.scheduleNextIfPending();
      }
    }
  }

  /**
   * Wait for an orchestrator response on a given conversation.
   * Listens to ChatService 'message' events for matching orchestrator messages.
   *
   * @param conversationId - Conversation to monitor
   * @param timeoutMs - Timeout in milliseconds
   * @returns Response content
   */
  private waitForResponse(conversationId: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve) => {
      const chatService = getChatService();

      const onMessage = (chatMessage: ChatMessage): void => {
        if (
          chatMessage.conversationId === conversationId &&
          chatMessage.from.type === 'orchestrator'
        ) {
          cleanup();
          resolve(chatMessage.content);
        }
      };

      const timeoutId = setTimeout(() => {
        cleanup();
        resolve('The orchestrator is taking longer than expected. Please try again.');
      }, timeoutMs);

      const cleanup = (): void => {
        clearTimeout(timeoutId);
        chatService.removeListener('message', onMessage);
      };

      chatService.on('message', onMessage);
    });
  }

  /**
   * Schedule processing of the next message if there are pending messages.
   * Uses INTER_MESSAGE_DELAY to avoid overwhelming the orchestrator.
   */
  private scheduleNextIfPending(): void {
    if (this.running && this.queueService.hasPending()) {
      this.scheduleProcessNext(MESSAGE_QUEUE_CONSTANTS.INTER_MESSAGE_DELAY);
    }
  }
}
