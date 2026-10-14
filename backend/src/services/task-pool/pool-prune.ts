/**
 * Ongoing task-pool pruning (crewly#1108).
 *
 * `pool.json` is rewritten whole on every write, so its size is the cost of
 * every claim, heartbeat and completion. Finished WorkItems and ended claims
 * were never removed (13 MB, 5,600 claims, 1,100 verified items). This moves
 * them out of the live pool into the dated archive file
 * (`task-pool/archive/pool-archive-YYYY-MM-DD.json`, the same file the
 * one-time ticket-loop archive writes):
 *
 * - a WorkItem in a terminal status (`verified`, `done`, `failed`,
 *   `cancelled`) finished more than the retention ago;
 * - an ended claim (`released` / `revoked`) whose WorkItem is terminal and
 *   finished more than the retention ago, or whose WorkItem is no longer in
 *   the pool at all (an orphan).
 *
 * Never moved: active or expiring claims, claims on a live WorkItem (the
 * attempt history of an unfinished item is still read), non-terminal items.
 * Nothing is deleted: the archive is written (append-only, merged by id)
 * BEFORE the live pool shrinks, so a crash in between only means the next
 * run moves the same entries again without duplicating them.
 *
 * @module services/task-pool/pool-prune
 */

import * as path from 'path';
import { atomicWriteJson, ensureDir } from '../../utils/file-io.utils.js';
import { POOL_ARCHIVE_CONSTANTS, POOL_PRUNE_CONSTANTS } from '../../constants.js';
import type { WorkItem } from '../../types/v2/work-item.types.js';
import type { TaskClaim } from '../../types/v2/claim.types.js';
import type { ComponentLogger } from '../core/logger.service.js';
import { archiveFileName, exists, readArchive, type PoolArchiveFile } from './pool-archive-migration.js';

/** The pool surface the prune needs (PoolStorage). */
export interface PrunablePool {
  getWorkItems(): Promise<WorkItem[]>;
  getClaims(): Promise<TaskClaim[]>;
  removeWorkItems(ids: ReadonlySet<string>): Promise<number>;
  removeClaims(ids: ReadonlySet<string>): Promise<number>;
  flush(): Promise<void>;
  getDataDir(): string;
}

/** What a prune run did. */
export interface PoolPruneResult {
  /** WorkItems moved to the archive */
  items: number;
  /** Claims moved to the archive */
  claims: number;
  /** WorkItems left in the live pool */
  itemsKept: number;
  /** Claims left in the live pool */
  claimsKept: number;
  /** Archive file written, when anything moved */
  archiveFile?: string;
}

const TERMINAL = new Set<string>(POOL_ARCHIVE_CONSTANTS.TERMINAL_STATUSES);

/**
 * When a finished WorkItem finished: the latest of its completion and last
 * status change, else its creation.
 *
 * @param wi - WorkItem
 * @returns Epoch ms, NaN when no usable date
 */
function finishedAt(wi: WorkItem): number {
  const times = [wi.completedAt, wi.statusChangedAt]
    .map((iso) => (iso ? Date.parse(iso) : NaN))
    .filter((t) => Number.isFinite(t));
  if (times.length > 0) return Math.max(...times);
  return Date.parse(wi.createdAt);
}

/**
 * Select what leaves the live pool (pure).
 *
 * @param items - Every WorkItem in the pool
 * @param claims - Every claim in the pool
 * @param now - Current time (ms)
 * @param retentionMs - How long finished entries stay
 * @returns The WorkItems and claims to archive
 */
export function selectPrunable(
  items: readonly WorkItem[],
  claims: readonly TaskClaim[],
  now: number,
  retentionMs: number = POOL_PRUNE_CONSTANTS.RETENTION_MS,
): { workItems: WorkItem[]; claims: TaskClaim[] } {
  const oldTerminal = new Set<string>();
  const live = new Set<string>();
  const workItems: WorkItem[] = [];
  for (const wi of items) {
    live.add(wi.id);
    const t = finishedAt(wi);
    // Unparseable dates: kept. Only what can be proven old moves.
    if (TERMINAL.has(wi.status) && Number.isFinite(t) && now - t >= retentionMs) {
      oldTerminal.add(wi.id);
      workItems.push(wi);
    }
  }
  const prunedClaims = claims.filter(
    (c) => (c.status === 'released' || c.status === 'revoked') && (oldTerminal.has(c.workItemId) || !live.has(c.workItemId)),
  );
  return { workItems, claims: prunedClaims };
}

/**
 * Archive-then-remove what {@link selectPrunable} selects.
 *
 * @param pool - The live pool (PoolStorage)
 * @param options - Clock, retention and logger
 * @returns Counts
 * @throws When the archive cannot be written — the live pool is untouched then
 */
export async function runPoolPrune(
  pool: PrunablePool,
  options: { now?: Date; retentionMs?: number; logger?: Pick<ComponentLogger, 'info' | 'warn'> } = {},
): Promise<PoolPruneResult> {
  const now = options.now ?? new Date();
  const items = [...(await pool.getWorkItems())];
  const claims = [...(await pool.getClaims())];
  const selected = selectPrunable(items, claims, now.getTime(), options.retentionMs);
  if (selected.workItems.length === 0 && selected.claims.length === 0) {
    return { items: 0, claims: 0, itemsKept: items.length, claimsKept: claims.length };
  }

  const archiveDir = path.join(pool.getDataDir(), POOL_ARCHIVE_CONSTANTS.ARCHIVE_DIRNAME);
  await ensureDir(archiveDir);
  let archiveFile = path.join(archiveDir, archiveFileName(now));
  let existing: PoolArchiveFile = { version: 1, runs: [], workItems: [] };
  if (await exists(archiveFile)) {
    const read = await readArchive(archiveFile);
    if (read) {
      existing = read;
    } else {
      // Unreadable archive: never overwrite it, write beside it instead.
      archiveFile = archiveFile.replace(/\.json$/, `-${now.getTime()}.json`);
      options.logger?.warn('Existing pool archive is unreadable — writing a new file beside it', { archiveFile });
    }
  }
  const knownItems = new Set(existing.workItems.map((w) => w.id));
  const knownClaims = new Set((existing.claims ?? []).map((c) => c.id));
  const newItems = selected.workItems.filter((w) => !knownItems.has(w.id));
  const newClaims = selected.claims.filter((c) => !knownClaims.has(c.id));
  const next: PoolArchiveFile = {
    version: 1,
    runs: [
      ...existing.runs,
      { archivedAt: now.toISOString(), migration: 'pool-prune', added: newItems.length, addedClaims: newClaims.length },
    ],
    workItems: [...existing.workItems, ...newItems.map((w) => ({ ...w, archiveReason: 'terminal' as const }))],
    claims: [...(existing.claims ?? []), ...newClaims],
  };
  // Archive first: only once it is on disk do the entries leave the pool.
  await atomicWriteJson(archiveFile, next);
  const removedItems = await pool.removeWorkItems(new Set(selected.workItems.map((w) => w.id)));
  const removedClaims = await pool.removeClaims(new Set(selected.claims.map((c) => c.id)));
  await pool.flush();

  const result: PoolPruneResult = {
    items: removedItems,
    claims: removedClaims,
    itemsKept: items.length - removedItems,
    claimsKept: claims.length - removedClaims,
    archiveFile,
  };
  options.logger?.info('Task pool pruned: finished items and ended claims moved to the archive', { ...result });
  return result;
}
