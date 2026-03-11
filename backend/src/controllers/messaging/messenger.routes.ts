import { Router, Request, Response, NextFunction } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { CREWLY_CONSTANTS, MESSAGE_SOURCES } from '../../constants.js';
import { MessengerRegistryService } from '../../services/messaging/messenger-registry.service.js';
import { SlackMessengerAdapter } from '../../services/messaging/adapters/slack-messenger.adapter.js';
import { TelegramMessengerAdapter } from '../../services/messaging/adapters/telegram-messenger.adapter.js';
import { DiscordMessengerAdapter } from '../../services/messaging/adapters/discord-messenger.adapter.js';
import { GoogleChatMessengerAdapter } from '../../services/messaging/adapters/google-chat-messenger.adapter.js';
import { formatError } from '../../utils/format-error.js';
import type { MessageQueueService } from '../../services/messaging/message-queue.service.js';
import type { MessengerPlatform, IncomingMessage } from '../../services/messaging/messenger-adapter.interface.js';

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
 * Create an incoming message callback for Google Chat Pub/Sub mode.
 *
 * When a message arrives from the Pub/Sub subscription, this callback enqueues
 * it into the MessageQueueService with source 'google_chat'. The queue processor
 * will deliver it to the orchestrator, and the response router will resolve
 * the reply back to Google Chat via the adapter.
 *
 * Thread tracking: the threadId from the incoming message is stored in
 * sourceMetadata so the response can be posted back to the same Chat thread.
 *
 * @param queueService - The message queue service to enqueue into
 * @param adapter - The Google Chat adapter for sending replies
 * @returns Callback function for incoming messages
 */
function createGoogleChatIncomingCallback(
  queueService: MessageQueueService,
  adapter: GoogleChatMessengerAdapter,
): (msg: IncomingMessage) => void {
  return (msg: IncomingMessage) => {
    // Create a resolve callback that sends the reply back to the Chat thread
    const replyPromise = new Promise<string>((resolve) => {
      const sourceMetadata: Record<string, unknown> = {
        channelId: msg.channelId,
        userId: msg.userId,
        threadId: msg.threadId,
        googleChatResolve: resolve,
      };

      queueService.enqueue({
        content: msg.text,
        conversationId: msg.conversationId,
        source: MESSAGE_SOURCES.GOOGLE_CHAT,
        sourceMetadata,
      });
    });

    // When the orchestrator responds, send it back to the same Chat thread
    replyPromise.then(async (response: string) => {
      try {
        await adapter.sendMessage(msg.channelId, response, { threadId: msg.threadId });
      } catch (err) {
        // Log reply failure - the error is not propagated since there's no caller to propagate to
        console.error(`[GoogleChat] Failed to send reply to ${msg.channelId}: ${formatError(err)}`);
      }
    });
  };
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
      if (platform === 'google-chat' && config.subscriptionName && config.projectId && messageQueueService) {
        const gchatAdapter = adapter as GoogleChatMessengerAdapter;
        config.onIncomingMessage = createGoogleChatIncomingCallback(messageQueueService, gchatAdapter);
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
