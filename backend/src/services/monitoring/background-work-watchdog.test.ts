jest.mock('../core/logger.service.js', () => ({
	LoggerService: { getInstance: () => ({ createComponentLogger: () => ({ info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }) }) },
}));

import { BackgroundWorkWatchdog, stalledBackgroundNudge } from './background-work-watchdog.js';
import type { StalledBackground } from './agent-turn-state.js';

const NOW = Date.UTC(2026, 9, 12, 2, 10, 0);
const stalled: StalledBackground = { agentIds: ['a1'], lastProgressAt: Date.UTC(2026, 9, 12, 1, 58, 9), description: 'Build video v1' };

function make(results: Record<string, StalledBackground | null>) {
	const sent: Array<{ session: string; text: string }> = [];
	const dropped: string[] = [];
	const wd = new BackgroundWorkWatchdog({
		turnState: {
			knownSessions: () => Object.keys(results),
			stalledBackground: (s: string) => results[s] ?? null,
			dropBackground: (s: string) => { dropped.push(s); results[s] = null; },
		},
		sendToAgent: async (session, text) => { sent.push({ session, text }); return { success: true }; },
		now: () => NOW,
	});
	return { wd, sent, dropped };
}

describe('stalledBackgroundNudge', () => {
	it('names the task, the last progress time and what to do', () => {
		const text = stalledBackgroundNudge(stalled, NOW);
		expect(text).toContain('"Build video v1"');
		expect(text).toContain('since 01:58 UTC');
		expect(text).toContain('12 min');
		expect(text).toContain('foreground');
	});

	it('falls back to a generic name without a description', () => {
		expect(stalledBackgroundNudge({ ...stalled, description: undefined }, NOW)).toContain('a background task');
	});
});

describe('BackgroundWorkWatchdog', () => {
	it('tells an agent whose background work stalled, once, and stops counting the work', async () => {
		const { wd, sent, dropped } = make({ pia: stalled, ella: null });
		expect(await wd.tick()).toEqual(['pia']);
		expect(await wd.tick()).toEqual([]);
		expect(sent).toHaveLength(1);
		expect(sent[0].session).toBe('pia');
		expect(dropped).toEqual(['pia']);
	});

	it('does nothing when nothing stalled', async () => {
		const { wd, sent } = make({ pia: null });
		expect(await wd.tick()).toEqual([]);
		expect(sent).toEqual([]);
	});

	it('still stops counting the work when the nudge cannot be sent', async () => {
		const results: Record<string, StalledBackground | null> = { pia: stalled };
		const dropped: string[] = [];
		const wd = new BackgroundWorkWatchdog({
			turnState: { knownSessions: () => ['pia'], stalledBackground: (s: string) => results[s] ?? null, dropBackground: (s: string) => { dropped.push(s); } },
			sendToAgent: async () => { throw new Error('gone'); },
			now: () => NOW,
		});
		await expect(wd.tick()).resolves.toEqual([]);
		expect(dropped).toEqual(['pia']);
	});
});
