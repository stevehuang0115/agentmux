/**
 * WhatsApp-Orchestrator Bridge
 *
 * Routes messages between WhatsApp and the Crewly orchestrator,
 * enabling mobile control of AI teams via WhatsApp.
 *
 * @module services/whatsapp/bridge
 */

import { EventEmitter } from 'events';
import { getWhatsAppService, WhatsAppService } from './whatsapp.service.js';
import { getChatService, ChatService } from '../chat/chat.service.js';
import {
  isOrchestratorActive,
  getOrchestratorOfflineMessage,
} from '../orchestrator/index.js';
import type {
  WhatsAppIncomingMessage,
  WhatsAppConversationContext,
} from '../../types/whatsapp.types.js';
import type { MessageQueueService } from '../messaging/message-queue.service.js';
import { ORCHESTRATOR_SESSION_NAME, MESSAGE_QUEUE_CONSTANTS } from '../../constants.js';
import { LoggerService } from '../core/logger.service.js';

/**
 * Bridge configuration
 */
export interface WhatsAppBridgeConfig {
  /** Orchestrator session name */
  orchestratorSession: string;
  /** Maximum response length before truncation */
  maxResponseLength: number;
  /** Response timeout in ms */
  responseTimeoutMs: number;
}

/**
 * Default bridge configuration
 */
const DEFAULT_CONFIG: WhatsAppBridgeConfig = {
  orchestratorSession: ORCHESTRATOR_SESSION_NAME,
  maxResponseLength: 3000,
  responseTimeoutMs: (MESSAGE_QUEUE_CONSTANTS?.DEFAULT_MESSAGE_TIMEOUT ?? 120000) + 5000,
};

/** WhatsApp bridge singleton */
let bridgeInstance: WhatsAppOrchestratorBridge | null = null;

/**
 * WhatsAppOrchestratorBridge class
 *
 * Routes messages between WhatsApp and the Crewly orchestrator.
 * Mirrors the SlackOrchestratorBridge pattern with WhatsApp-specific handling.
 *
 * @example
 * ```typescript
 * const bridge = getWhatsAppOrchestratorBridge();
 * await bridge.initialize();
 * ```
 */
export class WhatsAppOrchestratorBridge extends EventEmitter {
  private logger = LoggerService.getInstance().createComponentLogger('WhatsAppBridge');
  private whatsappService: WhatsAppService;
  private chatService: ChatService;
  private messageQueueService: MessageQueueService | null = null;
  private config: WhatsAppBridgeConfig;
  private initialized = false;

  /**
   * Create a new WhatsAppOrchestratorBridge
   *
   * @param config - Partial configuration to override defaults
   */
  constructor(config: Partial<WhatsAppBridgeConfig> = {}) {
    super();
    this.whatsappService = getWhatsAppService();
    this.chatService = getChatService();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the bridge.
   * Sets up message listeners for WhatsApp incoming messages.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.whatsappService.on('message', this.handleWhatsAppMessage.bind(this));

    this.initialized = true;
    this.logger.info('Initialized');
  }

  /**
   * Check if bridge is initialized
   *
   * @returns True if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Set the message queue service for enqueuing messages to the orchestrator.
   *
   * @param service - The MessageQueueService instance
   */
  setMessageQueueService(service: MessageQueueService): void {
    this.messageQueueService = service;
  }

  /**
   * Get current configuration
   *
   * @returns A copy of the current configuration
   */
  getConfig(): WhatsAppBridgeConfig {
    return { ...this.config };
  }

  /**
   * Handle incoming WhatsApp message.
   * Routes the message to the orchestrator and sends the response back.
   *
   * @param message - Incoming WhatsApp message
   */
  private async handleWhatsAppMessage(message: WhatsAppIncomingMessage): Promise<void> {
    this.logger.info('Received message', {
      from: message.contactName || message.from,
      preview: message.text.substring(0, 50),
    });

    try {
      const context = this.whatsappService.getConversationContext(
        message.chatId,
        message.contactName || message.from,
      );

      const response = await this.sendToOrchestrator(message.text, context);

      await this.sendWhatsAppResponse(message.chatId, response);

      this.emit('message_handled', { message, response });
    } catch (error) {
      this.logger.error('Error handling message', {
        error: error instanceof Error ? error.message : String(error),
      });
      try {
        await this.sendWhatsAppResponse(
          message.chatId,
          `Sorry, I encountered an error: ${error instanceof Error ? error.message : String(error)}`,
        );
      } catch {
        // Silent fail on error response
      }
      this.emit('error', error);
    }
  }

  /**
   * Send message to orchestrator via the message queue and wait for response.
   *
   * @param message - Message text to send
   * @param context - Conversation context
   * @returns Orchestrator response or offline/error message
   */
  private async sendToOrchestrator(
    message: string,
    context?: WhatsAppConversationContext,
  ): Promise<string> {
    try {
      const isActive = await isOrchestratorActive();
      if (!isActive) {
        this.logger.info('Orchestrator is not active, returning offline message');
        return getOrchestratorOfflineMessage(true);
      }

      if (!this.messageQueueService) {
        this.logger.error('Message queue service not configured');
        return 'The WhatsApp bridge is not properly configured. Please restart the server.';
      }

      // Store message in chat service
      const result = await this.chatService.sendMessage({
        content: message,
        conversationId: context?.conversationId,
        metadata: {
          source: 'whatsapp',
          chatId: context?.chatId,
          contactName: context?.contactName,
        },
      });

      // Enqueue with a resolve callback for response routing
      const response = await new Promise<string>((resolve) => {
        const timeoutId = setTimeout(() => {
          resolve('The orchestrator is taking longer than expected. Please try again.');
        }, this.config.responseTimeoutMs);

        try {
          this.messageQueueService!.enqueue({
            content: message,
            conversationId: result.conversation.id,
            source: 'whatsapp',
            sourceMetadata: {
              whatsappResolve: (resp: string) => {
                clearTimeout(timeoutId);
                resolve(resp);
              },
              chatId: context?.chatId,
              contactName: context?.contactName,
            },
          });
        } catch (enqueueErr) {
          clearTimeout(timeoutId);
          resolve(`Failed to enqueue message: ${enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr)}`);
        }
      });

      return response;
    } catch (error) {
      this.logger.error('Error sending to orchestrator', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Send a text response back to a WhatsApp chat.
   *
   * @param chatId - Destination chat JID
   * @param text - Response text
   */
  async sendWhatsAppResponse(chatId: string, text: string): Promise<void> {
    const trimmed = text?.trim();
    if (!trimmed) return;

    try {
      await this.whatsappService.sendMessage({ to: chatId, text: trimmed });
    } catch (err) {
      this.logger.error('Failed to send WhatsApp response', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Get WhatsApp bridge singleton
 *
 * @returns WhatsAppOrchestratorBridge instance
 */
export function getWhatsAppOrchestratorBridge(): WhatsAppOrchestratorBridge {
  if (!bridgeInstance) {
    bridgeInstance = new WhatsAppOrchestratorBridge();
  }
  return bridgeInstance;
}

/**
 * Reset WhatsApp bridge singleton (for testing)
 */
export function resetWhatsAppOrchestratorBridge(): void {
  bridgeInstance = null;
}
