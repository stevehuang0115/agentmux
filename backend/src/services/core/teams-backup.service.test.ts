/**
 * Teams Backup Service Tests
 *
 * @module services/core/teams-backup.service.test
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { TeamsBackupService, type TeamsBackup } from './teams-backup.service.js';
import type { Team } from '../../types/index.js';

jest.mock('./logger.service.js', () => ({
  LoggerService: {
    getInstance: () => ({
      createComponentLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      }),
    }),
  },
}));

describe('TeamsBackupService', () => {
  let testDir: string;
  let service: TeamsBackupService;

  /**
   * Helper to create a mock Team object.
   *
   * @param id - Team ID
   * @param name - Team name
   * @returns A minimal Team object for testing
   */
  function createMockTeam(id: string, name: string): Team {
    return {
      id,
      name,
      projectIds: [],
      members: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  beforeEach(() => {
    TeamsBackupService.clearInstance();
    testDir = path.join(os.tmpdir(), `teams-backup-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    service = new TeamsBackupService(testDir);
  });

  afterEach(() => {
    TeamsBackupService.clearInstance();
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const a = TeamsBackupService.getInstance(testDir);
      const b = TeamsBackupService.getInstance(testDir);
      expect(a).toBe(b);
    });

    it('should reset after clearInstance', () => {
      const a = TeamsBackupService.getInstance(testDir);
      TeamsBackupService.clearInstance();
      const b = TeamsBackupService.getInstance(testDir);
      expect(a).not.toBe(b);
    });
  });

  describe('updateBackup', () => {
    it('should write backup file with teams data', async () => {
      const teams = [createMockTeam('t1', 'Team Alpha'), createMockTeam('t2', 'Team Beta')];
      await service.updateBackup(teams);

      const backupPath = service.getBackupPath();
      expect(existsSync(backupPath)).toBe(true);

      const content = await fs.readFile(backupPath, 'utf-8');
      const backup: TeamsBackup = JSON.parse(content);
      expect(backup.teams).toHaveLength(2);
      expect(backup.teams[0].name).toBe('Team Alpha');
      expect(backup.timestamp).toBeDefined();
    });

    it('should overwrite previous backup', async () => {
      await service.updateBackup([createMockTeam('t1', 'First')]);
      await service.updateBackup([createMockTeam('t2', 'Second'), createMockTeam('t3', 'Third')]);

      const backup = await service.readBackup();
      expect(backup!.teams).toHaveLength(2);
      expect(backup!.teams[0].name).toBe('Second');
    });

    it('should handle empty teams array', async () => {
      await service.updateBackup([]);

      const backup = await service.readBackup();
      expect(backup!.teams).toHaveLength(0);
    });
  });

  describe('readBackup', () => {
    it('should return null when no backup file exists', async () => {
      const backup = await service.readBackup();
      expect(backup).toBeNull();
    });

    it('should return parsed backup data', async () => {
      const teams = [createMockTeam('t1', 'Team One')];
      await service.updateBackup(teams);

      const backup = await service.readBackup();
      expect(backup).not.toBeNull();
      expect(backup!.teams).toHaveLength(1);
      expect(backup!.teams[0].id).toBe('t1');
    });

    it('should return null on corrupted backup file', async () => {
      await fs.writeFile(service.getBackupPath(), 'not valid json', 'utf-8');

      const backup = await service.readBackup();
      expect(backup).toBeNull();
    });
  });

  describe('getBackupStatus', () => {
    it('should report no mismatch when no backup exists', async () => {
      const status = await service.getBackupStatus([]);
      expect(status.hasMismatch).toBe(false);
      expect(status.backupTeamCount).toBe(0);
      expect(status.currentTeamCount).toBe(0);
      expect(status.backupTimestamp).toBeNull();
    });

    it('should report mismatch when current is empty but backup has data', async () => {
      await service.updateBackup([createMockTeam('t1', 'Alpha'), createMockTeam('t2', 'Beta')]);

      const status = await service.getBackupStatus([]);
      expect(status.hasMismatch).toBe(true);
      expect(status.backupTeamCount).toBe(2);
      expect(status.currentTeamCount).toBe(0);
      expect(status.backupTimestamp).toBeDefined();
    });

    it('should report no mismatch when both current and backup have data', async () => {
      const teams = [createMockTeam('t1', 'Alpha')];
      await service.updateBackup(teams);

      const status = await service.getBackupStatus(teams);
      expect(status.hasMismatch).toBe(false);
      expect(status.backupTeamCount).toBe(1);
      expect(status.currentTeamCount).toBe(1);
    });

    it('should report no mismatch when backup is empty', async () => {
      await service.updateBackup([]);

      const status = await service.getBackupStatus([]);
      expect(status.hasMismatch).toBe(false);
      expect(status.backupTeamCount).toBe(0);
      expect(status.currentTeamCount).toBe(0);
    });

    it('should report no mismatch when current has data (even if backup differs)', async () => {
      await service.updateBackup([createMockTeam('t1', 'Alpha'), createMockTeam('t2', 'Beta')]);

      const status = await service.getBackupStatus([createMockTeam('t1', 'Alpha')]);
      expect(status.hasMismatch).toBe(false);
      expect(status.backupTeamCount).toBe(2);
      expect(status.currentTeamCount).toBe(1);
    });
  });
});
