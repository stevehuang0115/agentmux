import { mkdtempSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { signHostToken, verifyIdentityToken } from '../src/server/index.js';
import { createDemoApp, findUserById, type DemoConfig } from './demo-app.js';

const EMBED = 'emb_demo';
const SECRET = 'demo-secret-0123456789abcdef';

let server: Server | undefined;
afterEach(() => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())));

async function start(over: Partial<DemoConfig> = {}) {
  const distDir = mkdtempSync(join(tmpdir(), 'embed-demo-'));
  writeFileSync(join(distDir, 'client.js'), 'export const x = 1;');
  const audit = vi.fn();
  const app = createDemoApp({ embedId: EMBED, secret: SECRET, roles: ['admin', 'teacher'], distDir, audit, ...over });
  server = createServer((req, res) => void app.listener(req, res));
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, tickets: app.tickets, audit };
}

const asUser = (who: string) => ({ cookie: `demo_user=${who}` });
const bearer = async (sub: string) => ({ authorization: `Bearer ${await signHostToken({ embedId: EMBED, secret: SECRET, sub })}` });

describe('demo host', () => {
  it('token route: 204 when signed out, a valid identity token when signed in', async () => {
    const { base } = await start();
    expect((await fetch(`${base}/api/crewly/token`)).status).toBe(204);
    const res = await fetch(`${base}/api/crewly/token`, { headers: asUser('teacher') });
    expect(res.status).toBe(200);
    const claims = await verifyIdentityToken(await res.text(), { embedId: EMBED, secret: SECRET });
    expect(claims).toMatchObject({ sub: 'teacher-118', name: 'Ms Lin', roles: ['teacher'] });
  });

  it('token route: 204 for roles not in the list, or when unconfigured', async () => {
    const adminsOnly = await start({ roles: ['admin'] });
    expect((await fetch(`${adminsOnly.base}/api/crewly/token`, { headers: asUser('teacher') })).status).toBe(204);
    expect((await fetch(`${adminsOnly.base}/api/crewly/token`, { headers: asUser('admin') })).status).toBe(200);
    await new Promise<void>((r) => server!.close(() => r()));
    const unset = await start({ embedId: '', secret: '' });
    expect((await fetch(`${unset.base}/api/crewly/token`, { headers: asUser('admin') })).status).toBe(204);
    expect((await fetch(`${unset.base}/api/crewly/ops/my-classes`)).status).toBe(503);
  });

  it('ops: teachers see their own classes, admins see all', async () => {
    const { base, audit } = await start();
    const teacher = await (await fetch(`${base}/api/crewly/ops/my-classes`, { headers: await bearer('teacher-118') })).json();
    expect(teacher.classes.map((c: { id: string }) => c.id)).toEqual(['c-42', 'c-43']);
    const admin = await (await fetch(`${base}/api/crewly/ops/my-classes?from=2026-10-17T00:00:00Z`, { headers: await bearer('admin-1') })).json();
    expect(admin.classes.map((c: { id: string }) => c.id)).toEqual(['c-43']);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ tool: 'my-classes', outcome: 'ok' }));
  });

  it('ops: files tickets as the asker, and lists both tools in the manifest', async () => {
    const { base, tickets } = await start();
    const res = await fetch(`${base}/api/crewly/ops/tickets`, {
      method: 'POST',
      headers: { ...(await bearer('teacher-118')), 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Projector broken', body: 'Room 3' }),
    });
    expect(res.status).toBe(200);
    expect(tickets).toEqual([
      { id: 'TK-1', title: 'Projector broken', body: 'Room 3', requesterId: 'teacher-118', source: 'crewly-embed', status: 'open' },
    ]);
    const manifest = await (await fetch(`${base}/api/crewly/ops`, { headers: await bearer('teacher-118') })).json();
    expect(manifest.tools.map((t: { name: string; risk: string }) => `${t.name}:${t.risk}`)).toEqual(['my-classes:read', 'tickets:write']);
  });

  it('ops: unknown subs are refused, bad from is a 400', async () => {
    const { base } = await start();
    expect((await fetch(`${base}/api/crewly/ops/my-classes`, { headers: await bearer('stranger') })).status).toBe(403);
    expect((await fetch(`${base}/api/crewly/ops/my-classes?from=nope`, { headers: await bearer('admin-1') })).status).toBe(400);
  });

  it('page, login, logout and the built SDK', async () => {
    const { base } = await start();
    const page = await (await fetch(`${base}/`, { headers: asUser('admin') })).text();
    expect(page).toContain('Alex Admin (admin)');
    expect(page).toContain("from '/sdk/client.js'");
    expect(page).toContain('"embedId":"emb_demo"');
    const login = await fetch(`${base}/login?as=teacher`, { redirect: 'manual' });
    expect(login.status).toBe(302);
    expect(login.headers.get('set-cookie')).toContain('demo_user=teacher');
    expect((await fetch(`${base}/login?as=principal`, { redirect: 'manual' })).status).toBe(400);
    expect((await fetch(`${base}/logout`, { redirect: 'manual' })).headers.get('set-cookie')).toContain('Max-Age=0');
    expect(await (await fetch(`${base}/sdk/client.js`)).text()).toBe('export const x = 1;');
    expect((await fetch(`${base}/sdk/..%2Fpackage.json`)).status).toBe(404);
    expect((await fetch(`${base}/sdk/missing.js`)).status).toBe(404);
  });

  it('findUserById', () => {
    expect(findUserById('admin-1')?.role).toBe('admin');
    expect(findUserById('nobody')).toBeNull();
  });
});
