import * as fsModule from 'fs';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { StepStream } from './canvas-step.stream.js';
import { parseClaudeTail, parseCodexTail, TranscriptTailService } from './canvas-transcript.tail.js';
import { computeCapabilities, createSecretsProvider, createStopAgent, createTranscriptLocator } from './canvas-wiring.js';

const T0 = Date.parse('2026-10-12T10:00:00.000Z');
const iso = (ms: number): string => new Date(T0 + ms).toISOString();
const SK = ['sk', 'ant', 'api03', 'AbCdEfGhIjKlMnOpQrStUv0123456789'].join('-');

const assistant = (uuid: string, ms: number, blocks: unknown[], extra: Record<string, unknown> = {}): string =>
	JSON.stringify({ type: 'assistant', uuid, timestamp: iso(ms), message: { role: 'assistant', content: blocks }, ...extra });
const text = (t: string): unknown => ({ type: 'text', text: t });
const toolUse = (id: string, input: unknown): unknown => ({ type: 'tool_use', id, name: 'Bash', input });
const toolResult = (id: string, ms: number, isError: boolean, content: string): string =>
	JSON.stringify({ type: 'user', uuid: `r-${id}`, timestamp: iso(ms), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, is_error: isError, content }] } });

describe('parseClaudeTail', () => {
	it('keeps assistant text as short redacted lines, and nothing else', () => {
		const lines = [
			assistant('u1', 0, [text('Two clips ready, posting now.'), toolUse('t1', { command: `echo ${SK}` })]),
			toolResult('t1', 1000, false, `output with ${SK} and a secret`),
			JSON.stringify({ type: 'user', uuid: 'p1', timestamp: iso(2000), message: { role: 'user', content: 'owner prompt with private data' } }),
			assistant('u2', 3000, [{ type: 'thinking', thinking: 'private reasoning' }]),
			assistant('u3', 4000, [text(`The key is ${SK} and mail is jane@example.com`)]),
		].join('\n');
		const items = parseClaudeTail(lines, {}, T0);
		expect(items).toEqual([
			{ kind: 'text', id: 'u1:0', at: T0, text: 'Two clips ready, posting now.' },
			{ kind: 'text', id: 'u3:0', at: T0 + 4000, text: 'The key is [redacted] and mail is [email]' },
		]);
		expect(JSON.stringify(items)).not.toMatch(/private|output with|sk-ant|jane@/);
	});

	it('reads only the error flag and the id of a tool result, never its content', () => {
		const items = parseClaudeTail([toolResult('t1', 5, true, `boom ${SK}`), toolResult('t2', 6, false, 'fine')].join('\n'), {}, T0);
		expect(items).toEqual([{ kind: 'tool_error', toolUseId: 't1', at: T0 + 5 }]);
		expect(JSON.stringify(items)).not.toContain('boom');
	});

	it('skips subagent, meta and API-error entries', () => {
		const lines = [
			assistant('s1', 0, [text('From a subagent.')], { isSidechain: true }),
			assistant('s2', 0, [text('Meta.')], { isMeta: true }),
			assistant('s3', 0, [text('API Error: 500')], { isApiErrorMessage: true }),
			assistant('ok', 0, [text('Mine.')]),
		].join('\n');
		expect(parseClaudeTail(lines, {}, T0).map((i) => (i as { id: string }).id)).toEqual(['ok:0']);
	});

	it('drops old text on a first look (minAt)', () => {
		const lines = [assistant('old', -3_600_000, [text('Old news.')]), assistant('new', 0, [text('Fresh.')])].join('\n');
		expect(parseClaudeTail(lines, { minAt: T0 - 600_000 }, T0)).toHaveLength(1);
	});

	it('survives broken, truncated, huge and hostile lines', () => {
		const lines = [
			'{"type":"assistant","message":{"content":[{"type":"text","text":"cut off',
			'not json "type":"assistant" "type":"text"',
			'null',
			'{"type":"assistant","type":"text"}',
			JSON.stringify({ type: 'assistant', uuid: 'x', timestamp: 'garbage', message: { content: 'a string, not blocks' } }),
			JSON.stringify({ type: 'assistant', uuid: 'y', message: { content: [text(undefined as never), text(42 as never), text('ok line')] } }),
			assistant('big', 0, [text('z'.repeat(2_000_000))]),
			'x'.repeat(5_000_000),
			'',
		].join('\n');
		const items = parseClaudeTail(lines, {}, T0);
		expect(items.filter((i) => i.kind === 'text').map((i) => (i as { text: string }).text)).toEqual(['ok line', expect.stringMatching(/^z+…?$/)]);
		for (const i of items) if (i.kind === 'text') expect(i.text.length).toBeLessThanOrEqual(280);
	});

	it('uses the supplied time for an entry with no usable timestamp', () => {
		const items = parseClaudeTail(JSON.stringify({ type: 'assistant', uuid: 'q', timestamp: 'nope', message: { content: [text('hello there')] } }), {}, T0 + 77);
		expect(items[0]).toMatchObject({ at: T0 + 77 });
	});
});

describe('parseCodexTail', () => {
	const entry = (type: string, payload: Record<string, unknown>, ms: number): string => JSON.stringify({ timestamp: iso(ms), type, payload });

	it('assistant text from response_item and agent_message become one line, once', () => {
		const lines = [
			entry('response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Checking the repo first.' }] }, 0),
			entry('event_msg', { type: 'agent_message', message: 'Checking the repo first.' }, 5),
			entry('response_item', { type: 'message', role: 'developer', content: [{ type: 'input_text', text: 'secret system prompt' }] }, 6),
			entry('response_item', { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'owner words' }] }, 7),
		].join('\n');
		const items = parseCodexTail(lines, {}, T0);
		expect(items).toHaveLength(2);
		expect(new Set(items.map((i) => (i as { id: string }).id)).size).toBe(1);
		expect(JSON.stringify(items)).not.toMatch(/system prompt|owner words/);
	});

	it('shell calls become command steps paired with their output by call id; outputs are not read', () => {
		const lines = [
			entry('response_item', { type: 'function_call', name: 'shell', call_id: 'c1', arguments: JSON.stringify({ command: ['bash', '-lc', `cd app && API_TOKEN=${SK} git push origin main`] }) }, 0),
			entry('response_item', { type: 'function_call_output', call_id: 'c1', output: `secret output ${SK}` }, 2500),
			entry('response_item', { type: 'custom_tool_call', name: 'exec', call_id: 'c2', input: 'const r = await tools.exec_command({cmd:"npm test -- --ci", workdir:"/x"});' }, 3000),
			entry('response_item', { type: 'custom_tool_call', name: 'apply_patch', call_id: 'c3', input: '*** Begin Patch\n*** Update File: /work/crewly/src/a.ts\n@@\n-a\n+b\n*** End Patch' }, 4000),
			entry('response_item', { type: 'custom_tool_call_output', call_id: 'c3', output: [{ type: 'input_text', text: 'Success' }] }, 4100),
		].join('\n');
		const items = parseCodexTail(lines, { roots: ['/work/crewly'] }, T0);
		expect(items).toEqual([
			{ kind: 'step_start', id: 'c1', at: T0, shape: { kind: 'command', label: 'Ran', target: 'git push' } },
			{ kind: 'step_end', id: 'c1', at: T0 + 2500 },
			{ kind: 'step_start', id: 'c2', at: T0 + 3000, shape: { kind: 'command', label: 'Ran', target: 'npm test' } },
			{ kind: 'step_start', id: 'c3', at: T0 + 4000, shape: { kind: 'edit', label: 'Edited', target: 'crewly/src/a.ts' } },
			{ kind: 'step_end', id: 'c3', at: T0 + 4100 },
		]);
		expect(JSON.stringify(items)).not.toMatch(/secret output|sk-ant/);
	});

	it('survives garbage', () => {
		expect(parseCodexTail(['{', 'output_text', entry('response_item', { type: 'function_call', call_id: '../../x', name: 'shell', arguments: '{bad' }, 0)].join('\n'), {}, T0)).toEqual([]);
	});
});

describe('TranscriptTailService (incremental, real files)', () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), 'canvas-tail-'));
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	function make(file: string, kind: 'claude' | 'codex' = 'claude', now = T0 + 10_000) {
		const steps = new StepStream();
		const clock = { t: now };
		const svc = new TranscriptTailService({
			steps,
			sessions: () => ['dev'],
			locate: () => ({ kind, file }),
			now: () => clock.t,
		});
		return { steps, svc, clock };
	}
	const texts = (steps: StepStream): string[] => steps.recent('dev').filter((s) => s.kind === 'text').map((s) => s.text as string);

	it('reads only what was appended, never twice, and never a half-written line', async () => {
		const file = join(dir, 's.jsonl');
		writeFileSync(file, `${assistant('a', 0, [text('First.')])}\n`);
		const { steps, svc } = make(file);
		await svc.tick();
		expect(texts(steps)).toEqual(['First.']);
		await svc.tick();
		expect(texts(steps)).toEqual(['First.']);
		const second = assistant('b', 1000, [text('Second.')]);
		appendFileSync(file, second.slice(0, 30));
		await svc.tick();
		expect(texts(steps)).toEqual(['First.']);
		appendFileSync(file, `${second.slice(30)}\n${assistant('c', 2000, [text('Third.')])}\n`);
		await svc.tick();
		expect(texts(steps)).toEqual(['First.', 'Second.', 'Third.']);
	});

	it('a first look at a big transcript reads only the tail, from a whole line', async () => {
		const file = join(dir, 'big.jsonl');
		const lines: string[] = [];
		for (let i = 0; i < 3000; i += 1) lines.push(assistant(`u${i}`, i * 1000 - 3_000_000 + 3_000_000, [text(`Line number ${i} with some padding to make the file big enough ${'x'.repeat(80)}`)]));
		writeFileSync(file, `${lines.join('\n')}\n`);
		const { steps, svc } = make(file, 'claude', T0 + 3_000_000 + 1000);
		await svc.tick();
		const got = texts(steps);
		expect(got.length).toBeGreaterThan(0);
		expect(got.length).toBeLessThanOrEqual(10);
		expect(got[got.length - 1]).toMatch(/^Line number 2999 /);
		for (const g of got) expect(g).toMatch(/^Line number \d+ /);
	});

	it('a failed tool result marks its step failed', async () => {
		const file = join(dir, 'e.jsonl');
		writeFileSync(file, `${toolResult('tool-1', 2000, true, 'boom')}\n`);
		const { steps, svc } = make(file);
		steps.start('dev', { kind: 'command', label: 'Ran', target: 'npm test' }, { id: 'tool-1' }, T0);
		steps.finish('dev', 'tool-1', 'done', T0 + 1500);
		await svc.tick();
		expect(steps.recent('dev')[0]).toMatchObject({ id: 'tool-1', status: 'error', durationMs: 1500 });
	});

	it('restarts from the top when the file is replaced by a smaller one, and follows a new path', async () => {
		const a = join(dir, 'a.jsonl');
		const b = join(dir, 'b.jsonl');
		writeFileSync(a, `${assistant('a1', 0, [text('From a.')])}\n${assistant('a2', 100, [text('Still a.')])}\n`);
		writeFileSync(b, `${assistant('b1', 200, [text('From b.')])}\n`);
		let file = a;
		const steps = new StepStream();
		const svc = new TranscriptTailService({ steps, sessions: () => ['dev'], locate: () => ({ kind: 'claude', file }), now: () => T0 + 10_000 });
		await svc.tick();
		file = b;
		(svc as unknown as { located: Map<string, unknown> }).located.clear();
		await svc.tick();
		expect(texts(steps)).toEqual(['From a.', 'Still a.', 'From b.']);
	});

	it('Codex calls become steps with durations from the rollout timestamps', async () => {
		const file = join(dir, 'rollout.jsonl');
		const e = (type: string, payload: unknown, ms: number): string => JSON.stringify({ timestamp: iso(ms), type, payload });
		writeFileSync(
			file,
			[
				e('response_item', { type: 'function_call', name: 'shell', call_id: 'c1', arguments: JSON.stringify({ command: ['git', 'status'] }) }, 5000),
				e('response_item', { type: 'function_call_output', call_id: 'c1', output: 'x' }, 5800),
				e('event_msg', { type: 'agent_message', message: 'Status looks clean.' }, 6000),
			].join('\n') + '\n',
		);
		const { steps, svc } = make(file, 'codex');
		await svc.tick();
		expect(steps.recent('dev').map((s) => [s.kind, s.label, s.target ?? s.text, s.status, s.durationMs])).toEqual([
			['command', 'Ran', 'git status', 'done', 800],
			['text', 'Said', 'Status looks clean.', 'done', undefined],
		]);
	});

	it('a missing file, a missing locator result and a throwing locator do not break the pass', async () => {
		const steps = new StepStream();
		let mode = 0;
		const svc = new TranscriptTailService({
			steps,
			sessions: () => ['a', 'b', 'c'],
			locate: (s) => {
				if (s === 'a') return null;
				if (s === 'b') return { kind: 'claude', file: join(dir, 'nope.jsonl') };
				mode += 1;
				throw new Error('boom');
			},
		});
		await expect(svc.tick()).resolves.toBe(0);
		expect(mode).toBe(1);
	});

	it('uses only a stat per quiet pass (no read when nothing grew)', async () => {
		const file = join(dir, 'q.jsonl');
		writeFileSync(file, `${assistant('a', 0, [text('Hello there.')])}\n`);
		const { svc, steps } = make(file);
		await svc.tick();
		const spyRead = jest.spyOn(fsModule.promises, 'open');
		await svc.tick();
		await svc.tick();
		expect(spyRead).not.toHaveBeenCalled();
		spyRead.mockRestore();
		expect(texts(steps)).toHaveLength(1);
	});
});

describe('canvas wiring helpers', () => {
	it('locates Claude Code and Codex transcripts and nothing for other runtimes', async () => {
		const metas: Record<string, object> = {
			c: { runtimeType: 'claude-code', claudeSessionId: 'sid', cwd: '/w', env: { CLAUDE_CONFIG_DIR: '/acct' } },
			x: { runtimeType: 'codex-cli', claudeSessionId: 'conv-1' },
			g: { runtimeType: 'gemini-cli', claudeSessionId: 'g1', cwd: '/w' },
			n: { runtimeType: 'claude-code', cwd: '/w' },
		};
		const findClaude = jest.fn(() => '/acct/projects/w/sid.jsonl');
		const locate = createTranscriptLocator({
			meta: (s) => metas[s] as never,
			claudeHomes: (m) => [m.env?.CLAUDE_CONFIG_DIR ?? '', '/home/.claude'],
			findClaude,
			codexHome: () => '/codex',
			findCodex: async (home, id) => `${home}/sessions/rollout-${id}.jsonl`,
		});
		expect(await locate('c')).toEqual({ kind: 'claude', file: '/acct/projects/w/sid.jsonl' });
		expect(findClaude).toHaveBeenCalledWith({ sessionId: 'sid', cwd: '/w', claudeHomes: ['/acct', '/home/.claude'] });
		expect(await locate('x')).toEqual({ kind: 'codex', file: '/codex/sessions/rollout-conv-1.jsonl' });
		expect(await locate('g')).toBeNull();
		expect(await locate('n')).toBeNull();
		expect(await locate('ghost')).toBeNull();
	});

	it('the secrets provider reads secret-named variables and caches them for a minute', () => {
		let t = 0;
		const env: NodeJS.ProcessEnv = { SLACK_SIGNING_SECRET: '0123456789abcdef0123', PATH: '/bin', API_TOKEN: 'short' };
		const get = createSecretsProvider(() => env, 60_000, () => t);
		expect(get().map((s) => s.name)).toEqual(['SLACK_SIGNING_SECRET']);
		env.OTHER_API_KEY = 'a-very-long-secret-value-1';
		expect(get()).toHaveLength(1);
		t = 61_000;
		expect(get()).toHaveLength(2);
	});

	it('stop calls the dashboard stop route of the member with the owner credentials', async () => {
		const calls: Array<{ url: string; init: RequestInit }> = [];
		const stop = createStopAgent({
			webPort: 8787,
			teams: async () => [
				{ id: 'team-1', name: 'Growth', members: [{ id: 'm1', name: 'Ella', sessionName: 'growth-ella-1' }, { id: 'm2', name: 'Vera', sessionName: 'growth-vera-2' }] },
			],
			headers: () => ({ 'x-crewly-internal': 'cred' }),
			fetchImpl: (async (url: string, init: RequestInit) => {
				calls.push({ url, init });
				return new Response('{"success":true}', { status: 200 });
			}) as never,
		});
		expect(await stop('growth-vera-2')).toEqual({ ok: true });
		expect(calls[0].url).toBe('http://127.0.0.1:8787/api/teams/team-1/members/m2/stop');
		expect(calls[0].init.method).toBe('POST');
		expect((calls[0].init.headers as Record<string, string>)['x-crewly-internal']).toBe('cred');
		expect(await stop('nobody')).toEqual({ ok: false, error: 'No such team member' });
	});

	it('a refused or failing stop reports why', async () => {
		const mk = (fetchImpl: unknown) =>
			createStopAgent({ webPort: 1, teams: async () => [{ id: 't', name: 'T', members: [{ id: 'm', name: 'A', sessionName: 's' }] }], headers: () => ({}), fetchImpl: fetchImpl as never });
		expect(await mk(async () => new Response('{"success":false,"error":"nope"}', { status: 500 }))('s')).toEqual({ ok: false, error: 'nope' });
		expect(await mk(async () => { throw new Error('ECONNREFUSED'); })('s')).toEqual({ ok: false, error: 'ECONNREFUSED' });
	});
});

describe('computeCapabilities', () => {
	const now = T0;
	const live = { id: 'growth-ella-1', status: 'reading', lastActionAt: now - 60_000 };
	const caps = (session: string, over: { stopped?: boolean; browser?: object; terminal?: boolean | 'throws' } = {}) =>
		computeCapabilities(
			session,
			{ stopped: over.stopped ?? false, now },
			{
				browserSession: () => over.browser as never,
				terminalExists: () => {
					if (over.terminal === 'throws') throw new Error('no backend');
					return over.terminal ?? true;
				},
			},
		);

	it("a Chrome session that is live is the agent's browser, with the remote-browser session id", () => {
		expect(caps('growth-ella-1', { browser: live })).toEqual({ hasBrowser: true, browserKind: 'chrome', browserSessionId: 'growth-ella-1', hasTerminal: true, canMessage: true, canStop: true });
	});

	it('a finished, stopped or long idle browser session is not offered', () => {
		for (const browser of [{ ...live, status: 'done' }, { ...live, status: 'stopped' }, { ...live, lastActionAt: now - 11 * 60_000 }, undefined]) {
			expect(caps('a', { browser })).toMatchObject({ hasBrowser: false });
			expect(caps('a', { browser })).not.toHaveProperty('browserKind');
		}
	});

	it('no terminal for a stopped agent, a missing session or a backend that throws', () => {
		expect(caps('a', { stopped: true }).hasTerminal).toBe(false);
		expect(caps('a', { terminal: false }).hasTerminal).toBe(false);
		expect(caps('a', { terminal: 'throws' }).hasTerminal).toBe(false);
	});

	it('every agent can be messaged; a stopped one and the orchestrator cannot be stopped', () => {
		expect(caps('a', { stopped: true })).toMatchObject({ canMessage: true, canStop: false });
		expect(caps('crewly-orc')).toMatchObject({ canMessage: true, canStop: false });
	});
});
