import { createUsageLedgerRouter } from './usage-ledger.routes.js';

describe('createUsageLedgerRouter', () => {
	it('mounts the report, category, unit and backfill routes', () => {
		const router = createUsageLedgerRouter() as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> };
		const paths = router.stack.filter((l) => l.route).map((l) => `${Object.keys(l.route!.methods)[0]} ${l.route!.path}`);
		expect(paths).toEqual(
			expect.arrayContaining(['get /report', 'get /categories', 'put /categories', 'post /categories', 'delete /categories/:name', 'get /units/:id', 'post /backfill']),
		);
	});
});
