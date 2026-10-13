/**
 * The high-level overview of the organisation for Drive mode
 * (specs/2026-10-09-drive-mode-v3.md §9): for an owner who keeps every team
 * in his head and forgets which ones are working.
 *
 * Built from the harness's own records, no LLM: the team roster (charter,
 * paused, work finished and open with harness chores filtered out; #1221),
 * the snapshot's team counts, items and the owner's waiting items
 * (decisions, questions, reviews). Per team: what it is for, whether it was
 * active in the last 24 hours, what it finished and is on, what is blocked,
 * and what waits on the owner. Cloud turns it into a 25-second spoken
 * overview ("and 5 more teams were quiet").
 *
 * Pure.
 *
 * @module services/drive/drive-org-overview
 */

import { DRIVE_BRIEFING_CONSTANTS } from '../../constants.js';
import type { RosterTeam } from '../team-roster/team-roster.builder.js';
import { safeText } from './drive-briefing-snapshot.js';
import type { BriefingAgent, BriefingItem, BriefingOrg, BriefingOrgTeam, BriefingTeam, BriefingWaiting } from './drive-briefing.contract.js';

const C = DRIVE_BRIEFING_CONSTANTS;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Longest purpose (characters) */
const PURPOSE_MAX = 100;
const DOING = new Set(['in_progress', 'running', 'accepted']);
const BLOCKED = new Set(['blocked', 'escalated']);

/** What the overview is built from. */
export interface OrgOverviewInput {
  teams: readonly BriefingTeam[];
  agents: readonly BriefingAgent[];
  items: readonly BriefingItem[];
  waiting: readonly BriefingWaiting[];
  /** The team roster, when it could be read (otherwise the snapshot's own items stand in) */
  roster?: readonly RosterTeam[] | null;
  now: Date;
}

/** First sentence of a charter, safe to speak. */
function purposeOf(r: RosterTeam | undefined): string | undefined {
  if (!r || r.charterSource === 'derived') return undefined;
  const first = r.charter.split(/(?<=[.!?。！？])\s+/)[0] ?? '';
  return safeText(first, PURPOSE_MAX) || undefined;
}

/**
 * Build the overview.
 *
 * @param input - Snapshot parts, roster, clock
 * @returns Teams (busiest first) and agent counts
 */
export function buildOrgOverview(input: OrgOverviewInput): BriefingOrg {
  const nowMs = input.now.getTime();
  const recent = (iso: string | undefined): boolean => !!iso && nowMs - Date.parse(iso) < DAY_MS;
  const rosterOf = new Map((input.roster ?? []).map((r) => [r.name.toLowerCase(), r]));

  const teams: BriefingOrgTeam[] = input.teams.slice(0, C.MAX_TEAMS).map((t) => {
    const r = rosterOf.get(t.name.toLowerCase());
    const mine = input.items.filter((i) => i.team === t.name);
    // With a roster the harness chores (verify, retries, watchers) are already out of the lists.
    const done = r ? r.recentDone.filter((w) => recent(w.at)).map((w) => w.title) : mine.filter((i) => i.status === 'done' && recent(i.updatedAt)).map((i) => i.title);
    const doing = r ? r.open.filter((w) => DOING.has(w.status)).map((w) => w.title) : mine.filter((i) => i.status === 'in_progress').map((i) => i.title);
    const blocked = Math.max(t.blocked, r ? r.open.filter((w) => BLOCKED.has(w.status)).length : 0);
    const needsYou = input.waiting.filter((w) => w.team === t.name).length;
    const doneRecent = r ? done.length : Math.max(t.doneToday, done.length);
    const lastMs = [...mine.map((i) => Date.parse(i.updatedAt)), ...(r ? [...r.recentDone, ...r.open].map((w) => Date.parse(w.at)) : [])].filter(Number.isFinite).sort((a, b) => b - a)[0];
    const active = doneRecent > 0 || doing.length > 0 || recent(lastMs ? new Date(lastMs).toISOString() : undefined);
    const state: BriefingOrgTeam['state'] = r?.paused ? 'paused' : needsYou > 0 ? 'needs_you' : blocked > 0 ? 'blocked' : active ? 'active' : 'quiet';
    const purpose = purposeOf(r);
    const titles = (xs: readonly string[]): string[] => xs.slice(0, 2).map((x) => safeText(x, C.TITLE_MAX)).filter(Boolean);
    return {
      name: safeText(t.name, C.NAME_MAX),
      ...(purpose ? { purpose } : {}),
      members: t.agents.length,
      state,
      doneRecent,
      ...(done.length ? { done: titles(done) } : {}),
      ...(doing.length ? { doing: titles(doing) } : {}),
      blocked,
      needsYou,
      ...(lastMs ? { lastActivityAt: new Date(lastMs).toISOString() } : {}),
    };
  });

  const members = input.agents.filter((a) => a.team);
  return {
    teams,
    agents: {
      total: members.length,
      working: members.filter((a) => a.state === 'working').length,
      idle: members.filter((a) => a.state === 'idle' || a.state === 'starting').length,
      stopped: members.filter((a) => a.state === 'stopped').length,
    },
  };
}

/**
 * Make the overview smaller (the snapshot is over its size cap): first the
 * titles of what finished and what is in progress, then the purposes.
 *
 * @param org - Overview (mutated)
 * @returns Whether something was dropped
 */
export function trimOrg(org: BriefingOrg): boolean {
  const withTitles = org.teams.find((t) => t.done || t.doing);
  if (withTitles) {
    delete withTitles.done;
    delete withTitles.doing;
    return true;
  }
  const withPurpose = org.teams.find((t) => t.purpose);
  if (withPurpose) {
    delete withPurpose.purpose;
    return true;
  }
  return false;
}
