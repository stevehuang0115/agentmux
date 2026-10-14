/**
 * Tests for the orchestrator post placement (conversation + thread).
 */

import { planOrcPostPlacement } from './orc-post-placement.js';
import { ORC_REPLY_ROUTE_CONSTANTS } from '../../constants.js';
import type { WorkItem } from '../../types/v2/work-item.types.js';

const NOW = 1_800_000_000_000;
const fresh = (over = {}) => ({ conversationId: 'room-content', slackChannelId: 'C0CT', slackThreadTs: '1790.1', slackThreadKey: 'C0CT:1790.1', receivedAt: NOW - 60_000, ...over });
const stale = (over = {}) => fresh({ receivedAt: NOW - ORC_REPLY_ROUTE_CONSTANTS.ORIGIN_TTL_MS - 1000, ...over });

function workItemFrom(over: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 'wi-1',
    title: 'MCP page',
    status: 'running',
    target: 'ce-owen',
    createdAt: new Date(NOW - 3_600_000).toISOString(),
    startedAt: new Date(NOW - 3_000_000).toISOString(),
    metadata: { origin: { kind: 'owner', conversationId: 'room-ce', slackChannelId: 'C0CE', threadTs: '1780.9' } },
    ...over,
  } as unknown as WorkItem;
}

describe('planOrcPostPlacement', () => {
  it('keeps a Slack thread the caller named', () => {
    const p = planOrcPostPlacement({ requestedSlackThread: 'C0X:1.2', routedConversationId: 'room-x', origin: fresh(), ownerDmConversationId: 'dm', now: NOW });
    expect(p).toEqual(expect.objectContaining({ via: 'named-thread', conversationId: 'room-x', slackThread: 'C0X:1.2' }));
  });

  it('a relay of a work item goes to the work item\'s owner thread, not the last origin', () => {
    const p = planOrcPostPlacement({ routedConversationId: 'room-content', origin: stale(), workItem: workItemFrom(), ownerDmConversationId: 'dm', now: NOW });
    expect(p.via).toBe('work-item');
    expect(p.conversationId).toBe('room-ce');
    expect(p.slackThread).toBe('C0CE:1780.9');
  });

  it('answers in the fresh turn origin\'s Slack thread (it used to land top-level)', () => {
    const p = planOrcPostPlacement({ routedConversationId: 'room-content', origin: fresh(), ownerDmConversationId: 'dm', now: NOW });
    expect(p).toEqual(expect.objectContaining({ via: 'origin-thread', conversationId: 'room-content', slackThread: 'C0CT:1790.1' }));
  });

  it('a stale origin with nothing named goes to the owner DM, not the last active channel', () => {
    const p = planOrcPostPlacement({ routedConversationId: 'room-content', origin: stale(), ownerDmConversationId: 'dm', now: NOW });
    expect(p).toEqual(expect.objectContaining({ via: 'owner-dm', conversationId: 'dm' }));
    expect(p.slackThread).toBeUndefined();
  });

  it('a stale origin that already is the owner DM stays', () => {
    const p = planOrcPostPlacement({ routedConversationId: 'dm', origin: stale({ conversationId: 'dm' }), ownerDmConversationId: 'dm', now: NOW });
    expect(p.via).toBe('unchanged');
  });

  it('a conversation the caller named is never swapped for the DM, and takes no stale thread', () => {
    const p = planOrcPostPlacement({ requestedConversationId: 'room-content', routedConversationId: 'room-content', origin: stale(), ownerDmConversationId: 'dm', now: NOW });
    expect(p).toEqual({ conversationId: 'room-content', via: 'unchanged', reason: expect.any(String) });
  });

  it('without a known owner DM a stale origin is left as routed', () => {
    const p = planOrcPostPlacement({ routedConversationId: 'room-content', origin: stale(), ownerDmConversationId: null, now: NOW });
    expect(p.via).toBe('unchanged');
  });
});
