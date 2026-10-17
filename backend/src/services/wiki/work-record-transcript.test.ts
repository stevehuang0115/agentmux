/**
 * Tests for the transcript slice behind a work record (#1349).
 *
 * @module services/wiki/work-record-transcript.test
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { WORK_RECORD_CONSTANTS } from '../../constants.js';
import { parseClaudeTranscriptWindow, readTranscriptTail, transcriptWorthReading } from './work-record-transcript.js';

const T0 = Date.parse('2026-10-17T02:50:00.000Z');
const at = (s: number): string => new Date(T0 + s * 1000).toISOString();

function use(id: string, name: string, input: Record<string, unknown>, seconds: number, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ type: 'assistant', uuid: `u-${id}`, timestamp: at(seconds), message: { content: [{ type: 'tool_use', id, name, input }] }, ...extra });
}

function result(id: string, content: unknown, seconds: number, isError = false, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ type: 'user', uuid: `r-${id}`, timestamp: at(seconds), message: { content: [{ type: 'tool_result', tool_use_id: id, content, ...(isError ? { is_error: true } : {}) }] }, ...extra });
}

function text(body: string, seconds: number): string {
  return JSON.stringify({ type: 'assistant', uuid: `t-${seconds}`, timestamp: at(seconds), message: { content: [{ type: 'text', text: body }] } });
}

describe('parseClaudeTranscriptWindow', () => {
  const lines = [
    use('a', 'Bash', { command: 'npm test -- --maxWorkers=2 backend/src/x.test.ts' }, 10),
    result('a', 'Exit code 1\nFAIL backend/src/x.test.ts', 20),
    use('b', 'Edit', { file_path: '/proj/backend/src/x.ts', old_string: 'a', new_string: 'b' }, 30),
    result('b', 'ok', 31),
    use('c', 'Bash', { command: 'npm test -- --maxWorkers=2 backend/src/x.test.ts' }, 40),
    result('c', 'Tests: 3 passed', 50),
    use('d', 'Bash', { command: 'curl https://example.com/secret' }, 60),
    result('d', 'connection refused', 61, true),
    use('e', 'Bash', { command: 'git commit -m "fix: x"' }, 70),
    result('e', '[feat/x 1a2b3c4] fix: x\n 1 file changed', 71),
    use('f', 'Bash', { command: 'gh pr create --title x' }, 80),
    result('f', 'https://github.com/o/r/pull/42', 81),
    use('g', 'Bash', { command: 'bash reply-chat.sh --text "done"' }, 90),
    result('g', 'sent', 91),
    text('Opened https://github.com/o/r/pull/42 and told the lead.', 95),
    // Outside the window: not counted.
    use('h', 'Bash', { command: 'rm -rf dist' }, 5_000),
    result('h', 'Exit code 2', 5_001),
    // A subagent's chatter is not the agent's.
    use('i', 'Write', { file_path: '/proj/side.ts', content: '' }, 33, { isSidechain: true }),
    'not json',
    '',
  ].join('\n');

  it('keeps tool errors (with later success), files, commits, PR urls and posts inside the window', () => {
    const facts = parseClaudeTranscriptWindow(lines, { fromMs: T0, toMs: T0 + 100_000 }, ['/proj']);
    expect(facts.errors).toEqual([
      { what: 'Bash `npm test -- --maxWorkers=2 backend/src/x.test.ts` exit 1', resolved: 'fixed' },
      { what: 'Bash `curl https://example.com/secret`', resolved: 'unresolved' },
    ]);
    expect(facts.filesWritten).toEqual(['backend/src/x.ts']);
    expect(facts.commits).toEqual(['1a2b3c4']);
    expect(facts.urls).toEqual(['https://github.com/o/r/pull/42']);
    expect(facts.posts).toBe(1);
    expect(facts.toolCalls).toBe(7);
  });

  it('returns nothing when the window misses the entries', () => {
    const facts = parseClaudeTranscriptWindow(lines, { fromMs: T0 + 10_000_000, toMs: T0 + 10_100_000 });
    expect(facts).toEqual({ errors: [], filesWritten: [], urls: [], commits: [], posts: 0, toolCalls: 0 });
  });

  it('caps errors, masks secrets in a failing command and shortens long commands', () => {
    const many = Array.from({ length: 8 }, (_, i) => [
      use(`x${i}`, 'Bash', { command: `cmd${i} --token xoxb-123456-ABCDEFGHIJKLMNOP ${'v'.repeat(120)}` }, i),
      result(`x${i}`, 'boom', i, true),
    ].join('\n')).join('\n');
    const facts = parseClaudeTranscriptWindow(many, { fromMs: T0, toMs: T0 + 100_000 });
    expect(facts.errors).toHaveLength(WORK_RECORD_CONSTANTS.MAX_ERRORS);
    expect(facts.errors[0].what).toContain('[REDACTED slack_token]');
    expect(facts.errors[0].what).toContain('…');
    expect(facts.errors[0].what.length).toBeLessThan(140);
  });
});

describe('readTranscriptTail / transcriptWorthReading', () => {
  it('reads whole lines from the end of a file and tolerates a missing file', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'crewly-wr-tail-'));
    const file = path.join(dir, 't.jsonl');
    await fs.writeFile(file, 'first line is long enough to be cut\nsecond\nthird\n', 'utf8');
    expect(await readTranscriptTail(file, 12)).toBe('third\n');
    expect(await readTranscriptTail(file, 1_000)).toMatch(/^first line/);
    expect(await readTranscriptTail(path.join(dir, 'missing.jsonl'))).toBe('');
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('only consults transcripts for recent items', () => {
    const now = T0;
    expect(transcriptWorthReading(now - 60_000, now)).toBe(true);
    expect(transcriptWorthReading(now - WORK_RECORD_CONSTANTS.TRANSCRIPT_MAX_AGE_MS - 1, now)).toBe(false);
    expect(transcriptWorthReading(Number.NaN, now)).toBe(false);
  });
});
