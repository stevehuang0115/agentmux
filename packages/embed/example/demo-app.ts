/**
 * A tiny demo host for @crewly/embed: two fake users, a token route, an ops
 * API with one read and one write tool, and a page that loads the panel.
 *
 * Plain `node:http`, no framework, so the whole host side fits in one file.
 * Everything is in memory and fake; it exists to test the chain
 * host page -> Cloud panel -> instance agent -> host ops API, end to end.
 */
import { readFile, readdir } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createOpsHandler,
  defineOpsTool,
  OpsError,
  signIdentityToken,
  toExpress,
  type NodeLikeRequest,
  type OpsAuditEvent,
} from '../src/server/index.js';

/** A fake portal user. */
export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: 'teacher' | 'admin';
}

/** A fake class. */
export interface DemoClass {
  id: string;
  title: string;
  teacherId: string;
  startsAt: string;
}

/** A fake ticket. */
export interface DemoTicket {
  id: string;
  title: string;
  body: string;
  requesterId: string;
  source: 'crewly-embed';
  status: 'open';
}

/** Demo configuration. */
export interface DemoConfig {
  /** Embed id; when empty the token route answers 204. */
  embedId: string;
  /** Embed secret; when empty the token route answers 204. */
  secret: string;
  /** Roles that see the panel. */
  roles: readonly string[];
  /** Loader script URL (defaults to production). */
  scriptUrl?: string;
  /** Where the built SDK lives, served at /sdk/. */
  distDir?: string;
  /** Audit sink; defaults to stdout. */
  audit?: (event: OpsAuditEvent<DemoUser>) => void;
}

export const DEMO_USERS: Readonly<Record<string, DemoUser>> = {
  teacher: { id: 'teacher-118', name: 'Ms Lin', email: 'lin@example.test', role: 'teacher' },
  admin: { id: 'admin-1', name: 'Alex Admin', email: 'alex@example.test', role: 'admin' },
};

const CLASSES: readonly DemoClass[] = [
  { id: 'c-42', title: 'Robotics 101', teacherId: 'teacher-118', startsAt: '2026-10-16T09:00:00Z' },
  { id: 'c-43', title: 'Intro to Circuits', teacherId: 'teacher-118', startsAt: '2026-10-17T13:00:00Z' },
  { id: 'c-77', title: 'Coding for Kids', teacherId: 'teacher-205', startsAt: '2026-10-16T15:00:00Z' },
];

const OPS_BASE = '/api/crewly/ops';
const TOKEN_ROUTE = '/api/crewly/token';
const SESSION_COOKIE = 'demo_user';
const DEFAULT_DIST = fileURLToPath(new URL('../dist/', import.meta.url));

/**
 * Find a user by the stable id used as the token `sub`.
 *
 * @param id - User id
 * @returns The user, or null
 */
export function findUserById(id: string): DemoUser | null {
  return Object.values(DEMO_USERS).find((u) => u.id === id) ?? null;
}

/**
 * Read the signed-in demo user from the session cookie.
 *
 * @param req - Incoming request
 * @returns The user, or null when signed out
 */
function sessionUser(req: IncomingMessage): DemoUser | null {
  const cookie = req.headers.cookie ?? '';
  const match = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`).exec(cookie);
  return match ? (DEMO_USERS[decodeURIComponent(match[1] as string)] ?? null) : null;
}

/**
 * Escape text for HTML.
 *
 * @param text - Raw text
 * @returns Escaped text
 */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Render the demo page.
 *
 * @param user - Signed-in user, or null
 * @param config - Demo config
 * @returns HTML
 */
function renderPage(user: DemoUser | null, config: DemoConfig): string {
  const who = user ? `${escapeHtml(user.name)} (${user.role})` : 'nobody';
  const loader = JSON.stringify({
    embedId: config.embedId,
    tokenUrl: TOKEN_ROUTE,
    context: { page: 'demo-home' },
    ...(config.scriptUrl ? { scriptUrl: config.scriptUrl } : {}),
  }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Crewly embed demo host</title>
<style>body{font:15px system-ui;margin:40px;max-width:720px}code{background:#eee;padding:1px 4px}</style></head>
<body>
<h1>Demo portal</h1>
<p>Signed in as <strong>${who}</strong>. Panel roles: <code>${escapeHtml(config.roles.join(', ') || '(none)')}</code></p>
<p><a href="/login?as=teacher">Sign in as teacher</a> · <a href="/login?as=admin">Sign in as admin</a> · <a href="/logout">Sign out</a></p>
<p>Panel status: <span id="status">loading…</span></p>
<script type="module">
  import { loadCrewlyEmbed } from '/sdk/client.js';
  const status = document.getElementById('status');
  loadCrewlyEmbed(${loader})
    .then((h) => { status.textContent = h ? 'loaded (launcher at the bottom right)' : 'not shown (token route answered 204)'; })
    .catch((e) => { status.textContent = 'failed: ' + e.message; });
</script>
</body></html>`;
}

/**
 * Build the demo host's request listener.
 *
 * Routes: `/` page, `/login?as=teacher|admin`, `/logout`, `/sdk/*.js` (built
 * client), `GET /api/crewly/token`, and `/api/crewly/ops/*`.
 *
 * @param config - Embed id, secret, allowed roles, optional script URL
 * @returns A `node:http` request listener, plus the in-memory tickets
 */
export function createDemoApp(config: DemoConfig): {
  listener: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  tickets: DemoTicket[];
} {
  const tickets: DemoTicket[] = [];
  const distDir = config.distDir ?? DEFAULT_DIST;

  const myClasses = defineOpsTool<DemoUser>({
    name: 'my-classes',
    method: 'GET',
    path: '/my-classes',
    risk: 'read',
    description: "The asker's upcoming classes. Teachers see the classes they teach; admins see all classes.",
    params: {
      from: { type: 'string', maxLength: 25, description: 'ISO date; only classes starting at or after it' },
    },
    handler: ({ user, params }) => {
      const from = typeof params.from === 'string' ? Date.parse(params.from) : Number.NEGATIVE_INFINITY;
      if (Number.isNaN(from)) throw new OpsError(400, 'bad_from', 'from must be an ISO date');
      const visible = user.role === 'admin' ? CLASSES : CLASSES.filter((c) => c.teacherId === user.id);
      return { classes: visible.filter((c) => Date.parse(c.startsAt) >= from) };
    },
  });

  const fileTicket = defineOpsTool<DemoUser>({
    name: 'tickets',
    method: 'POST',
    path: '/tickets',
    risk: 'write',
    description: "File a support ticket in the portal's ticket system, with the asker as the requester.",
    params: {
      title: { type: 'string', required: true, maxLength: 120 },
      body: { type: 'string', required: true, maxLength: 4000 },
    },
    handler: ({ user, params }) => {
      const ticket: DemoTicket = {
        id: `TK-${tickets.length + 1}`,
        title: String(params.title),
        body: String(params.body),
        requesterId: user.id,
        source: 'crewly-embed',
        status: 'open',
      };
      tickets.push(ticket);
      return { ticket };
    },
  });

  // Without an embed configured there is nothing to verify host tokens against.
  const configured = Boolean(config.embedId && config.secret);
  const ops = configured
    ? toExpress(
        createOpsHandler<DemoUser>({
          embedId: config.embedId,
          secret: config.secret,
          resolveUser: (sub) => findUserById(sub),
          tools: [myClasses, fileTicket],
          basePath: OPS_BASE,
          audit:
            config.audit ??
            ((e) => {
              console.log(`[audit] ${e.sub} ${e.method} ${e.path} tool=${e.tool ?? '-'} -> ${e.outcome} ${e.status}`);
            }),
        }),
      )
    : null;

  /** Send a small text response. */
  const send = (res: ServerResponse, status: number, body: string, type = 'text/plain; charset=utf-8'): void => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
  };

  const listener = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://demo.local');
    const path = url.pathname;

    if (path === OPS_BASE || path.startsWith(`${OPS_BASE}/`)) {
      if (!ops) return send(res, 503, 'EMBED_ID / EMBED_SECRET not set');
      await ops(req as unknown as NodeLikeRequest, res);
      return;
    }

    if (path === TOKEN_ROUTE && req.method === 'GET') {
      const user = sessionUser(req);
      // 204 = render nothing: not signed in, role not allowed, or not configured.
      if (!user || !config.embedId || !config.secret || !config.roles.includes(user.role)) {
        res.writeHead(204, { 'cache-control': 'no-store' });
        res.end();
        return;
      }
      const token = await signIdentityToken({
        embedId: config.embedId,
        secret: config.secret,
        user: { id: user.id, name: user.name, email: user.email, roles: [user.role] },
      });
      send(res, 200, token);
      return;
    }

    if (path === '/login') {
      const as = url.searchParams.get('as') ?? '';
      if (!DEMO_USERS[as]) return send(res, 400, 'unknown demo user');
      res.writeHead(302, { location: '/', 'set-cookie': `${SESSION_COOKIE}=${as}; Path=/; HttpOnly; SameSite=Lax` });
      res.end();
      return;
    }

    if (path === '/logout') {
      res.writeHead(302, { location: '/', 'set-cookie': `${SESSION_COOKIE}=; Path=/; Max-Age=0` });
      res.end();
      return;
    }

    if (path.startsWith('/sdk/')) {
      const name = path.slice('/sdk/'.length);
      // Only plain .js files that exist in dist/ (no traversal).
      const files = await readdir(distDir).catch(() => [] as string[]);
      if (!/^[\w.-]+\.js$/.test(name) || !files.includes(name)) {
        return send(res, 404, 'Not built? Run `npm run build` in packages/embed first.');
      }
      send(res, 200, await readFile(join(distDir, name), 'utf8'), 'text/javascript; charset=utf-8');
      return;
    }

    if (path === '/') return send(res, 200, renderPage(sessionUser(req), config), 'text/html; charset=utf-8');
    send(res, 404, 'not found');
  };

  return { listener, tickets };
}
