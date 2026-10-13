import { gunzipSync } from 'zlib';
import { CanvasTerminalService } from './canvas-terminal.service.js';
import { CANVAS_CONSTANTS as C } from '../../../constants.js';

const SK = ['sk', 'ant', 'api03', 'AbCdEfGhIjKlMnOpQrStUv0123456789'].join('-');

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

interface Frame {
	url: string;
	headers: Record<string, string>;
	body: { instanceId: string; session: string; seq: number; lines: string[]; closed?: boolean; reason?: string; at: string };
}

function setup(opts: { respond?: (f: Frame) => { status: number; json?: unknown }; token?: string | null } = {}) {
	const clock = new Clock();
	const frames: Frame[] = [];
	const screen = { text: 'line one\nline two\n', exists: true };
	const state = { token: opts.token === undefined ? 'tok' : opts.token };
	const refresh = jest.fn(async () => true);
	const svc = new CanvasTerminalService({
		cloud: { getToken: () => state.token, getCloudUrl: () => (state.token ? 'https://cloud.test/' : null), tryRefreshToken: refresh },
		identity: async () => ({ instanceId: 'dev-1' }),
		capture: (_s, lines) => (screen.exists ? screen.text.replace(/\n$/, '').split('\n').slice(-lines).join('\n') : null),
		exists: () => screen.exists,
		secrets: () => [{ name: 'SLACK_SIGNING_SECRET', value: '0123456789abcdef0123' }],
		fetchImpl: async (url, init) => {
			const headers = init.headers as Record<string, string>;
			const body = JSON.parse(gunzipSync(init.body as Buffer).toString('utf-8'));
			const f: Frame = { url, headers, body };
			frames.push(f);
			const r = opts.respond?.(f) ?? { status: 200, json: { success: true, data: { keep: true } } };
			return new Response(JSON.stringify(r.json ?? {}), { status: r.status });
		},
		now: clock.now,
		setTimeout: clock.setTimeout,
		clearTimeout: clock.clearTimeout,
		logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as never,
	});
	return { svc, clock, frames, screen, state, refresh };
}

describe('CanvasTerminalService', () => {
	it('the first frame is the last 200 lines, masked, gzipped, with the instance header and bearer', async () => {
		const { svc, clock, frames, screen } = setup();
		screen.text = `${Array.from({ length: 300 }, (_, i) => `row ${i}`).join('\n')}\nexport ANTHROPIC_API_KEY=${SK}\nsigning 0123456789abcdef0123 mail a@b.co\n`;
		expect(svc.open('dev')).toEqual({ ok: true });
		await clock.advance(0);
		expect(frames).toHaveLength(1);
		const f = frames[0];
		expect(f.url).toBe('https://cloud.test/api/cloud/canvas/terminal/frame');
		expect(f.headers).toMatchObject({ Authorization: 'Bearer tok', 'Content-Encoding': 'gzip', 'X-Crewly-Instance-Id': 'dev-1' });
		expect(f.body).toMatchObject({ instanceId: 'dev-1', session: 'dev', seq: 1 });
		expect(f.body.lines).toHaveLength(200);
		expect(f.body.lines[198]).toBe('export ANTHROPIC_API_KEY=[redacted]');
		expect(f.body.lines[199]).toBe('signing [redacted] mail [email]');
		expect(JSON.stringify(f.body)).not.toMatch(/sk-ant|0123456789abcdef0123|a@b\.co/);
		svc.closeAll();
	});

	it('posts about once a second, and only when the masked tail changed', async () => {
		const { svc, clock, frames, screen } = setup();
		svc.open('dev');
		await clock.advance(0);
		await clock.advance(3_000);
		expect(frames).toHaveLength(1);
		screen.text += 'new line\n';
		await clock.advance(1_000);
		expect(frames).toHaveLength(2);
		expect(frames[1].body.seq).toBe(2);
		expect(frames[1].body.lines.slice(-1)).toEqual(['new line']);
		svc.closeAll();
	});

	it('a change only in what is masked sends nothing new', async () => {
		const { svc, clock, frames, screen } = setup();
		screen.text = 'token: abcdefghijkl1\n';
		svc.open('dev');
		await clock.advance(0);
		screen.text = 'token: zzzzzzzzzzzz2\n';
		await clock.advance(2_000);
		expect(frames).toHaveLength(1);
		svc.closeAll();
	});

	it('stops after 2 minutes without a renew, with a closing frame', async () => {
		const { svc, clock, frames, screen } = setup();
		svc.open('dev');
		await clock.advance(0);
		await clock.advance(60_000);
		expect(svc.renew('dev')).toBe(true);
		for (let i = 0; i < 5; i += 1) {
			screen.text += `tick ${i}\n`;
			await clock.advance(1_000);
		}
		await clock.advance(C.TERMINAL_LEASE_MS + 2_000);
		expect(svc.active()).toEqual([]);
		const last = frames[frames.length - 1];
		expect(last.body).toMatchObject({ closed: true, reason: 'lease_expired', lines: [] });
		const count = frames.length;
		screen.text += 'later\n';
		await clock.advance(10_000);
		expect(frames).toHaveLength(count);
		expect(clock.pending).toBe(0);
	});

	it('renew keeps it going past the first lease', async () => {
		const { svc, clock, frames, screen } = setup();
		svc.open('dev');
		for (let m = 0; m < 5; m += 1) {
			await clock.advance(60_000);
			screen.text += `m${m}\n`;
			expect(svc.renew('dev')).toBe(true);
		}
		expect(svc.active()).toEqual(['dev']);
		expect(frames.length).toBeGreaterThan(3);
		svc.closeAll();
	});

	it('close sends a last frame and stops; renew of a closed stream is false', async () => {
		const { svc, clock, frames } = setup();
		svc.open('dev');
		await clock.advance(0);
		svc.close('dev');
		await settle();
		expect(frames[frames.length - 1].body).toMatchObject({ closed: true, reason: 'closed' });
		expect(svc.renew('dev')).toBe(false);
		expect(clock.pending).toBe(0);
	});

	it('reopening an open stream renews it and sends a full frame again', async () => {
		const { svc, clock, frames } = setup();
		svc.open('dev');
		await clock.advance(0);
		svc.open('dev');
		await clock.advance(0);
		expect(frames).toHaveLength(2);
		expect(svc.active()).toEqual(['dev']);
		svc.closeAll();
	});

	it('ends when the agent session is gone', async () => {
		const { svc, clock, frames, screen } = setup();
		svc.open('dev');
		await clock.advance(0);
		screen.exists = false;
		await clock.advance(1_000);
		expect(svc.active()).toEqual([]);
		expect(frames[frames.length - 1].body).toMatchObject({ closed: true, reason: 'session_gone' });
	});

	it('Cloud no longer wanting frames (keep:false, 404, 403, 410) stops the stream', async () => {
		for (const respond of [
			() => ({ status: 200, json: { data: { keep: false } } }),
			() => ({ status: 404 }),
			() => ({ status: 403 }),
			() => ({ status: 410 }),
		]) {
			const { svc, clock } = setup({ respond });
			svc.open('dev');
			await clock.advance(0);
			expect(svc.active()).toEqual([]);
		}
	});

	it('five failed posts in a row end the stream; a success in between resets the count', async () => {
		let n = 0;
		const { svc, clock, screen } = setup({ respond: () => (n++ % 2 === 0 ? { status: 500 } : { status: 200, json: { data: { keep: true } } }) });
		svc.open('dev');
		for (let i = 0; i < 8; i += 1) {
			screen.text += `x${i}\n`;
			await clock.advance(1_000);
		}
		expect(svc.active()).toEqual(['dev']);
		svc.closeAll();
		const bad = setup({ respond: () => ({ status: 500 }) });
		bad.svc.open('dev');
		await bad.clock.advance(10_000);
		expect(bad.svc.active()).toEqual([]);
	});

	it('refreshes the token once on 401', async () => {
		let first = true;
		const { svc, clock, refresh, frames } = setup({ respond: () => (first ? ((first = false), { status: 401 }) : { status: 200, json: { data: { keep: true } } }) });
		svc.open('dev');
		await clock.advance(0);
		expect(refresh).toHaveBeenCalledTimes(1);
		expect(frames).toHaveLength(2);
		svc.closeAll();
	});

	it('limits the streams open at once, and refuses without a session or a sign-in', async () => {
		const { svc, clock, screen, state } = setup();
		for (const s of ['a', 'b', 'c']) expect(svc.open(s)).toEqual({ ok: true });
		expect(svc.open('d')).toEqual({ ok: false, code: 'too_many_streams' });
		svc.closeAll();
		screen.exists = false;
		expect(svc.open('a')).toEqual({ ok: false, code: 'no_session' });
		screen.exists = true;
		state.token = null;
		expect(svc.open('a')).toEqual({ ok: false, code: 'not_signed_in' });
		await clock.advance(0);
	});

	it('a stream ends after 30 minutes whatever the viewer does', async () => {
		const { svc, clock, frames, screen } = setup();
		svc.open('dev');
		for (let m = 0; m < 31; m += 1) {
			screen.text += `m${m}\n`;
			await clock.advance(60_000);
			svc.renew('dev');
		}
		expect(svc.active()).toEqual([]);
		expect(frames[frames.length - 1].body.reason).toBe('too_long');
	});
});
