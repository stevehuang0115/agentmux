import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { auditExternal } from './external-audit.js';

describe('auditExternal', () => {
	it('appends one JSON line per event, without message text', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-audit-'));
		auditExternal({ event: 'delivered', embedId: 'emb_a12345', conversationId: 'ext-aaaaaaaaaaaa', chars: 12 }, dir, () => 0);
		auditExternal({ event: 'reply_blocked', embedId: 'emb_a12345', conversationId: 'ext-aaaaaaaaaaaa', reasons: ['secret'] }, dir, () => 0);
		const lines = fs.readFileSync(path.join(dir, 'external-audit.jsonl'), 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
		expect(lines).toEqual([
			{ at: '1970-01-01T00:00:00.000Z', event: 'delivered', embedId: 'emb_a12345', conversationId: 'ext-aaaaaaaaaaaa', chars: 12 },
			{ at: '1970-01-01T00:00:00.000Z', event: 'reply_blocked', embedId: 'emb_a12345', conversationId: 'ext-aaaaaaaaaaaa', reasons: ['secret'] },
		]);
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it('never throws when the directory cannot be written', () => {
		expect(() => auditExternal({ event: 'delivered', embedId: 'e', conversationId: 'c' }, '/dev/null/nope')).not.toThrow();
	});
});
