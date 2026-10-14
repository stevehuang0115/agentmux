import { gunzipSync } from 'zlib';
import { BoardActivityTracker } from './board-activity.tracker.js';
import { BoardPushService, fitSnapshot, isBoardPushDisabled } from './board-push.service.js';
import { BoardSnapshotBuilder, type BoardSources } from './board-snapshot.builder.js';
import type { BoardSnapshot } from './board.types.js';
import { BOARD_CONSTANTS as C } from '../../constants.js';

interface Call {
	url: string;
	headers: Record<string, string>;
	body: any;
}

/** Fake timers the test advances by hand. */
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
	get pending(): number {
		return this.timers.length;
	}
	/** Move time forward, firing due timers in order, letting promises settle between. */
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

function setup(opts: { token?: string | null; env?: NodeJS.ProcessEnv; respond?: (call: Call) => { status: number; json?: unknown } } = {}) {
	const clock = new Clock();
	const calls: Call[] = [];
	const tracker = new BoardActivityTracker();
	tracker.setRootsResolver(() => ['/work/crewly']);
	const working = new Set<string>(['a1']);
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
		turnState: (s) => (working.has(s) ? 'working' : 'idle'),
		waitingOnHuman: () => false,
		queuedFor: () => 0,
		stalledBackground: () => null,
		workItems: async () => [],
		tickets: async () => [],
		decisions: async () => [],
		holds: async () => [],
		usage: async () => ({ perAgent: new Map(), taskOf: new Map(), spend: { todayUsd: 0, weekUsd: 0, todayTokens: 0, weekTokens: 0 } }),
		activeWork: async () => new Map(),
	};
	const builder = new BoardSnapshotBuilder(sources, tracker, clock.now);
	const state = { token: opts.token === undefined ? 'tok-1' : opts.token };
	const fetchImpl = async (url: string, init: RequestInit): Promise<Response> => {
		const headers = init.headers as Record<string, string>;
		const raw = init.body as Buffer;
		const body = JSON.parse((headers['Content-Encoding'] === 'gzip' ? gunzipSync(raw) : raw).toString('utf-8'));
		const call = { url, headers, body };
		calls.push(call);
		const r = opts.respond?.(call) ?? { status: 200, json: { success: true, data: { next: { fullAfterSec: 60 } } } };
		return new Response(JSON.stringify(r.json ?? {}), { status: r.status });
	};
	const refresh = jest.fn(async () => true);
	const svc = new BoardPushService({
		builder,
		tracker,
		cloud: { getToken: () => state.token, getCloudUrl: () => (state.token ? 'https://cloud.test/' : null), tryRefreshToken: refresh },
		env: opts.env ?? {},
		fetchImpl,
		now: clock.now,
		setTimeout: clock.setTimeout,
		clearTimeout: clock.clearTimeout,
		logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as never,
	});
	return { svc, clock, calls, tracker, state, refresh, working };
}

const edit = (t: BoardActivityTracker, session: string, file: string, at: number, id = file): void =>
	t.recordHook(session, 'PreToolUse', { toolName: 'Edit', toolInput: { filePath: `/work/crewly/${file}` }, toolUseId: id }, at);

describe('BoardPushService: full snapshots', () => {
	it('pushes a full snapshot at start and then every 60 s, gzipped, with the instance header and bearer', async () => {
		const { svc, clock, calls } = setup();
		svc.start();
		await clock.advance(0);
		await settle();
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe(`https://cloud.test${C.SNAPSHOT_PATH}`);
		expect(calls[0].headers).toMatchObject({ Authorization: 'Bearer tok-1', 'Content-Encoding': 'gzip', 'Content-Type': 'application/json', [C.INSTANCE_HEADER]: 'dev-1' });
		expect((calls[0].body as BoardSnapshot).teams[0].agents.map((a) => a.name)).toEqual(['Ann', 'Bob']);
		await clock.advance(60_000);
		await clock.advance(60_000);
		expect(calls.filter((c) => c.url.endsWith(C.SNAPSHOT_PATH))).toHaveLength(3);
		svc.stop();
	});

	it('follows the cadence Cloud asks for', async () => {
		const { svc, clock, calls } = setup({ respond: () => ({ status: 200, json: { success: true, data: { next: { fullAfterSec: 120 } } } }) });
		svc.start();
		await clock.advance(0);
		await clock.advance(60_000);
		expect(calls).toHaveLength(1);
		await clock.advance(60_000);
		expect(calls).toHaveLength(2);
		svc.stop();
	});

	it('sends nothing when not signed in to Cloud, and starts when the sign-in appears', async () => {
		const { svc, clock, calls, state } = setup({ token: null });
		svc.start();
		await clock.advance(0);
		await clock.advance(60_000);
		expect(calls).toHaveLength(0);
		state.token = 'tok-1';
		await clock.advance(60_000);
		expect(calls).toHaveLength(1);
		svc.stop();
	});

	it('CREWLY_BOARD_PUSH=0 turns the push off', async () => {
		const { svc, clock, calls, tracker } = setup({ env: { CREWLY_BOARD_PUSH: '0' } });
		svc.start();
		edit(tracker, 'a1', 'a.ts', clock.now());
		await clock.advance(120_000);
		expect(calls).toHaveLength(0);
		expect(clock.pending).toBe(0);
		expect(isBoardPushDisabled({ CREWLY_BOARD_PUSH: 'off' })).toBe(true);
		expect(isBoardPushDisabled({ CREWLY_BOARD_PUSH: '1' })).toBe(false);
		expect(isBoardPushDisabled({})).toBe(false);
	});

	it('stop() cancels everything', async () => {
		const { svc, clock, calls } = setup();
		svc.start();
		svc.stop();
		await clock.advance(300_000);
		expect(calls).toHaveLength(0);
	});
});

describe('BoardPushService: deltas', () => {
	async function started() {
		const ctx = setup();
		ctx.svc.start();
		await ctx.clock.advance(0);
		expect(ctx.calls).toHaveLength(1);
		return ctx;
	}

	it('sends a delta within the delay after a change, with the row and the timeline event', async () => {
		const { svc, clock, calls, tracker } = await started();
		edit(tracker, 'a1', 'src/a.ts', clock.now());
		await clock.advance(C.DELTA_DELAY_MS - 1);
		expect(calls).toHaveLength(1);
		await clock.advance(1);
		expect(calls).toHaveLength(2);
		const d = calls[1];
		expect(d.url).toBe(`https://cloud.test${C.DELTA_PATH}`);
		expect(d.body.agents).toHaveLength(1);
		expect(d.body.agents[0]).toMatchObject({ teamId: 't1', session: 'a1', state: 'working', activity: { type: 'coding', detail: 'crewly/src/a.ts' } });
		expect(d.body.timeline).toEqual([expect.objectContaining({ session: 'a1', type: 'coding', text: 'Edited crewly/src/a.ts' })]);
		svc.stop();
	});

	it('debounces: many changes inside the window make one delta carrying the latest rows', async () => {
		const { svc, clock, calls, tracker, working } = await started();
		working.add('a2');
		edit(tracker, 'a1', 'a.ts', clock.now());
		await clock.advance(500);
		edit(tracker, 'a1', 'b.ts', clock.now());
		await clock.advance(500);
		edit(tracker, 'a2', 'c.ts', clock.now());
		await clock.advance(C.DELTA_DELAY_MS);
		const deltas = calls.filter((c) => c.url.endsWith(C.DELTA_PATH));
		expect(deltas).toHaveLength(1);
		expect(deltas[0].body.agents.map((a: any) => [a.session, a.activity.detail]).sort()).toEqual([['a1', 'crewly/b.ts'], ['a2', 'crewly/c.ts']]);
		expect(deltas[0].body.timeline).toHaveLength(3);
		svc.stop();
	});

	it('does not resend a row Cloud already has', async () => {
		const { svc, clock, calls, tracker } = await started();
		edit(tracker, 'a1', 'a.ts', clock.now());
		await clock.advance(C.DELTA_DELAY_MS);
		expect(calls).toHaveLength(2);
		svc.markDirty('a1'); // nothing changed since
		await clock.advance(C.DELTA_DELAY_MS);
		expect(calls).toHaveLength(2);
		svc.stop();
	});

	it('a failed delta keeps the row and the timeline for the next try', async () => {
		let fail = true;
		const { svc, clock, calls, tracker } = setup({ respond: (c) => (c.url.endsWith(C.DELTA_PATH) && fail ? { status: 500 } : { status: 200, json: {} }) });
		svc.start();
		await clock.advance(0);
		edit(tracker, 'a1', 'a.ts', clock.now());
		await clock.advance(C.DELTA_DELAY_MS);
		expect(calls).toHaveLength(2);
		expect(tracker.peekUnsent(['a1'])).toHaveLength(1); // not acknowledged
		fail = false;
		await clock.advance(C.BACKOFF_INITIAL_MS + 1); // the full snapshot comes back after the backoff
		expect(calls.filter((c) => c.url.endsWith(C.SNAPSHOT_PATH))).toHaveLength(2);
		// the snapshot repaired the rows; the timeline event goes out in a delta after it
		const sent = calls.filter((c) => c.url.endsWith(C.DELTA_PATH) && c.body.timeline && c.body.timeline.length > 0);
		expect(sent.length).toBeGreaterThan(0);
		expect(tracker.peekUnsent(['a1'])).toHaveLength(0);
		svc.stop();
	});

	it('no delta before the first full snapshot has been accepted', async () => {
		const { svc, clock, calls, tracker } = setup({ respond: () => ({ status: 500 }) });
		svc.start();
		await clock.advance(0);
		expect(calls).toHaveLength(1);
		edit(tracker, 'a1', 'a.ts', clock.now());
		await clock.advance(C.DELTA_DELAY_MS);
		expect(calls).toHaveLength(1);
		svc.stop();
	});

	it('is cheap: an idle machine with no changes sends only the periodic full snapshot', async () => {
		const { svc, clock, calls } = await started();
		await clock.advance(5 * 60_000);
		expect(calls.every((c) => c.url.endsWith(C.SNAPSHOT_PATH))).toBe(true);
		expect(calls).toHaveLength(6);
		svc.stop();
	});
});

describe('BoardPushService: backoff and pauses', () => {
	it('backs off exponentially after failures and resets on success', async () => {
		let status = 500;
		const { svc, clock, calls } = setup({ respond: () => ({ status, json: {} }) });
		svc.start();
		await clock.advance(0); // fail #1 -> wait 5 s
		expect(calls).toHaveLength(1);
		await clock.advance(C.BACKOFF_INITIAL_MS - 1);
		expect(calls).toHaveLength(1);
		await clock.advance(1); // fail #2 -> wait 10 s
		expect(calls).toHaveLength(2);
		await clock.advance(C.BACKOFF_INITIAL_MS * 2 - 1);
		expect(calls).toHaveLength(2);
		await clock.advance(1); // fail #3 -> wait 20 s
		expect(calls).toHaveLength(3);
		status = 200;
		await clock.advance(C.BACKOFF_INITIAL_MS * 4);
		expect(calls).toHaveLength(4);
		await clock.advance(60_000); // back to the normal cadence
		expect(calls).toHaveLength(5);
		svc.stop();
	});

	it('caps the backoff', async () => {
		const { svc, clock, calls } = setup({ respond: () => ({ status: 500 }) });
		svc.start();
		await clock.advance(0);
		await clock.advance(2 * 60 * 60_000);
		const n = calls.length;
		// at most one attempt per max backoff once it is capped
		expect(n).toBeLessThanOrEqual(2 + Math.ceil((2 * 60 * 60_000) / C.BACKOFF_MAX_MS) + 3);
		svc.stop();
	});

	it('pauses for a long time when Cloud does not take board pushes (404)', async () => {
		const { svc, clock, calls } = setup({ respond: () => ({ status: 404 }) });
		svc.start();
		await clock.advance(0);
		await clock.advance(C.UNAVAILABLE_RETRY_MS - 1000);
		expect(calls).toHaveLength(1);
		await clock.advance(2000);
		expect(calls).toHaveLength(2);
		svc.stop();
	});

	it('a 401 asks for a token refresh', async () => {
		const { svc, clock, refresh } = setup({ respond: () => ({ status: 401 }) });
		svc.start();
		await clock.advance(0);
		expect(refresh).toHaveBeenCalled();
		svc.stop();
	});

	it('a network error is a failure, not a crash', async () => {
		const clock = new Clock();
		const tracker = new BoardActivityTracker();
		const builder = { build: async () => ({ v: 1, instanceId: 'x', machineName: 'm', crewlyVersion: '1', generatedAt: '', outcomes: { doneToday: [], doneTodaySummary: [], waitingOnOwner: [], stuck: [], spend: { todayUsd: 0, weekUsd: 0, todayTokens: 0, weekTokens: 0 } }, teams: [] }), primed: true, rows: () => [], identity: async () => ({ instanceId: 'x' }) } as unknown as BoardSnapshotBuilder;
		const svc = new BoardPushService({
			builder,
			tracker,
			cloud: { getToken: () => 't', getCloudUrl: () => 'https://c' },
			env: {},
			fetchImpl: async () => {
				throw new Error('ECONNRESET');
			},
			now: clock.now,
			setTimeout: clock.setTimeout,
			clearTimeout: clock.clearTimeout,
			logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as never,
		});
		await expect(svc.pushFull()).resolves.toBe('failed');
	});
});

describe('fitSnapshot', () => {
	it('keeps a small snapshot as it is and trims an oversized one under the limit', () => {
		const big: BoardSnapshot = {
			v: 1,
			instanceId: 'x',
			machineName: 'm',
			crewlyVersion: '1',
			generatedAt: '',
			outcomes: {
				doneToday: Array.from({ length: 3000 }, (_, i) => ({ title: 'x'.repeat(140), result: 'task done', team: 't', at: String(i) })),
				doneTodaySummary: [],
				waitingOnOwner: [],
				stuck: [],
				spend: { todayUsd: 0, weekUsd: 0, todayTokens: 0, weekTokens: 0 },
			},
			teams: [],
		};
		fitSnapshot(big);
		expect(Buffer.byteLength(JSON.stringify(big))).toBeLessThanOrEqual(C.MAX_BODY_BYTES);
		expect(big.outcomes.doneToday.length).toBeGreaterThan(0);
	});
});
