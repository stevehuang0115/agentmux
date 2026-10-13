import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BACKFILL_FILE, monthFileFor, UsageLedgerStore } from './usage-ledger.store.js';
import { LEDGER_VERSION, type LedgerFact } from './usage-ledger.types.js';

const owner = (ts: string, unitId = 'tr-1'): LedgerFact => ({ v: LEDGER_VERSION, ts, kind: 'owner.message', unitId, attribution: 'recorded' });

describe('UsageLedgerStore', () => {
	let dir: string;
	let store: UsageLedgerStore;

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-store-'));
		store = new UsageLedgerStore(path.join(dir, 'usage-ledger'));
	});
	afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

	it('appends one JSON line per fact into the month file of the fact', async () => {
		store.append(owner('2026-10-10T10:00:00Z'));
		store.append(owner('2026-11-01T00:00:01Z'));
		await store.flush();
		expect(await store.listFiles()).toEqual(['2026-10.jsonl', '2026-11.jsonl']);
		const lines = fs.readFileSync(path.join(store.dir, '2026-10.jsonl'), 'utf-8').trim().split('\n');
		expect(lines).toHaveLength(1);
		expect(JSON.parse(lines[0]).kind).toBe('owner.message');
	});

	it('never rewrites: earlier bytes stay identical after more appends', async () => {
		store.append(owner('2026-10-10T10:00:00Z'));
		await store.flush();
		const file = path.join(store.dir, '2026-10.jsonl');
		const before = fs.readFileSync(file);
		store.append(owner('2026-10-10T11:00:00Z', 'tr-2'));
		store.appendMany([owner('2026-10-10T12:00:00Z'), owner('2026-10-10T13:00:00Z')]);
		await store.flush();
		const after = fs.readFileSync(file);
		expect(after.subarray(0, before.length).equals(before)).toBe(true);
		expect(after.length).toBeGreaterThan(before.length);
		// The store has no way to update or delete a fact.
		expect(Object.getOwnPropertyNames(Object.getPrototypeOf(store)).filter((n) => /update|delete|remove|rewrite|truncate/i.test(n))).toEqual([]);
	});

	it('keeps order across queued writes', async () => {
		for (let i = 0; i < 20; i++) store.append(owner('2026-10-10T10:00:00Z', `tr-${i}`));
		await store.flush();
		const ids = fs.readFileSync(path.join(store.dir, '2026-10.jsonl'), 'utf-8').trim().split('\n').map((l) => JSON.parse(l).unitId);
		expect(ids).toEqual(Array.from({ length: 20 }, (_, i) => `tr-${i}`));
	});

	it('writes history to backfill.jsonl and lists it last', async () => {
		store.append(owner('2026-10-10T10:00:00Z'), 'backfill');
		store.append(owner('2026-09-10T10:00:00Z'));
		await store.flush();
		expect(await store.listFiles()).toEqual(['2026-09.jsonl', BACKFILL_FILE]);
	});

	it('lists nothing before the first write and ignores empty batches', async () => {
		expect(await store.listFiles()).toEqual([]);
		store.appendMany([]);
		await store.flush();
		expect(fs.existsSync(store.dir)).toBe(false);
	});

	it('names the month file by UTC month', () => {
		expect(monthFileFor('2026-10-31T23:59:59Z')).toBe('2026-10.jsonl');
	});
});
