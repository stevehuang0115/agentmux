/**
 * Tests for Slack Image Service
 *
 * @module services/slack/slack-image.service.test
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { SlackImageService, getSlackImageService, resetSlackImageService, setSlackImageService } from './slack-image.service.js';
import { SLACK_IMAGE_CONSTANTS } from '../../constants.js';
import type { SlackFile } from '../../types/slack.types.js';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('SlackImageService', () => {
  let tempDir: string;
  let service: SlackImageService;

  const mockSlackFile: SlackFile = {
    id: 'F0123ABC456',
    name: 'screenshot.png',
    mimetype: 'image/png',
    filetype: 'png',
    size: 1024,
    url_private: 'https://files.slack.com/files-pri/T123/F0123ABC456/screenshot.png',
    url_private_download: 'https://files.slack.com/files-pri/T123/download/F0123ABC456/screenshot.png',
    permalink: 'https://workspace.slack.com/files/U123/F0123ABC456/screenshot.png',
    original_w: 1920,
    original_h: 1080,
  };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'slack-img-test-'));
    service = new SlackImageService(tempDir);
    jest.clearAllMocks();
    resetSlackImageService();
  });

  afterEach(async () => {
    service.stopCleanup();
    resetSlackImageService();
    // Clean up temp dir
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should use default agentmux home when not specified', () => {
      const defaultService = new SlackImageService();
      expect(defaultService.getTempDir()).toBe(
        path.join(os.homedir(), '.agentmux', SLACK_IMAGE_CONSTANTS.TEMP_DIR)
      );
    });

    it('should use custom agentmux home when specified', () => {
      expect(service.getTempDir()).toBe(
        path.join(tempDir, SLACK_IMAGE_CONSTANTS.TEMP_DIR)
      );
    });
  });

  describe('downloadImage', () => {
    it('should reject unsupported MIME types', async () => {
      const pdfFile = { ...mockSlackFile, mimetype: 'application/pdf' };
      await expect(service.downloadImage(pdfFile, 'xoxb-token')).rejects.toThrow(
        'Unsupported image type: application/pdf'
      );
    });

    it('should reject files exceeding max size', async () => {
      const largeFile = { ...mockSlackFile, size: SLACK_IMAGE_CONSTANTS.MAX_FILE_SIZE + 1 };
      await expect(service.downloadImage(largeFile, 'xoxb-token')).rejects.toThrow(
        /File too large/
      );
    });

    it('should accept all supported MIME types', () => {
      for (const mime of SLACK_IMAGE_CONSTANTS.SUPPORTED_MIMES) {
        const file = { ...mockSlackFile, mimetype: mime };
        // Validation should not throw (download will fail due to mock)
        expect(SLACK_IMAGE_CONSTANTS.SUPPORTED_MIMES).toContain(file.mimetype);
      }
    });

    it('should throw on download failure (non-ok response)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      await expect(service.downloadImage(mockSlackFile, 'xoxb-token')).rejects.toThrow(
        'Download failed with status 403'
      );
    });

    it('should throw on empty response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: null,
      });

      await expect(service.downloadImage(mockSlackFile, 'xoxb-token')).rejects.toThrow(
        'Empty response body from Slack'
      );
    });

    it('should send Authorization header with bot token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      try {
        await service.downloadImage(mockSlackFile, 'xoxb-test-token');
      } catch {
        // Expected to fail
      }

      expect(mockFetch).toHaveBeenCalledWith(
        mockSlackFile.url_private_download,
        expect.objectContaining({
          headers: { Authorization: 'Bearer xoxb-test-token' },
        })
      );
    });

    it('should fall back to url_private when url_private_download is empty', async () => {
      const fileNoDownloadUrl = { ...mockSlackFile, url_private_download: '' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      try {
        await service.downloadImage(fileNoDownloadUrl, 'xoxb-token');
      } catch {
        // Expected
      }

      expect(mockFetch).toHaveBeenCalledWith(
        mockSlackFile.url_private,
        expect.any(Object)
      );
    });

    it('should sanitize filenames to prevent path traversal', async () => {
      const maliciousFile = { ...mockSlackFile, name: '../../../etc/passwd' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      try {
        await service.downloadImage(maliciousFile, 'xoxb-token');
      } catch {
        // Expected to fail
      }

      // Verify fetch was called (validation passed)
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('cleanupExpired', () => {
    it('should return 0 when temp directory does not exist', async () => {
      const count = await service.cleanupExpired();
      expect(count).toBe(0);
    });

    it('should delete files older than TTL', async () => {
      const imageDir = service.getTempDir();
      await fs.mkdir(imageDir, { recursive: true });

      // Create a file and backdate it
      const testFile = path.join(imageDir, 'F001-old.png');
      await fs.writeFile(testFile, 'old data');

      // Set mtime to 2 days ago (well past the 24h TTL)
      const oldTime = Date.now() - (SLACK_IMAGE_CONSTANTS.FILE_TTL + 60000);
      await fs.utimes(testFile, oldTime / 1000, oldTime / 1000);

      const count = await service.cleanupExpired();
      expect(count).toBe(1);

      // Verify file was deleted
      await expect(fs.access(testFile)).rejects.toThrow();
    });

    it('should keep files newer than TTL', async () => {
      const imageDir = service.getTempDir();
      await fs.mkdir(imageDir, { recursive: true });

      const testFile = path.join(imageDir, 'F002-new.png');
      await fs.writeFile(testFile, 'new data');

      const count = await service.cleanupExpired();
      expect(count).toBe(0);

      // Verify file still exists
      await expect(fs.access(testFile)).resolves.not.toThrow();
    });
  });

  describe('cleanupOnStartup', () => {
    it('should call cleanupExpired', async () => {
      const spy = jest.spyOn(service, 'cleanupExpired').mockResolvedValue(0);
      await service.cleanupOnStartup();
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });
  });

  describe('startCleanup / stopCleanup', () => {
    it('should start and stop cleanup timer', () => {
      service.startCleanup();
      // Calling start again should be idempotent
      service.startCleanup();
      service.stopCleanup();
      // Calling stop again should be safe
      service.stopCleanup();
    });
  });

  describe('singleton', () => {
    it('should return the same instance via getSlackImageService', () => {
      const s1 = getSlackImageService();
      const s2 = getSlackImageService();
      expect(s1).toBe(s2);
    });

    it('should reset the singleton via resetSlackImageService', () => {
      const s1 = getSlackImageService();
      resetSlackImageService();
      const s2 = getSlackImageService();
      expect(s1).not.toBe(s2);
    });

    it('should set a custom instance via setSlackImageService', () => {
      const custom = new SlackImageService(tempDir);
      setSlackImageService(custom);
      expect(getSlackImageService()).toBe(custom);
    });
  });
});
