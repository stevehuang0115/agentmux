import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ExternalStore, externalPersonId } from './external-store.js';

describe('ExternalStore', () => {
	let dir: string;
	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-store-'));
	});
	afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

	const conv = (id: string, sub: string, name: string) => ({ conversationId: id, embedId: 'emb_portal1', sub, askerName: name, roles: ['teacher'], profileId: 'staff' });

	it('builds the asker person id', () => {
		expect(externalPersonId('emb_portal1', 't-1')).toBe('ext:emb_portal1:t-1');
	});

	it('adds, replaces and removes embeds, and keeps them across restarts', () => {
		const s = new ExternalStore({ dir });
		s.setEmbed({ embedId: 'emb_portal1', frontAgent: 'avery-1' });
		s.setEmbed({ embedId: 'emb_portal1', frontAgent: 'avery-2' });
		expect(new ExternalStore({ dir }).listEmbeds()).toEqual([{ embedId: 'emb_portal1', frontAgent: 'avery-2' }]);
		expect(s.removeEmbed('emb_portal1')).toBe(true);
		expect(s.removeEmbed('emb_portal1')).toBe(false);
		expect(new ExternalStore({ dir }).getEmbed('emb_portal1')).toBeNull();
	});

	it('rejects bad embed ids and agent names', () => {
		const s = new ExternalStore({ dir });
		expect(() => s.setEmbed({ embedId: 'nope', frontAgent: 'a' })).toThrow();
		expect(() => s.setEmbed({ embedId: 'emb_portal1', frontAgent: 'a b; rm' })).toThrow();
	});

	it('records conversations, keeps the first time, and lists the other askers', () => {
		let t = 1000;
		const s = new ExternalStore({ dir, now: () => t });
		s.noteConversation(conv('ext-aaaaaaaaaaaa', 't-1', 'Zhang'));
		t = 2000;
		const again = s.noteConversation(conv('ext-aaaaaaaaaaaa', 't-1', 'Zhang'));
		expect(again.firstAt).toBe(new Date(1000).toISOString());
		expect(again.lastAt).toBe(new Date(2000).toISOString());
		s.noteConversation({ ...conv('ext-bbbbbbbbbbbb', 't-2', 'Wang'), askerEmail: 'w@x.cn' });
		const fresh = new ExternalStore({ dir });
		expect(fresh.getConversation('ext-aaaaaaaaaaaa')?.askerName).toBe('Zhang');
		expect(fresh.otherAskerMarks('emb_portal1', 'ext-aaaaaaaaaaaa').sort()).toEqual(['Wang', 't-2', 'w@x.cn']);
		expect(fresh.getConversation('ext-cccccccccccc')).toBeNull();
	});

	it('ignores malformed files', () => {
		fs.writeFileSync(path.join(dir, 'embeds.json'), '{"x":1}');
		fs.writeFileSync(path.join(dir, 'external-conversations.json'), '{"bad-id":{"embedId":"e","sub":"s"}}');
		const s = new ExternalStore({ dir });
		expect(s.listEmbeds()).toEqual([]);
		expect(s.getConversation('bad-id')).toBeNull();
	});
});
