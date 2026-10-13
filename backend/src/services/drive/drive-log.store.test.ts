/**
 * Drive mode session logs on the machine: saved as .md + .jsonl, listed newest first, read by file base or
 * session id, names validated (no path escapes), old files pruned.
 */

import { mkdtemp, readdir, rm, utimes, writeFile } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { DriveLogStore } from './drive-log.store.js';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'drive-logs-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const BASE = '2026-10-11-drv_abc12345';

describe('DriveLogStore', () => {
  it('saves both renderings and reads them back by file base or by session id', async () => {
    const store = new DriveLogStore(path.join(dir, 'logs'));
    const file = await store.save(BASE, '# Drive session\n\n## Decisions\n\n- one\n- two\n\n## Timeline\n', '{"type":"session"}\n');
    expect(file).toBe(path.join(dir, 'logs', `${BASE}.md`));
    expect((await readdir(path.join(dir, 'logs'))).sort()).toEqual([`${BASE}.jsonl`, `${BASE}.md`]);
    expect(await store.read(BASE)).toMatch(/^# Drive session/);
    expect(await store.read('drv_abc12345', 'jsonl')).toBe('{"type":"session"}\n');
    expect(await store.read('2026-10-11-drv_nothere99')).toBeNull();
  });

  it('lists newest first with a one-line summary', async () => {
    const store = new DriveLogStore(path.join(dir, 'logs'));
    await store.save('2026-10-09-drv_aaaaaaaa', '# a\n', '{}\n');
    await store.save('2026-10-11-drv_bbbbbbbb', '# b\n\n## Decisions\n\n- x\n\n## Hiccups\n\n- y\n', '{}\n');
    const list = await store.list();
    expect(list.map((e) => e.id)).toEqual(['2026-10-11-drv_bbbbbbbb', '2026-10-09-drv_aaaaaaaa']);
    expect(list[0]).toMatchObject({ date: '2026-10-11', sessionId: 'drv_bbbbbbbb', summary: '1 decision(s), has hiccups' });
    expect(await store.list(1)).toHaveLength(1);
    expect(await new DriveLogStore(path.join(dir, 'missing')).list()).toEqual([]);
  });

  it('refuses names that could leave the directory, and oversized logs', async () => {
    const store = new DriveLogStore(path.join(dir, 'logs'));
    await expect(store.save('../../etc/passwd', 'x', 'y')).rejects.toThrow('Bad Drive log name');
    await expect(store.save(BASE, 'x'.repeat(3 * 1024 * 1024), 'y')).rejects.toThrow('too large');
    expect(await store.read('../../etc/passwd')).toBeNull();
    expect(await store.read('2026-10-11-drv_abc12345/../../x')).toBeNull();
  });

  it('prunes files older than 30 days when a new log is saved', async () => {
    const logs = path.join(dir, 'logs');
    const store = new DriveLogStore(logs);
    await store.save('2026-08-01-drv_oldoldold', 'old', 'old');
    const old = new Date(Date.now() - 31 * 24 * 3600_000);
    await utimes(path.join(logs, '2026-08-01-drv_oldoldold.md'), old, old);
    await utimes(path.join(logs, '2026-08-01-drv_oldoldold.jsonl'), old, old);
    await writeFile(path.join(logs, 'notes.txt'), 'keep');
    await store.save(BASE, 'new', 'new');
    expect((await readdir(logs)).sort()).toEqual([`${BASE}.jsonl`, `${BASE}.md`, 'notes.txt']);
  });
});
