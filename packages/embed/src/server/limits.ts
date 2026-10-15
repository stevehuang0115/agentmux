/**
 * Per-user call budgets for the ops API.
 */
import { EMBED_CONSTANTS } from '../constants.js';

/**
 * Counter storage for limits. The default keeps counts in process memory,
 * which is right for one long-running server; on serverless or several
 * replicas, back it with a shared store (e.g. Redis `INCR` + `PEXPIRE`).
 */
export interface OpsLimitStore {
  /**
   * Add one to `key` and return the new count. The key may be forgotten
   * after `ttlMs`.
   *
   * @param key - Counter key (already includes the window)
   * @param ttlMs - How long the counter must be kept
   */
  increment(key: string, ttlMs: number): number | Promise<number>;
}

/** Limit settings for `createOpsHandler`. */
export interface OpsLimits {
  /** Calls to `write` or `irreversible` tools per user per UTC day. Default 5. */
  writesPerDay?: number;
  /** Counter storage. Default: in memory. */
  store?: OpsLimitStore;
  /** Largest accepted request body in bytes. Default 64 KiB. */
  maxBodyBytes?: number;
}

/**
 * Create the default in-memory counter store. Expired counters are swept on
 * write, so memory stays bounded by the active users of one window.
 *
 * @param now - Clock in ms; injectable for tests
 * @returns An {@link OpsLimitStore}
 */
export function createMemoryLimitStore(now: () => number = Date.now): OpsLimitStore {
  const counters = new Map<string, { count: number; expiresAt: number }>();
  return {
    increment(key: string, ttlMs: number): number {
      const t = now();
      for (const [k, entry] of counters) if (entry.expiresAt <= t) counters.delete(k);
      const entry = counters.get(key);
      if (entry) {
        entry.count += 1;
        return entry.count;
      }
      counters.set(key, { count: 1, expiresAt: t + ttlMs });
      return 1;
    },
  };
}

/**
 * The counter key for a user's writes on the current UTC day.
 *
 * @param sub - The asker's sub
 * @param nowMs - Current time in ms
 * @returns A key such as `writes:2026-10-15:teacher-118`
 */
export function writeLimitKey(sub: string, nowMs: number): string {
  const day = new Date(nowMs).toISOString().slice(0, 10);
  return `writes:${day}:${sub}`;
}

/** Default writes per user per day. */
export const DEFAULT_WRITES_PER_DAY = EMBED_CONSTANTS.OPS.DEFAULT_WRITES_PER_DAY;
