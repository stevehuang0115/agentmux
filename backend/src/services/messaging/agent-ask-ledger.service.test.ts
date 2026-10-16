/**
 * Tests for AgentAskLedger: the return path of agent-to-agent messages.
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

jest.mock('../core/logger.service.js', () => ({
	LoggerService: {
		getInstance: () => ({
			createComponentLogger: () => ({ info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }),
		}),
	},
}));

import {
	AGENT_ASK_CONSTANTS as C,
	AgentAskLedger,
	agentAskReturnEnabled,
	lastWordsFromTranscript,
	memberName,
	renderReturnedAnswer,
} from './agent-ask-ledger.service.js';

let clock: number;
let delivered: Array<{ to: string; text: string }>;
let lastWords: string | null;
let reads: Array<{ session: string; since: number }>;

/**
 * Ledger with a fake clock, fake transcript and captured deliveries.
 *
 * @param file - Optional store file
 * @returns Ledger
 */
function makeLedger(file?: string): AgentAskLedger {
	return new AgentAskLedger({
		file,
		now: () => clock,
		readLastWords: async (session, since) => {
			reads.push({ session, since });
			return lastWords;
		},
		deliver: async (to, text) => {
			delivered.push({ to, text });
		},
	});
}

beforeEach(() => {
	clock = 1_000_000_000_000;
	delivered = [];
	lastWords = 'Both parts are done: out/v1.mp4';
	reads = [];
});

describe('memberName', () => {
	it('takes the member part of a session id', () => {
		expect(memberName('flopost-dex-7f17ecbc')).toBe('Dex');
		expect(memberName('crewly-orc')).toBe('Crewly-orc');
	});
});

describe('renderReturnedAnswer', () => {
	it('quotes the ask and the last words', () => {
		const t = renderReturnedAnswer({ target: 'Dex', excerpt: 'make the video', minutes: 24, lastWords: 'done' });
		expect(t).toContain('[ANSWER FROM DEX]');
		expect(t).toContain('about 24 min');
		expect(t).toContain('"make the video"');
		expect(t).toContain('--- Dex ---\ndone\n---');
	});

	it('says to ask when nothing could be read', () => {
		expect(renderReturnedAnswer({ target: 'Dex', excerpt: 'x', minutes: 3, lastWords: null })).toContain('Ask Dex for the result.');
	});
});

describe('onTurnEnded', () => {
	it('a long turn with no word back returns the last words to the sender', async () => {
		const l = makeLedger();
		l.noteDelivered('flopost-dex-7f17ecbc', 'flopost-pia-1a2b3c4d', 'Please replicate the   video');
		const deliveredAt = clock;
		clock += 24 * 60_000;
		expect(await l.onTurnEnded('flopost-dex-7f17ecbc')).toBe(1);
		expect(delivered).toHaveLength(1);
		expect(delivered[0].to).toBe('flopost-pia-1a2b3c4d');
		expect(delivered[0].text).toContain('[ANSWER FROM DEX]');
		expect(delivered[0].text).toContain('"Please replicate the video"');
		expect(delivered[0].text).toContain('Both parts are done');
		expect(reads).toEqual([{ session: 'flopost-dex-7f17ecbc', since: deliveredAt }]);
		expect(l.openAsksBy('flopost-pia-1a2b3c4d')).toHaveLength(0);
	});

	it('one message per sender, even with several asks', async () => {
		const l = makeLedger();
		l.noteDelivered('dex', 'pia', 'task');
		clock += 1000;
		l.noteDelivered('dex', 'pia', 'correction');
		clock += C.MIN_WORK_MS;
		expect(await l.onTurnEnded('dex')).toBe(1);
		expect(delivered[0].text).toContain('"task"');
		expect(l.openAsksBy('pia')).toHaveLength(0);
	});

	it('a post in chat after the delivery drops the ask quietly', async () => {
		const l = makeLedger();
		l.noteDelivered('dex', 'pia', 'task');
		clock += 60_000;
		l.notePost('dex');
		clock += C.MIN_WORK_MS;
		expect(await l.onTurnEnded('dex')).toBe(0);
		expect(delivered).toHaveLength(0);
		expect(l.openAsksBy('pia')).toHaveLength(0);
	});

	it('a post before the delivery does not count', async () => {
		const l = makeLedger();
		l.notePost('dex');
		clock += 1000;
		l.noteDelivered('dex', 'pia', 'task');
		clock += C.MIN_WORK_MS;
		expect(await l.onTurnEnded('dex')).toBe(1);
	});

	it('a short turn (read and let go) drops the ask quietly', async () => {
		const l = makeLedger();
		l.noteDelivered('dex', 'pia', 'fyi');
		clock += C.MIN_READ_MS + 1000;
		expect(await l.onTurnEnded('dex')).toBe(0);
		expect(delivered).toHaveLength(0);
		expect(l.openAsksBy('pia')).toHaveLength(0);
	});

	it('a turn ending right after the delivery is the previous turn: the ask stays', async () => {
		const l = makeLedger();
		l.noteDelivered('dex', 'pia', 'task');
		clock += C.MIN_READ_MS - 1000;
		expect(await l.onTurnEnded('dex')).toBe(0);
		expect(l.openAsksBy('pia')).toHaveLength(1);
		clock += C.MIN_WORK_MS;
		expect(await l.onTurnEnded('dex')).toBe(1);
	});

	it('another agent ending its turn does not touch the ask', async () => {
		const l = makeLedger();
		l.noteDelivered('dex', 'pia', 'task');
		clock += C.MIN_WORK_MS;
		expect(await l.onTurnEnded('ella')).toBe(0);
		expect(l.openAsksBy('pia')).toHaveLength(1);
	});

	it('clips long last words to the end', async () => {
		lastWords = 'a'.repeat(C.RESULT_CHARS) + 'THE END';
		const l = makeLedger();
		l.noteDelivered('dex', 'pia', 'task');
		clock += C.MIN_WORK_MS;
		await l.onTurnEnded('dex');
		expect(delivered[0].text).toContain('THE END');
		expect(delivered[0].text).toContain('…');
		expect(delivered[0].text).not.toContain('a'.repeat(C.RESULT_CHARS));
	});

	it('no transcript: still tells the sender, and never throws on a failed delivery', async () => {
		lastWords = null;
		const l = new AgentAskLedger({
			now: () => clock,
			readLastWords: async () => {
				throw new Error('gone');
			},
			deliver: async () => {
				throw new Error('offline');
			},
		});
		l.noteDelivered('dex', 'pia', 'task');
		clock += C.MIN_WORK_MS;
		await expect(l.onTurnEnded('dex')).resolves.toBe(0);
		expect(l.openAsksBy('pia')).toHaveLength(0);
	});
});

describe('noteDelivered / noteAnswered / prune', () => {
	it('ignores self-messages and blanks', () => {
		const l = makeLedger();
		l.noteDelivered('dex', 'dex', 'x');
		l.noteDelivered('', 'pia', 'x');
		expect(l.openAsksBy('dex')).toHaveLength(0);
		expect(l.openAsksBy('pia')).toHaveLength(0);
	});

	it('the receiver writing back to the sender answers the ask', () => {
		const l = makeLedger();
		l.noteDelivered('dex', 'pia', 'task');
		l.noteDelivered('dex', 'ella', 'other');
		l.noteAnswered('dex', 'pia');
		expect(l.openAsksBy('pia')).toHaveLength(0);
		expect(l.openAsksBy('ella')).toHaveLength(1);
	});

	it('openAsks lists every open ask as copies', () => {
		const l = makeLedger();
		l.noteDelivered('dex', 'pia', 'task');
		l.noteDelivered('ella', 'sam', 'other');
		const all = l.openAsks();
		expect(all.map((a) => `${a.sender}>${a.target}`)).toEqual(['pia>dex', 'sam>ella']);
		all[0].excerpt = 'changed';
		expect(l.openAsks()[0].excerpt).toBe('task');
	});

	it('forgets asks after the TTL', () => {
		const l = makeLedger();
		l.noteDelivered('dex', 'pia', 'task');
		clock += C.TTL_MS + 1;
		expect(l.openAsksBy('pia')).toHaveLength(0);
	});

	it('caps the number of asks kept', () => {
		const l = makeLedger();
		for (let i = 0; i < C.MAX_ASKS + 5; i++) l.noteDelivered('dex', 'pia', `m${i}`);
		expect(l.openAsksBy('pia')).toHaveLength(C.MAX_ASKS);
		expect(l.openAsksBy('pia')[0].excerpt).toBe('m5');
	});

	it('caps the excerpt', () => {
		const l = makeLedger();
		l.noteDelivered('dex', 'pia', 'x'.repeat(1000));
		expect(l.openAsksBy('pia')[0].excerpt).toHaveLength(C.EXCERPT_CHARS);
	});
});

describe('persistence', () => {
	let dir: string;
	beforeEach(async () => {
		dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ask-ledger-'));
	});
	afterEach(async () => {
		await fs.rm(dir, { recursive: true, force: true });
	});

	it('asks and posts survive a restart', async () => {
		const file = path.join(dir, 'sub', C.FILE_NAME);
		const a = makeLedger(file);
		a.noteDelivered('dex', 'pia', 'task');
		a.noteDelivered('ella', 'pia', 'other');
		clock += 1000;
		a.notePost('ella');
		await a.flush();
		const b = makeLedger(file);
		expect(b.openAsksBy('pia')).toHaveLength(2);
		clock += C.MIN_WORK_MS;
		expect(await b.onTurnEnded('ella')).toBe(0);
		expect(await b.onTurnEnded('dex')).toBe(1);
	});

	it('an unreadable store starts empty', async () => {
		const file = path.join(dir, C.FILE_NAME);
		await fs.writeFile(file, 'not json');
		expect(makeLedger(file).openAsksBy('pia')).toHaveLength(0);
	});
});

describe('lastWordsFromTranscript', () => {
	const since = Date.parse('2026-10-14T14:28:00Z');
	const claude = (o: Record<string, unknown>) => JSON.stringify({ type: 'assistant', timestamp: '2026-10-14T14:50:00Z', ...o });
	const text = (t: string) => ({ message: { content: [{ type: 'text', text: t }] } });

	it('Claude: newest assistant text since the time; skips sidechains, meta, errors and old entries', () => {
		const lines = [
			claude({ timestamp: '2026-10-14T14:00:00Z', ...text('too old') }),
			claude(text('first')),
			claude({ ...text('subagent words'), isSidechain: true }),
			claude({ ...text('meta'), isMeta: true }),
			claude({ ...text('API Error'), isApiErrorMessage: true }),
			claude({ message: { content: [{ type: 'tool_use', name: 'Bash' }, { type: 'text', text: 'Both parts done' }, { type: 'text', text: 'committed 1f91137a' }] } }),
			'garbage line that is long enough',
		].join('\n');
		expect(lastWordsFromTranscript(lines, 'claude', since)).toBe('Both parts done\ncommitted 1f91137a');
	});

	it('Claude: null when nothing since the time', () => {
		expect(lastWordsFromTranscript(claude({ timestamp: '2026-10-14T14:00:00Z', ...text('old') }), 'claude', since)).toBeNull();
	});

	it('Codex: agent_message events and assistant output_text items', () => {
		const at = '2026-10-14T14:50:00Z';
		const lines = [
			JSON.stringify({ timestamp: at, type: 'event_msg', payload: { type: 'agent_message', message: 'working on it' } }),
			JSON.stringify({ timestamp: at, type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'final answer' }] } }),
			JSON.stringify({ timestamp: at, type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'output_text', text: 'not mine' }] } }),
		].join('\n');
		expect(lastWordsFromTranscript(lines, 'codex', since)).toBe('final answer');
	});
});

describe('agentAskReturnEnabled', () => {
	it('is on unless switched off', () => {
		expect(agentAskReturnEnabled({})).toBe(true);
		expect(agentAskReturnEnabled({ [C.ENV_SWITCH]: 'OFF' })).toBe(false);
	});
});
