import type { WorkItem } from '../../types/v2/work-item.types.js';
import type { WorkDestinationDeps } from './work-item-destination.wiring.js';
import type { ReplyResolverDeps } from './reply-destination-resolver.js';
import { deliverReply, internalCoordinationThread, notDelivered, resetReplyDeliveryGuardForTesting, resolveSlackPlace, type ReplyDeliveryDeps } from './reply-destination.wiring.js';
import { AgentPromptReferenceService } from './agent-prompt-reference.service.js';

function resolver(over: Partial<ReplyResolverDeps> = {}): ReplyResolverDeps {
  return {
    getMessage: () => null,
    ownsConversation: async (_s, c) => c === 'room-ce' || c === 'dm-owen',
    slackChannelOfConversation: (c) => (c === 'room-ce' ? 'C0CE00001' : null),
    conversationOfSlackThread: (ch) => (ch === 'C0CE00001' ? { conversationId: 'room-ce' } : null),
    requestTicket: async (n) => (n === 187 ? { id: 'r', label: 'TKT-187', conversationId: 'room-ce', threadRootId: 'root', slackChannelId: 'C0CE00001', threadTs: '1.1' } : null),
    projectTicket: async () => null,
    decision: async () => null,
    workItem: async () => null,
    poolItems: async () => [] as WorkItem[],
    turnOrigin: () => undefined,
    promptReference: () => undefined,
    owesOwner: () => false,
    lastDelivered: () => '[FOLLOW-UP TKT-187] ready',
    ownerDm: async () => 'dm-owen',
    now: () => Date.now(),
    ...over,
  };
}

function work(post = jest.fn(async (r: { target: string }) => ({ channelId: r.target, messageTs: '9.9' }))): WorkDestinationDeps {
  return {
    poolItems: async () => [],
    ownerOrigin: () => undefined,
    now: () => Date.now(),
    teamChannelOf: async () => ({ slackChannelId: 'C0TEAM001', teamId: 't' }),
    ticketThreads: () => null,
    ticketInfo: async () => null,
    post: post as unknown as WorkDestinationDeps['post'],
  };
}

function deps(over: Partial<ReplyDeliveryDeps> = {}, r: Partial<ReplyResolverDeps> = {}): ReplyDeliveryDeps & { deliver: jest.Mock } {
  const deliver = jest.fn(async (i: { conversationId: string }) => `msg-${i.conversationId}`);
  return { resolver: resolver(r), deliverToConversation: deliver, workDestination: async () => work(), deliver, ...over } as ReplyDeliveryDeps & { deliver: jest.Mock };
}

describe('deliverReply', () => {
  beforeEach(() => {
    AgentPromptReferenceService.resetInstance();
    resetReplyDeliveryGuardForTesting();
  });

  it('reply --ticket: delivered in the ticket thread and marked as its delivery', async () => {
    const d = deps();
    const r = await deliverReply({ session: 'owen', content: 'preview: https://x', reference: { ticket: 'TKT-187' } }, d);
    expect(r.ok).toBe(true);
    expect(d.deliver).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'room-ce', thread: 'C0CE00001:1.1', metadata: { deliversTicket: 'TKT-187' } }));
  });

  it('never shows run-trace markers to the owner', async () => {
    const d = deps();
    await deliverReply({ session: 'owen', content: 'preview: https://x\n[TRACE:tr-20261003-0123abcd]', reference: { ticket: 'TKT-187' } }, d);
    expect(d.deliver).toHaveBeenCalledWith(expect.objectContaining({ content: 'preview: https://x' }));
  });

  it('a conversation that does not take it → ok:false with the command, never a guess', async () => {
    const failingPost = jest.fn(async () => { throw new Error('channel_not_found'); });
    const d = deps({ deliverToConversation: jest.fn(async () => null), workDestination: async () => work(failingPost as never) });
    const r = await deliverReply({ session: 'owen', content: 'x', reference: { ticket: 'TKT-187' } }, d);
    expect(r).toEqual(expect.objectContaining({ ok: false }));
    expect(!r.ok && r.error).toMatch(/^Your message was NOT delivered: .*Run: reply "<your message>"$/);
  });

  it('a hint that does not take it → error, never a guessed place (#1136)', async () => {
    const deliver = jest.fn(async (i: { conversationId: string }) => (i.conversationId === 'room-ce' ? null : `msg-${i.conversationId}`));
    const d = deps({ deliverToConversation: deliver });
    const r = await deliverReply({ session: 'owen', content: 'x', hints: { conversationId: 'room-ce' } }, d);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/NOT delivered/);
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('a --thread in a channel the sender is not in fails loudly instead of posting elsewhere (#1136)', async () => {
    const d = deps();
    const r = await deliverReply({ session: 'quinn', content: 'x', hints: { thread: 'C0C46TTBNNP:1791284732.141309' } }, d);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/NOT delivered: .*C0C46TTBNNP:1791284732.141309/);
    expect(d.deliver).not.toHaveBeenCalled();
  });

  it('a delegated member answers in the delegated Slack thread, not in a new DM (#1109)', async () => {
    const post = jest.fn(async (r: { target: string }) => ({ channelId: r.target, messageTs: '9.9' }));
    const delegatedThread = jest.fn(async (_s: string, ch: string, ts: string) => ch === 'C0C46TTBNNP' && ts === '1791199260.411259');
    const d = deps({ workDestination: async () => work(post) }, { delegatedThread });
    const r = await deliverReply({ session: 'lyra', content: 'done', hints: { thread: 'C0C46TTBNNP:1791199260.411259' } }, d);
    expect(r.ok).toBe(true);
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ target: 'C0C46TTBNNP', threadTs: '1791199260.411259', agentSession: 'lyra' }));
    expect(d.deliver).not.toHaveBeenCalled();
  });

  it('a thread that was not delegated to the member still fails (#1109)', async () => {
    const d = deps({}, { delegatedThread: async () => false });
    const r = await deliverReply({ session: 'lyra', content: 'done', hints: { thread: 'C0C46TTBNNP:1791199260.411259' } }, d);
    expect(r.ok).toBe(false);
  });

  it('the same reply sent twice within the guard window is posted once (#1109)', async () => {
    const d = deps();
    const input = { session: 'owen', content: 'same text', reference: { ticket: 'TKT-187' } };
    const a = await deliverReply(input, d);
    const b = await deliverReply(input, d);
    expect(a.ok && b.ok).toBe(true);
    expect(d.deliver).toHaveBeenCalledTimes(1);
  });

  it('answering the prompted reference clears it', async () => {
    AgentPromptReferenceService.getInstance().note('owen', { ticket: 'TKT-187' }, '[FOLLOW-UP TKT-187]');
    const d = deps({}, { promptReference: (s) => AgentPromptReferenceService.getInstance().get(s) });
    const r = await deliverReply({ session: 'owen', content: 'here' }, d);
    expect(r.ok && r.conversationId).toBe('room-ce');
    expect(AgentPromptReferenceService.getInstance().get('owen')).toBeUndefined();
  });
});

describe('deliverReply — CREW-335: a reply to a decision whose card has no chat row', () => {
  const CARD = 'C0CE00001:1791427303.380879';
  const decisionResolver = { decision: async () => ({ id: 'D-457', asker: 'nova', slackChannelId: 'C0CE00001', threadTs: '1791427303.380879' }) } as unknown as Partial<ReplyResolverDeps>;

  beforeEach(() => AgentPromptReferenceService.resetInstance());

  it('the room refuses (no thread root) → posted straight into the card\'s Slack thread', async () => {
    const post = jest.fn(async (r: { target: string }) => ({ channelId: r.target, messageTs: '9.9' }));
    const d = deps({ deliverToConversation: jest.fn(async () => null), workDestination: async () => work(post as never) }, decisionResolver);
    const r = await deliverReply({ session: 'nova', content: 'done, (a) executed', reference: { decisionId: 'D-457' } }, d);
    expect(r.ok).toBe(true);
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ target: 'C0CE00001', threadTs: '1791427303.380879' }));
  });

  it('the Slack thread refuses too → a new top-level post in the room channel', async () => {
    const post = jest.fn(async (r: { target: string; threadTs?: string }) => {
      if (r.threadTs) throw new Error('thread_not_found');
      return { channelId: r.target, messageTs: '9.9' };
    });
    const d = deps({ deliverToConversation: jest.fn(async () => null), workDestination: async () => work(post as never) }, decisionResolver);
    const r = await deliverReply({ session: 'nova', content: 'done', reference: { decisionId: 'D-457' } }, d);
    expect(r.ok).toBe(true);
    expect(post).toHaveBeenLastCalledWith(expect.objectContaining({ newTopLevel: true }));
  });

  it('a member whose post failed is not told it may not be a member, nor to run the command that just failed', async () => {
    const post = jest.fn(async () => { throw new Error('boom'); });
    const d = deps({ deliverToConversation: jest.fn(async () => null), workDestination: async () => work(post as never) }, decisionResolver);
    AgentPromptReferenceService.getInstance().note('nova', { decisionId: 'D-457' }, '[DECISION D-457]');
    const r = await deliverReply({ session: 'nova', content: 'x', reference: { decisionId: 'D-457' } }, { ...d, resolver: { ...d.resolver, promptReference: (s: string) => AgentPromptReferenceService.getInstance().get(s) } } as never);
    expect(r.ok).toBe(false);
    const error = !r.ok ? r.error : '';
    expect(error).not.toMatch(/may not be a member/);
    expect(error).toMatch(/could not post it into its Slack thread/);
    expect(error).not.toMatch(/reply --decision D-457/);
  });

  it('a genuine membership failure still says so', async () => {
    const post = jest.fn(async () => { throw new Error('boom'); });
    const d = deps({ deliverToConversation: jest.fn(async () => null), workDestination: async () => work(post as never) }, { ...decisionResolver, ownsConversation: async () => false });
    const r = await deliverReply({ session: 'nova', content: 'x', reference: { ticket: 'TKT-187' } }, d);
    expect(!r.ok && r.error).toMatch(/not a member there/);
  });
});

describe('deliverReply — reply gate (specs/2026-10-03-one-responder-per-message.md §2)', () => {
  beforeEach(() => AgentPromptReferenceService.resetInstance());
  const prior = jest.fn(async () => ({ by: 'Atlas', excerpt: 'Got it — keeping both versions.' }));

  it('a colleague already answered the owner in this thread → held, not posted anywhere else', async () => {
    const d = deps({ priorRoomAnswer: prior });
    const r = await deliverReply({ session: 'ella', content: 'Both versions it is', reference: { ticket: 'TKT-187' } }, d);
    expect(r).toEqual(expect.objectContaining({ ok: false, held: true }));
    expect(!r.ok && r.error).toContain('Held, not posted: Atlas, the agent answering');
    expect(!r.ok && r.error).not.toContain('--none');
    // No retry without the hints: a held reply must not land somewhere else.
    expect(d.deliver).not.toHaveBeenCalled();
    expect(prior).toHaveBeenCalledWith({ conversationId: 'room-ce', thread: 'C0CE00001:1.1', agentSession: 'ella' });
  });

  it('--adds-new and interim notes are posted', async () => {
    const d = deps({ priorRoomAnswer: prior });
    expect((await deliverReply({ session: 'ella', content: 'One more thing: …', addsNew: true, reference: { ticket: 'TKT-187' } }, d)).ok).toBe(true);
    expect((await deliverReply({ session: 'ella', content: 'on it', interim: true, reference: { ticket: 'TKT-187' } }, d)).ok).toBe(true);
    expect(d.deliver).toHaveBeenCalledTimes(2);
  });

  it('a gate that fails never blocks the reply', async () => {
    const d = deps({ priorRoomAnswer: jest.fn(async () => { throw new Error('db'); }) });
    expect((await deliverReply({ session: 'ella', content: 'x', reference: { ticket: 'TKT-187' } }, d)).ok).toBe(true);
  });
});

describe('resolveSlackPlace', () => {
  it('a Slack thread key hint gives that channel and thread', async () => {
    const p = await resolveSlackPlace({ session: 'owen', hints: { thread: 'C0CE00001:1790000000.000100' } }, deps());
    expect(p).toEqual(expect.objectContaining({ slackChannelId: 'C0CE00001', threadTs: '1790000000.000100', conversationId: 'room-ce' }));
  });

  it('noOwnerDm and nothing to go on → null', async () => {
    expect(await resolveSlackPlace({ session: 'owen', noOwnerDm: true }, deps())).toBeNull();
  });
});

describe('internalCoordinationThread (R5: files follow reply-channel on internal threads)', () => {
  const messages: Record<string, { id: string; channelId: string; threadId?: string; metadata?: Record<string, unknown> }> = {
    'b4647c3f': { id: 'b4647c3f', channelId: 'room-video', metadata: { agentCoordinationInternal: 'local-only', slackThreadKey: 'C0VIDEO:1792177808.671549' } },
    'reply-1': { id: 'reply-1', channelId: 'room-video', threadId: 'b4647c3f' },
    'owner-1': { id: 'owner-1', channelId: 'room-video', metadata: { slackThreadTs: '1792177808.671549' } },
  };
  const d = () => deps({}, { getMessage: (id) => messages[id] ?? null });

  it('an internal message, or a reply in its thread, is internal', async () => {
    expect(await internalCoordinationThread('b4647c3f', d())).toBe('local-only');
    expect(await internalCoordinationThread('reply-1', d())).toBe('local-only');
  });

  it('an owner thread, a Slack key, an unknown id or nothing is not', async () => {
    expect(await internalCoordinationThread('owner-1', d())).toBeNull();
    expect(await internalCoordinationThread('C0VIDEO:1792177808.671549', d())).toBeNull();
    expect(await internalCoordinationThread('nope', d())).toBeNull();
    expect(await internalCoordinationThread(undefined, d())).toBeNull();
  });
});

describe('notDelivered', () => {
  it('formats the English error', () => {
    expect(notDelivered('why', 'reply --to m "<your message>"')).toBe('Your message was NOT delivered: why. Run: reply --to m "<your message>"');
  });
});

describe('deliverReply — work delegated from the owner\'s DM with another agent (crewly#1083)', () => {
  beforeEach(() => AgentPromptReferenceService.resetInstance());

  const delegated = {
    id: 'wi-7',
    type: 'delegate',
    owner: 'team_lead',
    target: 'sage',
    title: 'Compare the two pricing pages',
    status: 'running',
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    metadata: { origin: { kind: 'owner', conversationId: 'dm-atlas', slackChannelId: 'D0ATLAS01', threadTs: '1790000000.000100' } },
  } as unknown as WorkItem;

  const r = {
    ownsConversation: async (s: string, c: string) => (s === 'sage' ? c === 'dm-sage' : false),
    slackChannelOfConversation: (c: string) => (c === 'dm-atlas' ? 'D0ATLAS01' : c === 'dm-sage' ? 'D0SAGE001' : null),
    ownerDm: async (s: string) => (s === 'sage' ? 'dm-sage' : null),
    poolItems: async () => [delegated],
    workItem: async (id: string) => (id === 'wi-7' ? delegated : null),
    lastDelivered: () => undefined,
  };

  it('the member answers in its own DM with the owner, opened with the topic', async () => {
    const deliver = jest.fn(async (i: { conversationId: string }) => (i.conversationId === 'dm-sage' ? 'msg-1' : null));
    const d = deps({ deliverToConversation: deliver }, r);
    const res = await deliverReply({ session: 'sage', content: 'Page B converts better.', reference: { workItemId: 'wi-7' } }, d);
    expect(res.ok && res.conversationId).toBe('dm-sage');
    expect(deliver).toHaveBeenLastCalledWith(expect.objectContaining({ conversationId: 'dm-sage', content: '*Re: Compare the two pricing pages*\nPage B converts better.' }));
  });

  it('a plain reply from current work takes the same path', async () => {
    const deliver = jest.fn(async (i: { conversationId: string }) => (i.conversationId === 'dm-sage' ? 'msg-1' : null));
    const d = deps({ deliverToConversation: deliver }, r);
    const res = await deliverReply({ session: 'sage', content: 'Done.' }, d);
    expect(res.ok && res.conversationId).toBe('dm-sage');
  });

  it('a team-channel destination is never swapped for a DM', async () => {
    const deliver = jest.fn(async () => null);
    const failingPost = jest.fn(async () => { throw new Error('channel_not_found'); });
    const d = deps({ deliverToConversation: deliver, workDestination: async () => work(failingPost as never) });
    const res = await deliverReply({ session: 'owen', content: 'x', reference: { ticket: 'TKT-187' } }, d);
    expect(res.ok).toBe(false);
    expect(deliver).toHaveBeenCalledTimes(1);
  });
});

describe('deliverReply — decision-card threads (CREW-438)', () => {
  beforeEach(() => AgentPromptReferenceService.resetInstance());

  const refuse = () => jest.fn(async () => null);

  it('a refused --conversation + Slack-thread hint in a mapped channel is posted straight to that Slack thread', async () => {
    const post = jest.fn(async (r: { target: string }) => ({ channelId: r.target, messageTs: '9.9' }));
    const d = deps({ deliverToConversation: refuse(), workDestination: async () => work(post) });
    const r = await deliverReply({ session: 'owen', content: 'my answer', hints: { conversationId: 'room-ce', thread: 'C0CE00001:1790000000.000001' } }, d);
    expect(r.ok).toBe(true);
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ target: 'C0CE00001', threadTs: '1790000000.000001', text: 'my answer' }));
    expect(r).toMatchObject({ ok: true, slackChannelId: 'C0CE00001', threadTs: '1790000000.000001' });
  });

  it('does not post to a Slack thread of a different channel than the conversation is mapped to', async () => {
    const post = jest.fn(async (r: { target: string }) => ({ channelId: r.target, messageTs: '9.9' }));
    const d = deps({ deliverToConversation: refuse(), workDestination: async () => work(post) });
    await deliverReply({ session: 'owen', content: 'x', hints: { conversationId: 'room-ce', thread: 'C0OTHER99:1790000000.000001' } }, d);
    expect(post).not.toHaveBeenCalledWith(expect.objectContaining({ target: 'C0OTHER99' }));
  });

  it('the refusal names reply --decision D-n when the thread is a decision card', async () => {
    const d = deps({ deliverToConversation: refuse(), workDestination: async () => work(jest.fn(async (_r: { target: string }) => { throw new Error('slack down'); })), decisionOfCardThread: async (ch, ts) => (ch === 'C0CE00001' && ts === '1790000000.000001' ? 'D-42' : null) });
    const r = await deliverReply({ session: 'owen', content: 'x', hints: { conversationId: 'room-ce', thread: 'C0CE00001:1790000000.000001' } }, d);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain('reply --decision D-42');
  });
});

describe('deliverReply — "Triggered by" provenance (agent-provenance audit 2026-10-14)', () => {
  beforeEach(() => {
    AgentPromptReferenceService.resetInstance();
    resetReplyDeliveryGuardForTesting();
  });

  const reminder = { triggerKind: 'follow_up' as const, ticket: 'TKT-187', rootKind: 'follow_up' as const, rootRef: 'TKT-187', viaAgents: [], at: 0 };

  it('a reminder-started post gets the line and the record', async () => {
    const d = deps({ turnTrigger: () => reminder, currentTrace: () => 'tr-20261014-0123abcd' });
    await deliverReply({ session: 'owen', content: 'preview: https://x', reference: { ticket: 'TKT-187' } }, d);
    expect(d.deliver).toHaveBeenCalledWith(expect.objectContaining({
      content: 'preview: https://x\n\n_↳ Triggered by an automatic reminder of something promised to you_',
      metadata: {
        deliversTicket: 'TKT-187',
        triggeredBy: expect.objectContaining({ traceId: 'tr-20261014-0123abcd', triggerKind: 'follow_up', rootRef: 'TKT-187', label: 'Triggered by an automatic reminder of something promised to you' }),
      },
    }));
  });

  it('no line when the owner asked the agent in this conversation recently; the record is still kept', async () => {
    const d = deps({ turnTrigger: () => reminder, ownerAskedRecently: (_s, c) => c === 'room-ce' });
    await deliverReply({ session: 'owen', content: 'preview: https://x', reference: { ticket: 'TKT-187' } }, d);
    const call = d.deliver.mock.calls[0][0] as { content: string; metadata: Record<string, { label?: string }> };
    expect(call.content).toBe('preview: https://x');
    expect(call.metadata.triggeredBy).toBeDefined();
    expect(call.metadata.triggeredBy.label).toBeUndefined();
  });

  it('an interim note carries no line', async () => {
    const d = deps({ turnTrigger: () => reminder });
    await deliverReply({ session: 'owen', content: 'on it', interim: true, reference: { ticket: 'TKT-187' } }, d);
    expect(d.deliver).toHaveBeenCalledWith(expect.objectContaining({ content: 'on it' }));
  });

  it('no trigger known: unchanged', async () => {
    const d = deps({ turnTrigger: () => null });
    await deliverReply({ session: 'owen', content: 'preview: https://x', reference: { ticket: 'TKT-187' } }, d);
    expect(d.deliver).toHaveBeenCalledWith(expect.objectContaining({ content: 'preview: https://x', metadata: { deliversTicket: 'TKT-187' } }));
  });
});

describe('chatConversationPlace', () => {
  it('names channels and DMs as the owner knows them', async () => {
    const { chatConversationPlace } = await import('./reply-destination.wiring.js');
    const chat = {
      getChannelForBridge: (id: string) =>
        id === 'c1' ? { name: 'content-team', type: 'channel' } : id === 'd1' ? { name: 'x', type: 'dm', agentSession: 'crewly-marketing-ella-e6a6b8ea' } : null,
    };
    expect(chatConversationPlace(chat, 'c1')).toBe('#content-team');
    expect(chatConversationPlace(chat, 'd1')).toBe('the DM with Ella');
    expect(chatConversationPlace(chat, 'zz')).toBeNull();
    expect(chatConversationPlace(null, 'c1')).toBeNull();
  });
});

describe('deliverReply — answer to another agent\'s message (crewly#1375)', () => {
  beforeEach(() => {
    AgentPromptReferenceService.resetInstance();
    resetReplyDeliveryGuardForTesting();
  });
  const ownerTurn = { conversationId: 'room-ce', receivedAt: Date.now() - 180_000 };
  const fromAtlas = () => ({ kind: 'agent' as const, sender: 'think-tank-atlas-b4e166f6', at: Date.now() - 60_000 });

  it('goes back to the sender agent, not into the owner thread', async () => {
    const answerAgent = jest.fn(async () => true);
    const d = deps({ answerAgent }, { turnOrigin: () => ownerTurn, latestInput: fromAtlas, lastDelivered: () => undefined });
    const r = await deliverReply({ session: 'flopost-pia-1', content: '(1) your note is half right' }, d);
    expect(r).toEqual(expect.objectContaining({ ok: true, agentSession: 'think-tank-atlas-b4e166f6' }));
    expect(answerAgent).toHaveBeenCalledWith('flopost-pia-1', 'think-tank-atlas-b4e166f6', '(1) your note is half right');
    expect(d.deliver).not.toHaveBeenCalled();
  });

  it('a sender that cannot be reached is an error naming send-message', async () => {
    const d = deps({ answerAgent: jest.fn(async () => false) }, { turnOrigin: () => ownerTurn, latestInput: fromAtlas, lastDelivered: () => undefined });
    const r = await deliverReply({ session: 'flopost-pia-1', content: 'x' }, d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('send-message --to think-tank-atlas-b4e166f6');
    expect(d.deliver).not.toHaveBeenCalled();
  });
});
