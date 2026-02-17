/**
 * Slack Image Service
 *
 * Handles downloading, validating, and managing Slack image files.
 * Downloads images sent by users in Slack to a local temp directory
 * so that agents can read them via their file-reading tools.
 *
 * @module services/slack/slack-image
 */

import { promises as fs } from 'fs';
import { createWriteStream } from 'fs';
import path from 'path';
import os from 'os';
import { pipeline } from 'stream/promises';
import { SLACK_IMAGE_CONSTANTS } from '../../constants.js';
import type { SlackFile, SlackImageInfo } from '../../types/slack.types.js';

/**
 * SlackImageService manages downloading and lifecycle of images
 * sent by Slack users. Downloaded files are stored under
 * `~/.agentmux/tmp/slack-images/` and cleaned up periodically.
 *
 * @example
 * ```typescript
 * const service = new SlackImageService();
 * await service.cleanupOnStartup();
 * service.startCleanup();
 * const imageInfo = await service.downloadImage(slackFile, botToken);
 * ```
 */
export class SlackImageService {
  private tempDir: string;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Create a new SlackImageService.
   *
   * @param agentmuxHome - Base agentmux home directory (defaults to ~/.agentmux)
   */
  constructor(agentmuxHome?: string) {
    const home = agentmuxHome || path.join(os.homedir(), '.agentmux');
    this.tempDir = path.join(home, SLACK_IMAGE_CONSTANTS.TEMP_DIR);
  }

  /**
   * Get the temp directory path for downloaded images.
   *
   * @returns Absolute path to the temp directory
   */
  getTempDir(): string {
    return this.tempDir;
  }

  /**
   * Download a Slack image file to the local temp directory.
   *
   * Validates the file MIME type and size before downloading.
   * Uses the Slack bot token to authenticate the download request.
   *
   * @param file - Slack file object from the event payload
   * @param botToken - Bot OAuth token for authenticating the download
   * @returns Downloaded image info with local path
   * @throws Error if file validation fails or download errors occur
   */
  async downloadImage(file: SlackFile, botToken: string): Promise<SlackImageInfo> {
    // Validate MIME type
    if (!SLACK_IMAGE_CONSTANTS.SUPPORTED_MIMES.includes(file.mimetype as typeof SLACK_IMAGE_CONSTANTS.SUPPORTED_MIMES[number])) {
      throw new Error(`Unsupported image type: ${file.mimetype}`);
    }

    // Validate file size
    if (file.size > SLACK_IMAGE_CONSTANTS.MAX_FILE_SIZE) {
      const maxMB = Math.round(SLACK_IMAGE_CONSTANTS.MAX_FILE_SIZE / (1024 * 1024));
      throw new Error(`File too large: ${file.size} bytes (max ${maxMB} MB)`);
    }

    // Ensure temp directory exists
    await fs.mkdir(this.tempDir, { recursive: true });

    // Sanitize filename to prevent path traversal
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const localPath = path.join(this.tempDir, `${file.id}-${safeName}`);

    // Download using native fetch with bearer token
    const downloadUrl = file.url_private_download || file.url_private;
    const response = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${botToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Empty response body from Slack');
    }

    // Stream response to file
    const fileStream = createWriteStream(localPath);
    // Convert Web ReadableStream to Node stream for pipeline
    const { Readable } = await import('stream');
    const nodeStream = Readable.fromWeb(response.body as import('stream/web').ReadableStream);
    await pipeline(nodeStream, fileStream);

    // Warn if temp dir is getting large
    await this.checkTempDirSize();

    return {
      id: file.id,
      name: file.name,
      mimetype: file.mimetype,
      localPath,
      width: file.original_w,
      height: file.original_h,
      permalink: file.permalink,
    };
  }

  /**
   * Start the periodic cleanup timer for expired temp files.
   * Runs every hour by default (configured by CLEANUP_INTERVAL).
   */
  startCleanup(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(async () => {
      try {
        const count = await this.cleanupExpired();
        if (count > 0) {
          console.log(`[SlackImageService] Cleaned up ${count} expired image(s)`);
        }
      } catch (err) {
        console.warn('[SlackImageService] Cleanup error:', err instanceof Error ? err.message : String(err));
      }
    }, SLACK_IMAGE_CONSTANTS.CLEANUP_INTERVAL);

    // Don't keep the process alive just for cleanup
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop the periodic cleanup timer.
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Delete temp files older than the configured TTL.
   *
   * @returns Number of files deleted
   */
  async cleanupExpired(): Promise<number> {
    try {
      await fs.access(this.tempDir);
    } catch {
      return 0; // Directory doesn't exist yet
    }

    const entries = await fs.readdir(this.tempDir);
    const now = Date.now();
    let deleted = 0;

    for (const entry of entries) {
      const filePath = path.join(this.tempDir, entry);
      try {
        const stat = await fs.stat(filePath);
        if (!stat.isFile()) continue;

        if (now - stat.mtimeMs > SLACK_IMAGE_CONSTANTS.FILE_TTL) {
          await fs.unlink(filePath);
          deleted++;
        }
      } catch {
        // File may have been deleted concurrently — ignore
      }
    }

    return deleted;
  }

  /**
   * Clean up all stale temp files on startup.
   * Called once during server initialization.
   */
  async cleanupOnStartup(): Promise<void> {
    const count = await this.cleanupExpired();
    if (count > 0) {
      console.log(`[SlackImageService] Startup cleanup: removed ${count} expired image(s)`);
    }
  }

  /**
   * Check temp directory total size and log a warning if it exceeds the threshold.
   */
  private async checkTempDirSize(): Promise<void> {
    try {
      const entries = await fs.readdir(this.tempDir);
      let totalSize = 0;

      for (const entry of entries) {
        try {
          const stat = await fs.stat(path.join(this.tempDir, entry));
          if (stat.isFile()) {
            totalSize += stat.size;
          }
        } catch {
          // Ignore stat errors
        }
      }

      if (totalSize > SLACK_IMAGE_CONSTANTS.MAX_TEMP_DIR_SIZE) {
        const sizeMB = Math.round(totalSize / (1024 * 1024));
        const thresholdMB = Math.round(SLACK_IMAGE_CONSTANTS.MAX_TEMP_DIR_SIZE / (1024 * 1024));
        console.warn(`[SlackImageService] Temp directory size (${sizeMB} MB) exceeds ${thresholdMB} MB threshold`);
      }
    } catch {
      // Non-critical — skip size check
    }
  }
}

/** Singleton instance */
let instance: SlackImageService | null = null;

/**
 * Get the SlackImageService singleton.
 *
 * @returns The service instance
 */
export function getSlackImageService(): SlackImageService {
  if (!instance) {
    instance = new SlackImageService();
  }
  return instance;
}

/**
 * Set the SlackImageService singleton.
 *
 * @param service - The service instance to set
 */
export function setSlackImageService(service: SlackImageService): void {
  instance = service;
}

/**
 * Reset the SlackImageService singleton (for testing).
 */
export function resetSlackImageService(): void {
  if (instance) {
    instance.stopCleanup();
  }
  instance = null;
}
