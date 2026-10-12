/**
 * Cloud client of the team move: the REST calls of the shared contract
 * (`<cloud>/api/cloud/team-moves`). The machine authenticates with the same
 * account token it uses for every other Cloud call; Cloud answers an instance
 * only about moves of its own account and machine.
 *
 * @module services/team-move/team-move-cloud.client
 */

import { createWriteStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { TEAM_MOVE_CONSTANTS } from '../../constants.js';
import type { CloudManifestSummary, TeamMovePreflight, TeamMoveReportStatus, TeamMoveView } from './team-move.types.js';

const C = TEAM_MOVE_CONSTANTS;

/** The Cloud session (CloudClientService). */
export interface TeamMoveCloudSession {
  getToken(): string | null;
  getCloudUrl(): string | null;
  /** Refresh an expired access token; true when a new one is in place. */
  tryRefreshToken?(): Promise<boolean>;
}

/** An error answer from Cloud (or no answer at all). */
export class TeamMoveCloudError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'TeamMoveCloudError';
  }

  /** Worth trying again: the network, a server error, rate limiting. */
  get retryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

/** Constructor options. */
export interface TeamMoveCloudClientOptions {
  session: TeamMoveCloudSession;
  /** This machine's Cloud instance id; sent on every call (owner and instance share one token). */
  getInstanceId: () => Promise<string>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Retry backoff base (ms); tests pass 0. */
  retryBaseMs?: number;
}

/** A parsed JSON answer. */
type Json = Record<string, unknown>;

/** Client for the team-move endpoints. */
export class TeamMoveCloudClient {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly retryBaseMs: number;

  constructor(private readonly options: TeamMoveCloudClientOptions) {
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.retryBaseMs = options.retryBaseMs ?? C.RETRY_BASE_MS;
  }

  /** Whether the machine is signed in to Cloud. */
  isConnected(): boolean {
    return !!this.options.session.getToken() && !!this.options.session.getCloudUrl();
  }

  private url(suffix: string): string {
    const base = this.options.session.getCloudUrl();
    if (!base) throw new TeamMoveCloudError('Not signed in to Crewly Cloud', 401, 'not_logged_in');
    return `${base.replace(/\/$/, '')}${C.CLOUD_PATH}${suffix}`;
  }

  /**
   * One authenticated request with a token refresh on 401 and retries on
   * network and 5xx errors.
   */
  private async request(method: string, suffix: string, init: { body?: RequestInit['body']; json?: unknown; headers?: Record<string, string>; retries?: number } = {}): Promise<Response> {
    const retries = init.retries ?? C.CHUNK_RETRIES;
    let refreshed = false;
    let lastError: TeamMoveCloudError = new TeamMoveCloudError('request failed', 0);
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await this.sleep(this.retryBaseMs * 2 ** (attempt - 1));
      const token = this.options.session.getToken();
      if (!token) throw new TeamMoveCloudError('Not signed in to Crewly Cloud', 401, 'not_logged_in');
      const instanceId = await this.options.getInstanceId();
      let response: Response;
      try {
        response = await this.fetchImpl(this.url(suffix), {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Crewly-Instance-Id': instanceId,
            ...(init.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
            ...(init.headers ?? {}),
          },
          body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
          signal: AbortSignal.timeout(C.REQUEST_TIMEOUT_MS),
          // Never follow a redirect: fetch turns a redirected POST into a GET, which
          // answers with some other endpoint's 200 (a list instead of a move id).
          redirect: 'manual',
        });
      } catch (error) {
        lastError = new TeamMoveCloudError(`Cloud unreachable: ${error instanceof Error ? error.message : String(error)}`, 0);
        continue;
      }
      if (response.status === 401 && !refreshed && this.options.session.tryRefreshToken) {
        refreshed = true;
        if (await this.options.session.tryRefreshToken().catch(() => false)) {
          attempt--; // the retry with the fresh token is free
          continue;
        }
      }
      if (response.ok || response.status === 206) return response;
      lastError = await this.errorFrom(response);
      if (!lastError.retryable) throw lastError;
    }
    throw lastError;
  }

  private async errorFrom(response: Response): Promise<TeamMoveCloudError> {
    if (response.status >= 300 && response.status < 400) {
      const where = response.headers.get('location');
      return new TeamMoveCloudError(`Cloud redirected the request (HTTP ${response.status}${where ? ` to ${where.slice(0, 200)}` : ''}); refusing to follow it`, response.status, 'unexpected_redirect');
    }
    let message = `Cloud request failed (HTTP ${response.status})`;
    if (response.status === 503) message = 'Crewly Cloud has no storage for team moves yet (storage_unavailable); try again later';
    let code: string | undefined;
    try {
      const body = (await response.json()) as Json;
      if (typeof body['error'] === 'string' && response.status !== 503) message = body['error'];
      if (typeof body['code'] === 'string') code = body['code'];
    } catch {
      /* non-JSON body */
    }
    return new TeamMoveCloudError(message, response.status, code);
  }

  /** Cloud wraps answers in `{success, data}`; accept both shapes. */
  private async data<T>(response: Response): Promise<T> {
    const body = (await response.json().catch(() => ({}))) as Json;
    if (body['success'] === false) {
      throw new TeamMoveCloudError(typeof body['error'] === 'string' ? body['error'] : `Cloud reported a failure (HTTP ${response.status})`, response.status, typeof body['code'] === 'string' ? body['code'] : undefined);
    }
    return (body['data'] !== undefined ? body['data'] : body) as T;
  }

  /** The caller's moves, newest first. An instance sees what it has to do (`role`/`action`). */
  async list(): Promise<TeamMoveView[]> {
    const instanceId = encodeURIComponent(await this.options.getInstanceId());
    const data = await this.data<unknown>(await this.request('GET', `?instanceId=${instanceId}`));
    const list = Array.isArray(data) ? data : (data as Json | null)?.['moves'];
    return Array.isArray(list) ? (list as TeamMoveView[]) : [];
  }

  /**
   * This machine's moves of the last 7 days in any state, newest first (what the
   * owner sees as "recent moves"). A Cloud that does not know `scope=recent`
   * answers with the pending moves only.
   */
  async listRecent(): Promise<TeamMoveView[]> {
    const instanceId = encodeURIComponent(await this.options.getInstanceId());
    const data = await this.data<unknown>(await this.request('GET', `?instanceId=${instanceId}&scope=recent`));
    const list = Array.isArray(data) ? data : (data as Json | null)?.['moves'];
    return Array.isArray(list) ? (list as TeamMoveView[]) : [];
  }

  /** One move. */
  async get(moveId: string): Promise<TeamMoveView> {
    return this.data<TeamMoveView>(await this.request('GET', `/${encodeURIComponent(moveId)}`));
  }

  /** Ask Cloud to start a move (the owner path, or an instance acting for the owner). */
  async create(body: { teamId: string; sourceInstanceId: string; targetInstanceId: string }): Promise<{ moveId: string }> {
    const data = await this.data<Json>(await this.request('POST', '', { json: body, retries: 1, headers: { 'X-Crewly-Acting-For': 'owner', 'X-Crewly-Acting-For-Role': 'owner' } }));
    const moveId = typeof data['moveId'] === 'string' ? data['moveId'] : null;
    if (!moveId) throw new TeamMoveCloudError('Cloud did not return a move id (unexpected answer to the create request)', 502, 'unexpected_response');
    return { moveId };
  }

  /** Target: publish the per-move public key and preflight. */
  async postTargetKey(moveId: string, body: { publicKey: string; preflight: TeamMovePreflight }): Promise<void> {
    await this.request('POST', `/${encodeURIComponent(moveId)}/target-key`, { json: body });
  }

  /** Source: announce the ciphertext. */
  async packageInit(moveId: string, body: { size: number; sha256: string; chunks: number; manifest: CloudManifestSummary }): Promise<{ uploadId: string; received: number[] }> {
    const data = await this.data<Json>(await this.request('POST', `/${encodeURIComponent(moveId)}/package/init`, { json: body }));
    return {
      uploadId: typeof data['uploadId'] === 'string' ? data['uploadId'] : '',
      received: Array.isArray(data['received']) ? (data['received'] as number[]) : [],
    };
  }

  /** Source: upload one ciphertext chunk (0-based). */
  async putChunk(moveId: string, n: number, chunk: Buffer): Promise<void> {
    await this.request('PUT', `/${encodeURIComponent(moveId)}/package/chunks/${n}`, {
      body: new Uint8Array(chunk) as unknown as RequestInit['body'],
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  }

  /** Source: all chunks are up. */
  async packageComplete(moveId: string): Promise<void> {
    await this.request('POST', `/${encodeURIComponent(moveId)}/package/complete`, { json: {} });
  }

  /**
   * Target: download the ciphertext, resuming a partial file with `Range`.
   *
   * @param moveId - Move id
   * @param dest - File to write (kept between attempts)
   * @param totalSize - Expected size from the package metadata
   * @returns Final size
   */
  async downloadPackage(moveId: string, dest: string, totalSize: number): Promise<number> {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    for (let pass = 0; pass < C.CHUNK_RETRIES + 1; pass++) {
      const have = (await fs.stat(dest).catch(() => null))?.size ?? 0;
      if (have === totalSize) return have;
      if (have > totalSize) await fs.rm(dest, { force: true });
      const from = have > totalSize ? 0 : have;
      let response: Response;
      try {
        response = await this.request('GET', `/${encodeURIComponent(moveId)}/package`, { headers: from > 0 ? { Range: `bytes=${from}-` } : {} });
      } catch (error) {
        if (pass >= C.CHUNK_RETRIES || !(error instanceof TeamMoveCloudError && error.retryable)) throw error;
        continue;
      }
      if (!response.body) throw new TeamMoveCloudError('Cloud sent an empty package', 502);
      // 200 to a Range request means "the whole thing": start over.
      const append = response.status === 206 && from > 0;
      try {
        await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(dest, { flags: append ? 'a' : 'w', mode: 0o600 }));
      } catch {
        // A dropped connection leaves a partial file; the next pass continues from it.
        await this.sleep(this.retryBaseMs);
      }
    }
    const final = (await fs.stat(dest).catch(() => null))?.size ?? 0;
    if (final !== totalSize) throw new TeamMoveCloudError(`Package download incomplete (${final} of ${totalSize} bytes)`, 0);
    return final;
  }

  /** Report a status. */
  async postStatus(moveId: string, body: { status: TeamMoveReportStatus; report?: unknown; error?: string }): Promise<void> {
    await this.request('POST', `/${encodeURIComponent(moveId)}/status`, { json: body });
  }

  /** Owner: roll the move back. */
  async rollback(moveId: string): Promise<void> {
    await this.request('POST', `/${encodeURIComponent(moveId)}/rollback`, { json: {}, retries: 1 });
  }
}
