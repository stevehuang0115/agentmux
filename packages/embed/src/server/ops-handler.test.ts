import { describe, expect, it, vi } from 'vitest';
import { OpsError } from './errors.js';
import { signJwt } from './jwt.js';
import { createOpsHandler, type OpsAuditEvent } from './ops-handler.js';
import { defineOpsTool } from './ops-tool.js';
import { signHostToken } from './tokens.js';

const EMBED = 'emb_ops';
const SECRET = 'ops-secret-0123456789abcdef';
const BASE = 'https://portal.test/api/crewly/ops';

interface User {
  id: string;
  role: 'teacher' | 'admin';
}
const USERS: Record<string, User> = { t1: { id: 't1', role: 'teacher' }, a1: { id: 'a1', role: 'admin' } };

const myClasses = defineOpsTool({
  name: 'my-classes',
  method: 'GET',
  path: '/my-classes',
  risk: 'read',
  description: 'Upcoming classes.',
  params: { from: { type: 'string', maxLength: 10 }, limit: { type: 'number', integer: true, max: 20 } },
  handler: ({ user, params }) => ({ for: (user as User).id, from: params.from ?? null, limit: params.limit ?? null }),
});

const tickets = defineOpsTool<User>({
  name: 'file-ticket',
  method: 'POST',
  path: '/tickets',
  risk: 'write',
  description: 'File a ticket as the asker.',
  params: { title: { type: 'string', required: true, maxLength: 100 }, body: { type: 'string', maxLength: 2000 } },
  handler: ({ user, params }) => ({ id: 'TK-1', requester: user.id, title: params.title }),
});

const failing = defineOpsTool({
  name: 'boom',
  method: 'GET',
  path: '/boom',
  risk: 'read',
  description: 'Throws.',
  handler: () => {
    throw new Error('db password is hunter2');
  },
});

const refusing = defineOpsTool({
  name: 'lesson-prep',
  method: 'GET',
  path: '/lesson-prep',
  risk: 'read',
  description: 'Prep.',
  handler: () => {
    throw new OpsError(403, 'not_your_lesson', 'You do not teach this lesson');
  },
});

const empty = defineOpsTool({
  name: 'noop',
  method: 'DELETE',
  path: '/nested/noop',
  risk: 'irreversible',
  description: 'Nothing.',
  handler: () => undefined,
});

function setup(extra: Partial<Parameters<typeof createOpsHandler<User>>[0]> = {}) {
  const audit = vi.fn<(e: OpsAuditEvent<User>) => void>();
  const handler = createOpsHandler<User>({
    embedId: EMBED,
    secret: SECRET,
    resolveUser: (sub) => USERS[sub] ?? null,
    tools: [myClasses, tickets, failing, refusing, empty],
    audit,
    basePath: '/api/crewly/ops',
    ...extra,
  });
  return { handler, audit };
}

async function call(
  handler: (r: Request) => Promise<Response>,
  path: string,
  init: { method?: string; body?: unknown; sub?: string; token?: string | null } = {},
) {
  const token = init.token === undefined ? await signHostToken({ embedId: EMBED, secret: SECRET, sub: init.sub ?? 't1' }) : init.token;
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  const res = await handler(
    new Request(BASE + path, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : typeof init.body === 'string' ? init.body : JSON.stringify(init.body),
    }),
  );
  const text = await res.text();
  return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : undefined };
}

describe('createOpsHandler: auth', () => {
  it('401 without a token', async () => {
    const { handler, audit } = setup();
    const r = await call(handler, '/my-classes', { token: null });
    expect(r.status).toBe(401);
    expect(r.json).toEqual({ error: 'missing_token' });
    expect(r.headers.get('www-authenticate')).toBe('Bearer');
    expect(audit).not.toHaveBeenCalled();
  });

  it('401 with the reason for a bad token', async () => {
    const { handler } = setup();
    const wrongSecret = await signHostToken({ embedId: EMBED, secret: 'nope', sub: 't1' });
    expect((await call(handler, '/my-classes', { token: wrongSecret })).json).toEqual({ error: 'invalid_token', reason: 'bad_signature' });
    const identity = await signJwt({ aud: EMBED, sub: 't1', roles: ['teacher'], iat: 1, exp: 2 }, SECRET);
    expect((await call(handler, '/my-classes', { token: identity })).json.reason).toBe('bad_audience');
    const now = Math.floor(Date.now() / 1000);
    const allScope = await signJwt({ aud: `host:${EMBED}`, sub: 't1', scope: 'all', iat: now, exp: now + 60 }, SECRET);
    expect((await call(handler, '/my-classes', { token: allScope })).json.reason).toBe('bad_scope');
  });

  it('403 when resolveUser returns null, and audits it', async () => {
    const { handler, audit } = setup();
    const r = await call(handler, '/my-classes', { sub: 'ghost' });
    expect(r.status).toBe(403);
    expect(r.json).toEqual({ error: 'unknown_user' });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ user: null, sub: 'ghost', tool: 'my-classes', outcome: 'denied', status: 403 }));
  });

  it('500 when resolveUser throws, without details', async () => {
    const { handler } = setup({
      resolveUser: () => {
        throw new Error('db down');
      },
    });
    const r = await call(handler, '/my-classes');
    expect(r.status).toBe(500);
    expect(r.json).toEqual({ error: 'internal_error' });
  });
});

describe('createOpsHandler: manifest and routing', () => {
  it('serves the manifest at the base, with and without a trailing slash', async () => {
    const { handler, audit } = setup();
    for (const path of ['', '/']) {
      const r = await call(handler, path);
      expect(r.status).toBe(200);
      expect(r.headers.get('cache-control')).toBe('no-store');
      expect(r.json.version).toBe(1);
      expect(r.json.embedId).toBe(EMBED);
      expect(r.json.limits).toEqual({ writesPerDay: 5 });
      expect(r.json.tools.map((t: { name: string }) => t.name)).toEqual(['my-classes', 'file-ticket', 'boom', 'lesson-prep', 'noop']);
      expect(r.json.tools[1]).toEqual({
        name: 'file-ticket',
        method: 'POST',
        path: '/tickets',
        risk: 'write',
        description: 'File a ticket as the asker.',
        params: {
          title: { type: 'string', required: true, maxLength: 100 },
          body: { type: 'string', maxLength: 2000, required: false },
        },
      });
    }
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ tool: null, path: '/', outcome: 'ok' }));
  });

  it('routes to the tool as the resolved user', async () => {
    const { handler, audit } = setup();
    const r = await call(handler, '/my-classes?from=2026-10-15&limit=3');
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ for: 't1', from: '2026-10-15', limit: 3 });
    expect(audit).toHaveBeenLastCalledWith({
      user: USERS.t1,
      sub: 't1',
      tool: 'my-classes',
      risk: 'read',
      method: 'GET',
      path: '/my-classes',
      outcome: 'ok',
      status: 200,
    });
  });

  it('404 for unknown tools and paths outside the base; 405 for the wrong method', async () => {
    const { handler, audit } = setup();
    expect((await call(handler, '/nope')).status).toBe(404);
    expect(audit).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: 'not_found', error: 'unknown_tool' }));
    const outside = await handler(
      new Request('https://portal.test/api/other', {
        headers: { authorization: `Bearer ${await signHostToken({ embedId: EMBED, secret: SECRET, sub: 't1' })}` },
      }),
    );
    expect(outside.status).toBe(404);
    const wrong = await call(handler, '/tickets');
    expect(wrong.status).toBe(405);
    expect(wrong.headers.get('allow')).toBe('POST');
    expect((await call(handler, '/', { method: 'POST', body: {} })).status).toBe(405);
  });

  it('matches by suffix when no basePath is given', async () => {
    const { handler } = setup({ basePath: undefined });
    expect((await call(handler, '/my-classes')).json.for).toBe('t1');
    expect((await call(handler, '/nested/noop', { method: 'DELETE' })).status).toBe(204);
    expect((await call(handler, '/')).json.version).toBe(1);
  });

  it('returns 204 for an undefined result', async () => {
    const { handler } = setup();
    const r = await call(handler, '/nested/noop', { method: 'DELETE' });
    expect(r.status).toBe(204);
    expect(r.json).toBeUndefined();
  });

  it('passes a returned Response through', async () => {
    const raw = defineOpsTool({
      name: 'raw',
      method: 'GET',
      path: '/raw',
      risk: 'read',
      description: 'Raw.',
      handler: () => new Response('hello', { status: 202 }),
    });
    const handler = createOpsHandler({ embedId: EMBED, secret: SECRET, resolveUser: () => ({}), tools: [raw], basePath: '/api/crewly/ops' });
    const res = await handler(
      new Request(`${BASE}/raw`, { headers: { authorization: `Bearer ${await signHostToken({ embedId: EMBED, secret: SECRET, sub: 'x' })}` } }),
    );
    expect(res.status).toBe(202);
    expect(await res.text()).toBe('hello');
  });
});

describe('createOpsHandler: params and body', () => {
  it('400 with details for invalid params', async () => {
    const { handler, audit } = setup();
    const r = await call(handler, '/my-classes?limit=99&teacher=t2');
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ error: 'invalid_params', details: ['unknown param: teacher', 'limit must be at most 20'] });
    expect(audit).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: 'invalid', status: 400 }));
  });

  it('validates params from the JSON body', async () => {
    const { handler } = setup();
    expect((await call(handler, '/tickets', { method: 'POST', body: { body: 'no title' } })).json).toEqual({
      error: 'invalid_params',
      details: ['title is required'],
    });
    const ok = await call(handler, '/tickets', { method: 'POST', body: { title: 'Projector broken', body: 'Room 3' } });
    expect(ok.status).toBe(200);
    expect(ok.json).toEqual({ id: 'TK-1', requester: 't1', title: 'Projector broken' });
  });

  it('400 for invalid JSON and 413 for oversized bodies', async () => {
    const { handler } = setup({ limits: { maxBodyBytes: 50 } });
    expect((await call(handler, '/tickets', { method: 'POST', body: '{nope' })).json).toEqual({ error: 'invalid_json' });
    expect((await call(handler, '/tickets', { method: 'POST', body: { title: 'x'.repeat(100) } })).status).toBe(413);
  });
});

describe('createOpsHandler: write limit', () => {
  it('allows 5 writes per user per day by default, then 429', async () => {
    let t = Date.UTC(2026, 9, 15, 9);
    const { handler, audit } = setup({ now: () => t });
    const token = (sub: string) => signHostToken({ embedId: EMBED, secret: SECRET, sub, now: t });
    for (let i = 0; i < 5; i += 1) {
      expect((await call(handler, '/tickets', { method: 'POST', body: { title: `t${i}` }, token: await token('t1') })).status).toBe(200);
    }
    const sixth = await call(handler, '/tickets', { method: 'POST', body: { title: 'six' }, token: await token('t1') });
    expect(sixth.status).toBe(429);
    expect(sixth.json).toEqual({ error: 'write_limit', limit: 5 });
    expect(audit).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: 'rate_limited', tool: 'file-ticket' }));
    // Another user has their own budget; reads are not counted.
    expect((await call(handler, '/tickets', { method: 'POST', body: { title: 'a' }, token: await token('a1') })).status).toBe(200);
    expect((await call(handler, '/my-classes', { token: await token('t1') })).status).toBe(200);
    // Next UTC day the budget resets.
    t = Date.UTC(2026, 9, 16, 0, 1);
    expect((await call(handler, '/tickets', { method: 'POST', body: { title: 'new day' }, token: await token('t1') })).status).toBe(200);
  });

  it('honours a custom limit and store', async () => {
    const increment = vi.fn(() => 2);
    const { handler } = setup({ limits: { writesPerDay: 1, store: { increment } } });
    expect((await call(handler, '/tickets', { method: 'POST', body: { title: 'x' } })).status).toBe(429);
    expect(increment).toHaveBeenCalledWith(expect.stringMatching(/^writes:\d{4}-\d{2}-\d{2}:t1$/), 86_400_000);
  });
});

describe('createOpsHandler: errors and audit', () => {
  it('hides unexpected handler errors behind a 500', async () => {
    const { handler, audit } = setup();
    const r = await call(handler, '/boom');
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.json)).not.toContain('hunter2');
    expect(audit).toHaveBeenLastCalledWith(expect.objectContaining({ tool: 'boom', outcome: 'error', status: 500 }));
  });

  it('maps OpsError to its status and code', async () => {
    const { handler, audit } = setup();
    const r = await call(handler, '/lesson-prep');
    expect(r.status).toBe(403);
    expect(r.json).toEqual({ error: 'not_your_lesson', message: 'You do not teach this lesson' });
    expect(audit).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: 'denied', error: 'not_your_lesson' }));
  });

  it('ignores a failing audit sink', async () => {
    const { handler } = setup({
      audit: () => {
        throw new Error('audit down');
      },
    });
    expect((await call(handler, '/my-classes')).status).toBe(200);
  });
});

describe('createOpsHandler: setup checks', () => {
  it('refuses duplicate names and routes, and missing options', () => {
    expect(() => createOpsHandler({ embedId: EMBED, secret: SECRET, resolveUser: () => null, tools: [myClasses, myClasses] })).toThrow(/duplicate/);
    const clone = defineOpsTool({ ...myClasses, name: 'other' });
    expect(() => createOpsHandler({ embedId: EMBED, secret: SECRET, resolveUser: () => null, tools: [myClasses, clone] })).toThrow(/route/);
    expect(() => createOpsHandler({ embedId: '', secret: SECRET, resolveUser: () => null, tools: [] })).toThrow(/embedId/);
  });
});
