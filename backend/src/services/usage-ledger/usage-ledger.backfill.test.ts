import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { TokenUsageEvent } from '../monitoring/token-usage.service.js';
import { ensureLiveSince, INFER_MAX_GAP_MS, readLedgerState, runBackfill } from './usage-ledger.backfill.js';
import { LedgerRollup } from './ledger-rollup.js';
import { UsageLedgerStore } from './usage-ledger.store.js';

const T0 = Date.parse('2026-10-05T10:00:00Z');
const MIN = 60_000;
const iso = (ms: number): string => new Date(ms).toISOString();
const TA = 'tr-20261005-aaaaaaaa';
const TB = 'tr-20261005-bbbbbbbb';
const TLATE = 'tr-20261009-cccccccc';

describe('runBackfill', () => {
	let dir: string;
	let store: UsageLedgerStore;
	const directory = {
		lookup: (s: string) => (s === 'writer-1' ? { team: 'Writers', project: 'Book' } : null),
		projectName: (id: string) => (id === 'p1' ? 'Book' : undefined),
		ready: async () => undefined,
	};
	const usageEvents: Array<[string, TokenUsageEvent]> = [];
	const ev = (atMs: number, over: Partial<TokenUsageEvent> = {}): TokenUsageEvent => ({
		timestamp: iso(atMs),
		agentId: 'writer-1',
		input: 100,
		output: 10,
		model: 'claude-opus-5-5',
		cachedInput: 400,
		...over,
	});
	const sources = () => ({
		forEachUsage: (visit: (s: string, e: TokenUsageEvent) => void) => usageEvents.forEach(([s, e]) => visit(s, e)),
		traceDir: path.join(dir, 'traces'),
		directory,
	});
	const traceEvents = (traceId: string, events: Array<Record<string, unknown>>): void =>
		fs.writeFileSync(path.join(dir, 'traces', `${traceId}.jsonl`), events.map((e) => JSON.stringify({ traceId, actor: { kind: 'system' }, refs: {}, summary: '', outcome: 'info', ...e })).join('\n') + '\n');

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-bf-'));
		fs.mkdirSync(path.join(dir, 'traces'));
		store = new UsageLedgerStore(path.join(dir, 'ledger'));
		usageEvents.length = 0;
		const root = (traceId: string, createdAt: number, summary: string, refs = {}) => ({
			traceId,
			root: { traceId, kind: 'request', summary, createdAt: iso(createdAt), actor: { kind: 'owner' }, refs },
			updatedAt: iso(createdAt),
			eventCount: 1,
			bytes: 1,
			truncated: false,
		});
		fs.writeFileSync(
			path.join(dir, 'traces', 'index.json'),
			JSON.stringify({
				version: 1,
				traces: {
					[TA]: root(TA, T0, 'TKT-1: Write chapter one', { ticketId: 'TKT-1', requestId: 'r1' }),
					[TB]: root(TB, T0 + 5 * MIN, 'TKT-2: Edit the intro', { ticketId: 'TKT-2' }),
					[TLATE]: root(TLATE, T0 + 5 * 24 * 60 * MIN, 'TKT-3: after the cutoff'),
				},
				refs: {},
			}),
		);
		traceEvents(TA, [
			{ ts: iso(T0), type: 'turn.delivered', actor: { kind: 'owner' }, refs: { session: 'writer-1' }, data: { kind: 'owner_message' } },
			{ ts: iso(T0 + 4 * MIN), type: 'turn.delivered', actor: { kind: 'owner' }, refs: { session: 'writer-1' }, data: { kind: 'owner_message' } },
			{ ts: iso(T0 + 10 * MIN), type: 'turn.ended', actor: { kind: 'agent', session: 'writer-1' }, refs: { session: 'writer-1' }, data: { busyMs: 6 * MIN } },
			{ ts: iso(T0 + 20 * MIN), type: 'request.status', refs: { ticketId: 'TKT-1' }, data: { from: 'running', to: 'done' } },
		]);
		traceEvents(TB, [
			{ ts: iso(T0 + 5 * MIN), type: 'turn.delivered', refs: { session: 'writer-1' }, data: { kind: 'dispatch' } },
			// the same busy turn as in TA (a turn about two tickets)
			{ ts: iso(T0 + 10 * MIN), type: 'turn.ended', actor: { kind: 'agent', session: 'writer-1' }, refs: { session: 'writer-1' }, data: { busyMs: 6 * MIN } },
			{ ts: iso(T0 + 12 * MIN), type: 'ticket.status', refs: { ticketId: 'CE-1' }, data: { from: 'ready', to: 'in_progress', projectId: 'p1' } },
		]);
		traceEvents(TLATE, [{ ts: iso(T0 + 5 * 24 * 60 * MIN), type: 'turn.delivered', refs: { session: 'writer-1' }, data: { kind: 'owner_message' } }]);
	});
	afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

	const cutoff = T0 + 2 * 24 * 60 * MIN;
	const rollupOf = async (): Promise<LedgerRollup> => {
		const r = new LedgerRollup();
		await r.refresh(store);
		return r;
	};

	it('rebuilds tickets, owner messages, busy time and closing from the traces', async () => {
		const res = await runBackfill(store, sources(), { cutoffMs: cutoff });
		expect(res).toMatchObject({ ran: true, traces: 3 });
		const r = await rollupOf();
		expect(r.units.has(TLATE)).toBe(false);
		const a = r.units.get(TA)!;
		expect(a).toMatchObject({ ticketId: 'TKT-1', requestId: 'r1', title: 'Write chapter one', closedStatus: 'done' });
		expect(a.ownerMessages).toHaveLength(2);
		expect(a.agents.get('writer-1')).toEqual({ team: 'Writers', project: 'Book' });
		expect(r.units.get(TB)!.project).toBe('Book');
		// the shared turn is split in half between the two tickets
		expect(a.busy[0]).toMatchObject({ busyMs: 6 * MIN, share: 0.5, attribution: 'recorded' });
		expect(r.units.get(TB)!.busy[0].share).toBe(0.5);
	});

	it('marks usage by how it was tied to a ticket', async () => {
		usageEvents.push(
			['writer-1', ev(T0 + 11 * MIN, { traceId: TA })], // stamped by the harness
			['writer-1', ev(T0 + 7 * MIN)], // after TB's delivery, no stamp -> inferred
			['writer-1', ev(T0 + 7 * MIN + INFER_MAX_GAP_MS + MIN)], // too long after -> no ticket
			['other-1', ev(T0 + 7 * MIN)], // an agent nothing was delivered to
			['writer-1', ev(cutoff + MIN)], // after the cutoff: live recording owns it
		);
		const res = await runBackfill(store, sources(), { cutoffMs: cutoff });
		expect(res).toMatchObject({ usageEvents: 4, inferredEvents: 1 });
		const r = await rollupOf();
		expect(r.units.get(TA)!.usage[0]).toMatchObject({ attribution: 'recorded', input: 500 });
		expect(r.units.get(TB)!.usage[0]).toMatchObject({ attribution: 'inferred' });
		expect(r.units.get(TB)!.inferred).toBe(true);
		expect(r.units.get('~none:writer-1')!.usage).toHaveLength(1);
		expect(r.units.get('~none:other-1')!.synthetic).toBe(true);
	});

	it('runs once and leaves a state file', async () => {
		await runBackfill(store, sources(), { cutoffMs: cutoff });
		const size = fs.statSync(path.join(store.dir, 'backfill.jsonl')).size;
		const again = await runBackfill(store, sources(), { cutoffMs: cutoff });
		expect(again.ran).toBe(false);
		expect(fs.statSync(path.join(store.dir, 'backfill.jsonl')).size).toBe(size);
		expect((await readLedgerState(store.dir)).backfill).toMatchObject({ cutoff: iso(cutoff) });
	});

	it('copes with missing traces', async () => {
		fs.rmSync(path.join(dir, 'traces'), { recursive: true });
		usageEvents.push(['writer-1', ev(T0)]);
		const res = await runBackfill(store, sources(), { cutoffMs: cutoff });
		expect(res).toMatchObject({ ran: true, traces: 0, usageEvents: 1 });
	});
});

describe('ensureLiveSince', () => {
	it('stamps the start of live recording once', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-live-'));
		try {
			const first = await ensureLiveSince(dir, T0);
			expect(first).toBe(iso(T0));
			expect(await ensureLiveSince(dir, T0 + 1000)).toBe(first);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
