/**
 * Automatic cross-machine file hand-off.
 *
 * Agents on different machines cannot open each other's local paths. This
 * service moves the file through Cloud's file-handoff relay (the same one the
 * `send-file` / `receive-file` skills use) so nobody has to paste an
 * instruction by hand:
 *
 *  - Sender: {@link FileHandoffService.attachToMessage} uploads the files an
 *    agent attached (`--file`) or mentioned by path, and appends one compact
 *    marker line per file to the message text.
 *  - Receiver: {@link FileHandoffService.expandInbound} finds the markers in
 *    a delivered message, downloads each file into the project inbox, and
 *    rewrites the marker to the local path.
 *
 * Marker format (readable in Slack): `📎 report.pdf (2.1 MB) · crewly-file:hf_xxx`.
 *
 * @module services/file-handoff/file-handoff.service
 */

import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import { FILE_HANDOFF_CONSTANTS as C } from '../../constants.js';
import { redactSecretsWithCount } from '../../utils/secret-redactor.js';

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

/** The slice of the Apps Cloud client this service calls. */
export interface HandoffApi {
  request<T>(method: string, path: string, opts?: { body?: unknown; agent?: string; asOwner?: boolean; timeoutMs?: number }): Promise<T>;
}

/** Streams a local file to a presigned URL. */
export type PutFileFn = (target: { url: string; headers: Record<string, string> }, file: string, sizeBytes: number, timeoutMs: number) => Promise<void>;
/** Streams a presigned URL to a local file. */
export type GetFileFn = (url: string, dest: string, timeoutMs: number) => Promise<void>;

/** Dependencies (all injectable for tests). */
export interface FileHandoffDeps {
  api: () => HandoffApi;
  /** Directories no file may be read from (Crewly home) */
  crewlyHomes?: () => string[];
  putFile?: PutFileFn;
  getFile?: GetFileFn;
  log?: (level: 'info' | 'warn', message: string, meta?: Record<string, unknown>) => void;
}

/** One file that went (or was meant to go) with a message. */
export interface HandoffAttachment {
  fileName: string;
  sizeBytes: number;
  handoffId: string;
}

/** A file that did not go, with the reason an agent can act on. */
export interface HandoffFailure {
  file: string;
  reason: string;
}

/** Outcome of {@link FileHandoffService.attachToMessage}. */
export interface AttachResult {
  /** The message text with marker lines appended (unchanged when nothing went) */
  content: string;
  attached: HandoffAttachment[];
  failed: HandoffFailure[];
}

/** Input of {@link FileHandoffService.attachToMessage}. */
export interface AttachInput {
  content: string;
  /** Paths the agent named with `--file` (always attempted; failures are reported) */
  explicit?: readonly string[];
  /** Also pick up paths written in the text (only for a room that has a colleague on another machine) */
  auto?: boolean;
  /** The agent's project directory: relative paths resolve here and no file outside it goes */
  projectDir: string;
  /** Agent session the upload is attributed to */
  agent?: string;
}

/** Outcome of {@link FileHandoffService.downloadToInbox}. */
export interface InboxFile {
  path: string;
  fileName: string;
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const MARKER_ID_RE = new RegExp(`${escapeRe(C.MARKER_PREFIX)}(${C.ID_PATTERN})`, 'g');
const MARKER_TOKEN_RE = new RegExp(`(?:${escapeRe(C.MARKER_GLYPH)}[^\\n]*?·\\s*)?${escapeRe(C.MARKER_PREFIX)}(${C.ID_PATTERN})`, 'g');
const KIB = 1024;
const SIZE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;
/** Characters that end a path written in prose */
const PATH_TRAILING_PUNCT = /[.,;:!?)\]}>'"`]+$/;
/** Absolute or `./relative` paths in free text */
const PATH_IN_TEXT_RE = /(?:^|[\s"'`(<\[])((?:\/|\.\/)[^\s"'`)>\]]+)/g;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Human size, e.g. `2.1 MB`.
 *
 * @param bytes - Size in bytes
 * @returns Short size string
 */
export function formatSize(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= KIB && unit < SIZE_UNITS.length - 1) {
    value /= KIB;
    unit += 1;
  }
  const text = unit === 0 || value >= 10 ? String(Math.round(value)) : value.toFixed(1);
  return `${text} ${SIZE_UNITS[unit]}`;
}

/**
 * The marker line for one uploaded file.
 *
 * @param fileName - Name the receiver sees
 * @param sizeBytes - File size
 * @param handoffId - Cloud handoff id
 * @returns `📎 report.pdf (2.1 MB) · crewly-file:hf_xxx`
 */
export function formatMarker(fileName: string, sizeBytes: number, handoffId: string): string {
  const safeName = fileName.replace(/[\r\n]+/g, ' ').trim() || 'file';
  return `${C.MARKER_GLYPH} ${safeName} (${formatSize(sizeBytes)}) · ${C.MARKER_PREFIX}${handoffId}`;
}

/**
 * Handoff ids named by markers in a text, first occurrence order, no repeats.
 *
 * @param text - Message text
 * @returns Handoff ids
 */
export function findMarkerIds(text: string): string[] {
  const ids: string[] = [];
  for (const m of text.matchAll(MARKER_ID_RE)) {
    if (!ids.includes(m[1]!)) ids.push(m[1]!);
  }
  return ids;
}

/**
 * Absolute (`/x/y`) and `./relative` paths written in a text.
 *
 * @param text - Message text
 * @returns Candidate paths in order, without duplicates
 */
export function extractPathCandidates(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(PATH_IN_TEXT_RE)) {
    const p = m[1]!.replace(PATH_TRAILING_PUNCT, '');
    if (p.length > 2 && !found.includes(p)) found.push(p);
  }
  return found;
}

/**
 * Whether a file name or path is one that must never leave the machine
 * (`.env*`, keys, credentials, anything under `.ssh` / `.aws` / `.git`).
 *
 * @param file - File path
 * @returns True for an obvious secret
 */
export function isSecretPath(file: string): boolean {
  const parts = file.split(path.sep).filter(Boolean).map((s) => s.toLowerCase());
  const name = parts[parts.length - 1] ?? '';
  if (C.SECRET_NAME_PATTERNS.some((re) => re.test(name))) return true;
  return parts.slice(0, -1).some((d) => C.SECRET_DIR_NAMES.includes(d));
}

function within(child: string, parent: string): boolean {
  return child === parent || child.startsWith(parent.endsWith(path.sep) ? parent : parent + path.sep);
}

function real(p: string): string | null {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

/** A vetted file, or why it was refused. */
type Vetted = { ok: true; real: string; size: number } | { ok: false; reason: string };

/** A safe local file name (last segment, no leading dots or control characters). */
function safeName(name: string): string {
  // eslint-disable-next-line no-control-regex
  const base = name.replace(/\\/g, '/').split('/').pop()!.replace(/[\u0000-\u001f]/g, '').replace(/^[.\s]+/, '').trim();
  return base || 'file';
}

// ---------------------------------------------------------------------------
// Network (streamed from / to disk, never buffered)
// ---------------------------------------------------------------------------

/** Default {@link PutFileFn}: a streamed `PUT` with an exact Content-Length. */
export const putFileStreamed: PutFileFn = (target, file, sizeBytes, timeoutMs) =>
  new Promise<void>((resolve, reject) => {
    const url = new URL(target.url);
    const lib = url.protocol === 'http:' ? http : https;
    const req = lib.request(url, { method: 'PUT', headers: { ...target.headers, 'Content-Length': String(sizeBytes) }, timeout: timeoutMs }, (res) => {
      res.resume();
      res.on('end', () => (res.statusCode === 200 ? resolve() : reject(new Error(`upload failed (HTTP ${res.statusCode ?? 0})`))));
    });
    req.on('timeout', () => req.destroy(new Error('upload timed out')));
    req.on('error', reject);
    const src = fs.createReadStream(file);
    src.on('error', (e) => req.destroy(e));
    src.pipe(req);
  });

/** Default {@link GetFileFn}: a streamed `GET` written to `dest`. */
export const getFileStreamed: GetFileFn = (url, dest, timeoutMs) =>
  new Promise<void>((resolve, reject) => {
    const target = new URL(url);
    const lib = target.protocol === 'http:' ? http : https;
    const req = lib.get(target, { timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`download failed (HTTP ${res.statusCode ?? 0})`));
        return;
      }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => out.close(() => resolve()));
      out.on('error', reject);
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('download timed out')));
    req.on('error', reject);
  });

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Uploads files for outgoing messages and downloads them for incoming ones.
 */
export class FileHandoffService {
  private readonly putFile: PutFileFn;
  private readonly getFile: GetFileFn;

  constructor(private readonly deps: FileHandoffDeps) {
    this.putFile = deps.putFile ?? putFileStreamed;
    this.getFile = deps.getFile ?? getFileStreamed;
  }

  private log(level: 'info' | 'warn', message: string, meta?: Record<string, unknown>): void {
    this.deps.log?.(level, message, meta);
  }

  private homes(): string[] {
    const configured = this.deps.crewlyHomes?.() ?? [path.join(os.homedir(), '.crewly')];
    return configured.map((h) => real(h) ?? path.resolve(h));
  }

  /**
   * Check a candidate file against every guard.
   *
   * Refuses: missing, symlink, not a regular file, empty, over the cap, outside
   * the project, inside Crewly's home, an obvious secret name, or text that
   * the secret redactor flags.
   *
   * @param candidate - Path as written
   * @param projectDir - The agent's project directory
   * @returns The real path and size, or the reason
   */
  vetFile(candidate: string, projectDir: string): Vetted {
    const abs = path.resolve(projectDir, candidate);
    let st: fs.Stats;
    try {
      st = fs.lstatSync(abs);
    } catch {
      return { ok: false, reason: 'file not found' };
    }
    if (st.isSymbolicLink()) return { ok: false, reason: 'is a symbolic link; pass the real file' };
    if (!st.isFile()) return { ok: false, reason: 'is not a regular file' };
    if (st.size === 0) return { ok: false, reason: 'is empty' };
    if (st.size > C.MAX_FILE_BYTES) return { ok: false, reason: `is larger than the ${formatSize(C.MAX_FILE_BYTES)} limit` };
    const r = real(abs);
    const project = real(projectDir);
    if (!r || !project) return { ok: false, reason: 'cannot resolve the project directory' };
    if (!within(r, project)) return { ok: false, reason: 'is outside your project directory; copy it there first' };
    if (this.homes().some((h) => within(r, h))) return { ok: false, reason: "is inside Crewly's home directory" };
    // Check the path below the project root, so a project that lives under e.g. node_modules still works.
    if (isSecretPath(path.relative(project, r))) return { ok: false, reason: 'looks like a secret (credentials or key file) and is never sent' };
    if (st.size <= C.SECRET_SCAN_MAX_BYTES && looksLikeText(r)) {
      try {
        if (redactSecretsWithCount(fs.readFileSync(r, 'utf8')).count > 0) {
          return { ok: false, reason: 'contains what looks like a secret and is never sent' };
        }
      } catch {
        return { ok: false, reason: 'could not be read' };
      }
    }
    return { ok: true, real: r, size: st.size };
  }

  /**
   * Upload one vetted file as a handoff.
   *
   * @param file - Real path
   * @param sizeBytes - Size
   * @param agent - Agent session to attribute the upload to
   * @returns The handoff
   * @throws When Cloud or the storage upload fails (the half-made handoff is withdrawn)
   */
  async uploadFile(file: string, sizeBytes: number, agent?: string): Promise<HandoffAttachment> {
    const api = this.deps.api();
    const attr = agent ? { agent } : { asOwner: true };
    const fileName = safeName(path.basename(file));
    const created = await api.request<{ handoffId?: string; upload?: { url?: string; headers?: Record<string, string> } }>('POST', '/handoffs', {
      body: { fileName, sizeBytes, contentType: C.DEFAULT_CONTENT_TYPE },
      ...attr,
    });
    const id = created.handoffId;
    const url = created.upload?.url;
    if (!id || !url) throw new Error('Cloud answered without an upload URL');
    try {
      await this.putFile({ url, headers: created.upload?.headers ?? {} }, file, sizeBytes, C.UPLOAD_TIMEOUT_MS);
      await api.request('POST', `/handoffs/${id}/complete`, attr);
    } catch (err) {
      await api.request('DELETE', `/handoffs/${id}`, attr).catch(() => undefined);
      throw err;
    }
    return { fileName, sizeBytes, handoffId: id };
  }

  /**
   * Upload the files of one outgoing message and append their marker lines.
   * Never throws: a file that cannot go is reported in `failed` and the text
   * is still returned so the message can be posted anyway.
   *
   * @param input - Text, explicit files, auto-detect switch, project dir
   * @returns New text plus what went and what did not
   */
  async attachToMessage(input: AttachInput): Promise<AttachResult> {
    const attached: HandoffAttachment[] = [];
    const failed: HandoffFailure[] = [];
    const tried = new Set<string>();

    const attempt = async (candidate: string, explicit: boolean): Promise<void> => {
      const key = path.resolve(input.projectDir, candidate);
      if (tried.has(key)) return;
      tried.add(key);
      if (attached.length >= C.MAX_FILES_PER_MESSAGE) {
        if (explicit) failed.push({ file: candidate, reason: `more than ${C.MAX_FILES_PER_MESSAGE} files in one message` });
        return;
      }
      const vetted = this.vetFile(candidate, input.projectDir);
      if (!vetted.ok) {
        // A path merely mentioned in prose that is not a sendable file is not an error.
        if (explicit) failed.push({ file: candidate, reason: vetted.reason });
        return;
      }
      try {
        attached.push(await this.uploadFile(vetted.real, vetted.size, input.agent));
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.log('warn', 'File handoff upload failed', { file: path.basename(candidate), reason });
        failed.push({ file: candidate, reason });
      }
    };

    for (const f of input.explicit ?? []) await attempt(f, true);
    if (input.auto) {
      for (const f of extractPathCandidates(input.content)) {
        if (attached.length >= C.MAX_FILES_PER_MESSAGE) break;
        await attempt(f, false);
      }
    }

    const lines = attached.map((a) => formatMarker(a.fileName, a.sizeBytes, a.handoffId));
    const content = lines.length > 0 ? `${input.content.replace(/\s+$/, '')}\n${lines.join('\n')}` : input.content;
    return { content, attached, failed };
  }

  /**
   * Download one handoff into `<inboxRoot>/<handoffId>/<fileName>` and
   * acknowledge it (Cloud then deletes its copy).
   *
   * @param handoffId - Id from a marker
   * @param inboxRoot - The inbox folder (`<project data dir>/inbox`)
   * @param agent - Receiving agent session
   * @param timeoutMs - Ceiling for the transfer
   * @returns Where the file is now
   * @throws When the handoff is not ready, the transfer fails, or the size differs
   */
  async downloadToInbox(handoffId: string, inboxRoot: string, agent: string | undefined, timeoutMs: number = C.DOWNLOAD_TIMEOUT_MS): Promise<InboxFile> {
    const api = this.deps.api();
    const attr = agent ? { agent } : { asOwner: true };
    const meta = await api.request<{ status?: string; fileName?: string; sizeBytes?: number; download?: { url?: string } }>('GET', `/handoffs/${handoffId}`, { ...attr, timeoutMs });
    if (meta.status !== 'ready' || !meta.download?.url) throw new Error('the sender has not finished uploading');
    const size = Number(meta.sizeBytes);
    const name = safeName(meta.fileName ?? 'file');
    const dir = path.join(inboxRoot, handoffId);
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, name);
    const part = path.join(dir, `.${handoffId}.part`);
    try {
      await this.getFile(meta.download.url, part, timeoutMs);
      const got = fs.statSync(part).size;
      if (Number.isFinite(size) && got !== size) throw new Error(`size mismatch (got ${got} bytes, expected ${size})`);
      fs.renameSync(part, dest);
    } catch (err) {
      fs.rmSync(part, { force: true });
      throw err;
    }
    await api.request('POST', `/handoffs/${handoffId}/ack`, attr).catch((err: unknown) => {
      this.log('warn', 'File handoff ack failed (Cloud removes it after 24 h)', { handoffId, reason: err instanceof Error ? err.message : String(err) });
    });
    return { path: dest, fileName: name, sizeBytes: fs.statSync(dest).size };
  }

  /**
   * Replace every marker in a delivered message with the local path of the
   * downloaded file (`File from <sender>: <path>`). A file that cannot be
   * fetched in time stays in the text with a note and the manual command.
   * Downloads run in parallel under one overall deadline.
   *
   * @param text - Message text as delivered
   * @param sender - Who sent it (display name)
   * @param inboxRoot - The receiving agent's inbox folder
   * @param agent - Receiving agent session
   * @returns Text with the markers rewritten (unchanged when it has none)
   */
  async expandInbound(text: string, sender: string, inboxRoot: string, agent?: string): Promise<string> {
    const ids = findMarkerIds(text);
    if (ids.length === 0) return text;
    const deadline = Date.now() + C.DOWNLOAD_TOTAL_TIMEOUT_MS;
    const results = new Map<string, string>();
    await Promise.all(
      ids.slice(0, C.MAX_FILES_PER_MESSAGE).map(async (id) => {
        try {
          const budget = Math.max(1, Math.min(C.DOWNLOAD_TIMEOUT_MS, deadline - Date.now()));
          const file = await this.downloadToInbox(id, inboxRoot, agent, budget);
          results.set(id, `File from ${sender}: ${file.path}`);
          this.log('info', 'File handoff received', { handoffId: id, bytes: file.sizeBytes });
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          this.log('warn', 'File handoff download failed', { handoffId: id, reason });
          results.set(id, `File from ${sender} could not be fetched (${reason}). Fetch it yourself: receive-file --id ${id}`);
        }
      }),
    );
    return text.replace(MARKER_TOKEN_RE, (whole, id: string) => results.get(id) ?? whole);
  }
}

/** Whether the first bytes look like text (no NUL byte). */
function looksLikeText(file: string): boolean {
  const probeBytes = 4096;
  let fd: number | null = null;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(probeBytes);
    const n = fs.readSync(fd, buf, 0, probeBytes, 0);
    return !buf.subarray(0, n).includes(0);
  } catch {
    return false;
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}
