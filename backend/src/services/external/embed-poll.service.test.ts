import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EmbedPollService, type EmbedCloud } from './embed-poll.service.js';
import { ExternalStore } from './external-store.js';
import type { ExternalAuditEntry } from './external-audit.js';

const item = (id: string, conv = 'ext-aaaaaaaaaaaa', sub = 't-1') => ({
	messageId: id,
	conversationId: conv,
	sub,
	asker: { name: 'Ms Lin', roles: ['teacher'] },
	profileId: 'staff',
	text: `question ${id}`,
	at: '2026-10-15T08:00:00Z',
});

describe('EmbedPollService', () => {
	let dir: string;
	let store: ExternalStore;
	let calls: Array<{ method: string; path: string; body?: unknown }>;
	let pending: unknown[];
	let sent: Array<{ session: string; text: string }>;
	let deliverOk: boolean;
	let acting: Array<[string, string]>;
	let audit: ExternalAuditEntry[];
	let svc: EmbedPollService;

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-poll-'));
		store = new ExternalStore({ dir });
		store.setEmbed({ embedId: 'emb_portal1', frontAgent: 'avery-1', label: 'SteamFun portal' });
		calls = [];
		pending = [];
		sent = [];
		deliverOk = true;
		acting = [];
		audit = [];
		const cloud: EmbedCloud = {
			isAvailable: () => true,
			request: async <T,>(method: string, p: string, opts?: { body?: unknown }) => {
				calls.push({ method, path: p, body: opts?.body });
				return (p.endsWith('/pending') ? { items: pending } : {}) as T;
			},
		};
		svc = new EmbedPollService({
			store,
			cloud,
			skillsPath: () => '/sk',
			sendToAgent: async (session, text) => {
				sent.push({ session, text });
				return deliverOk;
			},
			recordActingFor: (s, p) => acting.push([s, p]),
			audit: (e) => audit.push(e),
			sleep: async () => undefined,
		});
	});
	afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

	it('delivers each message to the front agent as the asker, sets typing, and acks', async () => {
		pending = [item('m1'), item('m2', 'ext-bbbbbbbbbbbb', 't-2')];
		expect(await svc.pollOnce('emb_portal1')).toBe(2);
		expect(sent.map((s) => s.session)).toEqual(['avery-1', 'avery-1']);
		expect(sent[0].text).toContain('[EXTERNAL MESSAGE] From: Ms Lin — teacher, SteamFun portal · conversation ext-aaaaaaaaaaaa');
		expect(acting).toEqual([
			['avery-1', 'ext:emb_portal1:t-1'],
			['avery-1', 'ext:emb_portal1:t-2'],
		]);
		expect(calls.filter((c) => c.path.endsWith('/typing')).map((c) => c.body)).toEqual([
			{ conversationId: 'ext-aaaaaaaaaaaa', on: true },
			{ conversationId: 'ext-bbbbbbbbbbbb', on: true },
		]);
		expect(calls.at(-1)).toEqual({ method: 'POST', path: '/embeds/emb_portal1/ack', body: { messageIds: ['m1', 'm2'] } });
		expect(store.getConversation('ext-bbbbbbbbbbbb')?.sub).toBe('t-2');
		expect(audit.map((a) => a.event)).toEqual(['delivered', 'delivered']);
		expect(JSON.stringify(audit)).not.toContain('question');
	});

	it('does not ack a message the agent did not get, nor the ones after it', async () => {
		deliverOk = false;
		pending = [item('m1'), item('m2')];
		expect(await svc.pollOnce('emb_portal1')).toBe(0);
		expect(sent).toHaveLength(1);
		expect(calls.some((c) => c.path.endsWith('/ack'))).toBe(false);
		expect(calls.filter((c) => c.path.endsWith('/typing')).map((c) => (c.body as { on: boolean }).on)).toEqual([true, false]);
		expect(audit[0].event).toBe('delivery_failed');
	});

	it('never delivers a message twice when an earlier ack was lost', async () => {
		pending = [item('m1')];
		await svc.pollOnce('emb_portal1');
		await svc.pollOnce('emb_portal1');
		expect(sent).toHaveLength(1);
		expect(calls.filter((c) => c.path.endsWith('/ack'))).toHaveLength(2);
	});

	it('drops (acks) a message with a malformed conversation id without delivering it', async () => {
		pending = [item('m1', 'not-a-conversation')];
		await svc.pollOnce('emb_portal1');
		expect(sent).toHaveLength(0);
		expect(calls.at(-1)?.body).toEqual({ messageIds: ['m1'] });
	});

	it('ends the loop when the embed is detached', async () => {
		svc.start();
		expect(svc.activeEmbeds()).toEqual(['emb_portal1']);
		store.removeEmbed('emb_portal1');
		await new Promise((r) => setImmediate(r));
		await new Promise((r) => setImmediate(r));
		svc.stop();
		await new Promise((r) => setImmediate(r));
		expect(svc.activeEmbeds()).toEqual([]);
	});
});
