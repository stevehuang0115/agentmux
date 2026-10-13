/**
 * One-time rebuild of the ledger for the time before it existed.
 *
 * Sources: the token ledger (usage events) and the run traces (ticket roots,
 * deliveries, busy turns, status changes). The traces expire after 90 days,
 * the ledger does not, so this keeps what they know.
 *
 * Attribution of a usage event:
 * - it already carries a trace id (the harness stamped it): `recorded`;
 * - otherwise it goes to the trace the session's latest delivery named,
 *   when that delivery was at most {@link INFER_MAX_GAP_MS} before the event:
 *   `inferred`;
 * - otherwise it lands in the agent's "(no ticket)" unit.
 *
 * Only facts older than the cutoff (the moment live recording began) are
 * written, so history and live facts never overlap. The result goes to
 * `backfill.jsonl`; the run is recorded in `state.json` and never repeats.
 *
 * @module services/usage-ledger/usage-ledger.backfill
 */

import { createReadStream, promises as fs } from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { TRACE_CONSTANTS } from '../../constants.js';
import { atomicWriteJson } from '../../utils/file-io.utils.js';
import { eventCostUsd, eventTokens, type TokenUsageEvent } from '../monitoring/token-usage.service.js';
import type { TraceEvent, TraceIndexFile } from '../trace/trace.types.js';
import { cleanText, cut, EXCERPT_MAX, titleFromSummary } from './excerpt.js';
import type { TeamLookup } from './team-directory.js';
import type { UsageLedgerStore } from './usage-ledger.store.js';
import { LEDGER_VERSION, UNTICKETED_PREFIX, type Attribution, type BusyFact, type LedgerFact, type UsageFact } from './usage-ledger.types.js';

/** An unticketed event this soon after a delivery is credited to the delivery's trace. */
export const INFER_MAX_GAP_MS = TRACE_CONSTANTS.IDLE_CLEAR_MS;

/** File with the ledger's own bookkeeping. */
export const STATE_FILE = 'state.json';

/** Bookkeeping persisted beside the facts. */
export interface LedgerState {
	/** When live recording began (the backfill cutoff) */
	liveSince?: string;
	backfill?: { doneAt: string; cutoff: string; facts: number; usageEvents: number; inferredEvents: number };
}

/** Where history comes from. */
export interface BackfillSources {
	/** Usage events of every session */
	forEachUsage: (visit: (session: string, event: TokenUsageEvent) => void) => void;
	/** The traces directory (index.json + `<id>.jsonl`) */
	traceDir: string;
	directory: TeamLookup;
}

/** What a backfill did. */
export interface BackfillResult {
	ran: boolean;
	reason?: string;
	facts: number;
	usageEvents: number;
	inferredEvents: number;
	traces: number;
}

/**
 * Read the ledger bookkeeping.
 *
 * @param dir - Ledger directory
 * @returns State (empty when none)
 */
export async function readLedgerState(dir: string): Promise<LedgerState> {
	try {
		return JSON.parse(await fs.readFile(path.join(dir, STATE_FILE), 'utf-8')) as LedgerState;
	} catch {
		return {};
	}
}

/**
 * Write the ledger bookkeeping.
 *
 * @param dir - Ledger directory
 * @param state - State
 */
export async function writeLedgerState(dir: string, state: LedgerState): Promise<void> {
	await fs.mkdir(dir, { recursive: true });
	await atomicWriteJson(path.join(dir, STATE_FILE), state);
}

/**
 * Note when live recording began (once).
 *
 * @param dir - Ledger directory
 * @param now - Now (ms)
 * @returns The cutoff
 */
export async function ensureLiveSince(dir: string, now: number = Date.now()): Promise<string> {
	const state = await readLedgerState(dir);
	if (state.liveSince) return state.liveSince;
	const liveSince = new Date(now).toISOString();
	await writeLedgerState(dir, { ...state, liveSince });
	return liveSince;
}

const hourOf = (ms: number): string => new Date(Math.floor(ms / 3_600_000) * 3_600_000).toISOString();

/** Stream the lines of a file. */
async function* lines(file: string): AsyncGenerator<string> {
	const rl = readline.createInterface({ input: createReadStream(file, { encoding: 'utf-8' }), crlfDelay: Infinity });
	for await (const line of rl) yield line;
}

/**
 * Rebuild history into `backfill.jsonl`.
 *
 * @param store - Ledger store
 * @param sources - Where history comes from
 * @param opts.cutoffMs - Only facts before this time are written
 * @returns What happened
 */
export async function runBackfill(store: UsageLedgerStore, sources: BackfillSources, opts: { cutoffMs: number }): Promise<BackfillResult> {
	const state = await readLedgerState(store.dir);
	if (state.backfill) return { ran: false, reason: `already done at ${state.backfill.doneAt}`, facts: 0, usageEvents: 0, inferredEvents: 0, traces: 0 };
	const cutoff = opts.cutoffMs;
	const facts: LedgerFact[] = [];
	const push = (f: LedgerFact): void => {
		facts.push(f);
	};

	// ---- traces ----
	let index: TraceIndexFile | null = null;
	try {
		index = JSON.parse(await fs.readFile(path.join(sources.traceDir, TRACE_CONSTANTS.INDEX_FILE), 'utf-8')) as TraceIndexFile;
	} catch {
		index = null;
	}
	const traces = index?.traces ?? {};
	const known = new Set(Object.keys(traces));
	/** session → deliveries (ms, trace), sorted later */
	const deliveries = new Map<string, Array<{ at: number; traceId: string }>>();
	/** `session|ts` → traces that recorded the same busy turn */
	const busyOwners = new Map<string, string[]>();
	const busyEvents: Array<{ traceId: string; session: string; at: number; busyMs: number }> = [];
	const seenAgents = new Set<string>();
	const lastOwner = new Map<string, number>();

	for (const [traceId, entry] of Object.entries(traces)) {
		const created = Date.parse(entry.root.createdAt);
		if (created >= cutoff) continue;
		const root = entry.root;
		push({
			v: LEDGER_VERSION,
			ts: root.createdAt,
			kind: 'unit.meta',
			unitId: traceId,
			...(root.refs.ticketId ? { ticketId: root.refs.ticketId } : {}),
			...(root.refs.requestId ? { requestId: root.refs.requestId } : {}),
			rootKind: root.kind,
			openedAt: root.createdAt,
			title: titleFromSummary(root.summary),
			excerpt: cut(cleanText(root.summary), EXCERPT_MAX),
			attribution: 'recorded',
		});
		const file = path.join(sources.traceDir, `${traceId}.jsonl`);
		try {
			await fs.access(file);
		} catch {
			continue;
		}
		for await (const line of lines(file)) {
			let event: TraceEvent;
			try {
				event = JSON.parse(line) as TraceEvent;
			} catch {
				continue;
			}
			const at = Date.parse(event.ts);
			if (!Number.isFinite(at) || at >= cutoff) continue;
			const session = event.refs?.session ?? event.actor?.session;
			if (event.type === 'turn.delivered') {
				if (session) {
					const list = deliveries.get(session) ?? [];
					list.push({ at, traceId });
					deliveries.set(session, list);
					const key = `${traceId}|${session}`;
					if (!seenAgents.has(key)) {
						seenAgents.add(key);
						const info = sources.directory.lookup(session);
						push({
							v: LEDGER_VERSION,
							ts: event.ts,
							kind: 'unit.agent',
							unitId: traceId,
							agent: session,
							...(info?.team ? { team: info.team } : {}),
							...(info?.project ? { project: info.project } : {}),
							attribution: 'recorded',
						});
					}
				}
				if (event.actor?.kind === 'owner' && event.data?.kind === 'owner_message') {
					const last = lastOwner.get(traceId);
					if (last === undefined || Math.abs(at - last) >= 2_000) {
						lastOwner.set(traceId, at);
						push({ v: LEDGER_VERSION, ts: event.ts, kind: 'owner.message', unitId: traceId, attribution: 'recorded' });
					}
				}
			} else if (event.type === 'turn.ended') {
				const busyMs = Number(event.data?.busyMs);
				if (session && Number.isFinite(busyMs) && busyMs > 0) {
					busyEvents.push({ traceId, session, at, busyMs });
					const key = `${session}|${event.ts}`;
					busyOwners.set(key, [...(busyOwners.get(key) ?? []), traceId]);
				}
			} else if (event.type === 'request.status' || event.type === 'ticket.status') {
				const to = typeof event.data?.to === 'string' ? event.data.to : '';
				const projectId = typeof event.data?.projectId === 'string' ? event.data.projectId : '';
				const project = projectId ? sources.directory.projectName(projectId) : undefined;
				if (project) push({ v: LEDGER_VERSION, ts: event.ts, kind: 'unit.meta', unitId: traceId, project, attribution: 'recorded' });
				if (to === 'done' || to === 'cancelled') push({ v: LEDGER_VERSION, ts: event.ts, kind: 'unit.closed', unitId: traceId, status: to, attribution: 'recorded' });
			}
		}
	}
	for (const list of deliveries.values()) list.sort((a, b) => a.at - b.at);

	// ---- busy time ----
	const busy = new Map<string, BusyFact>();
	for (const b of busyEvents) {
		const share = 1 / (busyOwners.get(`${b.session}|${new Date(b.at).toISOString()}`)?.length ?? 1);
		const hour = hourOf(b.at);
		const key = [b.traceId, b.session, hour, share].join('|');
		const info = sources.directory.lookup(b.session);
		const fact =
			busy.get(key) ??
			({ v: LEDGER_VERSION, ts: hour, kind: 'busy', unitId: b.traceId, agent: b.session, ...(info?.team ? { team: info.team } : {}), turns: 0, busyMs: 0, share, attribution: 'recorded' } satisfies BusyFact);
		fact.turns += 1;
		fact.busyMs += b.busyMs;
		busy.set(key, fact);
	}
	facts.push(...busy.values());

	// ---- usage ----
	const usage = new Map<string, UsageFact>();
	const noticket = new Set<string>();
	let usageEvents = 0;
	let inferredEvents = 0;
	sources.forEachUsage((session, event) => {
		const at = Date.parse(event.timestamp);
		if (!Number.isFinite(at) || at >= cutoff) return;
		usageEvents += 1;
		let unitId: string;
		let attribution: Attribution = 'recorded';
		if (event.traceId && known.has(event.traceId)) {
			unitId = event.traceId;
		} else {
			const list = deliveries.get(session) ?? [];
			let found: { at: number; traceId: string } | undefined;
			for (let i = list.length - 1; i >= 0; i--) {
				if (list[i].at <= at) {
					found = list[i];
					break;
				}
			}
			if (found && at - found.at <= INFER_MAX_GAP_MS) {
				unitId = found.traceId;
				attribution = 'inferred';
				inferredEvents += 1;
			} else {
				unitId = `${UNTICKETED_PREFIX}${session}`;
			}
		}
		if (unitId.startsWith(UNTICKETED_PREFIX) && !noticket.has(unitId)) {
			noticket.add(unitId);
			push({ v: LEDGER_VERSION, ts: new Date(at).toISOString(), kind: 'unit.meta', unitId, rootKind: 'none', title: `(no ticket) ${session}`, attribution: 'inferred' });
		}
		const hour = hourOf(at);
		const key = [unitId, session, event.model, hour, attribution].join('|');
		const info = sources.directory.lookup(session);
		const tokens = eventTokens(event);
		const fact =
			usage.get(key) ??
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
				share: 1,
				input: 0,
				cachedInput: 0,
				output: 0,
				cacheWrite: 0,
				budget: 0,
				costUsd: 0,
				attribution,
			} satisfies UsageFact);
		fact.events += 1;
		fact.input += tokens.input;
		fact.cachedInput += tokens.cachedInput;
		fact.output += tokens.output;
		fact.cacheWrite += tokens.cacheWrite;
		fact.budget += tokens.budget;
		fact.costUsd += eventCostUsd(event);
		usage.set(key, fact);
	});
	facts.push(...usage.values());

	for (let i = 0; i < facts.length; i += 5000) store.appendMany(facts.slice(i, i + 5000), 'backfill');
	await store.flush();
	await writeLedgerState(store.dir, {
		...(await readLedgerState(store.dir)),
		backfill: { doneAt: new Date().toISOString(), cutoff: new Date(cutoff).toISOString(), facts: facts.length, usageEvents, inferredEvents },
	});
	return { ran: true, facts: facts.length, usageEvents, inferredEvents, traces: Object.keys(traces).length };
}
