/**
 * Tests for the agent ask ledger boot wiring.
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

import { createAgentAskLedger, readLastWords, readTail } from './agent-ask-ledger.wiring.js';
import { AGENT_ASK_CONSTANTS, getAgentAskLedger, setAgentAskLedger } from './agent-ask-ledger.service.js';

let dir: string;

beforeEach(async () => {
	dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ask-wiring-'));
});

afterEach(async () => {
	setAgentAskLedger(null);
	delete process.env[AGENT_ASK_CONSTANTS.ENV_SWITCH];
	await fs.rm(dir, { recursive: true, force: true });
});

describe('readTail', () => {
	it('returns the whole file when it is small', async () => {
		const f = path.join(dir, 'a.jsonl');
		await fs.writeFile(f, 'one\ntwo\n');
		expect(await readTail(f)).toBe('one\ntwo\n');
	});

	it('drops the partial first line of a tail', async () => {
		const f = path.join(dir, 'a.jsonl');
		await fs.writeFile(f, 'aaaaaaaaaa\nbbbb\ncccc\n');
		expect(await readTail(f, 12)).toBe('bbbb\ncccc\n');
	});
});

describe('readLastWords', () => {
	it('reads the located transcript and masks secrets', async () => {
		const f = path.join(dir, 's.jsonl');
		process.env.TEST_ASK_API_KEY = 'sk-supersecretvalue123456';
		await fs.writeFile(
			f,
			JSON.stringify({ type: 'assistant', timestamp: '2026-10-14T14:50:00Z', message: { content: [{ type: 'text', text: 'done, key sk-supersecretvalue123456' }] } }) + '\n',
		);
		const words = await readLastWords(async () => ({ kind: 'claude', file: f }), 'dex', 0);
		delete process.env.TEST_ASK_API_KEY;
		expect(words).toContain('done');
		expect(words).not.toContain('sk-supersecretvalue123456');
	});

	it('null when there is no transcript', async () => {
		expect(await readLastWords(async () => null, 'dex', 0)).toBeNull();
	});
});

describe('createAgentAskLedger', () => {
	it('creates and exposes the ledger with its store under CREWLY_HOME', async () => {
		const sent: string[] = [];
		const ledger = createAgentAskLedger({ crewlyHome: dir, sendToAgent: async (s) => sent.push(s), locate: async () => null });
		expect(ledger).not.toBeNull();
		expect(getAgentAskLedger()).toBe(ledger);
		ledger!.noteDelivered('dex', 'pia', 'task');
		await ledger!.flush();
		const stored = JSON.parse(await fs.readFile(path.join(dir, AGENT_ASK_CONSTANTS.FILE_NAME), 'utf-8'));
		expect(stored.asks).toHaveLength(1);
	});

	it('returns null and clears the singleton when switched off', () => {
		createAgentAskLedger({ crewlyHome: dir, sendToAgent: async () => undefined, locate: async () => null });
		process.env[AGENT_ASK_CONSTANTS.ENV_SWITCH] = 'off';
		expect(createAgentAskLedger({ crewlyHome: dir, sendToAgent: async () => undefined, locate: async () => null })).toBeNull();
		expect(getAgentAskLedger()).toBeNull();
	});
});
