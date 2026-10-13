import { handOffRecurringChange, isApprovedChange, recurringSchedules, scheduleOfDecision, termsOf, type RecurringSchedule } from './recurring-change-handoff.js';
import fixtures from './recurring-change-handoff.fixtures.json';
import labels from './recurring-change-handoff.labels.json';
import type { OwnerDecision } from '../../types/decision.types.js';
import type { Trigger } from '../../types/v2/trigger.types.js';

const BRIEF: RecurringSchedule = { triggerId: 't-1', label: 'daily-tech-brief 科技晨报', owner: 'ella' };

function decision(over: Partial<OwnerDecision> = {}): OwnerDecision {
	return {
		id: 'D-203',
		question: '从明天起 科技晨报 只发 summary 加 app 链接，不再发全文，可以吗？',
		options: [
			{ key: 'a', label: 'Yes, summary and link' },
			{ key: 'b', label: 'No, keep the full text' },
		],
		defaultKey: 'a',
		deadline: new Date().toISOString(),
		requestedBy: 'atlas',
		asker: 'atlas',
		status: 'resolved',
		chosenKey: 'a',
		...over,
	} as OwnerDecision;
}

describe('recurring change hand-off (crewly#1137)', () => {
	it('termsOf takes Latin words and CJK bigrams', () => {
		const t = termsOf('Daily brief 科技晨报');
		expect(t).toEqual(new Set(['daily', 'brief', '科技', '技晨', '晨报']));
	});

	it('recurringSchedules keeps only active cron triggers with a target', () => {
		const base = { id: 't', type: 'time', status: 'active', config: { type: 'time', cronExpression: '0 8 * * *' }, name: 'brief', action: { createWorkItem: { target: 'ella', title: 'morning' } } };
		const rows = recurringSchedules([
			base,
			{ ...base, id: 'paused', status: 'paused' },
			{ ...base, id: 'oneshot', config: { type: 'time', delayMs: 5 } },
			{ ...base, id: 'notarget', action: {} },
		] as unknown as Trigger[]);
		expect(rows).toEqual([{ triggerId: 't', label: 'brief morning', owner: 'ella' }]);
	});

	it('a declined or pending answer is not an approved change', () => {
		expect(isApprovedChange(decision())).toBe(true);
		expect(isApprovedChange(decision({ chosenKey: 'b' }))).toBe(false);
		expect(isApprovedChange(decision({ status: 'open' }))).toBe(false);
		expect(isApprovedChange(decision({ chosenKey: undefined, answerText: '先不' }))).toBe(false);
		expect(isApprovedChange(decision({ chosenKey: undefined, answerText: '可以 明天就是给我一个summary' }))).toBe(true);
	});

	it('matches the schedule the question names, never one the asker runs', () => {
		expect(scheduleOfDecision(decision(), [BRIEF])).toBe(BRIEF);
		expect(scheduleOfDecision(decision({ asker: 'ella', requestedBy: 'ella' }), [BRIEF])).toBeNull();
		expect(scheduleOfDecision(decision({ question: 'Should the invoice export run on Mondays?' }), [BRIEF])).toBeNull();
	});

	it('assigns the change to the schedule owner and tells the asker', async () => {
		const assign = jest.fn().mockResolvedValue(true);
		const line = await handOffRecurringChange(decision(), { listSchedules: () => [BRIEF], assign });
		expect(assign).toHaveBeenCalledWith(BRIEF, expect.stringContaining('Yes, summary and link'), expect.objectContaining({ id: 'D-203' }));
		expect(line).toContain('ella');
	});

	it('does nothing for a decline, no match, a failed assign or a throwing dependency', async () => {
		const assign = jest.fn().mockResolvedValue(true);
		expect(await handOffRecurringChange(decision({ chosenKey: 'b' }), { listSchedules: () => [BRIEF], assign })).toBeNull();
		expect(await handOffRecurringChange(decision(), { listSchedules: () => [], assign })).toBeNull();
		expect(await handOffRecurringChange(decision(), { listSchedules: () => [BRIEF], assign: async () => false })).toBeNull();
		expect(await handOffRecurringChange(decision(), { listSchedules: () => { throw new Error('x'); }, assign })).toBeNull();
		expect(assign).not.toHaveBeenCalled();
	});

	describe('real cards that were wrongly linked to unrelated jobs (2026-10)', () => {
		const jobs: RecurringSchedule[] = [
			{ triggerId: '809619f3', label: labels['steve-weekly-review-v2'], owner: 'atlas-runner' },
			{ triggerId: '8e8feaf6', label: labels['listings-pr-watch'], owner: 'grace-runner' },
		];
		const cards = fixtures as unknown as OwnerDecision[];

		it('uses all 7 recorded cards', () => {
			expect(cards.map((c) => c.id)).toEqual(['D-700', 'D-703', 'D-714', 'D-719', 'D-720', 'D-721', 'D-723']);
		});

		it.each(['D-700', 'D-703', 'D-714', 'D-719', 'D-720', 'D-721', 'D-723'])('%s concerns neither job: no hand-off', (id) => {
			const card = cards.find((c) => c.id === id)!;
			expect(scheduleOfDecision(card, jobs)).toBeNull();
		});

		it('a card that names the job still matches it', () => {
			const card = decision({ question: 'Steve weekly review: drop the time-per-business section from it?', asker: 'ella', requestedBy: 'ella' });
			expect(scheduleOfDecision(card, jobs)?.triggerId).toBe('809619f3');
			const watch = decision({ question: 'Should the listings-pr-watch job also check the PRs on weekends?', asker: 'ella', requestedBy: 'ella' });
			expect(scheduleOfDecision(watch, jobs)?.triggerId).toBe('8e8feaf6');
		});
	});
});
