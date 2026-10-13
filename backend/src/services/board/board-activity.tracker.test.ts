import { BoardActivityTracker } from './board-activity.tracker.js';
import { BOARD_CONSTANTS } from '../../constants.js';

const T0 = Date.parse('2026-10-12T10:00:00.000Z');
const SECOND = 1000;

function make(): { tracker: BoardActivityTracker; changes: string[] } {
	const tracker = new BoardActivityTracker();
	tracker.setRootsResolver(() => ['/work/crewly']);
	const changes: string[] = [];
	tracker.onChange((s) => changes.push(s));
	return { tracker, changes };
}

describe('BoardActivityTracker', () => {
	it('a tool start becomes the current activity and last action', () => {
		const { tracker, changes } = make();
		tracker.recordHook('dev', 'PreToolUse', { toolName: 'Edit', toolInput: { filePath: '/work/crewly/src/a.ts' }, toolUseId: 't1' }, T0);
		const live = tracker.live('dev', true, T0 + SECOND);
		expect(live.activity).toEqual({ type: 'coding', detail: 'crewly/src/a.ts', since: new Date(T0).toISOString() });
		expect(live.lastAction?.text).toBe('Edited crewly/src/a.ts');
		expect(changes).toEqual(['dev']);
	});

	it('keeps the activity while the tool runs and for a while after, then shows thinking', () => {
		const { tracker } = make();
		tracker.recordHook('dev', 'PreToolUse', { toolName: 'Bash', toolInput: { command: 'npm test' }, toolUseId: 't1' }, T0);
		expect(tracker.live('dev', true, T0 + 5 * 60_000).activity?.detail).toBe('npm test'); // still running
		tracker.recordHook('dev', 'PostToolUse', { toolUseId: 't1' }, T0 + 5 * 60_000);
		expect(tracker.live('dev', true, T0 + 5 * 60_000 + 5 * SECOND).activity?.type).toBe('command');
		const later = tracker.live('dev', true, T0 + 5 * 60_000 + BOARD_CONSTANTS.ACTIVITY_LINGER_MS + SECOND);
		expect(later.activity?.type).toBe('thinking');
		expect(later.lastAction?.text).toBe('Ran npm test');
	});

	it('shows nothing when the agent is not working and no tool is open', () => {
		const { tracker } = make();
		tracker.recordHook('dev', 'PreToolUse', { toolName: 'Read', toolInput: { filePath: '/work/crewly/a.ts' }, toolUseId: 't1' }, T0);
		tracker.recordHook('dev', 'PostToolUse', { toolUseId: 't1' }, T0 + SECOND);
		tracker.recordHook('dev', 'Stop', {}, T0 + 2 * SECOND);
		expect(tracker.live('dev', false, T0 + 3 * SECOND).activity).toBeNull();
		expect(tracker.live('dev', false, T0 + 3 * SECOND).lastAction?.text).toBe('Read crewly/a.ts');
	});

	it('an unknown session is thinking when working, nothing otherwise', () => {
		const { tracker } = make();
		expect(tracker.live('ghost', true, T0).activity?.type).toBe('thinking');
		expect(tracker.live('ghost', false, T0).activity).toBeNull();
	});

	it('a lost PostToolUse does not pin a tool forever', () => {
		const { tracker } = make();
		tracker.recordHook('dev', 'PreToolUse', { toolName: 'Bash', toolInput: { command: 'sleep 1' }, toolUseId: 't1' }, T0);
		const live = tracker.live('dev', true, T0 + BOARD_CONSTANTS.OPEN_TOOL_MAX_MS + 60_000);
		expect(live.activity?.type).toBe('thinking');
	});

	it('the same tool call repeated keeps its since and does not flood changes', () => {
		const { tracker, changes } = make();
		for (let i = 0; i < 5; i += 1) {
			tracker.recordHook('dev', 'PreToolUse', { toolName: 'Read', toolInput: { filePath: '/work/crewly/a.ts' }, toolUseId: `t${i}` }, T0 + i * SECOND);
			tracker.recordHook('dev', 'PostToolUse', { toolUseId: `t${i}` }, T0 + i * SECOND + 100);
		}
		expect(changes).toEqual(['dev']);
		expect(tracker.live('dev', true, T0 + 5 * SECOND).activity?.since).toBe(new Date(T0).toISOString());
		expect(tracker.timeline('dev', T0 + 6 * SECOND)).toHaveLength(1);
	});

	it('a permission prompt is a wait on the owner until the next tool', () => {
		const { tracker } = make();
		tracker.recordHook('dev', 'PreToolUse', { toolName: 'Bash', toolInput: { command: 'rm -rf build' }, toolUseId: 't1' }, T0);
		tracker.recordHook('dev', 'Notification', { notificationType: 'permission_prompt' }, T0 + SECOND);
		expect(tracker.live('dev', true, T0 + 2 * SECOND).activity?.type).toBe('waiting_owner');
		tracker.recordHook('dev', 'PostToolUse', { toolUseId: 't1' }, T0 + 5 * SECOND);
		expect(tracker.live('dev', true, T0 + 6 * SECOND).activity?.type).not.toBe('waiting_owner');
	});

	it('browser, message and owner-wait records', () => {
		const { tracker } = make();
		tracker.recordBrowser('dev', 'navigate', 'https://a.io/x?y=1', T0);
		expect(tracker.live('dev', true, T0).activity).toMatchObject({ type: 'browsing', detail: 'a.io/x' });
		tracker.recordMessage('dev', 'owner chat', T0 + 20 * SECOND);
		expect(tracker.live('dev', true, T0 + 21 * SECOND).activity).toMatchObject({ type: 'messaging', detail: 'owner chat' });
		tracker.setOwnerWait('dev', 'approval to publish', T0 + 30 * SECOND);
		expect(tracker.live('dev', true, T0 + 31 * SECOND).activity?.type).toBe('waiting_owner');
		tracker.clearOwnerWait('dev');
		expect(tracker.live('dev', true, T0 + 32 * SECOND).activity?.type).not.toBe('waiting_owner');
	});

	it('timeline: capped, ordered, pruned after 24 h', () => {
		const { tracker } = make();
		for (let i = 0; i < 260; i += 1) {
			tracker.recordHook('dev', 'PreToolUse', { toolName: 'Read', toolInput: { filePath: `/work/crewly/f${i}.ts` }, toolUseId: `t${i}` }, T0 + i * 30 * SECOND);
		}
		const tl = tracker.timeline('dev', T0 + 260 * 30 * SECOND);
		expect(tl).toHaveLength(BOARD_CONSTANTS.TIMELINE_MAX_EVENTS);
		expect(tl[tl.length - 1].text).toBe('Read crewly/f259.ts');
		expect(tracker.timeline('dev', T0 + 3 * 24 * 3600_000)).toHaveLength(0);
	});

	it('unsent events are peeked until acknowledged', () => {
		const { tracker } = make();
		tracker.recordHook('a', 'PreToolUse', { toolName: 'Read', toolInput: { filePath: '/work/crewly/a.ts' }, toolUseId: '1' }, T0);
		tracker.recordHook('b', 'PreToolUse', { toolName: 'Bash', toolInput: { command: 'git status' }, toolUseId: '2' }, T0 + SECOND);
		expect(tracker.sessionsWithUnsent().sort()).toEqual(['a', 'b']);
		const events = tracker.peekUnsent(['a']);
		expect(events.map((e) => e.session)).toEqual(['a']);
		expect(tracker.peekUnsent(['a'])).toHaveLength(1);
		tracker.ackUnsent(events);
		expect(tracker.peekUnsent(['a'])).toHaveLength(0);
		expect(tracker.peekUnsent(['b'])).toHaveLength(1);
	});

	it('never stores the raw command', () => {
		const { tracker } = make();
		tracker.recordHook('dev', 'PreToolUse', { toolName: 'Bash', toolInput: { command: 'deploy --token sk-ant-api03-THISISAFAKEKEYFORTESTING0123456789abcdef' }, toolUseId: '1' }, T0);
		const dump = JSON.stringify([tracker.timeline('dev', T0), tracker.live('dev', true, T0), tracker.peekUnsent()]);
		expect(dump).not.toContain('sk-ant');
		expect(dump).toContain('deploy');
	});

	it('a listener that throws does not break recording', () => {
		const { tracker } = make();
		tracker.onChange(() => {
			throw new Error('boom');
		});
		expect(() => tracker.recordHook('dev', 'PreToolUse', { toolName: 'Read', toolInput: {}, toolUseId: '1' }, T0)).not.toThrow();
	});
});
