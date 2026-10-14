import { buildOwnerSpans, ownerMinutesByUnit, OWNER_MESSAGE_CREDIT_MS, OWNER_SPAN_GAP_MS } from './owner-spans.js';

const MIN = 60_000;
const T0 = Date.parse('2026-10-10T10:00:00Z');

describe('buildOwnerSpans', () => {
	it('credits a single message one minute', () => {
		expect(buildOwnerSpans('u', [T0])).toEqual([{ unitId: 'u', startMs: T0, endMs: T0 + OWNER_MESSAGE_CREDIT_MS }]);
	});

	it('joins messages at most ten minutes apart into one span', () => {
		const spans = buildOwnerSpans('u', [T0 + 18 * MIN, T0, T0 + 9 * MIN]);
		expect(spans).toEqual([{ unitId: 'u', startMs: T0, endMs: T0 + 18 * MIN + OWNER_MESSAGE_CREDIT_MS }]);
	});

	it('starts a new span after a longer gap, and ignores duplicates', () => {
		const spans = buildOwnerSpans('u', [T0, T0, T0 + OWNER_SPAN_GAP_MS + 1]);
		expect(spans).toHaveLength(2);
		expect(spans[0].endMs).toBe(T0 + OWNER_MESSAGE_CREDIT_MS);
	});

	it('returns nothing for no messages', () => {
		expect(buildOwnerSpans('u', [])).toEqual([]);
	});
});

describe('ownerMinutesByUnit', () => {
	it('sums a ticket window and clips spans to it', () => {
		const spans = buildOwnerSpans('a', [T0, T0 + 5 * MIN]); // 6 minutes
		expect(ownerMinutesByUnit(spans, T0, T0 + 60 * MIN).get('a')).toBeCloseTo(6);
		expect(ownerMinutesByUnit(spans, T0 + 3 * MIN, T0 + 60 * MIN).get('a')).toBeCloseTo(3);
		expect(ownerMinutesByUnit(spans, T0 + 20 * MIN, T0 + 60 * MIN).size).toBe(0);
	});

	it('splits overlapping time evenly so the owner is never counted twice', () => {
		const a = buildOwnerSpans('a', [T0, T0 + 4 * MIN]); // 0..5
		const b = buildOwnerSpans('b', [T0 + 2 * MIN, T0 + 6 * MIN]); // 2..7
		const minutes = ownerMinutesByUnit([...a, ...b], T0, T0 + 60 * MIN);
		// a: 0-2 alone (2) + 2-5 shared (1.5); b: 2-5 shared (1.5) + 5-7 alone (2)
		expect(minutes.get('a')).toBeCloseTo(3.5);
		expect(minutes.get('b')).toBeCloseTo(3.5);
		expect((minutes.get('a') ?? 0) + (minutes.get('b') ?? 0)).toBeCloseTo(7);
	});
});
