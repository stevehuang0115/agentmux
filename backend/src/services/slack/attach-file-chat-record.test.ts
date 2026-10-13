import { recordAttachedFileInChat } from './attach-file-chat-record.js';

function makeChat(over: Record<string, unknown> = {}) {
  return {
    recordTurn: jest.fn(() => ({ message: { id: 'msg-1' }, deduped: false })),
    getChannelForBridge: jest.fn((id: string) => (id === 'chan-1' ? { id } : null)),
    findSlackThreadRoot: jest.fn(() => null),
    ensureChannelForLegacyConversation: jest.fn(() => ({ id: 'slack-D1-1.2' })),
    ...over,
  } as any;
}

describe('recordAttachedFileInChat', () => {
  it('records an agent message with the comment and file metadata, flagged as already posted', () => {
    const chat = makeChat({ findSlackThreadRoot: jest.fn(() => ({ id: 'root-1' })) });
    const id = recordAttachedFileInChat(chat, {
      chatChannelId: 'chan-1', agentSession: 'pia', filePath: '/tmp/out/video.mp4', comment: 'Finished video',
      slackChannelId: 'C1', threadTs: '1.2', fileId: 'F9', sizeBytes: 10,
    });
    expect(id).toBe('msg-1');
    expect(chat.recordTurn).toHaveBeenCalledWith({
      channelId: 'chan-1', senderType: 'agent', senderId: 'pia', content: 'Finished video', threadId: 'root-1',
      metadata: expect.objectContaining({
        source: 'reply-tool', replyKind: 'file-upload', slackAlreadyPosted: true, slackChannelId: 'C1', slackThreadTs: '1.2', slackThreadKey: 'C1:1.2',
        files: [{ name: 'video.mp4', path: '/tmp/out/video.mp4', slackFileId: 'F9', sizeBytes: 10 }],
      }),
    });
  });

  it('falls back to "Shared <filename>" without a comment and omits threadId when no root is known', () => {
    const chat = makeChat();
    recordAttachedFileInChat(chat, { chatChannelId: 'chan-1', agentSession: 'pia', filePath: '/a/b.pdf', filename: 'Report.pdf', slackChannelId: 'C1' });
    const arg = chat.recordTurn.mock.calls[0][0];
    expect(arg.content).toBe('Shared Report.pdf');
    expect(arg.threadId).toBeUndefined();
  });

  it('uses the Slack-thread conversation when the chat channel is unknown', () => {
    const chat = makeChat();
    recordAttachedFileInChat(chat, { chatChannelId: '', agentSession: 'crewly-orc', filePath: '/a/b.pdf', slackChannelId: 'D1', threadTs: '1.2' });
    expect(chat.ensureChannelForLegacyConversation).toHaveBeenCalled();
    expect(chat.recordTurn.mock.calls[0][0].channelId).toBe('slack-D1-1.2');
  });

  it('records nothing when there is no channel to put it in', () => {
    const chat = makeChat();
    expect(recordAttachedFileInChat(chat, { chatChannelId: 'nope', agentSession: 'pia', filePath: '/a', slackChannelId: 'C1' })).toBeNull();
    expect(chat.recordTurn).not.toHaveBeenCalled();
  });

  it('never throws', () => {
    const chat = makeChat({ recordTurn: jest.fn(() => { throw new Error('boom'); }) });
    expect(recordAttachedFileInChat(chat, { chatChannelId: 'chan-1', agentSession: 'pia', filePath: '/a', slackChannelId: 'C1' })).toBeNull();
  });
});
