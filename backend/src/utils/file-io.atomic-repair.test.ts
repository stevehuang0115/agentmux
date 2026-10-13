/**
 * Tests for atomic writes (mode, concurrency) and the lenient/repairing JSON read.
 *
 * @module utils/file-io.atomic-repair.test
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  atomicWriteFile,
  atomicWriteFileSync,
  atomicWriteJson,
  decodeFirstJsonObject,
  readJsonObjectWithRepairSync,
} from './file-io.utils.js';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-io-atomic-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const validate = (d: unknown): string | null =>
  typeof d === 'object' && d !== null && typeof (d as { token?: unknown }).token === 'string' ? null : 'missing token';

describe('atomic writes', () => {
  it('writes with the requested mode and leaves no temp files', async () => {
    const f = path.join(dir, 'a.json');
    await atomicWriteJson(f, { a: 1 }, { mode: 0o600 });
    atomicWriteFileSync(path.join(dir, 'b.json'), '{}', { mode: 0o600 });
    expect(fs.statSync(f).mode & 0o777).toBe(0o600);
    expect(fs.statSync(path.join(dir, 'b.json')).mode & 0o777).toBe(0o600);
    expect(fs.readdirSync(dir).sort()).toEqual(['a.json', 'b.json']);
  });

  it('tightens the mode of an existing world-readable file', async () => {
    const f = path.join(dir, 'c.json');
    fs.writeFileSync(f, 'old', { mode: 0o644 });
    await atomicWriteFile(f, 'new', { mode: 0o600 });
    expect(fs.statSync(f).mode & 0o777).toBe(0o600);
  });

  it('concurrent writers of different lengths never leave a stale tail (the 2026-10-11 corruption)', async () => {
    const f = path.join(dir, 'cfg.json');
    const long = (i: number) => JSON.stringify({ token: 'x'.repeat(400 + i), relay: 'y'.repeat(900) });
    const short = (i: number) => JSON.stringify({ token: 's'.repeat(10 + i) });
    const writes: Promise<void>[] = [];
    for (let i = 0; i < 40; i++) writes.push(atomicWriteFile(f, i % 2 ? long(i) : short(i)));
    await Promise.all(writes);
    // Whatever order won, the file is exactly one complete payload.
    const raw = fs.readFileSync(f, 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(raw).toBe(39 % 2 ? long(39) : short(39));
    expect(fs.readdirSync(dir)).toEqual(['cfg.json']);
  });

  it('a failed write leaves the destination untouched and no temp file', async () => {
    const f = path.join(dir, 'd.json');
    fs.writeFileSync(f, 'keep');
    await expect(atomicWriteFile(path.join(dir, 'missing-dir', 'd.json'), 'x')).rejects.toThrow();
    expect(fs.readFileSync(f, 'utf-8')).toBe('keep');
    expect(fs.readdirSync(dir)).toEqual(['d.json']);
  });
});

describe('decodeFirstJsonObject', () => {
  it('decodes the first object and counts the trailing bytes', () => {
    const r = decodeFirstJsonObject('{"a":"}\\"{","b":{"c":1}}Ky1z"\n}');
    expect(r?.value).toEqual({ a: '}"{', b: { c: 1 } });
    expect(r?.trailingChars).toBeGreaterThan(0);
  });

  it('returns null for truncated, non-object or empty input', () => {
    expect(decodeFirstJsonObject('{"a":1')).toBeNull();
    expect(decodeFirstJsonObject('[1,2]')).toBeNull();
    expect(decodeFirstJsonObject('   ')).toBeNull();
  });
});

describe('readJsonObjectWithRepairSync', () => {
  it('reports a missing file', () => {
    expect(readJsonObjectWithRepairSync(path.join(dir, 'nope.json'), { validate })).toEqual({ status: 'missing' });
  });

  it('reads a good file without touching it', () => {
    const f = path.join(dir, 'ok.json');
    fs.writeFileSync(f, '{"token":"t"}');
    expect(readJsonObjectWithRepairSync(f, { validate })).toEqual({ status: 'ok', data: { token: 't' }, repaired: false });
    expect(fs.readFileSync(f, 'utf-8')).toBe('{"token":"t"}');
  });

  it('repairs a valid object followed by a stale tail, atomically, with a WARN', () => {
    const f = path.join(dir, 'tail.json');
    const good = JSON.stringify({ token: 'abc', tier: 'pro' }, null, 2);
    fs.writeFileSync(f, `${good}Ky1zMzyf1B8bLH0W5I"\n}`, { mode: 0o600 });
    const warn = jest.fn();
    const r = readJsonObjectWithRepairSync<{ token: string }>(f, { validate, logger: { warn }, mode: 0o600 });
    expect(r).toEqual({ status: 'ok', data: { token: 'abc', tier: 'pro' }, repaired: true });
    expect(JSON.parse(fs.readFileSync(f, 'utf-8'))).toEqual({ token: 'abc', tier: 'pro' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(fs.readdirSync(dir)).toEqual(['tail.json']);
    // Second read is a plain good read.
    expect(readJsonObjectWithRepairSync(f, { validate })).toMatchObject({ status: 'ok', repaired: false });
  });

  it('does not repair when the first object fails validation; keeps one backup', () => {
    const f = path.join(dir, 'bad.json');
    fs.writeFileSync(f, '{"other":1}garbage');
    const r1 = readJsonObjectWithRepairSync(f, { validate });
    const r2 = readJsonObjectWithRepairSync(f, { validate });
    expect(r1.status).toBe('damaged');
    expect(r2.status).toBe('damaged');
    const backups = fs.readdirSync(dir).filter((n) => n.includes('.corrupt-'));
    expect(backups).toHaveLength(1);
    expect(fs.readFileSync(f, 'utf-8')).toBe('{"other":1}garbage');
    expect(fs.readFileSync(path.join(dir, backups[0]!), 'utf-8')).toBe('{"other":1}garbage');
  });

  it('reports a truncated file as damaged', () => {
    const f = path.join(dir, 'trunc.json');
    fs.writeFileSync(f, '{"token":"a');
    expect(readJsonObjectWithRepairSync(f, { validate })).toMatchObject({ status: 'damaged' });
  });
});
