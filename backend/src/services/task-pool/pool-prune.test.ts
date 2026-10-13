/**
 * Tests for the ongoing task-pool prune (crewly#1108).
 */
import * as os from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PoolStorage } from './pool-storage.js';
import { runPoolPrune, selectPrunable } from './pool-prune.js';
import type { WorkItem } from '../../types/v2/work-item.types.js';
import type { TaskClaim } from '../../types/v2/claim.types.js';

jest.mock('../trace/trace-recorder.js', () => ({
  traceWorkItemCreated: jest.fn(),
  traceWorkItemStatus: jest.fn(),
}));

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-10T12:00:00Z');
const ago = (days: number): string => new Date(NOW - days * DAY).toISOString();

function item(id: string, status: string, daysAgo: number): WorkItem {
  return { id, status, title: id, type: 'delegate', createdAt: ago(daysAgo + 1), completedAt: ago(daysAgo) } as unknown as WorkItem;
}
function claim(id: string, workItemId: string, status: TaskClaim['status'], daysAgo = 1): TaskClaim {
  return { id, workItemId, agentId: 'a', status, claimedAt: ago(daysAgo), leaseExpiresAt: ago(daysAgo), lastHeartbeatAt: ago(daysAgo) } as TaskClaim;
}

describe('selectPrunable', () => {
  it('takes old terminal items and the ended claims on them', () => {
    const items = [item('old-v', 'verified', 20), item('new-v', 'verified', 2), item('q', 'queued', 40), item('old-done', 'done', 8)];
    const claims = [claim('c1', 'old-v', 'released'), claim('c2', 'new-v', 'released'), claim('c3', 'q', 'revoked', 40), claim('c4', 'old-done', 'revoked')];
    const out = selectPrunable(items, claims, NOW);
    expect(out.workItems.map((w) => w.id).sort()).toEqual(['old-done', 'old-v']);
    expect(out.claims.map((c) => c.id).sort()).toEqual(['c1', 'c4']);
  });

  it('never takes active or expiring claims, even on a terminal old item', () => {
    const out = selectPrunable([item('old-v', 'verified', 20)], [claim('a', 'old-v', 'active'), claim('e', 'old-v', 'expiring')], NOW);
    expect(out.workItems).toHaveLength(1);
    expect(out.claims).toEqual([]);
  });

  it('keeps claims on a live item (its attempt history is still read)', () => {
    const out = selectPrunable([item('run', 'running', 30)], [claim('c', 'run', 'revoked', 30)], NOW);
    expect(out.claims).toEqual([]);
  });

  it('takes ended orphan claims whose item is gone', () => {
    const out = selectPrunable([], [claim('o', 'gone', 'released'), claim('oa', 'gone', 'active')], NOW);
    expect(out.claims.map((c) => c.id)).toEqual(['o']);
  });

  it('keeps items with no parseable date', () => {
    const bad = { id: 'x', status: 'verified', createdAt: 'nope' } as unknown as WorkItem;
    expect(selectPrunable([bad], [], NOW).workItems).toEqual([]);
  });

  it('the latest status change counts as the finish time', () => {
    const wi = { ...item('re', 'verified', 20), statusChangedAt: ago(1) } as WorkItem;
    expect(selectPrunable([wi], [], NOW).workItems).toEqual([]);
  });
});

describe('runPoolPrune', () => {
  let dir: string;
  let storage: PoolStorage;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pool-prune-'));
    storage = new PoolStorage({ dataDir: dir });
    for (const wi of [item('old-v', 'verified', 20), item('new-v', 'verified', 2), item('run', 'running', 30)]) await storage.addWorkItem(wi);
    for (const c of [claim('c1', 'old-v', 'released'), claim('c2', 'new-v', 'released'), claim('c3', 'run', 'active')]) await storage.addClaim(c);
    await storage.flush();
  });

  afterEach(async () => {
    await storage.destroy();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('archives first, then shrinks the live pool and its file', async () => {
    const res = await runPoolPrune(storage, { now: new Date(NOW) });
    expect(res).toMatchObject({ items: 1, claims: 1, itemsKept: 2, claimsKept: 2 });
    const live = JSON.parse(await fs.readFile(path.join(dir, 'pool.json'), 'utf-8'));
    expect(live.workItems.map((w: WorkItem) => w.id).sort()).toEqual(['new-v', 'run']);
    expect(live.claims.map((c: TaskClaim) => c.id).sort()).toEqual(['c2', 'c3']);
    const arch = JSON.parse(await fs.readFile(res.archiveFile as string, 'utf-8'));
    expect(arch.workItems.map((w: WorkItem) => w.id)).toEqual(['old-v']);
    expect(arch.claims.map((c: TaskClaim) => c.id)).toEqual(['c1']);
  });

  it('is idempotent and appends to the same day file without duplicating', async () => {
    const first = await runPoolPrune(storage, { now: new Date(NOW) });
    const second = await runPoolPrune(storage, { now: new Date(NOW) });
    expect(second).toMatchObject({ items: 0, claims: 0 });
    // A later run the same day with a newly aged item appends.
    await storage.addWorkItem(item('old-2', 'done', 9));
    await runPoolPrune(storage, { now: new Date(NOW) });
    const arch = JSON.parse(await fs.readFile(first.archiveFile as string, 'utf-8'));
    expect(arch.workItems.map((w: WorkItem) => w.id)).toEqual(['old-v', 'old-2']);
  });

  it('leaves the live pool untouched when the archive cannot be written', async () => {
    // A data dir the archive cannot be created in.
    const failing = { ...storage, getDataDir: () => '/dev/null/nope', getWorkItems: () => storage.getWorkItems(), getClaims: () => storage.getClaims(), removeWorkItems: jest.fn(), removeClaims: jest.fn(), flush: jest.fn() };
    await expect(runPoolPrune(failing as never, { now: new Date(NOW) })).rejects.toThrow();
    expect(failing.removeWorkItems).not.toHaveBeenCalled();
    expect((await storage.getWorkItems()).map((w) => w.id)).toContain('old-v');
  });
});
