import { BoardActivityTracker } from './board-activity.tracker.js';
import { resultOf, summarizeResults } from './board-outcome-phrases.js';
import { BoardSnapshotBuilder, startOfLocalDay, type BoardSources, type BoardTeamInfo, type BoardUsage } from './board-snapshot.builder.js';
import { computeBoardUsage } from './board-usage.js';
import type { UnitRollup } from '../usage-ledger/ledger-rollup.js';

const NOW = new Date(2026, 9, 12, 15, 0, 0).getTime(); // local 15:00
const iso = (ms: number): string => new Date(ms).toISOString();
const ago = (ms: number): string => iso(NOW - ms);
const MIN = 60_000;
const HOUR = 3_600_000;
const SK = 'sk-ant-api03-THISISAFAKEKEYFORTESTING0123456789abcdef';

const TEAMS: BoardTeamInfo[] = [
	{
		teamId: 'orchestrator',
		name: 'Orchestrator',
		members: [{ session: 'crewly-orc', name: 'Crewly Orc', role: 'orchestrator', runtime: 'claude-code', agentStatus: 'active', workingStatus: 'idle' }],
	},
	{
		teamId: 'growth',
		name: 'Growth',
		members: [
			{ session: 'growth-ella-1', name: 'Ella', role: 'marketer', runtime: 'claude-code', model: 'sonnet', agentStatus: 'active', workingStatus: 'in_progress' },
			{ session: 'growth-vera-2', name: 'Vera', role: 'support', runtime: 'codex-cli', agentStatus: 'active', workingStatus: 'idle' },
			{ session: 'growth-sage-3', name: 'Sage', role: 'researcher', runtime: 'claude-code', agentStatus: 'inactive', workingStatus: 'idle' },
			{ session: 'growth-nova-4', name: 'Nova', role: 'designer', runtime: 'claude-code', agentStatus: 'active', workingStatus: 'idle' },
		],
	},
	{ teamId: 'dev', name: 'Dev', paused: true, members: [{ session: 'dev-pia-5', name: 'Pia', role: 'developer', runtime: 'claude-code', agentStatus: 'active', workingStatus: 'idle' }] },
];

function usageFixture(): BoardUsage {
	return {
		perAgent: new Map([['growth-ella-1', { todayUsd: 0.4321987, todayTokens: 120_345.6 }]]),
		spend: { todayUsd: 1.23, weekUsd: 9.87, todayTokens: 200_000, weekTokens: 1_500_000, ownerMinutesToday: 12, ownerMinutesWeek: 80 },
		taskOf: new Map([['growth-vera-2', { id: 'TKT-9', title: 'Answer pricing question from a customer', since: ago(2 * HOUR) }]]),
	};
}

function sources(over: Partial<BoardSources> = {}): BoardSources {
	return {
		identity: async () => ({ instanceId: 'dev-1234-abcd', machineName: "Steve's MacBook" }),
		version: async () => '1.20.307',
		teams: async () => TEAMS,
		turnState: (s) => (s === 'growth-ella-1' ? 'working' : 'idle'),
		waitingOnHuman: () => false,
		queuedFor: (s) => (s === 'growth-nova-4' ? 2 : 0),
		stalledBackground: () => null,
		workItems: async () => [],
		tickets: async () => [],
		decisions: async () => [],
		holds: async () => [],
		usage: async () => usageFixture(),
		activeWork: async () => new Map([['growth-ella-1', { id: 'wi-1', title: 'Write the launch post', since: ago(25 * MIN) }]]),
		...over,
	};
}

function make(over: Partial<BoardSources> = {}): { builder: BoardSnapshotBuilder; tracker: BoardActivityTracker } {
	const tracker = new BoardActivityTracker();
	tracker.setRootsResolver(() => ['/work/crewly']);
	return { tracker, builder: new BoardSnapshotBuilder(sources(over), tracker, () => NOW) };
}

describe('BoardSnapshotBuilder: teams and agents', () => {
	it('builds the contract shape', async () => {
		const { builder } = make();
		const s = await builder.build();
		expect(s).toMatchObject({ v: 1, instanceId: 'dev-1234-abcd', machineName: "Steve's MacBook", crewlyVersion: '1.20.307', generatedAt: iso(NOW) });
		expect(s.teams.map((t) => t.teamId)).toEqual(['orchestrator', 'growth', 'dev']);
		expect(s.teams[2].paused).toBe(true);
		expect(s.teams[1].paused).toBeUndefined();
	});

	it('maps states: working, idle, stopped, queued', async () => {
		const { builder } = make();
		const growth = (await builder.build()).teams[1].agents;
		expect(growth.map((a) => [a.name, a.state])).toEqual([
			['Ella', 'working'],
			['Vera', 'idle'],
			['Sage', 'stopped'],
			['Nova', 'queued'],
		]);
	});

	it('a working agent shows its live activity, task, last action and today usage', async () => {
		const { builder, tracker } = make();
		tracker.recordHook('growth-ella-1', 'PreToolUse', { toolName: 'Edit', toolInput: { filePath: '/work/crewly/web/launch.md' }, toolUseId: 't' }, NOW - 5_000);
		const ella = (await builder.build()).teams[1].agents[0];
		expect(ella).toMatchObject({
			session: 'growth-ella-1',
			role: 'marketer',
			runtime: 'claude-code',
			model: 'sonnet',
			state: 'working',
			activity: { type: 'coding', detail: 'crewly/web/launch.md', since: iso(NOW - 5_000) },
			task: { id: 'wi-1', title: 'Write the launch post', since: ago(25 * MIN) },
			lastAction: { text: 'Edited crewly/web/launch.md' },
			todayUsd: 0.4322,
			todayTokens: 120346,
		});
	});

	it('a working agent with no tool call yet is thinking', async () => {
		const { builder } = make();
		expect((await builder.build()).teams[1].agents[0].activity).toMatchObject({ type: 'thinking' });
	});

	it('falls back to the ledger task when nothing else is known', async () => {
		const { builder } = make();
		const vera = (await builder.build()).teams[1].agents[1];
		expect(vera.task).toMatchObject({ id: 'TKT-9', title: 'Answer pricing question from a customer' });
		expect(vera.activity).toBeUndefined();
	});

	it('an open decision from an idle agent makes it waiting on the owner; a working one stays working', async () => {
		const decisions = async () => [
			{ id: 'D-1', kind: 'approval' as const, title: 'Send the newsletter to 4,000 people?', asker: 'growth-vera-2', teamId: 'growth', createdAt: ago(10 * MIN) },
			{ id: 'D-2', kind: 'question' as const, title: 'Which logo?', asker: 'growth-ella-1', createdAt: ago(5 * MIN) },
		];
		const { builder } = make({ decisions });
		const agents = (await builder.build()).teams[1].agents;
		expect(agents[1].state).toBe('waiting');
		expect(agents[1].activity).toMatchObject({ type: 'waiting_owner' });
		expect(agents[1].activity?.detail).toContain('Send the newsletter');
		expect(agents[0].state).toBe('working');
	});

	it('a permission prompt (hook) is waiting', async () => {
		const { builder } = make({ waitingOnHuman: (s) => s === 'dev-pia-5' });
		const pia = (await builder.build()).teams[2].agents[0];
		expect(pia.state).toBe('waiting');
		expect(pia.activity?.type).toBe('waiting_owner');
	});

	it('error state from the runtime', async () => {
		const { builder } = make({ errorOf: (s) => (s === 'dev-pia-5' ? 'Claude usage limit reached' : null) });
		const pia = (await builder.build()).teams[2].agents[0];
		expect(pia.state).toBe('error');
		expect(pia.activity?.detail).toBe('Claude usage limit reached');
	});

	it('a failing source is an empty one, not a failed build', async () => {
		const boom = async (): Promise<never> => {
			throw new Error('disk gone');
		};
		const { builder } = make({ workItems: boom, tickets: boom, decisions: boom, holds: boom, usage: boom, activeWork: boom });
		const s = await builder.build();
		expect(s.teams).toHaveLength(3);
		expect(s.outcomes.spend).toEqual({ todayUsd: 0, weekUsd: 0, todayTokens: 0, weekTokens: 0 });
	});

	it('sanitises every text', async () => {
		const { builder } = make({
			activeWork: async () => new Map([['growth-ella-1', { title: `Email jane@example.com about ${SK}`, since: ago(MIN) }]]),
			identity: async () => ({ instanceId: 'dev-1', machineName: 'Mac of jane@example.com' }),
		});
		const s = await builder.build();
		expect(JSON.stringify(s)).not.toMatch(/jane@example|sk-ant/);
	});

	it('rows() for a delta come from the cache and the live tracker, with in-memory reads only', async () => {
		const { builder, tracker } = make();
		await builder.build();
		const spy = jest.fn();
		(builder as unknown as { sources: BoardSources }).sources = new Proxy({} as BoardSources, { get: (_t, p) => (p === 'turnState' ? () => 'working' : (...a: unknown[]) => spy(p, ...a)) });
		tracker.recordHook('growth-vera-2', 'PreToolUse', { toolName: 'Bash', toolInput: { command: 'npm test' }, toolUseId: 'x' }, NOW - 1_000);
		const rows = builder.rows(['growth-vera-2', 'unknown-session']);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ teamId: 'growth', session: 'growth-vera-2', state: 'working', activity: { type: 'command', detail: 'npm test' } });
		// only the in-memory runtime reads; no disk or ledger source
		const called = new Set(spy.mock.calls.map((c) => c[0]));
		expect([...called].every((n) => ['waitingOnHuman', 'errorOf', 'queuedFor', 'capabilities'].includes(String(n)))).toBe(true);
	});

	it('is not primed before the first build', async () => {
		const { builder } = make();
		expect(builder.primed).toBe(false);
		expect(builder.rows(['growth-ella-1'])).toEqual([]);
		await builder.build();
		expect(builder.primed).toBe(true);
	});
});

describe('BoardSnapshotBuilder: outcomes', () => {
	const dayStart = startOfLocalDay(NOW);

	it('done today: tickets closed today by result, grouped into summary phrases', async () => {
		const done = (id: string, title: string, hoursAgo = 1) => ({ id, label: id, title, column: 'done', assignee: 'growth-ella-1', completedAt: ago(hoursAgo * HOUR), updatedAt: ago(hoursAgo * HOUR) });
		const { builder } = make({
			tickets: async () => [
				done('TKT-1', 'Publish LinkedIn post about the launch'),
				done('TKT-2', 'Post the changelog thread on X'),
				done('TKT-3', 'Answer customer: refund question'),
				done('TKT-4', 'Answer customer: invoice question'),
				done('TKT-5', 'Answer customer: login problem'),
				done('TKT-6', 'Fix the broken signup bug'),
				done('TKT-7', 'Yesterday post', 20), // before local midnight (15:00 - 20 h)
				{ id: 'TKT-8', label: 'TKT-8', title: 'Still open', column: 'in_progress', updatedAt: ago(HOUR) },
			],
		});
		const o = (await builder.build()).outcomes;
		expect(o.doneTodaySummary).toEqual(['3 customers answered', '2 posts published', '1 bug fixed']);
		expect(o.doneToday).toHaveLength(6);
		expect(o.doneToday[0]).toMatchObject({ team: 'Growth', agent: 'Ella' });
		expect(o.doneToday.every((d) => Date.parse(d.at) >= dayStart)).toBe(true);
	});

	it('done today: verified WorkItems count unless a ticket carries the result or it is harness bookkeeping', async () => {
		const wi = (id: string, title: string, over: Record<string, unknown> = {}) => ({ id, title, type: 'delegate', status: 'verified', target: 'growth-vera-2', createdAt: ago(5 * HOUR), completedAt: ago(HOUR), ...over });
		const { builder } = make({
			tickets: async () => [{ id: 'req-1', label: 'TKT-1', title: 'Write the weekly report', column: 'done', completedAt: ago(HOUR), updatedAt: ago(HOUR) }],
			workItems: async () => [
				wi('w1', 'Reply to the support email'),
				wi('w2', 'Write the weekly report', { requestId: 'req-1' }),
				wi('w3', 'Cron check', { type: 'cron_run' }),
				wi('w4', 'Old thing', { completedAt: ago(30 * HOUR) }),
				wi('w6', 'Verify: Reply to the support email'),
				wi('w7', 'Follow through: send the report'),
				wi('w8', 'CE-12 homepage card'),
				wi('w9', 'Publish the changelog post', { projectTaskId: 'CE-13' }),
				wi('w5', 'Pending', { status: 'queued' }),
			],
		});
		const o = (await builder.build()).outcomes;
		expect(o.doneToday.map((d) => d.title).sort()).toEqual(['Reply to the support email', 'Write the weekly report']);
		expect(o.doneTodaySummary.sort()).toEqual(['1 customer answered', '1 report delivered']);
	});

	it('waiting on owner: decisions, reviews and holds, oldest first, each with an action', async () => {
		const { builder } = make({
			decisions: async () => [
				{ id: 'D-4', kind: 'approval', title: 'Ella wants to click "Publish" on linkedin.com/feed', asker: 'growth-ella-1', teamId: 'growth', createdAt: ago(30 * MIN) },
				{ id: 'D-5', kind: 'question', title: 'Which logo, A or B?', asker: 'growth-vera-2', createdAt: ago(3 * HOUR) },
			],
			tickets: async () => [{ id: 'req-9', label: 'TKT-9', title: 'Pricing page copy', column: 'to_review', assignee: 'growth-nova-4', submittedAt: ago(HOUR), updatedAt: ago(HOUR) }],
			holds: async () => [
				{ id: 'doc-comments:C3', kind: 'approval', title: '2 Google Docs comments ready to send (C3)', since: ago(2 * HOUR), action: { label: 'Approve' } },
				{ id: 'reconnect:gmail:default', kind: 'reconnect', title: 'Reconnect Google gmail', since: ago(4 * HOUR), action: { label: 'Reconnect' } },
			],
		});
		const w = (await builder.build()).outcomes.waitingOnOwner;
		expect(w.map((x) => x.id)).toEqual(['reconnect:gmail:default', 'decision:D-5', 'doc-comments:C3', 'review:req-9', 'decision:D-4']);
		expect(w.find((x) => x.id === 'review:req-9')).toMatchObject({ kind: 'review', title: 'TKT-9 Pricing page copy', agent: 'Nova', team: 'Growth', action: { label: 'Review' } });
		expect(w.find((x) => x.id === 'decision:D-4')).toMatchObject({ kind: 'approval', agent: 'Ella', action: { label: 'Approve' } });
		expect(w.find((x) => x.id === 'decision:D-5')).toMatchObject({ kind: 'question', action: { label: 'Answer' } });
	});

	it('stuck: blocked, failed, long-queued, long-running and stalled background, with who it waits on', async () => {
		const wi = (id: string, status: string, over: Record<string, unknown> = {}) => ({ id, title: `Item ${id}`, type: 'delegate', status, target: 'growth-vera-2', createdAt: ago(5 * HOUR), ...over });
		const { builder } = make({
			workItems: async () => [
				wi('b1', 'blocked', { blockedReason: 'Waiting for the owner to approve the budget', blockSource: 'explicit', statusChangedAt: ago(3 * HOUR) }),
				wi('b2', 'blocked', { blockedReason: 'Waiting on item b1', statusChangedAt: ago(2 * HOUR) }),
				wi('b3', 'blocked', { blockedReason: 'Needs a different approach', blockSource: 'explicit', statusChangedAt: ago(HOUR) }),
				wi('f1', 'failed', { error: `Tool crashed with ${SK}`, completedAt: ago(2 * HOUR) }),
				wi('f2', 'failed', { completedAt: ago(40 * HOUR) }),
				wi('q1', 'queued', { createdAt: ago(4 * HOUR) }),
				wi('q2', 'queued', { createdAt: ago(10 * MIN) }),
				wi('q3', 'queued', { createdAt: ago(4 * HOUR), scheduledAt: iso(NOW + HOUR) }),
				wi('r1', 'running', { startedAt: ago(15 * HOUR) }),
				wi('r2', 'running', { startedAt: ago(HOUR) }),
			],
			tickets: async () => [{ id: 'req-2', label: 'TKT-2', title: 'Fix checkout', column: 'blocked', assignee: 'dev-pia-5', updatedAt: ago(6 * HOUR) }],
			stalledBackground: (s) => (s === 'growth-ella-1' ? { since: NOW - 50 * MIN, description: 'Scrape competitor prices' } : null),
		});
		const stuck = (await builder.build()).outcomes.stuck;
		const byId = new Map(stuck.map((s) => [s.id, s]));
		expect([...byId.keys()].sort()).toEqual(['bg:growth-ella-1', 'ticket:req-2', 'wi:b1', 'wi:b2', 'wi:b3', 'wi:f1', 'wi:q1', 'wi:r1']);
		expect(byId.get('wi:b1')).toMatchObject({ on: 'owner', agent: 'Vera', team: 'Growth' });
		expect(byId.get('wi:b2')).toMatchObject({ on: 'system' });
		expect(byId.get('wi:b3')).toMatchObject({ on: 'agent' });
		expect(byId.get('wi:f1')?.reason).toMatch(/^Failed: Tool crashed/);
		expect(byId.get('wi:q1')?.reason).toBe('Waiting in the queue for 4 h');
		expect(byId.get('wi:r1')?.reason).toBe('Running for 15 h');
		expect(byId.get('bg:growth-ella-1')).toMatchObject({ on: 'agent', title: 'Scrape competitor prices', since: iso(NOW - 50 * MIN) });
		expect(JSON.stringify(stuck)).not.toContain('sk-ant');
		// oldest first
		expect(stuck.map((s) => Date.parse(s.since))).toEqual([...stuck.map((s) => Date.parse(s.since))].sort((a, b) => a - b));
	});

	it('spend comes from the ledger', async () => {
		const { builder } = make();
		expect((await builder.build()).outcomes.spend).toEqual({ todayUsd: 1.23, weekUsd: 9.87, todayTokens: 200_000, weekTokens: 1_500_000, ownerMinutesToday: 12, ownerMinutesWeek: 80 });
	});

	it('caps the lists', async () => {
		const many = Array.from({ length: 120 }, (_, i) => ({ id: `T${i}`, label: `T${i}`, title: `Post ${i}`, column: 'done', completedAt: ago(MIN), updatedAt: ago(MIN) }));
		const { builder } = make({ tickets: async () => many });
		const o = (await builder.build()).outcomes;
		expect(o.doneToday).toHaveLength(50);
		expect(o.doneTodaySummary).toEqual(['120 posts published']);
	});
});

describe('outcome phrases', () => {
	it('result by keyword, then by kind, then generic', () => {
		expect(resultOf('Publish the LinkedIn post')).toBe('post published');
		expect(resultOf('Reply to customer Jane')).toBe('customer answered');
		expect(resultOf('Fix crash on login')).toBe('bug fixed');
		expect(resultOf('Research competitors')).toBe('report delivered');
		expect(resultOf('Reticulate splines', 'issue')).toBe('issue resolved');
		expect(resultOf('Reticulate splines')).toBe('task done');
	});

	it('counts with singular and plural, most frequent first', () => {
		expect(summarizeResults(['post published', 'bug fixed', 'post published', 'task done'])).toEqual(['2 posts published', '1 bug fixed', '1 task done']);
		expect(summarizeResults([])).toEqual([]);
	});
});

describe('computeBoardUsage', () => {
	function unit(id: string, over: Partial<UnitRollup> = {}): UnitRollup {
		return { unitId: id, synthetic: false, firstMs: NOW - 3 * HOUR, lastMs: NOW - HOUR, agents: new Map(), usage: [], busy: [], ownerMessages: [], inferred: false, ...over };
	}
	const entry = (agent: string, hoursAgo: number, costUsd: number, budget: number, share = 1) => ({
		hourMs: Math.floor((NOW - hoursAgo * HOUR) / HOUR) * HOUR,
		agent,
		model: 'm',
		share,
		input: 0,
		cachedInput: 0,
		output: 0,
		cacheWrite: 0,
		budget,
		costUsd,
		attribution: 'recorded' as const,
	});

	it('sums today and the last 7 days, per agent and in total, honouring shares', () => {
		const u = computeBoardUsage(
			[
				unit('TKT-1', { ticketId: 'TKT-1', title: 'Launch post', usage: [entry('ella', 1, 1, 1000), entry('ella', 30, 2, 5000), entry('vera', 200, 4, 9000)] }),
				unit('TKT-2', { usage: [entry('ella', 1, 2, 2000, 0.5)] }),
			],
			NOW,
		);
		expect(u.spend.todayUsd).toBe(2);
		expect(u.spend.todayTokens).toBe(2000);
		expect(u.spend.weekUsd).toBe(4);
		expect(u.perAgent.get('ella')).toEqual({ todayUsd: 2, todayTokens: 2000 });
		expect(u.perAgent.has('vera')).toBe(false);
	});

	it('current task: the open ticket the agent used tokens on most recently', () => {
		const u = computeBoardUsage(
			[
				unit('TKT-1', { ticketId: 'TKT-1', title: 'Old ticket', usage: [entry('ella', 1.5, 1, 1)] }),
				unit('TKT-2', { ticketId: 'TKT-2', title: 'New ticket', firstMs: NOW - 2 * HOUR, usage: [entry('ella', 0.2, 1, 1)] }),
				unit('TKT-3', { ticketId: 'TKT-3', title: 'Closed', closedAt: iso(NOW), usage: [entry('ella', 0, 1, 1)] }),
				unit('~none:ella', { synthetic: true, usage: [entry('ella', 0, 1, 1)] }),
				unit('TKT-4', { ticketId: 'TKT-4', title: 'Long ago', usage: [entry('vera', 5, 1, 1)] }),
			],
			NOW,
		);
		expect(u.taskOf.get('ella')).toMatchObject({ id: 'TKT-2', title: 'New ticket' });
		expect(u.taskOf.has('vera')).toBe(false);
	});

	it('owner minutes from owner messages', () => {
		const u = computeBoardUsage([unit('TKT-1', { ownerMessages: [NOW - 2 * HOUR, NOW - 2 * HOUR + 2 * MIN, NOW - 30 * HOUR] })], NOW);
		expect(u.spend.ownerMinutesToday).toBe(3);
		expect(u.spend.ownerMinutesWeek).toBe(4);
	});
});
