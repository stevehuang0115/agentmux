import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
	findArtifactLinks,
	readOpenWorkSync,
	redactHandoverText,
	stripHandoverPointers,
	suggestedSkillsFor,
	withHandoverPointers,
} from './handover-pointers.js';
import { buildHandoverSummary, chainedHandoverBlock } from './runtime-session-recovery.js';

describe('handover pointers', () => {
	let home: string;
	beforeEach(() => {
		home = fs.mkdtempSync(path.join(os.tmpdir(), 'hp-'));
	});
	afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

	function writePool(workItems: unknown[], claims: unknown[] = []): void {
		fs.mkdirSync(path.join(home, 'task-pool'), { recursive: true });
		fs.writeFileSync(path.join(home, 'task-pool', 'pool.json'), JSON.stringify({ workItems, claims, lastUpdatedAt: '' }));
	}

	describe('redaction', () => {
		const KEY = 'sk-' + 'abcdefghijklmnopqrstuvwxyz0123456789';
		it('masks an API key, a bearer token and a PASSWORD= line', () => {
			const out = redactHandoverText(`key ${KEY}\nAuthorization: Bearer abcdef1234567890abcdef1234567890\nPASSWORD=hunter2hunter2\nplain text`);
			expect(out).not.toContain(KEY);
			expect(out).not.toContain('abcdef1234567890abcdef1234567890');
			expect(out).not.toContain('hunter2');
			expect(out).toContain('REDACTED');
			expect(out).toContain('plain text');
		});

		it('is idempotent', () => {
			const once = redactHandoverText(`PASSWORD=hunter2hunter2 ${KEY}`);
			expect(redactHandoverText(once)).toBe(once);
		});

		it('redacts a secret in a transcript before it reaches the handover summary', () => {
			const file = path.join(home, 't.jsonl');
			fs.writeFileSync(
				file,
				`${JSON.stringify({ type: 'user', timestamp: 't', message: { role: 'user', content: `use ${KEY} and PASSWORD=hunter2hunter2` } })}\n`,
			);
			const summary = buildHandoverSummary(file);
			expect(summary).toContain('Delivered to you');
			expect(summary).not.toContain(KEY);
			expect(summary).not.toContain('hunter2');
		});
	});

	describe('open work', () => {
		it('lists the agent\'s targeted or claimed in-flight WorkItems with ids and titles', () => {
			writePool(
				[
					{ id: 'w1', title: 'Mine running', status: 'running', target: 'ann' },
					{ id: 'w2', title: 'Mine done', status: 'done', target: 'ann' },
					{ id: 'w3', title: 'Bob queued', status: 'queued', target: 'bob' },
					{ id: 'w4', title: 'Claimed by me', status: 'running' },
				],
				[{ agentId: 'ann', workItemId: 'w4', status: 'active' }],
			);
			expect(readOpenWorkSync('ann', home).map((w) => w.id)).toEqual(['w1', 'w4']);
		});

		it('returns [] when the pool file is missing', () => {
			expect(readOpenWorkSync('ann', home)).toEqual([]);
		});
	});

	describe('withHandoverPointers', () => {
		it('starts with open work (ids + titles), links and suggested skills', () => {
			writePool([{ id: 'w1', title: 'Fix login', status: 'running', target: 'ann' }]);
			const out = withHandoverPointers('### You — t\nSee https://github.com/o/r/pull/12 and TKT-7', { sessionName: 'ann', crewlyHome: home });
			expect(out.startsWith('<!-- handover-pointers -->')).toBe(true);
			expect(out).toContain('- w1 — Fix login (running)');
			expect(out).toContain('https://github.com/o/r/pull/12');
			expect(out).toContain('TKT-7');
			expect(out).toContain('Call the Skill tool for: recall, get-my-active-work, report-status.');
		});

		it('says explicitly when nothing is open', () => {
			const out = withHandoverPointers('body', { sessionName: 'ann', crewlyHome: home });
			expect(out).toContain('None open for you');
		});

		it('does not add a second header to a body that has one', () => {
			const once = withHandoverPointers('body', { sessionName: 'ann', crewlyHome: home });
			expect(withHandoverPointers(once, { sessionName: 'ann', crewlyHome: home })).toBe(once);
		});

		it('chained handovers carry the earlier body without its header', () => {
			const file = path.join(home, 'prev.md');
			fs.writeFileSync(file, `# Handover: restart\n\nintro\n\n${withHandoverPointers('earlier words', { sessionName: 'ann', crewlyHome: home })}\n`);
			const block = chainedHandoverBlock({ path: file, mtimeMs: 0 });
			expect(block).toContain('earlier words');
			expect(block).not.toContain('Suggested skills');
			expect(stripHandoverPointers('a\n<!-- handover-pointers -->x<!-- /handover-pointers -->\nb')).toBe('a\n\nb');
		});

		it('redacts secrets in the whole result', () => {
			const out = withHandoverPointers('PASSWORD=hunter2hunter2', { sessionName: 'ann', crewlyHome: home });
			expect(out).not.toContain('hunter2');
		});
	});

	it('finds artifact links and picks skills by role', () => {
		expect(findArtifactLinks('https://github.com/o/r/issues/3 https://github.com/o/r/issues/3 TKT-9')).toEqual(['https://github.com/o/r/issues/3', 'TKT-9']);
		expect(suggestedSkillsFor('team-leader')).toContain('delegate-task');
		expect(suggestedSkillsFor('orchestrator')).toContain('reply-chat');
	});
});
