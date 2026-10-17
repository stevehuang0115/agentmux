/**
 * Tests for the agent conversations carried by a team move (crewly#1344).
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { claudeTranscriptPath, readLastConversation, rememberedConversationToResume } from '../agent/runtime-session-recovery.js';
import { collectAgentTranscripts, importAgentTranscript, sourceConversationOf, transcriptPackagePath, claudeHomesOn } from './team-move-transcripts.js';
import type { PackageConversation } from './team-move.types.js';

describe('team-move-transcripts', () => {
  let root: string;
  let home: string;
  let claudeHome: string;
  let cwd: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'move-transcripts-'));
    home = path.join(root, 'home');
    claudeHome = path.join(root, 'claude');
    cwd = path.join(root, 'proj');
    await fs.mkdir(home, { recursive: true });
    await fs.mkdir(cwd, { recursive: true });
  });
  afterEach(() => fs.rm(root, { recursive: true, force: true }));

  const writeTranscript = async (sessionId: string, lines: string[], at: string = claudeHome): Promise<string> => {
    const file = claudeTranscriptPath({ sessionId, cwd, claudeHome: at });
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, lines.join('\n') + '\n');
    return file;
  };

  it('finds the conversation of a registered session, else the remembered one of a stopped session', async () => {
    await fs.writeFile(path.join(home, 'session-state.json'), JSON.stringify({ version: 1, savedAt: 'x', sessions: [{ name: 'lena', cwd, runtimeType: 'claude-code', claudeSessionId: 'live-1' }, { name: 'codex', cwd, runtimeType: 'codex-cli', claudeSessionId: 'c-1' }] }));
    await fs.writeFile(path.join(home, 'last-conversations.json'), JSON.stringify({ dev: { sessionId: 'old-2', cwd, at: 1 } }));
    expect(await sourceConversationOf(home, 'lena')).toEqual({ sessionId: 'live-1', cwd });
    expect(await sourceConversationOf(home, 'dev')).toEqual({ sessionId: 'old-2', cwd });
    expect(await sourceConversationOf(home, 'codex')).toBeNull();
    expect(await sourceConversationOf(home, 'nobody')).toBeNull();
  });

  it('lists the default login and every account config dir as a place to look', async () => {
    await fs.mkdir(path.join(home, 'claude-accounts', 'b'), { recursive: true });
    expect(claudeHomesOn(home, claudeHome)).toEqual([claudeHome, path.join(home, 'claude-accounts', 'b')]);
    expect(claudeHomesOn(path.join(root, 'empty'), claudeHome)).toEqual([claudeHome]);
  });

  it('stages each Claude Code member\'s latest transcript (and sidecar) under the cap, and lists the rest with a reason', async () => {
    await fs.writeFile(
      path.join(home, 'session-state.json'),
      JSON.stringify({ version: 1, savedAt: 'x', sessions: [{ name: 'lena', cwd, runtimeType: 'claude-code', claudeSessionId: 'conv-lena' }, { name: 'big', cwd, runtimeType: 'claude-code', claudeSessionId: 'conv-big' }, { name: 'gone', cwd, runtimeType: 'claude-code', claudeSessionId: 'conv-gone' }] }),
    );
    const lena = await writeTranscript('conv-lena', ['{"type":"user","message":{"content":"hi"}}']);
    await fs.mkdir(path.join(path.dirname(lena), 'conv-lena', 'subagents'), { recursive: true });
    await fs.writeFile(path.join(path.dirname(lena), 'conv-lena', 'subagents', 'agent-1.jsonl'), '{}\n');
    await writeTranscript('conv-big', ['x'.repeat(5000)]);
    const copied: Array<[string, string]> = [];
    const out = await collectAgentTranscripts({
      home,
      members: [{ sessionName: 'lena', runtimeType: 'claude-code' }, { sessionName: 'big' }, { sessionName: 'gone' }, { sessionName: 'nova', runtimeType: 'codex-cli' }, { sessionName: 'none' }],
      copyIn: async (abs, rel) => void copied.push([abs, rel]),
      claudeHomes: [claudeHome],
      maxBytes: 1000,
    });
    expect(out).toEqual([
      { sessionName: 'lena', sessionId: 'conv-lena', cwd, bytes: (await fs.stat(lena)).size, file: transcriptPackagePath('lena', 'conv-lena'), files: 2 },
      { sessionName: 'big', sessionId: 'conv-big', cwd, bytes: 5001, skipped: 'too_large' },
      { sessionName: 'gone', sessionId: 'conv-gone', cwd, bytes: 0, skipped: 'not_found' },
    ]);
    expect(copied).toEqual([
      [lena, 'transcripts/lena/conv-lena.jsonl'],
      [path.join(path.dirname(lena), 'conv-lena', 'subagents', 'agent-1.jsonl'), 'transcripts/lena/conv-lena/subagents/agent-1.jsonl'],
    ]);
  });

  it('imports a transcript under the target cwd slug with paths rewritten, and remembers it so the launch resumes it', async () => {
    const staging = path.join(root, 'staging');
    const sourceCwd = '/Users/src/projects/app';
    await fs.mkdir(path.join(staging, 'transcripts', 'lena', 'conv-lena', 'subagents'), { recursive: true });
    await fs.writeFile(
      path.join(staging, 'transcripts', 'lena', 'conv-lena.jsonl'),
      [JSON.stringify({ type: 'user', cwd: sourceCwd, message: { content: `read ${sourceCwd}/README.md` } }), JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'done' }] } })].join('\n') + '\n',
    );
    await fs.writeFile(path.join(staging, 'transcripts', 'lena', 'conv-lena', 'subagents', 'agent-1.jsonl'), '{}\n');
    const conversation: PackageConversation = { sessionName: 'lena', sessionId: 'conv-lena', cwd: sourceCwd, bytes: 10, file: 'transcripts/lena/conv-lena.jsonl', files: 2 };
    const targetHome = path.join(root, 'target-claude');

    const written = await importAgentTranscript({ home, conversation, staging, targetCwd: cwd, rewrites: [[sourceCwd, cwd]], claudeHome: targetHome, now: () => 1_000 });

    expect(written).toBe(claudeTranscriptPath({ sessionId: 'conv-lena', cwd, claudeHome: targetHome }));
    const text = await fs.readFile(written!, 'utf8');
    expect(text).toContain(`read ${cwd}/README.md`);
    expect(text).not.toContain(sourceCwd);
    expect(text.trim().split('\n').every((l) => JSON.parse(l))).toBe(true);
    expect(await fs.readFile(path.join(path.dirname(written!), 'conv-lena', 'subagents', 'agent-1.jsonl'), 'utf8')).toBe('{}\n');
    // What AgentRegistrationService.planRuntimeSession reads for a session with no stored id yet.
    const file = path.join(home, 'last-conversations.json');
    expect(readLastConversation(file, 'lena')).toEqual({ sessionId: 'conv-lena', cwd, at: 1_000 });
    expect(rememberedConversationToResume({ file, sessionName: 'lena', now: 2_000 })).toMatchObject({ sessionId: 'conv-lena', cwd });
  });

  it('writes nothing for an entry without a file or whose file is missing', async () => {
    const staging = path.join(root, 'staging');
    await fs.mkdir(staging, { recursive: true });
    expect(await importAgentTranscript({ home, conversation: { sessionName: 'x', sessionId: 'c', cwd: '/a', bytes: 0, skipped: 'too_large' }, staging, targetCwd: cwd, rewrites: [] })).toBeNull();
    expect(await importAgentTranscript({ home, conversation: { sessionName: 'x', sessionId: 'c', cwd: '/a', bytes: 0, file: 'transcripts/x/c.jsonl' }, staging, targetCwd: cwd, rewrites: [] })).toBeNull();
  });
});
