import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Request, Response } from 'express';
import { UsageLedger } from '../../services/usage-ledger/usage-ledger.runtime.js';
import { LEDGER_VERSION } from '../../services/usage-ledger/usage-ledger.types.js';
import { createUsageLedgerHandlers } from './usage-ledger.controller.js';

interface Reply {
	status: number;
	body: { success: boolean; data?: any; error?: string };
}

async function call(handler: (req: Request, res: Response) => Promise<void>, req: Partial<Request>): Promise<Reply> {
	const reply: Reply = { status: 200, body: { success: false } };
	const res = {
		status(code: number) {
			reply.status = code;
			return this;
		},
		json(body: Reply['body']) {
			reply.body = body;
			return this;
		},
	} as unknown as Response;
	await handler({ query: {}, params: {}, body: {}, ...req } as Request, res);
	return reply;
}

describe('usage ledger controller', () => {
	let home: string;
	let ledger: UsageLedger;
	let h: ReturnType<typeof createUsageLedgerHandlers>;

	beforeEach(async () => {
		home = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-ctl-'));
		ledger = new UsageLedger({ home, llm: null, directory: { lookup: () => ({ team: 'Writers' }), projectName: () => undefined, ready: async () => undefined } });
		h = createUsageLedgerHandlers(() => ledger);
		const hour = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000).toISOString();
		ledger.store.appendMany([
			{ v: LEDGER_VERSION, ts: hour, kind: 'unit.meta', unitId: 'tr-1', ticketId: 'TKT-1', title: 'Write book chapter', attribution: 'recorded' },
			{ v: LEDGER_VERSION, ts: hour, kind: 'usage', unitId: 'tr-1', agent: 'a', team: 'Writers', model: 'claude-opus-5-5', events: 1, share: 1, input: 10, cachedInput: 0, output: 5, cacheWrite: 0, budget: 15, costUsd: 0.25, attribution: 'recorded' },
		]);
	});
	afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

	it('reports by team by default window, and by category with stored definitions', async () => {
		const byTeam = await call(h.report, { query: { by: 'team' } });
		expect(byTeam.body.data.groups[0]).toMatchObject({ key: 'Writers', costUsd: 0.25, ticketCount: 1 });
		await call(h.setCategory, { body: { name: 'book', keywords: ['book'] } });
		const byCat = await call(h.report, { query: { by: 'category', since: '24h' } });
		expect(byCat.body.data.groups[0].key).toBe('book');
		expect(byCat.body.data.summary).toContain('book');
	});

	it('takes ad-hoc categories and name filters from the categories argument', async () => {
		const adhoc = await call(h.report, { query: { by: 'category', categories: 'media:linkedin;writing:chapter' } });
		expect(adhoc.body.data.groups[0].key).toBe('writing');
		await call(h.setCategory, { body: { name: 'book', keywords: ['book'] } });
		expect((await call(h.report, { query: { categories: 'ghost' } })).status).toBe(400);
	});

	it('rejects a bad window or grouping', async () => {
		expect((await call(h.report, { query: { since: 'yesterdayish' } })).status).toBe(400);
		expect((await call(h.report, { query: { by: 'mood' } })).status).toBe(400);
	});

	it('manages categories', async () => {
		expect((await call(h.setCategory, { body: { name: '' } })).status).toBe(400);
		expect((await call(h.replaceCategories, { body: { categories: 'x' } })).status).toBe(400);
		await call(h.replaceCategories, { body: { categories: [{ name: 'a' }, { name: 'b' }] } });
		expect((await call(h.listCategories, {})).body.data.categories.map((c: { name: string }) => c.name)).toEqual(['a', 'b']);
		expect((await call(h.removeCategory, { params: { name: 'a' } as never })).body.success).toBe(true);
		expect((await call(h.removeCategory, { params: { name: 'zzz' } as never })).status).toBe(404);
	});

	it('returns the facts of one ticket by unit id or ticket label', async () => {
		const byLabel = await call(h.getUnit, { params: { id: 'TKT-1' } as never });
		expect(byLabel.body.data).toMatchObject({ unitId: 'tr-1', title: 'Write book chapter' });
		expect(byLabel.body.data.usage).toHaveLength(1);
		expect((await call(h.getUnit, { params: { id: 'nope' } as never })).status).toBe(404);
	});
});
