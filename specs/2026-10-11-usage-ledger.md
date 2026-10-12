# Usage ledger: time and tokens per ticket

Owner ask: "How much time and how many tokens went into each task, for example self-media vs the book?
Categories must not be required up front; different people want different ones. Ticket facts are recorded
and never change; statistics are computed later from them. Categories follow what the user asks for; with
none defined, Crewly makes a simple classification itself."

## Model

- A **unit** is one trace (`tr-YYYYMMDD-xxxxxxxx`): a ticket, a request, a work item thread or an owner
  conversation. Its ticket label (`TKT-12`, `CE-7`) is a field of the unit. Traces already exist and already
  say which ticket each agent turn is about; the ledger builds on them and outlives their 90-day expiry.
- **Facts** are appended to `~/.crewly/usage-ledger/YYYY-MM.jsonl` (live) and `backfill.jsonl` (history).
  There is no update or delete API. Every fact has `v`, `ts`, `kind`, `unitId`, `attribution`.
- **Statistics** (owner minutes, categories, teams, projects, top tickets) are computed at report time.
  Categories are never written into facts.

| kind | content |
|---|---|
| `unit.meta` | ticket id, request id, root kind, title, request excerpt, project, channel, Slack thread ref, opened time. Several of these merge; the first value of a field wins. |
| `unit.agent` | an agent worked on the unit (with its team / project at that time) |
| `unit.closed` | the ticket reached `done` / `cancelled` |
| `usage` | per (unit, agent, model, UTC hour): events, input (cached included), cachedInput, output, cacheWrite, cost-weighted `budget` tokens, estimated `costUsd` (existing pricing tables), `share` |
| `busy` | per (unit, agent, UTC hour): turns, `busyMs`, `share` |
| `owner.message` | the owner wrote to the unit (time of the message) |

`usage` and `busy` facts are deltas (the buffer is written every minute and on shutdown), so the ledger stays
small. Totals are the sum of facts. `attribution` is `recorded` (the harness knew the unit when it happened)
or `inferred` (rebuilt from timestamps by the backfill).

## Attribution rules

1. When the harness delivers a message to an agent, the trace context sets the agent's current trace(s)
   (`[TICKET:…]` / `[TRACE:…]` markers, work item, ticket ids; unchanged behaviour). It now also remembers
   the other traces named by the same delivery.
2. A usage event belongs to the trace(s) its session was on **at the event's own time** (the Claude
   transcript sync records usage after the turn). One trace: all of it. A delivery naming n traces: **1/n
   each** (`share`).
3. A trace stops being current when a delivery names none (cron, system notice), when its work item is
   terminal, or after 30 minutes without activity (existing rules). Usage after that goes to the agent's
   `(no ticket)` unit (`~none:<agent>`), so totals still add up.
4. Agent busy time comes from `turn.ended` (a busy period of at least the existing minimum). It is recorded
   on the trace the turn started on and the one it is on now (and their co-traces), split evenly by `share`.
   Busy time outside any ticket is not recorded.
5. Backfill (once, 2 minutes after the first start with this version; only facts older than the start of live
   recording): trace roots, deliveries, owner messages, `turn.ended`, status changes from the trace files;
   usage events from the token ledger. A usage event that already carries a trace id is `recorded`. One
   without it is credited to the trace of the session's latest earlier delivery if that was at most 30
   minutes before, as `inferred`; otherwise to `(no ticket)`.

## Owner time

Owner messages delivered to an agent on a unit are the facts. At report time, messages on one unit that
follow each other within **10 minutes** form a span from the first message to the last plus **1 minute** (the
time to write it; a single message is one minute). When spans of different units overlap, the overlapping
time is split evenly between them, so owner minutes are never counted twice.

## Categories

- Optional. Stored in `usage-ledger/categories.json`: `{ name, description?, keywords?, teams?, projects? }`
  with a version that bumps on every change. The owner sets them through the orchestrator
  (`usage-categories` skill) or `PUT/POST /api/usage-ledger/categories`.
- Classification happens in the report, per ticket, in this order: (1) keywords (or the comma-separated
  phrases of the description), team and project hints, best score wins; (2) for tickets nothing matched, one
  batched question to the default cheap model if one is configured (`ANTHROPIC_API_KEY`), at most 50
  tickets per report; (3) `other`. Usage outside any ticket is `(no ticket)`.
- Results are cached in `usage-ledger/classification-cache.json` per (category-set id, ticket); the id is a
  hash of the definitions, so editing a definition re-slices all history, and re-entering the same one
  reuses the cache. A fallback `other` caused by having no model is not cached.
- No definitions: the category is the ticket's team name, else its project name.

## Report

`GET /api/usage-ledger/report?since=7d&until=&by=category|team|project|agent|ticket&categories=&limit=`

Per group: owner minutes, agent busy minutes, tokens (`budget` = cost-weighted headline, `total` = raw),
estimated cost, ticket count, top 5 tickets. Plus `summary` (voice / Slack text) and `notes`. `categories`
is either stored names (show only those), ad-hoc definitions (`media:linkedin,substack;book:chapter`) or a
JSON array. Windows are accurate to the UTC hour. Skill: `usage-report` (orchestrator and team leaders).
`GET /api/usage-ledger/units/:id` returns one ticket's folded facts. Drive's org overview can call the report
endpoint; nothing in Drive changes here.

## Cost

Recording is two in-memory map updates per usage event and per trace event. The rollup is incremental: each
file's byte offset is kept, so a report parses only what was appended since the last one (the first report
after a restart reads the ledger once). The backfill streams the trace files once.
