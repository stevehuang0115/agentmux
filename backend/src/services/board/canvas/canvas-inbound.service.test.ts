import { CanvasInboundService, canvasCapabilities, parseCanvasFetchResponse, parseCanvasRelayData } from './canvas-inbound.service.js';
import { CANVAS_CONSTANTS as C } from '../../../constants.js';
import type { IncomingMessage } from '../../cloud/cloud-sync.types.js';

type Handler = (msg: IncomingMessage) => void;

interface Call {
	method: string;
	url: string;
	headers: Record<string, string>;
	body?: Record<string, unknown>;
}

function setup(opts: {
	stored?: Record<string, unknown> | null;
	status?: number;
	agents?: string[];
	stop?: { ok: boolean; error?: string };
	token?: string | null;
	deduped?: boolean;
} = {}) {
	const handlers = new Set<Handler>();
	const calls: Call[] = [];
	const results: Array<Record<string, unknown>> = [];
	const recorded: Array<Record<string, unknown>> = [];
	const delivered: unknown[] = [];
	const terminal = { open: jest.fn(() => ({ ok: true }) as const), renew: jest.fn(() => true), close: jest.fn() };
	const stopAgent = jest.fn(async () => opts.stop ?? { ok: true });
	const onAction = jest.fn();
	const state = { token: opts.token === undefined ? 'tok' : opts.token };
	const refresh = jest.fn(async () => true);
	const svc = new CanvasInboundService({
		source: { on: (_e, l) => handlers.add(l as Handler), off: (_e, l) => handlers.delete(l as Handler) },
		cloud: { getToken: () => state.token, getCloudUrl: () => 'https://cloud.test', tryRefreshToken: refresh },
		chat: {
			ensureDmChannel: ({ agentSession }: { agentSession: string }) => ({ channel: { id: `dm-${agentSession}` } }),
			recordTurn: (input: Record<string, unknown>) => {
				recorded.push(input);
				return { deduped: opts.deduped === true, message: { id: 'm1', content: input.content } };
			},
			getChannel: (id: string) => ({ id }),
		} as never,
		identity: async () => ({ instanceId: 'dev-1', deviceName: 'Mac' }),
		deliver: async (channel, message) => {
			delivered.push([channel, message]);
		},
		agentExists: async (s) => (opts.agents ?? ['growth-ella-1', 'crewly-orc']).includes(s),
		stopAgent,
		terminal,
		onAction,
		fetchImpl: async (url, init) => {
			const call: Call = { method: String(init.method), url, headers: init.headers as Record<string, string>, ...(init.body ? { body: JSON.parse(String(init.body)) } : {}) };
			calls.push(call);
			if (call.method === 'POST') {
				results.push(call.body as Record<string, unknown>);
				return new Response('{}', { status: 200 });
			}
			const stored = opts.stored === undefined ? { actionId: 'act-1', instanceId: 'dev-1', session: 'growth-ella-1', kind: 'message', text: 'Please post the clips' } : opts.stored;
			if (opts.status && opts.status !== 200) return new Response('{}', { status: opts.status });
			return new Response(JSON.stringify({ success: true, data: stored }), { status: stored ? 200 : 404 });
		},
		sleep: async () => undefined,
		logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as never,
	});
	return { svc, handlers, calls, results, recorded, delivered, terminal, stopAgent, onAction, state, refresh };
}

const push = (payload: Record<string, unknown>, type = 'canvas_action'): IncomingMessage =>
	({ id: 'r1', from: 'portal', fromDeviceName: 'portal', type, payload, encrypted: false, sentAt: '' }) as never;
const data = (over: Record<string, unknown> = {}): Record<string, unknown> => ({ actionId: 'act-1', instanceId: 'dev-1', session: 'growth-ella-1', kind: 'message', ...over });

describe('relay parsing', () => {
	it('accepts a well-formed push and rejects malformed ones', () => {
		expect(parseCanvasRelayData(data())).toEqual(data());
		for (const bad of [null, 'x', [], data({ actionId: '../x' }), data({ actionId: '' }), data({ instanceId: '' }), data({ session: 'a b' }), data({ session: 'x'.repeat(200) }), data({ kind: 'rm_rf' }), data({ kind: undefined })]) {
			expect(parseCanvasRelayData(bad)).toBeNull();
		}
	});

	it('parses Cloud\'s stored action (data envelope)', () => {
		expect(parseCanvasFetchResponse({ success: true, data: { ...data(), text: 'hi', clientMessageId: 'cm-1' } })).toEqual({ ...data(), text: 'hi', clientMessageId: 'cm-1' });
		expect(parseCanvasFetchResponse(data())).toBeNull();
		expect(parseCanvasFetchResponse({ data: data({ kind: 'nope' }) })).toBeNull();
	});
});

describe('CanvasInboundService', () => {
	it('advertises the capability only while running, and listens only while running', () => {
		const { svc, handlers } = setup();
		expect(canvasCapabilities()).toEqual([]);
		svc.start();
		svc.start();
		expect(handlers.size).toBe(1);
		expect(canvasCapabilities()).toEqual([C.CAPABILITY]);
		svc.stop();
		expect(handlers.size).toBe(0);
		expect(canvasCapabilities()).toEqual([]);
	});

	it('ignores other message types and malformed pushes without any request', async () => {
		const { svc, calls } = setup();
		expect(await svc.handle(push(data(), 'talk_message'))).toBe('ignored');
		expect(await svc.handle(push({ nonsense: true }))).toBe('ignored');
		expect(calls).toHaveLength(0);
	});

	describe('who may act', () => {
		it('a push for another machine is not run', async () => {
			const { svc, calls } = setup();
			expect(await svc.handle(push(data({ instanceId: 'other' })))).toBe('not_for_this_machine');
			expect(calls).toHaveLength(0);
		});

		it('an action Cloud does not know for this account and machine (404) is never run', async () => {
			const { svc, recorded, stopAgent, terminal, results } = setup({ stored: null });
			for (const kind of ['message', 'stop', 'terminal_open']) expect(await svc.handle(push(data({ kind, actionId: `a-${kind}` })))).toBe('unverified');
			expect(recorded).toHaveLength(0);
			expect(stopAgent).not.toHaveBeenCalled();
			expect(terminal.open).not.toHaveBeenCalled();
			expect(results).toHaveLength(0);
		});

		it('a member or guest of the account (403 from Cloud) is not the owner: never run', async () => {
			const { svc, stopAgent } = setup({ status: 403 });
			expect(await svc.handle(push(data({ kind: 'stop' })))).toBe('unverified');
			expect(stopAgent).not.toHaveBeenCalled();
		});

		it('fetches with the machine\'s own token and instance id; a push cannot carry its own text', async () => {
			const { svc, calls, recorded } = setup();
			await svc.handle(push(data({ text: 'INJECTED by whoever dropped this in the queue' })));
			expect(calls[0]).toMatchObject({ method: 'GET', url: 'https://cloud.test/api/cloud/canvas/actions/act-1?instanceId=dev-1' });
			expect(calls[0].headers.Authorization).toBe('Bearer tok');
			expect(recorded[0].content).toBe('Please post the clips');
		});

		it('what Cloud stored must match the push (id, machine, agent, kind)', async () => {
			for (const stored of [
				{ actionId: 'act-1', instanceId: 'dev-1', session: 'someone-else', kind: 'message', text: 'x' },
				{ actionId: 'act-1', instanceId: 'dev-1', session: 'growth-ella-1', kind: 'stop' },
				{ actionId: 'act-1', instanceId: 'other', session: 'growth-ella-1', kind: 'message', text: 'x' },
				{ actionId: 'act-2', instanceId: 'dev-1', session: 'growth-ella-1', kind: 'message', text: 'x' },
			]) {
				const { svc, recorded, stopAgent } = setup({ stored });
				expect(await svc.handle(push(data()))).toBe('unverified');
				expect(recorded).toHaveLength(0);
				expect(stopAgent).not.toHaveBeenCalled();
			}
		});

		it('not signed in: nothing runs', async () => {
			const { svc, recorded } = setup({ token: null });
			expect(await svc.handle(push(data()))).toBe('fetch_failed');
			expect(recorded).toHaveLength(0);
		});

		it('refreshes the token once on 401 and carries on', async () => {
			const { svc, refresh } = setup({ status: 401 });
			await svc.handle(push(data()));
			expect(refresh).toHaveBeenCalledTimes(1);
		});

		it('an agent this machine does not have is refused and reported', async () => {
			const { svc, results, recorded } = setup({ agents: [], stored: { ...data(), text: 'hi' } });
			expect(await svc.handle(push(data()))).toBe('refused');
			expect(recorded).toHaveLength(0);
			expect(results[0]).toMatchObject({ instanceId: 'dev-1', ok: false, code: 'no_agent' });
		});
	});

	describe('message', () => {
		it('is recorded as the owner\'s message in the agent DM and handed to the agent like Talk', async () => {
			const { svc, recorded, delivered, results, onAction } = setup();
			expect(await svc.handle(push(data()))).toBe('done');
			expect(recorded[0]).toMatchObject({ channelId: 'dm-growth-ella-1', senderType: 'user', content: 'Please post the clips', clientMessageId: 'canvas-act-1', metadata: { source: 'cloud-talk' } });
			expect(delivered).toHaveLength(1);
			expect(results).toEqual([{ instanceId: 'dev-1', ok: true }]);
			expect(onAction).toHaveBeenCalled();
		});

		it('uses the client message id Cloud stored, when there is one', async () => {
			const { svc, recorded } = setup({ stored: { ...data(), text: 'hi', clientMessageId: 'cm-9' } });
			await svc.handle(push(data()));
			expect(recorded[0].clientMessageId).toBe('cm-9');
		});

		it('an empty or oversized text is refused', async () => {
			for (const text of ['   ', 'x'.repeat(C.MESSAGE_MAX + 1)]) {
				const { svc, recorded, results } = setup({ stored: { ...data(), text } });
				expect(await svc.handle(push(data()))).toBe('refused');
				expect(recorded).toHaveLength(0);
				expect(results[0]).toMatchObject({ ok: false });
			}
		});

		it('a message already recorded (a re-push) is not delivered twice', async () => {
			const { svc, delivered } = setup({ deduped: true });
			expect(await svc.handle(push(data()))).toBe('done');
			expect(delivered).toHaveLength(0);
		});

		it('a re-push of an action already carried out only re-reports it', async () => {
			const { svc, recorded, results } = setup();
			await svc.handle(push(data()));
			expect(await svc.handle(push(data()))).toBe('duplicate');
			expect(recorded).toHaveLength(1);
			expect(results).toHaveLength(2);
		});

		it('an orchestrator spelled per machine is folded back', async () => {
			const { svc, recorded } = setup({ stored: { ...data({ session: 'crewly-orc@dev-1' }), text: 'hi' } });
			await svc.handle(push(data({ session: 'crewly-orc@dev-1' })));
			expect(recorded[0].channelId).toBe('dm-crewly-orc');
		});
	});

	describe('stop', () => {
		it('stops the agent and reports', async () => {
			const { svc, stopAgent, results } = setup({ stored: data({ kind: 'stop' }) });
			expect(await svc.handle(push(data({ kind: 'stop' })))).toBe('done');
			expect(stopAgent).toHaveBeenCalledWith('growth-ella-1');
			expect(results[0]).toEqual({ instanceId: 'dev-1', ok: true });
		});

		it('says why when the stop failed', async () => {
			const { svc, results } = setup({ stored: data({ kind: 'stop' }), stop: { ok: false, error: 'Team member not found' } });
			expect(await svc.handle(push(data({ kind: 'stop' })))).toBe('refused');
			expect(results[0]).toMatchObject({ ok: false, code: 'stop_failed', error: 'Team member not found' });
		});

		it('the orchestrator is not stopped from the canvas', async () => {
			const { svc, stopAgent, results } = setup({ stored: data({ kind: 'stop', session: 'crewly-orc' }) });
			expect(await svc.handle(push(data({ kind: 'stop', session: 'crewly-orc' })))).toBe('refused');
			expect(stopAgent).not.toHaveBeenCalled();
			expect(results[0]).toMatchObject({ code: 'not_allowed' });
		});
	});

	describe('terminal', () => {
		it('open, renew and close drive the terminal service', async () => {
			const { svc, terminal } = setup({ stored: data({ kind: 'terminal_open' }) });
			expect(await svc.handle(push(data({ kind: 'terminal_open' })))).toBe('done');
			expect(terminal.open).toHaveBeenCalledWith('growth-ella-1');
			const r = setup({ stored: data({ kind: 'terminal_renew' }) });
			expect(await r.svc.handle(push(data({ kind: 'terminal_renew' })))).toBe('done');
			expect(r.terminal.renew).toHaveBeenCalledWith('growth-ella-1');
			expect(r.terminal.open).not.toHaveBeenCalled();
			const c = setup({ stored: data({ kind: 'terminal_close' }) });
			expect(await c.svc.handle(push(data({ kind: 'terminal_close' })))).toBe('done');
			expect(c.terminal.close).toHaveBeenCalledWith('growth-ella-1', 'closed');
		});

		it('a renew with no stream (the machine restarted) opens one', async () => {
			const t = setup({ stored: data({ kind: 'terminal_renew' }) });
			t.terminal.renew.mockReturnValue(false);
			expect(await t.svc.handle(push(data({ kind: 'terminal_renew' })))).toBe('done');
			expect(t.terminal.open).toHaveBeenCalledWith('growth-ella-1');
		});

		it('a terminal that cannot open is reported', async () => {
			const t = setup({ stored: data({ kind: 'terminal_open' }) });
			t.terminal.open.mockReturnValue({ ok: false, code: 'too_many_streams' } as never);
			expect(await t.svc.handle(push(data({ kind: 'terminal_open' })))).toBe('refused');
			expect(t.results[0]).toMatchObject({ ok: false, code: 'too_many_streams' });
		});
	});

	it('handles pushes arriving on the relay listener', async () => {
		const { svc, handlers, recorded } = setup();
		svc.start();
		[...handlers][0](push(data()));
		await new Promise((r) => setImmediate(r));
		await new Promise((r) => setImmediate(r));
		expect(recorded).toHaveLength(1);
		svc.stop();
	});
});
