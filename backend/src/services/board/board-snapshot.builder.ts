/**
 * Board snapshot builder (crewly#1247): turns what the machine knows (teams,
 * runtime turn state, WorkItems, tickets, decisions, the usage ledger and the
 * live activity tracker) into the {@link BoardSnapshot} Cloud and the local
 * dashboard show.
 *
 * Everything is read through {@link BoardSources}, so the builder is a pure
 * function of its inputs and is tested with fixtures. A full build refreshes
 * a cache (roster, usage, tasks, owner waits); the per-agent delta rows are
 * built from that cache plus the live activity, so a delta never rescans the
 * disk.
 *
 * Every text in the result went through {@link scrubText}.
 *
 * @module services/board/board-snapshot.builder
 */

import { BOARD_CONSTANTS } from '../../constants.js';
import { scrubText } from './board-redact.js';
import { resultOf, summarizeResults } from './board-outcome-phrases.js';
import type { BoardActivityTracker } from './board-activity.tracker.js';
import type {
	BoardAgent,
	BoardAgentState,
	BoardDoneItem,
	BoardSnapshot,
	BoardSpend,
	BoardStuckItem,
	BoardTeam,
	BoardWaitingItem,
} from './board.types.js';

const C = BOARD_CONSTANTS;

/** One agent as the team config knows it. */
export interface BoardMember {
	session: string;
	name: string;
	role: string;
	runtime: string;
	model?: string;
	agentStatus: string;
	workingStatus: string;
}

/** One team as the team config knows it. */
export interface BoardTeamInfo {
	teamId: string;
	name: string;
	paused?: boolean;
	members: BoardMember[];
}

/** The WorkItem fields the board reads. */
export interface BoardWorkItem {
	id: string;
	title: string;
	type: string;
	status: string;
	target?: string;
	requestId?: string;
	/** Project ticket this item works on */
	projectTaskId?: string;
	createdAt: string;
	startedAt?: string;
	completedAt?: string;
	statusChangedAt?: string;
	scheduledAt?: string;
	blockedReason?: string;
	blockSource?: string;
	error?: string;
}

/** The ticket fields the board reads (harness tickets and project tickets alike). */
export interface BoardTicket {
	id: string;
	/** `TKT-12` / `CE-7` */
	label?: string;
	title: string;
	kind?: string;
	/** `done`, `to_review`, `blocked`, `in_progress`, ... */
	column: string;
	assignee?: string;
	teamId?: string;
	submittedAt?: string;
	completedAt?: string;
	updatedAt: string;
}

/** An open decision card. */
export interface BoardDecision {
	id: string;
	kind: 'decision' | 'approval' | 'question';
	title: string;
	/** Session that asked (the agent that waits for the answer) */
	asker?: string;
	teamId?: string;
	createdAt: string;
}

/** What the usage ledger says. */
export interface BoardUsage {
	perAgent: Map<string, { todayUsd: number; todayTokens: number }>;
	spend: BoardSpend;
	/** Open ledger unit each agent worked on most recently */
	taskOf: Map<string, { id?: string; title: string; since: string }>;
}

/** Everything the builder reads. All reads are best-effort; a failing source is an empty one. */
export interface BoardSources {
	identity(): Promise<{ instanceId: string; machineName: string }>;
	version(): Promise<string>;
	teams(): Promise<BoardTeamInfo[]>;
	/** Runtime turn state for a session */
	turnState(session: string, now: number): 'working' | 'idle' | 'unknown';
	/** A permission prompt / question is open in the agent's terminal */
	waitingOnHuman(session: string): boolean;
	/** Messages queued or deferred for the agent */
	queuedFor(session: string): number;
	/** The agent crashed / is stuck in an error the runtime reports, if any */
	errorOf?(session: string): string | null;
	/** Background work that stopped making progress (#1251) */
	stalledBackground(session: string, now: number): { since: number; description?: string } | null;
	workItems(): Promise<BoardWorkItem[]>;
	tickets(): Promise<BoardTicket[]>;
	decisions(): Promise<BoardDecision[]>;
	/** Other things that wait on the owner (doc-comment batches, held mail, reconnect cards), already shaped */
	holds(): Promise<BoardWaitingItem[]>;
	usage(now: number): Promise<BoardUsage>;
	/** What each agent is on now: its running WorkItem or the ticket of its turn */
	activeWork(): Promise<Map<string, { id?: string; title: string; since: string }>>;
}

/** Cache a full build leaves for the delta rows. */
interface Cache {
	roster: Map<string, { team: BoardTeamInfo; member: BoardMember }>;
	usage: BoardUsage | null;
	tasks: Map<string, { id?: string; title: string; since: string }>;
	/** Open decisions by asking session */
	waits: Map<string, BoardDecision>;
}

/** Local midnight of `now`. */
export function startOfLocalDay(now: number): number {
	const d = new Date(now);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

const iso = (ms: number): string => new Date(ms).toISOString();
const msOf = (s: string | undefined): number => (s ? Date.parse(s) : NaN);

/** Hours/minutes in words for stuck reasons. */
function age(ms: number): string {
	const m = Math.max(1, Math.round(ms / 60_000));
	if (m < 60) return `${m} min`;
	const h = Math.round(m / 60);
	return h < 48 ? `${h} h` : `${Math.round(h / 24)} days`;
}

/**
 * Builds board snapshots and per-agent rows.
 */
export class BoardSnapshotBuilder {
	private cache: Cache = { roster: new Map(), usage: null, tasks: new Map(), waits: new Map() };

	/**
	 * @param sources - Everything the board reads
	 * @param tracker - Live activity
	 * @param clock - Clock (tests)
	 */
	constructor(
		private readonly sources: BoardSources,
		private readonly tracker: BoardActivityTracker,
		private readonly clock: () => number = Date.now,
	) {}

	/** Whether a full build has filled the cache. */
	get primed(): boolean {
		return this.cache.roster.size > 0;
	}

	/** This machine's identity. */
	identity(): Promise<{ instanceId: string; machineName: string }> {
		return this.sources.identity();
	}

	/** Sessions known from the last full build. */
	knownSessions(): string[] {
		return [...this.cache.roster.keys()];
	}

	private async safe<T>(read: () => Promise<T>, fallback: T): Promise<T> {
		try {
			return await read();
		} catch {
			return fallback;
		}
	}

	/**
	 * Build the full snapshot and refresh the cache.
	 *
	 * @returns The snapshot
	 */
	async build(): Promise<BoardSnapshot> {
		const now = this.clock();
		const dayStart = startOfLocalDay(now);
		const [identity, version, teams, workItems, tickets, decisions, holds, usage, active] = await Promise.all([
			this.sources.identity(),
			this.safe(() => this.sources.version(), 'unknown'),
			this.safe(() => this.sources.teams(), [] as BoardTeamInfo[]),
			this.safe(() => this.sources.workItems(), [] as BoardWorkItem[]),
			this.safe(() => this.sources.tickets(), [] as BoardTicket[]),
			this.safe(() => this.sources.decisions(), [] as BoardDecision[]),
			this.safe(() => this.sources.holds(), [] as BoardWaitingItem[]),
			this.safe(() => this.sources.usage(now), null as BoardUsage | null),
			this.safe(() => this.sources.activeWork(), new Map<string, { id?: string; title: string; since: string }>()),
		]);

		const roster = new Map<string, { team: BoardTeamInfo; member: BoardMember }>();
		for (const team of teams) for (const member of team.members) roster.set(member.session, { team, member });
		const waits = new Map<string, BoardDecision>();
		for (const d of decisions) if (d.asker && !waits.has(d.asker)) waits.set(d.asker, d);
		const tasks = new Map<string, { id?: string; title: string; since: string }>(usage?.taskOf ?? []);
		for (const [session, task] of active) tasks.set(session, task);
		this.cache = { roster, usage, tasks, waits };

		const teamName = (id: string | undefined, agent?: string): string | undefined => {
			const byId = id ? teams.find((t) => t.teamId === id)?.name : undefined;
			return byId ?? (agent ? roster.get(agent)?.team.name : undefined);
		};
		const agentName = (session: string | undefined): string | undefined => (session ? (roster.get(session)?.member.name ?? undefined) : undefined);

		return {
			v: 1,
			instanceId: identity.instanceId,
			machineName: scrubText(identity.machineName, 60) || 'This machine',
			crewlyVersion: scrubText(version, 30) || 'unknown',
			generatedAt: iso(now),
			outcomes: {
				...this.doneToday(tickets, workItems, dayStart, teamName, agentName),
				waitingOnOwner: this.waiting(decisions, holds, tickets, teamName, agentName),
				stuck: this.stuck(workItems, tickets, roster, now, teamName, agentName),
				spend: usage?.spend ?? { todayUsd: 0, weekUsd: 0, todayTokens: 0, weekTokens: 0 },
			},
			teams: teams.map((t): BoardTeam => ({
				teamId: t.teamId,
				name: scrubText(t.name, 60) || t.teamId,
				...(t.paused ? { paused: true } : {}),
				agents: t.members.map((m) => this.row(m, now)),
			})),
		};
	}

	/**
	 * Rows for some agents, from the cache and the live activity. No disk or
	 * network reads.
	 *
	 * @param sessions - Sessions to build
	 * @returns Rows of the known sessions
	 */
	rows(sessions: Iterable<string>): Array<BoardAgent & { teamId: string }> {
		const now = this.clock();
		const out: Array<BoardAgent & { teamId: string }> = [];
		for (const session of new Set(sessions)) {
			const entry = this.cache.roster.get(session);
			if (!entry) continue;
			out.push({ ...this.row(entry.member, now), teamId: entry.team.teamId });
		}
		return out;
	}

	// -------------------------------------------------------------------------
	// Agent rows
	// -------------------------------------------------------------------------

	private row(m: BoardMember, now: number): BoardAgent {
		const turn = this.safeSync(() => this.sources.turnState(m.session, now), 'unknown' as const);
		const working = turn === 'working' || (turn === 'unknown' && m.workingStatus === 'in_progress' && m.agentStatus !== 'inactive');
		const decision = this.cache.waits.get(m.session);
		const hookWaiting = this.safeSync(() => this.sources.waitingOnHuman(m.session), false);
		const error = this.safeSync(() => this.sources.errorOf?.(m.session) ?? null, null);
		const queued = this.safeSync(() => this.sources.queuedFor(m.session), 0);
		const stopped = m.agentStatus === 'inactive' || m.agentStatus === 'suspended';

		const live = this.tracker.live(m.session, working && !stopped, now);
		const trackerWaiting = live.activity?.type === 'waiting_owner';

		let state: BoardAgentState;
		if (stopped) state = 'stopped';
		else if (error) state = 'error';
		else if (hookWaiting || trackerWaiting || (decision && !working)) state = 'waiting';
		else if (working) state = 'working';
		else if (queued > 0) state = 'queued';
		else state = 'idle';

		let activity = live.activity ?? undefined;
		if (state === 'waiting' && activity?.type !== 'waiting_owner') {
			const what = decision ? scrubText(decision.title, 100) : 'a reply to its prompt';
			activity = { type: 'waiting_owner', detail: `Waiting for the owner: ${what}`.slice(0, C.MAX_TEXT), since: decision?.createdAt ?? iso(now) };
		}
		if (stopped || state === 'idle' || state === 'queued') activity = undefined;
		if (state === 'error' && error) activity = { type: 'other', detail: scrubText(error), since: iso(now) };

		const task = this.cache.tasks.get(m.session);
		const usage = this.cache.usage?.perAgent.get(m.session);
		const row: BoardAgent = {
			session: m.session,
			name: scrubText(m.name, 60) || m.session,
			role: scrubText(m.role, 40),
			runtime: scrubText(m.runtime, 30),
			...(m.model ? { model: scrubText(m.model, 60) } : {}),
			state,
			...(activity ? { activity } : {}),
			...(task && !stopped ? { task: { ...(task.id ? { id: task.id } : {}), title: scrubText(task.title), since: task.since } } : {}),
			...(live.lastAction ? { lastAction: live.lastAction } : {}),
			...(usage ? { todayUsd: round4(usage.todayUsd), todayTokens: Math.round(usage.todayTokens) } : {}),
		};
		return row;
	}

	private safeSync<T>(read: () => T, fallback: T): T {
		try {
			return read();
		} catch {
			return fallback;
		}
	}

	// -------------------------------------------------------------------------
	// Outcomes
	// -------------------------------------------------------------------------

	private doneToday(
		tickets: BoardTicket[],
		workItems: BoardWorkItem[],
		dayStart: number,
		teamName: (id: string | undefined, agent?: string) => string | undefined,
		agentName: (s: string | undefined) => string | undefined,
	): { doneToday: BoardDoneItem[]; doneTodaySummary: string[] } {
		const items: Array<BoardDoneItem & { result: string }> = [];
		for (const t of tickets) {
			if (t.column !== 'done') continue;
			const at = msOf(t.completedAt ?? t.updatedAt);
			if (!Number.isFinite(at) || at < dayStart) continue;
			const title = scrubText(t.title);
			items.push({
				ticketId: t.label ?? t.id,
				title,
				result: resultOf(title, t.kind),
				team: teamName(t.teamId, t.assignee) ?? 'Crewly',
				...(agentName(t.assignee) ? { agent: agentName(t.assignee) } : {}),
				at: iso(at),
			});
		}
		// WorkItems that belong to no ticket (a ticket carries its own result, and the
		// harness's own verify / follow-through / retry items are bookkeeping, not results)
		const OWNER_FACING_TYPES = new Set(['delegate', 'project_task', 'review']);
		const BOOKKEEPING_TITLE = /^(?:verify|follow[- ]through|retry\b|refresh standing|tl fallback|re-?verify|\[?auto|[A-Z][A-Z0-9]{1,6}-\d+\b)/i;
		for (const w of workItems) {
			if (w.status !== 'verified' && w.status !== 'done') continue;
			if (!OWNER_FACING_TYPES.has(w.type)) continue;
			if (w.requestId || w.projectTaskId) continue;
			if (BOOKKEEPING_TITLE.test(w.title.trim())) continue;
			const at = msOf(w.completedAt ?? w.statusChangedAt);
			if (!Number.isFinite(at) || at < dayStart) continue;
			const title = scrubText(w.title);
			items.push({
				title,
				result: resultOf(title),
				team: teamName(undefined, w.target) ?? 'Crewly',
				...(agentName(w.target) ? { agent: agentName(w.target) } : {}),
				at: iso(at),
			});
		}
		items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
		return { doneTodaySummary: summarizeResults(items.map((i) => i.result)), doneToday: items.slice(0, C.MAX_DONE) };
	}

	private waiting(
		decisions: BoardDecision[],
		holds: BoardWaitingItem[],
		tickets: BoardTicket[],
		teamName: (id: string | undefined, agent?: string) => string | undefined,
		agentName: (s: string | undefined) => string | undefined,
	): BoardWaitingItem[] {
		const out: BoardWaitingItem[] = [];
		for (const d of decisions) {
			out.push({
				id: `decision:${d.id}`,
				kind: d.kind,
				title: scrubText(d.title) || 'A decision is waiting',
				...(teamName(d.teamId, d.asker) ? { team: teamName(d.teamId, d.asker) } : {}),
				...(agentName(d.asker) ? { agent: agentName(d.asker) } : {}),
				since: d.createdAt,
				action: { label: d.kind === 'approval' ? 'Approve' : 'Answer' },
			});
		}
		for (const t of tickets) {
			if (t.column !== 'to_review') continue;
			out.push({
				id: `review:${t.id}`,
				kind: 'review',
				title: scrubText(t.label ? `${t.label} ${t.title}` : t.title),
				...(teamName(t.teamId, t.assignee) ? { team: teamName(t.teamId, t.assignee) } : {}),
				...(agentName(t.assignee) ? { agent: agentName(t.assignee) } : {}),
				since: t.submittedAt ?? t.updatedAt,
				action: { label: 'Review' },
			});
		}
		for (const h of holds) out.push({ ...h, title: scrubText(h.title) });
		return out.sort((a, b) => Date.parse(a.since) - Date.parse(b.since)).slice(0, C.MAX_WAITING);
	}

	private stuck(
		workItems: BoardWorkItem[],
		tickets: BoardTicket[],
		roster: Map<string, { team: BoardTeamInfo; member: BoardMember }>,
		now: number,
		teamName: (id: string | undefined, agent?: string) => string | undefined,
		agentName: (s: string | undefined) => string | undefined,
	): BoardStuckItem[] {
		const out: BoardStuckItem[] = [];
		const ownerWords = /owner|approv|sign[- ]?in|log ?in|credential|password|permission|reconnect|authori[sz]/i;
		const add = (id: string, title: string, target: string | undefined, since: number, on: BoardStuckItem['on'], reason: string, teamId?: string): void => {
			out.push({
				id,
				title: scrubText(title),
				...(teamName(teamId, target) ? { team: teamName(teamId, target) } : {}),
				...(agentName(target) ? { agent: agentName(target) } : {}),
				since: iso(Number.isFinite(since) ? since : now),
				on,
				reason: scrubText(reason),
			});
		};
		for (const w of workItems) {
			const changed = msOf(w.statusChangedAt) || msOf(w.createdAt);
			if (w.status === 'blocked') {
				const reason = w.blockedReason ?? 'Blocked';
				const on: BoardStuckItem['on'] = w.blockSource === 'explicit' ? (ownerWords.test(reason) ? 'owner' : 'agent') : 'system';
				add(`wi:${w.id}`, w.title, w.target, changed, on, reason);
			} else if (w.status === 'escalated') {
				add(`wi:${w.id}`, w.title, w.target, changed, 'agent', 'Escalated and not resolved yet');
			} else if (w.status === 'failed') {
				const at = msOf(w.completedAt) || changed;
				if (now - at <= C.STUCK_FAILED_MAX_AGE_MS) add(`wi:${w.id}`, w.title, w.target, at, 'agent', `Failed${w.error ? `: ${w.error}` : ''}`);
			} else if (w.status === 'queued') {
				const waited = now - msOf(w.createdAt);
				const scheduledLater = msOf(w.scheduledAt) > now;
				if (waited >= C.STUCK_QUEUED_MS && !scheduledLater) {
					add(`wi:${w.id}`, w.title, w.target, msOf(w.createdAt), w.target ? 'agent' : 'system', `Waiting in the queue for ${age(waited)}`);
				}
			} else if (w.status === 'running') {
				const ran = now - (msOf(w.startedAt) || changed);
				if (ran >= C.STUCK_RUNNING_MS) add(`wi:${w.id}`, w.title, w.target, msOf(w.startedAt) || changed, 'agent', `Running for ${age(ran)}`);
			}
		}
		for (const t of tickets) {
			if (t.column === 'blocked') add(`ticket:${t.id}`, t.label ? `${t.label} ${t.title}` : t.title, t.assignee, msOf(t.updatedAt), 'agent', 'Ticket is blocked', t.teamId);
		}
		for (const session of roster.keys()) {
			const stalled = this.safeSync(() => this.sources.stalledBackground(session, now), null);
			if (stalled) add(`bg:${session}`, stalled.description ?? 'Background task', session, stalled.since, 'agent', `Background task stopped making progress ${age(now - stalled.since)} ago`);
		}
		return out.sort((a, b) => Date.parse(a.since) - Date.parse(b.since)).slice(0, C.MAX_STUCK);
	}
}

const round4 = (n: number): number => Math.round(n * 10_000) / 10_000;
