import { RestoreQueue, orderRestoreEntries, restoreConcurrencyFromEnv, RESTORE_TIER, type RestoreEntry, type RestoreQueueOptions } from './restore-queue.js';
import { BOOT_PRESSURE_CONSTANTS } from '../../constants.js';
import { bootPressureThresholds, type BootPressureSnapshot } from './boot-pressure.js';

const tick = () => new Promise((r) => setImmediate(r));

const CALM: BootPressureSnapshot = { usedPercent: 60, freeMB: 6000, swapUsedPercent: 20, osPressure: false, pressureMode: false };
const TIGHT: BootPressureSnapshot = { usedPercent: 84.4, freeMB: 2552, swapUsedPercent: 95.2, osPressure: true, pressureMode: false };

/** A queue with a calm machine and no real waits (the memory tests below inject their own). */
function queue(concurrency: number, timeoutMs: number, opts: RestoreQueueOptions = {}): RestoreQueue {
	return new RestoreQueue(concurrency, timeoutMs, { snapshot: () => CALM, sleep: async () => undefined, onLaunch: () => undefined, thresholds: bootPressureThresholds({}), ...opts });
}

/** An entry whose run() the test settles by hand. */
function entry(name: string, tier: number, extra: Partial<RestoreEntry> = {}) {
	const started: number[] = [];
	let settle: (ok: boolean) => void = () => undefined;
	const e: RestoreEntry = {
		name, tier, reason: 'test',
		run: (attempt) => { started.push(attempt); return new Promise((res) => { settle = (ok) => res({ success: ok }); }); },
		...extra,
	};
	return { e, started, finish: (ok = true) => settle(ok) };
}

describe('restore queue', () => {
	it('orders owner (oldest first), orchestrator, leads, others', () => {
		const mk = (name: string, tier: number, ownerSince?: number) => ({ name, tier, reason: '', ownerSince, run: async () => ({ success: true }) });
		const order = orderRestoreEntries([
			mk('dev', RESTORE_TIER.OTHER), mk('lead', RESTORE_TIER.LEAD), mk('orc', RESTORE_TIER.ORCHESTRATOR),
			mk('o2', RESTORE_TIER.OWNER, 200), mk('o1', RESTORE_TIER.OWNER, 100),
		]).map((e) => e.name);
		expect(order).toEqual(['o1', 'o2', 'orc', 'lead', 'dev']);
	});

	it('clamps concurrency from env', () => {
		expect(restoreConcurrencyFromEnv(undefined)).toBe(1);
		expect(restoreConcurrencyFromEnv('2')).toBe(2);
		expect(restoreConcurrencyFromEnv('9')).toBe(3);
		expect(restoreConcurrencyFromEnv('0')).toBe(1);
	});

	it('starts the next agent only when the previous one is ready (concurrency 1)', async () => {
		const a = entry('a', 4); const b = entry('b', 4);
		const q = queue(1, 60_000);
		const done = q.start([a.e, b.e]);
		await tick();
		expect(a.started).toEqual([0]); expect(b.started).toEqual([]);
		expect(q.stats()).toMatchObject({ pending: 1, started: 1, ready: 0 });
		a.finish(); await tick(); await tick();
		expect(b.started).toEqual([0]);
		b.finish(); await done;
		expect(q.stats()).toMatchObject({ running: false, pending: 0, ready: 2 });
	});

	it('runs up to the concurrency limit', async () => {
		const [a, b, c] = ['a', 'b', 'c'].map((n) => entry(n, 4));
		const q = queue(2, 60_000);
		const done = q.start([a.e, b.e, c.e]);
		await tick();
		expect([a.started.length, b.started.length, c.started.length]).toEqual([1, 1, 0]);
		a.finish(); b.finish(); await tick(); await tick(); c.finish(); await done;
	});

	it('moves an agent to the front on an owner wake, keeps order on other wakes', async () => {
		const a = entry('a', 4); const b = entry('b', 4); const c = entry('c', 4);
		const q = queue(1, 60_000);
		const done = q.start([a.e, b.e, c.e]);
		await tick();
		expect(q.wake('c', false)).toBe(true);
		expect(q.stats().order).toEqual(['b', 'c']);
		expect(q.wake('c', true)).toBe(true);
		expect(q.stats().order).toEqual(['c', 'b']);
		expect(q.wake('a', true)).toBe(false); // already started
		a.finish(); await tick(); await tick();
		expect(c.started).toEqual([0]); expect(b.started).toEqual([]);
		c.finish(); await tick(); await tick(); b.finish(); await done;
	});

	it('moves on after the per-agent timeout and retries it once later', async () => {
		jest.useFakeTimers();
		try {
			const a = entry('a', 4); const b = entry('b', 4);
			const q = queue(1, 1000);
			const done = q.start([a.e, b.e]);
			await jest.advanceTimersByTimeAsync(1001);
			expect(b.started).toEqual([0]);
			b.finish();
			await jest.advanceTimersByTimeAsync(1);
			expect(a.started).toEqual([0, 1]);
			a.finish();
			await jest.advanceTimersByTimeAsync(1);
			await done;
			expect(q.stats()).toMatchObject({ timedOut: 1, ready: 2, failed: 0 });
		} finally { jest.useRealTimers(); }
	});

	it('gives up after the retry times out too', async () => {
		jest.useFakeTimers();
		try {
			const a = entry('a', 4);
			const q = queue(1, 1000);
			const done = q.start([a.e]);
			await jest.advanceTimersByTimeAsync(2100);
			await done;
			expect(q.stats()).toMatchObject({ timedOut: 2, failed: 1, ready: 0 });
		} finally { jest.useRealTimers(); }
	});

	it('runs onReady per agent right after it registers, before the next starts', async () => {
		const calls: string[] = [];
		const a = entry('a', 4, { onReady: async () => { calls.push('recover-a'); } });
		const b = entry('b', 4, { onReady: async () => { calls.push('recover-b'); } });
		const q = queue(1, 60_000);
		const done = q.start([a.e, b.e]);
		await tick();
		expect(calls).toEqual([]);
		a.finish(); await tick(); await tick();
		expect(calls).toEqual(['recover-a']); expect(b.started).toEqual([0]);
		b.finish(); await done;
		expect(calls).toEqual(['recover-a', 'recover-b']);
	});

	it('counts a failed start and carries on', async () => {
		const a = entry('a', 4); const b = entry('b', 4);
		const q = queue(1, 60_000);
		const done = q.start([a.e, b.e]);
		await tick(); a.finish(false); await tick(); await tick(); b.finish(); await done;
		expect(q.stats()).toMatchObject({ failed: 1, ready: 1 });
	});
});

describe('restore queue under memory pressure (crewly#1353)', () => {
	/** Fake clock: a sleep advances it, is recorded, and yields one macrotask so a test can step the queue with tick(). */
	function clock() {
		let t = 0;
		const waits: number[] = [];
		return {
			now: () => t,
			sleep: async (ms: number) => { waits.push(ms); t += ms; await tick(); },
			waits,
			advance: (ms: number) => { t += ms; },
		};
	}
	const ticks = async (n: number) => { for (let i = 0; i < n; i++) await tick(); };

	it('leaves the launch spacing between launches even when memory is calm', async () => {
		const c = clock();
		const a = entry('a', 4); const b = entry('b', 4);
		const q = queue(1, 60_000, { now: c.now, sleep: c.sleep });
		const done = q.start([a.e, b.e]);
		await tick();
		expect(c.waits).toEqual([]); // the first launch waits for nothing
		a.finish(); await ticks(4);
		expect(c.waits).toEqual([BOOT_PRESSURE_CONSTANTS.MIN_LAUNCH_SPACING_MS]);
		expect(b.started).toEqual([0]);
		b.finish(); await done;
	});

	it('defers agents nobody waits on to the retry while memory is tight, with the reading, and launches the owner-waiting ones', async () => {
		const c = clock();
		const deferred: Array<[string, BootPressureSnapshot | null, string]> = [];
		const owner = entry('ella', RESTORE_TIER.OWNER, { essential: true });
		const dev = entry('max', RESTORE_TIER.OTHER, { onDeferred: (snap, why) => deferred.push(['max', snap, why]) });
		const lead = entry('owen', RESTORE_TIER.LEAD, { onDeferred: (snap, why) => deferred.push(['owen', snap, why]) });
		const q = queue(1, 60_000, { now: c.now, sleep: c.sleep, snapshot: () => TIGHT, holdMaxMs: 0 });
		const done = q.start([owner.e, lead.e, dev.e]);
		await tick();
		expect(owner.started).toEqual([0]);
		owner.finish(); await tick(); await tick(); await tick();
		await done;
		expect(lead.started).toEqual([]); expect(dev.started).toEqual([]);
		expect(deferred.map(([n]) => n)).toEqual(['owen', 'max']);
		expect(deferred[0][1]).toEqual(TIGHT);
		expect(deferred[0][2]).toMatch(/swap 95.2% >= 80%, free 2552MB < 3072MB/);
		expect(q.stats()).toMatchObject({ ready: 1, deferred: 2, failed: 0, pending: 0 });
	});

	it('under pressure waits for the previous launch to settle and the reading to clear before the next owner-waiting launch', async () => {
		const c = clock();
		// Memory eases 50 s into the boot.
		const a = entry('a', RESTORE_TIER.OWNER, { essential: true });
		const b = entry('b', RESTORE_TIER.OWNER, { essential: true });
		const q = queue(1, 60_000, { now: c.now, sleep: c.sleep, snapshot: () => (c.now() >= 50_000 ? CALM : TIGHT) });
		const done = q.start([a.e, b.e]);
		await tick();
		expect(a.started).toEqual([0]); // the first owner-waiting launch goes at once
		expect(c.waits).toEqual([]);
		a.finish();
		// b: settle 20 s after a registered, then poll every 10 s while tight.
		await ticks(3);
		expect(c.waits[0]).toBe(BOOT_PRESSURE_CONSTANTS.SETTLE_AFTER_READY_MS);
		expect(b.started).toEqual([]);
		await ticks(8);
		expect(c.waits).toEqual([BOOT_PRESSURE_CONSTANTS.SETTLE_AFTER_READY_MS, 10_000, 10_000, 10_000]);
		expect(b.started).toEqual([0]);
		b.finish(); await done;
		expect(q.stats()).toMatchObject({ ready: 2, deferred: 0 });
	});

	it('launches an owner-waiting agent anyway once it has been held for the hold cap', async () => {
		const c = clock();
		const a = entry('a', RESTORE_TIER.OWNER, { essential: true });
		const b = entry('b', RESTORE_TIER.OWNER, { essential: true });
		const q = queue(1, 60_000, { now: c.now, sleep: c.sleep, snapshot: () => TIGHT, holdMaxMs: 30_000 });
		const done = q.start([a.e, b.e]);
		await tick(); a.finish();
		await ticks(12);
		expect(b.started).toEqual([0]);
		expect(c.waits.reduce((x, y) => x + y, 0)).toBeGreaterThanOrEqual(BOOT_PRESSURE_CONSTANTS.SETTLE_AFTER_READY_MS + 30_000);
		b.finish(); await done;
	});

	it('under pressure keeps at most the pressure concurrency in flight', async () => {
		const c = clock();
		const [a, b, d] = ['a', 'b', 'd'].map((n) => entry(n, RESTORE_TIER.OWNER, { essential: true }));
		const q = queue(3, 60_000, { now: c.now, sleep: c.sleep, snapshot: () => TIGHT, pressureConcurrency: 2, holdMaxMs: 10 * 60_000 });
		const done = q.start([a.e, b.e, d.e]);
		await ticks(4);
		expect([a.started.length, b.started.length, d.started.length]).toEqual([1, 1, 0]);
		a.finish(); b.finish();
		await ticks(6);
		// Still tight: d waits for the reading; the hold cap lets it through later.
		expect(d.started).toEqual([]);
		c.advance(10 * 60_000);
		await ticks(4);
		expect(d.started).toEqual([0]);
		d.finish(); await done;
	});

	it('names owner-waiting agents in the plan and counts the pacer on every launch', async () => {
		const launches: number[] = [];
		const a = entry('a', RESTORE_TIER.OWNER, { essential: true });
		const q = queue(1, 60_000, { onLaunch: () => launches.push(1) });
		const done = q.start([a.e]);
		await tick();
		expect(launches).toHaveLength(1);
		a.finish(); await done;
	});
});
