/**
 * Tests for WikiLogRotationService (#1345).
 *
 * @module services/wiki/wiki-log-rotation.service.test
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { WikiLogRotationService, countLogHeaders, readLogTail } from './wiki-log-rotation.service.js';
import { WikiIngestService } from './wiki-ingest.service.js';
import { WIKI_LOG_HEADER, parseLogEntries, serializeLogEntry } from './wiki-log-entries.js';

const NOW = Date.parse('2026-10-17T12:00:00.000Z');
const DAY = 86_400_000;
const NOISE = '(learning) [pattern] [[WorkItem-x]] task:done running→done. timestamp=2026-10-17T01:59:15.178Z. Source: task:done:x.';

function entry(ageDays: number, body: string, caller = 'leo'): string {
  return serializeLogEntry({ timestamp: new Date(NOW - ageDays * DAY).toISOString(), sourceType: 'record_learning', caller, ref: `ref-${ageDays}`, body });
}

describe('WikiLogRotationService', () => {
  let vault: string;
  let service: WikiLogRotationService;
  let ingest: WikiIngestService;

  beforeEach(async () => {
    vault = await fs.mkdtemp(path.join(os.tmpdir(), 'crewly-rotate-test-'));
    await fs.mkdir(path.join(vault, 'llm-curated'), { recursive: true });
    ingest = new WikiIngestService();
    service = new WikiLogRotationService(ingest);
  });

  afterEach(async () => {
    await fs.rm(vault, { recursive: true, force: true });
  });

  const logPath = () => path.join(vault, 'llm-curated/log.md');

  it('reports no_log when the vault has no log', async () => {
    const r = await service.rotate(vault, { now: NOW });
    expect(r).toMatchObject({ rotated: false, reason: 'no_log' });
  });

  it('leaves a log under both caps alone', async () => {
    await fs.writeFile(logPath(), WIKI_LOG_HEADER + entry(1, 'real one') + entry(2, 'real two'), 'utf8');
    const r = await service.rotate(vault, { now: NOW });
    expect(r).toMatchObject({ rotated: false, reason: 'under_caps', entries: 2 });
    expect(existsSync(path.join(vault, 'llm-curated/log-archive'))).toBe(false);
  });

  it('rotates by entry count: archives as-is and carries forward recent non-noise deduped entries', async () => {
    const raw =
      WIKI_LOG_HEADER +
      entry(45, 'too old to carry') +
      entry(10, 'kept lesson') +
      entry(9, NOISE) +
      entry(8, 'kept lesson') + // duplicate body → one copy carried
      entry(1, NOISE) +
      entry(0.5, 'newest lesson');
    await fs.writeFile(logPath(), raw, 'utf8');

    const r = await service.rotate(vault, { now: NOW, maxEntries: 3 });
    expect(r.rotated).toBe(true);
    expect(r.entries).toBe(6);
    expect(r.carried).toBe(2);
    expect(r.archivePath).toBe('llm-curated/log-archive/log-2026-10-17.md');

    const archived = await fs.readFile(path.join(vault, r.archivePath!), 'utf8');
    expect(archived).toBe(raw); // byte-for-byte, nothing dropped
    const fresh = await fs.readFile(logPath(), 'utf8');
    expect(fresh.startsWith(WIKI_LOG_HEADER)).toBe(true);
    expect(fresh).toContain('rotated 2026-10-17T12:00:00.000Z: 6 entries archived');
    const entries = parseLogEntries(fresh);
    expect(entries.map((e) => e.body)).toEqual(['kept lesson', 'newest lesson']); // oldest first, no noise, no 45-day-old
  });

  it('carries handover snapshots forward (an agent may be pointed at one)', async () => {
    await fs.writeFile(logPath(), WIKI_LOG_HEADER + entry(1, '**Conversation handover — leo — task t1** (fact)\n\nleo finished its conversation.') + entry(2, 'a lesson'), 'utf8');
    const r = await service.rotate(vault, { now: NOW, maxEntries: 1 });
    expect(r.carried).toBe(2);
    expect(await fs.readFile(logPath(), 'utf8')).toContain('Conversation handover');
  });

  it('rotates by size and suffixes a second archive on the same day', async () => {
    await fs.writeFile(logPath(), WIKI_LOG_HEADER + entry(1, 'x'.repeat(2000)), 'utf8');
    const first = await service.rotate(vault, { now: NOW, maxBytes: 100 });
    expect(first.rotated).toBe(true);
    expect(first.archivePath).toBe('llm-curated/log-archive/log-2026-10-17.md');
    await fs.writeFile(logPath(), WIKI_LOG_HEADER + entry(1, 'y'.repeat(2000)), 'utf8');
    const second = await service.rotate(vault, { now: NOW, maxBytes: 100 });
    expect(second.archivePath).toBe('llm-curated/log-archive/log-2026-10-17-2.md');
    expect(existsSync(path.join(vault, first.archivePath!))).toBe(true);
    expect(existsSync(path.join(vault, second.archivePath!))).toBe(true);
  });

  it('dry run reports the plan and writes nothing', async () => {
    const raw = WIKI_LOG_HEADER + entry(1, 'a') + entry(2, 'b');
    await fs.writeFile(logPath(), raw, 'utf8');
    const r = await service.rotate(vault, { now: NOW, maxEntries: 1, dryRun: true });
    expect(r).toMatchObject({ rotated: true, dryRun: true, carried: 2, archivePath: 'llm-curated/log-archive/log-2026-10-17.md' });
    expect(await fs.readFile(logPath(), 'utf8')).toBe(raw);
    expect(existsSync(path.join(vault, 'llm-curated/log-archive'))).toBe(false);
  });

  it('after a rotation the ingest dedupe set is reset so a carried body can be appended again later', async () => {
    const forget = jest.spyOn(ingest, 'forgetRecentBodies');
    await fs.writeFile(logPath(), WIKI_LOG_HEADER + entry(1, 'a') + entry(2, 'b'), 'utf8');
    await service.rotate(vault, { now: NOW, maxEntries: 1 });
    expect(forget).toHaveBeenCalledWith(logPath());
  });

  it('rotateAll never throws for a broken vault and reports the others', async () => {
    const other = await fs.mkdtemp(path.join(os.tmpdir(), 'crewly-rotate-test-'));
    try {
      await fs.writeFile(logPath(), WIKI_LOG_HEADER + entry(1, 'a'), 'utf8');
      const results = await service.rotateAll([vault, path.join(other, 'missing')], { now: NOW });
      expect(results).toHaveLength(2);
      expect(results[0].reason).toBe('under_caps');
      expect(results[1].reason).toBe('no_log');
    } finally {
      await fs.rm(other, { recursive: true, force: true });
    }
  });

  describe('streaming rotation of a very large log (crewly#1353)', () => {
    it('counts entries by streaming and carries recent entries from the tail', async () => {
      // 60 old entries then 5 recent ones; the stream threshold is tiny so this log counts as "very large".
      let raw = WIKI_LOG_HEADER;
      for (let i = 0; i < 60; i++) raw += entry(100 + i, `old ${i} ` + 'z'.repeat(300));
      for (let i = 1; i <= 5; i++) raw += entry(i, `recent ${i}`);
      await fs.writeFile(logPath(), raw, 'utf8');
      const size = (await fs.stat(logPath())).size;
      const r = await service.rotate(vault, { now: NOW, streamBytes: 1024, tailBytes: 2048 });
      expect(r).toMatchObject({ rotated: true, streamed: true, bytes: size, entries: 65, carried: 5 });
      const fresh = parseLogEntries(await fs.readFile(logPath(), 'utf8'));
      expect(fresh.map((e) => e.body)).toEqual(['recent 5', 'recent 4', 'recent 3', 'recent 2', 'recent 1']);
      expect(await fs.readFile(path.join(vault, r.archivePath!), 'utf8')).toBe(raw);
    });

    it('countLogHeaders matches the parser across chunk boundaries and readLogTail starts at an entry header', async () => {
      let raw = WIKI_LOG_HEADER;
      for (let i = 0; i < 40; i++) raw += entry(i, `body ${i} ` + 'q'.repeat(50) + '\n## not a header line\nmore');
      await fs.writeFile(logPath(), raw, 'utf8');
      expect(await countLogHeaders(logPath())).toBe(parseLogEntries(raw).length);
      const size = (await fs.stat(logPath())).size;
      const tail = await readLogTail(logPath(), size, 700);
      expect(tail.startsWith('## [')).toBe(true);
      expect(parseLogEntries(tail).length).toBeGreaterThan(0);
      expect(await readLogTail(logPath(), size, size + 10)).toBe(raw);
      expect(await readLogTail(logPath(), size, 3)).toBe('');
    });
  });
});
