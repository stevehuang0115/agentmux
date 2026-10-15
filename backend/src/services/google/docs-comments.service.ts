/**
 * DocsCommentsService — comments on a Google Doc, over the owner's grant.
 *
 * Uses the Drive API v3 `comments` / `replies` endpoints (Docs has no
 * comments API of its own), so it reaches what the Drive grant reaches.
 * New grants carry `drive.file` only (Cloud stopped requesting `drive` /
 * `drive.readonly` on 2026-10-15), which covers only documents Crewly
 * created. On any other document Google answers 403 / 404; that case
 * answers `file_not_accessible` with what to do instead. It never asks for
 * a reconnect: reconnecting cannot add full Drive, so that prompt would
 * loop. Grants made earlier with the full `drive` scope still work on every
 * document, and their refusals pass through unchanged.
 *
 * @module services/google/docs-comments.service
 */

import { GOOGLE_WORKSPACE_CONSTANTS } from '../../constants.js';
import { GoogleWorkspaceError } from './google-workspace-token.service.js';
import { buildGoogleUrl, googleRequest, type GoogleApiDeps } from './google-api.client.js';
import { parseDriveRef, requireId } from './drive.service.js';

/** Agent-facing text for comments on a document Crewly did not create. */
export const COMMENTS_NOT_ACCESSIBLE_MESSAGE =
  'Comments work only on documents Crewly created. Do not ask the owner to reconnect Google; that cannot add this access. Tell the owner which comment needs a reply so they can handle it in Google Docs, or offer to put the content in a new document Crewly creates (docs-read, then docs-write create) and comment there.';

/** One reply under a comment. */
export interface DocCommentReply {
  id: string;
  author: string;
  authorEmail?: string;
  createdTime: string;
  modifiedTime?: string;
  content: string;
  /** `resolve` / `reopen` when the reply changed the comment's state. */
  action?: string;
}

/** One comment, flattened for an agent. */
export interface DocComment {
  id: string;
  author: string;
  authorEmail?: string;
  createdTime: string;
  modifiedTime?: string;
  content: string;
  /** The document text the comment was made on, when it was anchored. */
  quote?: string;
  /** Google's opaque anchor (only meaningful to Google's own editors). */
  anchor?: string;
  resolved: boolean;
  replies: DocCommentReply[];
}

/** `list` result. */
export interface DocCommentList {
  docId: string;
  comments: DocComment[];
  /** True when more comments exist than {@link GOOGLE_WORKSPACE_CONSTANTS.COMMENTS_MAX_PAGES} pages hold. */
  truncated: boolean;
}

interface WireUser {
  displayName?: string;
  emailAddress?: string;
  me?: boolean;
}
interface WireReply {
  id?: string;
  author?: WireUser;
  createdTime?: string;
  modifiedTime?: string;
  content?: string;
  action?: string;
  deleted?: boolean;
}
interface WireComment {
  id?: string;
  author?: WireUser;
  createdTime?: string;
  modifiedTime?: string;
  content?: string;
  quotedFileContent?: { mimeType?: string; value?: string };
  anchor?: string;
  resolved?: boolean;
  deleted?: boolean;
  replies?: WireReply[];
}
interface WireCommentList {
  comments?: WireComment[];
  nextPageToken?: string;
}

/**
 * Accept a document id or any Docs/Drive URL that contains one.
 *
 * @param idOrUrl - `1AbC…`, `https://docs.google.com/document/d/1AbC…/edit`, or `…?id=1AbC…`
 * @returns The bare id
 * @throws GoogleWorkspaceError(400, validation) when empty
 */
export function docIdFrom(idOrUrl: string | undefined): string {
  return parseDriveRef(idOrUrl).id;
}

function toReply(r: WireReply): DocCommentReply {
  return {
    id: r.id ?? '',
    author: r.author?.displayName ?? '',
    ...(r.author?.emailAddress ? { authorEmail: r.author.emailAddress } : {}),
    createdTime: r.createdTime ?? '',
    ...(r.modifiedTime ? { modifiedTime: r.modifiedTime } : {}),
    content: r.content ?? '',
    ...(r.action ? { action: r.action } : {}),
  };
}

/**
 * Flatten a wire comment; deleted replies are dropped.
 *
 * @param c - Drive comment
 * @returns The agent-facing shape
 */
export function toDocComment(c: WireComment): DocComment {
  return {
    id: c.id ?? '',
    author: c.author?.displayName ?? '',
    ...(c.author?.emailAddress ? { authorEmail: c.author.emailAddress } : {}),
    createdTime: c.createdTime ?? '',
    ...(c.modifiedTime ? { modifiedTime: c.modifiedTime } : {}),
    content: c.content ?? '',
    ...(c.quotedFileContent?.value ? { quote: c.quotedFileContent.value } : {}),
    ...(c.anchor ? { anchor: c.anchor } : {}),
    resolved: c.resolved === true,
    replies: (c.replies ?? []).filter((r) => !r.deleted).map(toReply),
  };
}

function requireText(text: string | undefined, name = 'text'): string {
  const value = (text ?? '').replace(/\r\n/g, '\n').trim();
  if (!value) throw new GoogleWorkspaceError(400, GOOGLE_WORKSPACE_CONSTANTS.ERROR_CODES.VALIDATION, `"${name}" is required`);
  return value;
}

/**
 * Comments: list, reply, resolve, add.
 */
export class DocsCommentsService {
  private readonly deps: GoogleApiDeps;
  private readonly base = GOOGLE_WORKSPACE_CONSTANTS.DRIVE_API_BASE;

  /**
   * @param deps - Token provider, optional fetch override, product + account binding
   */
  constructor(deps: GoogleApiDeps) {
    this.deps = deps;
  }

  /**
   * Comments with their replies, oldest first, paged up to
   * `COMMENTS_MAX_PAGES`. Deleted comments are never returned; resolved ones
   * only when asked.
   *
   * @param idOrUrl - Document id or URL
   * @param options - `includeResolved` to keep resolved comments
   * @returns The comments
   */
  async list(idOrUrl: string, options: { includeResolved?: boolean } = {}): Promise<DocCommentList> {
    const docId = docIdFrom(idOrUrl);
    const comments: DocComment[] = [];
    let pageToken: string | undefined;
    let pages = 0;
    do {
      const page = await this.guard(() => googleRequest<WireCommentList>(
        this.deps,
        buildGoogleUrl(this.commentsUrl(docId), {
          fields: '*',
          pageSize: GOOGLE_WORKSPACE_CONSTANTS.COMMENTS_PAGE_SIZE,
          includeDeleted: 'false',
          pageToken,
        }),
      ));
      for (const c of page.comments ?? []) {
        if (c.deleted) continue;
        if (c.resolved && !options.includeResolved) continue;
        comments.push(toDocComment(c));
      }
      pageToken = page.nextPageToken || undefined;
      pages += 1;
    } while (pageToken && pages < GOOGLE_WORKSPACE_CONSTANTS.COMMENTS_MAX_PAGES);
    return { docId, comments, truncated: Boolean(pageToken) };
  }

  /**
   * Reply to a comment.
   *
   * @param idOrUrl - Document id or URL
   * @param commentId - Comment to answer
   * @param text - Reply text
   * @returns The new reply
   */
  async reply(idOrUrl: string, commentId: string, text: string): Promise<DocCommentReply & { docId: string; commentId: string }> {
    const docId = docIdFrom(idOrUrl);
    const cid = requireId(commentId);
    const content = requireText(text);
    const reply = await this.write<WireReply>(this.repliesUrl(docId, cid), { content });
    return { docId, commentId: cid, ...toReply(reply) };
  }

  /**
   * Resolve a comment: a reply with `action: "resolve"` and an optional message.
   *
   * @param idOrUrl - Document id or URL
   * @param commentId - Comment to resolve
   * @param text - Optional closing message
   * @returns The resolving reply
   */
  async resolve(idOrUrl: string, commentId: string, text?: string): Promise<DocCommentReply & { docId: string; commentId: string; resolved: true }> {
    const docId = docIdFrom(idOrUrl);
    const cid = requireId(commentId);
    const content = (text ?? '').replace(/\r\n/g, '\n').trim();
    const reply = await this.write<WireReply>(this.repliesUrl(docId, cid), {
      action: 'resolve',
      ...(content ? { content } : {}),
    });
    return { docId, commentId: cid, ...toReply(reply), resolved: true };
  }

  /**
   * Add a comment. With `quote`, the quoted text is sent as
   * `quotedFileContent` — but Google Docs shows API-made comments as
   * unanchored, so it may still appear as a general comment.
   *
   * @param idOrUrl - Document id or URL
   * @param text - Comment text
   * @param quote - Exact document text the comment is about
   * @returns The new comment
   */
  async add(idOrUrl: string, text: string, quote?: string): Promise<DocComment & { docId: string }> {
    const docId = docIdFrom(idOrUrl);
    const content = requireText(text);
    const quoted = (quote ?? '').trim();
    const comment = await this.write<WireComment>(this.commentsUrl(docId), {
      content,
      ...(quoted ? { quotedFileContent: { mimeType: 'text/plain', value: quoted } } : {}),
    });
    return { docId, ...toDocComment(comment) };
  }

  private commentsUrl(docId: string): string {
    return `${this.base}/files/${encodeURIComponent(docId)}/comments`;
  }

  private repliesUrl(docId: string, commentId: string): string {
    return `${this.commentsUrl(docId)}/${encodeURIComponent(commentId)}/replies`;
  }

  /**
   * POST a comment or reply; a refusal on a document Crewly did not create
   * becomes `file_not_accessible` (see {@link guard}).
   *
   * @param url - Endpoint (without query)
   * @param body - JSON body
   * @returns Google's answer
   */
  private async write<T>(url: string, body: unknown): Promise<T> {
    return this.guard(() => googleRequest<T>(this.deps, buildGoogleUrl(url, { fields: '*' }), { method: 'POST', body }));
  }

  /**
   * Run a comments call, turning Drive's refusal of a document outside the
   * `drive.file` reach into `file_not_accessible`.
   *
   * Google answers 403 or 404 (and sometimes "insufficient scopes") when the
   * token may not touch this file. Without the full `drive` scope that means
   * Crewly did not create the document — a reconnect cannot fix it, so the
   * error says what to do instead of asking for one. A grant that does hold
   * `drive` (made before 2026-10-15), or whose scopes are unknown, sees
   * Google's error unchanged: there a 403 / 404 is a real permission problem
   * or a wrong id.
   *
   * @param run - The Google call
   * @returns Its answer
   * @throws GoogleWorkspaceError(403|404, file_not_accessible) on that refusal
   */
  private async guard<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (err) {
      if (this.isOutsideReach(err)) {
        const status = (err as GoogleWorkspaceError).status;
        throw new GoogleWorkspaceError(status, GOOGLE_WORKSPACE_CONSTANTS.ERROR_CODES.FILE_NOT_ACCESSIBLE, COMMENTS_NOT_ACCESSIBLE_MESSAGE);
      }
      throw err;
    }
  }

  /**
   * Whether a failure is a refusal a narrow (`drive.file`) grant gets on a
   * document it did not create.
   *
   * @param err - The failure
   * @returns True for 403 / 404 on a grant known to lack the full `drive` scope
   */
  private isOutsideReach(err: unknown): boolean {
    if (!(err instanceof GoogleWorkspaceError) || (err.status !== 403 && err.status !== 404)) return false;
    const CODES = GOOGLE_WORKSPACE_CONSTANTS.ERROR_CODES;
    if (err.code !== CODES.GOOGLE_ERROR && err.code !== CODES.REAUTH_REQUIRED) return false;
    const scopes = this.deps.tokens.grantedScopes?.(this.deps.account ? { account: this.deps.account } : {});
    return scopes !== undefined && !scopes.includes(GOOGLE_WORKSPACE_CONSTANTS.DRIVE_FULL_SCOPE);
  }
}
