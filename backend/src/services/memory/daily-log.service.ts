/**
 * Daily Log Service
 *
 * Manages daily markdown log files for tracking agent activities within a project.
 * Each day produces a single log file at `{projectPath}/.agentmux/logs/daily/YYYY-MM-DD.md`
 * containing timestamped entries grouped by agent role and ID.
 *
 * Log entries are append-only and provide a human-readable audit trail of what
 * each agent worked on during the day. The orchestrator and agents can review
 * recent logs to maintain continuity across sessions.
 *
 * @module services/memory/daily-log.service
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { ensureDir } from '../../utils/file-io.utils.js';
import { MEMORY_CONSTANTS, AGENTMUX_CONSTANTS } from '../../constants.js';
import { LoggerService } from '../core/logger.service.js';

/**
 * Separator inserted between concatenated daily logs in multi-day views
 */
const LOG_SEPARATOR = '\n---\n\n';

/**
 * Service for managing daily agent activity logs
 *
 * Follows singleton pattern for consistent state management across the backend.
 * Uses append-only file writes since log entries are never modified after creation.
 *
 * @example
 * ```typescript
 * const dailyLog = DailyLogService.getInstance();
 * await dailyLog.appendEntry('/path/to/project', 'agent-dev-1', 'developer', 'Started login page implementation');
 * const todayLog = await dailyLog.getTodaysLog('/path/to/project');
 * ```
 */
export class DailyLogService {
  private static instance: DailyLogService | null = null;

  private readonly logger = LoggerService.getInstance().createComponentLogger('DailyLogService');

  /**
   * Creates a new DailyLogService instance
   *
   * Use {@link getInstance} to obtain the singleton instance instead of
   * calling this constructor directly.
   */
  private constructor() {
    // No initialization needed; all operations are path-based
  }

  /**
   * Gets the singleton instance of DailyLogService
   *
   * @returns The singleton DailyLogService instance
   */
  public static getInstance(): DailyLogService {
    if (!DailyLogService.instance) {
      DailyLogService.instance = new DailyLogService();
    }
    return DailyLogService.instance;
  }

  /**
   * Clears the singleton instance
   *
   * Primarily used in tests to reset state between test cases.
   */
  public static clearInstance(): void {
    DailyLogService.instance = null;
  }

  // ========================= PRIVATE HELPERS =========================

  /**
   * Formats a Date object as a YYYY-MM-DD string
   *
   * @param date - The date to format
   * @returns Date string in YYYY-MM-DD format
   *
   * @example
   * ```typescript
   * formatDate(new Date('2026-02-09T14:30:00Z')); // '2026-02-09'
   * ```
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Formats a Date object as an HH:MM time string (24-hour format)
   *
   * @param date - The date to format
   * @returns Time string in HH:MM format
   *
   * @example
   * ```typescript
   * formatTime(new Date('2026-02-09T14:05:00')); // '14:05'
   * ```
   */
  private formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // ========================= PUBLIC INTERFACE =========================

  /**
   * Returns the absolute path to a daily log file
   *
   * Constructs the path using the project's `.agentmux` directory and the
   * configured daily log subdirectory from MEMORY_CONSTANTS.
   *
   * @param projectPath - Absolute path to the project root
   * @param date - Optional date string in YYYY-MM-DD format; defaults to today
   * @returns Absolute path to the daily log file
   *
   * @example
   * ```typescript
   * const logPath = dailyLog.getLogPath('/home/user/my-project');
   * // '/home/user/my-project/.agentmux/logs/daily/2026-02-09.md'
   *
   * const pastLogPath = dailyLog.getLogPath('/home/user/my-project', '2026-02-07');
   * // '/home/user/my-project/.agentmux/logs/daily/2026-02-07.md'
   * ```
   */
  public getLogPath(projectPath: string, date?: string): string {
    const dateStr = date ?? this.formatDate(new Date());
    return path.join(
      projectPath,
      AGENTMUX_CONSTANTS.PATHS.AGENTMUX_HOME,
      MEMORY_CONSTANTS.PATHS.DAILY_LOG_DIR,
      `${dateStr}.md`,
    );
  }

  /**
   * Appends a timestamped activity entry to today's daily log
   *
   * Creates the log file with a date header if it does not already exist.
   * Each entry is formatted as a markdown section with the agent's role, ID,
   * and current time, followed by the entry text as a bullet point.
   *
   * Uses `fs.appendFile` (not atomic write) since daily logs are append-only
   * and a partial write is acceptable -- the next append will still succeed.
   *
   * @param projectPath - Absolute path to the project root
   * @param agentId - Unique identifier of the agent making the entry
   * @param role - Agent's role (e.g., 'developer', 'orchestrator', 'qa')
   * @param entry - Free-text description of the activity
   * @throws Error if the directory cannot be created or the file cannot be written
   *
   * @example
   * ```typescript
   * await dailyLog.appendEntry(
   *   '/home/user/my-project',
   *   'agent-dev-1',
   *   'developer',
   *   'Started login page implementation'
   * );
   * // Appends to .agentmux/logs/daily/2026-02-09.md:
   * // ## [developer / agent-dev-1] 14:05
   * // - Started login page implementation
   * ```
   */
  public async appendEntry(
    projectPath: string,
    agentId: string,
    role: string,
    entry: string,
  ): Promise<void> {
    const now = new Date();
    const dateStr = this.formatDate(now);
    const timeStr = this.formatTime(now);
    const logFilePath = this.getLogPath(projectPath, dateStr);
    const logDir = path.dirname(logFilePath);

    try {
      // Ensure the directory tree exists
      await ensureDir(logDir);

      // If the file does not exist, create it with the daily header
      if (!existsSync(logFilePath)) {
        const header = `# Daily Log: ${dateStr}\n\n`;
        await fs.writeFile(logFilePath, header, 'utf-8');
        this.logger.debug('Created new daily log file', { projectPath, date: dateStr });
      }

      // Build and append the entry block
      const entryBlock = `## [${role} / ${agentId}] ${timeStr}\n- ${entry}\n\n`;
      await fs.appendFile(logFilePath, entryBlock, 'utf-8');

      this.logger.debug('Appended daily log entry', {
        projectPath,
        agentId,
        role,
        date: dateStr,
        time: timeStr,
      });
    } catch (error) {
      this.logger.error('Failed to append daily log entry', {
        projectPath,
        agentId,
        role,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Reads the contents of today's daily log file
   *
   * @param projectPath - Absolute path to the project root
   * @returns The full markdown content of today's log, or null if no log exists yet
   *
   * @example
   * ```typescript
   * const log = await dailyLog.getTodaysLog('/home/user/my-project');
   * if (log) {
   *   console.log(log);
   * } else {
   *   console.log('No activity logged today');
   * }
   * ```
   */
  public async getTodaysLog(projectPath: string): Promise<string | null> {
    const logFilePath = this.getLogPath(projectPath);

    try {
      const content = await fs.readFile(logFilePath, 'utf-8');
      return content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      this.logger.error('Failed to read today\'s daily log', {
        projectPath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Reads and concatenates the most recent daily logs
   *
   * Iterates backwards from today through the specified number of days,
   * reading each log file that exists and joining them with markdown
   * separators. Days without log files are silently skipped.
   *
   * @param projectPath - Absolute path to the project root
   * @param days - Number of days to look back (default: 3, including today)
   * @returns Concatenated log content, or empty string if no logs found
   *
   * @example
   * ```typescript
   * // Get the last 7 days of logs
   * const recentLogs = await dailyLog.getRecentLogs('/home/user/my-project', 7);
   * ```
   */
  public async getRecentLogs(projectPath: string, days: number = 3): Promise<string> {
    const logs: string[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = this.formatDate(date);
      const logFilePath = this.getLogPath(projectPath, dateStr);

      try {
        const content = await fs.readFile(logFilePath, 'utf-8');
        logs.push(content.trim());
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          // No log for this day -- skip silently
          continue;
        }
        this.logger.warn('Failed to read daily log', {
          projectPath,
          date: dateStr,
          error: error instanceof Error ? error.message : String(error),
        });
        // Non-fatal: skip this day's log and continue
      }
    }

    if (logs.length === 0) {
      return '';
    }

    return logs.join(LOG_SEPARATOR);
  }
}
