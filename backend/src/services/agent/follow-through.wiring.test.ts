import { handedOffSince, owedWorkReminder, restoreStoppedOwingWork, OWED_REMINDER_MARKER, type StoppedOwingDeps } from './follow-through.wiring.js';
import type { WorkItem } from '../../types/v2/work-item.types.js';

jest.mock('../core/logger.service.js', () => ({
	LoggerService: { getInstance: () => ({ createComponentLogger: () => ({ info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }) }) },
}));

const SINCE = Date.parse('2026-10-10T19:12:00Z');
const wi = (over: Partial<WorkItem>): WorkItem => ({ id: 'w', createdAt: '2026-10-10T19:13:00Z', status: 'queued', ...over }) as WorkItem;

describe('handedOffSince', () => {
	it('a WorkItem for the agent itself or one it delegated, created after the statement, covers it', () => {
		expect(handedOffSince([wi({ target: 'pia', status: 'running' })], 'pia', SINCE)).toBe(true);
		expect(handedOffSince([wi({ target: 'luna', metadata: { delegatedBy: 'pia' } })], 'pia', SINCE)).toBe(true);
		expect(handedOffSince([wi({ target: 'luna', metadata: { createdBy: 'pia' } })], 'pia', SINCE)).toBe(true);
	});

	it('a queued item the harness made for the agent is not the agent starting', () => {
		expect(handedOffSince([wi({ target: 'pia', metadata: { harnessCreated: 'stated-intent' } })], 'pia', SINCE)).toBe(false);
		expect(handedOffSince([wi({ target: 'pia', metadata: { harnessCreated: 'ticket-follow-through' } })], 'pia', SINCE)).toBe(false);
		expect(handedOffSince([wi({ target: 'pia', status: 'running', metadata: { harnessCreated: 'stated-intent' } })], 'pia', SINCE)).toBe(true);
	});

	it('older items, other agents\' work and unrelated items do not', () => {
		expect(handedOffSince([wi({ target: 'pia', createdAt: '2026-10-10T18:00:00Z' })], 'pia', SINCE)).toBe(false);
		expect(handedOffSince([wi({ target: 'luna', metadata: { delegatedBy: 'ella' } })], 'pia', SINCE)).toBe(false);
		expect(handedOffSince([], 'pia', SINCE)).toBe(false);
	});
});

describe('owedWorkReminder', () => {
	it('lists what is queued for the stopped agent, and is null when nothing is', () => {
		const items = [wi({ target: 'pia', title: 'Follow through: starting v3 now' }), wi({ target: 'luna', title: 'other' }), wi({ target: 'pia', status: 'done', title: 'old' })];
		const text = owedWorkReminder(items, 'pia');
		expect(text).toContain('Follow through: starting v3 now');
		expect(text).not.toContain('other');
		expect(text).not.toContain('old');
		expect(owedWorkReminder(items, 'nobody')).toBeNull();
	});
});

describe('restoreStoppedOwingWork — the one hook every stop path runs (Pia, 2026-10-12)', () => {
	function make(items: WorkItem[], over: Partial<StoppedOwingDeps> = {}) {
		const calls: string[] = [];
		const queue: string[] = [];
		const deps: StoppedOwingDeps = {
			release: async (s, why) => { calls.push(`release:${s}:${why}`); },
			listWorkItems: async () => items,
			isHeldBack: () => false,
			hasReminder: () => queue.length > 0,
			enqueue: (_s, text) => { queue.push(text); },
			holdPlaceholders: async (s) => { calls.push(`hold:${s}`); },
			restart: async (s) => { calls.push(`restart:${s}`); },
			...over,
		};
		return { deps, calls, queue };
	}

	it('releases the work, holds placeholders, queues the reminder and restarts an agent that owes', async () => {
		const { deps, calls, queue } = make([wi({ target: 'pia', title: 'Follow through: build the video' })]);
		expect(await restoreStoppedOwingWork('pia', 'stopped to free a slot', deps)).toBe(true);
		expect(calls).toEqual(['release:pia:stopped to free a slot', 'hold:pia', 'restart:pia']);
		expect(queue).toHaveLength(1);
		expect(queue[0].startsWith(OWED_REMINDER_MARKER)).toBe(true);
		expect(queue[0]).toContain('build the video');
	});

	it('does nothing more for an agent that owes nothing', async () => {
		const { deps, calls, queue } = make([]);
		expect(await restoreStoppedOwingWork('pia', 'runtime exited', deps)).toBe(false);
		expect(calls).toEqual(['release:pia:runtime exited']);
		expect(queue).toEqual([]);
	});

	it('leaves an agent stopped on purpose alone', async () => {
		const { deps, calls } = make([wi({ target: 'pia' })], { isHeldBack: () => true });
		expect(await restoreStoppedOwingWork('pia', 'x', deps)).toBe(false);
		expect(calls).toEqual([]);
	});

	it('does not queue a second reminder while one waits', async () => {
		const { deps, queue } = make([wi({ target: 'pia' })], { hasReminder: () => true });
		await restoreStoppedOwingWork('pia', 'x', deps);
		expect(queue).toEqual([]);
	});

	it('is safe to call twice at once (idle event and stop path)', async () => {
		const { deps, calls } = make([wi({ target: 'pia' })]);
		const [a, b] = await Promise.all([restoreStoppedOwingWork('pia', 'x', deps), restoreStoppedOwingWork('pia', 'x', deps)]);
		expect([a, b].filter(Boolean)).toHaveLength(1);
		expect(calls.filter((c) => c.startsWith('restart'))).toHaveLength(1);
	});

	it('never throws', async () => {
		const { deps } = make([wi({ target: 'pia' })], { restart: async () => { throw new Error('boom'); } });
		await expect(restoreStoppedOwingWork('pia', 'x', deps)).resolves.toBe(false);
	});
});
