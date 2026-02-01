# Task: Create Self-Improvement Marker System

## Overview

Create a marker file system that tracks self-improvement state across hot-reload restarts. This enables the system to know what was happening when it was killed by hot-reload and resume appropriately.

## Priority

**Critical** - Required for self-improvement to work with `npm run dev`

## Dependencies

- `50-self-improvement-service.md` - Base self-improvement service

## Problem Statement

When running `npm run dev`:
1. Orchestrator edits a file
2. Hot-reload detects change and kills the process immediately
3. New process starts but doesn't know what was happening
4. No validation runs, broken code might be deployed

## Solution

Use a persistent marker file that survives process restarts:

```
~/.agentmux/self-improvement/pending.json
```

## Files to Create

### 1. Create `backend/src/services/orchestrator/improvement-marker.service.ts`

```typescript
/**
 * Improvement Marker Service
 *
 * Manages a persistent marker file that tracks self-improvement
 * state across process restarts (including hot-reload).
 *
 * @module services/orchestrator/improvement-marker
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Improvement phases
 */
export type ImprovementPhase =
  | 'planning'           // Still planning, no changes yet
  | 'backing_up'         // Creating backups
  | 'changes_applied'    // Files changed, awaiting validation
  | 'validating'         // Currently running validation
  | 'rolling_back'       // Rollback in progress
  | 'rolled_back'        // Rollback complete, needs cleanup
  | 'complete';          // All done, marker can be deleted

/**
 * File backup record
 */
export interface FileBackupRecord {
  originalPath: string;
  backupPath: string;
  checksum: string;
  existed: boolean;  // false if this is a new file
}

/**
 * Validation result
 */
export interface ValidationResult {
  check: string;
  passed: boolean;
  output?: string;
  duration?: number;
}

/**
 * Improvement marker data
 */
export interface ImprovementMarker {
  /** Unique improvement ID */
  id: string;
  /** Human-readable description */
  description: string;
  /** When improvement started */
  startedAt: string;
  /** Current phase */
  phase: ImprovementPhase;
  /** Number of times process has restarted during this improvement */
  restartCount: number;
  /** Last phase transition timestamp */
  lastUpdatedAt: string;

  /** Target files being modified */
  targetFiles: string[];

  /** Backup information */
  backup: {
    gitCommit?: string;
    gitBranch?: string;
    files: FileBackupRecord[];
    createdAt: string;
  };

  /** Planned changes */
  changes: Array<{
    file: string;
    type: 'create' | 'modify' | 'delete';
    description: string;
    applied: boolean;
  }>;

  /** Validation configuration and results */
  validation: {
    required: string[];  // ['build', 'lint', 'test']
    results: ValidationResult[];
    startedAt?: string;
    completedAt?: string;
  };

  /** Rollback information */
  rollback?: {
    reason: string;
    startedAt: string;
    completedAt?: string;
    filesRestored: string[];
    gitReset?: boolean;
  };

  /** Slack notification context */
  slack?: {
    channelId: string;
    threadTs: string;
    userId: string;
  };

  /** Error information if failed */
  error?: {
    message: string;
    phase: ImprovementPhase;
    timestamp: string;
    stack?: string;
  };
}

/**
 * Marker file paths
 */
const MARKER_DIR = path.join(os.homedir(), '.agentmux', 'self-improvement');
const MARKER_FILE = 'pending.json';
const HISTORY_DIR = 'history';
const MAX_HISTORY = 20;

/**
 * ImprovementMarkerService class
 */
export class ImprovementMarkerService {
  private markerPath: string;
  private historyPath: string;

  constructor(baseDir?: string) {
    const base = baseDir || MARKER_DIR;
    this.markerPath = path.join(base, MARKER_FILE);
    this.historyPath = path.join(base, HISTORY_DIR);
  }

  /**
   * Initialize the marker service
   */
  async initialize(): Promise<void> {
    await fs.mkdir(path.dirname(this.markerPath), { recursive: true });
    await fs.mkdir(this.historyPath, { recursive: true });
  }

  /**
   * Check if there's a pending improvement
   */
  async hasPendingImprovement(): Promise<boolean> {
    try {
      await fs.access(this.markerPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the pending improvement marker
   */
  async getPendingImprovement(): Promise<ImprovementMarker | null> {
    try {
      const data = await fs.readFile(this.markerPath, 'utf-8');
      const marker = JSON.parse(data) as ImprovementMarker;
      return marker;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new improvement marker
   */
  async createMarker(
    id: string,
    description: string,
    targetFiles: string[],
    slackContext?: { channelId: string; threadTs: string; userId: string }
  ): Promise<ImprovementMarker> {
    const marker: ImprovementMarker = {
      id,
      description,
      startedAt: new Date().toISOString(),
      phase: 'planning',
      restartCount: 0,
      lastUpdatedAt: new Date().toISOString(),
      targetFiles,
      backup: {
        files: [],
        createdAt: '',
      },
      changes: [],
      validation: {
        required: ['build', 'lint', 'test'],
        results: [],
      },
      slack: slackContext,
    };

    await this.saveMarker(marker);
    return marker;
  }

  /**
   * Update marker phase
   */
  async updatePhase(phase: ImprovementPhase): Promise<ImprovementMarker | null> {
    const marker = await this.getPendingImprovement();
    if (!marker) return null;

    marker.phase = phase;
    marker.lastUpdatedAt = new Date().toISOString();

    await this.saveMarker(marker);
    return marker;
  }

  /**
   * Increment restart count (called on each startup)
   */
  async incrementRestartCount(): Promise<number> {
    const marker = await this.getPendingImprovement();
    if (!marker) return 0;

    marker.restartCount++;
    marker.lastUpdatedAt = new Date().toISOString();

    await this.saveMarker(marker);
    return marker.restartCount;
  }

  /**
   * Record backup information
   */
  async recordBackup(
    gitCommit: string | undefined,
    gitBranch: string | undefined,
    files: FileBackupRecord[]
  ): Promise<void> {
    const marker = await this.getPendingImprovement();
    if (!marker) return;

    marker.backup = {
      gitCommit,
      gitBranch,
      files,
      createdAt: new Date().toISOString(),
    };
    marker.phase = 'backing_up';
    marker.lastUpdatedAt = new Date().toISOString();

    await this.saveMarker(marker);
  }

  /**
   * Record that changes have been applied
   */
  async recordChangesApplied(
    changes: Array<{ file: string; type: 'create' | 'modify' | 'delete'; description: string }>
  ): Promise<void> {
    const marker = await this.getPendingImprovement();
    if (!marker) return;

    marker.changes = changes.map(c => ({ ...c, applied: true }));
    marker.phase = 'changes_applied';
    marker.lastUpdatedAt = new Date().toISOString();

    await this.saveMarker(marker);
  }

  /**
   * Record validation result
   */
  async recordValidationResult(result: ValidationResult): Promise<void> {
    const marker = await this.getPendingImprovement();
    if (!marker) return;

    if (marker.phase !== 'validating') {
      marker.phase = 'validating';
      marker.validation.startedAt = new Date().toISOString();
    }

    marker.validation.results.push(result);
    marker.lastUpdatedAt = new Date().toISOString();

    await this.saveMarker(marker);
  }

  /**
   * Record rollback started
   */
  async recordRollbackStarted(reason: string): Promise<void> {
    const marker = await this.getPendingImprovement();
    if (!marker) return;

    marker.phase = 'rolling_back';
    marker.rollback = {
      reason,
      startedAt: new Date().toISOString(),
      filesRestored: [],
    };
    marker.lastUpdatedAt = new Date().toISOString();

    await this.saveMarker(marker);
  }

  /**
   * Record rollback completed
   */
  async recordRollbackCompleted(filesRestored: string[], gitReset: boolean): Promise<void> {
    const marker = await this.getPendingImprovement();
    if (!marker || !marker.rollback) return;

    marker.phase = 'rolled_back';
    marker.rollback.completedAt = new Date().toISOString();
    marker.rollback.filesRestored = filesRestored;
    marker.rollback.gitReset = gitReset;
    marker.lastUpdatedAt = new Date().toISOString();

    await this.saveMarker(marker);
  }

  /**
   * Record error
   */
  async recordError(message: string, stack?: string): Promise<void> {
    const marker = await this.getPendingImprovement();
    if (!marker) return;

    marker.error = {
      message,
      phase: marker.phase,
      timestamp: new Date().toISOString(),
      stack,
    };
    marker.lastUpdatedAt = new Date().toISOString();

    await this.saveMarker(marker);
  }

  /**
   * Complete the improvement (move to history)
   */
  async completeImprovement(success: boolean): Promise<void> {
    const marker = await this.getPendingImprovement();
    if (!marker) return;

    marker.phase = 'complete';
    marker.validation.completedAt = new Date().toISOString();
    marker.lastUpdatedAt = new Date().toISOString();

    // Move to history
    const historyFile = path.join(
      this.historyPath,
      `${marker.id}-${success ? 'success' : 'failed'}.json`
    );
    await fs.writeFile(historyFile, JSON.stringify(marker, null, 2));

    // Delete pending marker
    await fs.unlink(this.markerPath);

    // Cleanup old history
    await this.cleanupHistory();
  }

  /**
   * Delete marker without saving to history (for cancelled improvements)
   */
  async deleteMarker(): Promise<void> {
    try {
      await fs.unlink(this.markerPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Save marker to disk
   */
  private async saveMarker(marker: ImprovementMarker): Promise<void> {
    const tempPath = `${this.markerPath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(marker, null, 2));
    await fs.rename(tempPath, this.markerPath);
  }

  /**
   * Cleanup old history files
   */
  private async cleanupHistory(): Promise<void> {
    try {
      const files = await fs.readdir(this.historyPath);
      const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();

      for (const file of jsonFiles.slice(MAX_HISTORY)) {
        await fs.unlink(path.join(this.historyPath, file));
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Get improvement history
   */
  async getHistory(limit: number = 10): Promise<ImprovementMarker[]> {
    try {
      const files = await fs.readdir(this.historyPath);
      const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();

      const history: ImprovementMarker[] = [];
      for (const file of jsonFiles.slice(0, limit)) {
        const data = await fs.readFile(path.join(this.historyPath, file), 'utf-8');
        history.push(JSON.parse(data));
      }

      return history;
    } catch {
      return [];
    }
  }
}

/**
 * Singleton instance
 */
let markerServiceInstance: ImprovementMarkerService | null = null;

/**
 * Get singleton instance
 */
export function getImprovementMarkerService(): ImprovementMarkerService {
  if (!markerServiceInstance) {
    markerServiceInstance = new ImprovementMarkerService();
  }
  return markerServiceInstance;
}

/**
 * Reset instance (for testing)
 */
export function resetImprovementMarkerService(): void {
  markerServiceInstance = null;
}
```

### 2. Create `backend/src/services/orchestrator/improvement-marker.service.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
    });

    it('should persist marker to disk', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);

      const hasPending = await service.hasPendingImprovement();
      expect(hasPending).toBe(true);

      const loaded = await service.getPendingImprovement();
      expect(loaded?.id).toBe('si-123');
    });
  });

  describe('updatePhase', () => {
    it('should update phase', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);

      await service.updatePhase('changes_applied');

      const marker = await service.getPendingImprovement();
      expect(marker?.phase).toBe('changes_applied');
    });
  });

  describe('incrementRestartCount', () => {
    it('should increment restart count', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);

      const count1 = await service.incrementRestartCount();
      expect(count1).toBe(1);

      const count2 = await service.incrementRestartCount();
      expect(count2).toBe(2);
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
    });
  });

  describe('completeImprovement', () => {
    it('should move to history and delete pending', async () => {
      await service.createMarker('si-123', 'Test', ['test.ts']);

      await service.completeImprovement(true);

      const hasPending = await service.hasPendingImprovement();
      expect(hasPending).toBe(false);

      const history = await service.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('si-123');
    });
  });
});
```

### 3. Update `backend/src/services/orchestrator/index.ts`

```typescript
export {
  StatePersistenceService,
  getStatePersistenceService,
  resetStatePersistenceService,
} from './state-persistence.service.js';

export {
  SafeRestartService,
  getSafeRestartService,
  resetSafeRestartService,
} from './safe-restart.service.js';

export {
  SelfImprovementService,
  getSelfImprovementService,
  resetSelfImprovementService,
} from './self-improvement.service.js';

export {
  ImprovementMarkerService,
  getImprovementMarkerService,
  resetImprovementMarkerService,
  type ImprovementMarker,
  type ImprovementPhase,
  type ValidationResult,
} from './improvement-marker.service.js';
```

## Acceptance Criteria

- [ ] Marker file created at `~/.agentmux/self-improvement/pending.json`
- [ ] Phase transitions tracked correctly
- [ ] Restart count incremented on each restart
- [ ] Validation results accumulated
- [ ] Rollback information tracked
- [ ] Completed improvements moved to history
- [ ] History cleanup works (max 20 files)
- [ ] Atomic file writes prevent corruption
- [ ] TypeScript compilation passes
- [ ] All tests pass

## Testing Requirements

- Unit tests for all marker operations
- Phase transition tests
- History management tests
- File persistence tests

## Estimated Effort

30 minutes

## Notes

- Marker file is the source of truth across restarts
- Phase tracking prevents infinite restart loops
- History provides audit trail of improvements
- Slack context preserved for notification continuity
