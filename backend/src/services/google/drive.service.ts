/**
 * DriveService — Google Drive over the owner's Workspace grant.
 *
 * New Drive grants carry `drive.file` only (no CASA for Drive, owner
 * decision 2026-10-15), so the Drive API — search, metadata, export,
 * download — reaches only files Crewly created or the owner opened with
 * Crewly. Older grants may still hold `drive.readonly` / `drive` and reach
 * everything. Google-native files (Docs / Sheets / Slides) are read through
 * `export` as text / CSV; when Drive refuses one, `readContent` falls back to
 * the Docs / Sheets / Slides API (`documents` / `spreadsheets` /
 * `presentations.readonly`), which reads any file the owner can see.
 *
 * @module services/google/drive.service
 */

import { randomBytes } from 'crypto';
import { GOOGLE_WORKSPACE_CONSTANTS } from '../../constants.js';
import { GoogleWorkspaceError } from './google-workspace-token.service.js';
import { buildGoogleUrl, googleRequest, type GoogleApiDeps } from './google-api.client.js';
import { clampMax } from './gmail.service.js';
import type { DocText } from './docs.service.js';
import type { SheetValues, SpreadsheetInfo } from './sheets.service.js';
import type { PresentationText } from './slides.service.js';

/** Google-native file kinds `readContent` can read without the Drive API. */
export type NativeKind = 'document' | 'spreadsheet' | 'presentation';

/** A file id, plus the native kind when the caller passed a typed URL. */
export interface DriveRef {
  id: string;
  kind?: NativeKind;
}

/**
 * Per-kind readers used when Drive refuses a Google-native file. Structural
 * so this module need not import the services (they import `requireId` from it).
 */
export interface NativeReaders {
  docs?: { read(id: string): Promise<DocText> };
  sheets?: { info(id: string): Promise<SpreadsheetInfo>; read(id: string, range?: string): Promise<SheetValues> };
  slides?: { read(id: string): Promise<PresentationText> };
}

/** Owner-facing text for a file the Drive API cannot reach under `drive.file`. */
export const DRIVE_NOT_ACCESSIBLE_MESSAGE =
  'Crewly can open only Drive files it created or that you opened with Crewly. For a Google Doc, Sheet or Slides link use docs-read / sheets-read / slides-read. For another file, ask the owner to upload it.';

/** MIME type of each native kind. */
const NATIVE_MIME: Record<NativeKind, string> = {
  document: 'application/vnd.google-apps.document',
  spreadsheet: 'application/vnd.google-apps.spreadsheet',
  presentation: 'application/vnd.google-apps.presentation',
};

/** URL path segment that names each native kind (`docs.google.com/<segment>/d/<id>`). */
const KIND_BY_PATH: Record<string, NativeKind> = {
  document: 'document',
  spreadsheets: 'spreadsheet',
  presentation: 'presentation',
};

/** Order tried when the kind of a refused id is unknown. */
const NATIVE_PROBE_ORDER: NativeKind[] = ['document', 'spreadsheet', 'presentation'];

/** Drive file metadata (the fields Crewly asks for). */
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: number;
  webViewLink?: string;
  owners?: string[];
  parents?: string[];
}

/** Search input. */
export interface DriveSearchInput {
  /** Free text; matched against name and full text. Empty = most recent files. */
  query?: string;
  /** Restrict to a MIME type (e.g. `application/vnd.google-apps.spreadsheet`). */
  mimeType?: string;
  /** Restrict to a folder id. */
  folderId?: string;
  max?: number;
}

/** What `readContent` returns. */
export interface DriveContent {
  file: DriveFile;
  /** MIME type of `content` (`text/plain`, `text/csv`, or the file's own). */
  contentType: string;
  /** UTF-8 text for text-like files; base64 for binary files. */
  content: string;
  encoding: 'utf8' | 'base64';
  bytes: number;
}

/** Upload input. */
export interface DriveUploadInput {
  name: string;
  mimeType?: string;
  /** UTF-8 text, or base64 when `encoding` is `base64`. */
  content: string;
  encoding?: 'utf8' | 'base64';
  folderId?: string;
  /** Convert to the Google-native type (`application/vnd.google-apps.document` …) on upload. */
  convertTo?: string;
}

interface DriveWireFile {
  id?: string;
  name?: string;
  mimeType?: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  owners?: Array<{ emailAddress?: string }>;
  parents?: string[];
}

const FILE_FIELDS = 'id,name,mimeType,modifiedTime,size,webViewLink,owners(emailAddress),parents';

/**
 * Trim a Drive file resource to {@link DriveFile}.
 *
 * @param wire - Google's file resource
 * @returns The trimmed file
 */
export function toDriveFile(wire: DriveWireFile): DriveFile {
  return {
    id: wire.id ?? '',
    name: wire.name ?? '',
    mimeType: wire.mimeType ?? '',
    ...(wire.modifiedTime ? { modifiedTime: wire.modifiedTime } : {}),
    ...(wire.size ? { size: Number(wire.size) } : {}),
    ...(wire.webViewLink ? { webViewLink: wire.webViewLink } : {}),
    ...(wire.owners?.length ? { owners: wire.owners.map((o) => o.emailAddress ?? '').filter(Boolean) } : {}),
    ...(wire.parents?.length ? { parents: wire.parents } : {}),
  };
}

/**
 * Escape a value for a Drive `q` string literal.
 *
 * @param value - Raw text
 * @returns Escaped text (backslashes and single quotes)
 */
export function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Build the Drive `q` expression for a search.
 *
 * @param input - Search input
 * @returns The `q` string
 */
export function buildDriveQuery(input: DriveSearchInput): string {
  const terms: string[] = ['trashed = false'];
  const text = (input.query ?? '').trim();
  if (text) {
    const escaped = escapeDriveQuery(text);
    terms.push(`(name contains '${escaped}' or fullText contains '${escaped}')`);
  }
  if (input.mimeType?.trim()) terms.push(`mimeType = '${escapeDriveQuery(input.mimeType.trim())}'`);
  if (input.folderId?.trim()) terms.push(`'${escapeDriveQuery(input.folderId.trim())}' in parents`);
  return terms.join(' and ');
}

/**
 * Whether a MIME type is something an agent can read as text.
 *
 * @param mimeType - MIME type
 * @returns True for text/*, JSON, XML, CSV and friends
 */
export function isTextMime(mimeType: string): boolean {
  return /^text\//.test(mimeType) || /\b(json|xml|csv|javascript|yaml|markdown)\b/.test(mimeType);
}

/**
 * Drive: search, metadata, content, upload.
 *
 * @example
 * ```ts
 * const drive = new DriveService({ tokens });
 * const hits = await drive.search({ query: 'Q3 plan' });
 * ```
 */
export class DriveService {
  private readonly deps: GoogleApiDeps;
  private readonly base = GOOGLE_WORKSPACE_CONSTANTS.DRIVE_API_BASE;
  private readonly uploadBase = GOOGLE_WORKSPACE_CONSTANTS.DRIVE_UPLOAD_BASE;
  private readonly native: NativeReaders;

  /**
   * @param deps - Token provider and optional fetch override
   * @param native - Docs / Sheets / Slides readers used when Drive refuses a native file
   */
  constructor(deps: GoogleApiDeps, native: NativeReaders = {}) {
    this.deps = deps;
    this.native = native;
  }

  /**
   * `files.list` — most recently modified first.
   *
   * @param input - Query / MIME / folder / cap
   * @returns Matching files
   * @throws GoogleWorkspaceError on auth / Google failures
   */
  async search(input: DriveSearchInput = {}): Promise<DriveFile[]> {
    const max = clampMax(input.max, GOOGLE_WORKSPACE_CONSTANTS.DRIVE_DEFAULT_MAX_RESULTS, GOOGLE_WORKSPACE_CONSTANTS.DRIVE_MAX_RESULTS_CEILING);
    const data = await googleRequest<{ files?: DriveWireFile[] }>(
      this.deps,
      buildGoogleUrl(`${this.base}/files`, {
        q: buildDriveQuery(input),
        pageSize: max,
        orderBy: 'modifiedTime desc',
        fields: `files(${FILE_FIELDS})`,
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
      }),
    );
    return (data.files ?? []).map(toDriveFile);
  }

  /**
   * `files.get` metadata. When Drive refuses the file (outside `drive.file`
   * reach) and it is a Google Doc / Sheet / Slides deck, the metadata comes
   * from the matching native API instead.
   *
   * @param idOrUrl - File id or a Docs / Sheets / Slides / Drive URL
   * @returns The file
   * @throws GoogleWorkspaceError(400, validation) without an id;
   *   (403|404, file_not_accessible) when no API can reach the file
   */
  async get(idOrUrl: string): Promise<DriveFile> {
    const ref = parseDriveRef(idOrUrl);
    try {
      return await this.fetchMeta(ref.id);
    } catch (err) {
      if (!isFileRefusal(err)) throw err;
      return (await this.readNative(ref, (err as GoogleWorkspaceError).status)).file;
    }
  }

  /**
   * File content: Google-native types are exported (Docs → text/plain,
   * Sheets → text/csv, Slides → text/plain); other files are downloaded and
   * returned as UTF-8 when text-like, else base64. When Drive refuses the
   * file, a Google Doc / Sheet / Slides deck is read through its own API
   * (kind taken from the URL, else probed); anything else fails with a
   * message that says what to do.
   *
   * @param idOrUrl - File id or a Docs / Sheets / Slides / Drive URL
   * @returns Content with its type and encoding
   * @throws GoogleWorkspaceError(413, validation) when the file exceeds DRIVE_MAX_CONTENT_BYTES;
   *   (403|404, file_not_accessible) when no API can reach the file
   */
  async readContent(idOrUrl: string): Promise<DriveContent> {
    const ref = parseDriveRef(idOrUrl);
    let file: DriveFile;
    try {
      file = await this.fetchMeta(ref.id);
    } catch (err) {
      if (!isFileRefusal(err)) throw err;
      return this.readNative(ref, (err as GoogleWorkspaceError).status);
    }
    const exportMime = GOOGLE_WORKSPACE_CONSTANTS.DRIVE_EXPORT_MIME[file.mimeType];
    if (exportMime) {
      const text = await googleRequest<string>(
        this.deps,
        buildGoogleUrl(`${this.base}/files/${encodeURIComponent(file.id)}/export`, { mimeType: exportMime }),
        { responseType: 'text' },
      );
      return { file, contentType: exportMime, content: text, encoding: 'utf8', bytes: Buffer.byteLength(text, 'utf8') };
    }
    if (file.mimeType.startsWith('application/vnd.google-apps.')) {
      throw new GoogleWorkspaceError(400, GOOGLE_WORKSPACE_CONSTANTS.ERROR_CODES.VALIDATION, `Cannot read a ${file.mimeType} as text`);
    }
    if ((file.size ?? 0) > GOOGLE_WORKSPACE_CONSTANTS.DRIVE_MAX_CONTENT_BYTES) {
      throw new GoogleWorkspaceError(413, GOOGLE_WORKSPACE_CONSTANTS.ERROR_CODES.VALIDATION, `File is larger than ${GOOGLE_WORKSPACE_CONSTANTS.DRIVE_MAX_CONTENT_BYTES} bytes; open it via webViewLink instead`);
    }
    // Raw bytes: decoding a binary file as text (the old path) replaced every
    // invalid UTF-8 byte with U+FFFD, so .docx/.pdf/images came back corrupt
    // (the 2026-10-04 incident, specs/2026-10-04-agent-credential-isolation.md §5).
    const buf = await googleRequest<Buffer>(
      this.deps,
      buildGoogleUrl(`${this.base}/files/${encodeURIComponent(file.id)}`, { alt: 'media', supportsAllDrives: 'true' }),
      { responseType: 'buffer' },
    );
    if (isTextMime(file.mimeType)) {
      const text = buf.toString('utf8');
      return { file, contentType: file.mimeType, content: text, encoding: 'utf8', bytes: buf.length };
    }
    return { file, contentType: file.mimeType, content: buf.toString('base64'), encoding: 'base64', bytes: buf.length };
  }

  /**
   * Raw `files.get`; Google's 403/404 passes through.
   *
   * @param fileId - Bare file id
   * @returns The file
   */
  private async fetchMeta(fileId: string): Promise<DriveFile> {
    const wire = await googleRequest<DriveWireFile>(
      this.deps,
      buildGoogleUrl(`${this.base}/files/${encodeURIComponent(fileId)}`, { fields: FILE_FIELDS, supportsAllDrives: 'true' }),
    );
    return toDriveFile(wire);
  }

  /**
   * Read a file Drive refused through the Docs / Sheets / Slides API. With
   * a known kind only that API is asked and its failures (other than a
   * refusal) surface; with no kind each API is tried in turn.
   *
   * @param ref - Id and optional kind
   * @param status - Drive's refusal status, reused for the final error
   * @returns The content, shaped like a Drive export
   * @throws GoogleWorkspaceError(status, file_not_accessible) when no API reads it
   */
  private async readNative(ref: DriveRef, status: number): Promise<DriveContent> {
    const kinds = ref.kind ? [ref.kind] : NATIVE_PROBE_ORDER;
    for (const kind of kinds) {
      try {
        const content = await this.readNativeKind(kind, ref.id);
        if (content) return content;
      } catch (err) {
        // A wrong-kind probe answers 400/403/404; a known kind's real error
        // (missing scope, rate limit) is worth more than the generic message.
        if (ref.kind && !isFileRefusal(err)) throw err;
      }
    }
    throw notAccessible(status);
  }

  /**
   * One native read, or null when no reader is wired for the kind.
   *
   * @param kind - Native kind
   * @param id - File id
   * @returns The content, or null
   */
  private async readNativeKind(kind: NativeKind, id: string): Promise<DriveContent | null> {
    const mimeType = NATIVE_MIME[kind];
    if (kind === 'document' && this.native.docs) {
      const doc = await this.native.docs.read(id);
      return nativeContent({ id: doc.id || id, name: doc.title, mimeType, webViewLink: doc.webViewLink }, 'text/plain', doc.text);
    }
    if (kind === 'spreadsheet' && this.native.sheets) {
      const info = await this.native.sheets.info(id);
      const values = await this.native.sheets.read(id);
      return nativeContent({ id: info.id || id, name: info.title, mimeType, webViewLink: info.webViewLink }, 'text/csv', rowsToCsv(values.rows));
    }
    if (kind === 'presentation' && this.native.slides) {
      const deck = await this.native.slides.read(id);
      return nativeContent({ id: deck.id || id, name: deck.title, mimeType, webViewLink: deck.webViewLink }, 'text/plain', presentationToText(deck));
    }
    return null;
  }

  /**
   * Multipart `files.create` — a new file in My Drive (or a folder),
   * optionally converted to a Google-native type.
   *
   * @param input - Name, MIME, content, folder, conversion
   * @returns The created file
   * @throws GoogleWorkspaceError(400, validation) for a missing name/content or oversized content
   */
  async upload(input: DriveUploadInput): Promise<DriveFile> {
    const CODES = GOOGLE_WORKSPACE_CONSTANTS.ERROR_CODES;
    const name = (input.name ?? '').trim();
    if (!name) throw new GoogleWorkspaceError(400, CODES.VALIDATION, '"name" is required');
    if (typeof input.content !== 'string' || input.content.length === 0) {
      throw new GoogleWorkspaceError(400, CODES.VALIDATION, '"content" is required');
    }
    const bytes = input.encoding === 'base64' ? Buffer.from(input.content, 'base64') : Buffer.from(input.content, 'utf8');
    if (bytes.length > GOOGLE_WORKSPACE_CONSTANTS.DRIVE_MAX_CONTENT_BYTES) {
      throw new GoogleWorkspaceError(400, CODES.VALIDATION, `content exceeds ${GOOGLE_WORKSPACE_CONSTANTS.DRIVE_MAX_CONTENT_BYTES} bytes`);
    }
    const mimeType = input.mimeType?.trim() || (input.encoding === 'base64' ? 'application/octet-stream' : 'text/plain');
    const metadata: Record<string, unknown> = { name };
    if (input.convertTo?.trim()) metadata.mimeType = input.convertTo.trim();
    if (input.folderId?.trim()) metadata.parents = [input.folderId.trim()];

    const boundary = `crewly-${randomBytes(12).toString('hex')}`;
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`, 'utf8'),
      Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`, 'utf8'),
      bytes,
      Buffer.from(`\r\n--${boundary}--`, 'utf8'),
    ]);
    const wire = await googleRequest<DriveWireFile>(
      this.deps,
      buildGoogleUrl(`${this.uploadBase}/files`, { uploadType: 'multipart', fields: FILE_FIELDS, supportsAllDrives: 'true' }),
      { method: 'POST', rawBody: body, contentType: `multipart/related; boundary=${boundary}` },
    );
    return toDriveFile(wire);
  }
}

/**
 * Validate a file / document id.
 *
 * @param id - Candidate id
 * @returns The trimmed id
 * @throws GoogleWorkspaceError(400, validation) when empty
 */
export function requireId(id: string | undefined): string {
  const value = (id ?? '').trim();
  if (!value) throw new GoogleWorkspaceError(400, GOOGLE_WORKSPACE_CONSTANTS.ERROR_CODES.VALIDATION, '"id" is required');
  return value;
}

/**
 * Accept a file id or any Docs / Sheets / Slides / Drive URL that contains one.
 *
 * @param idOrUrl - `1AbC…`, `https://docs.google.com/spreadsheets/d/1AbC…/edit`,
 *   `https://drive.google.com/file/d/1AbC…/view`, or `…?id=1AbC…`
 * @returns The bare id, and the native kind when the URL names one
 * @throws GoogleWorkspaceError(400, validation) when empty
 */
export function parseDriveRef(idOrUrl: string | undefined): DriveRef {
  const raw = requireId(idOrUrl);
  const path = raw.match(/(?:\/([a-z]+))?\/d\/([A-Za-z0-9_-]+)/);
  if (path) {
    const kind = path[1] ? KIND_BY_PATH[path[1]] : undefined;
    return { id: path[2], ...(kind ? { kind } : {}) };
  }
  const query = raw.match(/[?&]id=([A-Za-z0-9_-]+)/);
  return { id: query ? query[1] : raw };
}

/**
 * Whether a failure is Drive refusing a file outside the `drive.file` reach
 * (404 "File not found" or 403), as opposed to a scope or auth problem.
 *
 * @param err - The failure
 * @returns True for a Google 403/404 `google_error`
 */
export function isFileRefusal(err: unknown): boolean {
  return err instanceof GoogleWorkspaceError
    && err.code === GOOGLE_WORKSPACE_CONSTANTS.ERROR_CODES.GOOGLE_ERROR
    && (err.status === 403 || err.status === 404);
}

/**
 * Quote one CSV field (RFC 4180).
 *
 * @param cell - Cell value
 * @returns The field
 */
function csvField(cell: unknown): string {
  const text = cell === null || cell === undefined ? '' : String(cell);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Rows to CSV text, matching what Drive's `text/csv` export returns.
 *
 * @param rows - Cell rows (may be ragged)
 * @returns CSV, one line per row
 */
export function rowsToCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvField).join(',')).join('\r\n');
}

/**
 * Plain text of a presentation, one block per slide.
 *
 * @param deck - The flattened presentation
 * @returns Text
 */
function presentationToText(deck: PresentationText): string {
  return deck.slides.map((slide) => slide.lines.join('\n')).filter(Boolean).join('\n\n');
}

/**
 * The error for a file Drive will not hand over.
 *
 * @param status - Google's status (403 / 404)
 * @returns The error
 */
function notAccessible(status: number): GoogleWorkspaceError {
  return new GoogleWorkspaceError(status, GOOGLE_WORKSPACE_CONSTANTS.ERROR_CODES.FILE_NOT_ACCESSIBLE, DRIVE_NOT_ACCESSIBLE_MESSAGE);
}

/**
 * Wrap native-API text as {@link DriveContent}.
 *
 * @param file - Metadata built from the native API
 * @param contentType - `text/plain` or `text/csv`
 * @param text - The content
 * @returns The content
 */
function nativeContent(file: DriveFile, contentType: string, text: string): DriveContent {
  return { file, contentType, content: text, encoding: 'utf8', bytes: Buffer.byteLength(text, 'utf8') };
}
