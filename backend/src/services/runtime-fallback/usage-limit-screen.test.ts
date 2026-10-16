/**
 * Tests for the usage-limit screen check and the menu answer.
 */

jest.mock('./effective-runtime.js', () => ({ reportRuntimeOutput: jest.fn() }));
jest.mock('../../utils/async.utils.js', () => ({ delay: jest.fn().mockResolvedValue(undefined) }));

import { reportRuntimeOutput } from './effective-runtime.js';
import { inspectUsageLimitScreen, type UsageLimitMenuIO } from './usage-limit-screen.js';
import { resetUsageLimitState, usageLimitOf } from './usage-limit-state.js';

const NOW = Date.UTC(2026, 9, 16, 12, 0);
const RESET = Date.UTC(2026, 9, 17, 0, 0);
const ORC = 'crewly-orc';

/** Build the incident menu screen with the given option highlighted. */
function menuScreen(selected: 1 | 2): string {
	return [
		"  ⎿  You've hit your weekly limit · resets Oct 16 at 8pm (America/New_York)",
		'',
		'   What do you want to do?',
		'',
		`   ${selected === 1 ? '❯' : ' '} 1. Stop and wait for limit to reset`,
		`   ${selected === 2 ? '❯' : ' '} 2. Wait here, then continue automatically at 8pm`,
		'',
		'   Enter to confirm · Esc to cancel',
	].join('\n');
}

/** Fake keys + capture; capture returns `screens` in order (the last repeats). */
function fakeIO(screens: string[]): UsageLimitMenuIO & { sendKey: jest.Mock; sendEnter: jest.Mock } {
	let i = 0;
	return {
		sendKey: jest.fn().mockResolvedValue(undefined),
		sendEnter: jest.fn().mockResolvedValue(undefined),
		capture: jest.fn(() => screens[Math.min(i++, screens.length - 1)]),
	};
}

describe('inspectUsageLimitScreen', () => {
	beforeEach(() => {
		resetUsageLimitState();
		jest.clearAllMocks();
	});

	it('records the weekly-limit menu state and reports it to the fallback once', async () => {
		const info = await inspectUsageLimitScreen(ORC, menuScreen(1), 'claude-code', { now: NOW });
		expect(info?.until).toBe(new Date(RESET).toISOString());
		expect(info?.source).toBe('menu');
		expect(usageLimitOf(ORC, NOW)).toBe(info);
		await inspectUsageLimitScreen(ORC, menuScreen(1), 'claude-code', { now: NOW });
		expect(reportRuntimeOutput).toHaveBeenCalledTimes(1);
	});

	it('moves from option 1 to option 2 and confirms only after option 2 shows highlighted', async () => {
		const io = fakeIO([menuScreen(2)]);
		await inspectUsageLimitScreen(ORC, menuScreen(1), 'claude-code', { now: NOW, io });
		expect(io.sendKey).toHaveBeenCalledWith(ORC, 'Down');
		expect(io.sendEnter).toHaveBeenCalledTimes(1);
		expect(usageLimitOf(ORC, NOW)?.menuAnsweredAt).toBeDefined();
	});

	it('does not press Enter when Down did not reach option 2', async () => {
		const io = fakeIO([menuScreen(1)]);
		await inspectUsageLimitScreen(ORC, menuScreen(1), 'claude-code', { now: NOW, io });
		expect(io.sendKey).toHaveBeenCalledTimes(1);
		expect(io.sendEnter).not.toHaveBeenCalled();
	});

	it('presses Enter directly when option 2 is already highlighted', async () => {
		const io = fakeIO([menuScreen(2)]);
		await inspectUsageLimitScreen(ORC, menuScreen(2), 'claude-code', { now: NOW, io });
		expect(io.sendKey).not.toHaveBeenCalled();
		expect(io.sendEnter).toHaveBeenCalledTimes(1);
	});

	it('answers the menu once per state', async () => {
		const io = fakeIO([menuScreen(2)]);
		await inspectUsageLimitScreen(ORC, menuScreen(2), 'claude-code', { now: NOW, io });
		await inspectUsageLimitScreen(ORC, menuScreen(2), 'claude-code', { now: NOW + 30_000, io });
		expect(io.sendEnter).toHaveBeenCalledTimes(1);
	});

	it('returns null for a normal screen and an unknown runtime', async () => {
		expect(await inspectUsageLimitScreen(ORC, '> ready\n', 'claude-code', { now: NOW })).toBeNull();
		expect(await inspectUsageLimitScreen(ORC, menuScreen(1), null, { now: NOW })).toBeNull();
		expect(reportRuntimeOutput).not.toHaveBeenCalled();
	});

	it('never throws when keys fail', async () => {
		const io = fakeIO([menuScreen(2)]);
		io.sendEnter.mockRejectedValue(new Error('pty gone'));
		const logger = { info: jest.fn(), warn: jest.fn() };
		const info = await inspectUsageLimitScreen(ORC, menuScreen(2), 'claude-code', { now: NOW, io, logger });
		expect(info).not.toBeNull();
		expect(logger.warn).toHaveBeenCalledWith('Usage-limit screen check failed (ignored)', expect.any(Object));
	});
});
