import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { setTraceContextForTesting, TraceContext } from '../trace/trace-context.service.js';
import { TraceStore } from '../trace/trace-store.js';
import { notifyUsage } from './ledger-hooks.js';
import { UsageLedger } from './usage-ledger.runtime.js';

describe('UsageLedger (end to end)', () => {
	let home: string;
	let traceStore: TraceStore;
	let ledger: UsageLedger;
	let clock: number;
	const hash = (dir: string): string =>
		fs
			.readdirSync(dir)
			.filter((f) => f.endsWith('.jsonl'))
			.sort()
			.map((f) => `${f}:${fs.readFileSync(path.join(dir, f), 'utf-8')}`)
			.join('\n');

	beforeEach(async () => {
		home = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-e2e-'));
		clock = Date.now() - 3 * 60_000;
		traceStore = new TraceStore({ dir: path.join(home, 'traces'), now: () => new Date(clock), indexFlushDelayMs: 5 });
		const ctx = new TraceContext(() => traceStore, () => clock);
		setTraceContextForTesting(ctx);
		ledger = new UsageLedger({ home, llm: null, directory: { lookup: () => ({ team: 'Writers' }), projectName: () => undefined, ready: async () => undefined } });
		await ledger.start();
	});

	afterEach(async () => {
		await ledger.stop();
		await traceStore.idle();
		traceStore.dispose();
		setTraceContextForTesting(null);
		fs.rmSync(home, { recursive: true, force: true });
	});

	it('records a ticket\'s tokens, time and owner messages and reports them by owner-defined category', async () => {
		const ctx = (await import('../trace/trace-context.service.js')).getTraceContext();
		const book = ctx.startTrace({ kind: 'request', summary: 'TKT-5: Rewrite book chapter 2', actor: { kind: 'owner' }, refs: { ticketId: 'TKT-5' } })!;
		const other = ctx.startTrace({ kind: 'request', summary: 'TKT-6: Fix the build', actor: { kind: 'owner' }, refs: { ticketId: 'TKT-6' } })!;
		ctx.noteTurnDelivery('writer-1', `[CHAT:c:m] chapter please [TRACE:${book}]`);
		ctx.noteTurnActivity('writer-1', true);
		clock += 2 * 60_000;
		notifyUsage('writer-1', { timestamp: new Date(clock).toISOString(), agentId: 'writer-1', input: 10, output: 5, cachedInput: 1000, model: 'claude-opus-5-5' });
		ctx.noteTurnActivity('writer-1', false);
		ctx.noteTurnDelivery('writer-1', `[CHAT:c:m2] and the build [TRACE:${other}]`);
		notifyUsage('writer-1', { timestamp: new Date(clock).toISOString(), agentId: 'writer-1', input: 10, output: 5, cachedInput: 1000, model: 'claude-opus-5-5' });

		expect((await ledger.categories.set({ name: 'book', keywords: ['book', 'chapter'] }))).toMatchObject({ version: 1 });
		await ledger.recorder.flush();
		const before = hash(ledger.store.dir);
		const report = await ledger.reports.report({ sinceMs: Date.now() - 24 * 3_600_000, untilMs: Date.now() + 3_600_000, by: 'category' });
		const groups = Object.fromEntries(report.groups.map((g) => [g.key, g]));
		expect(groups.book).toMatchObject({ ticketCount: 1 });
		expect(groups.book.agentBusyMinutes).toBeCloseTo(2);
		expect(groups.book.ownerMinutes).toBeGreaterThan(0);
		expect(groups.other).toMatchObject({ ticketCount: 1 });
		expect(groups.book.tokens.total).toBeGreaterThan(0);

		// Categories live outside the facts: reporting changed no ledger file.
		expect(hash(ledger.store.dir)).toBe(before);
		expect(fs.readFileSync(path.join(ledger.store.dir, fs.readdirSync(ledger.store.dir).find((f) => /^\d{4}-\d{2}\.jsonl$/.test(f)) as string), 'utf-8')).not.toMatch(/"category"/);
	});

	it('starts live recording from now: the state file notes when', async () => {
		const state = JSON.parse(fs.readFileSync(path.join(ledger.store.dir, 'state.json'), 'utf-8'));
		expect(Date.parse(state.liveSince)).toBeLessThanOrEqual(Date.now());
	});
});
