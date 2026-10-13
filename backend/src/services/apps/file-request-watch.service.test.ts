import { FileRequestWatchService, buildFileUploadedMessage, formatSize, type FileRequestInboxItem } from './file-request-watch.service.js';

const item = (over: Partial<FileRequestInboxItem> = {}): FileRequestInboxItem => ({
  requestId: 'ur_AbCdEfGhIjKlMnOpQrStUv',
  agentSession: 'pia',
  purpose: 'raw footage for the launch video',
  handoffId: 'hf_AbCdEfGhIjKlMnOpQrStUv',
  fileName: 'IMG_5057.MOV',
  sizeBytes: 23273672,
  ...over,
});

function make(items: FileRequestInboxItem[], over: Record<string, unknown> = {}) {
  const request = jest.fn(async (method: string, path: string) => {
    if (method === 'GET') return { items };
    return { marked: 1 };
  });
  const sendToAgent = jest.fn().mockResolvedValue(true);
  const sendToOrchestrator = jest.fn().mockResolvedValue(true);
  const svc = new FileRequestWatchService({
    client: { request } as never,
    sendToAgent,
    sendToOrchestrator,
    isLocalAgent: async () => true,
    ...over,
  });
  return { svc, request, sendToAgent, sendToOrchestrator };
}

describe('formatSize', () => {
  it('prints KB, MB and GB', () => {
    expect(formatSize(2048)).toBe('2 KB');
    expect(formatSize(23273672)).toBe('22.2 MB');
    expect(formatSize(3 * 1024 ** 3)).toBe('3.00 GB');
  });
});

describe('buildFileUploadedMessage', () => {
  it('names the file, its size, the request and the receive command; quotes the owner-provided name', () => {
    const text = buildFileUploadedMessage([item({ fileName: 'a\nb"c.mov' })], (id) => `receive ${id}`);
    expect(text).toContain('raw footage for the launch video');
    expect(text).toContain('22.2 MB');
    expect(text).toContain('receive hf_AbCdEfGhIjKlMnOpQrStUv');
    expect(text).toContain('"a b\\"c.mov"');
    expect(text.split('\n').length).toBe(3);
  });
});

describe('FileRequestWatchService.pollOnce', () => {
  it('delivers an uploaded file to the agent that asked, then marks it told', async () => {
    const { svc, request, sendToAgent } = make([item()]);
    expect(await svc.pollOnce()).toBe(1);
    expect(sendToAgent).toHaveBeenCalledTimes(1);
    expect(sendToAgent).toHaveBeenCalledWith('pia', expect.stringContaining('IMG_5057.MOV'), true);
    expect(request).toHaveBeenLastCalledWith('POST', '/upload-requests/ur_AbCdEfGhIjKlMnOpQrStUv/notified', expect.objectContaining({ body: { handoffIds: ['hf_AbCdEfGhIjKlMnOpQrStUv'] } }));
  });

  it('two files of one request arrive in one message', async () => {
    const { svc, sendToAgent } = make([item(), item({ handoffId: 'hf_ZZZZZZZZZZZZZZZZZZZZZZ', fileName: 'two.mp4' })]);
    expect(await svc.pollOnce()).toBe(2);
    expect(sendToAgent).toHaveBeenCalledTimes(1);
    expect(sendToAgent.mock.calls[0][1]).toContain('2 files');
  });

  it('a delivery that failed stays in the inbox: not marked told, retried next pass', async () => {
    const { svc, request, sendToAgent } = make([item()]);
    sendToAgent.mockResolvedValueOnce(false);
    expect(await svc.pollOnce()).toBe(0);
    expect(request.mock.calls.filter((c) => c[0] === 'POST')).toHaveLength(0);
    expect(await svc.pollOnce()).toBe(1);
  });

  it('a mark that failed is retried without sending the message again', async () => {
    const { svc, request, sendToAgent } = make([item()]);
    request.mockImplementation(async (method: string) => {
      if (method === 'GET') return { items: [item()] };
      throw new Error('boom');
    });
    expect(await svc.pollOnce()).toBe(1);
    expect(await svc.pollOnce()).toBe(0);
    expect(sendToAgent).toHaveBeenCalledTimes(1);
  });

  it('an agent that is gone from this machine goes to the orchestrator', async () => {
    const { svc, sendToAgent, sendToOrchestrator } = make([item()], { isLocalAgent: async () => false });
    expect(await svc.pollOnce()).toBe(1);
    expect(sendToAgent).not.toHaveBeenCalled();
    expect(sendToOrchestrator).toHaveBeenCalledWith(expect.stringContaining('"pia" is not on this machine'));
  });

  it('delivers as an owner-authored message when the wiring supplies it', async () => {
    const asOwnerMessage = jest.fn(<T,>(_s: string, _t: string, _r: string, deliver: () => T) => deliver());
    const { svc } = make([item()], { asOwnerMessage });
    await svc.pollOnce();
    expect(asOwnerMessage).toHaveBeenCalledWith('pia', expect.any(String), 'file-request:hf_AbCdEfGhIjKlMnOpQrStUv', expect.any(Function));
  });

  it('ignores malformed inbox items', async () => {
    const { svc, sendToAgent } = make([{ nope: true } as never]);
    expect(await svc.pollOnce()).toBe(0);
    expect(sendToAgent).not.toHaveBeenCalled();
  });
});
