import { agentMessageRepeatOf, findDuplicateWorkItem, findExistingFollowThrough, normalizeForDedupe, resetAgentMessageDedupeForTesting } from './duplicate-creation.utils.js';
import { DUPLICATE_CREATION_CONSTANTS as D } from '../constants.js';
import type { WorkItem } from '../types/v2/work-item.types.js';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const wi = (over: Partial<WorkItem> & { metadata?: Record<string, unknown> }): WorkItem =>
  ({ id: 'w1', type: 'delegate', owner: 'ella', target: 'lyra', title: 'Daily English study', status: 'queued', createdAt: new Date(NOW - 60_000).toISOString(), ...over }) as WorkItem;

describe('normalizeForDedupe', () => {
  it('ignores case, punctuation and spacing', () => {
    expect(normalizeForDedupe('  Hello,   WORLD!! ')).toBe('hello world');
    expect(normalizeForDedupe('这版 可以吗？')).toBe('这版 可以吗');
  });
});

describe('findDuplicateWorkItem', () => {
  const q = { creator: 'ella', target: 'lyra', title: 'daily english study!', now: NOW };
  it('finds an open twin by the same creator and target inside the window', () => {
    expect(findDuplicateWorkItem(q, [wi({})])?.id).toBe('w1');
  });
  it('matches the delegator stamped in metadata', () => {
    expect(findDuplicateWorkItem(q, [wi({ owner: 'system', metadata: { delegatedBy: 'ella' } })])?.id).toBe('w1');
  });
  it('is not a twin when the creator, target, status or window differ', () => {
    expect(findDuplicateWorkItem({ ...q, creator: 'vera' }, [wi({})])).toBeNull();
    expect(findDuplicateWorkItem({ ...q, target: 'luna' }, [wi({})])).toBeNull();
    expect(findDuplicateWorkItem(q, [wi({ status: 'done' })])).toBeNull();
    expect(findDuplicateWorkItem(q, [wi({ createdAt: new Date(NOW - D.WORK_ITEM_WINDOW_MS - 1).toISOString() })])).toBeNull();
  });
  it('never dedupes without a creator (owner or system adds)', () => {
    expect(findDuplicateWorkItem({ ...q, creator: undefined }, [wi({})])).toBeNull();
  });
});

describe('findExistingFollowThrough', () => {
  const title = 'Follow through: 封面 F2c 做好了';
  const done = wi({ target: 'atlas', title, status: 'verified', metadata: { harnessCreated: 'stated-intent' } });
  it('finds the promise\'s item whatever its status, within a day', () => {
    expect(findExistingFollowThrough([done], 'atlas', title, 'stated-intent', NOW)?.id).toBe('w1');
  });
  it('ignores other targets, origins and old items', () => {
    expect(findExistingFollowThrough([done], 'sage', title, 'stated-intent', NOW)).toBeNull();
    expect(findExistingFollowThrough([done], 'atlas', title, 'owner-promise', NOW)).toBeNull();
    expect(findExistingFollowThrough([done], 'atlas', title, 'stated-intent', NOW + D.FOLLOW_THROUGH_WINDOW_MS + 120_000)).toBeNull();
  });
});

describe('agentMessageRepeatOf', () => {
  const text = 'Lyra, no Sam step needed: crewly-web auto-releases on merge';
  beforeEach(() => resetAgentMessageDedupeForTesting());

  it('the same message to the same target inside the window is a repeat', () => {
    expect(agentMessageRepeatOf('ella', 'lyra', text, NOW)).toBeNull();
    expect(agentMessageRepeatOf('ella', 'lyra', text.toUpperCase(), NOW + 60_000)).toBe(60);
  });
  it('a different target, sender, or the window passing is new', () => {
    agentMessageRepeatOf('ella', 'lyra', text, NOW);
    expect(agentMessageRepeatOf('ella', 'sam', text, NOW + 1000)).toBeNull();
    expect(agentMessageRepeatOf('vera', 'lyra', text, NOW + 1000)).toBeNull();
    expect(agentMessageRepeatOf('ella', 'lyra', text, NOW + D.AGENT_MESSAGE_WINDOW_MS + 1)).toBeNull();
  });
  it('short acks and exempt senders are never repeats', () => {
    agentMessageRepeatOf('ella', 'lyra', 'Accepted, thanks', NOW);
    expect(agentMessageRepeatOf('ella', 'lyra', 'Accepted, thanks', NOW + 1000)).toBeNull();
    agentMessageRepeatOf('WorkItemDispatch', 'lyra', text, NOW);
    expect(agentMessageRepeatOf('WorkItemDispatch', 'lyra', text, NOW + 1000)).toBeNull();
  });
});
