import { Router, Request, Response, NextFunction } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { CREWLY_CONSTANTS } from '../../constants.js';
import { LoggerService } from '../../services/core/logger.service.js';
import { MessengerRegistryService } from '../../services/messaging/messenger-registry.service.js';
import { SlackMessengerAdapter } from '../../services/messaging/adapters/slack-messenger.adapter.js';
import { TelegramMessengerAdapter } from '../../services/messaging/adapters/telegram-messenger.adapter.js';
import { DiscordMessengerAdapter } from '../../services/messaging/adapters/discord-messenger.adapter.js';
import { GoogleChatMessengerAdapter } from '../../services/messaging/adapters/google-chat-messenger.adapter.js';
import { createIncomingCallback } from '../../services/messaging/google-chat-initializer.js';
import { getChatService } from '../../services/chat/chat.service.js';
import type { MessageQueueService } from '../../services/messaging/message-queue.service.js';
import type { MessengerPlatform } from '../../services/messaging/messenger-adapter.interface.js';

/** Known messenger platforms for input validation. */
const VALID_PLATFORMS: ReadonlySet<string> = new Set<MessengerPlatform>(['slack', 'telegram', 'discord', 'google-chat']);

/** Module-level reference to the message queue service, set externally. */
let messageQueueService: MessageQueueService | null = null;

/**
 * Set the message queue service for Google Chat Pub/Sub incoming message handling.
 *
 * @param service - The MessageQueueService instance
 */
export function setMessengerRouterQueueService(service: MessageQueueService): void {
  messageQueueService = service;
}

/**
 * Validate that a string is a known messenger platform.
 *
 * @param value - The platform string from request params
 * @returns The validated MessengerPlatform, or null if invalid
 */
function validatePlatform(value: string): MessengerPlatform | null {
  return VALID_PLATFORMS.has(value) ? (value as MessengerPlatform) : null;
}

/**
 * Get the credential file path for a messenger platform.
 *
 * @param platform - The messenger platform identifier
 * @returns Absolute path to the platform's credential JSON file
 */
function getCredentialPath(platform: MessengerPlatform): string {
  return path.join(os.homedir(), CREWLY_CONSTANTS.PATHS.CREWLY_HOME, `${platform}-credentials.json`);
}

/**
 * Register default messenger adapters if they are not already registered.
 *
 * @param registry - The messenger registry to populate
 */
function registerDefaultAdapters(registry: MessengerRegistryService): void {
  if (!registry.get('slack')) registry.register(new SlackMessengerAdapter());
  if (!registry.get('telegram')) registry.register(new TelegramMessengerAdapter());
  if (!registry.get('discord')) registry.register(new DiscordMessengerAdapter());
  if (!registry.get('google-chat')) registry.register(new GoogleChatMessengerAdapter());
}

/**
 * Create the messenger API router.
 *
 * Registers default adapters and exposes status, connect, disconnect,
 * and send endpoints for each platform.
 *
 * @returns Express Router with messenger routes
 */
export function createMessengerRouter(): Router {
  const router = Router();
  const registry = MessengerRegistryService.getInstance();
  registerDefaultAdapters(registry);

  router.get('/status', (_req: Request, res: Response) => {
    res.json({ success: true, data: registry.list() });
  });

  router.post('/:platform/connect', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const platform = validatePlatform(req.params.platform);
      if (!platform) {
        res.status(400).json({ success: false, error: `Invalid platform: ${req.params.platform}` });
        return;
      }
      const adapter = registry.get(platform);
      if (!adapter) {
        res.status(404).json({ success: false, error: `Unsupported platform: ${platform}` });
        return;
      }

      const config = { ...(req.body || {}) };

      // For Google Chat Pub/Sub mode, inject the incoming message callback
      if (platform === 'google-chat' && config.subscriptionName && config.projectId) {
        if (messageQueueService) {
          const gchatAdapter = adapter as GoogleChatMessengerAdapter;
          config.onIncomingMessage = createIncomingCallback(messageQueueService, gchatAdapter);
        } else {
          const routeLogger = LoggerService.getInstance().createComponentLogger('MessengerRoutes');
          routeLogger.error('Google Chat Pub/Sub connect blocked: messageQueueService is not initialized — incoming messages would be silently dropped.', {
            subscriptionName: config.subscriptionName,
            projectId: config.projectId,
          });
          res.status(503).json({
            success: false,
            error: 'Backend message queue is not ready. Please wait a moment and try again.',
          });
          return;
        }
      }

      await adapter.initialize(config);

      // Persist credentials (excluding the callback function)
      const credentialsToSave = { ...(req.body || {}) };
      const crewlyDir = path.join(os.homedir(), CREWLY_CONSTANTS.PATHS.CREWLY_HOME);
      await fs.mkdir(crewlyDir, { recursive: true });
      await fs.writeFile(getCredentialPath(platform), JSON.stringify(credentialsToSave, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
      res.json({ success: true, data: adapter.getStatus(), message: `${platform} connected` });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:platform/disconnect', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const platform = validatePlatform(req.params.platform);
      if (!platform) {
        res.status(400).json({ success: false, error: `Invalid platform: ${req.params.platform}` });
        return;
      }
      const adapter = registry.get(platform);
      if (!adapter) {
        res.status(404).json({ success: false, error: `Unsupported platform: ${platform}` });
        return;
      }

      await adapter.disconnect();
      await fs.rm(getCredentialPath(platform), { force: true });
      res.json({ success: true, message: `${platform} disconnected` });
    } catch (error) {
      next(error);
    }
  });

  // Google Chat — live Pub/Sub status (runtime state, not saved credentials)
  router.get('/google-chat/status', (_req: Request, res: Response) => {
    const adapter = registry.get('google-chat');
    if (!adapter) {
      res.status(404).json({ success: false, error: 'Google Chat adapter not found' });
      return;
    }
    const status = adapter.getStatus();
    res.json({ success: true, data: status.details || {} });
  });

  // Google Chat — test send message
  router.post('/google-chat/test-send', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adapter = registry.get('google-chat') as GoogleChatMessengerAdapter | undefined;
      if (!adapter) {
        res.status(404).json({ success: false, error: 'Google Chat adapter not found' });
        return;
      }

      const status = adapter.getStatus();
      if (!status.connected) {
        res.status(400).json({ success: false, error: 'Google Chat is not connected' });
        return;
      }

      // Only service-account and pubsub modes support API sends (webhook has no space concept)
      if (status.details?.mode === 'webhook') {
        res.status(400).json({ success: false, error: 'Test send is not supported in webhook mode (no space name available)' });
        return;
      }

      const space = String(req.body?.space || '').trim();
      const text = String(req.body?.text || 'Test message from Crewly').trim();

      if (!space) {
        res.status(400).json({ success: false, error: 'space is required (e.g. "spaces/AAAA...")' });
        return;
      }

      await adapter.sendMessage(space, text);
      res.json({ success: true, message: 'Test message sent' });
    } catch (error) {
      next(error);
    }
  });

  // Google Chat — send message to a space (with optional thread)
  router.post('/google-chat/send', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adapter = registry.get('google-chat') as GoogleChatMessengerAdapter | undefined;
      if (!adapter) {
        res.status(404).json({ success: false, error: 'Google Chat adapter not found' });
        return;
      }

      const status = adapter.getStatus();
      if (!status.connected) {
        res.status(400).json({ success: false, error: 'Google Chat is not connected' });
        return;
      }

      const space = String(req.body?.space || '').trim();
      const text = String(req.body?.text || '').trim();

      if (!space) {
        res.status(400).json({ success: false, error: 'space is required' });
        return;
      }
      if (!text) {
        res.status(400).json({ success: false, error: 'text is required' });
        return;
      }

      const threadName = req.body?.threadName ? String(req.body.threadName).trim() : undefined;

      // Signal the queue-processor's waitForResponse by emitting a ChatMessage.
      // The actual Google Chat delivery happens through the normal pipeline:
      // waitForResponse resolves → routeResponse → googleChatResolve → adapter.sendMessage.
      // This avoids duplicate sends (reply-gchat + googleChatResolve both sending).
      const chatService = getChatService();
      const conversationId = threadName ? `${space} thread=${threadName}` : space;
      await chatService.addDirectMessage(
        conversationId,
        text,
        { type: 'orchestrator', name: 'Orchestrator' },
        { source: 'reply-gchat', space, threadName },
      );

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Google Chat — manual Pub/Sub pull trigger
  router.post('/google-chat/pull', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const adapter = registry.get('google-chat') as GoogleChatMessengerAdapter | undefined;
      if (!adapter) {
        res.status(404).json({ success: false, error: 'Google Chat adapter not found' });
        return;
      }

      const status = adapter.getStatus();
      if (status.details?.mode !== 'pubsub') {
        res.status(400).json({ success: false, error: 'Not in Pub/Sub mode' });
        return;
      }

      const messagesReceived = await adapter.pullMessages();
      res.json({ success: true, messagesReceived });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:platform/send', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const platform = validatePlatform(req.params.platform);
      if (!platform) {
        res.status(400).json({ success: false, error: `Invalid platform: ${req.params.platform}` });
        return;
      }
      const adapter = registry.get(platform);
      if (!adapter) {
        res.status(404).json({ success: false, error: `Unsupported platform: ${platform}` });
        return;
      }

      const channel = String(req.body?.channel || '');
      const text = String(req.body?.text || '');
      if (!channel || !text) {
        res.status(400).json({ success: false, error: 'channel and text are required' });
        return;
      }

      await adapter.sendMessage(channel, text, { threadId: req.body?.threadId });
      res.json({ success: true, message: 'Message sent' });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
