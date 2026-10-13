import { BoardActivityTracker } from '../board-activity.tracker.js';
import { stepOfBrowserAction, stepOfMessage, stepOfTool } from './canvas-step.normalizer.js';
import { StepStream } from './canvas-step.stream.js';
import { CANVAS_CONSTANTS as C } from '../../../constants.js';

const T0 = Date.parse('2026-10-12T10:00:00.000Z');
const S = 1000;

describe('stepOfTool', () => {
	const roots = ['/work/crewly'];
	it('maps tools to kind, verb and a redacted target', () => {
		expect(stepOfTool('Read', { filePath: '/work/crewly/SKILL.md' }, { roots })).toEqual({ kind: 'read', label: 'Read', target: 'crewly/SKILL.md' });
		expect(stepOfTool('Edit', { filePath: '/work/crewly/a/caption.md' }, { roots })).toMatchObject({ kind: 'edit', label: 'Edited', target: 'crewly/a/caption.md' });
		expect(stepOfTool('Write', { filePath: '/work/crewly/out.md' }, { roots })).toMatchObject({ kind: 'write', label: 'Wrote' });
		expect(stepOfTool('Grep', {}, { roots })).toEqual({ kind: 'search', label: 'Searched', target: 'the code' });
		expect(stepOfTool('WebFetch', { url: 'https://x.com/a/b?token=abc#frag' })).toEqual({ kind: 'browse', label: 'Opened', target: 'x.com/a/b' });
		expect(stepOfTool('WebSearch', { query: 'open swarm rivals' })).toEqual({ kind: 'search', label: 'Searched', target: '"open swarm rivals"' });
		expect(stepOfTool('AskUserQuestion')).toMatchObject({ kind: 'wait' });
	});

	it('reduces a command to executable and subcommand; the arguments never show', () => {
		const step = stepOfTool('Bash', { command: 'cd app && GH_TOKEN=ghp_abcdefghijklmnopqrstuv0123456789 npm test -- --secret=hunter2hunter2' });
		expect(step).toEqual({ kind: 'command', label: 'Ran', target: 'npm test' });
		expect(JSON.stringify(step)).not.toMatch(/ghp_|hunter/);
	});

	it('a messaging skill is a message step to its channel, a browsing skill a browse step', () => {
		const msg = stepOfTool('Bash', { command: 'bash /home/u/.crewly/skills/agent/core/reply-slack/execute.sh --channel awesome-videos "text with secret"' });
		expect(msg).toEqual({ kind: 'message', label: 'Sent message', target: '#awesome-videos' });
		const browse = stepOfTool('Bash', { command: 'bash /x/skills/agent/core/remote-browser/execute.sh navigate https://x.com/home?auth=zzz' });
		expect(browse).toMatchObject({ kind: 'browse', label: 'Opened', target: 'x.com/home' });
	});

	it('a channel id (a UUID, a Slack id) is not shown as a channel name', () => {
		const uuid = stepOfTool('Bash', { command: 'bash /x/skills/agent/core/reply-channel/execute.sh --channel 2361d3e3-90fc-4198-9373-abcdef012345 --thread d17e071b-8abc --content "hi"' });
		expect(uuid).toEqual({ kind: 'message', label: 'Sent message', target: 'a channel' });
		const slackId = stepOfTool('Bash', { command: 'bash /x/skills/agent/core/reply-slack/execute.sh --channel C09ABCDEF12 "hi"' });
		expect(slackId).toEqual({ kind: 'message', label: 'Sent message', target: 'Slack' });
	});

	it('mcp tools are classified by name; unknown names are still safe', () => {
		expect(stepOfTool('mcp__playwright__browser_navigate', { url: 'https://a.io/x' })).toMatchObject({ kind: 'browse', label: 'Opened', target: 'a.io/x' });
		expect(stepOfTool('mcp__slack__post')).toMatchObject({ kind: 'message' });
		expect(stepOfTool('weird tool; rm -rf /')).toEqual({ kind: 'tool', label: 'Used', target: 'a tool' });
	});

	it('browser actions and messages', () => {
		expect(stepOfBrowserAction('navigate', 'https://x.com/a?b=1')).toEqual({ kind: 'browse', label: 'Opened', target: 'x.com/a' });
		expect(stepOfBrowserAction('click')).toMatchObject({ label: 'Clicked on', target: 'the browser' });
		expect(stepOfMessage('awesome-videos')).toEqual({ kind: 'message', label: 'Sent message', target: '#awesome-videos' });
		expect(stepOfMessage('owner chat')).toMatchObject({ target: 'owner chat' });
	});
});

describe('StepStream: pairing and durations', () => {
	it('pairs a start with its end by id: duration and status', () => {
		const s = new StepStream();
		s.start('a', { kind: 'read', label: 'Read', target: 'SKILL.md' }, { id: 't1' }, T0);
		expect(s.recent('a', 50, T0)[0]).toMatchObject({ id: 't1', status: 'running', at: new Date(T0).toISOString() });
		s.finish('a', 't1', 'done', T0 + 400);
		expect(s.recent('a', 50, T0 + S)[0]).toMatchObject({ id: 't1', status: 'done', durationMs: 400, label: 'Read', target: 'SKILL.md' });
	});

	it('overlapping tool calls pair by id, not by order', () => {
		const s = new StepStream();
		s.start('a', { kind: 'command', label: 'Ran', target: 'npm test' }, { id: 'slow' }, T0);
		s.start('a', { kind: 'read', label: 'Read', target: 'a.ts' }, { id: 'fast' }, T0 + 100);
		s.finish('a', 'fast', 'done', T0 + 300);
		s.finish('a', 'slow', 'done', T0 + 12_000);
		const byId = Object.fromEntries(s.recent('a').map((x) => [x.id, x]));
		expect(byId.fast.durationMs).toBe(200);
		expect(byId.slow.durationMs).toBe(12_000);
	});

	it('an end without an id closes the oldest running step', () => {
		const s = new StepStream();
		s.start('a', { kind: 'read', label: 'Read' }, {}, T0);
		s.start('a', { kind: 'read', label: 'Read' }, {}, T0 + 10);
		s.finish('a', undefined, 'done', T0 + 50);
		const [first, second] = s.recent('a');
		expect([first.status, second.status]).toEqual(['done', 'running']);
	});

	it('an end for an unknown id, or a repeated end, changes nothing', () => {
		const s = new StepStream();
		s.start('a', { kind: 'read', label: 'Read' }, { id: 't1' }, T0);
		s.finish('a', 'ghost', 'done', T0 + 5);
		s.finish('a', 't1', 'done', T0 + 100);
		s.finish('a', 't1', 'done', T0 + 9_000);
		expect(s.recent('a')[0].durationMs).toBe(100);
	});

	it('a failure seen later (the transcript) turns a done step into an error, keeping the duration', () => {
		const s = new StepStream();
		s.start('a', { kind: 'command', label: 'Ran', target: 'npm test' }, { id: 't1' }, T0);
		s.finish('a', 't1', 'done', T0 + 2_000);
		s.markError('a', 't1', T0 + 2_500);
		expect(s.recent('a')[0]).toMatchObject({ status: 'error', durationMs: 2_000 });
		s.finish('a', 't1', 'done', T0 + 3_000);
		expect(s.recent('a')[0].status).toBe('error');
	});

	it('closeAll ends what still runs (the turn is over)', () => {
		const s = new StepStream();
		s.start('a', { kind: 'command', label: 'Ran' }, { id: 't1' }, T0);
		s.closeAll('a', T0 + 700);
		expect(s.recent('a')[0]).toMatchObject({ status: 'done', durationMs: 700 });
		expect(s.hasRunning('a')).toBe(false);
	});

	it('a step that lost its end is closed without a duration after 30 minutes', () => {
		const s = new StepStream();
		s.start('a', { kind: 'command', label: 'Ran' }, { id: 't1' }, T0);
		s.start('a', { kind: 'read', label: 'Read' }, { id: 't2' }, T0 + C.OPEN_STEP_MAX_MS + S);
		const t1 = s.recent('a', 50, T0 + C.OPEN_STEP_MAX_MS + 2 * S).find((x) => x.id === 't1');
		expect(t1).toMatchObject({ status: 'done' });
		expect(t1?.durationMs).toBeUndefined();
	});

	it('keeps 300 steps per agent and drops steps older than 24 hours from recent()', () => {
		const s = new StepStream();
		for (let i = 0; i < 350; i += 1) s.instant('a', { kind: 'message', label: 'Sent message', target: `#c${i}` }, T0 + i * 10 * S);
		expect(s.recent('a', 1000, T0 + 350 * 10 * S)).toHaveLength(C.STEPS_MAX_PER_AGENT);
		expect(s.recent('a', 1000, T0 + 25 * 60 * 60 * 1000 + 350 * 10 * S)).toHaveLength(0);
	});

	it('instant steps repeating the previous one within 5 s are dropped (a skill and its controller)', () => {
		const s = new StepStream();
		expect(s.instant('a', { kind: 'message', label: 'Sent message', target: 'owner chat' }, T0)).not.toBeNull();
		expect(s.instant('a', { kind: 'message', label: 'Sent message', target: 'owner chat' }, T0 + 2 * S)).toBeNull();
		expect(s.instant('a', { kind: 'message', label: 'Sent message', target: 'owner chat' }, T0 + 9 * S)).not.toBeNull();
	});

	it('an instant step is the running tool call of the same kind seen from its controller: dropped', () => {
		const s = new StepStream();
		s.start('a', { kind: 'message', label: 'Sent message', target: '#awesome-videos' }, { id: 't1' }, T0);
		expect(s.instant('a', { kind: 'message', label: 'Sent message', target: 'Slack' }, T0 + S)).toBeNull();
		expect(s.instant('a', { kind: 'browse', label: 'Opened', target: 'x.com' }, T0 + S)).not.toBeNull();
		s.finish('a', 't1', 'done', T0 + 2 * S);
		expect(s.recent('a').filter((x) => x.kind === 'message')).toHaveLength(1);
	});

	it('own text lines dedupe by id and stay in time order', () => {
		const s = new StepStream();
		expect(s.text('a', 'u1', T0 + 5 * S, 'Two clips ready, posting now.')).toBe(true);
		expect(s.text('a', 'u1', T0 + 5 * S, 'Two clips ready, posting now.')).toBe(false);
		s.start('a', { kind: 'read', label: 'Read' }, { id: 't1' }, T0 + 7 * S);
		s.text('a', 'u0', T0 + 3 * S, 'Earlier.');
		expect(s.recent('a').map((x) => x.label)).toEqual(['Said', 'Said', 'Read']);
		expect(s.recent('a')[1].text).toBe('Two clips ready, posting now.');
	});
});

describe('StepStream: unsent', () => {
	it('sends a step again when it changes, and only the newest version', () => {
		const s = new StepStream();
		s.start('a', { kind: 'command', label: 'Ran', target: 'npm test' }, { id: 't1' }, T0);
		const first = s.peekUnsent();
		expect(first).toHaveLength(1);
		expect(first[0].status).toBe('running');
		s.ackUnsent(first);
		expect(s.peekUnsent()).toHaveLength(0);
		s.finish('a', 't1', 'done', T0 + 1_000);
		const again = s.peekUnsent();
		expect(again).toHaveLength(1);
		expect(again[0]).toMatchObject({ id: 't1', status: 'done', durationMs: 1_000 });
	});

	it('a step that changed while being sent stays unsent', () => {
		const s = new StepStream();
		s.start('a', { kind: 'command', label: 'Ran' }, { id: 't1' }, T0);
		const sent = s.peekUnsent();
		s.finish('a', 't1', 'done', T0 + 50);
		s.ackUnsent(sent);
		expect(s.peekUnsent()).toHaveLength(1);
	});

	it('caps one delta and keeps the rest for the next', () => {
		const s = new StepStream();
		for (let i = 0; i < 100; i += 1) s.start('a', { kind: 'read', label: 'Read', target: `f${i}` }, { id: `t${i}` }, T0 + i);
		for (let i = 0; i < 30; i += 1) s.start('b', { kind: 'read', label: 'Read', target: `g${i}` }, { id: `u${i}` }, T0 + 200 + i);
		const first = s.peekUnsent(undefined, 120, 40);
		expect(first.filter((x) => x.session === 'a')).toHaveLength(40);
		expect(first.filter((x) => x.session === 'b')).toHaveLength(30);
		s.ackUnsent(first);
		expect(s.sessionsWithUnsent()).toEqual(['a']);
		const second = s.peekUnsent(undefined, 120, 40);
		expect(second).toHaveLength(40);
		expect(second[0].id).toBe('t40');
	});

	it('keeps at most 200 unsent steps per agent', () => {
		const s = new StepStream();
		for (let i = 0; i < 260; i += 1) s.start('a', { kind: 'read', label: 'Read' }, { id: `t${i}` }, T0 + i);
		let total = 0;
		for (;;) {
			const batch = s.peekUnsent(undefined, 1000, 1000);
			if (batch.length === 0) break;
			total += batch.length;
			s.ackUnsent(batch);
		}
		expect(total).toBe(C.UNSENT_MAX_PER_AGENT);
	});
});

describe('BoardActivityTracker feeds the step stream', () => {
	function make() {
		const tracker = new BoardActivityTracker();
		tracker.setRootsResolver(() => ['/work/crewly']);
		return tracker;
	}

	it('PreToolUse / PostToolUse become one step with a duration', () => {
		const t = make();
		t.recordHook('dev', 'PreToolUse', { toolName: 'Bash', toolInput: { command: 'npm test' }, toolUseId: 'x1' }, T0);
		t.recordHook('dev', 'PostToolUse', { toolUseId: 'x1' }, T0 + 12_000);
		expect(t.steps.recent('dev')).toEqual([
			{ session: 'dev', id: 'x1', at: new Date(T0).toISOString(), kind: 'command', label: 'Ran', target: 'npm test', status: 'done', durationMs: 12_000 },
		]);
	});

	it('Stop closes what still runs; a permission prompt is a wait step that ends with the next tool', () => {
		const t = make();
		t.recordHook('dev', 'PreToolUse', { toolName: 'Read', toolInput: { filePath: '/work/crewly/a.ts' }, toolUseId: 'x1' }, T0);
		t.recordHook('dev', 'Notification', { notificationType: 'permission_prompt' }, T0 + S);
		expect(t.steps.recent('dev').find((x) => x.kind === 'wait')).toMatchObject({ status: 'running', label: 'Waiting for' });
		t.recordHook('dev', 'PostToolUse', { toolUseId: 'x1' }, T0 + 5 * S);
		expect(t.steps.recent('dev').find((x) => x.kind === 'wait')).toMatchObject({ status: 'done', durationMs: 4 * S });
		t.recordHook('dev', 'PreToolUse', { toolName: 'Bash', toolInput: { command: 'ls' }, toolUseId: 'x2' }, T0 + 6 * S);
		t.recordHook('dev', 'Stop', {}, T0 + 7 * S);
		expect(t.steps.recent('dev').find((x) => x.id === 'x2')).toMatchObject({ status: 'done', durationMs: S });
	});

	it('chat replies are message steps and browser actions browse steps', () => {
		const t = make();
		t.recordMessage('dev', 'owner chat', T0);
		t.recordBrowser('dev', 'navigate', 'https://x.com/home?q=1', T0 + 10 * S);
		expect(t.steps.recent('dev').map((x) => [x.kind, x.label, x.target])).toEqual([
			['message', 'Sent message', 'owner chat'],
			['browse', 'Opened', 'x.com/home'],
		]);
	});

	it('the step stream does not touch the row-change listeners', () => {
		const t = make();
		const rows: string[] = [];
		const steps: string[] = [];
		t.onChange((s) => rows.push(s));
		t.steps.onChange((s) => steps.push(s));
		t.recordHook('dev', 'PreToolUse', { toolName: 'Read', toolInput: { filePath: '/work/crewly/a.ts' }, toolUseId: 'x1' }, T0);
		t.recordHook('dev', 'PostToolUse', { toolUseId: 'x1' }, T0 + 5);
		expect(rows).toEqual(['dev']);
		expect(steps).toEqual(['dev', 'dev']);
	});

	it('forget drops the steps with the session', () => {
		const t = make();
		t.recordMessage('dev', 'owner chat', T0);
		t.forget('dev');
		expect(t.steps.recent('dev')).toEqual([]);
	});
});
