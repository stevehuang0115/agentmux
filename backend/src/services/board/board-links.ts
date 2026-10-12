/**
 * Canvas links (crewly#1247, CANVAS-V2-CONTRACT.md): who reports to whom and
 * who works with whom. Pure functions of what the board already read, so a
 * delta never touches the disk.
 *
 * @module services/board/board-links
 */

import { BOARD_CONSTANTS } from '../../constants.js';
import { scrubText } from './board-redact.js';
import type { InteractionPair } from './board-interactions.js';
import type { BoardTeamInfo, BoardTicket, BoardWorkItem } from './board-snapshot.builder.js';
import { linkKey, type BoardLink } from './board.types.js';

const C = BOARD_CONSTANTS;

/** Work states that no longer count as open. */
const CLOSED = new Set(['done', 'verified', 'cancelled', 'rejected', 'failed']);
/** Closed states that still show as finished delegations. */
const FINISHED_OK = new Set(['done', 'verified']);

const iso = (ms: number): string => new Date(ms).toISOString();
const msOf = (s: string | undefined): number => (s ? Date.parse(s) : NaN);

/** The label of a link: scrubbed, short. */
function label(text: string | undefined): string | undefined {
	const t = text ? scrubText(text, C.LINK_LABEL_MAX) : '';
	return t ? t.slice(0, C.LINK_LABEL_MAX) : undefined;
}

/** What the structural links read. */
export interface StructuralLinkInput {
	now: number;
	orchestrator: string;
	teams: BoardTeamInfo[];
	workItems: BoardWorkItem[];
	tickets: BoardTicket[];
	/** Each agent's current task (a WorkItem id or a ticket id) */
	tasks: Map<string, { id?: string; title: string; since: string }>;
	/** Sessions that are stopped (their reporting line is not active) */
	stopped: ReadonlySet<string>;
}

/**
 * Reporting, delegation and shared-ticket links.
 *
 * @param input - Teams, work and tickets
 * @returns Links, one per identity
 */
export function structuralLinks(input: StructuralLinkInput): BoardLink[] {
	const { now, orchestrator, teams, workItems, tickets, tasks, stopped } = input;
	const out = new Map<string, BoardLink>();
	const put = (l: BoardLink): void => {
		if (l.from === l.to) return;
		out.set(linkKey(l), l);
	};
	const known = new Set<string>([orchestrator]);
	const teamOf = new Map<string, BoardTeamInfo>();
	for (const t of teams) for (const m of t.members) {
		known.add(m.session);
		teamOf.set(m.session, t);
	}
	const isKnown = (s: string): boolean => known.has(s) || s.includes('@');

	// --- reports_to: members -> their leaders, leaders -> the orchestrator
	for (const t of teams) {
		if (t.teamId === 'orchestrator') continue;
		const leaders = (t.leaders ?? []).filter((s) => t.members.some((m) => m.session === s));
		const since = t.createdAt ?? iso(now);
		for (const m of t.members) {
			if (leaders.includes(m.session)) {
				put({ from: m.session, to: orchestrator, kind: 'reports_to', active: !stopped.has(m.session), since });
			} else {
				for (const lead of leaders) put({ from: m.session, to: lead, kind: 'reports_to', active: !stopped.has(m.session), since });
			}
		}
	}

	// --- delegated: delegator -> worker, per pair
	const windowStart = now - C.LINK_DELEGATION_WINDOW_MS;
	const delegations = new Map<string, { from: string; to: string; items: Array<{ w: BoardWorkItem; open: boolean; at: number }> }>();
	for (const w of workItems) {
		const to = w.target;
		if (!to || !isKnown(to)) continue;
		let from = w.delegatedBy;
		if (!from) {
			if (w.owner === 'orchestrator') from = orchestrator;
			else if (w.owner === 'team_lead') from = teamOf.get(to)?.leaders?.find((s) => s !== to);
		}
		if (!from || from === to || !isKnown(from)) continue;
		const open = !CLOSED.has(w.status);
		const created = msOf(w.createdAt);
		if (!open) {
			const done = msOf(w.completedAt) || msOf(w.statusChangedAt) || created;
			if (!FINISHED_OK.has(w.status) || !(done >= windowStart)) continue;
		}
		const key = `${from}\u0000${to}`;
		const entry = delegations.get(key) ?? { from, to, items: [] };
		entry.items.push({ w, open, at: Number.isFinite(created) ? created : now });
		delegations.set(key, entry);
	}
	for (const { from, to, items } of delegations.values()) {
		const open = items.filter((i) => i.open);
		const pool = open.length > 0 ? open : items;
		const newest = pool.reduce((a, b) => (b.at > a.at ? b : a));
		put({ from, to, kind: 'delegated', active: open.length > 0, since: iso(newest.at), ...(label(newest.w.title) ? { label: label(newest.w.title) } : {}), weight: items.length });
	}

	// --- same_task: two agents on one ticket right now
	const ticketTitle = new Map<string, string>();
	for (const t of tickets) {
		ticketTitle.set(t.id, t.label ? `${t.label} ${t.title}` : t.title);
		if (t.label) ticketTitle.set(t.label, `${t.label} ${t.title}`);
	}
	const groups = new Map<string, Map<string, number>>();
	const join = (key: string, session: string, since: number): void => {
		const g = groups.get(key) ?? new Map<string, number>();
		g.set(session, Math.max(g.get(session) ?? 0, Number.isFinite(since) ? since : now));
		groups.set(key, g);
	};
	for (const w of workItems) {
		if (w.status !== 'running' || !w.target || !isKnown(w.target)) continue;
		const key = w.projectTaskId ?? w.requestId;
		if (key) join(key, w.target, msOf(w.startedAt) || msOf(w.createdAt));
	}
	for (const [session, task] of tasks) {
		if (task.id && ticketTitle.has(task.id) && isKnown(session)) join(task.id, session, msOf(task.since));
	}
	for (const [key, members] of groups) {
		if (members.size < 2) continue;
		const sessions = [...members.keys()].sort().slice(0, C.LINK_SAME_TASK_MAX_GROUP);
		const text = label(ticketTitle.get(key) ?? workItems.find((w) => w.projectTaskId === key || w.requestId === key)?.title);
		for (let i = 0; i < sessions.length; i += 1) {
			for (let j = i + 1; j < sessions.length; j += 1) {
				const since = Math.max(members.get(sessions[i]) ?? now, members.get(sessions[j]) ?? now);
				const link: BoardLink = { from: sessions[i], to: sessions[j], kind: 'same_task', active: true, since: iso(since), ...(text ? { label: text } : {}) };
				// Two tickets shared by one pair: the earlier key keeps the pair
				if (!out.has(linkKey(link))) put(link);
			}
		}
	}
	return [...out.values()];
}

/**
 * Messaging links from the recorder.
 *
 * @param pairs - Sender/receiver pairs in the last two hours
 * @param now - Clock
 * @param isKnown - Whether an endpoint is an agent of this machine or qualified
 * @returns Links
 */
export function messagingLinks(pairs: readonly InteractionPair[], now: number, isKnown: (session: string) => boolean): BoardLink[] {
	const out: BoardLink[] = [];
	for (const p of pairs) {
		if (!isKnown(p.from) || !isKnown(p.to)) continue;
		out.push({ from: p.from, to: p.to, kind: 'messaging', active: now - p.lastAt <= C.LINK_MESSAGING_ACTIVE_MS, since: iso(p.firstAt), weight: p.count });
	}
	return out;
}

/**
 * Cap a link list: messaging, then same_task, are dropped first.
 *
 * @param links - Links
 * @param max - Most links to keep
 * @returns At most `max` links
 */
export function capLinks(links: BoardLink[], max: number = C.LINKS_MAX): BoardLink[] {
	if (links.length <= max) return links;
	const rank: Record<BoardLink['kind'], number> = { reports_to: 0, delegated: 1, same_task: 2, messaging: 3 };
	return [...links]
		.sort((a, b) => rank[a.kind] - rank[b.kind] || Number(b.active) - Number(a.active) || Date.parse(b.since) - Date.parse(a.since))
		.slice(0, max);
}
