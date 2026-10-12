import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { MoveJournal, isMoveId, listLocalMoveIds, moveDirFor, teamMovesRoot } from './team-move-journal.js';

describe('MoveJournal', () => {
  let home: string;
  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), 'move-journal-'));
  });
  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true });
  });

  it('accepts only path-safe move ids', () => {
    expect(isMoveId('move-abc_12345')).toBe(true);
    for (const bad of ['', 'short', '../../etc/passwd', 'a/b/c/d/e/f/g/h', 'x'.repeat(65), 12, null]) expect(isMoveId(bad)).toBe(false);
    expect(() => moveDirFor('../evil-move-id', home)).toThrow('invalid move id');
    expect(moveDirFor('move-abc_12345', home)).toBe(path.join(teamMovesRoot(home), 'move-abc_12345'));
  });

  it('runs a step once and replays its recorded detail afterwards', async () => {
    const j = new MoveJournal('move-journal-0001', home);
    const fn = jest.fn().mockResolvedValue({ n: 1 });
    expect(await j.run('a', fn)).toEqual({ n: 1 });
    expect(await j.run('a', fn)).toEqual({ n: 1 });
    expect(fn).toHaveBeenCalledTimes(1);
    // A new instance (a restart) reads the same journal from disk.
    const again = new MoveJournal('move-journal-0001', home);
    expect(await again.isDone('a')).toBe(true);
    expect(await again.run('a', fn)).toEqual({ n: 1 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('records a failure, rethrows, and retries the step next time', async () => {
    const j = new MoveJournal('move-journal-0002', home);
    await expect(j.run('b', async () => Promise.reject(new Error('nope')))).rejects.toThrow('nope');
    expect(await j.isDone('b')).toBe(false);
    expect((await j.list()).map((e) => e.state)).toEqual(['started', 'failed']);
    expect(await j.run('b', async () => 'ok')).toBe('ok');
    expect(await j.isDone('b')).toBe(true);
  });

  it('forgets a step on reset', async () => {
    const j = new MoveJournal('move-journal-0003', home);
    await j.run('c', async () => 1);
    await j.reset('c');
    expect(await j.isDone('c')).toBe(false);
  });

  it('merges local state and lists moves', async () => {
    const j = new MoveJournal('move-journal-0004', home, () => '2026-10-12T00:00:00.000Z');
    expect(await j.readState()).toBeNull();
    await j.writeState({ role: 'target', teamId: 't1', teamName: 'CE', action: 'prepare', phase: 'running' });
    const next = await j.writeState({ role: 'target', phase: 'done' });
    expect(next).toMatchObject({ moveId: 'move-journal-0004', teamId: 't1', teamName: 'CE', action: 'prepare', phase: 'done', updatedAt: '2026-10-12T00:00:00.000Z' });
    expect(await listLocalMoveIds(home)).toEqual(['move-journal-0004']);
    expect(await listLocalMoveIds(path.join(home, 'nothing'))).toEqual([]);
  });
});
