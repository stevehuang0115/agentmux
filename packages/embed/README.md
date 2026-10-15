# @crewly/embed

The host side of the **Crewly embedded agent**: put a Crewly assistant in your
own web app as a side panel, for your signed-in staff, and let the assistant
read and file things in your app *as the person asking*.

One package gives you all three host pieces:

| Piece | Import | What it does |
|---|---|---|
| Identity token | `@crewly/embed/server` | `signIdentityToken` — your server tells Crewly who the signed-in user is |
| Ops API | `@crewly/embed/server` | `createOpsHandler` + `defineOpsTool` — a small API the agent calls, scoped to the asker |
| Panel | `@crewly/embed/client`, `@crewly/embed/react` | `loadCrewlyEmbed` / `<CrewlyEmbed>` — mounts the launcher and panel |

How the pieces fit:

```
browser ── GET /api/crewly/token ──▶ your server   signIdentityToken()  (or 204 = no panel)
browser ── token via postMessage ──▶ Crewly panel  (apps.crewlyai.com, iframe)
Crewly agent ── Bearer <host token> ─▶ your server   /api/crewly/ops/*   createOpsHandler()
```

The server code uses only Web `Request`/`Response` and Web Crypto, so it runs
as-is in Next.js route handlers (Node or edge) and in Node 18+. There are no
runtime dependencies; React is an optional peer dependency used only by
`@crewly/embed/react`.

## Install

```bash
npm install @crewly/embed
```

You need an embed from your Crewly account: its id (`emb_…`, public) and its
identity secret (shown once at creation; server-side only). Add your site's
origin (e.g. `https://portal.example.com`, or `http://localhost:4600` for the
demo) to the embed's `allowedOrigins`.

```bash
CREWLY_EMBED_ID=emb_…
CREWLY_EMBED_SECRET=…          # never expose to the browser
CREWLY_EMBED_ROLES=admin       # roles that see the panel
```

## Next.js (App Router)

### 1. Token route — `app/api/crewly/token/route.ts`

```ts
import { signIdentityToken } from '@crewly/embed/server';
import { getSession } from '@/lib/auth';

const ROLES = (process.env.CREWLY_EMBED_ROLES ?? '').split(',').map((r) => r.trim()).filter(Boolean);

export async function GET() {
  const embedId = process.env.CREWLY_EMBED_ID;
  const secret = process.env.CREWLY_EMBED_SECRET;
  const session = await getSession();
  // 204 = render nothing: signed out, role not allowed, or not configured.
  if (!embedId || !secret || !session || !ROLES.includes(session.actingRole)) {
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  }
  const token = await signIdentityToken({
    embedId,
    secret,
    user: { id: session.user.id, name: session.user.name, email: session.user.email, roles: [session.actingRole] },
  });
  return new Response(token, { headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
}
```

The token is HS256, valid 10 minutes, with claims
`{ aud: embedId, sub, name?, email?, roles, iat, exp }`. The panel asks for a
fresh one before it expires.

### 2. Ops API — `app/api/crewly/ops/[[...path]]/route.ts`

Use the **optional** catch-all `[[...path]]` so the base path itself
(`GET /api/crewly/ops`, the manifest) reaches the handler too.

```ts
import { createOpsHandler, defineOpsTool, OpsError } from '@crewly/embed/server';
import { findUserById, listClassesFor, createTicket, audit, type PortalUser } from '@/lib/portal';

const myClasses = defineOpsTool<PortalUser>({
  name: 'my-classes',
  method: 'GET',
  path: '/my-classes',
  risk: 'read',
  description: "The asker's upcoming classes and lessons.",
  params: {
    from: { type: 'string', maxLength: 25, description: 'ISO date' },
    to: { type: 'string', maxLength: 25, description: 'ISO date' },
  },
  // Use the portal's own permission-checked functions, as this user.
  handler: ({ user, params }) => listClassesFor(user, { from: params.from, to: params.to }),
});

const tickets = defineOpsTool<PortalUser>({
  name: 'tickets',
  method: 'POST',
  path: '/tickets',
  risk: 'write',
  description: "File a ticket in the portal's ticket system, with the asker as the requester.",
  params: {
    title: { type: 'string', required: true, maxLength: 120 },
    body: { type: 'string', required: true, maxLength: 4000 },
  },
  handler: async ({ user, params }) => {
    if (!user.canFileTickets) throw new OpsError(403, 'not_allowed');
    return createTicket({ requester: user, title: String(params.title), body: String(params.body), source: 'crewly-embed' });
  },
});

const handler = createOpsHandler<PortalUser>({
  embedId: process.env.CREWLY_EMBED_ID!,
  secret: process.env.CREWLY_EMBED_SECRET!,
  resolveUser: (sub) => findUserById(sub), // null -> 403
  tools: [myClasses, tickets],
  audit: ({ user, sub, tool, outcome }) => audit.log({ userId: user?.id ?? sub, tool, outcome, origin: 'crewly-embed' }),
  basePath: '/api/crewly/ops',
});

export { handler as GET, handler as POST };
```

### 3. Panel — in the signed-in layout

```tsx
import { CrewlyEmbed } from '@crewly/embed/react';

export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CrewlyEmbed embedId={process.env.NEXT_PUBLIC_CREWLY_EMBED_ID!} tokenUrl="/api/crewly/token" />
    </>
  );
}
```

`<CrewlyEmbed>` renders `null`; the launcher and panel are injected by Crewly's
`embed.js`, and only when the token route returns a token. The built React
entry carries `'use client'`. Pass `context` (≤ 2 KB of JSON, e.g.
`{ page: 'course', courseId: 'c-42' }`) to tell the agent where the user is;
it is shown to the agent as untrusted context, never as instructions.

Without React:

```ts
import { loadCrewlyEmbed } from '@crewly/embed/client';

const panel = await loadCrewlyEmbed({ embedId: 'emb_…', tokenUrl: '/api/crewly/token' });
panel?.setContext({ page: 'course', courseId: 'c-42' }); // null when the route said 204
```

## Express

```ts
import express from 'express';
import { createOpsHandler, signIdentityToken, toExpress } from '@crewly/embed/server';

const app = express();

app.get('/api/crewly/token', async (req, res) => {
  const user = req.user; // from your own session middleware
  if (!user || !ALLOWED_ROLES.includes(user.role)) return res.status(204).end();
  res.type('text/plain').set('cache-control', 'no-store').send(
    await signIdentityToken({ embedId: EMBED_ID, secret: EMBED_SECRET, user: { id: user.id, name: user.name, roles: [user.role] } }),
  );
});

app.use(
  '/api/crewly/ops',
  toExpress(createOpsHandler({ embedId: EMBED_ID, secret: EMBED_SECRET, resolveUser, tools, basePath: '/api/crewly/ops' })),
);
```

`toExpress` reads `req.originalUrl`, so `basePath` is the same prefix you mount
on. It works whether or not `express.json()` ran first, and also with a plain
`node:http` server (see `example/`).

## What the ops handler does

For every call, in order:

1. **Verifies the host token** (`Authorization: Bearer …`), strictly: HS256
   only (`none` and every other `alg` are refused), `aud === 'host:' + embedId`,
   `exp` (30 s clock tolerance), `iat` present and not in the future,
   `exp - iat ≤ 300 s`, `scope === 'self'`, and `iss` — when present — `crewly`.
   Failure: `401 { error: 'invalid_token', reason }`.
2. **Resolves the asker** with your `resolveUser(sub)`. `null` → `403 { error: 'unknown_user' }`.
3. **Routes**: `GET <base>` or `GET <base>/` → the manifest; otherwise the tool
   with that method and path (`404 unknown_tool`, `405` with `Allow`).
4. **Validates params** — `400 { error: 'invalid_params', details: [...] }`, `413`
   for bodies over 64 KiB, `400 invalid_json`.
5. **Applies the write budget**: calls to `write` and `irreversible` tools are
   limited per user per UTC day (default 5) → `429 { error: 'write_limit' }`.
6. **Runs the handler as that user.** Return a JSON value (200), `undefined`
   (204) or a `Response`. Throw `new OpsError(status, code, message?)` for a
   specific refusal; any other error becomes a bare `500 internal_error`, so
   internals never reach the agent.
7. **Calls `audit`** with `{ user, sub, tool, risk, method, path, outcome, status, error? }`,
   where `outcome` is `ok | error | denied | invalid | not_found | rate_limited`.
   Audit errors are swallowed.

All responses are `cache-control: no-store`.

Options: `limits: { writesPerDay?, maxBodyBytes?, store? }`. The default counter
store is in memory, right for one long-running server. On serverless or
several replicas, pass a shared `store` (`increment(key, ttlMs) → count`, e.g.
Redis `INCR` + `PEXPIRE`). Without `basePath`, tools are matched by path suffix
and the manifest is served only for a path ending in `/`; setting it is
recommended.

### Params

Declared params are read from the query string and, for `POST`/`PUT`/`PATCH`,
from the top-level fields of a JSON object body (query values are coerced from
text; body values must already have the right JSON type). Undeclared query keys
and repeated keys are refused, so a typo is an error rather than an ignored
filter.

| `type` | Options | Query text accepted |
|---|---|---|
| `string` | `maxLength` (default 2000) | any |
| `number` | `min`, `max`, `integer` | decimal numbers |
| `boolean` | — | `true`, `false`, `1`, `0` |
| `enum` | `values: string[]` | one of `values` |

Every type also takes `required` and `description`. Without type arguments,
`defineOpsTool` infers exact param types for the handler; with
`defineOpsTool<YourUser>(…)` the `user` is typed and params are typed loosely.

## The manifest

`GET <base>/` (with a valid host token, for a user `resolveUser` knows) returns
the tools, so the agent's `host-api` skill discovers them instead of having
them hard-coded in Crewly:

```json
{
  "version": 1,
  "embedId": "emb_…",
  "limits": { "writesPerDay": 5 },
  "tools": [
    {
      "name": "my-classes",
      "method": "GET",
      "path": "/my-classes",
      "risk": "read",
      "description": "The asker's upcoming classes and lessons.",
      "params": {
        "from": { "type": "string", "maxLength": 25, "description": "ISO date", "required": false }
      }
    },
    {
      "name": "tickets",
      "method": "POST",
      "path": "/tickets",
      "risk": "write",
      "description": "File a ticket in the portal's ticket system, with the asker as the requester.",
      "params": {
        "title": { "type": "string", "required": true, "maxLength": 120 },
        "body": { "type": "string", "required": true, "maxLength": 4000 }
      }
    }
  ]
}
```

`risk` is `read`, `write` or `irreversible`. Describe each tool in a sentence or
two; the agent reads the description to decide when to call it.

## Security notes

- **The secret is server-only.** Only your server signs identity tokens and
  verifies host tokens. Never ship `CREWLY_EMBED_SECRET` to the browser, and
  never put it in a `NEXT_PUBLIC_*` variable. The embed id is public.
- **Only the roles you list see the panel.** The token route decides; return
  204 for everyone else. Put the user's *acting* role in `roles`, and only
  roles you list — what a user types in the chat ("I'm the principal")
  changes nothing.
- **`sub` must be a stable user id**, not an email or name that can be
  reassigned.
- **Answer as the asker, with your own permissions.** `resolveUser` maps the
  host token's `sub` to your user; every tool must use your app's normal
  permission-checked functions for that user, so nothing leaves through the
  ops API that the user couldn't see in your app. The host token's
  `scope: 'self'` means exactly that.
- **Write tools are budgeted** (5 per user per day by default) and every call
  is reported to `audit`. Log it with the user and a `crewly-embed` origin.
- **Rotation:** after rotating the secret in Crewly, the old one keeps working
  for 24 h. Pass both while you deploy: `secret: [newSecret, oldSecret]`
  (verifiers only; signing always uses one secret).

## Demo host (`example/`)

A runnable, framework-free host with two fake users (a teacher and an admin),
a `my-classes` read tool, a `tickets` write tool, and a page that loads the
panel via `loadCrewlyEmbed`. Everything is in memory.

```bash
cd packages/embed
npm run build                                    # the page loads dist/client.js
EMBED_ID=emb_… EMBED_SECRET=… PORT=4600 npx tsx example/server.ts
# open http://localhost:4600, "Sign in as admin" — the launcher appears
```

Optional env: `EMBED_ROLES` (default `admin,teacher`), `EMBED_SCRIPT_URL`
(loader script, default `https://apps.crewlyai.com/embed/v1/embed.js`). The
embed's `allowedOrigins` must include `http://localhost:4600`, and for the
agent to call the ops API its `hostApiBase` must be reachable from the
instance (e.g. `http://localhost:4600/api/crewly/ops` when the instance runs on
the same machine, or a tunnel).

Call the ops API by hand with a host token minted the way Cloud does:

```bash
T=$(EMBED_ID=emb_… EMBED_SECRET=… npx tsx example/server.ts --mint-host-token teacher-118)
curl -H "Authorization: Bearer $T" http://localhost:4600/api/crewly/ops            # manifest
curl -H "Authorization: Bearer $T" http://localhost:4600/api/crewly/ops/my-classes
curl -H "Authorization: Bearer $T" -H 'content-type: application/json' \
  -d '{"title":"Projector broken","body":"Room 3"}' http://localhost:4600/api/crewly/ops/tickets
```

Audit lines are printed to stdout.

## API

`@crewly/embed/server`

- `signIdentityToken({ embedId, secret, user: { id, name?, email?, roles } }) → Promise<string>`
- `verifyHostToken(token, { embedId, secret }) → Promise<{ sub, scope: 'self' }>` (throws `EmbedTokenError` with a `code`)
- `defineOpsTool({ name, method, path, risk, description, params?, handler })`
- `createOpsHandler({ embedId, secret, resolveUser, tools, audit?, limits?, basePath? }) → (req: Request) => Promise<Response>`
- `toExpress(handler, { maxBodyBytes? })`
- `OpsError(status, code, message?)`
- For tests and stand-ins for Cloud: `verifyIdentityToken`, `signHostToken`, `validateParams`, `createMemoryLimitStore`

`@crewly/embed/client`

- `loadCrewlyEmbed({ embedId, tokenUrl, context?, scriptUrl? }) → Promise<{ setContext } | null>`

`@crewly/embed/react`

- `<CrewlyEmbed embedId tokenUrl context? scriptUrl? onError? />`

## Development

```bash
npm run build      # tsup: dist/{server,client,react}.{js,cjs,d.ts}
npm run typecheck
npm test           # vitest, ≤ 2 workers
```

Contract: `specs/2026-10-15-embedded-agent.md` (P1a and "SDK: `@crewly/embed`").
