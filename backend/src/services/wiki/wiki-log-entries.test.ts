/**
 * Tests for the vault log entry parser, noise filter and helpers (#1345).
 *
 * @module services/wiki/wiki-log-entries.test
 */

import {
  WIKI_LOG_HEADER,
  isHandoverLogBody,
  isLogEntryPath,
  isNoiseLogBody,
  logBodyKey,
  logEntryCategory,
  logEntryPath,
  logEntryTopic,
  normalizeLogBody,
  parseLogEntries,
  recentContentEntries,
  serializeLogEntry,
} from './wiki-log-entries.js';

const NOISE =
  '(learning) [pattern] [[WorkItem-f7a10fb1-cd0a-46a4-8503-bc7313e3da65]] task:done running→done. timestamp=2026-10-17T01:59:15.178Z. Source: task:done:f7a10fb1-cd0a-46a4-8503-bc7313e3da65.';
const NOISE_WITH_CTX =
  '[gotcha] [[WorkItem-ec0b3714]] task:rejected done_by_worker→rejected. team=team-X mission=m-1 resolver=leo timestamp=2026-10-17T02:18:24.104Z. Source: task:rejected:ec0b3714.';
const REAL = '(gotcha) complete-task rejects a direct queued→done transition; accept-task first.';

function entry(ts: string, caller: string, body: string, sourceType = 'record_learning', ref = 'ref-1'): string {
  return serializeLogEntry({ timestamp: ts, sourceType, caller, ref, body });
}

describe('wiki-log-entries', () => {
  describe('isNoiseLogBody', () => {
    it('flags auto-learning state transitions', () => {
      expect(isNoiseLogBody(NOISE)).toBe(true);
      expect(isNoiseLogBody(NOISE_WITH_CTX)).toBe(true);
    });

    it('flags task-completion stubs and blank bodies', () => {
      expect(isNoiseLogBody('Task completed: shipped the thing')).toBe(true);
      expect(isNoiseLogBody('(learning) Task completed by leo: done')).toBe(true);
      expect(isNoiseLogBody('')).toBe(true);
      expect(isNoiseLogBody(undefined)).toBe(true);
    });

    it('keeps real learnings', () => {
      expect(isNoiseLogBody(REAL)).toBe(false);
      expect(isNoiseLogBody('**Pro pricing** (decision)\n\nPro is $800/mo; quote this.')).toBe(false);
      // A real learning that merely mentions a WorkItem id is not a transition.
      expect(isNoiseLogBody('[[WorkItem-abc]] needed a rebase because main moved; always fetch first.')).toBe(false);
    });
  });

  describe('isHandoverLogBody', () => {
    const HANDOVER = '**Conversation handover — think-tank-atlas-b4e166f6 — task ee745c5f** (fact)\n\nthink-tank-atlas-b4e166f6 finished its conversation on task ee745c5f…';

    it('recognises handover snapshots and nothing else', () => {
      expect(isHandoverLogBody(HANDOVER)).toBe(true);
      expect(isHandoverLogBody('(fact) **Conversation handover — x — task y**')).toBe(true);
      expect(isHandoverLogBody(REAL)).toBe(false);
      expect(isHandoverLogBody('**Pro pricing** (decision)')).toBe(false);
    });

    it('recentContentEntries leaves handovers out unless asked to include them', () => {
      const now = Date.parse('2026-10-17T00:00:00.000Z');
      const raw = entry(new Date(now - 1000).toISOString(), 'a', HANDOVER) + entry(new Date(now - 2000).toISOString(), 'a', REAL);
      expect(recentContentEntries(parseLogEntries(raw), 1, now).map((e) => e.body)).toEqual([REAL]);
      expect(recentContentEntries(parseLogEntries(raw), 1, now, 10, { includeHandovers: true })).toHaveLength(2);
    });
  });

  describe('parseLogEntries / serializeLogEntry', () => {
    it('round-trips entries and drops the preamble', () => {
      const raw = WIKI_LOG_HEADER + entry('2026-10-01T00:00:00.000Z', 'leo', 'first body\nsecond line', 'user_chat', 'chat:1') + entry('2026-10-02T00:00:00.000Z', 'orc', REAL);
      const parsed = parseLogEntries(raw);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toMatchObject({ timestamp: '2026-10-01T00:00:00.000Z', sourceType: 'user_chat', caller: 'leo', ref: 'chat:1', body: 'first body\nsecond line' });
      expect(parsed[0].timestampMs).toBe(Date.parse('2026-10-01T00:00:00.000Z'));
      expect(parsed[1].body).toBe(REAL);
      expect(parsed[1].raw.startsWith('## [2026-10-02T00:00:00.000Z] record_learning | orc')).toBe(true);
    });

    it('parses an entry without a ref line as header + body', () => {
      const raw = '## [2026-10-03T00:00:00.000Z] spec_file | hand\n\nhand-written body\n';
      const [e] = parseLogEntries(raw);
      expect(e.ref).toBe('');
      expect(e.body).toBe('hand-written body');
    });

    it('returns [] for an empty or header-only file', () => {
      expect(parseLogEntries('')).toEqual([]);
      expect(parseLogEntries(WIKI_LOG_HEADER)).toEqual([]);
    });
  });

  describe('normalizeLogBody / logBodyKey', () => {
    it('ignores whitespace, case and trailing punctuation', () => {
      expect(normalizeLogBody('  Hello   World. ')).toBe('hello world');
      expect(logBodyKey('Hello World.')).toBe(logBodyKey('hello   world'));
      expect(logBodyKey('Hello World')).not.toBe(logBodyKey('Hello Worlds'));
    });
  });

  describe('recentContentEntries', () => {
    const now = Date.parse('2026-10-17T00:00:00.000Z');
    const day = 86_400_000;

    it('keeps only recent, non-noise, deduped entries, newest first', () => {
      const raw =
        entry(new Date(now - 40 * day).toISOString(), 'a', 'old but real') +
        entry(new Date(now - 2 * day).toISOString(), 'a', NOISE) +
        entry(new Date(now - 3 * day).toISOString(), 'a', REAL) +
        entry(new Date(now - 1 * day).toISOString(), 'b', REAL) +
        entry(new Date(now - 5 * day).toISOString(), 'c', 'another real one');
      const out = recentContentEntries(parseLogEntries(raw), 30, now);
      expect(out.map((e) => e.caller)).toEqual(['b', 'c']);
    });

    it('honours the limit', () => {
      const raw = [1, 2, 3, 4].map((i) => entry(new Date(now - i * day).toISOString(), 'a', `real ${i}`)).join('');
      expect(recentContentEntries(parseLogEntries(raw), 30, now, 2)).toHaveLength(2);
    });
  });

  describe('paths, categories and topics', () => {
    it('builds and recognises log entry pseudo paths', () => {
      const p = logEntryPath({ timestamp: '2026-10-17T00:00:00.000Z' });
      expect(p).toBe('llm-curated/log.md#2026-10-17T00:00:00.000Z');
      expect(isLogEntryPath(p)).toBe(true);
      expect(isLogEntryPath('llm-curated/log.md')).toBe(false);
      expect(isLogEntryPath('llm-curated/decisions/x.md')).toBe(false);
    });

    it('reads the category prefix', () => {
      expect(logEntryCategory(REAL)).toBe('gotcha');
      expect(logEntryCategory('**Pro pricing** (decision)\n\nbody')).toBe('decision');
      expect(logEntryCategory('[pattern] something')).toBe('pattern');
      expect(logEntryCategory('plain text')).toBe('learning');
    });

    it('derives a topic from a wikilink, a bold lead, or the category', () => {
      expect(logEntryTopic('[[CrewlyCloudUserMetrics]] How to get metrics')).toBe('CrewlyCloudUserMetrics');
      expect(logEntryTopic('(decision) **Pro pricing** is $800')).toBe('Pro pricing');
      expect(logEntryTopic(REAL)).toBe('gotcha');
    });
  });
});
