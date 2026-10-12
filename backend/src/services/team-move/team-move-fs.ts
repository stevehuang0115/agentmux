/**
 * File helpers of the team move: walking with exclusions, a staging area that
 * records a hash for every file it holds, text sniffing and path rewriting.
 *
 * @module services/team-move/team-move-fs
 */

import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { BACKUP_EXCLUDED_FILE_NAMES, BACKUP_EXCLUDED_FILE_SUFFIXES } from '../backup/backup.types.js';
import type { PackageFileEntry } from './team-move.types.js';

/** Directory names never packaged, at any depth (machine noise and build output). */
export const MOVE_EXCLUDED_DIR_NAMES: ReadonlySet<string> = new Set(['node_modules', 'logs', '.orchestrator-state', '.git', '.DS_Store']);

/** File-name patterns never packaged: backups, temp files, logs, transcripts, shell history. */
const EXCLUDED_NAME_PATTERNS: readonly RegExp[] = [/\.bak(?:[-.].*)?$/, /\.tmp(?:\.|$)/, /\.orig$/, /~$/, /^\.DS_Store$/];

/**
 * Whether a file name is left out of a package.
 *
 * @param name - File name (no directory)
 * @returns True for backups, temp files, logs, JSONL transcripts and shell history
 */
export function isExcludedMoveFile(name: string): boolean {
  if (BACKUP_EXCLUDED_FILE_NAMES.includes(name)) return true;
  if (BACKUP_EXCLUDED_FILE_SUFFIXES.some((suffix) => name.endsWith(suffix))) return true;
  return EXCLUDED_NAME_PATTERNS.some((re) => re.test(name));
}

/** A regular file found by {@link walkFiles}. */
export interface WalkedFile {
  abs: string;
  /** POSIX path relative to the walked root. */
  rel: string;
  size: number;
}

/**
 * Walk the regular files under a directory, skipping excluded names. Symlinks
 * are never followed or packaged.
 *
 * @param root - Directory to walk (a missing one yields nothing)
 * @param extraExcludedDirs - Extra directory names to skip
 * @yields Each file, directories in name order
 */
export async function* walkFiles(root: string, extraExcludedDirs: ReadonlySet<string> = new Set()): AsyncGenerator<WalkedFile> {
  const walk = async function* (absDir: string, relDir: string): AsyncGenerator<WalkedFile> {
    const entries = await fs.readdir(absDir, { withFileTypes: true }).catch(() => []);
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const rel = relDir ? `${relDir}/${e.name}` : e.name;
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (MOVE_EXCLUDED_DIR_NAMES.has(e.name) || extraExcludedDirs.has(e.name)) continue;
        yield* walk(path.join(absDir, e.name), rel);
      } else if (e.isFile() && !isExcludedMoveFile(e.name)) {
        const abs = path.join(absDir, e.name);
        const st = await fs.stat(abs).catch(() => null);
        if (st?.isFile()) yield { abs, rel, size: st.size };
      }
    }
  };
  yield* walk(root, '');
}

/**
 * SHA-256 of a file, streamed.
 *
 * @param file - Absolute path
 * @returns Hex digest
 */
export async function sha256File(file: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(file), async function (source) {
    for await (const chunk of source) hash.update(chunk as Buffer);
  });
  return hash.digest('hex');
}

/**
 * A directory the package is assembled in. Every file written through it is
 * hashed and listed, which becomes the manifest's file list.
 */
export class StagingArea {
  private readonly entries = new Map<string, PackageFileEntry>();

  /** @param root - Absolute staging directory (created when missing) */
  constructor(readonly root: string) {}

  /** Create the staging directory. */
  async init(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
  }

  /**
   * Absolute path of a package path (refusing anything that escapes the root).
   *
   * @param rel - POSIX package path
   * @returns Absolute path
   */
  abs(rel: string): string {
    const target = path.resolve(this.root, ...rel.split('/'));
    if (target !== this.root && !target.startsWith(this.root + path.sep)) throw new Error(`path escapes the package: ${rel}`);
    return target;
  }

  /**
   * Copy a file in, recording its hash.
   *
   * @param source - Absolute source file
   * @param rel - POSIX package path
   * @returns The recorded entry
   */
  async copyIn(source: string, rel: string): Promise<PackageFileEntry> {
    const dest = this.abs(rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    const hash = createHash('sha256');
    let bytes = 0;
    await pipeline(
      createReadStream(source),
      async function* (src) {
        for await (const chunk of src) {
          hash.update(chunk as Buffer);
          bytes += (chunk as Buffer).length;
          yield chunk;
        }
      },
      createWriteStream(dest),
    );
    const entry = { path: rel, sha256: hash.digest('hex'), bytes };
    this.entries.set(rel, entry);
    return entry;
  }

  /**
   * Record a file that was written into the area by someone else (a git
   * bundle written by `git` directly), hashing it as a stream.
   *
   * @param rel - POSIX package path of an existing file
   * @returns The recorded entry
   */
  async adopt(rel: string): Promise<PackageFileEntry> {
    const dest = this.abs(rel);
    const stat = await fs.stat(dest);
    const entry = { path: rel, sha256: await sha256File(dest), bytes: stat.size };
    this.entries.set(rel, entry);
    return entry;
  }

  /**
   * Write a text/JSON file, recording its hash.
   *
   * @param rel - POSIX package path
   * @param content - File content
   * @returns The recorded entry
   */
  async writeText(rel: string, content: string): Promise<PackageFileEntry> {
    const dest = this.abs(rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    const buf = Buffer.from(content, 'utf8');
    await fs.writeFile(dest, buf);
    const entry = { path: rel, sha256: createHash('sha256').update(buf).digest('hex'), bytes: buf.length };
    this.entries.set(rel, entry);
    return entry;
  }

  /**
   * Write raw bytes (patches, binary files), recording their hash.
   *
   * @param rel - POSIX package path
   * @param content - Bytes
   * @returns The recorded entry
   */
  async writeBytes(rel: string, content: Buffer): Promise<PackageFileEntry> {
    const dest = this.abs(rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, content);
    const entry = { path: rel, sha256: createHash('sha256').update(content).digest('hex'), bytes: content.length };
    this.entries.set(rel, entry);
    return entry;
  }

  /**
   * Write a JSON file.
   *
   * @param rel - POSIX package path
   * @param value - Value to serialise
   * @returns The recorded entry
   */
  async writeJson(rel: string, value: unknown): Promise<PackageFileEntry> {
    return this.writeText(rel, JSON.stringify(value, null, 2));
  }

  /**
   * Remove a file again (secret-scan exclusion).
   *
   * @param rel - POSIX package path
   */
  async remove(rel: string): Promise<void> {
    this.entries.delete(rel);
    await fs.rm(this.abs(rel), { force: true });
  }

  /**
   * Whether a package path is in the area.
   *
   * @param rel - POSIX package path
   * @returns True when present
   */
  has(rel: string): boolean {
    return this.entries.has(rel);
  }

  /**
   * Every recorded file, sorted by path.
   *
   * @returns File entries
   */
  files(): PackageFileEntry[] {
    return [...this.entries.values()].sort((a, b) => (a.path < b.path ? -1 : 1));
  }

  /**
   * Total bytes of the recorded files.
   *
   * @returns Sum of sizes
   */
  totalBytes(): number {
    let sum = 0;
    for (const e of this.entries.values()) sum += e.bytes;
    return sum;
  }
}

/** File extensions that are rewritten and scanned as text. */
const TEXT_EXTENSIONS: ReadonlySet<string> = new Set(['.md', '.json', '.txt', '.yaml', '.yml', '.csv', '.tsv', '.html', '.xml', '.toml', '.ini', '.env', '.sh', '.ts', '.js', '.py', '.sql', '.mdx', '.cfg', '.conf']);

/**
 * Whether a path looks like a text file by its extension.
 *
 * @param file - File path or name
 * @returns True for known text extensions and extension-less names
 */
export function hasTextExtension(file: string): boolean {
  const ext = path.extname(file).toLowerCase();
  return ext === '' || TEXT_EXTENSIONS.has(ext);
}

/**
 * Whether a buffer looks like text (no NUL byte in the first 8 KB).
 *
 * @param head - First bytes of a file
 * @returns True when no NUL is found
 */
export function looksLikeText(head: Buffer): boolean {
  const n = Math.min(head.length, 8000);
  for (let i = 0; i < n; i++) if (head[i] === 0) return false;
  return true;
}

/**
 * Replace a path prefix wherever it appears as a path in a text: followed by
 * `/`, a quote, whitespace, end of text or other non-path characters.
 *
 * @param text - Text to rewrite
 * @param from - Source path (no trailing slash)
 * @param to - Target path
 * @returns Rewritten text and the number of replacements
 */
export function rewritePathPrefix(text: string, from: string, to: string): { text: string; count: number } {
  const source = from.replace(/\/+$/, '');
  const dest = to.replace(/\/+$/, '');
  if (!source || source === dest || !text.includes(source)) return { text, count: 0 };
  let count = 0;
  let out = '';
  let index = 0;
  for (;;) {
    const hit = text.indexOf(source, index);
    if (hit < 0) break;
    const before = hit === 0 ? '' : text[hit - 1]!;
    const after = text[hit + source.length] ?? '';
    // Not part of a longer path: the character before is not a path character
    // and the character after does not continue the final segment.
    const startsPath = before === '' || !/[A-Za-z0-9._~-]/.test(before);
    // A full stop ends a sentence, not the folder name, when whitespace or the end follows it.
    const next = text[hit + source.length + 1] ?? '';
    const endsPath = after === '' || !/[A-Za-z0-9._~-]/.test(after) || (after === '.' && (next === '' || /[\s"')\]]/.test(next)));
    out += text.slice(index, hit);
    if (startsPath && endsPath) {
      out += dest;
      count += 1;
    } else {
      out += source;
    }
    index = hit + source.length;
  }
  out += text.slice(index);
  return { text: out, count };
}

/**
 * Turn a name into a folder-safe slug.
 *
 * @param name - Project or team name
 * @returns Lowercase slug of letters, digits, dot, dash and underscore
 */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug.length > 0 ? slug.slice(0, 60) : 'project';
}

/**
 * Whether a path exists.
 *
 * @param target - Absolute path
 * @returns True when it can be stat'ed
 */
export async function pathExists(target: string): Promise<boolean> {
  return fs.stat(target).then(() => true, () => false);
}

/**
 * Write a file atomically (temp file in the same directory, then rename), so a
 * crash never leaves half a file. Accepts bytes, so binaries survive.
 *
 * @param dest - Destination path (its folder is created)
 * @param content - Bytes to write
 */
export async function writeFileAtomic(dest: string, content: Buffer): Promise<void> {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const temp = `${dest}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  try {
    await fs.writeFile(temp, content, { flag: 'wx' });
    await fs.rename(temp, dest);
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => undefined);
    throw error;
  }
}
