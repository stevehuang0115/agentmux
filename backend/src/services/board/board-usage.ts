/**
 * Spend and "what is each agent on" from the usage ledger (crewly#1247).
 * A pure fold over the ledger's in-memory rollup: per-agent and total cost
 * for today (local midnight) and the last 7 days, the owner's minutes, and the
 * open ticket each agent used tokens on most recently (the ledger's
 * attribution, #1250).
 *
 * @module services/board/board-usage
 */

import { BOARD_CONSTANTS } from '../../constants.js';
import type { UnitRollup } from '../usage-ledger/ledger-rollup.js';
import { buildOwnerSpans, ownerMinutesByUnit, type OwnerSpan } from '../usage-ledger/owner-spans.js';
import { scrubText } from './board-redact.js';
import type { BoardUsage } from './board-snapshot.builder.js';
import { startOfLocalDay } from './board-snapshot.builder.js';

const HOUR_MS = 3_600_000;
const WEEK_MS = 7 * 24 * HOUR_MS;

/**
 * Fold the ledger rollup into board usage.
 *
 * @param units - The rollup's units
 * @param now - Epoch ms
 * @returns Usage for the board
 */
export function computeBoardUsage(units: Iterable<UnitRollup>, now: number): BoardUsage {
	const dayStart = startOfLocalDay(now);
	const weekStart = now - WEEK_MS;
	const perAgent = new Map<string, { todayUsd: number; todayTokens: number }>();
	const spend = { todayUsd: 0, weekUsd: 0, todayTokens: 0, weekTokens: 0 };
	const recent = new Map<string, { unit: UnitRollup; at: number }>();
	const spans: OwnerSpan[] = [];

	for (const unit of units) {
		if (unit.ownerMessages.length > 0) spans.push(...buildOwnerSpans(unit.unitId, unit.ownerMessages));
		for (const e of unit.usage) {
			const end = e.hourMs + HOUR_MS;
			if (end <= weekStart || e.hourMs > now) continue;
			const tokens = e.budget * e.share;
			const usd = e.costUsd * e.share;
			spend.weekUsd += usd;
			spend.weekTokens += tokens;
			if (e.hourMs + HOUR_MS > dayStart) {
				spend.todayUsd += usd;
				spend.todayTokens += tokens;
				const a = perAgent.get(e.agent) ?? { todayUsd: 0, todayTokens: 0 };
				a.todayUsd += usd;
				a.todayTokens += tokens;
				perAgent.set(e.agent, a);
			}
			if (!unit.synthetic && !unit.closedAt) {
				const at = Math.min(now, e.hourMs + HOUR_MS);
				const prev = recent.get(e.agent);
				if (!prev || at > prev.at) recent.set(e.agent, { unit, at });
			}
		}
	}

	const taskOf = new Map<string, { id?: string; title: string; since: string }>();
	for (const [agent, { unit, at }] of recent) {
		if (now - at > BOARD_CONSTANTS.LEDGER_TASK_MAX_AGE_MS) continue;
		const title = scrubText(unit.title || unit.ticketId || '');
		if (!title) continue;
		taskOf.set(agent, { ...(unit.ticketId ? { id: unit.ticketId } : {}), title, since: new Date(unit.firstMs || at).toISOString() });
	}

	const sum = (m: Map<string, number>): number => [...m.values()].reduce((a, b) => a + b, 0);
	const minutes = (from: number): number => Math.round(sum(ownerMinutesByUnit(spans, from, now)));
	return {
		perAgent,
		taskOf,
		spend: {
			todayUsd: round2(spend.todayUsd),
			weekUsd: round2(spend.weekUsd),
			todayTokens: Math.round(spend.todayTokens),
			weekTokens: Math.round(spend.weekTokens),
			ownerMinutesToday: minutes(dayStart),
			ownerMinutesWeek: minutes(weekStart),
		},
	};
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
