/**
 * Tests for WikiQueueDrainService (#1345).
 *
 * @module services/wiki/wiki-queue-drain.service.test
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { WikiQueueDrainService } from './wiki-queue-drain.service.js';
import { WikiQueueService } from './wiki-queue.service.js';
import { WikiIngestService } from './wiki-ingest.service.js';
import { parseLogEntries } from './wiki-log-entries.js';

const SCHEMA = `
vault_scope: project
vault_id: test-project
hardcoded:
  - path: memory/
    frozen: true
    description: "Project memory."
    referenced_by: [skill:remember]
llm_curated:
  - path: llm-curated/
    frozen: false
    seed_subdirs: [decisions]
    llm_can_create_subdirs: true
    lint_may_restructure: true
write_policy:
  canonical: [team-leader, orchestrator]
  proposed_only: [worker]
  schema_writer: [steve]
`;

const DAY = 86_400_000;
const NOISE = '(learning) [pattern] [[WorkItem-x]] task:done running→done. timestamp=2026-10-17T01:59:15.178Z. Source: task:done:x.';

describe('WikiQueueDrainService', () => {
  let root: string;
  let vault: string;
  let queue: WikiQueueService;
  let service: WikiQueueDrainService;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'crewly-drain-test-'));
    vault = path.join(root, 'project', '.crewly', 'wiki');
    await fs.mkdir(path.join(vault, 'llm-curated'), { recursive: true });
    await fs.writeFile(path.join(vault, 'SCHEMA.md'), SCHEMA, 'utf8');
    queue = new WikiQueueService(path.join(root, 'queue'));
    service = new WikiQueueDrainService(queue, new WikiIngestService());
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const add = (content: string, vaultPath = vault, reason = 'worth keeping because it changes how we close WorkItems') =>
    queue.add({ vaultPath, queuedBy: 'crewly-orc', sourceType: 'task_verified', sourceRef: 'WorkItem 123', content, reason });

  it('files aged pending items into the vault log and marks them processed', async () => {
    const item = await add('complete-task rejects a direct queued→done transition; accept-task first.');
    const r = await service.drain({ now: Date.now() + 2 * DAY, pauseMs: 0 });
    expect(r).toMatchObject({ pending: 1, filed: 1, skipped: 0, failed: 0, tooYoung: 0, noVault: 0, deferred: 0 });

    const log = await fs.readFile(path.join(vault, 'llm-curated/log.md'), 'utf8');
    const [entry] = parseLogEntries(log);
    expect(entry.sourceType).toBe('task_verified');
    expect(entry.caller).toBe('crewly-orc');
    expect(entry.ref).toBe('WorkItem 123');
    expect(entry.body).toContain('accept-task first');
    expect(entry.body).toContain('_Why kept (crewly-orc):_ worth keeping');

    const after = await queue.get(item.id);
    expect(after?.status).toBe('processed');
    expect(after?.claimedBy).toBe('system:wiki-queue-drain');
    expect(after?.result).toMatchObject({ ingested: true, targetPath: 'llm-curated/log.md' });
  });

  it('leaves young items for an agent and items without a vault for the sweep', async () => {
    await add('fresh item');
    const orphanVault = path.join(root, 'gone', '.crewly', 'wiki');
    await add('orphan item', orphanVault);
    const r = await service.drain({ now: Date.now() + 2 * DAY, pauseMs: 0, minAgeMs: 10 * DAY });
    // Age is checked before the vault: both are too young for a 10-day minimum.
    expect(r).toMatchObject({ pending: 2, tooYoung: 2, noVault: 0, filed: 0 });
    const r2 = await service.drain({ now: Date.now() + 2 * DAY, pauseMs: 0 });
    expect(r2).toMatchObject({ pending: 2, tooYoung: 0, noVault: 1, filed: 1 });
    expect(existsSync(path.join(vault, 'llm-curated/log.md'))).toBe(true);
    const stats = await queue.getStats(orphanVault);
    expect(stats.pending).toBe(1);
  });

  it('marks content-free items skipped instead of filing them', async () => {
    const item = await add(NOISE);
    const r = await service.drain({ now: Date.now() + 2 * DAY, pauseMs: 0 });
    expect(r).toMatchObject({ filed: 0, skipped: 1 });
    expect((await queue.get(item.id))?.status).toBe('skipped');
    expect(existsSync(path.join(vault, 'llm-curated/log.md'))).toBe(false);
  });

  it('marks a duplicate of an already-filed item skipped', async () => {
    await add('same content twice');
    await add('same content twice');
    const r = await service.drain({ now: Date.now() + 2 * DAY, pauseMs: 0 });
    expect(r).toMatchObject({ filed: 1, skipped: 1 });
    expect(parseLogEntries(await fs.readFile(path.join(vault, 'llm-curated/log.md'), 'utf8'))).toHaveLength(1);
  });

  it('respects the batch cap and defers the rest to the next pass', async () => {
    for (let i = 0; i < 5; i++) await add(`item ${i}`);
    const first = await service.drain({ now: Date.now() + 2 * DAY, pauseMs: 0, limit: 2 });
    expect(first).toMatchObject({ pending: 5, filed: 2, deferred: 3 });
    const second = await service.drain({ now: Date.now() + 2 * DAY, pauseMs: 0, limit: 10 });
    expect(second).toMatchObject({ pending: 3, filed: 3, deferred: 0 });
    expect((await queue.getStats(vault)).processed).toBe(5);
  });

  it('dry run counts without claiming, writing or sweeping', async () => {
    await add('would be filed');
    await add(NOISE);
    const r = await service.drain({ now: Date.now() + 2 * DAY, pauseMs: 0, dryRun: true });
    expect(r).toMatchObject({ dryRun: true, filed: 1, skipped: 1 });
    expect(r.sweep).toBeUndefined();
    expect((await queue.getStats(vault)).pending).toBe(2);
    expect(existsSync(path.join(vault, 'llm-curated/log.md'))).toBe(false);
  });

  it('runs the queue sweep so abandoned claims are released and old items expire', async () => {
    const abandoned = await add('claimed long ago');
    await queue.claim(abandoned.id, 'some-agent');
    const r = await service.drain({ now: Date.now() + 2 * DAY, pauseMs: 0 });
    expect(r.sweep?.releasedClaims).toEqual([abandoned.id]);
    expect((await queue.get(abandoned.id))?.status).toBe('pending');
    const r2 = await service.drain({ now: Date.now() + 40 * DAY, pauseMs: 0 });
    // Filed before the sweep could expire it: filing wins over expiry for a reachable vault.
    expect(r2.filed).toBe(1);
  });
});
