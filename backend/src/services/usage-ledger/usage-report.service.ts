/**
 * Usage report: where the owner's time and the agents' tokens went, per
 * category / team / project / agent / ticket.
 *
 * Everything is computed from the ledger facts at call time. Categories are
 * applied here (see {@link UnitClassifier}) and never stored in the facts.
 * Owner minutes follow the span heuristic of owner-spans.ts. Figures are
 * summed per UTC hour, so a window edge is accurate to the hour.
 *
 * @module services/usage-ledger/usage-report.service
 */

import { compactTokens } from '../usage/token-format.js';
import type { LedgerRollup, UnitRollup } from './ledger-rollup.js';
import { buildOwnerSpans, ownerMinutesByUnit, type OwnerSpan } from './owner-spans.js';
import type { TeamLookup } from './team-directory.js';
import { categorySetId, type CategoryDef } from './usage-categories.store.js';
import { NO_TICKET_CATEGORY, OTHER_CATEGORY, UnitClassifier, type ClassifiableUnit } from './unit-classifier.js';
import { emptyTally, type Tally } from './usage-ledger.types.js';

/** Ways to group a report. */
export const REPORT_DIMENSIONS = ['category', 'team', 'project', 'agent', 'ticket'] as const;
/** A grouping. */
export type ReportDimension = (typeof REPORT_DIMENSIONS)[number];

/** Request for a report. */
export interface ReportQuery {
	/** Window start (ms) */
	sinceMs: number;
	/** Window end (ms) */
	untilMs: number;
	by: ReportDimension;
	/** Categories to use instead of the stored ones (ad hoc) */
	categories?: CategoryDef[];
	/** Keep only these groups (by name), e.g. two categories to compare */
	only?: string[];
	/** Groups returned (default 50) */
	limit?: number;
}

/** One ticket in a group. */
export interface TicketLine {
	unitId: string;
	ticketId?: string;
	title: string;
	team?: string;
	ownerMinutes: number;
	agentBusyMinutes: number;
	tokens: number;
	costUsd: number;
	inferred: boolean;
}

/** One group of a report. */
export interface ReportGroup {
	key: string;
	ownerMinutes: number;
	agentBusyMinutes: number;
	/** Token figures: `budget` is the cost-weighted headline, `total` the raw sum */
	tokens: Tally;
	costUsd: number;
	ticketCount: number;
	topTickets: TicketLine[];
}

/** A report. */
export interface UsageReport {
	window: { since: string; until: string };
	by: ReportDimension;
	categories: { setId: string; source: 'stored' | 'ad-hoc' | 'default'; names: string[]; llmClassified: number; unclassified: number } | null;
	totals: Omit<ReportGroup, 'key' | 'topTickets'>;
	groups: ReportGroup[];
	/** Voice / Slack friendly text */
	summary: string;
	notes: string[];
}

/** Where the report gets its inputs. */
export interface ReportDeps {
	rollup: LedgerRollup;
	directory: TeamLookup;
	classifier: UnitClassifier;
	/** Stored category definitions */
	categories: () => Promise<CategoryDef[]>;
	/** Called before reading so buffered facts are on disk and in the rollup */
	sync: () => Promise<void>;
	now?: () => number;
}

const HOUR_MS = 3_600_000;

/** Slice of a unit that lands in one group. */
interface Slice {
	tally: Tally;
	busyMs: number;
	ownerMinutes: number;
}

/**
 * Parse a window start.
 *
 * @param value - `7d`, `24h`, `2w`, `90m`, or an ISO date / time
 * @param nowMs - Now (ms)
 * @returns Epoch ms, or null when unreadable
 */
export function parseSince(value: string, nowMs: number): number | null {
	const rel = /^(\d+(?:\.\d+)?)\s*([mhdw])$/i.exec(value.trim());
	if (rel) {
		const unit = { m: 60_000, h: HOUR_MS, d: 24 * HOUR_MS, w: 7 * 24 * HOUR_MS }[rel[2].toLowerCase() as 'm' | 'h' | 'd' | 'w'];
		return nowMs - Number(rel[1]) * unit;
	}
	const abs = Date.parse(value);
	return Number.isFinite(abs) ? abs : null;
}

/**
 * Format minutes for speech: `45m`, `2h10m`, `1d3h`.
 *
 * @param minutes - Minutes
 * @returns Short text
 */
export function formatMinutes(minutes: number): string {
	const m = Math.round(minutes);
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	if (h < 24) return m % 60 ? `${h}h${m % 60}m` : `${h}h`;
	return h % 24 ? `${Math.floor(h / 24)}d${h % 24}h` : `${Math.floor(h / 24)}d`;
}

/** Add `weight` times a usage entry to a tally. */
function addUsage(t: Tally, e: UnitRollup['usage'][number]): void {
	const w = e.share;
	t.input += e.input * w;
	t.cachedInput += e.cachedInput * w;
	t.output += e.output * w;
	t.cacheWrite += e.cacheWrite * w;
	t.total += (e.input + e.output) * w;
	t.budget += e.budget * w;
	t.costUsd += e.costUsd * w;
}

function addTally(into: Tally, from: Tally): void {
	into.input += from.input;
	into.cachedInput += from.cachedInput;
	into.output += from.output;
	into.cacheWrite += from.cacheWrite;
	into.total += from.total;
	into.budget += from.budget;
	into.costUsd += from.costUsd;
}

function roundTally(t: Tally): Tally {
	return {
		input: Math.round(t.input),
		cachedInput: Math.round(t.cachedInput),
		output: Math.round(t.output),
		cacheWrite: Math.round(t.cacheWrite),
		total: Math.round(t.total),
		budget: Math.round(t.budget),
		costUsd: Math.round(t.costUsd * 10_000) / 10_000,
	};
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Builds reports from the ledger.
 */
export class UsageReportService {
	constructor(private readonly deps: ReportDeps) {}

	/**
	 * Compute a report.
	 *
	 * @param query - Window, grouping, optional ad-hoc categories
	 * @returns The report
	 */
	async report(query: ReportQuery): Promise<UsageReport> {
		await this.deps.sync();
		await this.deps.directory.ready();
		const { rollup } = this.deps;
		const from = query.sinceMs;
		const to = query.untilMs;

		// Owner minutes across every ticket (overlaps are shared, so all spans are needed)
		const spans: OwnerSpan[] = [];
		for (const u of rollup.units.values()) {
			if (u.ownerMessages.length > 0) spans.push(...buildOwnerSpans(u.unitId, u.ownerMessages));
		}
		const ownerMinutes = ownerMinutesByUnit(spans, from, to);

		// Per-unit windowed figures
		interface UnitWindow {
			unit: UnitRollup;
			tally: Tally;
			busyMs: number;
			owner: number;
			byAgent: Map<string, Slice>;
			byTeam: Map<string, Slice>;
			/** The team the ticket is credited to */
			team?: string;
		}
		const windows: UnitWindow[] = [];
		for (const unit of rollup.units.values()) {
			const w: UnitWindow = { unit, tally: emptyTally(), busyMs: 0, owner: ownerMinutes.get(unit.unitId) ?? 0, byAgent: new Map(), byTeam: new Map() };
			const slice = (m: Map<string, Slice>, key: string): Slice => {
				let s = m.get(key);
				if (!s) {
					s = { tally: emptyTally(), busyMs: 0, ownerMinutes: 0 };
					m.set(key, s);
				}
				return s;
			};
			for (const e of unit.usage) {
				if (e.hourMs + HOUR_MS <= from || e.hourMs >= to) continue;
				addUsage(w.tally, e);
				const one = emptyTally();
				addUsage(one, e);
				addTally(slice(w.byAgent, e.agent).tally, one);
				addTally(slice(w.byTeam, this.teamOf(e.team, e.agent) ?? '(unknown team)').tally, one);
			}
			for (const e of unit.busy) {
				if (e.hourMs + HOUR_MS <= from || e.hourMs >= to) continue;
				const ms = e.busyMs * e.share;
				w.busyMs += ms;
				slice(w.byAgent, e.agent).busyMs += ms;
				slice(w.byTeam, this.teamOf(e.team, e.agent) ?? '(unknown team)').busyMs += ms;
			}
			if (w.tally.total === 0 && w.busyMs === 0 && w.owner === 0) continue;
			w.team = this.primaryTeam(unit, w.byTeam);
			windows.push(w);
		}

		// Categories
		let categoryInfo: UsageReport['categories'] = null;
		let categoryOf = new Map<string, string>();
		if (query.by === 'category') {
			const stored = await this.deps.categories();
			const defs = query.categories ?? stored;
			const source = query.categories ? 'ad-hoc' : stored.length > 0 ? 'stored' : 'default';
			const units: ClassifiableUnit[] = windows
				.filter((w) => !w.unit.synthetic)
				.map((w) => ({
					unitId: w.unit.unitId,
					ticketId: w.unit.ticketId,
					title: w.unit.title,
					excerpt: w.unit.excerpt,
					team: w.team,
					project: this.projectOf(w.unit),
				}));
			const result = await this.deps.classifier.classify(units, defs);
			categoryOf = result.categories;
			categoryInfo = { setId: categorySetId(defs), source, names: defs.map((d) => d.name), llmClassified: result.llmClassified, unclassified: result.unclassified };
		}

		// Group
		interface Acc {
			key: string;
			slices: Map<string, Slice>;
		}
		const groups = new Map<string, Acc>();
		const add = (key: string, unitId: string, tally: Tally, busyMs: number, owner: number): void => {
			let g = groups.get(key);
			if (!g) {
				g = { key, slices: new Map() };
				groups.set(key, g);
			}
			let s = g.slices.get(unitId);
			if (!s) {
				s = { tally: emptyTally(), busyMs: 0, ownerMinutes: 0 };
				g.slices.set(unitId, s);
			}
			addTally(s.tally, tally);
			s.busyMs += busyMs;
			s.ownerMinutes += owner;
		};
		for (const w of windows) {
			const u = w.unit;
			switch (query.by) {
				case 'ticket':
					add(this.labelOf(u), u.unitId, w.tally, w.busyMs, w.owner);
					break;
				case 'category':
					add(u.synthetic ? NO_TICKET_CATEGORY : (categoryOf.get(u.unitId) ?? OTHER_CATEGORY), u.unitId, w.tally, w.busyMs, w.owner);
					break;
				case 'project':
					add(this.projectOf(u) ?? '(no project)', u.unitId, w.tally, w.busyMs, w.owner);
					break;
				case 'team': {
					const primary = w.team ?? '(unknown team)';
					if (w.byTeam.size === 0) add(primary, u.unitId, w.tally, w.busyMs, w.owner);
					for (const [team, s] of w.byTeam) add(team, u.unitId, s.tally, s.busyMs, team === primary ? w.owner : 0);
					if (w.byTeam.size > 0 && !w.byTeam.has(primary) && w.owner > 0) add(primary, u.unitId, emptyTally(), 0, w.owner);
					break;
				}
				case 'agent':
					for (const [agent, s] of w.byAgent) add(agent, u.unitId, s.tally, s.busyMs, 0);
					break;
			}
		}

		const teamOfUnit = new Map(windows.map((w) => [w.unit.unitId, w.team]));
		const lineOf = (unitId: string, s: Slice): TicketLine => {
			const u = rollup.units.get(unitId) as UnitRollup;
			return {
				unitId,
				...(u.ticketId ? { ticketId: u.ticketId } : {}),
				title: u.title || u.ticketId || unitId,
				...(teamOfUnit.get(unitId) ? { team: teamOfUnit.get(unitId) } : {}),
				ownerMinutes: round1(s.ownerMinutes),
				agentBusyMinutes: round1(s.busyMs / 60_000),
				tokens: Math.round(s.tally.budget),
				costUsd: Math.round(s.tally.costUsd * 10_000) / 10_000,
				inferred: u.inferred,
			};
		};

		let out: ReportGroup[] = [...groups.values()].map((g) => {
			const tally = emptyTally();
			let busyMs = 0;
			let owner = 0;
			let tickets = 0;
			for (const [unitId, s] of g.slices) {
				addTally(tally, s.tally);
				busyMs += s.busyMs;
				owner += s.ownerMinutes;
				if (!(rollup.units.get(unitId)?.synthetic ?? false)) tickets += 1;
			}
			const top = [...g.slices.entries()]
				.filter(([id]) => !(rollup.units.get(id)?.synthetic ?? false))
				.sort((a, b) => b[1].tally.costUsd - a[1].tally.costUsd || b[1].busyMs - a[1].busyMs)
				.slice(0, 5)
				.map(([id, s]) => lineOf(id, s));
			return {
				key: g.key,
				ownerMinutes: round1(owner),
				agentBusyMinutes: round1(busyMs / 60_000),
				tokens: roundTally(tally),
				costUsd: Math.round(tally.costUsd * 10_000) / 10_000,
				ticketCount: tickets,
				topTickets: top,
			};
		});
		if (query.only && query.only.length > 0) {
			const wanted = new Set(query.only.map((n) => n.toLowerCase()));
			out = out.filter((g) => wanted.has(g.key.toLowerCase()));
		}
		out.sort((a, b) => b.costUsd - a.costUsd || b.agentBusyMinutes - a.agentBusyMinutes || b.ownerMinutes - a.ownerMinutes);

		const totalTally = emptyTally();
		let totalBusy = 0;
		let totalOwner = 0;
		const tickets = new Set<string>();
		if (query.only && query.only.length > 0) {
			// A filtered report totals only what it shows.
			for (const g of out) {
				for (const [unitId, s] of groups.get(g.key)?.slices ?? []) {
					addTally(totalTally, s.tally);
					totalBusy += s.busyMs;
					totalOwner += s.ownerMinutes;
					if (!(rollup.units.get(unitId)?.synthetic ?? false)) tickets.add(unitId);
				}
			}
		} else {
			for (const w of windows) {
				addTally(totalTally, w.tally);
				totalBusy += w.busyMs;
				totalOwner += w.owner;
				if (!w.unit.synthetic) tickets.add(w.unit.unitId);
			}
		}
		const totals = {
			ownerMinutes: round1(totalOwner),
			agentBusyMinutes: round1(totalBusy / 60_000),
			tokens: roundTally(totalTally),
			costUsd: Math.round(totalTally.costUsd * 10_000) / 10_000,
			ticketCount: tickets.size,
		};
		const limit = Math.max(1, query.limit ?? 50);
		const shown = out.slice(0, limit);
		const inferredUnits = windows.filter((w) => w.unit.inferred && !w.unit.synthetic).length;
		const notes = [
			'Tokens are cost-weighted (cache reads count 0.1x, cache writes 1.25x for Claude); tokens.total is the raw sum.',
			'Owner minutes: messages on one ticket within 10 minutes form a span; overlapping spans share the time.',
			...(inferredUnits > 0 ? [`${inferredUnits} ticket(s) are partly rebuilt from history (attribution "inferred").`] : []),
			...(categoryInfo && categoryInfo.unclassified > 0 ? [`${categoryInfo.unclassified} ticket(s) matched no category and no model was available; shown as "${OTHER_CATEGORY}".`] : []),
		];
		const report: UsageReport = {
			window: { since: new Date(from).toISOString(), until: new Date(to).toISOString() },
			by: query.by,
			categories: categoryInfo,
			totals,
			groups: shown,
			summary: '',
			notes,
		};
		report.summary = this.summarize(report, out.length, to - from);
		return report;
	}

	private teamOf(recorded: string | undefined, agent: string): string | undefined {
		return recorded ?? this.deps.directory.lookup(agent)?.team;
	}

	/** The team a ticket is credited to: the recorded one, else the team with the most spend. */
	private primaryTeam(u: UnitRollup, byTeam: Map<string, Slice>): string | undefined {
		if (u.team) return u.team;
		let best: string | undefined;
		let score = -1;
		for (const [team, s] of byTeam) {
			const sc = s.tally.costUsd * 1000 + s.busyMs / 1000;
			if (team !== '(unknown team)' && sc > score) {
				score = sc;
				best = team;
			}
		}
		if (best) return best;
		for (const [agent, info] of u.agents) {
			const team = this.teamOf(info.team, agent);
			if (team) return team;
		}
		for (const e of u.usage) if (e.team) return e.team;
		return undefined;
	}

	private projectOf(u: UnitRollup): string | undefined {
		if (u.project) return u.project;
		for (const info of u.agents.values()) if (info.project) return info.project;
		return undefined;
	}

	private labelOf(u: UnitRollup): string {
		const id = u.ticketId ?? u.unitId;
		return u.title ? `${id}: ${u.title}` : id;
	}

	private summarize(report: UsageReport, groupCount: number, spanMs: number): string {
		const days = spanMs / (24 * HOUR_MS);
		const label = days >= 1 ? `last ${Math.round(days * 10) / 10 === Math.round(days) ? Math.round(days) : Math.round(days * 10) / 10} days` : `last ${Math.max(1, Math.round(spanMs / HOUR_MS))} hours`;
		const t = report.totals;
		const lines = [
			`Usage, ${label}: ${t.ticketCount} tickets, ${formatMinutes(t.agentBusyMinutes)} of agent work, ${formatMinutes(t.ownerMinutes)} of your time, ${compactTokens(t.tokens.budget)} tokens (about $${t.costUsd.toFixed(2)}).`,
		];
		if (report.groups.length > 0) {
			lines.push(`By ${report.by}:`);
			for (const g of report.groups.slice(0, 6)) {
				const parts = [
					g.ownerMinutes > 0 ? `${formatMinutes(g.ownerMinutes)} of you` : '',
					g.agentBusyMinutes > 0 ? `${formatMinutes(g.agentBusyMinutes)} agent work` : '',
					`${compactTokens(g.tokens.budget)} tokens ($${g.costUsd.toFixed(2)})`,
					report.by === 'ticket' || report.by === 'agent' || g.ticketCount === 0 ? '' : `${g.ticketCount} tickets`,
				].filter(Boolean);
				lines.push(`- ${g.key}: ${parts.join(', ')}`);
			}
			if (groupCount > 6) lines.push(`- and ${groupCount - 6} more`);
		}
		return lines.join('\n');
	}
}
