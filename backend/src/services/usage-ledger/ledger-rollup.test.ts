import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LedgerRollup } from './ledger-rollup.js';
import { UsageLedgerStore } from './usage-ledger.store.js';
import { LEDGER_VERSION, type LedgerFact, type UsageFact } from './usage-ledger.types.js';

const usage = (over: Partial<UsageFact> = {}): UsageFact => ({
	v: LEDGER_VERSION,
	ts: '2026-10-10T10:00:00.000Z',
	kind: 'usage',
	unitId: 'tr-1',
	agent: 'dev-1',
	model: 'claude-opus-5-5',
	events: 1,
	share: 1,
	input: 100,
	cachedInput: 50,
	output: 10,
	cacheWrite: 0,
	budget: 80,
	costUsd: 0.5,
	attribution: 'recorded',
	...over,
});

describe('LedgerRollup', () => {
	let dir: string;
	let store: UsageLedgerStore;
	let rollup: LedgerRollup;

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-rollup-'));
		store = new UsageLedgerStore(path.join(dir, 'l'));
		rollup = new LedgerRollup();
	});
	afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

	const write = async (...facts: LedgerFact[]): Promise<void> => {
		store.appendMany(facts);
		await store.flush();
	};

	it('folds facts into per-unit rollups, first meta value wins', async () => {
		await write(
			{ v: LEDGER_VERSION, ts: '2026-10-10T09:00:00Z', kind: 'unit.meta', unitId: 'tr-1', ticketId: 'TKT-1', title: 'Write chapter', attribution: 'recorded' },
			{ v: LEDGER_VERSION, ts: '2026-10-10T09:01:00Z', kind: 'unit.meta', unitId: 'tr-1', title: 'Other title', project: 'Book', attribution: 'recorded' },
			{ v: LEDGER_VERSION, ts: '2026-10-10T09:02:00Z', kind: 'unit.agent', unitId: 'tr-1', agent: 'dev-1', team: 'Writers', attribution: 'recorded' },
			usage(),
			{ v: LEDGER_VERSION, ts: '2026-10-10T10:00:00Z', kind: 'busy', unitId: 'tr-1', agent: 'dev-1', turns: 2, busyMs: 90_000, share: 1, attribution: 'recorded' },
			{ v: LEDGER_VERSION, ts: '2026-10-10T10:05:00Z', kind: 'owner.message', unitId: 'tr-1', attribution: 'recorded' },
			{ v: LEDGER_VERSION, ts: '2026-10-10T11:00:00Z', kind: 'unit.closed', unitId: 'tr-1', status: 'done', attribution: 'recorded' },
		);
		await rollup.refresh(store);
		const u = rollup.units.get('tr-1')!;
		expect(u).toMatchObject({ ticketId: 'TKT-1', title: 'Write chapter', project: 'Book', closedStatus: 'done', inferred: false });
		expect([...u.agents.keys()]).toEqual(['dev-1']);
		expect(u.usage).toHaveLength(1);
		expect(u.busy[0].busyMs).toBe(90_000);
		expect(u.ownerMessages).toEqual([Date.parse('2026-10-10T10:05:00Z')]);
	});

	it('reads only what was appended since the last refresh', async () => {
		await write(usage());
		await rollup.refresh(store);
		expect(rollup.factCount).toBe(1);
		await rollup.refresh(store);
		expect(rollup.factCount).toBe(1);
		await write(usage({ ts: '2026-10-10T11:00:00.000Z' }));
		await rollup.refresh(store);
		expect(rollup.factCount).toBe(2);
		expect(rollup.units.get('tr-1')!.usage).toHaveLength(2);
	});

	it('waits for the newline of a half-written line', async () => {
		await write(usage());
		const file = path.join(store.dir, '2026-10.jsonl');
		const half = JSON.stringify(usage({ ts: '2026-10-10T12:00:00.000Z' }));
		fs.appendFileSync(file, half.slice(0, 20));
		await rollup.refresh(store);
		expect(rollup.factCount).toBe(1);
		fs.appendFileSync(file, `${half.slice(20)}\n`);
		await rollup.refresh(store);
		expect(rollup.factCount).toBe(2);
	});

	it('skips torn and foreign lines', async () => {
		await write(usage());
		fs.appendFileSync(path.join(store.dir, '2026-10.jsonl'), 'not json\n{"kind":"x"}\n');
		await rollup.refresh(store);
		expect(rollup.factCount).toBe(1);
	});

	it('marks a unit inferred when any of its facts is', async () => {
		await write(usage({ attribution: 'inferred' }));
		await rollup.refresh(store);
		expect(rollup.units.get('tr-1')!.inferred).toBe(true);
	});

	it('flags the pseudo-unit of unticketed usage as synthetic', async () => {
		await write(usage({ unitId: '~none:dev-1' }));
		await rollup.refresh(store);
		expect(rollup.units.get('~none:dev-1')!.synthetic).toBe(true);
	});

	it('starts over when a file got shorter (edited from outside)', async () => {
		await write(usage(), usage({ ts: '2026-10-10T11:00:00.000Z' }));
		await rollup.refresh(store);
		fs.writeFileSync(path.join(store.dir, '2026-10.jsonl'), `${JSON.stringify(usage())}\n`);
		await rollup.refresh(store);
		expect(rollup.units.get('tr-1')!.usage).toHaveLength(1);
	});
});
