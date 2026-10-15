/**
 * Where a Request is right now: who holds it, doing what, since when.
 *
 * On 2026-10-14 an owner request went Ella → Pia → Dex, Dex finished, and
 * the result sat in Dex's terminal for seven hours. Reconstructing that took
 * reading three agents' transcripts. Everything needed was already recorded:
 * the Request's open WorkItems (holder = `target`, time = `statusChangedAt`)
 * and the agent ask ledger (a holder that handed the work to another agent
 * with a plain message). This module joins them into one answer.
 *
 * Pure: the caller passes the Request, its WorkItems and the open asks.
 *
 * @module services/v3/request-whereabouts.service
 */

import type { Request } from '../../types/v2/request.types.js';
import type { WorkItem } from '../../types/v2/work-item.types.js';
import { WORK_ITEM_REVIEWER_KEY } from '../../types/v2/work-item.types.js';
import type { AgentAsk } from '../messaging/agent-ask-ledger.service.js';

/** What a holder is doing with the request. */
export type HolderState =
	| 'working'
	| 'queued'
	| 'blocked'
	| 'awaiting_review'
	| 'waiting_on_agent'
	| 'waiting_on_owner'
	| 'handling';

/** One place the request is held. */
export interface RequestHolder {
	/** Agent session, or `owner` */
	session: string;
	/** What it is doing */
	state: HolderState;
	/** Since when (ISO 8601) */
	since: string;
	/** How long, in ms, at `now` */
	forMs: number;
	/** The WorkItem behind it, when there is one */
	workItemId?: string;
	/** That WorkItem's title, or the ask excerpt */
	what?: string;
	/** Who handed it here (an ask's sender) */
	from?: string;
	/** Why it is blocked */
	blockedReason?: string;
}

/** The answer to "where is this request now?". */
export interface RequestWhereabouts {
	requestId: string;
	ticketNumber?: number;
	title: string;
	status: Request['status'];
	/** True when the request is done or cancelled */
	finished: boolean;
	/** When it finished (ISO), if it did */
	finishedAt?: string;
	/** Where it is held now, longest-held first */
	holders: RequestHolder[];
	/** One line for a person */
	summary: string;
}

/** WorkItem statuses that still hold a request. */
const OPEN_STATUSES = new Set<string>(['queued', 'scheduled', 'proposed', 'accepted', 'running', 'blocked', 'escalated', 'done_by_worker']);

/** Request statuses that wait on the owner. */
const OWNER_WAIT_STATUSES = new Set<string>(['waiting_confirmation', 'awaiting_followup']);

/** Most hops followed along agent-to-agent asks. */
const MAX_ASK_HOPS = 4;

/** Request statuses that are final. */
const FINISHED_STATUSES = new Set<string>(['done', 'cancelled']);

/**
 * Format a duration for a person: "45m", "2h 10m", "3d 4h".
 *
 * @param ms - Duration
 * @returns Short text
 */
export function formatDuration(ms: number): string {
	const m = Math.max(0, Math.floor(ms / 60_000));
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	if (h < 48) return `${h}h ${m % 60}m`;
	return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/**
 * The state and holder a WorkItem implies.
 *
 * @param wi - An open WorkItem
 * @param reviewItems - Review WorkItems by the id they verify
 * @returns Holder session and state
 */
function holderOf(wi: WorkItem, reviewItems: Map<string, WorkItem>): { session: string; state: HolderState } {
	if (wi.status === 'done_by_worker') {
		const reviewer = (typeof wi.metadata?.[WORK_ITEM_REVIEWER_KEY] === 'string' ? (wi.metadata[WORK_ITEM_REVIEWER_KEY] as string) : undefined)
			?? reviewItems.get(wi.id)?.target
			?? 'unassigned';
		return { session: reviewer, state: 'awaiting_review' };
	}
	const session = wi.target ?? 'unassigned';
	if (wi.status === 'running') return { session, state: 'working' };
	if (wi.status === 'blocked' || wi.status === 'escalated') return { session, state: 'blocked' };
	return { session, state: 'queued' };
}

/**
 * Compute where a request is now.
 *
 * Rules:
 * - finished request → no holders;
 * - each open WorkItem of the request (by `requestId` or `workItemIds`) is a
 *   holder: its `target` (running/queued/blocked) or, once the worker is done,
 *   its reviewer (awaiting_review). Review items themselves are folded in;
 * - a holder that handed the work to another agent with a plain message (an
 *   open ask newer than the holder's own start) is `waiting_on_agent`, and
 *   the asked agent is a holder too (followed up to {@link MAX_ASK_HOPS});
 * - no open WorkItem: the request's `assignee`/`ownerAgent` handles it, or the
 *   owner when the request waits on a confirmation or follow-up.
 *
 * @param request - The Request
 * @param workItems - WorkItems to search (the pool, or a subset)
 * @param openAsks - Open agent-to-agent asks (from the ledger)
 * @param now - Current time (epoch ms)
 * @returns The whereabouts
 *
 * @example
 * ```typescript
 * const w = computeWhereabouts(request, await pool.getAllItems(), ledger.openAsks(), Date.now());
 * w.summary; // "With Dex (working on "Replicate the video") for 2h 10m"
 * ```
 */
export function computeWhereabouts(request: Request, workItems: WorkItem[], openAsks: AgentAsk[], now: number): RequestWhereabouts {
	const base = {
		requestId: request.id,
		...(request.ticketNumber ? { ticketNumber: request.ticketNumber } : {}),
		title: request.title,
		status: request.status,
	};
	if (FINISHED_STATUSES.has(request.status)) {
		const at = request.completedAt ?? request.updatedAt;
		return { ...base, finished: true, finishedAt: at, holders: [], summary: `${request.status === 'done' ? 'Done' : 'Cancelled'}${at ? ` at ${at}` : ''}.` };
	}

	const linked = new Set(request.workItemIds ?? []);
	const mine = workItems.filter((wi) => wi.requestId === request.id || linked.has(wi.id));
	const reviewItems = new Map<string, WorkItem>();
	for (const wi of mine) {
		const of = wi.metadata?.['verifyOf'];
		if (wi.type === 'review' && typeof of === 'string') reviewItems.set(of, wi);
	}
	const holders: RequestHolder[] = [];
	const seen = new Set<string>();
	const add = (h: Omit<RequestHolder, 'forMs'>): void => {
		const key = `${h.session}|${h.workItemId ?? ''}|${h.state}`;
		if (seen.has(key)) return;
		seen.add(key);
		holders.push({ ...h, forMs: Math.max(0, now - Date.parse(h.since)) });
	};

	for (const wi of mine) {
		if (!OPEN_STATUSES.has(wi.status)) continue;
		// A review item is shown through the item it reviews.
		if (wi.type === 'review' && typeof wi.metadata?.['verifyOf'] === 'string' && mine.some((m) => m.id === wi.metadata?.['verifyOf'])) continue;
		const { session, state } = holderOf(wi, reviewItems);
		add({
			session,
			state,
			since: wi.statusChangedAt ?? wi.startedAt ?? wi.createdAt,
			workItemId: wi.id,
			what: wi.title,
			...(wi.blockedReason ? { blockedReason: wi.blockedReason } : {}),
		});
	}

	if (holders.length === 0) {
		if (OWNER_WAIT_STATUSES.has(request.status)) {
			add({ session: 'owner', state: 'waiting_on_owner', since: request.updatedAt, what: request.title });
		} else {
			const agent = request.assignee ?? request.ownerAgent;
			if (agent) add({ session: agent, state: 'handling', since: request.updatedAt, what: request.title });
		}
	}

	// Follow plain-message hand-offs: a holder that asked another agent after
	// it took the work is waiting on that agent.
	let frontier = holders.filter((h) => h.session !== 'owner').map((h) => ({ session: h.session, sinceMs: Date.parse(h.since) }));
	for (let hop = 0; hop < MAX_ASK_HOPS && frontier.length > 0; hop++) {
		const next: Array<{ session: string; sinceMs: number }> = [];
		for (const f of frontier) {
			const asks = openAsks.filter((a) => a.sender === f.session && a.deliveredAt >= f.sinceMs);
			if (asks.length === 0) continue;
			for (const h of holders) if (h.session === f.session && h.state !== 'awaiting_review') h.state = 'waiting_on_agent';
			for (const a of asks) {
				const since = new Date(a.deliveredAt).toISOString();
				add({ session: a.target, state: 'working', since, what: a.excerpt, from: a.sender });
				next.push({ session: a.target, sinceMs: a.deliveredAt });
			}
		}
		frontier = next;
	}

	holders.sort((a, b) => b.forMs - a.forMs);
	return { ...base, finished: false, holders, summary: summarize(holders) };
}

/**
 * One line for a person: where the request is, longest-held first.
 *
 * @param holders - Holders, sorted
 * @returns Summary text
 */
function summarize(holders: RequestHolder[]): string {
	const active = holders.filter((h) => h.state !== 'waiting_on_agent');
	if (active.length === 0) {
		return holders.length === 0 ? 'Nobody holds it: no open work item, no assignee.' : 'Handed on, but nobody is working on it.';
	}
	const phrase: Record<HolderState, string> = {
		working: 'working on',
		queued: 'queued:',
		blocked: 'blocked on',
		awaiting_review: 'reviewing',
		waiting_on_agent: 'waiting on another agent for',
		waiting_on_owner: 'waiting on you for',
		handling: 'handling',
	};
	return active
		.slice(0, 3)
		.map((h) => {
			const who = h.session === 'owner' ? 'You' : h.session;
			const what = h.what ? ` "${h.what.slice(0, 80)}"` : '';
			const via = h.from ? `, from ${h.from}` : '';
			return `${who} (${phrase[h.state]}${what}${via}) for ${formatDuration(h.forMs)}`;
		})
		.join('; ') + (active.length > 3 ? `; and ${active.length - 3} more` : '') + '.';
}
