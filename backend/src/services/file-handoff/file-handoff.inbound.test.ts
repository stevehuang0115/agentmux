import { expandInboundFiles } from './file-handoff.inbound.js';
import type { ChatChannelDTO, ChatMessageDTO } from '../chat-v2/types.js';

const ID = 'hf_' + 'A'.repeat(22);
const channel = { id: 'c1', agentSession: undefined } as unknown as ChatChannelDTO;
const msg = (over: Partial<ChatMessageDTO> = {}): ChatMessageDTO =>
  ({
    id: 'm1',
    channelId: 'c1',
    senderType: 'user',
    senderId: 'Sam (agent)',
    content: `report\n📎 r.pdf (1 KB) · crewly-file:${ID}`,
    metadata: { remoteAgentSession: 'sam-session' },
    ...over,
  }) as unknown as ChatMessageDTO;

describe('expandInboundFiles', () => {
  const make = (over = {}) => {
    const expandInbound = jest.fn().mockResolvedValue('report\nFile from Sam: /p/.crewly/inbox/x/r.pdf');
    const deps = {
      service: { expandInbound },
      isLocalAgent: () => false,
      recipientFor: () => 'ella',
      inboxRootFor: jest.fn().mockResolvedValue('/p/.crewly/inbox'),
      ...over,
    };
    return { expandInbound, deps };
  };

  it('downloads a remote colleague agent\'s files and rewrites the content', async () => {
    const { deps, expandInbound } = make();
    const out = await expandInboundFiles(channel, msg(), deps);
    expect(out.content).toBe('report\nFile from Sam: /p/.crewly/inbox/x/r.pdf');
    expect(expandInbound).toHaveBeenCalledWith(expect.any(String), 'Sam', '/p/.crewly/inbox', 'ella');
  });

  it('leaves a message with no marker alone', async () => {
    const { deps, expandInbound } = make();
    const m = msg({ content: 'hello' });
    expect(await expandInboundFiles(channel, m, deps)).toBe(m);
    expect(expandInbound).not.toHaveBeenCalled();
  });

  it('ignores a human pasting a marker (no remote agent author)', async () => {
    const { deps, expandInbound } = make();
    const m = msg({ metadata: {} });
    expect(await expandInboundFiles(channel, m, deps)).toBe(m);
    expect(expandInbound).not.toHaveBeenCalled();
  });

  it('ignores the echo of a local agent\'s own post (it would ack the file before the real recipient)', async () => {
    const { deps, expandInbound } = make({ isLocalAgent: () => true });
    const m = msg();
    expect(await expandInboundFiles(channel, m, deps)).toBe(m);
    expect(expandInbound).not.toHaveBeenCalled();
  });

  it('delivers the original message when no inbox can be found or the expansion throws', async () => {
    const m = msg();
    expect(await expandInboundFiles(channel, m, make({ inboxRootFor: async () => null }).deps)).toBe(m);
    const boom = make();
    boom.expandInbound.mockRejectedValue(new Error('x'));
    expect(await expandInboundFiles(channel, m, boom.deps)).toBe(m);
  });
});
