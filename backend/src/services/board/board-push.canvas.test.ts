import { gunzipSync } from 'zlib';
import { BoardActivityTracker } from './board-activity.tracker.js';
import { BoardPushService } from './board-push.service.js';
import { BoardSnapshotBuilder, type BoardSources } from './board-snapshot.builder.js';
import { BOARD_CONSTANTS as C, CANVAS_CONSTANTS as CV } from '../../constants.js';

interface Call {
	url: string;
	body: any;
}

class Clock {
	t = Date.parse('2026-10-12T10:00:00.000Z');
	private timers: Array<{ id: number; at: number; fn: () => void }> = [];
	private seq = 0;
	now = (): number => this.t;
	setTimeout = (fn: () => void, ms: number): ReturnType<typeof setTimeout> => {
		const id = (this.seq += 1);
		this.timers.push({ id, at: this.t + ms, fn });
		return id as unknown as ReturnType<typeof setTimeout>;
	};
	clearTimeout = (h: ReturnType<typeof setTimeout>): void => {
		this.timers = this.timers.filter((x) => x.id !== (h as unknown as number));
	};
	async advance(ms: number): Promise<void> {
		const end = this.t + ms;
		for (;;) {
			const due = this.timers.filter((x) => x.at <= end).sort((a, b) => a.at - b.at)[0];
			if (!due) break;
			this.timers = this.timers.filter((x) => x !== due);
			this.t = Math.max(this.t, due.at);
			due.fn();
			await settle();
		}
		this.t = end;
	}
}
const settle = async (): Promise<void> => {
	for (let i = 0; i < 30; i += 1) await new Promise<void>((r) => setImmediate(r));
};

function setup(respond?: (call: Call) => { status: number; json?: unknown }) {
	const clock = new Clock();
	const calls: Call[] = [];
	const tracker = new BoardActivityTracker();
	tracker.setRootsResolver(() => ['/work/crewly']);
	const sources: BoardSources = {
		identity: async () => ({ instanceId: 'dev-1', machineName: 'Mac' }),
		version: async () => '1.0.0',
		teams: async () => [
			{
				teamId: 't1',
				name: 'Team',
				members: [
					{ session: 'a1', name: 'Ann', role: 'dev', runtime: 'claude-code', agentStatus: 'active', workingStatus: 'idle' },
					{ session: 'a2', name: 'Bob', role: 'dev', runtime: 'claude-code', agentStatus: 'active', workingStatus: 'idle' },
				],
			},
		],
		turnState: () => 'working',
		waitingOnHuman: () => false,
		queuedFor: () => 0,
		stalledBackground: () => null,
		workItems: async () => [],
		tickets: async () => [],
		decisions: async () => [],
		holds: async () => [],
		usage: async () => ({ perAgent: new Map(), taskOf: new Map(), spend: { todayUsd: 0, weekUsd: 0, todayTokens: 0, weekTokens: 0 } }),
		activeWork: async () => new Map(),
		capabilities: (session, info) => ({ hasBrowser: false, hasTerminal: !info.stopped, canMessage: true, canStop: session !== 'orc' }),
	};
	const builder = new BoardSnapshotBuilder(sources, tracker, clock.now);
	const svc = new BoardPushService({
		builder,
		tracker,
		cloud: { getToken: () => 'tok', getCloudUrl: () => 'https://cloud.test' },
		env: {},
		fetchImpl: async (url, init) => {
			const body = JSON.parse(gunzipSync(init.body as Buffer).toString('utf-8'));
			const call = { url, body };
			calls.push(call);
			const r = respond?.(call) ?? { status: 200, json: { success: true, data: { next: { fullAfterSec: 60 } } } };
			return new Response(JSON.stringify(r.json ?? {}), { status: r.status });
		},
		now: clock.now,
		setTimeout: clock.setTimeout,
		clearTimeout: clock.clearTimeout,
		logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as never,
	});
	return { svc, clock, calls, tracker };
}

const deltas = (calls: Call[]): Call[] => calls.filter((c) => c.url.endsWith(C.DELTA_PATH));
const pre = (t: BoardActivityTracker, session: string, id: string, at: number, command = 'npm test'): void =>
	t.recordHook(session, 'PreToolUse', { toolName: 'Bash', toolInput: { command }, toolUseId: id }, at);

async function started(respond?: (call: Call) => { status: number; json?: unknown }) {
	const ctx = setup(respond);
	ctx.svc.start();
	await ctx.clock.advance(0);
	expect(ctx.calls).toHaveLength(1);
	return ctx;
}

describe('canvas steps in board deltas', () => {
	it('a tool call goes out running, then again with its duration and status (same id)', async () => {
		const { svc, clock, calls, tracker } = await started();
		pre(tracker, 'a1', 'tool-1', clock.now());
		await clock.advance(C.DELTA_DELAY_MS);
		expect(deltas(calls)).toHaveLength(1);
		expect(deltas(calls)[0].body.steps).toEqual([expect.objectContaining({ session: 'a1', id: 'tool-1', kind: 'command', label: 'Ran', target: 'npm test', status: 'running' })]);
		tracker.recordHook('a1', 'PostToolUse', { toolUseId: 'tool-1' }, clock.now());
		await clock.advance(C.DELTA_DELAY_MS);
		expect(deltas(calls)).toHaveLength(2);
		expect(deltas(calls)[1].body.steps).toEqual([expect.objectContaining({ id: 'tool-1', status: 'done', durationMs: C.DELTA_DELAY_MS })]);
		expect(deltas(calls)[1].body.agents).toEqual([]);
		svc.stop();
	});

	it('steps are not sent twice once Cloud took them', async () => {
		const { svc, clock, calls, tracker } = await started();
		pre(tracker, 'a1', 't1', clock.now());
		tracker.recordHook('a1', 'PostToolUse', { toolUseId: 't1' }, clock.now());
		await clock.advance(C.DELTA_DELAY_MS);
		await clock.advance(120_000);
		expect(deltas(calls).filter((d) => d.body.steps)).toHaveLength(1);
		svc.stop();
	});

	it('a failed push keeps the steps for the next one', async () => {
		let fail = true;
		const { svc, clock, calls, tracker } = await started((call) => (call.url.endsWith(C.DELTA_PATH) && fail ? { status: 500 } : { status: 200, json: { data: { next: { fullAfterSec: 60 } } } }));
		pre(tracker, 'a1', 't1', clock.now());
		await clock.advance(C.DELTA_DELAY_MS);
		expect(deltas(calls)).toHaveLength(1);
		fail = false;
		await clock.advance(10 * 60_000);
		const withSteps = calls.filter((c) => c.body.steps?.some((s: { id: string }) => s.id === 't1'));
		expect(withSteps.length).toBeGreaterThanOrEqual(2);
		svc.stop();
	});

	it('steps that arrive with the next full snapshot go in a delta right after it', async () => {
		const { svc, clock, calls, tracker } = await started();
		await clock.advance(59_000);
		pre(tracker, 'a2', 'late', clock.now() + 1_500);
		await clock.advance(2_500);
		expect(calls.some((c) => c.body.steps?.some((s: { id: string }) => s.id === 'late'))).toBe(true);
		svc.stop();
	});

	it('caps the steps of one delta and sends the rest in the next', async () => {
		const { svc, clock, calls, tracker } = await started();
		for (let i = 0; i < 100; i += 1) pre(tracker, 'a1', `x${i}`, clock.now() + i, 'ls');
		for (let i = 0; i < 100; i += 1) pre(tracker, 'a2', `y${i}`, clock.now() + i, 'ls');
		await clock.advance(C.DELTA_DELAY_MS);
		const first = deltas(calls)[0].body.steps as Array<{ session: string }>;
		expect(first.length).toBeLessThanOrEqual(CV.DELTA_STEPS_MAX);
		expect(first.filter((s) => s.session === 'a1').length).toBeLessThanOrEqual(CV.DELTA_STEPS_PER_AGENT_MAX);
		await clock.advance(10 * C.DELTA_DELAY_MS);
		const ids = new Set(deltas(calls).flatMap((d) => (d.body.steps ?? []).map((s: { id: string }) => s.id)));
		expect(ids.size).toBeGreaterThan(first.length);
		svc.stop();
	});

	it('rows carry the capabilities', async () => {
		const { svc, clock, calls, tracker } = await started();
		expect(calls[0].body.teams[0].agents[0].capabilities).toEqual({ hasBrowser: false, hasTerminal: true, canMessage: true, canStop: true });
		pre(tracker, 'a1', 't1', clock.now());
		await clock.advance(C.DELTA_DELAY_MS);
		expect(deltas(calls)[0].body.agents[0].capabilities).toMatchObject({ canMessage: true });
		svc.stop();
	});
});

describe('live cadence', () => {
	const liveAnswer = { status: 200, json: { success: true, data: { live: true, viewers: 2, next: { fullAfterSec: 60 } } } };

	it('without viewers a change is pushed after the normal delay', async () => {
		const { svc, clock, calls, tracker } = await started();
		expect(svc.isLive()).toBe(false);
		pre(tracker, 'a1', 't1', clock.now());
		await clock.advance(CV.LIVE_DELTA_DELAY_MS + 100);
		expect(deltas(calls)).toHaveLength(0);
		await clock.advance(C.DELTA_DELAY_MS);
		expect(deltas(calls)).toHaveLength(1);
		svc.stop();
	});

	it('once Cloud says viewers are watching, changes go out within a second or so', async () => {
		const { svc, clock, calls, tracker } = await started((call) => (call.url.endsWith(C.DELTA_PATH) ? liveAnswer : { status: 200, json: { data: { next: { fullAfterSec: 60 } } } }));
		pre(tracker, 'a1', 't1', clock.now());
		await clock.advance(C.DELTA_DELAY_MS);
		expect(svc.isLive()).toBe(true);
		for (let i = 2; i < 6; i += 1) {
			pre(tracker, 'a1', `t${i}`, clock.now());
			await clock.advance(CV.LIVE_DELTA_DELAY_MS);
		}
		expect(deltas(calls).length).toBeGreaterThanOrEqual(5);
		svc.stop();
	});

	it('understands viewers > 0 and the answer under next, and falls back when Cloud says nobody watches', async () => {
		let answer: unknown = { data: { next: { viewers: 3, fullAfterSec: 60 } } };
		const { svc, clock, tracker } = await started((call) => (call.url.endsWith(C.DELTA_PATH) ? { status: 200, json: answer } : { status: 200, json: { data: { next: { fullAfterSec: 60 } } } }));
		pre(tracker, 'a1', 't1', clock.now());
		await clock.advance(C.DELTA_DELAY_MS);
		expect(svc.isLive()).toBe(true);
		answer = { data: { live: false } };
		pre(tracker, 'a1', 't2', clock.now());
		await clock.advance(C.DELTA_DELAY_MS);
		expect(svc.isLive()).toBe(false);
		svc.stop();
	});

	it('a live answer is believed only for 30 s', async () => {
		const { svc, clock, tracker } = await started((call) => (call.url.endsWith(C.DELTA_PATH) ? liveAnswer : { status: 200, json: { data: { next: { fullAfterSec: 60 } } } }));
		pre(tracker, 'a1', 't1', clock.now());
		await clock.advance(C.DELTA_DELAY_MS);
		expect(svc.isLive()).toBe(true);
		await clock.advance(CV.LIVE_TTL_MS + 1);
		expect(svc.isLive()).toBe(false);
		svc.stop();
	});

	it('an owner action marks the canvas watched', async () => {
		const { svc, clock } = await started();
		svc.noteViewer();
		expect(svc.isLive()).toBe(true);
		await clock.advance(CV.LIVE_TTL_MS + 1);
		expect(svc.isLive()).toBe(false);
		svc.stop();
	});
});
