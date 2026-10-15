/**
 * Tests for computeWhereabouts: who holds a Request now, doing what, since when.
 */

import { computeWhereabouts, formatDuration } from './request-whereabouts.service.js';
import type { Request } from '../../types/v2/request.types.js';
import type { WorkItem } from '../../types/v2/work-item.types.js';
import type { AgentAsk } from '../messaging/agent-ask-ledger.service.js';

const NOW = Date.parse('2026-10-14T18:00:00Z');
const at = (hhmm: string): string => `2026-10-14T${hhmm}:00.000Z`;

/** A Request with sensible defaults. */
function request(over: Partial<Request> = {}): Request {
	return {
		id: 'req-1',
		title: 'Replicate the dotpromo video',
		status: 'running',
		workItemIds: [],
		createdAt: at('13:43'),
		updatedAt: at('13:45'),
		...over,
	} as Request;
}

/** A WorkItem with sensible defaults. */
function item(over: Partial<WorkItem>): WorkItem {
	return {
		id: 'wi-1',
		type: 'delegate',
		status: 'running',
		title: 'Make the replica',
		requestId: 'req-1',
		createdAt: at('13:46'),
		metadata: {},
		...over,
	} as WorkItem;
}

/** An open ask. */
function ask(sender: string, target: string, hhmm: string, excerpt = 'please do it'): AgentAsk {
	return { sender, target, excerpt, deliveredAt: Date.parse(at(hhmm)) };
}

describe('formatDuration', () => {
	it('minutes, hours, days', () => {
		expect(formatDuration(45 * 60_000)).toBe('45m');
		expect(formatDuration(130 * 60_000)).toBe('2h 10m');
		expect(formatDuration(76 * 3_600_000)).toBe('3d 4h');
		expect(formatDuration(-5)).toBe('0m');
	});
});

describe('computeWhereabouts', () => {
	it('a finished request has no holders', () => {
		const w = computeWhereabouts(request({ status: 'done', completedAt: at('17:00') }), [item({})], [], NOW);
		expect(w).toMatchObject({ finished: true, finishedAt: at('17:00'), holders: [] });
		expect(w.summary).toContain('Done');
	});

	it('a running work item: its target is working on it, since its last status change', () => {
		const w = computeWhereabouts(request(), [item({ target: 'dex', statusChangedAt: at('14:28') })], [], NOW);
		expect(w.holders).toEqual([
			expect.objectContaining({ session: 'dex', state: 'working', since: at('14:28'), forMs: (3 * 60 + 32) * 60_000, workItemId: 'wi-1' }),
		]);
		expect(w.summary).toBe('dex (working on "Make the replica") for 3h 32m.');
	});

	it('links by workItemIds too, and ignores other requests and closed items', () => {
		const w = computeWhereabouts(
			request({ workItemIds: ['wi-linked'] }),
			[
				item({ id: 'wi-linked', requestId: undefined, target: 'sam', status: 'queued' }),
				item({ id: 'wi-other', requestId: 'req-2', target: 'eve' }),
				item({ id: 'wi-done', target: 'kim', status: 'verified' }),
			],
			[],
			NOW,
		);
		expect(w.holders.map((h) => `${h.session}:${h.state}`)).toEqual(['sam:queued']);
	});

	it('done_by_worker is with the reviewer; the review item is folded in', () => {
		const src = item({ id: 'wi-src', target: 'dex', status: 'done_by_worker', statusChangedAt: at('15:00') });
		const review = item({ id: 'wi-src:verify:wi-src', type: 'review', target: 'pia', status: 'queued', metadata: { verifyOf: 'wi-src' } });
		const w = computeWhereabouts(request(), [src, review], [], NOW);
		expect(w.holders).toEqual([expect.objectContaining({ session: 'pia', state: 'awaiting_review', workItemId: 'wi-src' })]);
		expect(w.summary).toContain('pia (reviewing');
	});

	it('blocked items carry the reason', () => {
		const w = computeWhereabouts(request(), [item({ target: 'dex', status: 'blocked', blockedReason: 'no ffmpeg' })], [], NOW);
		expect(w.holders[0]).toMatchObject({ state: 'blocked', blockedReason: 'no ffmpeg' });
	});

	it('follows plain-message hand-offs: Ella → Pia → Dex', () => {
		const w = computeWhereabouts(
			request({ ownerAgent: 'ella', updatedAt: at('13:45') }),
			[],
			[ask('ella', 'pia', '13:46', 'Pia, you take this'), ask('pia', 'dex', '14:28', 'Dex, replicate it'), ask('zed', 'kim', '13:00')],
			NOW,
		);
		expect(w.holders.map((h) => `${h.session}:${h.state}`)).toEqual(['ella:waiting_on_agent', 'pia:waiting_on_agent', 'dex:working']);
		expect(w.holders[2]).toMatchObject({ from: 'pia', what: 'Dex, replicate it', since: at('14:28') });
		expect(w.summary).toBe('dex (working on "Dex, replicate it", from pia) for 3h 32m.');
	});

	it('an ask older than the holder took the work is not this request', () => {
		const w = computeWhereabouts(request(), [item({ target: 'dex', statusChangedAt: at('14:00') })], [ask('dex', 'sam', '13:30')], NOW);
		expect(w.holders.map((h) => h.session)).toEqual(['dex']);
	});

	it('waits on the owner when the request waits on a confirmation', () => {
		const w = computeWhereabouts(request({ status: 'waiting_confirmation', updatedAt: at('17:30') }), [], [], NOW);
		expect(w.holders).toEqual([expect.objectContaining({ session: 'owner', state: 'waiting_on_owner' })]);
		expect(w.summary).toContain('You (waiting on you for');
	});

	it('an awaiting_followup request is with the agent that still owes an item', () => {
		const oi = (agent: string, status: string, text: string) => ({ id: `c-${agent}`, type: 'commitment', text, agent, sourceMessageId: 'm', createdAt: at('16:00'), status });
		const w = computeWhereabouts(
			request({ status: 'awaiting_followup', updatedAt: at('17:30'), openItems: [oi('pia', 'open', 'send v2 tonight'), oi('dex', 'delivered', 'done')] as Request['openItems'] }),
			[],
			[],
			NOW,
		);
		expect(w.holders).toEqual([expect.objectContaining({ session: 'pia', state: 'handling', what: 'send v2 tonight', since: at('16:00') })]);
	});

	it('an awaiting_followup request waits on the owner only when every owed item does', () => {
		const owed = [{ id: 'q-1', type: 'question', text: 'which cut?', agent: 'pia', sourceMessageId: 'm', createdAt: at('16:00'), status: 'waiting_owner' }];
		const w = computeWhereabouts(request({ status: 'awaiting_followup', updatedAt: at('17:30'), openItems: owed as Request['openItems'] }), [], [], NOW);
		expect(w.holders).toEqual([expect.objectContaining({ session: 'owner', state: 'waiting_on_owner' })]);
	});

	it('says so when nobody holds it', () => {
		const w = computeWhereabouts(request(), [], [], NOW);
		expect(w.holders).toEqual([]);
		expect(w.summary).toContain('Nobody holds it');
	});

	it('does not loop on a cycle of asks', () => {
		const w = computeWhereabouts(request({ assignee: 'a' }), [], [ask('a', 'b', '14:00'), ask('b', 'a', '14:10')], NOW);
		expect(w.holders.length).toBeLessThanOrEqual(4);
	});
});
