/**
 * Tests for the low-disk guard helpers (pure functions + injected statfs).
 */

import {
	buildLowDiskNotice,
	criticalDiskThresholdBytes,
	describeFreed,
	describeReason,
	diskLevel,
	idleThreshold,
	lowDiskThresholdBytes,
	noticeToSend,
	readDiskSpace,
	readFreeBytes,
	recordNotice,
	retentionArmed,
} from './low-disk-guard.js';
import { WORKTREE_JANITOR_CONSTANTS as C } from '../../constants.js';

const GB = 1024 ** 3;
const HOUR = 60 * 60 * 1000;

describe('low-disk guard helpers', () => {
	it('readFreeBytes multiplies available blocks by block size (numbers or bigints) and returns null on failure', async () => {
		expect(await readFreeBytes('/x', async () => ({ bavail: 1000, bsize: 4096 }))).toBe(4_096_000);
		expect(await readFreeBytes('/x', async () => ({ bavail: BigInt(2), bsize: BigInt(512) }))).toBe(1024);
		expect(await readFreeBytes('/x', async () => { throw new Error('ENOENT'); })).toBeNull();
	});

	it('readFreeBytes works against the real filesystem', async () => {
		const free = await readFreeBytes(process.cwd());
		expect(typeof free).toBe('number');
	});

	it('diskLevel uses the 15 GB / 5 GB floors when the disk size is unknown', () => {
		expect(diskLevel(C.LOW_DISK_BYTES)).toBe('ok');
		expect(diskLevel(C.LOW_DISK_BYTES - 1)).toBe('low');
		expect(diskLevel(C.CRITICAL_DISK_BYTES - 1)).toBe('critical');
		expect(C.LOW_DISK_BYTES).toBe(15 * GB);
		expect(C.CRITICAL_DISK_BYTES).toBe(5 * GB);
	});

	it('on a big disk the marks are 8 % / 3 % of its size (crewly#1354)', () => {
		const disk = 926 * GB;
		expect(lowDiskThresholdBytes(disk)).toBe(Math.round(disk * 0.08));
		expect(criticalDiskThresholdBytes(disk)).toBe(Math.round(disk * 0.03));
		expect(lowDiskThresholdBytes(100 * GB)).toBe(15 * GB);
		expect(criticalDiskThresholdBytes(100 * GB)).toBe(5 * GB);
		expect(lowDiskThresholdBytes(null)).toBe(15 * GB);
		expect(diskLevel(52 * GB, disk)).toBe('low');
		expect(diskLevel(80 * GB, disk)).toBe('ok');
		expect(diskLevel(20 * GB, disk)).toBe('critical');
		expect(diskLevel(52 * GB, 100 * GB)).toBe('ok');
	});

	it('readDiskSpace reports the total when the probe has it', async () => {
		expect(await readDiskSpace('/x', async () => ({ bavail: 10, bsize: 4096, blocks: 100 }))).toEqual({ freeBytes: 40_960, totalBytes: 409_600 });
		expect(await readDiskSpace('/x', async () => ({ bavail: 10, bsize: 4096 }))).toEqual({ freeBytes: 40_960, totalBytes: null });
		expect(await readDiskSpace('/x', async () => { throw new Error('x'); })).toBeNull();
		const real = await readDiskSpace(process.cwd());
		expect(real?.totalBytes).toBeGreaterThan(0);
	});

	it('retentionArmed: deletes start one day after the first pass that recorded the arming time', () => {
		const t0 = 1_000_000_000_000;
		expect(retentionArmed({}, t0)).toBe(false);
		expect(retentionArmed({ retentionArmedAt: t0 }, t0 + 23 * HOUR)).toBe(false);
		expect(retentionArmed({ retentionArmedAt: t0 }, t0 + 24 * HOUR)).toBe(true);
		expect(C.RETENTION_ARM_DELAY_MS).toBe(24 * HOUR);
	});

	it('describeFreed lists only the kinds that freed something', () => {
		expect(describeFreed({ worktrees: 0, stripped: 0, archived: 0, transcripts: 0, tmp: 0 })).toBe('');
		expect(describeFreed({ worktrees: 2 * GB, stripped: GB, archived: 0, transcripts: 512 * 1024 ** 2, tmp: 0 })).toBe(
			'freed 3.5 GB (finished worktrees 2.0 GB, node_modules of idle worktrees 1.0 GB, old agent transcripts 512 MB)',
		);
	});

	it('idleThreshold halves in low-disk mode but never below 2h', () => {
		expect(idleThreshold(24 * HOUR, false)).toBe(24 * HOUR);
		expect(idleThreshold(24 * HOUR, true)).toBe(12 * HOUR);
		expect(idleThreshold(72 * HOUR, true)).toBe(36 * HOUR);
		expect(idleThreshold(2 * HOUR, true)).toBe(2 * HOUR);
		expect(idleThreshold(3 * HOUR, true)).toBe(2 * HOUR);
		// A threshold already below the floor is not raised.
		expect(idleThreshold(HOUR, true)).toBe(HOUR);
	});

	it('noticeToSend: normal at most once per 24h, urgent at most once per 6h', () => {
		const t0 = 1_000_000_000_000;
		expect(noticeToSend('ok', {}, t0)).toBeNull();
		expect(noticeToSend('low', {}, t0)).toBe('normal');
		let state = recordNotice({}, 'normal', t0);
		expect(noticeToSend('low', state, t0 + 23 * HOUR)).toBeNull();
		expect(noticeToSend('low', state, t0 + 24 * HOUR)).toBe('normal');
		// Dropping below 5 GB right after a normal notice still sends the urgent one.
		expect(noticeToSend('critical', state, t0 + HOUR)).toBe('urgent');
		state = recordNotice(state, 'urgent', t0 + HOUR);
		expect(state).toEqual({ lastNoticeAt: t0 + HOUR, lastUrgentAt: t0 + HOUR });
		expect(noticeToSend('critical', state, t0 + 6 * HOUR)).toBeNull();
		expect(noticeToSend('critical', state, t0 + 7 * HOUR)).toBe('urgent');
		// An urgent notice also counts for the 24h cadence of normal ones.
		expect(noticeToSend('low', state, t0 + 10 * HOUR)).toBeNull();
	});

	it('buildLowDiskNotice lists the 5 biggest kept items in plain English', () => {
		const items = Array.from({ length: 7 }, (_, i) => ({ path: `/tmp/item-${i}`, bytes: (i + 1) * GB, reason: i % 2 ? 'dirty' : 'unpushed' }));
		const { title, message } = buildLowDiskNotice({ freeBytes: 12.34 * GB, urgent: false, freedBytes: 3 * GB, items });
		expect(title).toBe('Disk space is running low');
		expect(message).toContain('12.3 GB free');
		expect(message).toContain('cleaned up 3.0 GB');
		const bullets = message.split('\n').filter((l) => l.startsWith('•'));
		expect(bullets).toHaveLength(C.LOW_DISK_REPORT_ITEMS);
		expect(bullets[0]).toBe('• /tmp/item-6 (7.0 GB) — has commits that were never pushed');
		expect(bullets[1]).toBe('• /tmp/item-5 (6.0 GB) — has changes that were never committed');
		expect(message).not.toContain('item-1 ');
		expect(message).toContain('your own files, downloads and app caches I never touch');
	});

	it('buildLowDiskNotice can say what was freed by kind and the disk size', () => {
		const { message } = buildLowDiskNotice({
			freeBytes: 50 * GB,
			totalBytes: 926 * GB,
			urgent: false,
			freedBytes: 3 * GB,
			items: [],
			freed: { worktrees: 0, stripped: 2 * GB, archived: GB, transcripts: 0, tmp: 0 },
		});
		expect(message).toContain('50.0 GB of 926.0 GB free');
		expect(message).toContain('Today I freed 3.0 GB (node_modules of idle worktrees 2.0 GB, archived worktrees 1.0 GB), but it is not enough.');
	});

	it('buildLowDiskNotice marks urgent notices and handles nothing left to list', () => {
		const { title, message } = buildLowDiskNotice({ freeBytes: 2 * GB, urgent: true, freedBytes: 0, items: [] });
		expect(title).toMatch(/URGENT/);
		expect(message).toContain('2.0 GB free');
		expect(message).toContain('nothing more that is safe to delete');
	});

	it('describeReason falls back to the code for unknown reasons', () => {
		expect(describeReason('not-merged')).toBe('has work that is not merged yet');
		expect(describeReason('weird')).toBe('kept (weird)');
	});
});
