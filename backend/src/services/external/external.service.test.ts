import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ExternalService, ExternalError, joinHostUrl } from './external.service.js';
import { ExternalStore } from './external-store.js';
import type { ExternalAuditEntry } from './external-audit.js';

describe('ExternalService', () => {
	let dir: string;
	let store: ExternalStore;
	let calls: Array<{ method: string; path: string; body?: unknown }>;
	let typing: Array<[string, boolean]>;
	let audit: ExternalAuditEntry[];
	let fetched: Array<{ url: string; init: RequestInit }>;
	let hostResponse: () => Response;
	let refreshed: number;
	let svc: ExternalService;

	const front = { kind: 'agent' as const, session: 'avery-1' };
	const conv = 'ext-aaaaaaaaaaaa';

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-svc-'));
		store = new ExternalStore({ dir });
		store.setEmbed({ embedId: 'emb_portal1', frontAgent: 'avery-1' });
		store.noteConversation({ conversationId: conv, embedId: 'emb_portal1', sub: 't-1', askerName: 'Ms Lin', roles: ['teacher'], profileId: 'staff' });
		store.noteConversation({ conversationId: 'ext-bbbbbbbbbbbb', embedId: 'emb_portal1', sub: 't-2', askerName: 'Wang Lei', roles: ['teacher'], profileId: 'staff' });
		calls = [];
		typing = [];
		audit = [];
		fetched = [];
		refreshed = 0;
		hostResponse = () => new Response('{"classes":[]}', { status: 200, headers: { 'content-type': 'application/json' } });
		svc = new ExternalService({
			store,
			cloud: {
				isAvailable: () => true,
				request: async <T,>(method: string, p: string, opts?: { body?: unknown }) => {
					calls.push({ method, path: p, body: opts?.body });
					return (p.endsWith('/host-token') ? { token: 'host.jwt.token', hostApiBase: 'https://portal.example/api/crewly/ops' } : {}) as T;
				},
			},
			audit: (e) => audit.push(e),
			setTyping: async (_e, c, on) => {
				typing.push([c, on]);
			},
			refreshPolling: () => refreshed++,
			internalSessions: async () => ['avery-1', 'orc-session'],
			fetchImpl: (async (url: string, init: RequestInit) => {
				fetched.push({ url, init });
				return hostResponse();
			}) as unknown as typeof fetch,
		});
	});
	afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

	describe('reply', () => {
		it('uploads a clean reply, turns typing off and audits without text', async () => {
			await expect(svc.reply(front, conv, ' Your class is at 3pm. ')).resolves.toEqual({ sent: true });
			expect(calls).toEqual([{ method: 'POST', path: '/embeds/emb_portal1/replies', body: { conversationId: conv, text: 'Your class is at 3pm.' } }]);
			expect(typing).toEqual([[conv, false]]);
			expect(audit).toEqual([expect.objectContaining({ event: 'replied', agent: 'avery-1', chars: 21 })]);
		});

		it('blocks a reply naming another asker or a session, and sends nothing', async () => {
			const err = await svc.reply(front, conv, 'Wang Lei asked orc-session too').catch((e) => e);
			expect(err).toBeInstanceOf(ExternalError);
			expect(err.status).toBe(422);
			expect(err.details.reasons.sort()).toEqual(['internal_id', 'other_asker']);
			expect(calls).toEqual([]);
			expect(audit[0]).toMatchObject({ event: 'reply_blocked', reasons: expect.any(Array) });
		});

		it('refuses an agent other than the front agent, and unknown conversations', async () => {
			await expect(svc.reply({ kind: 'agent', session: 'rex' }, conv, 'hi')).rejects.toMatchObject({ status: 403 });
			await expect(svc.reply(front, 'ext-cccccccccccc', 'hi')).rejects.toMatchObject({ status: 404 });
			await expect(svc.reply(front, '../x', 'hi')).rejects.toMatchObject({ status: 404 });
		});

		it('lets the owner reply', async () => {
			await expect(svc.reply({ kind: 'owner' }, conv, 'Hello')).resolves.toEqual({ sent: true });
		});
	});

	describe('hostCall', () => {
		it('gets a token for the asker and calls the host with it, without following redirects', async () => {
			const r = await svc.hostCall(front, conv, 'get', '/my-classes?from=2026-10-15');
			expect(calls[0]).toEqual({ method: 'POST', path: '/embeds/emb_portal1/host-token', body: { conversationId: conv } });
			expect(fetched[0].url).toBe('https://portal.example/api/crewly/ops/my-classes?from=2026-10-15');
			expect(fetched[0].init).toMatchObject({ method: 'GET', redirect: 'manual', headers: expect.objectContaining({ Authorization: 'Bearer host.jwt.token' }) });
			expect(r).toEqual({ status: 200, contentType: 'application/json', body: '{"classes":[]}', truncated: false });
			expect(audit[0]).toMatchObject({ event: 'host_call', method: 'GET', path: '/my-classes', status: 200 });
		});

		it('sends a JSON body on POST', async () => {
			await svc.hostCall(front, conv, 'POST', '/tickets', { title: 'Projector broken' });
			expect(fetched[0].init.body).toBe('{"title":"Projector broken"}');
		});

		it('refuses paths that leave the host API and bad methods', async () => {
			for (const p of ['my-classes', '//evil.example/x', '/../admin', '/a/%2e%2e/%2e%2e/admin', '/a b']) {
				await expect(svc.hostCall(front, conv, 'GET', p)).rejects.toMatchObject({ status: 400 });
			}
			await expect(svc.hostCall(front, conv, 'TRACE', '/x')).rejects.toMatchObject({ code: 'bad_method' });
			expect(fetched).toEqual([]);
		});

		it('caps a large response', async () => {
			hostResponse = () => new Response('x'.repeat(70 * 1024), { status: 200 });
			const r = await svc.hostCall(front, conv, 'GET', '/big');
			expect(r.truncated).toBe(true);
			expect(r.body.length).toBe(64 * 1024);
		});

		it('only the front agent may call', async () => {
			await expect(svc.hostCall({ kind: 'agent', session: 'rex' }, conv, 'GET', '/me')).rejects.toMatchObject({ status: 403 });
		});
	});

	it('attaches and detaches embeds', () => {
		expect(svc.attachEmbed({ embedId: 'emb_site22', frontAgent: 'nova-1', label: 'CE site' })).toEqual({ embedId: 'emb_site22', frontAgent: 'nova-1', label: 'CE site' });
		expect(refreshed).toBe(1);
		expect(() => svc.attachEmbed({ embedId: 'x', frontAgent: 'nova-1' })).toThrow(ExternalError);
		svc.detachEmbed('emb_site22');
		expect(() => svc.detachEmbed('emb_site22')).toThrow(ExternalError);
	});
});

describe('joinHostUrl', () => {
	it('joins under the base path', () => {
		expect(joinHostUrl('https://p.example/api/ops/', '/me')).toBe('https://p.example/api/ops/me');
		expect(joinHostUrl('https://p.example', '/me')).toBe('https://p.example/me');
	});

	it('refuses a non-http base', () => {
		expect(() => joinHostUrl('file:///etc', '/passwd')).toThrow(ExternalError);
	});
});
