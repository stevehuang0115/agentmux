import { createServer, type Server } from 'node:http';
import { Readable } from 'node:stream';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendWebResponse, toExpress, toWebRequest, type NodeLikeRequest, type NodeLikeResponse } from './express.js';
import { createOpsHandler } from './ops-handler.js';
import { defineOpsTool } from './ops-tool.js';
import { signHostToken } from './tokens.js';

const EMBED = 'emb_express';
const SECRET = 'express-secret-0123456789';

/** A fake Express request backed by a readable stream. */
function fakeReq(init: { method: string; url: string; headers?: Record<string, string>; body?: string; parsed?: unknown }): NodeLikeRequest {
  const stream = Readable.from(init.body ? [Buffer.from(init.body)] : []);
  return Object.assign(stream, {
    method: init.method,
    originalUrl: init.url,
    url: '/stripped-by-express',
    headers: { host: 'portal.test', ...(init.headers ?? {}) },
    protocol: 'https',
    ...(init.parsed !== undefined ? { body: init.parsed } : {}),
  }) as unknown as NodeLikeRequest;
}

function fakeRes() {
  const headers: Record<string, string> = {};
  let body: Buffer | undefined;
  const res: NodeLikeResponse = {
    statusCode: 200,
    setHeader: (n, v) => {
      headers[n] = String(v);
    },
    end: (chunk) => {
      body = chunk ? Buffer.from(chunk) : undefined;
    },
  };
  return { res, headers, body: () => body?.toString() };
}

const echo = defineOpsTool({
  name: 'echo',
  method: 'POST',
  path: '/echo',
  risk: 'read',
  description: 'Echo.',
  params: { text: { type: 'string', required: true } },
  handler: ({ params, user }) => ({ text: params.text, user }),
});

const handler = createOpsHandler({
  embedId: EMBED,
  secret: SECRET,
  resolveUser: (sub) => ({ id: sub }),
  tools: [echo],
  basePath: '/api/crewly/ops',
});

describe('toWebRequest / sendWebResponse', () => {
  it('builds the full URL from originalUrl, protocol and host', async () => {
    const req = await toWebRequest(fakeReq({ method: 'GET', url: '/api/crewly/ops/?x=1', headers: { 'x-a': 'b' } }));
    expect(req.url).toBe('https://portal.test/api/crewly/ops/?x=1');
    expect(req.headers.get('x-a')).toBe('b');
  });

  it('reads the stream, or a body parser result', async () => {
    const streamed = await toWebRequest(fakeReq({ method: 'POST', url: '/e', body: '{"a":1}' }));
    expect(await streamed.json()).toEqual({ a: 1 });
    const parsed = await toWebRequest(fakeReq({ method: 'POST', url: '/e', parsed: { a: 2 } }));
    expect(await parsed.json()).toEqual({ a: 2 });
    const emptyParsed = await toWebRequest(fakeReq({ method: 'POST', url: '/e', parsed: {} }));
    expect(await emptyParsed.text()).toBe('');
  });

  it('copies status, headers and body', async () => {
    const { res, headers, body } = fakeRes();
    await sendWebResponse(new Response('{"ok":true}', { status: 201, headers: { 'x-b': 'c' } }), res);
    expect(res.statusCode).toBe(201);
    expect(headers['x-b']).toBe('c');
    expect(body()).toBe('{"ok":true}');
  });
});

describe('toExpress', () => {
  it('runs the ops handler through an Express-shaped request', async () => {
    const token = await signHostToken({ embedId: EMBED, secret: SECRET, sub: 't1' });
    const { res, body } = fakeRes();
    await toExpress(handler)(
      fakeReq({
        method: 'POST',
        url: '/api/crewly/ops/echo',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        parsed: { text: 'hi' },
      }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(body() ?? '')).toEqual({ text: 'hi', user: { id: 't1' } });
  });

  it('answers 413 when a streamed body passes the cap', async () => {
    const { res, body } = fakeRes();
    await toExpress(handler, { maxBodyBytes: 10 })(fakeReq({ method: 'POST', url: '/api/crewly/ops/echo', body: 'x'.repeat(50) }), res);
    expect(res.statusCode).toBe(413);
    expect(body()).toContain('body_too_large');
  });

  it('passes adapter errors to next, or answers 500', async () => {
    const broken = toExpress(() => Promise.reject(new Error('x')));
    const next = vi.fn();
    await broken(fakeReq({ method: 'GET', url: '/' }), fakeRes().res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const { res, body } = fakeRes();
    await broken(fakeReq({ method: 'GET', url: '/' }), res);
    expect(res.statusCode).toBe(500);
    expect(body()).toContain('internal_error');
  });

  describe('with a real node:http server', () => {
    let server: Server | undefined;
    afterEach(() => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())));

    it('serves the manifest and a tool end to end', async () => {
      const middleware = toExpress(handler);
      server = createServer((req, res) => void middleware(req as unknown as NodeLikeRequest, res));
      await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
      const { port } = server.address() as AddressInfo;
      const token = await signHostToken({ embedId: EMBED, secret: SECRET, sub: 'n1' });
      const auth = { authorization: `Bearer ${token}` };
      const manifest = await fetch(`http://127.0.0.1:${port}/api/crewly/ops`, { headers: auth });
      expect((await manifest.json()).tools[0].name).toBe('echo');
      const echoed = await fetch(`http://127.0.0.1:${port}/api/crewly/ops/echo`, {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'yo' }),
      });
      expect(await echoed.json()).toEqual({ text: 'yo', user: { id: 'n1' } });
    });
  });
});
