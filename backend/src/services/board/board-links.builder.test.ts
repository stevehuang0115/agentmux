import { gunzipSync } from 'zlib';
import { AgentInteractionRecorder } from './board-interactions.js';
import { BoardActivityTracker } from './board-activity.tracker.js';
import { BoardPushService } from './board-push.service.js';
import { BoardSnapshotBuilder, type BoardSources, type BoardTeamInfo, type BoardWorkItem } from './board-snapshot.builder.js';
import type { BoardDelta, BoardSnapshot } from './board.types.js';

const NOW = Date.parse('2026-10-12T12:00:00.000Z');
const MIN = 60_000;
const iso = (ms: number): string => new Date(ms).toISOString();
const m = (session: string, role: string, agentStatus = 'active') => ({ session, id: `id-${session}`, name: session, role, runtime: 'claude-code', agentStatus, workingStatus: 'idle' });

const TEAMS: BoardTeamInfo[] = [
	{ teamId: 'orchestrator', name: 'Orchestrator', members: [m('crewly-orc', 'orchestrator')] },
	{
		teamId: 'mk',
		name: 'Marketing',
		createdAt: '2026-05-03T00:00:00.000Z',
		leaders: ['mk-ella'],
		projects: [{ id: 'p-web', name: 'Crewly Web' }],
		members: [m('mk-ella', 'team-leader'), m('mk-luna', 'writer'), m('mk-old', 'writer', 'inactive')],
	},
];

const WORK: BoardWorkItem[] = [
	{ id: 'wi-1', title: 'Write the launch post', type: 'delegate', status: 'running', owner: 'team_lead', delegatedBy: 'mk-ella', projectId: 'p-site', target: 'mk-luna', createdAt: iso(NOW - 20 * MIN), startedAt: iso(NOW - 15 * MIN) },
	{ id: 'wi-0', title: 'Old', type: 'delegate', status: 'verified', target: 'mk-old', createdAt: iso(NOW - 5 * 3_600_000), completedAt: iso(NOW - 4 * 3_600_000) },
];

function sources(over: Partial<BoardSources> = {}): BoardSources {
	return {
		identity: async () => ({ instanceId: 'dev-1', machineName: 'Mac' }),
		version: async () => '1.0.0',
		teams: async () => TEAMS,
		turnState: (s) => (s === 'mk-luna' ? 'working' : 'idle'),
		waitingOnHuman: () => false,
		queuedFor: () => 0,
		stalledBackground: () => null,
		workItems: async () => WORK,
		tickets: async () => [],
		decisions: async () => [],
		holds: async () => [],
		usage: async () => ({ perAgent: new Map(), taskOf: new Map(), spend: { todayUsd: 0, weekUsd: 0, todayTokens: 0, weekTokens: 0 } }),
		activeWork: async () => new Map([['mk-luna', { id: 'wi-1', title: 'Write the launch post', since: iso(NOW - 15 * MIN) }]]),
		projects: async () => [{ id: 'p-site', name: 'Crewly Site' }],
		...over,
	};
}

describe('snapshot: projects, recency, links', () => {
	it('puts projects on teams and agents (own current project, else the team fallback)', async () => {
		const recorder = new AgentInteractionRecorder();
		const s = await new BoardSnapshotBuilder(sources(), new BoardActivityTracker(), () => NOW, recorder).build();
		const mk = s.teams[1];
		expect(mk.projects).toEqual([{ id: 'p-web', name: 'Crewly Web' }]);
		const luna = mk.agents.find((a) => a.session === 'mk-luna');
		expect(luna).toMatchObject({ projects: [{ id: 'p-site', name: 'Crewly Site' }], projectKnown: true });
		const ella = mk.agents.find((a) => a.session === 'mk-ella');
		expect(ella?.projects).toEqual([{ id: 'p-web', name: 'Crewly Web' }]);
		expect(ella?.projectKnown).toBeUndefined();
		expect(s.teams[0].agents[0].projects).toBeUndefined();
	});

	it('lastActiveAt: now (minute) while working, last WorkItem activity otherwise, absent when never seen', async () => {
		const s = await new BoardSnapshotBuilder(sources(), new BoardActivityTracker(), () => NOW, new AgentInteractionRecorder()).build();
		const by = (name: string) => s.teams[1].agents.find((a) => a.session === name);
		expect(by('mk-luna')?.lastActiveAt).toBe(iso(Math.floor(NOW / MIN) * MIN));
		expect(by('mk-old')?.lastActiveAt).toBe(iso(Math.floor((NOW - 4 * 3_600_000) / MIN) * MIN));
		expect(by('mk-ella')?.lastActiveAt).toBeUndefined();
	});

	it('remembers when an agent was last busy after it goes idle', async () => {
		let working = true;
		let now = NOW;
		const b = new BoardSnapshotBuilder(sources({ turnState: (s) => (s === 'mk-luna' && working ? 'working' : 'idle') }), new BoardActivityTracker(), () => now, new AgentInteractionRecorder());
		await b.build();
		working = false;
		now = NOW + 30 * MIN;
		const luna = b.rows(['mk-luna'])[0];
		expect(luna.state).toBe('idle');
		expect(luna.lastActiveAt).toBe(iso(Math.floor(NOW / MIN) * MIN));
	});

	it('emits reporting, delegation and recorded messaging links', async () => {
		const recorder = new AgentInteractionRecorder();
		recorder.record('mk-luna', 'mk-ella', NOW - MIN);
		const s = await new BoardSnapshotBuilder(sources(), new BoardActivityTracker(), () => NOW, recorder).build();
		const kinds = (s.links ?? []).map((l) => `${l.kind}:${l.from}>${l.to}`).sort();
		expect(kinds).toEqual(['delegated:mk-ella>mk-luna', 'messaging:mk-luna>mk-ella', 'reports_to:mk-ella>crewly-orc', 'reports_to:mk-luna>mk-ella', 'reports_to:mk-old>mk-ella'].sort());
		expect((s.links ?? []).find((l) => l.kind === 'reports_to' && l.from === 'mk-old')?.active).toBe(false);
	});

	it('a failing source degrades to no links, not a failed build', async () => {
		const s = await new BoardSnapshotBuilder(sources({ workItems: async () => { throw new Error('x'); }, projects: async () => { throw new Error('y'); } }), new BoardActivityTracker(), () => NOW, new AgentInteractionRecorder()).build();
		expect((s.links ?? []).every((l) => l.kind === 'reports_to')).toBe(true);
	});
});

describe('push: links in the snapshot and in deltas', () => {
	function setup() {
		const recorder = new AgentInteractionRecorder();
		const tracker = new BoardActivityTracker();
		const calls: Array<{ url: string; body: BoardSnapshot & BoardDelta }> = [];
		const timers: Array<() => void> = [];
		let now = NOW;
		const builder = new BoardSnapshotBuilder(sources(), tracker, () => now, recorder);
		const svc = new BoardPushService({
			builder,
			tracker,
			interactions: recorder,
			cloud: { getToken: () => 'tok', getCloudUrl: () => 'https://cloud.test' },
			env: {},
			now: () => now,
			setTimeout: ((fn: () => void) => (timers.push(fn), timers.length)) as never,
			clearTimeout: (() => undefined) as never,
			fetchImpl: async (url, init) => {
				const raw = init.body as Buffer;
				calls.push({ url, body: JSON.parse(gunzipSync(raw).toString('utf-8')) });
				return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
			},
			logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as never,
		});
		return { svc, recorder, calls, clock: () => now, tick: (ms: number) => { now += ms; } };
	}

	it('sends the full link set in the snapshot, then only changed and removed links in a delta after a message', async () => {
		const { svc, recorder, calls, clock, tick } = setup();
		svc.start();
		expect(await svc.pushFull()).toBe('sent');
		const full = calls[0].body;
		expect(full.links?.some((l) => l.kind === 'delegated')).toBe(true);
		expect(full.links?.some((l) => l.kind === 'messaging')).toBe(false);

		// no message: a delta for an unchanged agent sends nothing
		svc.markDirty('mk-ella');
		expect(await svc.flushDelta()).toBe('nothing');

		recorder.record('mk-ella', 'mk-luna', clock());
		expect(await svc.flushDelta()).toBe('sent');
		const delta = calls[1].body;
		expect(calls[1].url).toMatch(/delta$/);
		expect(delta.links).toEqual([expect.objectContaining({ kind: 'messaging', from: 'mk-ella', to: 'mk-luna', active: true, weight: 1 })]);
		expect(delta.removedLinks).toBeUndefined();

		// the same state again: nothing to send
		svc.markDirty('mk-ella');
		expect(await svc.flushDelta()).toBe('nothing');

		// the pair goes out of the window: a message elsewhere reports the removal
		tick(3 * 3_600_000);
		recorder.record('mk-luna', 'mk-ella', clock());
		expect(await svc.flushDelta()).toBe('sent');
		expect(calls[2].body.removedLinks).toEqual(['messaging|mk-ella|mk-luna']);
		svc.stop();
	});
});
