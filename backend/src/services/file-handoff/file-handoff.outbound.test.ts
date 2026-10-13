import { attachOutboundFiles, explicitFilesOf } from './file-handoff.outbound.js';

describe('attachOutboundFiles', () => {
  const result = { content: 'hi\n📎 a.txt (1 B) · crewly-file:hf_x', attached: [{ fileName: 'a.txt', sizeBytes: 1, handoffId: 'hf_x' }], failed: [] };
  const make = (over: Partial<Parameters<typeof attachOutboundFiles>[3]> = {}) => {
    const attachToMessage = jest.fn().mockResolvedValue(result);
    const crossMachine = jest.fn().mockResolvedValue(true);
    const projectDirFor = jest.fn().mockResolvedValue('/proj');
    return { attachToMessage, crossMachine, projectDirFor, deps: { service: { attachToMessage }, projectDirFor, crossMachine, ...over } };
  };

  it('does nothing and looks nothing up for a message with no files or paths', async () => {
    const m = make();
    expect(await attachOutboundFiles({ content: 'just words' }, 'sam', 'c1', m.deps)).toBeNull();
    expect(m.crossMachine).not.toHaveBeenCalled();
    expect(m.projectDirFor).not.toHaveBeenCalled();
  });

  it('attaches explicit files without asking whether the room is cross-machine', async () => {
    const m = make();
    const r = await attachOutboundFiles({ content: 'hi', files: ['./a.txt', 3, ''] }, 'sam', 'c1', m.deps);
    expect(r).toBe(result);
    expect(m.crossMachine).not.toHaveBeenCalled();
    expect(m.attachToMessage).toHaveBeenCalledWith({ content: 'hi', explicit: ['./a.txt'], auto: false, projectDir: '/proj', agent: 'sam' });
  });

  it('auto-attaches a mentioned path only in a room with a colleague on another machine', async () => {
    const yes = make();
    await attachOutboundFiles({ content: 'see /proj/out/a.pdf' }, 'sam', 'c1', yes.deps);
    expect(yes.attachToMessage).toHaveBeenCalledWith(expect.objectContaining({ auto: true, explicit: [] }));

    const no = make({ crossMachine: jest.fn().mockResolvedValue(false) });
    expect(await attachOutboundFiles({ content: 'see /proj/out/a.pdf' }, 'sam', 'c1', no.deps)).toBeNull();
    expect(no.attachToMessage).not.toHaveBeenCalled();
  });

  it('never auto-attaches from an interim note', async () => {
    const m = make();
    expect(await attachOutboundFiles({ content: 'working on /proj/a.pdf', interim: true }, 'sam', 'c1', m.deps)).toBeNull();
  });

  it('reports explicit files as failed when the project directory is unknown', async () => {
    const m = make({ projectDirFor: jest.fn().mockResolvedValue(null) });
    const r = await attachOutboundFiles({ content: 'hi', files: ['./a.txt'] }, 'sam', 'c1', m.deps);
    expect(r?.failed).toEqual([{ file: './a.txt', reason: expect.stringMatching(/project directory/) }]);
    expect(r?.content).toBe('hi');
  });

  it('returns null when a mentioned path turned out not to be sendable (no change to the message)', async () => {
    const m = make();
    m.attachToMessage.mockResolvedValue({ content: 'x', attached: [], failed: [] });
    expect(await attachOutboundFiles({ content: 'see /etc/hosts' }, 'sam', 'c1', m.deps)).toBeNull();
  });

  it('passes the caller-reported project path as a hint', async () => {
    const m = make();
    await attachOutboundFiles({ content: 'hi', files: ['a'], projectPath: '/hint' }, 'sam', 'c1', m.deps);
    expect(m.projectDirFor).toHaveBeenCalledWith('sam', '/hint');
  });

  it('explicitFilesOf drops non-strings', () => {
    expect(explicitFilesOf(undefined)).toEqual([]);
    expect(explicitFilesOf([' a ', 1, null])).toEqual(['a']);
  });
});
