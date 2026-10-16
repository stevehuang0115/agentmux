/**
 * Tests for the per-session usage-limit state.
 */

import { USAGE_LIMIT_STATE_CONSTANTS } from '../../constants.js';
import {
	clearUsageLimit,
	liftUsageLimit,
	listUsageLimited,
	markUsageLimited,
	noteUsageLimitMenuAnswered,
	resetUsageLimitState,
	usageLimitedView,
	usageLimitOf,
	usageLimitReason,
	usageLimitRemainingMs,
} from './usage-limit-state.js';

const NOW = Date.UTC(2026, 9, 16, 12, 0);
const RESET = Date.UTC(2026, 9, 17, 0, 0);
const ORC = 'crewly-orc';

describe('usage-limit state', () => {
	beforeEach(() => resetUsageLimitState());

	it('records a state with the reset time plus grace as the retry time', () => {
		const { info, isNew } = markUsageLimited({ sessionName: ORC, runtime: 'claude-code', ruleId: 'r', resetAt: RESET, source: 'menu' }, NOW);
		expect(isNew).toBe(true);
		expect(info.until).toBe(new Date(RESET).toISOString());
		expect(info.retryAt).toBe(new Date(RESET + USAGE_LIMIT_STATE_CONSTANTS.RESET_GRACE_MS).toISOString());
		expect(usageLimitOf(ORC, NOW)).toBe(info);
		expect(usageLimitRemainingMs(info, NOW)).toBe(RESET + USAGE_LIMIT_STATE_CONSTANTS.RESET_GRACE_MS - NOW);
	});

	it('backs off when no reset time is known', () => {
		const { info } = markUsageLimited({ sessionName: ORC, runtime: null, ruleId: 'r', resetAt: null, source: 'output' }, NOW);
		expect(info.until).toBeUndefined();
		expect(Date.parse(info.retryAt)).toBe(NOW + USAGE_LIMIT_STATE_CONSTANTS.NO_RESET_BACKOFF_MS);
	});

	it('distrusts a reset in the past or too far ahead', () => {
		const past = markUsageLimited({ sessionName: 'a', runtime: null, ruleId: 'r', resetAt: NOW - 1000, source: 'screen' }, NOW).info;
		const far = markUsageLimited({ sessionName: 'b', runtime: null, ruleId: 'r', resetAt: NOW + USAGE_LIMIT_STATE_CONSTANTS.MAX_RESET_AHEAD_MS + 1, source: 'screen' }, NOW).info;
		expect(past.until).toBeUndefined();
		expect(far.until).toBeUndefined();
	});

	it('keeps the first detection and upgrades a backoff to a later-seen reset time', () => {
		markUsageLimited({ sessionName: ORC, runtime: null, ruleId: 'r', resetAt: null, source: 'output' }, NOW);
		const { info, isNew } = markUsageLimited({ sessionName: ORC, runtime: 'claude-code', ruleId: 'r', resetAt: RESET, source: 'menu' }, NOW + 60_000);
		expect(isNew).toBe(false);
		expect(info.detectedAt).toBe(new Date(NOW).toISOString());
		expect(info.until).toBe(new Date(RESET).toISOString());
		expect(info.runtime).toBe('claude-code');
		expect(info.source).toBe('menu');
	});

	it('lifts on its own at the retry time', () => {
		const { info } = markUsageLimited({ sessionName: ORC, runtime: null, ruleId: 'r', resetAt: RESET, source: 'screen' }, NOW);
		expect(usageLimitOf(ORC, Date.parse(info.retryAt) - 1)).not.toBeNull();
		expect(usageLimitOf(ORC, Date.parse(info.retryAt))).toBeNull();
		expect(listUsageLimited(Date.parse(info.retryAt))).toEqual([]);
	});

	it('clears, lists, notes the menu answer and builds the API view', () => {
		markUsageLimited({ sessionName: ORC, runtime: 'claude-code', ruleId: 'r', resetAt: RESET, source: 'menu' }, NOW);
		noteUsageLimitMenuAnswered(ORC, NOW);
		expect(usageLimitOf(ORC, NOW)?.menuAnsweredAt).toBe(new Date(NOW).toISOString());
		expect(listUsageLimited(NOW)).toHaveLength(1);
		expect(usageLimitedView(ORC, NOW)).toEqual({
			until: new Date(RESET).toISOString(),
			retryAt: new Date(RESET + USAGE_LIMIT_STATE_CONSTANTS.RESET_GRACE_MS).toISOString(),
			detectedAt: new Date(NOW).toISOString(),
			runtime: 'claude-code',
		});
		expect(clearUsageLimit(ORC)).toBe(true);
		expect(usageLimitedView(ORC, NOW)).toBeUndefined();
		expect(clearUsageLimit(ORC)).toBe(false);
	});

	it('writes an owner-facing reason', () => {
		const limited = markUsageLimited({ sessionName: ORC, runtime: 'claude-code', ruleId: 'r', resetAt: RESET, source: 'menu' }, NOW).info;
		expect(usageLimitReason('Orchestrator', limited)).toMatch(/^Orchestrator is out of .*usage until 2026-10-17T00:00:00.000Z$/);
		const unknown = markUsageLimited({ sessionName: 'x', runtime: null, ruleId: 'r', resetAt: null, source: 'output' }, NOW).info;
		expect(usageLimitReason('Ella', unknown)).toContain('Ella is out of usage (reset time unknown; trying again at');
	});

	describe('liftUsageLimit (the agent works again)', () => {
		const G = USAGE_LIMIT_STATE_CONSTANTS.LIFT_GRACE_MS;

		it('lifts the state once the limit has not been seen for the grace period', () => {
			markUsageLimited({ sessionName: ORC, runtime: 'claude-code', ruleId: 'r', resetAt: RESET, source: 'screen' }, NOW);
			expect(liftUsageLimit(ORC, NOW + G - 1)).toBeNull();
			expect(usageLimitOf(ORC, NOW + G - 1)).not.toBeNull();
			expect(liftUsageLimit(ORC, NOW + G)?.until).toBe(new Date(RESET).toISOString());
			expect(usageLimitOf(ORC, NOW + G)).toBeNull();
		});

		it('counts the grace from the latest sighting and from the menu answer', () => {
			markUsageLimited({ sessionName: ORC, runtime: 'claude-code', ruleId: 'r', resetAt: RESET, source: 'menu' }, NOW);
			markUsageLimited({ sessionName: ORC, runtime: 'claude-code', ruleId: 'r', resetAt: RESET, source: 'menu' }, NOW + 30_000);
			expect(liftUsageLimit(ORC, NOW + 30_000 + G - 1)).toBeNull();
			noteUsageLimitMenuAnswered(ORC, NOW + 60_000);
			expect(liftUsageLimit(ORC, NOW + 60_000 + G - 1)).toBeNull();
			expect(liftUsageLimit(ORC, NOW + 60_000 + G)).not.toBeNull();
		});

		it('is a no-op for a session that is not limited', () => {
			expect(liftUsageLimit(ORC, NOW)).toBeNull();
		});
	});
});
