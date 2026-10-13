/**
 * Owner time per ticket, from owner message times.
 *
 * Heuristic (specs/2026-10-11-usage-ledger.md): owner messages on one ticket
 * that follow each other within {@link OWNER_SPAN_GAP_MS} form one active
 * span. A span runs from its first message to its last message plus
 * {@link OWNER_MESSAGE_CREDIT_MS} (the time spent writing that last message),
 * so a single message counts for one minute. When spans of different tickets
 * overlap in time, the overlap is split evenly between them, so the owner's
 * minutes are never counted twice.
 *
 * @module services/usage-ledger/owner-spans
 */

/** Messages at most this far apart belong to the same span. */
export const OWNER_SPAN_GAP_MS = 10 * 60_000;
/** Time credited to the last (or only) message of a span. */
export const OWNER_MESSAGE_CREDIT_MS = 60_000;

/** One stretch of owner activity on a ticket. */
export interface OwnerSpan {
	unitId: string;
	startMs: number;
	endMs: number;
}

/**
 * Group one ticket's owner message times into spans.
 *
 * @param unitId - Ticket (unit) id
 * @param times - Message times (ms), any order, duplicates allowed
 * @returns Spans, oldest first
 */
export function buildOwnerSpans(unitId: string, times: number[]): OwnerSpan[] {
	const sorted = [...new Set(times.filter((t) => Number.isFinite(t)))].sort((a, b) => a - b);
	const spans: OwnerSpan[] = [];
	let start: number | null = null;
	let last = 0;
	for (const t of sorted) {
		if (start !== null && t - last <= OWNER_SPAN_GAP_MS) {
			last = t;
			continue;
		}
		if (start !== null) spans.push({ unitId, startMs: start, endMs: last + OWNER_MESSAGE_CREDIT_MS });
		start = t;
		last = t;
	}
	if (start !== null) spans.push({ unitId, startMs: start, endMs: last + OWNER_MESSAGE_CREDIT_MS });
	return spans;
}

/**
 * Owner minutes per ticket inside a time window, with overlaps split evenly.
 *
 * @param spans - Spans of any tickets
 * @param fromMs - Window start (ms)
 * @param toMs - Window end (ms)
 * @returns Ticket id → minutes
 */
export function ownerMinutesByUnit(spans: OwnerSpan[], fromMs: number, toMs: number): Map<string, number> {
	const clipped = spans
		.map((s) => ({ unitId: s.unitId, startMs: Math.max(s.startMs, fromMs), endMs: Math.min(s.endMs, toMs) }))
		.filter((s) => s.endMs > s.startMs);
	const points = [...new Set(clipped.flatMap((s) => [s.startMs, s.endMs]))].sort((a, b) => a - b);
	const minutes = new Map<string, number>();
	for (let i = 0; i < points.length - 1; i++) {
		const a = points[i];
		const b = points[i + 1];
		const active = clipped.filter((s) => s.startMs <= a && s.endMs >= b);
		if (active.length === 0) continue;
		const units = [...new Set(active.map((s) => s.unitId))];
		const each = (b - a) / 60_000 / units.length;
		for (const u of units) minutes.set(u, (minutes.get(u) ?? 0) + each);
	}
	return minutes;
}
