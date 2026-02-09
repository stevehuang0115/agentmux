/**
 * Teams Backup Service
 *
 * Provides automatic backup and restore functionality for teams data.
 * Writes a backup file on every save/delete, and can detect mismatches
 * when teams data is lost but a backup exists.
 *
 * @module services/core/teams-backup.service
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { Team } from '../../types/index.js';
import { LoggerService, ComponentLogger } from './logger.service.js';

/** File name for the teams backup */
const BACKUP_FILENAME = 'teams-backup.json';

/**
 * Shape of the backup file
 */
export interface TeamsBackup {
  /** ISO timestamp of when the backup was written */
  timestamp: string;
  /** Full team objects at time of backup */
  teams: Team[];
}

/**
 * Status returned by getBackupStatus
 */
export interface TeamsBackupStatus {
  /** Whether current teams are empty but backup has data */
  hasMismatch: boolean;
  /** Number of teams in the backup file */
  backupTeamCount: number;
  /** Number of teams currently in storage */
  currentTeamCount: number;
  /** ISO timestamp of the most recent backup */
  backupTimestamp: string | null;
}

/**
 * TeamsBackupService manages a single backup file that reflects
 * the most recent known-good state of teams data.
 *
 * @example
 * ```typescript
 * const backupService = TeamsBackupService.getInstance();
 * await backupService.updateBackup(teams);
 * const status = await backupService.getBackupStatus(currentTeams);
 * ```
 */
export class TeamsBackupService {
  private static instance: TeamsBackupService | null = null;

  private backupPath: string;
  private logger: ComponentLogger;

  /**
   * Create a new TeamsBackupService.
   *
   * @param agentmuxHome - Path to the .agentmux home directory
   */
  constructor(agentmuxHome?: string) {
    this.logger = LoggerService.getInstance().createComponentLogger('TeamsBackupService');
    const home = agentmuxHome || path.join(os.homedir(), '.agentmux');
    this.backupPath = path.join(home, BACKUP_FILENAME);
  }

  /**
   * Get singleton instance.
   *
   * @param agentmuxHome - Optional override for the home directory
   * @returns TeamsBackupService instance
   */
  static getInstance(agentmuxHome?: string): TeamsBackupService {
    if (!TeamsBackupService.instance) {
      TeamsBackupService.instance = new TeamsBackupService(agentmuxHome);
    }
    return TeamsBackupService.instance;
  }

  /**
   * Clear singleton instance (for testing).
   */
  static clearInstance(): void {
    TeamsBackupService.instance = null;
  }

  /**
   * Write or update the backup file with the current teams data.
   * Called after every successful saveTeam() or deleteTeam().
   *
   * @param teams - Current full list of teams
   */
  async updateBackup(teams: Team[]): Promise<void> {
    try {
      const backup: TeamsBackup = {
        timestamp: new Date().toISOString(),
        teams,
      };
      await fs.writeFile(this.backupPath, JSON.stringify(backup, null, 2), 'utf-8');
      this.logger.debug('Teams backup updated', { teamCount: teams.length });
    } catch (error) {
      this.logger.warn('Failed to update teams backup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Read the backup file from disk.
   *
   * @returns The parsed backup or null if no backup exists
   */
  async readBackup(): Promise<TeamsBackup | null> {
    try {
      const content = await fs.readFile(this.backupPath, 'utf-8');
      return JSON.parse(content) as TeamsBackup;
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return null;
      }
      this.logger.warn('Failed to read teams backup', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Check whether current teams data is empty but backup has data.
   *
   * @param currentTeams - The current teams from storage
   * @returns Backup status with mismatch flag
   */
  async getBackupStatus(currentTeams: Team[]): Promise<TeamsBackupStatus> {
    const backup = await this.readBackup();

    if (!backup) {
      return {
        hasMismatch: false,
        backupTeamCount: 0,
        currentTeamCount: currentTeams.length,
        backupTimestamp: null,
      };
    }

    return {
      hasMismatch: currentTeams.length === 0 && backup.teams.length > 0,
      backupTeamCount: backup.teams.length,
      currentTeamCount: currentTeams.length,
      backupTimestamp: backup.timestamp,
    };
  }

  /**
   * Get the backup file path (for testing).
   *
   * @returns Absolute path to the backup file
   */
  getBackupPath(): string {
    return this.backupPath;
  }
}
