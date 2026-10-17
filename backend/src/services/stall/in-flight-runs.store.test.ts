/**
 * Tests for the stall watcher's state file.
 *
 * @module services/stall/in-flight-runs.store.test
 */

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { InFlightRunsStore, emptyState, pruneState, type StallWatcherState } from './in-flight-runs.store.js';
import { STALL_WATCHER_CONSTANTS as C } from '../../constants.js';

const NOW = Date.parse('2026-10-17T12:00:00Z');

describe('InFlightRunsStore', () => {
	let dir: string;
	beforeEach(async () => {
		dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stall-store-'));
	});
	afterEach(async () => {
		await fs.rm(dir, { recursive: true, force: true });
	});

	it('a missing file is an empty state', async () => {
		const store = new InFlightRunsStore(path.join(dir, 'nested', 'in-flight-runs.json'));
		expect(await store.load()).toEqual(emptyState());
	});

	it('a broken file is an empty state', async () => {
		const file = path.join(dir, 'in-flight-runs.json');
		await fs.writeFile(file, '{not json', 'utf8');
		expect(await new InFlightRunsStore(file).load()).toEqual(emptyState());
		await fs.writeFile(file, JSON.stringify({ version: 1 }), 'utf8');
		expect(await new InFlightRunsStore(file).load()).toEqual(emptyState());
	});

	it('round-trips a state and creates the folder', async () => {
		const file = path.join(dir, 'deeper', 'in-flight-runs.json');
		const store = new InFlightRunsStore(file);
		const state: StallWatcherState = {
			...emptyState(),
			armedAt: NOW,
			runs: [{ id: 'm1', agent: 'rex', channelId: 'c', threadId: 'm1', head: 'started', startedAt: NOW, estimateMs: 3600_000, estimateSource: 'text', expectedBy: NOW + 3600_000 }],
			ladders: { 'run:m1': { agentAt: NOW, seenAt: NOW } },
			lastNudgeByAgent: { rex: NOW },
			claims: [{ id: 'm2', speaker: 'ella', member: 'pia', memberName: 'Pia', saidAt: NOW, head: 'Pia 在做' }],
		};
		await store.save(state);
		expect(await store.load()).toEqual(state);
		expect(store.path).toBe(file);
		expect(await fs.readdir(path.dirname(file))).toEqual(['in-flight-runs.json']);
	});
});

describe('pruneState', () => {
	it('drops old runs, stale ladders, cooled nudges and claim checks that never ran', () => {
		const state: StallWatcherState = {
			...emptyState(),
			runs: [
				{ id: 'old', agent: 'rex', channelId: 'c', threadId: 'old', head: 'x', startedAt: NOW - C.RUN_MAX_AGE_MS, estimateMs: 1, estimateSource: 'default', expectedBy: NOW },
				{ id: 'new', agent: 'rex', channelId: 'c', threadId: 'new', head: 'x', startedAt: NOW - 1000, estimateMs: 1, estimateSource: 'default', expectedBy: NOW },
			],
			ladders: { stale: { seenAt: NOW - C.LADDER_TTL_MS }, fresh: { seenAt: NOW - 1000 } },
			lastNudgeByAgent: { rex: NOW - C.NUDGE_COOLDOWN_MS, pia: NOW - 1000 },
			claims: [
				{ id: 'late', speaker: 'ella', member: 'pia', memberName: 'Pia', saidAt: NOW - 3 * C.CLAIM_CHECK_WINDOW_MS - C.INTERVAL_MS, head: 'x' },
				{ id: 'due', speaker: 'ella', member: 'pia', memberName: 'Pia', saidAt: NOW - C.CLAIM_CHECK_WINDOW_MS, head: 'x' },
			],
		};
		pruneState(state, NOW);
		expect(state.runs.map((r) => r.id)).toEqual(['new']);
		expect(Object.keys(state.ladders)).toEqual(['fresh']);
		expect(Object.keys(state.lastNudgeByAgent)).toEqual(['pia']);
		expect(state.claims.map((c) => c.id)).toEqual(['due']);
	});

	it('caps the run and claim lists, keeping the newest', () => {
		const state = emptyState();
		for (let i = 0; i < C.MAX_RUNS + 5; i++) {
			state.runs.push({ id: `r${i}`, agent: 'a', channelId: 'c', threadId: `r${i}`, head: 'x', startedAt: NOW - 1000 + i, estimateMs: 1, estimateSource: 'default', expectedBy: NOW });
		}
		pruneState(state, NOW);
		expect(state.runs).toHaveLength(C.MAX_RUNS);
		expect(state.runs[0]?.id).toBe('r5');
	});
});
