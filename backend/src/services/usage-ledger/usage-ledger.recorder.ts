/**
 * Writes the usage ledger as work happens.
 *
 * Attribution comes from the trace context (which ticket an agent's turn is
 * about, set when the harness delivers a message). The recorder listens to
 * trace events and to token-usage events and appends facts; usage and busy
 * time are summed per (unit, agent, model, hour) in memory and written as one
 * delta fact per bucket on a timer, so the ledger stays small.
 *
 * Rules (specs/2026-10-11-usage-ledger.md):
 * - A usage event belongs to the ticket(s) the agent's turn was about at the
 *   event's time. One ticket: all of it. A delivery naming n tickets: 1/n
 *   each. No ticket: a per-agent "(no ticket)" unit.
 * - Busy time is recorded when a turn ends, in the ticket the turn started on
 *   and the one it is on now, split evenly.
 * - Owner messages delivered to an agent on a ticket are owner-message facts;
 *   active spans are computed from them at report time.
 *
 * @module services/usage-ledger/usage-ledger.recorder
 */

import { eventCostUsd, eventTokens, type TokenUsageEvent } from '../monitoring/token-usage.service.js';
import { getTraceContext, type TraceContext } from '../trace/trace-context.service.js';
import type { TraceEvent } from '../trace/trace.types.js';
import { setRequestObserver, setUsageObserver, type RequestMeta } from './ledger-hooks.js';
import { cleanText, cut, EXCERPT_MAX, TITLE_MAX, titleFromSummary } from './excerpt.js';
import type { TeamLookup } from './team-directory.js';
import type { UsageLedgerStore } from './usage-ledger.store.js';
import {
	LEDGER_VERSION,
	UNTICKETED_PREFIX,
	type BusyFact,
	type LedgerFact,
	type UsageFact,
} from './usage-ledger.types.js';

/** Statuses that close a ticket / request. */
const TERMINAL_STATUSES: ReadonlySet<string> = new Set(['done', 'cancelled']);

/** Owner messages closer than this on one unit are the same message delivered twice. */
const OWNER_DEDUPE_MS = 2_000;

/** Default flush interval of the in-memory buckets. */
const FLUSH_INTERVAL_MS = 60_000;

/** Dependencies of the recorder. */
export interface RecorderDeps {
	store: UsageLedgerStore;
	directory: TeamLookup;
	/** Trace context accessor (default: the process-wide one) */
	context?: () => TraceContext;
	now?: () => number;
	flushIntervalMs?: number;
}

/**
 * Start of the UTC hour of a time.
 *
 * @param ms - Epoch ms
 * @returns ISO string of the hour start
 */
export function hourStart(ms: number): string {
	return new Date(Math.floor(ms / 3_600_000) * 3_600_000).toISOString();
}

/**
 * Appends ledger facts from live events.
 */
export class UsageLedgerRecorder {
	private readonly context: () => TraceContext;
	private readonly now: () => number;
	private readonly opened = new Set<string>();
	private readonly agentsSeen = new Set<string>();
	private readonly closed = new Set<string>();
	private readonly lastOwner = new Map<string, number>();
	private readonly usage = new Map<string, UsageFact>();
	private readonly busy = new Map<string, BusyFact>();
	private detach: (() => void) | null = null;
	private timer: NodeJS.Timeout | null = null;

	constructor(private readonly deps: RecorderDeps) {
		this.context = deps.context ?? getTraceContext;
		this.now = deps.now ?? (() => Date.now());
	}

	/**
	 * Start listening (trace events, usage events, new requests) and flushing.
	 */
	start(): void {
		if (this.detach) return;
		const removeListener = this.context().addListener((event, meta) => this.onTraceEvent(event, meta.share));
		setUsageObserver((session, event) => this.noteUsage(session, event));
		setRequestObserver((meta) => this.noteRequest(meta));
		this.detach = () => {
			removeListener();
			setUsageObserver(null);
			setRequestObserver(null);
		};
		this.timer = setInterval(() => void this.flush(), this.deps.flushIntervalMs ?? FLUSH_INTERVAL_MS);
		this.timer.unref?.();
	}

	/**
	 * Stop listening and write what is buffered.
	 */
	async stop(): Promise<void> {
		this.detach?.();
		this.detach = null;
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
		await this.flush();
	}

	/**
	 * Write the buffered usage / busy buckets and wait for the files.
	 */
	async flush(): Promise<void> {
		const facts: LedgerFact[] = [...this.usage.values(), ...this.busy.values()];
		this.usage.clear();
		this.busy.clear();
		this.deps.store.appendMany(facts);
		await this.deps.store.flush();
	}

	/**
	 * A token-usage event was recorded: attribute it to the ticket(s) its
	 * session was working on at that time.
	 *
	 * @param session - Agent session
	 * @param event - The usage event
	 */
	noteUsage(session: string, event: TokenUsageEvent): void {
		const at = Date.parse(event.timestamp);
		const when = Number.isFinite(at) ? at : this.now();
		const ctx = this.context();
		let units = ctx.tracesAt(session, when);
		if (event.traceId && units[0] !== event.traceId) units = [event.traceId];
		if (units.length === 0) units = [`${UNTICKETED_PREFIX}${session}`];
		const share = 1 / units.length;
		const tokens = eventTokens(event);
		const costUsd = eventCostUsd(event);
		const info = this.deps.directory.lookup(session);
		const hour = hourStart(when);
		for (const unitId of units) {
			this.ensureUnit(unitId, when);
			this.noteAgent(unitId, session, when);
			const key = [unitId, session, event.model, hour, share].join('|');
			const fact =
				this.usage.get(key) ??
				({
					v: LEDGER_VERSION,
					ts: hour,
					kind: 'usage',
					unitId,
					agent: session,
					...(info?.team ? { team: info.team } : {}),
					model: event.model,
					...(event.runtime ? { runtime: event.runtime } : {}),
					events: 0,
					share,
					input: 0,
					cachedInput: 0,
					output: 0,
					cacheWrite: 0,
					budget: 0,
					costUsd: 0,
					attribution: 'recorded',
				} satisfies UsageFact);
			fact.events += 1;
			fact.input += tokens.input;
			fact.cachedInput += tokens.cachedInput;
			fact.output += tokens.output;
			fact.cacheWrite += tokens.cacheWrite;
			fact.budget += tokens.budget;
			fact.costUsd += costUsd;
			this.usage.set(key, fact);
		}
	}

	/**
	 * A request got its trace: record what the ticket is about.
	 *
	 * @param meta - Request facts
	 */
	noteRequest(meta: RequestMeta): void {
		this.ensureUnit(meta.traceId);
		this.deps.store.append({
			v: LEDGER_VERSION,
			ts: meta.createdAt ?? new Date(this.now()).toISOString(),
			kind: 'unit.meta',
			unitId: meta.traceId,
			...(meta.ticketId ? { ticketId: meta.ticketId } : {}),
			requestId: meta.requestId,
			title: cut(cleanText(meta.title), TITLE_MAX),
			...(meta.description ? { excerpt: cut(cleanText(meta.description), EXCERPT_MAX) } : {}),
			...(meta.channel ? { channel: meta.channel } : {}),
			...(meta.threadRef ? { threadRef: meta.threadRef } : {}),
			attribution: 'recorded',
		});
	}

	/**
	 * Fold one trace event into facts.
	 *
	 * @param event - The trace event
	 * @param share - Fraction of a shared fact this trace carries
	 */
	onTraceEvent(event: TraceEvent, share: number): void {
		const unitId = event.traceId;
		const at = Date.parse(event.ts);
		const when = Number.isFinite(at) ? at : this.now();
		switch (event.type) {
			case 'turn.delivered': {
				this.ensureUnit(unitId, when);
				if (event.refs.session) this.noteAgent(unitId, event.refs.session, when);
				if (event.actor.kind === 'owner' && event.data?.kind === 'owner_message') this.noteOwnerMessage(unitId, when);
				break;
			}
			case 'turn.ended': {
				const busyMs = Number(event.data?.busyMs);
				const session = event.refs.session ?? event.actor.session;
				if (!session || !Number.isFinite(busyMs) || busyMs <= 0) break;
				this.ensureUnit(unitId, when);
				this.noteAgent(unitId, session, when);
				this.addBusy(unitId, session, when, busyMs, share);
				break;
			}
			case 'request.status':
			case 'ticket.status': {
				const to = typeof event.data?.to === 'string' ? event.data.to : '';
				this.ensureUnit(unitId, when);
				const projectId = typeof event.data?.projectId === 'string' ? event.data.projectId : '';
				const project = projectId ? this.deps.directory.projectName(projectId) : undefined;
				if (project) {
					this.deps.store.append({ v: LEDGER_VERSION, ts: event.ts, kind: 'unit.meta', unitId, project, attribution: 'recorded' });
				}
				if (TERMINAL_STATUSES.has(to)) {
					const key = `${unitId}|${to}`;
					if (!this.closed.has(key)) {
						this.closed.add(key);
						this.deps.store.append({ v: LEDGER_VERSION, ts: event.ts, kind: 'unit.closed', unitId, status: to, attribution: 'recorded' });
					}
				}
				break;
			}
			default:
				break;
		}
	}

	private addBusy(unitId: string, agent: string, when: number, busyMs: number, share: number): void {
		const hour = hourStart(when);
		const key = [unitId, agent, hour, share].join('|');
		const info = this.deps.directory.lookup(agent);
		const fact =
			this.busy.get(key) ??
			({
				v: LEDGER_VERSION,
				ts: hour,
				kind: 'busy',
				unitId,
				agent,
				...(info?.team ? { team: info.team } : {}),
				turns: 0,
				busyMs: 0,
				share,
				attribution: 'recorded',
			} satisfies BusyFact);
		fact.turns += 1;
		fact.busyMs += busyMs;
		this.busy.set(key, fact);
	}

	private noteOwnerMessage(unitId: string, when: number): void {
		const last = this.lastOwner.get(unitId);
		if (last !== undefined && Math.abs(when - last) < OWNER_DEDUPE_MS) return;
		this.lastOwner.set(unitId, when);
		this.deps.store.append({ v: LEDGER_VERSION, ts: new Date(when).toISOString(), kind: 'owner.message', unitId, attribution: 'recorded' });
	}

	private noteAgent(unitId: string, agent: string, when: number): void {
		const key = `${unitId}|${agent}`;
		if (this.agentsSeen.has(key)) return;
		this.agentsSeen.add(key);
		const info = this.deps.directory.lookup(agent);
		this.deps.store.append({
			v: LEDGER_VERSION,
			ts: new Date(when).toISOString(),
			kind: 'unit.agent',
			unitId,
			agent,
			...(info?.team ? { team: info.team } : {}),
			...(info?.project ? { project: info.project } : {}),
			attribution: 'recorded',
		});
	}

	/**
	 * Write a unit's descriptive fact the first time the unit is seen (this
	 * process): ticket id, title, excerpt, kind, start. Later facts (the
	 * request's description, thread, project) fill the gaps.
	 */
	private ensureUnit(unitId: string, when: number = this.now()): void {
		if (this.opened.has(unitId)) return;
		this.opened.add(unitId);
		const ts = new Date(when).toISOString();
		if (unitId.startsWith(UNTICKETED_PREFIX)) {
			this.deps.store.append({
				v: LEDGER_VERSION,
				ts,
				kind: 'unit.meta',
				unitId,
				rootKind: 'none',
				title: `(no ticket) ${unitId.slice(UNTICKETED_PREFIX.length)}`,
				attribution: 'recorded',
			});
			return;
		}
		let root: { kind: string; summary: string; createdAt: string; refs: { ticketId?: string; requestId?: string } } | undefined;
		try {
			root = this.context().store.getEntry(unitId)?.root;
		} catch {
			root = undefined;
		}
		const clean = root ? cleanText(root.summary) : '';
		this.deps.store.append({
			v: LEDGER_VERSION,
			ts,
			kind: 'unit.meta',
			unitId,
			...(root?.refs.ticketId ? { ticketId: root.refs.ticketId } : {}),
			...(root?.refs.requestId ? { requestId: root.refs.requestId } : {}),
			...(root ? { rootKind: root.kind, openedAt: root.createdAt } : {}),
			...(root ? { title: titleFromSummary(root.summary), excerpt: cut(clean, EXCERPT_MAX) } : {}),
			attribution: 'recorded',
		});
	}
}
