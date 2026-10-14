import { AgentInteractionRecorder } from './board-interactions.js';
import { capLinks, messagingLinks, structuralLinks, type StructuralLinkInput } from './board-links.js';
import { recordChatMentions, recordTerminalWrites } from './board-interaction-hooks.js';
import type { BoardTeamInfo, BoardWorkItem } from './board-snapshot.builder.js';
import { linkKey } from './board.types.js';

const NOW = Date.parse('2026-10-12T12:00:00.000Z');
const MIN = 60_000;
const HOUR = 3_600_000;
const iso = (ms: number): string => new Date(ms).toISOString();

const member = (session: string, role = 'developer', agentStatus = 'active') => ({ session, id: `id-${session}`, name: session, role, runtime: 'claude-code', agentStatus, workingStatus: 'idle' });
const TEAMS: BoardTeamInfo[] = [
	{ teamId: 'orchestrator', name: 'Orchestrator', members: [member('crewly-orc', 'orchestrator')] },
	{ teamId: 'mk', name: 'Marketing', createdAt: '2026-05-03T00:00:00.000Z', leaders: ['mk-ella'], members: [member('mk-ella', 'team-leader'), member('mk-luna'), member('mk-grace', 'sales', 'inactive')] },
	{ teamId: 'dev', name: 'Dev', createdAt: '2026-06-01T00:00:00.000Z', members: [member('dev-max')] },
];

const wi = (over: Partial<BoardWorkItem> & { id: string }): BoardWorkItem => ({ title: 'Write the post', type: 'delegate', status: 'running', createdAt: iso(NOW - 10 * MIN), ...over });

function input(over: Partial<StructuralLinkInput> = {}): StructuralLinkInput {
	return { now: NOW, orchestrator: 'crewly-orc', teams: TEAMS, workItems: [], tickets: [], tasks: new Map(), stopped: new Set(['mk-grace']), ...over };
}
const find = (links: ReturnType<typeof structuralLinks>, kind: string, from: string, to: string) => links.find((l) => l.kind === kind && l.from === from && l.to === to);

describe('structuralLinks: reports_to', () => {
	it('members report to the team leader, the leader to the orchestrator', () => {
		const links = structuralLinks(input());
		expect(find(links, 'reports_to', 'mk-luna', 'mk-ella')).toMatchObject({ active: true, since: '2026-05-03T00:00:00.000Z' });
		expect(find(links, 'reports_to', 'mk-ella', 'crewly-orc')).toMatchObject({ active: true });
		expect(find(links, 'reports_to', 'mk-grace', 'mk-ella')).toMatchObject({ active: false });
	});

	it('a team without a leader has no reporting lines', () => {
		expect(structuralLinks(input()).filter((l) => l.kind === 'reports_to' && (l.from === 'dev-max' || l.to === 'dev-max'))).toEqual([]);
	});
});

describe('structuralLinks: delegated', () => {
	it('uses delegatedBy, aggregates per pair, newest open item gives label and since', () => {
		const links = structuralLinks(
			input({
				workItems: [
					wi({ id: 'a', target: 'mk-luna', delegatedBy: 'mk-ella', status: 'verified', completedAt: iso(NOW - 3 * HOUR), createdAt: iso(NOW - 5 * HOUR), title: 'Old post' }),
					wi({ id: 'b', target: 'mk-luna', delegatedBy: 'mk-ella', status: 'running', createdAt: iso(NOW - 20 * MIN), title: 'Write the launch post' }),
				],
			}),
		);
		expect(find(links, 'delegated', 'mk-ella', 'mk-luna')).toEqual({
			from: 'mk-ella',
			to: 'mk-luna',
			kind: 'delegated',
			active: true,
			since: iso(NOW - 20 * MIN),
			label: 'Write the launch post',
			weight: 2,
		});
	});

	it('infers the delegator from the owner field: orchestrator, or the target team lead', () => {
		const links = structuralLinks(
			input({
				workItems: [wi({ id: 'a', target: 'mk-ella', owner: 'orchestrator' }), wi({ id: 'b', target: 'mk-luna', owner: 'team_lead' }), wi({ id: 'c', target: 'mk-luna', owner: 'system' })],
			}),
		);
		expect(find(links, 'delegated', 'crewly-orc', 'mk-ella')).toBeDefined();
		expect(find(links, 'delegated', 'mk-ella', 'mk-luna')?.weight).toBe(1);
		expect(links.filter((l) => l.kind === 'delegated')).toHaveLength(2);
	});

	it('finished work counts for 24 h and is not active; failed, cancelled and old work do not count', () => {
		const links = structuralLinks(
			input({
				workItems: [
					wi({ id: 'a', target: 'mk-luna', delegatedBy: 'mk-ella', status: 'done', completedAt: iso(NOW - 2 * HOUR) }),
					wi({ id: 'b', target: 'dev-max', delegatedBy: 'mk-ella', status: 'done', completedAt: iso(NOW - 30 * HOUR) }),
					wi({ id: 'c', target: 'dev-max', delegatedBy: 'crewly-orc', status: 'cancelled', completedAt: iso(NOW - HOUR) }),
					wi({ id: 'd', target: 'dev-max', delegatedBy: 'crewly-orc', status: 'failed', completedAt: iso(NOW - HOUR) }),
				],
			}),
		);
		expect(find(links, 'delegated', 'mk-ella', 'mk-luna')).toMatchObject({ active: false, weight: 1 });
		expect(links.filter((l) => l.kind === 'delegated')).toHaveLength(1);
	});

	it('keeps cross-machine endpoints and drops unknown local sessions; labels are scrubbed and short', () => {
		const links = structuralLinks(
			input({
				workItems: [
					wi({ id: 'a', target: 'ops-ivy@dev-2', delegatedBy: 'mk-ella', title: `Send the report to ivy@example.com with key sk-ant-api03-THISISAFAKEKEYFORTESTING0123456789abcdef ${'x'.repeat(100)}` }),
					wi({ id: 'b', target: 'ghost-session', delegatedBy: 'mk-ella' }),
				],
			}),
		);
		const l = find(links, 'delegated', 'mk-ella', 'ops-ivy@dev-2');
		expect(l).toBeDefined();
		expect(l?.label?.length).toBeLessThanOrEqual(60);
		expect(l?.label).not.toMatch(/ivy@example|sk-ant/);
		expect(links.some((x) => x.to === 'ghost-session')).toBe(false);
	});
});

describe('structuralLinks: same_task', () => {
	it('links two agents running WorkItems of the same ticket, once, symmetric', () => {
		const links = structuralLinks(
			input({
				workItems: [
					wi({ id: 'a', target: 'mk-luna', projectTaskId: 'CE-7', startedAt: iso(NOW - 30 * MIN), title: 'CE-7 landing page' }),
					wi({ id: 'b', target: 'mk-ella', projectTaskId: 'CE-7', startedAt: iso(NOW - 10 * MIN), title: 'CE-7 review' }),
					wi({ id: 'c', target: 'dev-max', projectTaskId: 'CE-9', startedAt: iso(NOW - 10 * MIN) }),
				],
			}),
		);
		const same = links.filter((l) => l.kind === 'same_task');
		expect(same).toEqual([{ from: 'mk-ella', to: 'mk-luna', kind: 'same_task', active: true, since: iso(NOW - 10 * MIN), label: 'CE-7 landing page' }]);
	});

	it('also joins agents whose current task is the same ticket', () => {
		const t = { id: 'TKT-4', title: 'x', since: iso(NOW - MIN) };
		const links = structuralLinks(input({ tickets: [{ id: 'req-4', label: 'TKT-4', title: 'Fix the login', column: 'in_progress', updatedAt: iso(NOW) }], tasks: new Map([['mk-luna', t], ['dev-max', t]]) }));
		expect(links.filter((l) => l.kind === 'same_task')).toHaveLength(1);
		expect(links.find((l) => l.kind === 'same_task')?.label).toBe('TKT-4 Fix the login');
	});
});

describe('messaging and cap', () => {
	it('records pairs, counts them in the window, marks recent ones active, forgets old ones', () => {
		const r = new AgentInteractionRecorder();
		r.record('mk-ella', 'mk-luna', NOW - 90 * MIN);
		r.record('mk-ella', 'mk-luna', NOW - 2 * MIN);
		r.record('mk-luna', 'dev-max', NOW - 30 * MIN);
		r.record('dev-max', 'mk-ella', NOW - 3 * HOUR);
		r.record('mk-ella', 'mk-ella', NOW);
		const links = messagingLinks(r.pairsNow(NOW), NOW, () => true);
		expect(links).toHaveLength(2);
		expect(links.find((l) => l.from === 'mk-ella')).toEqual({ from: 'mk-ella', to: 'mk-luna', kind: 'messaging', active: true, since: iso(NOW - 90 * MIN), weight: 2 });
		expect(links.find((l) => l.from === 'mk-luna')?.active).toBe(false);
	});

	it('notifies listeners and survives a throwing one', () => {
		const r = new AgentInteractionRecorder();
		const seen: string[] = [];
		r.onRecord(() => {
			throw new Error('x');
		});
		r.onRecord((from, to) => seen.push(`${from}>${to}`));
		r.record('a', 'b');
		expect(seen).toEqual(['a>b']);
	});

	it('capLinks drops messaging first and keeps reporting lines', () => {
		const mk = (kind: 'reports_to' | 'messaging', i: number) => ({ from: `a${i}`, to: `b${i}`, kind, active: true, since: iso(NOW) });
		const links = [...Array.from({ length: 5 }, (_, i) => mk('messaging', i)), ...Array.from({ length: 3 }, (_, i) => mk('reports_to', i))];
		const capped = capLinks(links, 4);
		expect(capped.filter((l) => l.kind === 'reports_to')).toHaveLength(3);
		expect(capped).toHaveLength(4);
		expect(linkKey(capped[0])).toMatch(/^reports_to\|/);
	});
});

describe('hooks', () => {
	function run(method: string, path: string, headers: Record<string, string>, status = 200): AgentInteractionRecorder {
		const r = new AgentInteractionRecorder();
		let finish: () => void = () => undefined;
		const req = { method, path, headers, } as never;
		const res = { statusCode: status, once: (_e: string, fn: () => void) => (finish = fn) } as never;
		const next = jest.fn();
		recordTerminalWrites(r)(req, res, next);
		finish();
		expect(next).toHaveBeenCalledTimes(1);
		return r;
	}

	it('an agent writing to another agent terminal is a message; owner writes and failures are not', () => {
		expect(run('POST', '/terminal/dev-max/write', { 'x-agent-session': 'mk-ella' }).pairsNow().map((p) => `${p.from}>${p.to}`)).toEqual(['mk-ella>dev-max']);
		expect(run('POST', '/terminal/dev-max/write', { 'x-agent-session': 'mk-ella' }, 500).pairsNow()).toEqual([]);
		expect(run('POST', '/terminal/mk-ella/write', { 'x-agent-session': 'mk-ella' }).pairsNow()).toEqual([]);
		expect(run('POST', '/terminal/dev-max/write', {}).pairsNow()).toEqual([]);
		expect(run('GET', '/terminal/dev-max/write', {}).pairsNow()).toEqual([]);
		expect(run('POST', '/other', {}).pairsNow()).toEqual([]);
	});

	it('chat messages from an agent that mention other agents are messages', () => {
		const r = new AgentInteractionRecorder();
		const ids = new Map([['id-ella', 'mk-ella'], ['id-luna', 'mk-luna'], ['mk-ella', 'mk-ella']]);
		recordChatMentions({ senderType: 'agent', senderId: 'mk-ella', mentions: ['id-luna', 'team-9', 'id-ella'] }, (i) => ids.get(i), r);
		recordChatMentions({ senderType: 'user', senderId: 'owner', mentions: ['id-luna'] }, (i) => ids.get(i), r);
		expect(r.pairsNow().map((p) => `${p.from}>${p.to}`)).toEqual(['mk-ella>mk-luna']);
	});
});
