/**
 * Tests for the runaway-file watcher (crewly#1078). Real temp files; sizes
 * are made large with sparse truncate (no real disk use) and the thresholds
 * are tiny-scaled by writing sparse files of the real threshold size.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RunawayFileWatcher, runawayWatchRoots, type RunawayWatcherDeps } from './runaway-file-watcher.js';
import { WORKTREE_JANITOR_CONSTANTS as K } from '../../constants.js';

const GB = 1024 ** 3;
let dir: string;

beforeEach(() => {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runaway-'));
});
afterEach(() => {
	fs.rmSync(dir, { recursive: true, force: true });
});

/** A sparse file of `bytes` (takes no real space). */
function sparse(file: string, bytes: number): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.closeSync(fs.openSync(file, 'w'));
	fs.truncateSync(file, bytes);
}

function make(extra: Partial<RunawayWatcherDeps> = {}) {
	let t = 1_000_000;
	const calls = { kill: [] as Array<[number, string]>, owner: [] as Array<{ title: string; urgent: boolean; message: string }>, agent: [] as string[] };
	const alive = new Set<number>();
	const deps: RunawayWatcherDeps = {
		listRoots: async () => [dir],
		findWriters: async () => [],
		kill: (pid, sig) => void calls.kill.push([pid, sig]),
		isAlive: (pid) => alive.has(pid),
		sleep: async () => undefined,
		notifyAgents: async (_f, m) => {
			calls.agent.push(m);
			return ['agent-1'];
		},
		notifyOwner: async (n) => {
			calls.owner.push(n);
			return true;
		},
		now: () => t,
		...extra,
	};
	return { w: new RunawayFileWatcher(deps), calls, alive, tick: (ms: number) => void (t += ms) };
}

describe('RunawayFileWatcher', () => {
	it('does nothing for small files and files that are not growing', async () => {
		sparse(path.join(dir, 'a', 'small.bin'), 10 * 1024 * 1024);
		sparse(path.join(dir, 'a', 'mid.bin'), 1 * GB);
		const { w, calls, tick } = make();
		expect(await w.scan()).toEqual([]);
		tick(60_000);
		expect(await w.scan()).toEqual([]);
		expect(calls.kill).toEqual([]);
		expect(calls.owner).toEqual([]);
	});

	it('reports a big static file once, without touching it', async () => {
		const f = path.join(dir, 'big.bin');
		sparse(f, K.RUNAWAY_FILE_BYTES + 1);
		const { w, calls, tick } = make();
		const first = await w.scan();
		expect(first).toHaveLength(1);
		expect(first[0]).toMatchObject({ kind: 'oversize', truncated: false, stoppedPids: [] });
		expect(calls.owner).toHaveLength(1);
		expect(calls.owner[0].urgent).toBe(false);
		tick(60_000);
		expect(await w.scan()).toEqual([]);
		expect(fs.statSync(f).size).toBe(K.RUNAWAY_FILE_BYTES + 1);
	});

	it('stops the writer, cuts a growing file over the size limit, tells the agent and the owner once', async () => {
		const f = path.join(dir, 'worktree', 'all.md');
		sparse(f, K.RUNAWAY_FILE_BYTES + 100);
		let writers = [4242];
		const { w, calls, alive, tick } = make({
			findWriters: async () => writers,
			kill: (pid, sig) => {
				calls.kill.push([pid, sig]);
				if (sig === 'SIGKILL') writers = [];
			},
		});
		alive.add(4242);
		await w.scan(); // first sight: static, reported as oversize
		calls.owner.length = 0;
		fs.truncateSync(f, K.RUNAWAY_FILE_BYTES + 200); // grew
		tick(60_000);
		const [o] = await w.scan();
		expect(o).toMatchObject({ kind: 'growing', stoppedPids: [4242], truncated: true });
		expect(calls.kill).toEqual([
			[4242, 'SIGTERM'],
			[4242, 'SIGKILL'],
		]);
		expect(fs.statSync(f).size).toBe(K.RUNAWAY_KEEP_HEAD_BYTES);
		expect(o.notifiedAgents).toEqual(['agent-1']);
		expect(calls.agent[0]).toMatch(/DISK GUARD/);
		// The path was already alerted as oversize, so no second owner notice.
		expect(calls.owner).toHaveLength(0);
	});

	it('flags growth over 1 GB/min even below the size limit and alerts the owner urgently', async () => {
		const f = path.join(dir, 'x', 'out.log');
		sparse(f, 300 * 1024 * 1024);
		const { w, calls, tick } = make();
		await w.scan();
		fs.truncateSync(f, 300 * 1024 * 1024 + 2 * GB);
		tick(60_000);
		const [o] = await w.scan();
		expect(o.kind).toBe('growing');
		expect(o.growthPerMin).toBeGreaterThanOrEqual(K.RUNAWAY_GROWTH_BYTES_PER_MIN);
		expect(o.truncated).toBe(true);
		expect(calls.owner).toHaveLength(1);
		expect(calls.owner[0].urgent).toBe(true);
	});

	it('does not cut the file when a writer could not be stopped', async () => {
		const f = path.join(dir, 'stuck.bin');
		sparse(f, K.RUNAWAY_FILE_BYTES + 1);
		const { w, tick } = make({ findWriters: async () => [777], kill: () => undefined, isAlive: () => true });
		await w.scan();
		fs.truncateSync(f, K.RUNAWAY_FILE_BYTES + 5);
		tick(60_000);
		const [o] = await w.scan();
		expect(o.truncated).toBe(false);
		expect(fs.statSync(f).size).toBe(K.RUNAWAY_FILE_BYTES + 5);
	});

	it('never signals itself or its parent, never follows symlinks, skips node_modules', async () => {
		const out = path.join(dir, 'outside');
		sparse(path.join(out, 'huge.bin'), K.RUNAWAY_FILE_BYTES + 1);
		fs.mkdirSync(path.join(dir, 'w'), { recursive: true });
		fs.symlinkSync(out, path.join(dir, 'w', 'link'));
		sparse(path.join(dir, 'w', 'node_modules', 'pkg', 'big.bin'), K.RUNAWAY_FILE_BYTES + 1);
		const { w, calls } = make({ listRoots: async () => [path.join(dir, 'w')], findWriters: async () => [process.pid, process.ppid] });
		expect(await w.scan()).toEqual([]);
		expect(calls.kill).toEqual([]);
	});

	it('survives a failing owner notifier', async () => {
		const f = path.join(dir, 'f.bin');
		sparse(f, K.RUNAWAY_FILE_BYTES + 1);
		const { w } = make({
			notifyOwner: async () => {
				throw new Error('slack down');
			},
		});
		const [o] = await w.scan();
		expect(o.ownerNotified).toBe(false);
	});
});

describe('runawayWatchRoots', () => {
	it('keeps only existing dirs and drops ones nested in another watched root', () => {
		const scratch = path.join(dir, 'claude-1');
		const repo = path.join(dir, 'repo');
		fs.mkdirSync(path.join(scratch, 'inner'), { recursive: true });
		fs.mkdirSync(path.join(repo, '.claude', 'worktrees'), { recursive: true });
		const roots = runawayWatchRoots([scratch, path.join(scratch, 'inner'), path.join(dir, 'nope')], [], [repo, path.join(dir, 'missing-repo')]);
		expect(roots).toEqual([scratch, path.join(repo, '.claude', 'worktrees')]);
	});
});
