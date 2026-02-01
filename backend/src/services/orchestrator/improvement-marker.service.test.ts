/**
 * Tests for Improvement Marker Service
 *
 * @module services/orchestrator/improvement-marker.service.test
 */

// Jest globals are available automatically
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  ImprovementMarkerService,
  getImprovementMarkerService,
  resetImprovementMarkerService,
} from './improvement-marker.service.js';

describe('ImprovementMarkerService', () => {
  let testDir: string;
  let service: ImprovementMarkerService;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `marker-test-${Date.now()}`);
    service = new ImprovementMarkerService(testDir);
    await service.initialize();
  });

  afterEach(async () => {
    resetImprovementMarkerService();
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('initialize', () => {
    it('should create marker directory', async () => {
      const stats = await fs.stat(testDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create history directory', async () => {
      const historyDir = path.join(testDir, 'history');
      const stats = await fs.stat(historyDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('createMarker', () => {
    it('should create a new marker', async () => {
      const marker = await service.createMarker(
        'si-123',
        'Fix login bug',
        ['src/auth.ts']
      );

      expect(marker.id).toBe('si-123');
      expect(marker.description).toBe('Fix login bug');
      expect(marker.phase).toBe('planning');
      expect(marker.restartCount).toBe(0);
      expect(marker.targetFiles).toEqual(['src/auth.ts']);
    });

    it('should persist marker to disk', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);

      const hasPending = await service.hasPendingImprovement();
      expect(hasPending).toBe(true);

      const loaded = await service.getPendingImprovement();
      expect(loaded?.id).toBe('si-123');
    });

    it('should set default validation requirements', async () => {
      const marker = await service.createMarker('si-123', 'Test', ['test.ts']);

      expect(marker.validation.required).toEqual(['build', 'lint', 'test']);
      expect(marker.validation.results).toEqual([]);
    });

    it('should include slack context when provided', async () => {
      const slackContext = {
        channelId: 'C123',
        threadTs: '123.456',
        userId: 'U789',
      };

      const marker = await service.createMarker(
        'si-123',
        'Test',
        ['test.ts'],
        slackContext
      );

      expect(marker.slack).toEqual(slackContext);
    });
  });

  describe('hasPendingImprovement', () => {
    it('should return false when no marker exists', async () => {
      const hasPending = await service.hasPendingImprovement();
      expect(hasPending).toBe(false);
    });

    it('should return true when marker exists', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);
      const hasPending = await service.hasPendingImprovement();
      expect(hasPending).toBe(true);
    });
  });

  describe('getPendingImprovement', () => {
    it('should return null when no marker exists', async () => {
      const marker = await service.getPendingImprovement();
      expect(marker).toBeNull();
    });

    it('should return marker when it exists', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);
      const marker = await service.getPendingImprovement();
      expect(marker?.id).toBe('si-123');
    });
  });

  describe('updatePhase', () => {
    it('should update phase', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);

      await service.updatePhase('changes_applied');

      const marker = await service.getPendingImprovement();
      expect(marker?.phase).toBe('changes_applied');
    });

    it('should update lastUpdatedAt', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);
      const before = (await service.getPendingImprovement())?.lastUpdatedAt;

      await new Promise(resolve => setTimeout(resolve, 10));
      await service.updatePhase('validating');

      const after = (await service.getPendingImprovement())?.lastUpdatedAt;
      expect(new Date(after!).getTime()).toBeGreaterThan(new Date(before!).getTime());
    });

    it('should return null if no marker exists', async () => {
      const result = await service.updatePhase('validating');
      expect(result).toBeNull();
    });
  });

  describe('incrementRestartCount', () => {
    it('should increment restart count', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);

      const count1 = await service.incrementRestartCount();
      expect(count1).toBe(1);

      const count2 = await service.incrementRestartCount();
      expect(count2).toBe(2);

      const count3 = await service.incrementRestartCount();
      expect(count3).toBe(3);
    });

    it('should return 0 if no marker exists', async () => {
      const count = await service.incrementRestartCount();
      expect(count).toBe(0);
    });
  });

  describe('recordBackup', () => {
    it('should record backup information', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);

      const files = [
        {
          originalPath: 'src/test.ts',
          backupPath: '/backup/test.ts',
          checksum: 'abc123',
          existed: true,
        },
      ];

      await service.recordBackup('commit123', 'main', files);

      const marker = await service.getPendingImprovement();
      expect(marker?.backup.gitCommit).toBe('commit123');
      expect(marker?.backup.gitBranch).toBe('main');
      expect(marker?.backup.files).toEqual(files);
      expect(marker?.phase).toBe('backing_up');
    });
  });

  describe('recordChangesApplied', () => {
    it('should record changes and update phase', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);

      const changes = [
        { file: 'src/test.ts', type: 'modify' as const, description: 'Fix bug' },
      ];

      await service.recordChangesApplied(changes);

      const marker = await service.getPendingImprovement();
      expect(marker?.phase).toBe('changes_applied');
      expect(marker?.changes).toHaveLength(1);
      expect(marker?.changes[0].applied).toBe(true);
    });
  });

  describe('recordValidationResult', () => {
    it('should record validation results', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);

      await service.recordValidationResult({
        check: 'build',
        passed: true,
        duration: 5000,
      });

      await service.recordValidationResult({
        check: 'test',
        passed: false,
        output: 'Test failed',
      });

      const marker = await service.getPendingImprovement();
      expect(marker?.validation.results).toHaveLength(2);
      expect(marker?.phase).toBe('validating');
      expect(marker?.validation.startedAt).toBeDefined();
    });

    it('should only set startedAt on first result', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);

      await service.recordValidationResult({ check: 'build', passed: true });
      const startedAt1 = (await service.getPendingImprovement())?.validation.startedAt;

      await new Promise(resolve => setTimeout(resolve, 10));
      await service.recordValidationResult({ check: 'lint', passed: true });
      const startedAt2 = (await service.getPendingImprovement())?.validation.startedAt;

      expect(startedAt1).toBe(startedAt2);
    });
  });

  describe('recordRollbackStarted', () => {
    it('should record rollback information', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);

      await service.recordRollbackStarted('Validation failed');

      const marker = await service.getPendingImprovement();
      expect(marker?.phase).toBe('rolling_back');
      expect(marker?.rollback?.reason).toBe('Validation failed');
      expect(marker?.rollback?.startedAt).toBeDefined();
    });
  });

  describe('recordRollbackCompleted', () => {
    it('should record rollback completion', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);
      await service.recordRollbackStarted('Validation failed');

      await service.recordRollbackCompleted(['src/test.ts'], true);

      const marker = await service.getPendingImprovement();
      expect(marker?.phase).toBe('rolled_back');
      expect(marker?.rollback?.filesRestored).toEqual(['src/test.ts']);
      expect(marker?.rollback?.gitReset).toBe(true);
      expect(marker?.rollback?.completedAt).toBeDefined();
    });
  });

  describe('recordError', () => {
    it('should record error information', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);
      await service.updatePhase('validating');

      await service.recordError('Something went wrong', 'Stack trace here');

      const marker = await service.getPendingImprovement();
      expect(marker?.error?.message).toBe('Something went wrong');
      expect(marker?.error?.phase).toBe('validating');
      expect(marker?.error?.stack).toBe('Stack trace here');
    });
  });

  describe('completeImprovement', () => {
    it('should move to history and delete pending on success', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);

      await service.completeImprovement(true);

      const hasPending = await service.hasPendingImprovement();
      expect(hasPending).toBe(false);

      const history = await service.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('si-123');
    });

    it('should move to history and delete pending on failure', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);

      await service.completeImprovement(false);

      const hasPending = await service.hasPendingImprovement();
      expect(hasPending).toBe(false);

      const history = await service.getHistory();
      expect(history).toHaveLength(1);
    });

    it('should set phase to complete', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);
      await service.completeImprovement(true);

      const history = await service.getHistory();
      expect(history[0].phase).toBe('complete');
    });
  });

  describe('deleteMarker', () => {
    it('should delete marker without saving to history', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);

      await service.deleteMarker();

      const hasPending = await service.hasPendingImprovement();
      expect(hasPending).toBe(false);

      const history = await service.getHistory();
      expect(history).toHaveLength(0);
    });

    it('should not throw if marker does not exist', async () => {
      await expect(service.deleteMarker()).resolves.not.toThrow();
    });
  });

  describe('getHistory', () => {
    it('should return empty array when no history', async () => {
      const history = await service.getHistory();
      expect(history).toEqual([]);
    });

    it('should return history items in reverse order', async () => {
      await service.createMarker('si-1', 'Test 1', ['test.ts']);
      await service.completeImprovement(true);

      await service.createMarker('si-2', 'Test 2', ['test.ts']);
      await service.completeImprovement(true);

      const history = await service.getHistory();
      expect(history[0].id).toBe('si-2');
      expect(history[1].id).toBe('si-1');
    });

    it('should respect limit parameter', async () => {
      await service.createMarker('si-1', 'Test 1', ['test.ts']);
      await service.completeImprovement(true);

      await service.createMarker('si-2', 'Test 2', ['test.ts']);
      await service.completeImprovement(true);

      await service.createMarker('si-3', 'Test 3', ['test.ts']);
      await service.completeImprovement(true);

      const history = await service.getHistory(2);
      expect(history).toHaveLength(2);
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      resetImprovementMarkerService();
      const instance1 = getImprovementMarkerService();
      const instance2 = getImprovementMarkerService();
      expect(instance1).toBe(instance2);
    });

    it('should return new instance after reset', () => {
      resetImprovementMarkerService();
      const instance1 = getImprovementMarkerService();
      resetImprovementMarkerService();
      const instance2 = getImprovementMarkerService();
      expect(instance1).not.toBe(instance2);
    });
  });
});
