/**
 * WhatsApp Initializer
 *
 * Handles automatic WhatsApp connection on application startup.
 * Checks for environment variables and initializes if configured.
 *
 * @module services/whatsapp/initializer
 */

import { getWhatsAppService } from './whatsapp.service.js';
import { getWhatsAppOrchestratorBridge } from './whatsapp-orchestrator-bridge.js';
import type { WhatsAppConfig } from '../../types/whatsapp.types.js';
import type { MessageQueueService } from '../messaging/message-queue.service.js';
import { LoggerService } from '../core/logger.service.js';

const logger = LoggerService.getInstance().createComponentLogger('WhatsAppInitializer');

/**
 * Result of initialization attempt
 */
export interface WhatsAppInitResult {
  /** Whether initialization was attempted */
  attempted: boolean;
  /** Whether initialization succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Options for WhatsApp initialization
 */
export interface WhatsAppInitOptions {
  /** Optional MessageQueueService for enqueuing messages to orchestrator */
  messageQueueService?: MessageQueueService;
}

/**
 * Check if WhatsApp is configured via environment variables.
 *
 * @returns True if WHATSAPP_ENABLED is set to 'true'
 */
export function isWhatsAppConfigured(): boolean {
  return process.env.WHATSAPP_ENABLED === 'true';
}

/**
 * Get WhatsApp configuration from environment variables.
 *
 * @returns WhatsAppConfig object or null if not configured
 */
export function getWhatsAppConfigFromEnv(): WhatsAppConfig | null {
  if (!isWhatsAppConfigured()) {
    return null;
  }

  return {
    phoneNumber: process.env.WHATSAPP_PHONE_NUMBER,
    authStatePath: process.env.WHATSAPP_AUTH_PATH,
    allowedContacts: process.env.WHATSAPP_ALLOWED_CONTACTS?.split(',').filter(Boolean),
  };
}

/**
 * Initialize WhatsApp integration if configured via environment variables.
 *
 * This function is designed to be called during application startup.
 * It safely handles cases where WhatsApp is not configured.
 *
 * @param options - Optional initialization options
 * @returns Result object indicating success or failure
 *
 * @example
 * ```typescript
 * const result = await initializeWhatsAppIfConfigured({
 *   messageQueueService: myService,
 * });
 * if (result.success) {
 *   console.log('WhatsApp connected!');
 * }
 * ```
 */
export async function initializeWhatsAppIfConfigured(
  options?: WhatsAppInitOptions,
): Promise<WhatsAppInitResult> {
  const config = getWhatsAppConfigFromEnv();

  if (!config) {
    logger.info('Not configured — skipping initialization');
    return { attempted: false, success: false };
  }

  try {
    const whatsappService = getWhatsAppService();
    await whatsappService.initialize(config);

    const bridge = getWhatsAppOrchestratorBridge();

    if (options?.messageQueueService) {
      bridge.setMessageQueueService(options.messageQueueService);
    }

    await bridge.initialize();

    logger.info('Successfully initialized');
    return { attempted: true, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to initialize', { error: errorMessage });
    return { attempted: true, success: false, error: errorMessage };
  }
}

/**
 * Gracefully shutdown WhatsApp integration.
 * Call this during application shutdown to disconnect cleanly.
 */
export async function shutdownWhatsApp(): Promise<void> {
  try {
    const whatsappService = getWhatsAppService();
    if (whatsappService.isConnected()) {
      await whatsappService.disconnect();
      logger.info('Disconnected');
    }
  } catch (error) {
    logger.error('Error during shutdown', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
