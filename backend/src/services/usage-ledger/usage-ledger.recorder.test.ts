import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TraceContext } from '../trace/trace-context.service.js';
import { TraceStore } from '../trace/trace-store.js';
import type { TokenUsageEvent } from '../monitoring/token-usage.service.js';
import { notifyRequest, notifyUsage } from './ledger-hooks.js';
import { UsageLedgerRecorder, hourStart } from './usage-ledger.recorder.js';
import { UsageLedgerStore } from './usage-ledger.store.js';
import type { LedgerFact, UsageFact } from './usage-ledger.types.js';

const T0 = Date.parse('2026-10-10T10:00:00Z');

describe('UsageLedgerRecorder', () => {
	let dir: string;
	let clock: number;
	let traceStore: TraceStore;
	let ctx: TraceContext;
	let store: UsageLedgerStore;
	let recorder: UsageLedgerRecorder;

	const directory = {
		lookup: (s: string) => (s.startsWith('writer') ? { team: 'Writers', project: 'Book' } : null),
		projectName: (id: string) => (id === 'p1' ? 'Book' : undefined),
		ready: async () => undefined,
	};

	const facts = async (): Promise<LedgerFact[]> => {
		await recorder.flush();
		const out: LedgerFact[] = [];
		for (const f of await store.listFiles()) {
			for (const line of fs.readFileSync(path.join(store.dir, f), 'utf-8').trim().split('\n')) if (line) out.push(JSON.parse(line));
		}
		return out;
	};
	const usageFacts = async (): Promise<UsageFact[]> => (await facts()).filter((f): f is UsageFact => f.kind === 'usage');
	const event = (over: Partial<TokenUsageEvent> = {}): TokenUsageEvent => ({
		timestamp: new Date(clock).toISOString(),
		agentId: 'writer-1',
		input: 100,
		output: 20,
		model: 'claude-opus-5-5',
		cachedInput: 900,
		...over,
	});
	const trace = (summary: string, refs = {}): string => ctx.startTrace({ kind: 'request', summary, actor: { kind: 'owner' }, refs })!;

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-rec-'));
		clock = T0;
		traceStore = new TraceStore({ dir: path.join(dir, 'traces'), now: () => new Date(clock), indexFlushDelayMs: 5 });
		ctx = new TraceContext(() => traceStore, () => clock);
		store = new UsageLedgerStore(path.join(dir, 'ledger'));
		recorder = new UsageLedgerRecorder({ store, directory, context: () => ctx, now: () => clock });
		recorder.start();
	});

	afterEach(async () => {
		await recorder.stop();
		await traceStore.idle();
		traceStore.dispose();
		fs.rmSync(dir, { recursive: true, force: true });
	});

	describe('attribution of usage', () => {
		it('credits the whole event to the ticket the agent was working on', async () => {
			const a = trace('TKT-1: write chapter', { ticketId: 'TKT-1' });
			ctx.noteTurnDelivery('writer-1', `[TRACE:${a}] go`);
			recorder.noteUsage('writer-1', event());
			const [u] = await usageFacts();
			expect(u).toMatchObject({ unitId: a, agent: 'writer-1', team: 'Writers', share: 1, input: 1000, cachedInput: 900, output: 20, attribution: 'recorded' });
			expect(u.costUsd).toBeGreaterThan(0);
			expect(u.budget).toBeGreaterThan(0);
		});

		it('splits evenly when one delivery was about two tickets', async () => {
			const a = trace('TKT-1: a');
			const b = trace('TKT-2: b');
			ctx.noteTurnDelivery('writer-1', `[TRACE:${a}] [TRACE:${b}] both`);
			recorder.noteUsage('writer-1', event());
			const us = await usageFacts();
			expect(us.map((u) => [u.unitId, u.share]).sort()).toEqual([[a, 0.5], [b, 0.5]].sort());
		});

		it('uses the ticket of the event time, not of now (late transcript sync)', async () => {
			const a = trace('TKT-1: a');
			ctx.noteTurnDelivery('writer-1', `[TRACE:${a}] go`);
			const at = clock + 1_000;
			clock += 10 * 60_000;
			const b = trace('TKT-2: b');
			ctx.noteTurnDelivery('writer-1', `[TRACE:${b}] next`);
			recorder.noteUsage('writer-1', event({ timestamp: new Date(at).toISOString() }));
			expect((await usageFacts()).map((u) => u.unitId)).toEqual([a]);
		});

		it('keeps usage with no ticket in the agent\'s "(no ticket)" unit', async () => {
			recorder.noteUsage('writer-1', event());
			const all = await facts();
			expect((await usageFacts())[0].unitId).toBe('~none:writer-1');
			expect(all.find((f) => f.kind === 'unit.meta')).toMatchObject({ unitId: '~none:writer-1', title: '(no ticket) writer-1' });
		});

		it('trusts a trace id already stamped on the event', async () => {
			const a = trace('TKT-1: a');
			recorder.noteUsage('writer-1', event({ traceId: a }));
			expect((await usageFacts())[0].unitId).toBe(a);
		});

		it('sums events of one agent / model / hour into one delta fact', async () => {
			const a = trace('TKT-1: a');
			ctx.noteTurnDelivery('writer-1', `[TRACE:${a}] go`);
			for (let i = 0; i < 3; i++) recorder.noteUsage('writer-1', event());
			const us = await usageFacts();
			expect(us).toHaveLength(1);
			expect(us[0]).toMatchObject({ events: 3, input: 3000, output: 60, ts: hourStart(T0) });
			// A later flush writes a new delta; the totals are the sum of facts.
			recorder.noteUsage('writer-1', event());
			expect((await usageFacts()).reduce((n, u) => n + u.events, 0)).toBe(4);
		});

		it('records the ticket once with its title, id and kind', async () => {
			const a = trace('TKT-7: [Request] plan the book', { ticketId: 'TKT-7', requestId: 'r-7' });
			ctx.noteTurnDelivery('writer-1', `[TRACE:${a}] go`);
			recorder.noteUsage('writer-1', event());
			recorder.noteUsage('writer-1', event());
			const metas = (await facts()).filter((f) => f.kind === 'unit.meta');
			expect(metas).toHaveLength(1);
			expect(metas[0]).toMatchObject({ unitId: a, ticketId: 'TKT-7', requestId: 'r-7', rootKind: 'request', title: '[Request] plan the book' });
			const agents = (await facts()).filter((f) => f.kind === 'unit.agent');
			expect(agents).toEqual([expect.objectContaining({ unitId: a, agent: 'writer-1', team: 'Writers', project: 'Book' })]);
		});
	});

	describe('busy time', () => {
		it('records a finished turn on its ticket', async () => {
			const a = trace('TKT-1: a');
			ctx.noteTurnDelivery('writer-1', `[TRACE:${a}] go`);
			ctx.noteTurnActivity('writer-1', true);
			clock += 120_000;
			ctx.noteTurnActivity('writer-1', false);
			const busy = (await facts()).filter((f) => f.kind === 'busy');
			expect(busy).toEqual([expect.objectContaining({ unitId: a, agent: 'writer-1', busyMs: 120_000, share: 1, turns: 1 })]);
		});

		it('splits a turn about two tickets', async () => {
			const a = trace('TKT-1: a');
			const b = trace('TKT-2: b');
			ctx.noteTurnDelivery('writer-1', `[TRACE:${a}] [TRACE:${b}] both`);
			ctx.noteTurnActivity('writer-1', true);
			clock += 60_000;
			ctx.noteTurnActivity('writer-1', false);
			const busy = (await facts()).filter((f) => f.kind === 'busy');
			expect(busy.map((f) => (f.kind === 'busy' ? f.share : 0))).toEqual([0.5, 0.5]);
		});
	});

	describe('owner messages and closing', () => {
		it('records owner messages delivered on a ticket, once per message', async () => {
			const a = trace('TKT-1: a');
			ctx.noteTurnDelivery('writer-1', `[CHAT:c1:m1] more please [TRACE:${a}]`);
			ctx.noteTurnDelivery('writer-2', `[CHAT:c1:m1] more please [TRACE:${a}]`);
			clock += 5 * 60_000;
			ctx.noteTurnDelivery('writer-1', `[CHAT:c1:m2] and this [TRACE:${a}]`);
			const owner = (await facts()).filter((f) => f.kind === 'owner.message');
			expect(owner.map((f) => f.ts)).toEqual([new Date(T0).toISOString(), new Date(T0 + 5 * 60_000).toISOString()]);
		});

		it('does not count harness deliveries as owner time', async () => {
			const a = trace('TKT-1: a');
			ctx.noteTurnDelivery('writer-1', `[CREWLY-DISPATCH] WorkItem queued [TRACE:${a}]`);
			expect((await facts()).filter((f) => f.kind === 'owner.message')).toEqual([]);
		});

		it('records the project and the close of a ticket from status events, once', async () => {
			const a = trace('TKT-1: a');
			for (let i = 0; i < 2; i++) {
				ctx.record({ traceId: a, type: 'ticket.status', actor: { kind: 'system' }, summary: 's', data: { from: 'in_progress', to: 'done', projectId: 'p1' } });
			}
			ctx.record({ traceId: a, type: 'request.status', actor: { kind: 'system' }, summary: 's', data: { from: 'open', to: 'running' } });
			const all = await facts();
			expect(all.filter((f) => f.kind === 'unit.closed')).toEqual([expect.objectContaining({ unitId: a, status: 'done' })]);
			expect(all.some((f) => f.kind === 'unit.meta' && f.project === 'Book')).toBe(true);
		});
	});

	describe('hooks', () => {
		it('picks up usage and new requests through the hooks module', async () => {
			const a = trace('TKT-1: a');
			ctx.noteTurnDelivery('writer-1', `[TRACE:${a}] go`);
			notifyUsage('writer-1', event());
			notifyRequest({ traceId: a, requestId: 'r1', ticketId: 'TKT-1', title: 'Plan the book', description: 'Outline [TICKET:TKT-1 r1] chapters', channel: 'slack-dm', threadRef: '1700.0001' });
			const all = await facts();
			expect(all.filter((f) => f.kind === 'usage')).toHaveLength(1);
			expect(all.find((f) => f.kind === 'unit.meta' && f.threadRef)).toMatchObject({ unitId: a, title: 'Plan the book', excerpt: 'Outline chapters', channel: 'slack-dm', threadRef: '1700.0001' });
		});

		it('stops listening after stop()', async () => {
			await recorder.stop();
			notifyUsage('writer-1', event());
			expect(await usageFacts()).toEqual([]);
		});
	});
});
