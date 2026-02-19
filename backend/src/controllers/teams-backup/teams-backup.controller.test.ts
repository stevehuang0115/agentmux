/**
 * Teams Backup Controller Tests
 *
 * @module controllers/teams-backup/teams-backup.controller.test
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import type { Team } from '../../types/index.js';

// Mock data holders
const mockTeams: { value: Team[] } = { value: [] };
const mockBackup: { value: { timestamp: string; teams: Team[] } | null } = { value: null };

jest.mock('../../services/core/storage.service', () => ({
  StorageService: {
    getInstance: () => ({
      getTeams: async () => mockTeams.value,
      saveTeam: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    }),
  },
}));

jest.mock('../../services/core/teams-backup.service', () => ({
  TeamsBackupService: {
    getInstance: () => ({
      getBackupStatus: async (currentTeams: Team[]) => ({
        hasMismatch: currentTeams.length === 0 && (mockBackup.value?.teams?.length || 0) > 0,
        backupTeamCount: mockBackup.value?.teams?.length || 0,
        currentTeamCount: currentTeams.length,
        backupTimestamp: mockBackup.value?.timestamp || null,
      }),
      readBackup: async () => mockBackup.value,
    }),
  },
}));

jest.mock('../../services/core/logger.service.js', () => ({
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

import { getBackupStatus, restoreFromBackup } from './teams-backup.controller.js';

/**
 * Helper to create a mock Team.
 *
 * @param id - Team ID
 * @param name - Team name
 * @returns Minimal Team object
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

/**
 * Helper to create mock Express request/response/next.
 */
function createMockReqRes() {
  const req = {} as Request;
  const res = {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as unknown as NextFunction;
  return { req, res, next };
}

describe('TeamsBackupController', () => {
  beforeEach(() => {
    mockTeams.value = [];
    mockBackup.value = null;
    jest.clearAllMocks();
  });

  describe('getBackupStatus', () => {
    it('should return no mismatch when no backup exists', async () => {
      const { req, res, next } = createMockReqRes();
      await getBackupStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          hasMismatch: false,
          backupTeamCount: 0,
          currentTeamCount: 0,
        }),
      });
    });

    it('should report mismatch when current is empty but backup has data', async () => {
      mockBackup.value = {
        timestamp: '2026-02-08T00:00:00.000Z',
        teams: [createMockTeam('t1', 'Alpha'), createMockTeam('t2', 'Beta')],
      };

      const { req, res, next } = createMockReqRes();
      await getBackupStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          hasMismatch: true,
          backupTeamCount: 2,
          currentTeamCount: 0,
        }),
      });
    });

    it('should report no mismatch when current has data', async () => {
      mockTeams.value = [createMockTeam('t1', 'Alpha')];
      mockBackup.value = {
        timestamp: '2026-02-08T00:00:00.000Z',
        teams: [createMockTeam('t1', 'Alpha')],
      };

      const { req, res, next } = createMockReqRes();
      await getBackupStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          hasMismatch: false,
          backupTeamCount: 1,
          currentTeamCount: 1,
        }),
      });
    });
  });

  describe('restoreFromBackup', () => {
    it('should return 404 when no backup exists', async () => {
      const { req, res, next } = createMockReqRes();
      await restoreFromBackup(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    it('should return 404 when backup is empty', async () => {
      mockBackup.value = {
        timestamp: '2026-02-08T00:00:00.000Z',
        teams: [],
      };

      const { req, res, next } = createMockReqRes();
      await restoreFromBackup(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should restore teams from backup successfully', async () => {
      mockBackup.value = {
        timestamp: '2026-02-08T00:00:00.000Z',
        teams: [createMockTeam('t1', 'Alpha'), createMockTeam('t2', 'Beta')],
      };

      const { req, res, next } = createMockReqRes();
      await restoreFromBackup(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          restoredCount: 2,
          totalInBackup: 2,
        }),
      });
    });
  });
});
