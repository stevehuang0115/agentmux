/**
 * Unit tests for DailyLogService
 *
 * Tests daily log file creation, entry appending, reading, and multi-day
 * retrieval. Uses temporary directories to isolate each test case.
 *
 * @module services/memory/daily-log.service.test
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DailyLogService } from './daily-log.service.js';
import { CREWLY_CONSTANTS, MEMORY_CONSTANTS } from '../../constants.js';

describe('DailyLogService', () => {
  let service: DailyLogService;
  let testProjectDir: string;

  beforeEach(async () => {
    testProjectDir = path.join(
      os.tmpdir(),
      `crewly-daily-log-test-${Date.now()}-${Math.random().toString(36).substring(2)}`,
    );
    await fs.mkdir(testProjectDir, { recursive: true });

    DailyLogService.clearInstance();
    service = DailyLogService.getInstance();
  });

  afterEach(async () => {
    DailyLogService.clearInstance();
    try {
      await fs.rm(testProjectDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getInstance', () => {
    it('should return the same singleton instance on subsequent calls', () => {
      const instance1 = DailyLogService.getInstance();
      const instance2 = DailyLogService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should return a new instance after clearInstance is called', () => {
      const instance1 = DailyLogService.getInstance();
      DailyLogService.clearInstance();
      const instance2 = DailyLogService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('clearInstance', () => {
    it('should reset the singleton so getInstance creates a fresh instance', () => {
      const before = DailyLogService.getInstance();
      DailyLogService.clearInstance();
      const after = DailyLogService.getInstance();
      expect(before).not.toBe(after);
    });
  });

  describe('getLogPath', () => {
    it('should return path under .crewly/logs/daily using today\'s date by default', () => {
      const logPath = service.getLogPath(testProjectDir);
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const expectedDate = `${year}-${month}-${day}`;

      expect(logPath).toBe(
        path.join(
          testProjectDir,
          CREWLY_CONSTANTS.PATHS.CREWLY_HOME,
          MEMORY_CONSTANTS.PATHS.DAILY_LOG_DIR,
          `${expectedDate}.md`,
        ),
      );
    });

    it('should use the provided date string when specified', () => {
      const logPath = service.getLogPath(testProjectDir, '2026-01-15');
      expect(logPath).toContain('2026-01-15.md');
    });

    it('should produce a .md file extension', () => {
      const logPath = service.getLogPath(testProjectDir, '2026-03-01');
      expect(logPath.endsWith('.md')).toBe(true);
    });
  });

  describe('appendEntry', () => {
    it('should create the log file with a date header if it does not exist', async () => {
      await service.appendEntry(testProjectDir, 'agent-dev-1', 'developer', 'Started work');

      const logPath = service.getLogPath(testProjectDir);
      const content = await fs.readFile(logPath, 'utf-8');

      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const expectedDate = `${year}-${month}-${day}`;

      expect(content).toContain(`# Daily Log: ${expectedDate}`);
    });

    it('should append an entry with role, agentId, and time', async () => {
      await service.appendEntry(testProjectDir, 'agent-dev-1', 'developer', 'Started work');

      const logPath = service.getLogPath(testProjectDir);
      const content = await fs.readFile(logPath, 'utf-8');

      expect(content).toContain('## [developer / agent-dev-1]');
      expect(content).toContain('- Started work');
    });

    it('should include time in HH:MM format', async () => {
      await service.appendEntry(testProjectDir, 'agent-qa-1', 'qa', 'Ran tests');

      const logPath = service.getLogPath(testProjectDir);
      const content = await fs.readFile(logPath, 'utf-8');

      // Match the time pattern HH:MM after the closing bracket
      const timePattern = /\] \d{2}:\d{2}/;
      expect(content).toMatch(timePattern);
    });

    it('should append multiple entries to the same file', async () => {
      await service.appendEntry(testProjectDir, 'agent-dev-1', 'developer', 'First task');
      await service.appendEntry(testProjectDir, 'agent-dev-2', 'developer', 'Second task');

      const logPath = service.getLogPath(testProjectDir);
      const content = await fs.readFile(logPath, 'utf-8');

      expect(content).toContain('- First task');
      expect(content).toContain('- Second task');
      expect(content).toContain('agent-dev-1');
      expect(content).toContain('agent-dev-2');
    });

    it('should create the directory structure if it does not exist', async () => {
      const logDir = path.join(
        testProjectDir,
        CREWLY_CONSTANTS.PATHS.CREWLY_HOME,
        MEMORY_CONSTANTS.PATHS.DAILY_LOG_DIR,
      );

      // Verify directory does not exist yet
      await expect(fs.stat(logDir)).rejects.toThrow();

      await service.appendEntry(testProjectDir, 'orc', 'orchestrator', 'Session start');

      // Now the directory should exist
      const stat = await fs.stat(logDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should not duplicate the header on subsequent appends', async () => {
      await service.appendEntry(testProjectDir, 'a1', 'dev', 'First');
      await service.appendEntry(testProjectDir, 'a2', 'qa', 'Second');

      const logPath = service.getLogPath(testProjectDir);
      const content = await fs.readFile(logPath, 'utf-8');

      const headerMatches = content.match(/# Daily Log:/g);
      expect(headerMatches).toHaveLength(1);
    });
  });

  describe('getTodaysLog', () => {
    it('should return null when no log file exists for today', async () => {
      const result = await service.getTodaysLog(testProjectDir);
      expect(result).toBeNull();
    });

    it('should return the full content of today\'s log', async () => {
      await service.appendEntry(testProjectDir, 'agent-dev-1', 'developer', 'Implemented feature X');

      const result = await service.getTodaysLog(testProjectDir);

      expect(result).not.toBeNull();
      expect(result).toContain('# Daily Log:');
      expect(result).toContain('Implemented feature X');
    });

    it('should return content including all entries appended today', async () => {
      await service.appendEntry(testProjectDir, 'a1', 'dev', 'Entry one');
      await service.appendEntry(testProjectDir, 'a2', 'qa', 'Entry two');
      await service.appendEntry(testProjectDir, 'a3', 'pm', 'Entry three');

      const result = await service.getTodaysLog(testProjectDir);

      expect(result).toContain('Entry one');
      expect(result).toContain('Entry two');
      expect(result).toContain('Entry three');
    });
  });

  describe('getRecentLogs', () => {
    it('should return empty string when no log files exist', async () => {
      const result = await service.getRecentLogs(testProjectDir);
      expect(result).toBe('');
    });

    it('should return today\'s log when only today has entries', async () => {
      await service.appendEntry(testProjectDir, 'a1', 'dev', 'Today entry');

      const result = await service.getRecentLogs(testProjectDir);

      expect(result).toContain('Today entry');
    });

    it('should concatenate multiple days with separators', async () => {
      // Manually create log files for past days
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const todayDate = formatDateHelper(today);
      const yesterdayDate = formatDateHelper(yesterday);

      const todayPath = service.getLogPath(testProjectDir, todayDate);
      const yesterdayPath = service.getLogPath(testProjectDir, yesterdayDate);

      // Ensure directory exists
      await fs.mkdir(path.dirname(todayPath), { recursive: true });

      await fs.writeFile(todayPath, `# Daily Log: ${todayDate}\n\n## [dev / a1] 10:00\n- Today work\n\n`, 'utf-8');
      await fs.writeFile(yesterdayPath, `# Daily Log: ${yesterdayDate}\n\n## [dev / a1] 09:00\n- Yesterday work\n\n`, 'utf-8');

      const result = await service.getRecentLogs(testProjectDir, 2);

      expect(result).toContain('Today work');
      expect(result).toContain('Yesterday work');
      // Should have a separator between the two logs
      expect(result).toContain('---');
    });

    it('should skip days that have no log file', async () => {
      // Only create a log for 2 days ago (skip yesterday)
      const today = new Date();
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(today.getDate() - 2);

      const twoDaysAgoDate = formatDateHelper(twoDaysAgo);
      const twoDaysAgoPath = service.getLogPath(testProjectDir, twoDaysAgoDate);

      await fs.mkdir(path.dirname(twoDaysAgoPath), { recursive: true });
      await fs.writeFile(
        twoDaysAgoPath,
        `# Daily Log: ${twoDaysAgoDate}\n\n## [dev / a1] 08:00\n- Old work\n\n`,
        'utf-8',
      );

      const result = await service.getRecentLogs(testProjectDir, 3);

      expect(result).toContain('Old work');
      // Should not contain a separator since there is only one log
      expect(result).not.toContain('---');
    });

    it('should default to 3 days when no days parameter is provided', async () => {
      // Create logs for today and 3 days ago (outside the default window)
      const today = new Date();
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(today.getDate() - 3);

      const todayDate = formatDateHelper(today);
      const threeDaysAgoDate = formatDateHelper(threeDaysAgo);

      const todayPath = service.getLogPath(testProjectDir, todayDate);
      const threeDaysAgoPath = service.getLogPath(testProjectDir, threeDaysAgoDate);

      await fs.mkdir(path.dirname(todayPath), { recursive: true });

      await fs.writeFile(todayPath, `# Daily Log: ${todayDate}\n\n## [dev / a1] 10:00\n- Today\n\n`, 'utf-8');
      await fs.writeFile(
        threeDaysAgoPath,
        `# Daily Log: ${threeDaysAgoDate}\n\n## [dev / a1] 08:00\n- Three days ago\n\n`,
        'utf-8',
      );

      const result = await service.getRecentLogs(testProjectDir);

      // Default is 3 days (today, yesterday, day before) so 3 days ago is outside
      expect(result).toContain('Today');
      expect(result).not.toContain('Three days ago');
    });

    it('should return logs in reverse chronological order (newest first)', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const todayDate = formatDateHelper(today);
      const yesterdayDate = formatDateHelper(yesterday);

      const todayPath = service.getLogPath(testProjectDir, todayDate);
      const yesterdayPath = service.getLogPath(testProjectDir, yesterdayDate);

      await fs.mkdir(path.dirname(todayPath), { recursive: true });

      await fs.writeFile(todayPath, `# Daily Log: ${todayDate}\n\nTODAY_MARKER\n`, 'utf-8');
      await fs.writeFile(yesterdayPath, `# Daily Log: ${yesterdayDate}\n\nYESTERDAY_MARKER\n`, 'utf-8');

      const result = await service.getRecentLogs(testProjectDir, 2);

      const todayIndex = result.indexOf('TODAY_MARKER');
      const yesterdayIndex = result.indexOf('YESTERDAY_MARKER');

      expect(todayIndex).toBeLessThan(yesterdayIndex);
    });
  });
});

/**
 * Helper to format a Date as YYYY-MM-DD for test setup
 *
 * @param date - Date to format
 * @returns Formatted date string
 */
function formatDateHelper(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
