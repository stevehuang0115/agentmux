/**
 * Tests for SlackThreadStoreService
 *
 * @module services/slack/slack-thread-store.service.test
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  SlackThreadStoreService,
  getSlackThreadStore,
  setSlackThreadStore,
  resetSlackThreadStore,
} from './slack-thread-store.service.js';
import { SLACK_THREAD_CONSTANTS } from '../../constants.js';

describe('SlackThreadStoreService', () => {
  let store: SlackThreadStoreService;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'slack-thread-test-'));
    store = new SlackThreadStoreService(tmpDir);
  });

  afterEach(async () => {
    resetSlackThreadStore();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('getThreadFilePath', () => {
    it('should compute correct file path', () => {
      const result = store.getThreadFilePath('C123', '1707432600.000001');
      const expected = path.join(
        tmpDir,
        SLACK_THREAD_CONSTANTS.STORAGE_DIR,
        'C123',
        `1707432600.000001${SLACK_THREAD_CONSTANTS.FILE_EXTENSION}`
      );
      expect(result).toBe(expected);
    });

    it('should handle different channel/thread combinations', () => {
      const path1 = store.getThreadFilePath('C111', '1111.111');
      const path2 = store.getThreadFilePath('C222', '2222.222');
      expect(path1).not.toBe(path2);
    });
  });

  describe('ensureThreadFile', () => {
    it('should create thread file with frontmatter', async () => {
      const filePath = await store.ensureThreadFile('C123', '1707.001', 'Steve');

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('---');
      expect(content).toContain('channel: C123');
      expect(content).toContain('thread: 1707.001');
      expect(content).toContain('user: Steve');
      expect(content).toContain('agents: []');
      expect(content).toContain('## Messages');
    });

    it('should not overwrite existing file', async () => {
      const filePath = await store.ensureThreadFile('C123', '1707.001', 'Steve');

      // Append something
      await fs.appendFile(filePath, 'extra content\n', 'utf-8');

      // Call again — should not overwrite
      await store.ensureThreadFile('C123', '1707.001', 'Steve');

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('extra content');
    });

    it('should create nested directories', async () => {
      const filePath = await store.ensureThreadFile('C456', '9999.999', 'Alice');
      const dir = path.dirname(filePath);

      const stat = await fs.stat(dir);
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe('appendUserMessage', () => {
    it('should append user message to thread file', async () => {
      await store.appendUserMessage('C123', '1707.001', 'Steve', 'Hello world');

      const filePath = store.getThreadFilePath('C123', '1707.001');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('**Steve**');
      expect(content).toContain('Hello world');
    });

    it('should create thread file if it does not exist', async () => {
      await store.appendUserMessage('C999', '8888.001', 'Bob', 'First message');

      const filePath = store.getThreadFilePath('C999', '8888.001');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('channel: C999');
      expect(content).toContain('**Bob**');
      expect(content).toContain('First message');
    });

    it('should append image metadata when images are provided', async () => {
      await store.appendUserMessage('C123', '1707.001', 'Steve', 'Check this screenshot', [
        {
          id: 'F001',
          name: 'screenshot.png',
          mimetype: 'image/png',
          localPath: '/tmp/slack-images/F001-screenshot.png',
          width: 1920,
          height: 1080,
          permalink: 'https://slack.com/files/F001',
        },
      ]);

      const filePath = store.getThreadFilePath('C123', '1707.001');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('**Steve**');
      expect(content).toContain('Check this screenshot');
      expect(content).toContain('![screenshot.png](slack://F001)');
      expect(content).toContain('_(1920x1080, image/png)_');
      expect(content).toContain('Local: /tmp/slack-images/F001-screenshot.png');
    });

    it('should handle images without dimensions', async () => {
      await store.appendUserMessage('C123', '1707.001', 'Steve', 'An image', [
        {
          id: 'F002',
          name: 'photo.jpg',
          mimetype: 'image/jpeg',
          localPath: '/tmp/slack-images/F002-photo.jpg',
          permalink: 'https://slack.com/files/F002',
        },
      ]);

      const filePath = store.getThreadFilePath('C123', '1707.001');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('_(image/jpeg)_');
    });

    it('should append multiple messages', async () => {
      await store.appendUserMessage('C123', '1707.001', 'Steve', 'Message 1');
      await store.appendUserMessage('C123', '1707.001', 'Alice', 'Message 2');

      const filePath = store.getThreadFilePath('C123', '1707.001');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('Message 1');
      expect(content).toContain('Message 2');
      expect(content).toContain('**Steve**');
      expect(content).toContain('**Alice**');
    });
  });

  describe('appendOrchestratorReply', () => {
    it('should append orchestrator reply to existing thread', async () => {
      await store.ensureThreadFile('C123', '1707.001', 'Steve');
      await store.appendOrchestratorReply('C123', '1707.001', 'I will handle that.');

      const filePath = store.getThreadFilePath('C123', '1707.001');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('**Crewly**');
      expect(content).toContain('I will handle that.');
    });

    it('should skip silently if thread file does not exist', async () => {
      // Should not throw
      await store.appendOrchestratorReply('CXXX', '0000.000', 'No thread here');

      const filePath = store.getThreadFilePath('CXXX', '0000.000');
      await expect(fs.access(filePath)).rejects.toThrow();
    });
  });

  describe('registerAgent', () => {
    it('should register agent in index', async () => {
      await store.ensureThreadFile('C123', '1707.001', 'Steve');
      await store.registerAgent('team-joe-abc', 'Joe', 'C123', '1707.001');

      const threads = store.findThreadsForAgent('team-joe-abc');
      expect(threads).toHaveLength(1);
      expect(threads[0].channelId).toBe('C123');
      expect(threads[0].threadTs).toBe('1707.001');
    });

    it('should avoid duplicate registrations', async () => {
      await store.ensureThreadFile('C123', '1707.001', 'Steve');
      await store.registerAgent('team-joe-abc', 'Joe', 'C123', '1707.001');
      await store.registerAgent('team-joe-abc', 'Joe', 'C123', '1707.001');

      const threads = store.findThreadsForAgent('team-joe-abc');
      expect(threads).toHaveLength(1);
    });

    it('should support multiple threads per agent', async () => {
      await store.ensureThreadFile('C123', '1707.001', 'Steve');
      await store.ensureThreadFile('C456', '1707.002', 'Alice');

      await store.registerAgent('team-joe-abc', 'Joe', 'C123', '1707.001');
      await store.registerAgent('team-joe-abc', 'Joe', 'C456', '1707.002');

      const threads = store.findThreadsForAgent('team-joe-abc');
      expect(threads).toHaveLength(2);
    });

    it('should persist index to disk', async () => {
      await store.ensureThreadFile('C123', '1707.001', 'Steve');
      await store.registerAgent('team-joe-abc', 'Joe', 'C123', '1707.001');

      const indexPath = path.join(
        tmpDir,
        SLACK_THREAD_CONSTANTS.STORAGE_DIR,
        SLACK_THREAD_CONSTANTS.AGENT_INDEX_FILE
      );
      const data = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(data);

      expect(index['team-joe-abc']).toBeDefined();
      expect(index['team-joe-abc']).toHaveLength(1);
      expect(index['team-joe-abc'][0].channelId).toBe('C123');
    });

    it('should update thread frontmatter', async () => {
      await store.ensureThreadFile('C123', '1707.001', 'Steve');
      await store.registerAgent('team-joe-abc', 'Joe', 'C123', '1707.001');

      const filePath = store.getThreadFilePath('C123', '1707.001');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('session: team-joe-abc');
      expect(content).toContain('name: Joe');
      expect(content).not.toContain('agents: []');
    });
  });

  describe('findThreadsForAgent', () => {
    it('should return empty array for unknown agent', () => {
      const threads = store.findThreadsForAgent('unknown-session');
      expect(threads).toHaveLength(0);
    });

    it('should return correct file paths', async () => {
      await store.ensureThreadFile('C123', '1707.001', 'Steve');
      await store.registerAgent('team-joe', 'Joe', 'C123', '1707.001');

      const threads = store.findThreadsForAgent('team-joe');
      expect(threads[0].filePath).toBe(store.getThreadFilePath('C123', '1707.001'));
    });
  });

  describe('singleton', () => {
    it('should start as null', () => {
      resetSlackThreadStore();
      expect(getSlackThreadStore()).toBeNull();
    });

    it('should set and get instance', () => {
      const instance = new SlackThreadStoreService();
      setSlackThreadStore(instance);
      expect(getSlackThreadStore()).toBe(instance);
    });

    it('should reset instance', () => {
      setSlackThreadStore(new SlackThreadStoreService());
      resetSlackThreadStore();
      expect(getSlackThreadStore()).toBeNull();
    });
  });
});
