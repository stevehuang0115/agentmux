/**
 * The high-level overview of the organisation: built from the roster, ticket/work-item items and the
 * owner's waiting items; no LLM. States, what each team finished and is on, agent counts, size trimming.
 */

import type { RosterTeam } from '../team-roster/team-roster.builder.js';
import type { BriefingAgent, BriefingItem, BriefingTeam, BriefingWaiting } from './drive-briefing.contract.js';
import { buildOrgOverview, trimOrg } from './drive-org-overview.js';
import { buildBriefingSnapshot, capSnapshot } from './drive-briefing-snapshot.js';

const NOW = new Date('2026-10-11T10:00:00.000Z');
const ago = (h: number): string => new Date(NOW.getTime() - h * 3600_000).toISOString();

const team = (name: string, over: Partial<BriefingTeam> = {}): BriefingTeam => ({ name, agents: ['A', 'B'], open: 0, inProgress: 0, review: 0, blocked: 0, doneToday: 0, ...over });
const item = (over: Partial<BriefingItem> & { ref: string; team: string }): BriefingItem => ({ kind: 'ticket', title: over.ref, status: 'open', updatedAt: ago(1), ...over });
const agent = (name: string, teamName: string | undefined, state: BriefingAgent['state']): BriefingAgent => ({ session: `${name}-1`, name, ...(teamName ? { team: teamName } : {}), state });
const waiting = (teamName: string): BriefingWaiting => ({ ref: 'D-1', kind: 'decision', from: 'Ella', team: teamName, summary: 'Which cut?', since: ago(2) });
const rosterTeam = (over: Partial<RosterTeam> & { name: string }): RosterTeam => ({ id: over.name, charter: 'Runs the website. Owns copy.', charterSource: 'lead', leads: [], members: [], projects: [], paused: false, open: [], recentDone: [], routineRuns: 0, backlog: 0, history: [], ...over });

describe('buildOrgOverview', () => {
  it('states: waiting on the owner > blocked > active > quiet; paused from the roster', () => {
    const org = buildOrgOverview({
      teams: [team('CE', { inProgress: 1 }), team('Marketing'), team('Ops', { blocked: 2 }), team('Quiet'), team('Paused')],
      agents: [],
      items: [item({ ref: 'CE-1', team: 'CE', status: 'in_progress', title: 'Pricing page' })],
      waiting: [waiting('Marketing')],
      roster: [rosterTeam({ name: 'Paused', paused: true })],
      now: NOW,
    });
    const by = Object.fromEntries(org.teams.map((t) => [t.name, t]));
    expect(by['CE']).toMatchObject({ state: 'active', doing: ['Pricing page'] });
    expect(by['Marketing']).toMatchObject({ state: 'needs_you', needsYou: 1 });
    expect(by['Ops']).toMatchObject({ state: 'blocked', blocked: 2 });
    expect(by['Quiet']).toMatchObject({ state: 'quiet', doneRecent: 0 });
    expect(by['Paused'].state).toBe('paused');
  });

  it('with a roster: what finished in the last 24 hours (chores already out), its purpose, in progress; without: the snapshot items', () => {
    const roster = [
      rosterTeam({
        name: 'CE',
        recentDone: [
          { ref: 'CE-3', title: 'Hero page', status: 'done', at: ago(5) },
          { ref: 'CE-2', title: 'Older work', status: 'done', at: ago(60) },
        ],
        open: [{ ref: 'CE-4', title: 'Pricing copy', status: 'in_progress', at: ago(1) }],
      }),
    ];
    const withRoster = buildOrgOverview({ teams: [team('CE', { doneToday: 4 })], agents: [], items: [], waiting: [], roster, now: NOW });
    expect(withRoster.teams[0]).toMatchObject({ name: 'CE', purpose: 'Runs the website.', doneRecent: 1, done: ['Hero page'], doing: ['Pricing copy'], state: 'active' });
    const without = buildOrgOverview({ teams: [team('CE', { doneToday: 4 })], agents: [], items: [item({ ref: 'CE-3', team: 'CE', status: 'done', title: 'Hero page', updatedAt: ago(3) })], waiting: [], now: NOW });
    expect(without.teams[0]).toMatchObject({ doneRecent: 4, done: ['Hero page'] });
    expect(without.teams[0].purpose).toBeUndefined();
  });

  it('a derived charter is not a purpose', () => {
    const org = buildOrgOverview({ teams: [team('CE')], agents: [], items: [], waiting: [], roster: [rosterTeam({ name: 'CE', charterSource: 'derived', charter: 'CE team — roles: dev.' })], now: NOW });
    expect(org.teams[0].purpose).toBeUndefined();
  });

  it('counts the agents that belong to a team (the orchestrator is not one)', () => {
    const org = buildOrgOverview({
      teams: [team('CE')],
      agents: [agent('Orc', undefined, 'idle'), agent('Owen', 'CE', 'working'), agent('Vera', 'CE', 'idle'), agent('Eve', 'CE', 'stopped'), agent('Sam', 'CE', 'starting')],
      items: [],
      waiting: [],
      now: NOW,
    });
    expect(org.agents).toEqual({ total: 4, working: 1, idle: 2, stopped: 1 });
  });

  it('text is made speakable and secrets are redacted', () => {
    const org = buildOrgOverview({
      teams: [team('CE')],
      agents: [],
      items: [item({ ref: 'CE-1', team: 'CE', status: 'in_progress', title: 'Fix https://x.com/a?token=abc with sk-abcdefghijklmnopqrstuv' })],
      waiting: [],
      now: NOW,
    });
    expect(JSON.stringify(org)).not.toMatch(/https?:|sk-abcdef/);
  });
});

describe('in the snapshot', () => {
  const base = {
    now: NOW,
    agents: [{ agentSession: 'owen-1', name: 'Owen', team: 'CE', state: 'working' as const }],
    teams: [{ id: 't1', name: 'CE', lead: 'owen-1', members: ['owen-1'] }],
    tickets: [],
    workItems: [],
    waiting: [],
    ownerFeed: { messages: [], ownerTurns: [] },
  };

  it('the snapshot carries the org part', () => {
    const snap = buildBriefingSnapshot(base);
    expect(snap.org?.teams).toMatchObject([{ name: 'CE', members: 1 }]);
    expect(snap.org?.agents).toMatchObject({ total: 1, working: 1 });
  });

  it('over the size cap, the titles go before items are dropped', () => {
    const snap = buildBriefingSnapshot({ ...base, roster: [rosterTeam({ name: 'CE', open: [{ ref: 'x', title: 'Doing it', status: 'in_progress', at: ago(1) }] })] });
    expect(snap.org?.teams[0].doing).toEqual(['Doing it']);
    const small = capSnapshot(snap, JSON.stringify(snap).length - 5);
    expect(small.org?.teams[0].doing).toBeUndefined();
    expect(snap.org?.teams[0].doing).toEqual(['Doing it']);
  });

  it('trimOrg drops titles, then purposes, then reports nothing left', () => {
    const org = { teams: [{ name: 'A', members: 1, state: 'active' as const, doneRecent: 1, done: ['x'], blocked: 0, needsYou: 0, purpose: 'p' }], agents: { total: 1, working: 0, idle: 1, stopped: 0 } };
    expect(trimOrg(org)).toBe(true);
    expect(org.teams[0].done).toBeUndefined();
    expect(trimOrg(org)).toBe(true);
    expect(org.teams[0].purpose).toBeUndefined();
    expect(trimOrg(org)).toBe(false);
  });
});
