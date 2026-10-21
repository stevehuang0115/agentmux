/**
 * Loader for the weekly owner-pulls rollup (#1387): reads decision cards,
 * Request open items and trace owner touches, and hands them to the pure
 * rollup in {@link ./owner-pulls-weekly}.
 *
 * @module services/v3/owner-receipt/owner-pulls-weekly.loader
 */

import { OWNER_RECEIPT_CONSTANTS } from '../../../constants.js';
import type { OwnerDecision } from '../../../types/decision.types.js';
import type { Request } from '../../../types/v2/request.types.js';
import {
  countOwnerTouches,
  pullsFromDecisions,
  pullsFromOpenItems,
  rollupPulls,
  type PullsWeekly,
} from './owner-pulls-weekly.js';

/** Where the loader reads from. */
export interface PullsWeeklyLoaderDeps {
  listDecisions: () => Promise<OwnerDecision[]>;
  listRequests: () => Promise<Request[]>;
  /** session → team name */
  loadTeamIndex: () => Promise<Map<string, string>>;
  /** Team id → team name (a card carries the id of the team whose channel has it) */
  loadTeamNameById?: () => Promise<Map<string, string>>;
  /**
   * Trace rows with their owner-touch total, newest first; absent = the
   * owner-touch count is left out.
   */
  listTraceTouches?: (since: Date, limit: number) => Promise<Array<{ createdAt: string; ownerTouches: number }>>;
}

/**
 * Build the `loadPullsWeekly` dependency of the owner receipt service.
 *
 * @param deps - Data sources
 * @returns Function that computes the rollup for the week ending at `now`
 */
export function createPullsWeeklyLoader(deps: PullsWeeklyLoaderDeps): (now: Date) => Promise<PullsWeekly> {
  return async (now: Date): Promise<PullsWeekly> => {
    const span = OWNER_RECEIPT_CONSTANTS.PULLS_WEEKLY.WINDOW_MS;
    const [decisions, requests, teams, teamNames] = await Promise.all([
      deps.listDecisions(),
      deps.listRequests(),
      deps.loadTeamIndex(),
      deps.loadTeamNameById ? deps.loadTeamNameById() : Promise.resolve(new Map<string, string>()),
    ]);
    const cardedKeys = new Set<string>();
    for (const d of decisions) if (d.requestRef) cardedKeys.add(`${d.requestRef.requestId}:${d.requestRef.itemId}`);
    const items = requests.flatMap((r) => (r.openItems ?? []).map((item) => ({ requestId: r.id, item })));
    const records = [
      ...pullsFromDecisions(decisions, (d) => teamNames.get(d.teamId ?? '') ?? teams.get(d.asker) ?? teams.get(d.requestedBy) ?? null),
      ...pullsFromOpenItems(items, cardedKeys, (session) => teams.get(session) ?? null),
    ];
    let touches: { thisWeek: number; lastWeek: number } | undefined;
    if (deps.listTraceTouches) {
      try {
        const since = new Date(now.getTime() - 2 * span);
        touches = countOwnerTouches(await deps.listTraceTouches(since, OWNER_RECEIPT_CONSTANTS.PULLS_WEEKLY.MAX_TRACES), now);
      } catch {
        touches = undefined; // the pulls stand without the touch count
      }
    }
    return rollupPulls(records, now, touches);
  };
}
