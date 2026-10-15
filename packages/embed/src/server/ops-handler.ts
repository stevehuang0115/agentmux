/**
 * The ops API request handler: one Web `Request` -> `Response` function that
 * a host mounts under a catch-all route (Next.js) or adapts with
 * `toExpress` (Express / plain Node http).
 */
import { EMBED_CONSTANTS } from '../constants.js';
import { EmbedTokenError, OpsError } from './errors.js';
import { createMemoryLimitStore, writeLimitKey, type OpsLimits } from './limits.js';
import { toManifestTool, type AnyOpsTool, type ManifestTool, type OpsMethod, type OpsRisk } from './ops-tool.js';
import { validateParams } from './params.js';
import { verifyHostToken } from './tokens.js';

/** How a call ended, as reported to `audit`. */
export type OpsOutcome = 'ok' | 'error' | 'denied' | 'invalid' | 'not_found' | 'rate_limited';

/** One audit record: who, which tool, and how it ended. */
export interface OpsAuditEvent<U> {
  /** The resolved asker, or null when `resolveUser` returned null. */
  user: U | null;
  /** The verified sub from the host token. */
  sub: string;
  /** Tool name, or null for the manifest and unknown paths. */
  tool: string | null;
  /** The tool's risk, when a tool was matched. */
  risk: OpsRisk | null;
  method: string;
  /** Path below the ops base, e.g. `/my-classes`. */
  path: string;
  outcome: OpsOutcome;
  /** HTTP status returned. */
  status: number;
  /** Error code, when not `ok`. */
  error?: string;
}

/** The manifest served at `GET <base>/`. */
export interface OpsManifest {
  version: 1;
  embedId: string;
  tools: ManifestTool[];
  limits: { writesPerDay: number };
}

/** Options for {@link createOpsHandler}. */
export interface CreateOpsHandlerOptions<U> {
  /** The embed id; host tokens must have `aud: 'host:' + embedId`. */
  embedId: string;
  /** The embed secret(s). Pass `[new, old]` during a rotation. */
  secret: string | readonly string[];
  /**
   * Map the token's `sub` to the host's own user, with the host's own
   * permissions. Return null to refuse (403).
   */
  resolveUser: (sub: string) => U | null | undefined | Promise<U | null | undefined>;
  /** The tools, from `defineOpsTool`. */
  tools: ReadonlyArray<AnyOpsTool<U>>;
  /** Called once per authenticated call with its outcome. Errors are ignored. */
  audit?: (event: OpsAuditEvent<U>) => void | Promise<void>;
  /** Per-user budgets. Default: 5 writes per user per UTC day, in memory. */
  limits?: OpsLimits;
  /**
   * URL path the ops API is mounted at, e.g. `/api/crewly/ops`. Recommended.
   * Without it, tools are matched by path suffix and the manifest is served
   * only for a path ending in `/`.
   */
  basePath?: string;
  /** Clock in ms; injectable for tests. */
  now?: () => number;
}

/** A Web-standard request handler. */
export type OpsRequestHandler = (request: Request) => Promise<Response>;

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const BEARER = /^Bearer\s+([A-Za-z0-9._~+/=-]+)\s*$/i;
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } as const;

/**
 * Build a JSON response with no-store caching.
 *
 * @param status - HTTP status
 * @param body - JSON-serialisable body
 * @param extraHeaders - Additional headers
 * @returns The Response
 */
function json(status: number, body: unknown, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
}

/**
 * Normalise a mount path: leading slash, no trailing slash ('' for root).
 *
 * @param basePath - Raw base path
 * @returns The normalised path
 */
function normaliseBase(basePath: string): string {
  const withSlash = basePath.startsWith('/') ? basePath : `/${basePath}`;
  return withSlash.replace(/\/+$/, '');
}

/**
 * Map an error a handler threw to a status, code and audit outcome.
 *
 * @param err - What was thrown
 * @returns Status, code, message and outcome
 */
function mapHandlerError(err: unknown): { status: number; code: string; message?: string; outcome: OpsOutcome } {
  if (err instanceof OpsError) {
    const outcome: OpsOutcome =
      err.status === 403 || err.status === 401
        ? 'denied'
        : err.status === 404
          ? 'not_found'
          : err.status === 429
            ? 'rate_limited'
            : err.status >= 400 && err.status < 500
              ? 'invalid'
              : 'error';
    return { status: err.status, code: err.code, message: err.message !== err.code ? err.message : undefined, outcome };
  }
  return { status: 500, code: 'internal_error', outcome: 'error' };
}

/**
 * Create the ops API handler.
 *
 * Every call, in order:
 * 1. verifies the host token (`Authorization: Bearer …`) — 401 otherwise;
 * 2. resolves the asker with `resolveUser(sub)` — 403 when it returns null;
 * 3. serves the manifest at `GET <base>/`, or routes to the tool — 404 / 405;
 * 4. validates the tool's params (and JSON body) — 400 / 413;
 * 5. applies the per-user write budget to `write` / `irreversible` tools — 429;
 * 6. runs the handler as that user, and
 * 7. calls `audit({ user, tool, outcome, … })`.
 *
 * Handler errors become a generic 500 unless they are `OpsError`, so
 * internals never leak to the agent.
 *
 * @param options - Embed id, secret, resolveUser, tools, audit, limits, basePath
 * @returns `(request: Request) => Promise<Response>`
 * @throws TypeError at creation when two tools share a name or a method+path
 *
 * @example
 * ```typescript
 * // app/api/crewly/ops/[[...path]]/route.ts
 * const handler = createOpsHandler({ embedId, secret, resolveUser, tools, basePath: '/api/crewly/ops' });
 * export { handler as GET, handler as POST };
 * ```
 */
export function createOpsHandler<U>(options: CreateOpsHandlerOptions<U>): OpsRequestHandler {
  const { embedId, secret, resolveUser, audit } = options;
  if (typeof embedId !== 'string' || embedId.length === 0) throw new TypeError('createOpsHandler: embedId is required');
  if (typeof resolveUser !== 'function') throw new TypeError('createOpsHandler: resolveUser is required');
  const tools = options.tools;
  const now = options.now ?? Date.now;
  const writesPerDay = options.limits?.writesPerDay ?? EMBED_CONSTANTS.OPS.DEFAULT_WRITES_PER_DAY;
  const maxBodyBytes = options.limits?.maxBodyBytes ?? EMBED_CONSTANTS.OPS.DEFAULT_MAX_BODY_BYTES;
  const store = options.limits?.store ?? createMemoryLimitStore(now);
  const base = options.basePath === undefined ? undefined : normaliseBase(options.basePath);

  const names = new Set<string>();
  const routes = new Set<string>();
  for (const tool of tools) {
    if (names.has(tool.name)) throw new TypeError(`createOpsHandler: duplicate tool name "${tool.name}"`);
    const route = `${tool.method} ${tool.path}`;
    if (routes.has(route)) throw new TypeError(`createOpsHandler: duplicate route "${route}"`);
    names.add(tool.name);
    routes.add(route);
  }
  const manifest: OpsManifest = {
    version: 1,
    embedId,
    tools: tools.map((t) => toManifestTool(t as AnyOpsTool)),
    limits: { writesPerDay },
  };

  /**
   * Find the path below the mount point, or null when the request is not
   * under it. Without a basePath, the longest tool path that is a suffix of
   * the request path wins; a trailing slash means the manifest.
   */
  const subPath = (pathname: string): string | null => {
    if (base !== undefined) {
      if (pathname === base || pathname === `${base}/`) return '/';
      if (!pathname.startsWith(`${base}/`)) return null;
      return pathname.slice(base.length).replace(/\/+$/, '') || '/';
    }
    if (pathname.endsWith('/')) return '/';
    let best: string | null = null;
    for (const tool of tools) {
      if (pathname === tool.path || pathname.endsWith(tool.path)) {
        if (!best || tool.path.length > best.length) best = tool.path;
      }
    }
    return best ?? pathname;
  };

  /** Report to the host's audit sink without letting it break the call. */
  const report = async (event: OpsAuditEvent<U>): Promise<void> => {
    if (!audit) return;
    try {
      await audit(event);
    } catch {
      // The audit sink is the host's; its failure must not change the answer.
    }
  };

  return async function opsHandler(request: Request): Promise<Response> {
    const method = request.method.toUpperCase();
    const url = new URL(request.url);

    // 1. Host token.
    const match = BEARER.exec(request.headers.get('authorization') ?? '');
    if (!match) {
      return json(401, { error: 'missing_token' }, { 'www-authenticate': 'Bearer' });
    }
    let sub: string;
    try {
      ({ sub } = await verifyHostToken(match[1] as string, { embedId, secret, now: now() }));
    } catch (err) {
      const reason = err instanceof EmbedTokenError ? err.code : 'invalid';
      return json(401, { error: 'invalid_token', reason }, { 'www-authenticate': 'Bearer error="invalid_token"' });
    }

    const path = subPath(url.pathname) ?? url.pathname;
    const tool =
      path === '/' ? undefined : tools.find((t) => t.path === path && t.method === method);
    const event = (outcome: OpsOutcome, status: number, user: U | null, error?: string): OpsAuditEvent<U> => ({
      user,
      sub,
      tool: tool?.name ?? null,
      risk: tool?.risk ?? null,
      method,
      path,
      outcome,
      status,
      ...(error ? { error } : {}),
    });

    // 2. The asker, with the host's own permissions.
    let user: U | null;
    try {
      user = (await resolveUser(sub)) ?? null;
    } catch {
      await report(event('error', 500, null, 'resolve_user_failed'));
      return json(500, { error: 'internal_error' });
    }
    if (user === null) {
      await report(event('denied', 403, null, 'unknown_user'));
      return json(403, { error: 'unknown_user' });
    }

    // 3. Manifest or route.
    if (subPath(url.pathname) === null) {
      await report(event('not_found', 404, user, 'not_found'));
      return json(404, { error: 'not_found' });
    }
    if (path === '/') {
      if (method !== 'GET') return json(405, { error: 'method_not_allowed' }, { allow: 'GET' });
      await report(event('ok', 200, user));
      return json(200, manifest);
    }
    if (!tool) {
      const allowed = tools.filter((t) => t.path === path).map((t) => t.method);
      if (allowed.length > 0) {
        await report(event('invalid', 405, user, 'method_not_allowed'));
        return json(405, { error: 'method_not_allowed' }, { allow: allowed.join(', ') });
      }
      await report(event('not_found', 404, user, 'unknown_tool'));
      return json(404, { error: 'unknown_tool', path });
    }

    // 4. Body and params.
    let body: unknown;
    if (BODY_METHODS.has(method)) {
      const declared = Number(request.headers.get('content-length') ?? '0');
      if (declared > maxBodyBytes) {
        await report(event('invalid', 413, user, 'body_too_large'));
        return json(413, { error: 'body_too_large' });
      }
      const raw = new Uint8Array(await request.arrayBuffer());
      if (raw.byteLength > maxBodyBytes) {
        await report(event('invalid', 413, user, 'body_too_large'));
        return json(413, { error: 'body_too_large' });
      }
      if (raw.byteLength > 0) {
        try {
          body = JSON.parse(new TextDecoder().decode(raw));
        } catch {
          await report(event('invalid', 400, user, 'invalid_json'));
          return json(400, { error: 'invalid_json' });
        }
      }
    }
    const validated = validateParams(tool.params ?? {}, { query: url.searchParams, body });
    if (!validated.ok) {
      await report(event('invalid', 400, user, 'invalid_params'));
      return json(400, { error: 'invalid_params', details: validated.errors });
    }

    // 5. Per-user write budget.
    if (tool.risk !== 'read') {
      const count = await store.increment(writeLimitKey(sub, now()), EMBED_CONSTANTS.OPS.DAY_MS);
      if (count > writesPerDay) {
        await report(event('rate_limited', 429, user, 'write_limit'));
        return json(429, { error: 'write_limit', limit: writesPerDay });
      }
    }

    // 6. Run as the asker.
    try {
      const result = await tool.handler({
        user,
        // Validated against this tool's own declaration just above.
        params: validated.params as never,
        body,
        sub,
        request,
      });
      if (result instanceof Response) {
        await report(event(result.ok ? 'ok' : 'error', result.status, user));
        return result;
      }
      if (result === undefined) {
        await report(event('ok', 204, user));
        return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
      }
      await report(event('ok', 200, user));
      return json(200, result);
    } catch (err) {
      const mapped = mapHandlerError(err);
      await report(event(mapped.outcome, mapped.status, user, mapped.code));
      return json(mapped.status, mapped.message ? { error: mapped.code, message: mapped.message } : { error: mapped.code });
    }
  };
}

/** Re-exported for hosts that type their own adapters. */
export type { OpsMethod };
