/**
 * WikiLogRotationService — keeps a vault's `llm-curated/log.md` readable.
 *
 * The log is append-only and was never rotated: one project vault reached
 * 19 MB / 150k lines, most of it templated noise (#1345). When a log is
 * larger than `ROTATE_MAX_BYTES` or holds more than `ROTATE_MAX_ENTRIES`
 * entries, this service:
 *
 *   1. moves the file, unchanged, to `llm-curated/log-archive/log-<date>.md`
 *      (a second rotation on the same day gets a `-2`, `-3`… suffix);
 *   2. writes a fresh `log.md` with the standard header and the non-noise,
 *      deduped entries of the last `CARRY_FORWARD_DAYS` days (capped), so
 *      search and the digest still see recent learnings.
 *
 * Nothing is deleted. `dryRun` reports what would happen without touching
 * the disk. Walkers skip the archive folder.
 *
 * @module services/wiki/wiki-log-rotation.service
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { LoggerService, type ComponentLogger } from '../core/logger.service.js';
import { WIKI_LOG_CONSTANTS } from '../../constants.js';
import { WIKI_LOG_HEADER, parseLogEntries, recentContentEntries, serializeLogEntry } from './wiki-log-entries.js';
import { WikiIngestService } from './wiki-ingest.service.js';

/** Options for {@link WikiLogRotationService.rotate}. */
export interface WikiLogRotateOptions {
  /** Report only; write nothing. */
  dryRun?: boolean;
  /** Clock (tests). */
  now?: number;
  /** Size cap override (tests). */
  maxBytes?: number;
  /** Entry-count cap override (tests). */
  maxEntries?: number;
}

/** Outcome of one vault's rotation check. */
export interface WikiLogRotateResult {
  vaultPath: string;
  /** False when the log is missing or under both caps. */
  rotated: boolean;
  /** Why nothing happened (when `rotated` is false). */
  reason?: 'no_log' | 'under_caps';
  /** Log size before rotation. */
  bytes: number;
  /** Entries before rotation. */
  entries: number;
  /** Entries carried into the fresh log. */
  carried: number;
  /** Vault-relative archive path (set when rotated, or planned in a dry run). */
  archivePath?: string;
  dryRun: boolean;
}

/**
 * Rotates oversized vault logs into an archive folder. Stateless singleton.
 */
export class WikiLogRotationService {
  private static instance: WikiLogRotationService | null = null;
  private readonly logger: ComponentLogger;

  constructor(private readonly ingest: WikiIngestService = WikiIngestService.getInstance()) {
    this.logger = LoggerService.getInstance().createComponentLogger('WikiLogRotation');
  }

  static getInstance(): WikiLogRotationService {
    if (!this.instance) this.instance = new WikiLogRotationService();
    return this.instance;
  }

  /** Test-only reset. */
  static _resetForTesting(): void {
    this.instance = null;
  }

  /**
   * Check one vault's log and rotate it when it is over a cap.
   *
   * @param vaultPath - Vault root (must contain `llm-curated/`)
   * @param opts - Dry run, clock and cap overrides
   * @returns What happened (or would happen)
   *
   * @example
   * ```typescript
   * const plan = await WikiLogRotationService.getInstance().rotate(vault, { dryRun: true });
   * if (plan.rotated) console.log(`would archive ${plan.bytes} bytes to ${plan.archivePath}`);
   * ```
   */
  async rotate(vaultPath: string, opts: WikiLogRotateOptions = {}): Promise<WikiLogRotateResult> {
    const dryRun = opts.dryRun === true;
    const now = opts.now ?? Date.now();
    const maxBytes = opts.maxBytes ?? WIKI_LOG_CONSTANTS.ROTATE_MAX_BYTES;
    const maxEntries = opts.maxEntries ?? WIKI_LOG_CONSTANTS.ROTATE_MAX_ENTRIES;
    const logAbs = path.join(vaultPath, WIKI_LOG_CONSTANTS.LOG_RELATIVE_PATH);
    const base: WikiLogRotateResult = { vaultPath, rotated: false, bytes: 0, entries: 0, carried: 0, dryRun };

    let size: number;
    try {
      size = (await fs.stat(logAbs)).size;
    } catch {
      return { ...base, reason: 'no_log' };
    }
    base.bytes = size;
    const raw = await fs.readFile(logAbs, 'utf8');
    const entries = parseLogEntries(raw);
    base.entries = entries.length;
    if (size <= maxBytes && entries.length <= maxEntries) return { ...base, reason: 'under_caps' };

    // Handover snapshots are carried: an agent may still be pointed at one.
    const carried = recentContentEntries(entries, WIKI_LOG_CONSTANTS.CARRY_FORWARD_DAYS, now, WIKI_LOG_CONSTANTS.CARRY_FORWARD_MAX_ENTRIES, { includeHandovers: true })
      // Oldest first in the fresh file, like any log.
      .sort((a, b) => a.timestampMs - b.timestampMs);
    const archiveRel = this.archivePathFor(vaultPath, now);
    const result: WikiLogRotateResult = { ...base, rotated: true, carried: carried.length, archivePath: archiveRel };

    if (dryRun) {
      this.logger.info('WikiLogRotation dry run — would rotate', { vaultPath, bytes: size, entries: base.entries, carried: carried.length, archivePath: archiveRel });
      return result;
    }

    const archiveAbs = path.join(vaultPath, archiveRel);
    await fs.mkdir(path.dirname(archiveAbs), { recursive: true });
    // Move first (atomic on one filesystem), then write the fresh log. A
    // crash in between leaves no log.md, which the next append recreates;
    // nothing is lost because the archive already holds everything.
    await fs.rename(logAbs, archiveAbs);
    const fresh = WIKI_LOG_HEADER + `\n<!-- rotated ${new Date(now).toISOString()}: ${base.entries} entries archived to ${archiveRel}; ${carried.length} recent entries carried forward -->\n` + carried.map((e) => serializeLogEntry(e)).join('');
    const tmp = `${logAbs}.tmp`;
    await fs.writeFile(tmp, fresh, 'utf8');
    await fs.rename(tmp, logAbs);
    this.ingest.forgetRecentBodies(logAbs);

    this.logger.info('WikiLogRotation rotated log', { vaultPath, bytes: size, entries: base.entries, carried: carried.length, archivePath: archiveRel });
    return result;
  }

  /**
   * Rotate every vault in a list; failures are logged per vault and never
   * stop the pass.
   *
   * @param vaults - Vault roots
   * @param opts - Passed to {@link rotate}
   * @returns One result per vault that was checked
   */
  async rotateAll(vaults: readonly string[], opts: WikiLogRotateOptions = {}): Promise<WikiLogRotateResult[]> {
    const out: WikiLogRotateResult[] = [];
    for (const vaultPath of vaults) {
      try {
        out.push(await this.rotate(vaultPath, opts));
      } catch (err) {
        this.logger.warn('WikiLogRotation failed for vault (non-fatal)', { vaultPath, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return out;
  }

  /**
   * Vault-relative archive path for a rotation at `now`: `log-YYYY-MM-DD.md`,
   * with a numeric suffix when that name is taken.
   *
   * @param vaultPath - Vault root
   * @param now - Epoch ms
   * @returns Relative path under the archive folder
   */
  private archivePathFor(vaultPath: string, now: number): string {
    const day = new Date(now).toISOString().slice(0, 10);
    for (let n = 1; ; n++) {
      const name = n === 1 ? `log-${day}.md` : `log-${day}-${n}.md`;
      const rel = `${WIKI_LOG_CONSTANTS.ARCHIVE_DIR}/${name}`;
      if (!existsSync(path.join(vaultPath, rel))) return rel;
    }
  }
}
