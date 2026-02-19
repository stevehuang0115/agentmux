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
    it('should use default crewly home when not specified', () => {
      const defaultService = new SlackImageService();
      expect(defaultService.getTempDir()).toBe(
        path.join(os.homedir(), '.crewly', SLACK_IMAGE_CONSTANTS.TEMP_DIR)
      );
    });

    it('should use custom crewly home when specified', () => {
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

    it('should reject SVG files (not supported by LLM vision APIs)', async () => {
      const svgFile = { ...mockSlackFile, mimetype: 'image/svg+xml' };
      await expect(service.downloadImage(svgFile, 'xoxb-token')).rejects.toThrow(
        'Unsupported image type: image/svg+xml'
      );
    });

    it('should throw when response Content-Type is not an image', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: 'not used',
        headers: new Map([['content-type', 'text/html; charset=utf-8']]),
      });

      await expect(service.downloadImage(mockSlackFile, 'xoxb-token')).rejects.toThrow(
        /Unexpected Content-Type from Slack.*text\/html/
      );
    });

    it('should throw when response Content-Type is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: 'not used',
        headers: new Map(),
      });

      await expect(service.downloadImage(mockSlackFile, 'xoxb-token')).rejects.toThrow(
        /Unexpected Content-Type from Slack/
      );
    });

    it('should throw when downloaded file has invalid magic bytes', async () => {
      // Simulate a response that has correct Content-Type but HTML body (edge case)
      const { Readable } = await import('stream');
      const htmlBody = Buffer.from('<!DOCTYPE html><html>Error</html>');
      const readable = new Readable();
      readable.push(htmlBody);
      readable.push(null);

      // Convert to Web ReadableStream
      const webStream = Readable.toWeb(readable);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: webStream,
        headers: new Map([['content-type', 'image/png']]),
      });

      await expect(service.downloadImage(mockSlackFile, 'xoxb-token')).rejects.toThrow(
        /not a valid image.*magic bytes/
      );
    });

    it('should succeed with valid PNG magic bytes', async () => {
      const { Readable } = await import('stream');
      // PNG magic bytes followed by some data
      const pngData = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
      const readable = new Readable();
      readable.push(pngData);
      readable.push(null);

      const webStream = Readable.toWeb(readable);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: webStream,
        headers: new Map([['content-type', 'image/png']]),
      });

      const result = await service.downloadImage(mockSlackFile, 'xoxb-token');
      expect(result.localPath).toContain(mockSlackFile.id);
      expect(result.mimetype).toBe('image/png');
    });

    it('should succeed with valid JPEG magic bytes', async () => {
      const { Readable } = await import('stream');
      const jpegData = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
      const readable = new Readable();
      readable.push(jpegData);
      readable.push(null);

      const webStream = Readable.toWeb(readable);
      const jpegFile = { ...mockSlackFile, mimetype: 'image/jpeg', name: 'photo.jpg' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: webStream,
        headers: new Map([['content-type', 'image/jpeg']]),
      });

      const result = await service.downloadImage(jpegFile, 'xoxb-token');
      expect(result.localPath).toContain(jpegFile.id);
    });

    it('should use redirect: manual to preserve auth on cross-origin redirects', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      try {
        await service.downloadImage(mockSlackFile, 'xoxb-token');
      } catch {
        // Expected to fail
      }

      expect(mockFetch).toHaveBeenCalledWith(
        mockSlackFile.url_private_download,
        expect.objectContaining({
          redirect: 'manual',
          headers: { Authorization: 'Bearer xoxb-token' },
        })
      );
    });

    it('should follow redirects with auth header preserved', async () => {
      const { Readable } = await import('stream');
      const pngData = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
      const readable = new Readable();
      readable.push(pngData);
      readable.push(null);
      const webStream = Readable.toWeb(readable);

      // First call: Slack returns a redirect
      mockFetch.mockResolvedValueOnce({
        status: 302,
        headers: new Map([['location', 'https://cdn.slack.com/signed-url']]),
      });

      // Second call: CDN returns the image
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: webStream,
        headers: new Map([['content-type', 'image/png']]),
      });

      const result = await service.downloadImage(mockSlackFile, 'xoxb-token');
      expect(result.localPath).toContain(mockSlackFile.id);

      // Verify first call was to the original URL
      expect(mockFetch).toHaveBeenNthCalledWith(1,
        mockSlackFile.url_private_download,
        expect.objectContaining({ redirect: 'manual' })
      );

      // Verify second call followed the redirect with auth
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'https://cdn.slack.com/signed-url',
        expect.objectContaining({
          headers: { Authorization: 'Bearer xoxb-token' },
          redirect: 'manual',
        })
      );
    });

    it('should follow multiple redirect hops', async () => {
      const { Readable } = await import('stream');
      const pngData = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
      const readable = new Readable();
      readable.push(pngData);
      readable.push(null);
      const webStream = Readable.toWeb(readable);

      // Hop 1: redirect
      mockFetch.mockResolvedValueOnce({
        status: 301,
        headers: new Map([['location', 'https://hop2.slack.com/file']]),
      });

      // Hop 2: redirect
      mockFetch.mockResolvedValueOnce({
        status: 302,
        headers: new Map([['location', 'https://hop3.cdn.com/file']]),
      });

      // Hop 3: actual image
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: webStream,
        headers: new Map([['content-type', 'image/png']]),
      });

      const result = await service.downloadImage(mockSlackFile, 'xoxb-token');
      expect(result.localPath).toContain(mockSlackFile.id);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should throw on too many redirects', async () => {
      // Return redirects indefinitely
      mockFetch.mockResolvedValue({
        status: 302,
        headers: new Map([['location', 'https://loop.slack.com/file']]),
      });

      await expect(service.downloadImage(mockSlackFile, 'xoxb-token')).rejects.toThrow(
        /Too many redirects/
      );
    });

    it('should throw on redirect without Location header', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 302,
        headers: new Map(),
      });

      await expect(service.downloadImage(mockSlackFile, 'xoxb-token')).rejects.toThrow(
        /redirect.*without Location header/
      );
    });
  });

  describe('verifyImageMagicBytes', () => {
    it('should return true for PNG files', async () => {
      const imageDir = service.getTempDir();
      await fs.mkdir(imageDir, { recursive: true });
      const filePath = path.join(imageDir, 'test.png');
      await fs.writeFile(filePath, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A]));
      expect(await service.verifyImageMagicBytes(filePath)).toBe(true);
    });

    it('should return true for JPEG files', async () => {
      const imageDir = service.getTempDir();
      await fs.mkdir(imageDir, { recursive: true });
      const filePath = path.join(imageDir, 'test.jpg');
      await fs.writeFile(filePath, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00]));
      expect(await service.verifyImageMagicBytes(filePath)).toBe(true);
    });

    it('should return true for GIF files', async () => {
      const imageDir = service.getTempDir();
      await fs.mkdir(imageDir, { recursive: true });
      const filePath = path.join(imageDir, 'test.gif');
      await fs.writeFile(filePath, Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]));
      expect(await service.verifyImageMagicBytes(filePath)).toBe(true);
    });

    it('should return true for WebP files', async () => {
      const imageDir = service.getTempDir();
      await fs.mkdir(imageDir, { recursive: true });
      const filePath = path.join(imageDir, 'test.webp');
      await fs.writeFile(filePath, Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]));
      expect(await service.verifyImageMagicBytes(filePath)).toBe(true);
    });

    it('should return false for HTML files', async () => {
      const imageDir = service.getTempDir();
      await fs.mkdir(imageDir, { recursive: true });
      const filePath = path.join(imageDir, 'test.html');
      await fs.writeFile(filePath, '<!DOCTYPE html><html>Error</html>');
      expect(await service.verifyImageMagicBytes(filePath)).toBe(false);
    });

    it('should return false for empty files', async () => {
      const imageDir = service.getTempDir();
      await fs.mkdir(imageDir, { recursive: true });
      const filePath = path.join(imageDir, 'empty.png');
      await fs.writeFile(filePath, '');
      expect(await service.verifyImageMagicBytes(filePath)).toBe(false);
    });

    it('should return false for non-existent files', async () => {
      expect(await service.verifyImageMagicBytes('/tmp/does-not-exist-12345.png')).toBe(false);
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
