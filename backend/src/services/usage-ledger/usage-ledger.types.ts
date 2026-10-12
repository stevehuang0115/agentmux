/**
 * Usage ledger types: the immutable facts behind per-ticket time and token
 * accounting (specs/2026-10-11-usage-ledger.md).
 *
 * A "unit" is one trace (a ticket, a request, a work item thread, an owner
 * conversation). Facts only ever get appended; every statistic (category,
 * team, owner minutes) is computed from them at report time.
 *
 * @module services/usage-ledger/usage-ledger.types
 */

/** Schema version written on every fact. */
export const LEDGER_VERSION = 1;

/**
 * How a fact was tied to its unit.
 * - `recorded`: the harness knew the unit when it happened.
 * - `inferred`: rebuilt afterwards from timestamps (history backfill).
 */
export type Attribution = 'recorded' | 'inferred';

/** Id of the pseudo-unit that holds an agent's usage while it worked on no ticket. */
export const UNTICKETED_PREFIX = '~none:';

/** Fields every fact carries. */
interface FactBase {
	v: typeof LEDGER_VERSION;
	/** ISO time of the thing that happened (the covered hour's start, for usage / busy) */
	ts: string;
}

/** What is known about a unit. Several of these merge field by field, first value wins. */
export interface UnitMetaFact extends FactBase {
	kind: 'unit.meta';
	unitId: string;
	/** `TKT-12` or a project ticket id (`CE-7`) */
	ticketId?: string;
	requestId?: string;
	/** What started the trace (`request`, `owner_message`, `ticket`, …) */
	rootKind?: string;
	title?: string;
	/** The owner's words / the ticket description, cut */
	excerpt?: string;
	team?: string;
	project?: string;
	/** Where the request came from (`slack-dm`, `chat`, …) */
	channel?: string;
	/** Conversation thread the request lives in (Slack thread ref) */
	threadRef?: string;
	/** When the unit began */
	openedAt?: string;
	attribution: Attribution;
}

/** An agent worked on a unit (written once per agent and unit). */
export interface UnitAgentFact extends FactBase {
	kind: 'unit.agent';
	unitId: string;
	agent: string;
	team?: string;
	project?: string;
	attribution: Attribution;
}

/** The unit reached a terminal status. */
export interface UnitClosedFact extends FactBase {
	kind: 'unit.closed';
	unitId: string;
	status: string;
	attribution: Attribution;
}

/**
 * Token usage of one agent on one unit within one hour (a delta: the sum of
 * the facts is the total). `share` is the fraction of the underlying events
 * this unit carries (1, or 1/n when the turn was about n tickets); token
 * fields are the raw event sums, before the share.
 */
export interface UsageFact extends FactBase {
	kind: 'usage';
	unitId: string;
	agent: string;
	team?: string;
	model: string;
	runtime?: string;
	events: number;
	share: number;
	/** Every input token, cached ones included (see eventTokens) */
	input: number;
	cachedInput: number;
	output: number;
	cacheWrite: number;
	/** Cost-weighted tokens (see eventTokens) */
	budget: number;
	/** Estimated USD at the model's rate (cache-aware) */
	costUsd: number;
	attribution: Attribution;
}

/** Agent busy time on one unit within one hour (a delta, like {@link UsageFact}). */
export interface BusyFact extends FactBase {
	kind: 'busy';
	unitId: string;
	agent: string;
	team?: string;
	turns: number;
	busyMs: number;
	share: number;
	attribution: Attribution;
}

/** The owner wrote to a unit (a message delivered to an agent on it). */
export interface OwnerMessageFact extends FactBase {
	kind: 'owner.message';
	unitId: string;
	attribution: Attribution;
}

/** Any ledger fact. */
export type LedgerFact = UnitMetaFact | UnitAgentFact | UnitClosedFact | UsageFact | BusyFact | OwnerMessageFact;

/** Where a fact is written. */
export type LedgerFile = 'live' | 'backfill';

/** One tokens + cost tally. */
export interface Tally {
	input: number;
	cachedInput: number;
	output: number;
	cacheWrite: number;
	/** Raw total: input (cached included) + output */
	total: number;
	/** Cost-weighted total */
	budget: number;
	costUsd: number;
}

/** A zeroed {@link Tally}. */
export function emptyTally(): Tally {
	return { input: 0, cachedInput: 0, output: 0, cacheWrite: 0, total: 0, budget: 0, costUsd: 0 };
}
