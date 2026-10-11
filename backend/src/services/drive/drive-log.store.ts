/**
 * Drive mode session logs on this machine (specs/2026-10-09-drive-mode-v3.md §10).
 *
 * Crewly Cloud keeps every Drive session's log for 30 days and pushes a copy
 * here (`op:'log'`), so a local Claude Code session can read what was said,
 * what was presented, what the owner decided and what went wrong:
 *
 *   ~/.crewly/drive-logs/<YYYY-MM-DD>-<sessionId>.md      for people and agents
 *   ~/.crewly/drive-logs/<YYYY-MM-DD>-<sessionId>.jsonl   one JSON object per event
 *
 * Files older than {@link DRIVE_CONSTANTS.LOG_KEEP_MS} are deleted when a new
 * one is saved. Names are validated: nothing outside the directory is ever
 * read or written.
 *
 * @module services/drive/drive-log.store
 */

import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import * as path from 'path';
import { DRIVE_CONSTANTS as C } from '../../constants.js';
import { getCrewlyHomePath } from '../core/crewly-home.utils.js';

/** `2026-10-11-drv_abc123` */
export const DRIVE_LOG_BASE_PATTERN = /^\d{4}-\d{2}-\d{2}-drv_[A-Za-z0-9_-]{8,64}$/;

/** One log in the list. */
export interface DriveLogEntry {
  /** File base name: `<date>-<sessionId>` */
  id: string;
  date: string;
  sessionId: string;
  /** ISO time the file was written */
  savedAt: string;
  bytes: number;
  /** First lines of the markdown: decisions and hiccups counts */
  summary?: string;
}

/** Reads and writes the log files. */
export class DriveLogStore {
  /**
   * @param dir - Directory (default `~/.crewly/drive-logs`)
   * @param now - Clock (ms; tests)
   */
  constructor(
    private readonly dir: string = path.join(getCrewlyHomePath(), C.LOG_DIRNAME),
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Save a log (both renderings), replacing an earlier copy, and prune old ones.
   *
   * @param base - `<date>-<sessionId>`
   * @param markdown - Markdown rendering
   * @param jsonl - JSON lines rendering
   * @returns Where the markdown file is
   * @throws Error for a bad name or an oversized log
   */
  async save(base: string, markdown: string, jsonl: string): Promise<string> {
    if (!DRIVE_LOG_BASE_PATTERN.test(base)) throw new Error('Bad Drive log name.');
    if (Buffer.byteLength(markdown) > C.LOG_MAX_BYTES || Buffer.byteLength(jsonl) > C.LOG_MAX_BYTES) throw new Error('Drive log too large.');
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    const md = path.join(this.dir, `${base}.md`);
    await writeFile(md, markdown, { mode: 0o600 });
    await writeFile(path.join(this.dir, `${base}.jsonl`), jsonl, { mode: 0o600 });
    await this.prune().catch(() => undefined);
    return md;
  }

  /**
   * Recent logs, newest first.
   *
   * @param limit - How many (default {@link DRIVE_CONSTANTS.LOG_LIST_DEFAULT})
   * @returns Entries
   */
  async list(limit: number = C.LOG_LIST_DEFAULT): Promise<DriveLogEntry[]> {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch {
      return [];
    }
    const bases = names.filter((n) => n.endsWith('.md') && DRIVE_LOG_BASE_PATTERN.test(n.slice(0, -3))).map((n) => n.slice(0, -3)).sort().reverse();
    const out: DriveLogEntry[] = [];
    for (const id of bases.slice(0, Math.min(Math.max(1, limit), C.LOG_LIST_MAX))) {
      const file = path.join(this.dir, `${id}.md`);
      const st = await stat(file).catch(() => null);
      if (!st) continue;
      const head = (await readFile(file, 'utf8').catch(() => '')).slice(0, 4000);
      const decisions = (/## Decisions\n\n([\s\S]*?)\n\n/.exec(head)?.[1] ?? '').split('\n').filter(Boolean).length;
      const hiccups = /^## Hiccups/m.test(head);
      out.push({
        id,
        date: id.slice(0, 10),
        sessionId: id.slice(11),
        savedAt: new Date(st.mtimeMs).toISOString(),
        bytes: st.size,
        ...(decisions || hiccups ? { summary: `${decisions} decision(s)${hiccups ? ', has hiccups' : ''}` } : {}),
      });
    }
    return out;
  }

  /**
   * One log.
   *
   * @param id - File base name (or just the session id)
   * @param format - `md` (default) or `jsonl`
   * @returns File content, or null when there is none
   */
  async read(id: string, format: 'md' | 'jsonl' = 'md'): Promise<string | null> {
    const base = await this.resolve(id);
    if (!base) return null;
    return readFile(path.join(this.dir, `${base}.${format}`), 'utf8').catch(() => null);
  }

  /** The file base for an id or a bare session id; null when unknown or malformed. */
  private async resolve(id: string): Promise<string | null> {
    if (DRIVE_LOG_BASE_PATTERN.test(id)) return id;
    if (!/^drv_[A-Za-z0-9_-]{8,64}$/.test(id)) return null;
    return (await this.list(C.LOG_LIST_MAX)).find((e) => e.sessionId === id)?.id ?? null;
  }

  private async prune(): Promise<void> {
    for (const name of await readdir(this.dir)) {
      if (!/\.(md|jsonl)$/.test(name)) continue;
      const file = path.join(this.dir, name);
      const st = await stat(file).catch(() => null);
      if (st && this.now() - st.mtimeMs > C.LOG_KEEP_MS) await unlink(file).catch(() => undefined);
    }
  }
}

let instance: DriveLogStore | null = null;

/**
 * The process-wide store.
 *
 * @returns Store
 */
export function getDriveLogStore(): DriveLogStore {
  return (instance ??= new DriveLogStore());
}

/**
 * Replace the store (tests).
 *
 * @param store - Store or null
 */
export function setDriveLogStore(store: DriveLogStore | null): void {
  instance = store;
}
