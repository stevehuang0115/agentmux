/**
 * WikiQueueDrainService — the code consumer of `~/.crewly/wiki-queue/`.
 *
 * Why (#1345): the queue's only consumer was `WikiWorkItemBridgeService`,
 * which turns pending items into WorkItems for an agent to classify with
 * its LLM. With the bridge switched off (`WIKI_BRIDGE_ENABLED=false`)
 * nothing claimed anything and the sweep inside the same tick never ran,
 * so 219 items sat pending for up to a month. Even with the bridge on, a
 * drain cost a model turn per batch and depended on an agent picking the
 * WorkItem up.
 *
 * What this does instead, without an LLM: a pending item that nobody has
 * claimed within `DRAIN_MIN_AGE_MS` is filed into its vault's `log.md`
 * (the "maybe useful" tier that search and the weekly digest now read),
 * with the queueing agent as caller, the original source type and ref, and
 * the agent's stated reason. The item is marked processed with the log as
 * target. Content-free items are marked skipped. Items whose vault has no
 * `SCHEMA.md` are left alone (the sweep expires them to the dead-letter
 * folder after `MAX_ITEM_AGE_MS`). The queue sweep runs here too, so claim
 * release, expiry and the stale alert no longer depend on the bridge.
 *
 * Idempotent: the queue's status transitions guard every step (an item is
 * claimed before it is written, and only claimed items are marked). Rate
 * limited: at most `DRAIN_BATCH_SIZE` items per pass with a short pause
 * between items. One summary log line per pass.
 *
 * @module services/wiki/wiki-queue-drain.service
 */

import * as path from 'path';
import { existsSync } from 'fs';
import { LoggerService, type ComponentLogger } from '../core/logger.service.js';
import { WIKI_QUEUE_CONSTANTS } from '../../constants.js';
import { WikiQueueService, type WikiQueueItem, type WikiQueueSweepResult } from './wiki-queue.service.js';
import { WikiIngestService } from './wiki-ingest.service.js';
import { isNoiseLogBody } from './wiki-log-entries.js';

/** Options for {@link WikiQueueDrainService.drain}. */
export interface WikiQueueDrainOptions {
  /** Report only; claim/write/mark nothing, run no sweep. */
  dryRun?: boolean;
  /** Clock (tests). */
  now?: number;
  /** Batch size override (tests). */
  limit?: number;
  /** Minimum pending age override (tests). */
  minAgeMs?: number;
  /** Pause between items override (tests; 0 = none). */
  pauseMs?: number;
}

/** Outcome of one drain pass. */
export interface WikiQueueDrainResult {
  /** Pending items seen before filtering. */
  pending: number;
  /** Items younger than the minimum age (left for an agent). */
  tooYoung: number;
  /** Items whose vault has no SCHEMA.md (left for the sweep). */
  noVault: number;
  /** Items written into a log and marked processed. */
  filed: number;
  /** Items marked skipped (content-free, or refused by the confidentiality gate). */
  skipped: number;
  /** Items that hit an unexpected error (left claimed; the sweep releases them). */
  failed: number;
  /** Items left pending because the batch cap was reached. */
  deferred: number;
  /** Sweep outcome (absent in a dry run). */
  sweep?: Pick<WikiQueueSweepResult, 'releasedClaims'> & { expired: number; backlogVaults: number };
  dryRun: boolean;
}

/**
 * Files aged pending queue items into their vault log. Singleton.
 */
export class WikiQueueDrainService {
  private static instance: WikiQueueDrainService | null = null;
  private readonly logger: ComponentLogger;
  private running = false;

  constructor(
    private readonly queue: WikiQueueService = WikiQueueService.getInstance(),
    private readonly ingest: WikiIngestService = WikiIngestService.getInstance(),
  ) {
    this.logger = LoggerService.getInstance().createComponentLogger('WikiQueueDrain');
  }

  static getInstance(): WikiQueueDrainService {
    if (!this.instance) this.instance = new WikiQueueDrainService();
    return this.instance;
  }

  /** Test-only reset. */
  static _resetForTesting(): void {
    this.instance = null;
  }

  /**
   * One drain pass over the whole queue, oldest items first.
   *
   * @param opts - Dry run, clock, batch and age overrides
   * @returns Counts of what happened
   *
   * @example
   * ```typescript
   * const r = await WikiQueueDrainService.getInstance().drain({ dryRun: true });
   * // r.filed is how many items a real pass would file now
   * ```
   */
  async drain(opts: WikiQueueDrainOptions = {}): Promise<WikiQueueDrainResult> {
    const dryRun = opts.dryRun === true;
    const now = opts.now ?? Date.now();
    const limit = opts.limit ?? WIKI_QUEUE_CONSTANTS.DRAIN_BATCH_SIZE;
    const minAge = opts.minAgeMs ?? WIKI_QUEUE_CONSTANTS.DRAIN_MIN_AGE_MS;
    const pauseMs = opts.pauseMs ?? WIKI_QUEUE_CONSTANTS.DRAIN_ITEM_PAUSE_MS;
    const result: WikiQueueDrainResult = { pending: 0, tooYoung: 0, noVault: 0, filed: 0, skipped: 0, failed: 0, deferred: 0, dryRun };

    if (this.running) {
      this.logger.debug('WikiQueueDrain pass already running — skipping overlap');
      return result;
    }
    this.running = true;
    try {
      const pending = await this.queue.list({ status: 'pending', order: 'oldest', limit: Number.MAX_SAFE_INTEGER });
      result.pending = pending.length;
      let handled = 0;
      for (const item of pending) {
        const queuedMs = Date.parse(item.queuedAt);
        if (Number.isFinite(queuedMs) && now - queuedMs < minAge) {
          result.tooYoung++;
          continue;
        }
        if (!existsSync(path.join(item.vaultPath, 'SCHEMA.md'))) {
          result.noVault++;
          continue;
        }
        if (handled >= limit) {
          result.deferred++;
          continue;
        }
        handled++;
        if (dryRun) {
          if (isNoiseLogBody(item.content)) result.skipped++;
          else result.filed++;
          continue;
        }
        await this.file(item, result);
        if (pauseMs > 0) await new Promise((r) => setTimeout(r, pauseMs));
      }

      if (!dryRun) {
        try {
          const sweep = await this.queue.sweep({ now });
          result.sweep = { releasedClaims: sweep.releasedClaims, expired: sweep.expired.length, backlogVaults: sweep.backlog.length };
        } catch (err) {
          this.logger.warn('WikiQueueDrain: queue sweep failed (non-fatal)', { error: err instanceof Error ? err.message : String(err) });
        }
      }

      const summary = {
        dryRun,
        pending: result.pending,
        filed: result.filed,
        skipped: result.skipped,
        failed: result.failed,
        tooYoung: result.tooYoung,
        noVault: result.noVault,
        deferred: result.deferred,
        expired: result.sweep?.expired ?? 0,
        releasedClaims: result.sweep?.releasedClaims.length ?? 0,
      };
      if (result.pending > 0) this.logger.info('WikiQueueDrain pass', summary);
      else this.logger.debug('WikiQueueDrain pass', summary);
      return result;
    } finally {
      this.running = false;
    }
  }

  /**
   * Claim one item and file it: a content-free item is skipped; otherwise
   * the content plus the agent's reason go into the vault log and the item
   * is marked processed. A confidentiality refusal marks it skipped with
   * the gate's reason (the value is never logged). Any other error leaves
   * the item claimed for the sweep to release.
   *
   * @param item - Pending queue item
   * @param result - Pass counters to update
   */
  private async file(item: WikiQueueItem, result: WikiQueueDrainResult): Promise<void> {
    try {
      await this.queue.claim(item.id, WIKI_QUEUE_CONSTANTS.DRAIN_CLAIMANT);
      if (isNoiseLogBody(item.content)) {
        await this.queue.markSkipped(item.id, 'content-free templated record (filed by the queue drain)');
        result.skipped++;
        return;
      }
      const body = `${item.content.trim()}\n\n_Why kept (${item.queuedBy}):_ ${item.reason.trim()}`;
      const outcome = await this.ingest.ingest({
        vaultPath: item.vaultPath,
        sourceType: item.sourceType,
        sourceRef: item.sourceRef,
        sourceBody: body,
        callerSession: item.queuedBy,
      });
      if (outcome.ok) {
        await this.queue.markProcessed(item.id, {
          ingested: true,
          pagesWritten: outcome.pagesWritten,
          targetPath: outcome.pagesWritten[0],
          summary: 'filed into the vault log by the queue drain (no agent claimed it in time)',
        });
        result.filed++;
        return;
      }
      if (outcome.reason === 'duplicate' || outcome.reason === 'content_free' || outcome.reason === 'secret_detected' || outcome.reason === 'pii_refused') {
        await this.queue.markSkipped(item.id, `not filed by the queue drain: ${outcome.reason}`);
        result.skipped++;
        return;
      }
      // schema_missing / invalid_input: leave it claimed; the sweep releases it and a later pass retries.
      this.logger.warn('WikiQueueDrain: ingest refused an item (left for retry)', { id: item.id, vaultPath: item.vaultPath, reason: outcome.reason });
      result.failed++;
    } catch (err) {
      result.failed++;
      this.logger.warn('WikiQueueDrain: item failed (left for the sweep)', { id: item.id, vaultPath: item.vaultPath, error: err instanceof Error ? err.message : String(err) });
    }
  }
}
