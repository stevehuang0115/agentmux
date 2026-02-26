import { Router, Request, Response, NextFunction } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { MessengerRegistryService } from '../../services/messaging/messenger-registry.service.js';
import { SlackMessengerAdapter } from '../../services/messaging/adapters/slack-messenger.adapter.js';
import { TelegramMessengerAdapter } from '../../services/messaging/adapters/telegram-messenger.adapter.js';
import { DiscordMessengerAdapter } from '../../services/messaging/adapters/discord-messenger.adapter.js';
import type { MessengerPlatform } from '../../services/messaging/messenger-adapter.interface.js';

const registry = MessengerRegistryService.getInstance();
if (!registry.get('slack')) registry.register(new SlackMessengerAdapter());
if (!registry.get('telegram')) registry.register(new TelegramMessengerAdapter());
if (!registry.get('discord')) registry.register(new DiscordMessengerAdapter());

const router = Router();

function getCredentialPath(platform: MessengerPlatform): string {
  return path.join(os.homedir(), '.crewly', `${platform}-credentials.json`);
}

router.get('/status', (_req: Request, res: Response) => {
  res.json({ success: true, data: registry.list() });
});

router.post('/:platform/connect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const platform = req.params.platform as MessengerPlatform;
    const adapter = registry.get(platform);
    if (!adapter) {
      res.status(404).json({ success: false, error: `Unsupported platform: ${platform}` });
      return;
    }

    await adapter.initialize(req.body || {});
    await fs.mkdir(path.join(os.homedir(), '.crewly'), { recursive: true });
    await fs.writeFile(getCredentialPath(platform), JSON.stringify(req.body || {}, null, 2) + '\n', 'utf8');
    res.json({ success: true, data: adapter.getStatus(), message: `${platform} connected` });
  } catch (error) {
    next(error);
  }
});

router.post('/:platform/disconnect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const platform = req.params.platform as MessengerPlatform;
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
    const platform = req.params.platform as MessengerPlatform;
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

    await adapter.sendMessage(channel, text, { threadTs: req.body?.threadTs });
    res.json({ success: true, message: 'Message sent' });
  } catch (error) {
    next(error);
  }
});

export function createMessengerRouter(): Router {
  return router;
}
