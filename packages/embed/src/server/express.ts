/**
 * Adapter from a Web `Request -> Response` handler to Express-style
 * `(req, res, next)` middleware. Works with Express 4/5 and with a plain
 * `node:http` server, since it only uses the Node request/response surface.
 *
 * Typed structurally so the SDK has no dependency on `express` or its types.
 */
import { EMBED_CONSTANTS } from '../constants.js';

/** The parts of an Express / Node request the adapter reads. */
export interface NodeLikeRequest extends AsyncIterable<unknown> {
  method?: string;
  /** Express: the full original URL, even under `app.use(prefix, …)`. */
  originalUrl?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  /** Express: `http` or `https` (honours `trust proxy`). */
  protocol?: string;
  /** Set when a body parser (e.g. `express.json()`) already ran. */
  body?: unknown;
}

/** The parts of an Express / Node response the adapter writes. */
export interface NodeLikeResponse {
  statusCode: number;
  setHeader(name: string, value: string | readonly string[]): unknown;
  end(chunk?: Uint8Array): unknown;
}

/** Express-style middleware. */
export type NodeMiddleware = (req: NodeLikeRequest, res: NodeLikeResponse, next?: (err?: unknown) => void) => Promise<void>;

/** Options for {@link toExpress}. */
export interface ToExpressOptions {
  /** Stop reading a streamed body past this many bytes (answer 413). Default 64 KiB. */
  maxBodyBytes?: number;
}

/** Thrown internally when a streamed body passes the cap. */
class BodyTooLargeError extends Error {}

const NO_BODY_METHODS = new Set(['GET', 'HEAD']);

/**
 * Get the request body as bytes: from a body parser's result when one ran,
 * otherwise by reading the stream, up to `maxBytes`.
 *
 * @param req - The Node request
 * @param maxBytes - Largest body read from the stream
 * @returns The body bytes, or undefined when there is none
 * @throws BodyTooLargeError when the stream passes `maxBytes`
 */
async function readBody(req: NodeLikeRequest, maxBytes: number): Promise<Uint8Array | undefined> {
  const parsed = req.body;
  if (parsed !== undefined) {
    if (parsed instanceof Uint8Array) return parsed;
    if (typeof parsed === 'string') return new TextEncoder().encode(parsed);
    // express.json() leaves `{}` when there was no JSON body.
    if (parsed !== null && typeof parsed === 'object' && Object.keys(parsed).length === 0) return undefined;
    return new TextEncoder().encode(JSON.stringify(parsed));
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of req) {
    const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : (chunk as Uint8Array);
    chunks.push(bytes);
    total += bytes.byteLength;
    if (total > maxBytes) throw new BodyTooLargeError('Request body too large');
  }
  if (total === 0) return undefined;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/**
 * Turn a Node request into a Web `Request`.
 *
 * @param req - The Node / Express request
 * @param maxBodyBytes - Largest body read from the stream. Default 64 KiB
 * @returns A Web Request with the same method, URL, headers and body
 * @throws Error when a streamed body is larger than `maxBodyBytes`
 */
export async function toWebRequest(
  req: NodeLikeRequest,
  maxBodyBytes: number = EMBED_CONSTANTS.OPS.DEFAULT_MAX_BODY_BYTES,
): Promise<Request> {
  const method = (req.method ?? 'GET').toUpperCase();
  const hostHeader = req.headers.host;
  const host = (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader) ?? 'localhost';
  const protocol = req.protocol ?? 'http';
  const url = new URL(req.originalUrl ?? req.url ?? '/', `${protocol}://${host}`);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const v of value) headers.append(name, v);
    else headers.set(name, value);
  }
  const body = NO_BODY_METHODS.has(method) ? undefined : await readBody(req, maxBodyBytes);
  if (body) headers.set('content-length', String(body.byteLength));
  else headers.delete('content-length');
  return new Request(url, { method, headers, body: body ? new Uint8Array(body) : undefined });
}

/**
 * Write a Web `Response` to a Node response.
 *
 * @param response - The Web Response
 * @param res - The Node / Express response
 */
export async function sendWebResponse(response: Response, res: NodeLikeResponse): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => {
    res.setHeader(name, value);
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  res.end(bytes.byteLength > 0 ? bytes : undefined);
}

/**
 * Adapt a Web handler (from `createOpsHandler`) to Express middleware.
 *
 * Mount it on the ops base path; it reads the full `originalUrl`, so set the
 * handler's `basePath` to the same prefix. A body parser that ran first is
 * fine. Unexpected adapter errors go to `next(err)` when Express provides
 * it, else become a 500.
 *
 * @param handler - `(request: Request) => Promise<Response>`
 * @param options - Optional body cap for streamed bodies
 * @returns `(req, res, next) => Promise<void>`
 *
 * @example
 * ```typescript
 * app.use('/api/crewly/ops', toExpress(createOpsHandler({ ..., basePath: '/api/crewly/ops' })));
 * ```
 */
export function toExpress(handler: (request: Request) => Promise<Response>, options: ToExpressOptions = {}): NodeMiddleware {
  const maxBodyBytes = options.maxBodyBytes ?? EMBED_CONSTANTS.OPS.DEFAULT_MAX_BODY_BYTES;
  return async function crewlyOpsMiddleware(req, res, next) {
    try {
      const response = await handler(await toWebRequest(req, maxBodyBytes));
      await sendWebResponse(response, res);
    } catch (err) {
      if (err instanceof BodyTooLargeError) {
        await sendWebResponse(
          new Response(JSON.stringify({ error: 'body_too_large' }), {
            status: 413,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          }),
          res,
        );
        return;
      }
      if (next) {
        next(err);
        return;
      }
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(new TextEncoder().encode(JSON.stringify({ error: 'internal_error' })));
    }
  };
}
