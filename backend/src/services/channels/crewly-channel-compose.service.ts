/**
 * Crewly Channel Compose Service
 *
 * "Make a channel with Owen and the Lead of the growth team" — the
 * orchestrator's one-call version of create-channel / add-members that also
 * reaches agents on OTHER machines.
 *
 * 2026-10-13 incident: the owner DM'd the Air orchestrator from the phone to
 * "create a channel and add Owen (Mac) and the growth team's Lead (Air)". The
 * orc had no way to do it, queued a work item nobody could claim and showed
 * "Still working… queued 1" forever. Channels were owner-only and could only
 * hold local agents.
 *
 * What this does:
 *   1. Resolves each requested name (display name, session, or "<team> Lead")
 *      to a local agent or — through Cloud's colleague directory — to an agent
 *      on another machine. Names nobody matches, or that match several agents,
 *      are REPORTED, never guessed.
 *   2. Creates the Slack channel (or extends an existing one) with the local
 *      members.
 *   3. For each other machine, asks Cloud to have it join that existing Slack
 *      channel with its agents (`POST …/rooms/join`); the machine links the
 *      room itself (see SlackTeamChannelService.joinRoomFromCloud).
 *
 * Agents without a Slack app of their own post through the master app with a
 * username override, so being in the room needs no per-agent bot.
 *
 * @module services/channels/crewly-channel-compose.service
 */

import type { CrewlyChannelDTO } from '../../types/crewly-channel.types.js';
import {
  CrewlyChannelError,
  type CrewlyChannelAgent,
  type CrewlyChannelService,
} from './crewly-channel.service.js';

/** An agent on another machine, from Cloud's directory. */
export interface RemoteColleague {
  agentSession: string;
  name: string;
  instanceId: string;
  machine: string | null;
  team: string | null;
  isLeader?: boolean;
}

/** Constructor dependencies. */
export interface ChannelComposeDeps {
  channels: Pick<CrewlyChannelService, 'create' | 'get' | 'addMember'>;
  /** Every agent of every team on this machine. */
  listAgents: () => Promise<CrewlyChannelAgent[]>;
  /** Agents on other machines of this account; null when the directory is unavailable (not signed in to Cloud). */
  listRemote: () => Promise<RemoteColleague[] | null>;
  /** Ask Cloud to have a machine join a Slack channel with these sessions; undefined when Cloud is unreachable. */
  requestRoomJoin?: (body: { slackChannelId: string; slackChannelName: string; targetInstanceId: string; sessions: string[] }) => Promise<void>;
}

/** One resolved request term. */
export interface ResolvedMember {
  term: string;
  kind: 'local' | 'remote';
  name: string;
  session: string;
  team: string | null;
  machine: string | null;
  instanceId?: string;
}

/** Outcome of {@link ChannelComposeService.compose}. */
export interface ComposeResult {
  channel: { id: string; name: string; slackChannelId: string | null; created: boolean };
  added: Array<{ term: string; name: string; session: string; team: string | null; machine: string | null }>;
  /** Asked of another machine but not confirmed by it yet (the join is asynchronous). */
  requested: Array<{ term: string; name: string; machine: string | null }>;
  notFound: string[];
  ambiguous: Array<{ term: string; candidates: string[] }>;
  failed: Array<{ term: string; name: string; reason: string }>;
  /** True when Cloud's directory could not be read (remote names could not be looked up). */
  directoryUnavailable: boolean;
}

/** Lowercase, trim, drop a leading `@`. */
function norm(s: string): string {
  return s.trim().replace(/^@/, '').trim().toLowerCase();
}

/** Words that mean "the leader" in a request such as "Growth Team Lead". */
const LEAD_WORDS = new Set(['lead', 'leader', 'team lead', 'team leader', 'tl', '']);

interface Candidate extends ResolvedMember {
  isLead: boolean;
}

/**
 * Resolve one requested name against local and remote agents.
 *
 * @param term - What the owner said
 * @param all - Every candidate
 * @returns The hit, an ambiguity, or not found
 */
export function resolveName(term: string, all: Candidate[]): { hit?: Candidate; ambiguous?: Candidate[] } {
  const t = norm(term);
  if (!t) return {};
  const pick = (found: Candidate[]): { hit?: Candidate; ambiguous?: Candidate[] } | null =>
    found.length === 1 ? { hit: found[0] } : found.length > 1 ? { ambiguous: found } : null;

  const exact = pick(all.filter((c) => norm(c.name) === t || norm(c.session) === t));
  if (exact) return exact;

  // "<team name> Lead" / "<team name>'s lead" / "<team name> <member name>".
  const teams = [...new Set(all.map((c) => c.team).filter((x): x is string => !!x))].sort((a, b) => b.length - a.length);
  for (const team of teams) {
    const tn = norm(team);
    if (!tn || !t.includes(tn)) continue;
    const rest = t.replace(tn, ' ').replace(/['’]s\b/g, ' ').replace(/\s+/g, ' ').trim();
    const inTeam = all.filter((c) => c.team === team);
    const byLead = LEAD_WORDS.has(rest) ? inTeam.filter((c) => c.isLead) : [];
    const byName = inTeam.filter((c) => norm(c.name) === rest);
    const found = pick(byLead.length > 0 ? byLead : byName);
    if (found) return found;
  }

  // A name inside the request, or the request inside a name ("Owen" ↔ "Owen Chen").
  const loose = pick(all.filter((c) => {
    const n = norm(c.name);
    return n.length >= 3 && (n.includes(t) || t.includes(n)) && t.length >= 3;
  }));
  return loose ?? {};
}

/**
 * The orchestrator-facing channel composer.
 */
export class ChannelComposeService {
  constructor(private readonly deps: ChannelComposeDeps) {}

  /**
   * Create a channel (or extend one) with the named agents, wherever they run.
   *
   * @param input - `channel` extends an existing channel; otherwise `name` creates one (an existing channel of that name is extended)
   * @returns What happened to each requested name
   * @throws CrewlyChannelError 400 when nothing was asked or none of the names could be placed
   */
  async compose(input: { name?: string; channel?: string; purpose?: string; members: string[] }): Promise<ComposeResult> {
    const terms = [...new Set((input.members ?? []).map((m) => (typeof m === 'string' ? m.trim() : '')).filter(Boolean))];
    if (terms.length === 0) throw new CrewlyChannelError('members is required (names or sessions)', 400, 'validation_error');
    if (!input.channel && !input.name?.trim()) throw new CrewlyChannelError('name (new channel) or channel (existing) is required', 400, 'validation_error');

    const local = await this.deps.listAgents();
    const remote = await this.deps.listRemote();
    const localSessions = new Set(local.map((a) => a.sessionName));
    const candidates: Candidate[] = [
      ...local.map((a): Candidate => ({
        term: '',
        kind: 'local',
        name: a.name,
        session: a.sessionName,
        team: a.teamName,
        machine: 'this machine',
        isLead: !!a.isLead,
      })),
      ...(remote ?? [])
        .filter((r) => !localSessions.has(r.agentSession))
        .map((r): Candidate => ({
          term: '',
          kind: 'remote',
          name: r.name,
          session: r.agentSession,
          team: r.team,
          machine: r.machine,
          instanceId: r.instanceId,
          isLead: !!r.isLeader,
        })),
    ];

    const result: ComposeResult = {
      channel: { id: '', name: input.name ?? input.channel ?? '', slackChannelId: null, created: false },
      added: [],
      requested: [],
      notFound: [],
      ambiguous: [],
      failed: [],
      directoryUnavailable: remote === null,
    };
    const resolved: ResolvedMember[] = [];
    for (const term of terms) {
      const r = resolveName(term, candidates);
      if (r.hit) resolved.push({ ...r.hit, term });
      else if (r.ambiguous) {
        result.ambiguous.push({ term, candidates: r.ambiguous.map((c) => `${c.name} (${c.team ?? '?'}, ${c.machine ?? '?'})`) });
      } else result.notFound.push(term);
    }
    if (resolved.length === 0) {
      throw new CrewlyChannelError(
        `None of the requested agents could be placed (not found: ${result.notFound.join(', ') || 'none'}; ambiguous: ${result.ambiguous.map((a) => a.term).join(', ') || 'none'})`,
        400,
        'validation_error',
      );
    }
    const localHits = resolved.filter((m) => m.kind === 'local');
    const remoteHits = resolved.filter((m) => m.kind === 'remote');

    // Create or extend.
    let channel: CrewlyChannelDTO;
    if (input.channel) {
      channel = await this.deps.channels.get(input.channel);
    } else {
      try {
        channel = await this.deps.channels.create({
          name: input.name as string,
          purpose: input.purpose,
          memberSessions: localHits.map((m) => m.session),
          allowNoLocalMembers: true,
        });
        result.channel.created = true;
        for (const m of localHits) result.added.push(placed(m));
      } catch (err) {
        if (!(err instanceof CrewlyChannelError) || err.code !== 'conflict') throw err;
        channel = await this.deps.channels.get(input.name as string);
      }
    }
    result.channel.id = channel.id;
    result.channel.name = channel.name;
    result.channel.slackChannelId = channel.slack?.channelId ?? null;

    if (!result.channel.created) {
      for (const m of localHits) {
        try {
          await this.deps.channels.addMember(channel.id, m.session);
          result.added.push(placed(m));
        } catch (err) {
          result.failed.push({ term: m.term, name: m.name, reason: err instanceof Error ? err.message : String(err) });
        }
      }
    }

    // Other machines join the same Slack channel through Cloud.
    const byInstance = new Map<string, ResolvedMember[]>();
    for (const m of remoteHits) {
      if (!m.instanceId) continue;
      byInstance.set(m.instanceId, [...(byInstance.get(m.instanceId) ?? []), m]);
    }
    for (const [instanceId, members] of byInstance) {
      const fail = (reason: string): void => {
        for (const m of members) result.failed.push({ term: m.term, name: m.name, reason });
      };
      if (!channel.slack) {
        fail('the channel is not a Slack channel (Slack is not connected here), so other machines cannot join it');
        continue;
      }
      if (!this.deps.requestRoomJoin) {
        fail('not connected to Crewly Cloud');
        continue;
      }
      try {
        await this.deps.requestRoomJoin({
          slackChannelId: channel.slack.channelId,
          slackChannelName: channel.slack.channelName,
          targetInstanceId: instanceId,
          sessions: members.map((m) => m.session),
        });
        for (const m of members) result.requested.push({ term: m.term, name: m.name, machine: m.machine });
      } catch (err) {
        fail(`Cloud refused the join request: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return result;
  }
}

function placed(m: ResolvedMember): ComposeResult['added'][number] {
  return { term: m.term, name: m.name, session: m.session, team: m.team, machine: m.machine };
}
