import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { StagingArea, isExcludedMoveFile, rewritePathPrefix, slugify, walkFiles, writeFileAtomic } from './team-move-fs.js';

describe('team-move-fs', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'move-fs-'));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  describe('rewritePathPrefix', () => {
    it('replaces whole paths only', () => {
      const r = rewritePathPrefix('a /src/app/x.ts, /src/app. /src/app-v2/y "/src/app" /src/apple', '/src/app', '/new/app');
      expect(r.text).toBe('a /new/app/x.ts, /new/app. /src/app-v2/y "/new/app" /src/apple');
      expect(r.count).toBe(3);
    });
    it('keeps a path that continues after a dot', () => {
      expect(rewritePathPrefix('/src/app.bak and /src/app.', '/src/app', '/n').text).toBe('/src/app.bak and /n.');
    });
    it('does nothing for equal paths or missing text', () => {
      expect(rewritePathPrefix('abc', '/a', '/a').count).toBe(0);
      expect(rewritePathPrefix('abc', '/zzz', '/b').text).toBe('abc');
    });
    it('does not match inside a longer path', () => {
      expect(rewritePathPrefix('/home/x/src/app/file', '/src/app', '/n').count).toBe(0);
    });
  });

  it('excludes backups, temp files, logs and transcripts', () => {
    for (const name of ['a.bak', 'a.json.bak-2026', 'x.tmp.123', 'a.log', 'chat.jsonl', '.DS_Store', '.zsh_history']) expect(isExcludedMoveFile(name)).toBe(true);
    for (const name of ['a.md', 'config.json', 'memory.json']) expect(isExcludedMoveFile(name)).toBe(false);
  });

  it('walks files in name order and skips links, node_modules and logs', async () => {
    await fs.mkdir(path.join(dir, 'b', 'node_modules'), { recursive: true });
    await fs.mkdir(path.join(dir, 'logs'), { recursive: true });
    await fs.writeFile(path.join(dir, 'b', 'node_modules', 'x.js'), 'x');
    await fs.writeFile(path.join(dir, 'logs', 'a.txt'), 'x');
    await fs.writeFile(path.join(dir, 'b', 'two.md'), '2');
    await fs.writeFile(path.join(dir, 'a.md'), '1');
    await fs.symlink(path.join(dir, 'a.md'), path.join(dir, 'link.md'));
    const seen: string[] = [];
    for await (const f of walkFiles(dir)) seen.push(f.rel);
    expect(seen).toEqual(['a.md', 'b/two.md']);
    const none: string[] = [];
    for await (const f of walkFiles(path.join(dir, 'missing'))) none.push(f.rel);
    expect(none).toEqual([]);
  });

  it('stages files with hashes and refuses paths that escape', async () => {
    const src = path.join(dir, 'src.txt');
    await fs.writeFile(src, 'hello');
    const staging = new StagingArea(path.join(dir, 'stage'));
    await staging.init();
    const entry = await staging.copyIn(src, 'a/b.txt');
    expect(entry).toEqual({ path: 'a/b.txt', sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824', bytes: 5 });
    await staging.writeJson('x.json', { a: 1 });
    expect(staging.files().map((f) => f.path)).toEqual(['a/b.txt', 'x.json']);
    expect(staging.totalBytes()).toBeGreaterThan(5);
    await staging.remove('a/b.txt');
    expect(staging.has('a/b.txt')).toBe(false);
    expect(() => staging.abs('../evil')).toThrow(/escapes/);
  });

  it('writes atomically, creating folders and leaving no temp file', async () => {
    const dest = path.join(dir, 'deep', 'f.bin');
    await writeFileAtomic(dest, Buffer.from([0, 1, 2]));
    expect([...(await fs.readFile(dest))]).toEqual([0, 1, 2]);
    expect(await fs.readdir(path.join(dir, 'deep'))).toEqual(['f.bin']);
  });

  it('makes folder-safe slugs', () => {
    expect(slugify('Movers App!')).toBe('movers-app');
    expect(slugify('***')).toBe('project');
  });
});
