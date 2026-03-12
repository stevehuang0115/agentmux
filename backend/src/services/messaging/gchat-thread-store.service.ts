/**
 * Google Chat Thread Store Service
 *
 * Persists Google Chat thread conversations as markdown files so the
 * orchestrator can read conversation history after restart.
 *
 * Storage layout:
 *   ~/.crewly/gchat-threads/
 *     {spaceId}/
 *       {threadId}.md          — Thread conversation file
 *
 * @module services/messaging/gchat-thread-store
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { GCHAT_THREAD_CONSTANTS } from '../../constants.js';
import { formatMessageTimestamp } from '../../utils/format-date.js';

/**
 * Sanitize a Google Chat resource name into a filesystem-safe directory/file name.
 * Replaces slashes with underscores (e.g. "spaces/ABC123" → "spaces_ABC123").
 *
 * @param name - Google Chat resource name
 * @returns Filesystem-safe string
 */
function sanitizeName(name: string): string {
  return name.replace(/\//g, '_').replace(/\.\./g, '_');
}

/**
 * GoogleChatThreadStoreService manages persistent storage of Google Chat
 * thread conversations as markdown files.
 *
 * @example
 * ```typescript
 * const store = new GoogleChatThreadStoreService();
 * await store.appendUserMessage('spaces/ABC', 'spaces/ABC/threads/XYZ', 'Steve', 'Hello');
 * await store.appendBotReply('spaces/ABC', 'spaces/ABC/threads/XYZ', 'Got it!');
 * ```
 */
export class GoogleChatThreadStoreService {
  private baseDir: string;

  /**
   * Create a new GoogleChatThreadStoreService.
   *
   * @param crewlyHome - Base crewly home directory (defaults to ~/.crewly)
   */
  constructor(crewlyHome?: string) {
    const home = crewlyHome || path.join(os.homedir(), '.crewly');
    this.baseDir = path.join(home, GCHAT_THREAD_CONSTANTS.STORAGE_DIR);
  }

  /**
   * Compute the file path for a thread conversation file.
   *
   * @param space - Google Chat space name (e.g. "spaces/ABC123")
   * @param thread - Google Chat thread name (e.g. "spaces/ABC123/threads/XYZ")
   * @returns Absolute path to the thread markdown file
   */
  getThreadFilePath(space: string, thread: string): string {
    return path.join(
      this.baseDir,
      sanitizeName(space),
      `${sanitizeName(thread)}${GCHAT_THREAD_CONSTANTS.FILE_EXTENSION}`
    );
  }

  /**
   * Ensure the thread file exists, creating it with frontmatter if needed.
   *
   * @param space - Google Chat space name
   * @param thread - Google Chat thread name
   * @param userName - Name of the user who started the thread
   * @returns Absolute path to the thread file
   */
  async ensureThreadFile(
    space: string,
    thread: string,
    userName: string
  ): Promise<string> {
    const filePath = this.getThreadFilePath(space, thread);
    const dir = path.dirname(filePath);

    await fs.mkdir(dir, { recursive: true });

    try {
      await fs.access(filePath);
    } catch {
      // File doesn't exist — create with frontmatter
      const frontmatter = [
        '---',
        `space: ${space}`,
        `thread: ${thread}`,
        `user: ${userName}`,
        `started: ${new Date().toISOString()}`,
        '---',
        '',
        '## Messages',
        '',
      ].join('\n');

      await fs.writeFile(filePath, frontmatter, 'utf-8');
    }

    return filePath;
  }

  /**
   * Append a user message to the thread conversation file.
   *
   * @param space - Google Chat space name
   * @param thread - Google Chat thread name
   * @param userName - Display name of the sender
   * @param message - Message content
   */
  async appendUserMessage(
    space: string,
    thread: string,
    userName: string,
    message: string
  ): Promise<void> {
    const filePath = await this.ensureThreadFile(space, thread, userName);
    const timestamp = formatMessageTimestamp();
    const entry = `\n**${userName}** (${timestamp}):\n${message}\n`;
    await fs.appendFile(filePath, entry, 'utf-8');
  }

  /**
   * Append a bot reply to the thread conversation file.
   *
   * @param space - Google Chat space name
   * @param thread - Google Chat thread name
   * @param message - Bot response content
   */
  async appendBotReply(
    space: string,
    thread: string,
    message: string
  ): Promise<void> {
    const filePath = this.getThreadFilePath(space, thread);

    try {
      await fs.access(filePath);
    } catch {
      // Thread file doesn't exist — skip silently
      return;
    }

    const timestamp = formatMessageTimestamp();
    const entry = `\n**Crewly** (${timestamp}):\n${message}\n`;
    await fs.appendFile(filePath, entry, 'utf-8');
  }
}

/** Singleton instance */
let instance: GoogleChatThreadStoreService | null = null;

/**
 * Get the GoogleChatThreadStoreService singleton.
 *
 * @returns The service instance or null if not initialized
 */
export function getGchatThreadStore(): GoogleChatThreadStoreService | null {
  return instance;
}

/**
 * Set the GoogleChatThreadStoreService singleton.
 *
 * @param store - The service instance to set
 */
export function setGchatThreadStore(store: GoogleChatThreadStoreService): void {
  instance = store;
}

/**
 * Reset the GoogleChatThreadStoreService singleton (for testing).
 */
export function resetGchatThreadStore(): void {
  instance = null;
}
