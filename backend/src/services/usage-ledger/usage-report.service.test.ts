import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LedgerRollup } from './ledger-rollup.js';
import { UnitClassifier } from './unit-classifier.js';
import type { CategoryDef } from './usage-categories.store.js';
import { formatMinutes, parseSince, UsageReportService, type ReportQuery } from './usage-report.service.js';
import { LEDGER_VERSION, type LedgerFact } from './usage-ledger.types.js';

const NOW = Date.parse('2026-10-11T12:00:00Z');
const H = 3_600_000;
const iso = (ms: number): string => new Date(ms).toISOString();

const meta = (unitId: string, title: string, over: Partial<Extract<LedgerFact, { kind: 'unit.meta' }>> = {}): LedgerFact => ({
	v: LEDGER_VERSION,
	ts: iso(NOW - 30 * H),
	kind: 'unit.meta',
	unitId,
	title,
	ticketId: `TKT-${unitId}`,
	attribution: 'recorded',
	...over,
});
const usage = (unitId: string, agent: string, team: string, hoursAgo: number, over: Record<string, number> = {}): LedgerFact => ({
	v: LEDGER_VERSION,
	ts: iso(Math.floor((NOW - hoursAgo * H) / H) * H),
	kind: 'usage',
	unitId,
	agent,
	team,
	model: 'claude-opus-5-5',
	events: 1,
	share: 1,
	input: 1000,
	cachedInput: 0,
	output: 100,
	cacheWrite: 0,
	budget: 1100,
	costUsd: 1,
	attribution: 'recorded',
	...over,
});
const busy = (unitId: string, agent: string, team: string, hoursAgo: number, minutes: number, share = 1): LedgerFact => ({
	v: LEDGER_VERSION,
	ts: iso(Math.floor((NOW - hoursAgo * H) / H) * H),
	kind: 'busy',
	unitId,
	agent,
	team,
	turns: 1,
	busyMs: minutes * 60_000,
	share,
	attribution: 'recorded',
});
const owner = (unitId: string, atMs: number): LedgerFact => ({ v: LEDGER_VERSION, ts: iso(atMs), kind: 'owner.message', unitId, attribution: 'recorded' });

describe('UsageReportService', () => {
	let dir: string;
	let rollup: LedgerRollup;
	const stored: CategoryDef[] = [];
	const build = (llm: ConstructorParameters<typeof UnitClassifier>[1] = null): UsageReportService =>
		new UsageReportService({
			rollup,
			directory: { lookup: () => null, projectName: () => undefined, ready: async () => undefined },
			classifier: new UnitClassifier(dir, llm),
			categories: async () => stored,
			sync: async () => undefined,
			now: () => NOW,
		});
	const q = (over: Partial<ReportQuery> = {}): ReportQuery => ({ sinceMs: NOW - 7 * 24 * H, untilMs: NOW, by: 'category', ...over });

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-report-'));
		rollup = new LedgerRollup();
		stored.length = 0;
		const facts: LedgerFact[] = [
			meta('A', 'Draft a LinkedIn post', { project: 'Media' }),
			meta('B', 'Rewrite book chapter 2', { project: 'Book' }),
			meta('C', 'Fix flaky build', { project: 'Crewly' }),
			meta('OLD', 'Old LinkedIn thing'),
			usage('A', 'ella', 'Marketing', 5, { costUsd: 2, budget: 2000 }),
			usage('A', 'luna', 'Marketing', 4, { costUsd: 1, budget: 1000 }),
			usage('B', 'ann', 'Writers', 6, { costUsd: 3, budget: 3000 }),
			usage('C', 'dev', 'Engineering', 3, { costUsd: 4, budget: 4000 }),
			usage('OLD', 'ella', 'Marketing', 24 * 20, { costUsd: 50 }),
			busy('A', 'ella', 'Marketing', 5, 30),
			busy('B', 'ann', 'Writers', 6, 60),
			busy('C', 'dev', 'Engineering', 3, 10),
			busy('C', 'dev', 'Engineering', 3, 20, 0.5),
			owner('A', NOW - 10 * H),
			owner('A', NOW - 10 * H + 5 * 60_000),
			owner('B', NOW - 9 * H),
			usage('~none:ella', 'ella', 'Marketing', 2, { costUsd: 0.5, budget: 500 }),
			{ v: LEDGER_VERSION, ts: iso(NOW - 30 * H), kind: 'unit.meta', unitId: '~none:ella', title: '(no ticket) ella', attribution: 'recorded' },
		];
		for (const f of facts) rollup.fold(f);
	});
	afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

	it('without categories groups by team and leaves old facts out of the window', async () => {
		const r = await build().report(q());
		expect(r.categories).toMatchObject({ source: 'default', names: [] });
		const byKey = Object.fromEntries(r.groups.map((g) => [g.key, g]));
		expect(Object.keys(byKey).sort()).toEqual(['(no ticket)', 'Engineering', 'Marketing', 'Writers'].sort().filter((k) => k !== '(no ticket)').concat('(no ticket)').sort());
		expect(byKey.Marketing).toMatchObject({ costUsd: 3, ticketCount: 1, agentBusyMinutes: 30 });
		expect(byKey.Marketing.ownerMinutes).toBeCloseTo(6);
		expect(byKey.Writers).toMatchObject({ costUsd: 3, ownerMinutes: 1, agentBusyMinutes: 60 });
		// the unticketed usage is reported but is not a ticket
		expect(byKey['(no ticket)']).toMatchObject({ costUsd: 0.5, ticketCount: 0 });
		expect(r.totals.costUsd).toBeCloseTo(10.5);
		expect(r.totals.ticketCount).toBe(3);
	});

	it('uses the owner\'s categories when defined; "other" collects the rest', async () => {
		stored.push({ name: 'self-media', description: 'LinkedIn, Substack, videos' }, { name: 'book', keywords: ['book', 'chapter'] });
		const r = await build().report(q());
		expect(r.categories).toMatchObject({ source: 'stored', names: ['self-media', 'book'], unclassified: 1 });
		const byKey = Object.fromEntries(r.groups.map((g) => [g.key, g]));
		expect(byKey['self-media']).toMatchObject({ costUsd: 3, ticketCount: 1 });
		expect(byKey.book).toMatchObject({ costUsd: 3, ticketCount: 1, ownerMinutes: 1 });
		expect(byKey.other).toMatchObject({ costUsd: 4, ticketCount: 1 });
		expect(byKey['(no ticket)']).toBeDefined();
		expect(byKey['self-media'].topTickets[0]).toMatchObject({ unitId: 'A', ticketId: 'TKT-A', title: 'Draft a LinkedIn post', costUsd: 3 });
	});

	it('ad-hoc categories override the stored ones for one report', async () => {
		stored.push({ name: 'book', keywords: ['book'] });
		const r = await build().report(q({ categories: [{ name: 'ops', keywords: ['build'] }] }));
		expect(r.categories).toMatchObject({ source: 'ad-hoc', names: ['ops'] });
		expect(r.groups.find((g) => g.key === 'ops')).toMatchObject({ costUsd: 4 });
	});

	it('can show only some groups and totals just those', async () => {
		stored.push({ name: 'book', keywords: ['book'] }, { name: 'self-media', keywords: ['linkedin'] });
		const r = await build().report(q({ only: ['Book'] }));
		expect(r.groups.map((g) => g.key)).toEqual(['book']);
		expect(r.totals).toMatchObject({ costUsd: 3, ticketCount: 1 });
	});

	it('groups by ticket, project, team and agent', async () => {
		const svc = build();
		const tickets = await svc.report(q({ by: 'ticket' }));
		expect(tickets.groups[0].key).toBe('TKT-C: Fix flaky build');
		const projects = await svc.report(q({ by: 'project' }));
		expect(projects.groups.map((g) => g.key).sort()).toEqual(['(no project)', 'Book', 'Crewly', 'Media']);
		const teams = await svc.report(q({ by: 'team' }));
		expect(teams.groups.find((g) => g.key === 'Engineering')).toMatchObject({ costUsd: 4, agentBusyMinutes: 20, ticketCount: 1 });
		const agents = await svc.report(q({ by: 'agent' }));
		expect(agents.groups.find((g) => g.key === 'ella')).toMatchObject({ costUsd: 2.5, ticketCount: 1 });
		expect(agents.groups.find((g) => g.key === 'dev')!.agentBusyMinutes).toBe(20);
	});

	it('carries a shared turn at its share (busy 20 min x 0.5)', async () => {
		const r = await build().report(q({ by: 'ticket' }));
		expect(r.groups.find((g) => g.key.startsWith('TKT-C'))!.agentBusyMinutes).toBe(20);
	});

	it('counts overlapping owner spans once', async () => {
		rollup.fold(owner('B', NOW - 10 * H + 2 * 60_000));
		const r = await build().report(q({ by: 'ticket' }));
		const minutes = r.groups.reduce((n, g) => n + g.ownerMinutes, 0);
		// A: 0..6 min, B: 2..3 min (B's two messages 2 min after A's start and 1h later... B has its own span)
		expect(minutes).toBeLessThan(6 + 1 + 3 + 0.01);
		expect(minutes).toBeGreaterThan(6);
	});

	it('limits the window to the requested range', async () => {
		const r = await build().report(q({ sinceMs: NOW - 3 * H }));
		// whole hours: the 09:00 bucket is in, the 08:00 one (ends at 09:00) is out
		expect(r.totals.costUsd).toBeCloseTo(4 + 0.5);
	});

	it('writes a short summary for speech and Slack', async () => {
		stored.push({ name: 'book', keywords: ['book'] });
		const r = await build().report(q());
		expect(r.summary).toMatch(/^Usage, last 7 days: 3 tickets, /);
		expect(r.summary).toContain('- book:');
		expect(r.summary).toContain('of you');
		expect(r.notes.join(' ')).toContain('cost-weighted');
	});

	it('is empty and says so when nothing happened', async () => {
		rollup = new LedgerRollup();
		const r = await build().report(q());
		expect(r.groups).toEqual([]);
		expect(r.totals.ticketCount).toBe(0);
		expect(r.summary).toContain('0 tickets');
	});
});

describe('parseSince / formatMinutes', () => {
	it('parses relative and absolute starts', () => {
		expect(parseSince('7d', NOW)).toBe(NOW - 7 * 24 * H);
		expect(parseSince('36h', NOW)).toBe(NOW - 36 * H);
		expect(parseSince('2w', NOW)).toBe(NOW - 14 * 24 * H);
		expect(parseSince('2026-10-01', NOW)).toBe(Date.parse('2026-10-01'));
		expect(parseSince('soon', NOW)).toBeNull();
	});

	it('formats minutes for speech', () => {
		expect([0, 45, 60, 130, 1500, 1440].map(formatMinutes)).toEqual(['0m', '45m', '1h', '2h10m', '1d1h', '1d']);
	});
});
