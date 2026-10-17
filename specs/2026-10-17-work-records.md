# Automatic per-task work records (2026-10-17)

Status: implemented (crewly#1349). Extends
`specs/2026-10-17-wiki-log-memory-hygiene.md` (the vault log, its entry
format, the weekly digest, the startup briefing).

## Problem

The vault activity log (`llm-curated/log.md`) holds only what agents choose
to write down. Nothing records, per task, who asked for it, who did it, what
came out, what went wrong on the way, who was pulled in, and how it ended.
The weekly digest therefore says nothing about work done or about how the
teams collaborate, and an agent that restarts does not know what it just
finished or for whom. The owner asked for this on 2026-10-17.

Everything needed already exists as scattered state: the WorkItem (title,
brief, `target`, `metadata.origin` / `delegatedBy` / `projectTicket`,
result evidence, cancel / block reasons), the linked project ticket or
Request (`ownerReview`, `acceptedBy` owner|silence, `auto_accepted`), child
WorkItems (delegations; the verify item names the reviewer), the run trace
(`turn.error`, `message.agent`, `message.outbound`, `ticket.status`) and the
agent's own transcript (failed tool calls).

## Design

Code in the backend, no model calls, every step non-fatal.

### A. The record (`backend/src/services/wiki/work-record.ts`, pure)

One `(record)` entry per WorkItem and phase. Body, one field per line so the
digest and the briefing can parse it back:

```
(record) **<title>** — <outcome phrase>
asked by: <who> [(team lead)] [for the owner] [(Slack thread|Slack DM|chat|app comment)] — "<quote, ≤160 chars>"
done by: <name>
did: <result summary, ≤400 chars>
outputs: <a>; <b>; …                       (≤8, ≤160 chars each)
errors: <what> (fixed|unresolved|unknown); …   (≤5, ≤160 chars each)
helpers: delegated to <Name>: "<sub-task>" → <status>; asked <Name> → answered|no answer; reviewed by <Name>   (≤6)
outcome: <phrase>[ — <reason>][, <duration>]
meta: wi=<id> phase=final|blocked status=<status> asked_by=<session>:<kind> done_by=<session> outcome=<outcome> [ticket=<id>] [request=<id>] [trace=<id>] [team=<id>] [helpers=<session>:<how>,…] [outcome_by=<name>]
```

- **Owner-facing lines never carry ticket ids or WorkItem ids.**
  `cleanOwnerText()` strips ticket ids (every registered project's ticket
  prefix plus the prefixes seen in the pool; `stripTicketIds` from
  `agent-coordination.ts`), `WorkItem <uuid>` mentions and bare uuids. Ids
  live on the `meta:` line, which the digest reads but never renders.
- **Who asked** (`resolveAsker`): `metadata.delegatedBy` when it is not the
  doer (kind `lead` when the session leads its team or has a lead role,
  `orchestrator` for the orc, else `agent`), plus `for the owner (<place>)`
  when the item's origin is an owner message; else the owner directly
  (origin `owner`); else `schedule "<topic>"` (origin `trigger`); else the
  ticket's `source` / the Request's origin author; else the WorkItem owner
  kind. The quote is the first line of the ticket description, the WorkItem
  description, the Request description or the brief.
- **Outputs**: URLs in the result summary, artifact evidence paths, `n checks
  passed` (zero-exit command evidence), `files` / `artifacts` / `paths` /
  `prUrl` fields, PR URLs / commits / files written from the transcript,
  `n messages posted (<place>)` from `message.outbound` trace events by the
  doer.
- **Errors**: transcript tool errors (with `fixed` when the same call later
  succeeded), `turn.error` / `error` / `guard.block` / failed `skill.call`
  trace events of the doer or the item, `retried n times` (+ last failure
  reason), the `failed` item's error. Deduped, capped.
- **Helpers**: child WorkItems (`parentWorkItemId` = this item, or
  `metadata.delegatedBy` = the doer and created inside the task window) as
  `delegated to <Name>: "<title>" → <status>`; `message.agent` trace events
  from the doer as `asked <Name>` (`answered` when the helper wrote back or a
  system message with that sender reached the doer); the verify item's
  target (or `metadata.reviewedBy`) as `reviewed by <Name>`.
- **Outcome**: `cancelled` (+ `cancelReason`), `failed` (+ `error`),
  `rejected` (by the reviewer, + verdict), `blocked` (+ `blockedReason`);
  for done / verified: Request `acceptedBy` silence or `auto_accepted` →
  `silence_accepted`; `acceptedBy` owner → `owner_verified`; a project
  ticket with `ownerReview` that is `done` → `owner_verified` (or
  `silence_accepted` on the `auto_accepted` label / a log line saying so),
  still in `review` → `waiting_owner`; else `verified` → `lead_verified` (by
  the reviewer), `done` → `done` (no review).
- **Size**: `MAX_CHARS` (2 500); the `meta:` line always fits, the text
  above it is cut at a line boundary. Secrets: `redactSensitive()` patterns
  plus the process's known secret values (`redactSecrets`). Attachment
  contents are never read; only titles, summaries, paths and URLs appear.

### B. Transcript slice (`work-record-transcript.ts`)

For items that ended within `TRANSCRIPT_MAX_AGE_MS` (48 h) and whose doer is
a Claude Code session: read the last `TRANSCRIPT_TAIL_BYTES` (2 MB) of the
transcript once per session per pass, keep main-chain entries whose
timestamp falls in `[startedAt − 60 s, endedAt + 60 s]`, pair `tool_use`
with `tool_result`: `is_error` or a non-zero `Exit code N` → an error
(`Bash \`<command ≤80 chars>\` exit N`, `Edit <relative path>`), later
success of the same call → `fixed`; `Write` / `Edit` / `NotebookEdit` file
paths → files written; GitHub PR URLs in results and assistant text;
`[branch sha]` lines after `git commit` → commits; Bash calls of a reply /
post skill → posts. Result contents are read only for the error flag, the
exit-code line, URLs and the commit line; nothing else is copied. Codex
rollouts are not read (the trace covers them).

### C. The service (`work-record.service.ts`)

- **Trigger**: in-process `task:done`, `task:verified`, `task:rejected`,
  `task:cancelled`, `task:failed` → the item is recorded after
  `EVENT_DELAY_MS` (20 s; the ticket sync, the verify item and the evidence
  land first), coalesced per id. `ProjectTicketService.onChange` → when a
  ticket reaches `done` / `cancelled`, its WorkItem is recorded (this is how
  a deferred record completes).
- **Tick** (`TICK_MS`, hourly; first `BOOT_DELAY_MS` = 3 min after start):
  finished recordable items of the last `CATCHUP_WINDOW_DAYS` (7) without a
  `final` record, newest first, at most `CATCHUP_MAX_PER_PASS` (200) written
  per pass; then items in `blocked` for longer than `BLOCKED_AFTER_MS` (24 h)
  without a `blocked` record. A `blocked` record does not prevent the
  `final` one later.
- **Recordable**: not a verify item (`<id>:verify:<id>` / `metadata.verifyOf`
  — it is folded into the parent's record as the reviewer), not a
  bookkeeping type (`check`, `reconcile`, `confirm`, `ticket_triage`,
  `autopilot_retro`, `goal_replan`, `ticket_hygiene_review`,
  `autopilot_self_review`).
- **Deferral**: outcome `waiting_owner` (ticket with `ownerReview` still in
  `review`) is not written until the ticket settles; after `DEFER_MAX_MS`
  (72 h) it is written as "finished, waiting for the owner's OK".
- **Vaults**: the project vault (`metadata.projectPath`, the ticket's
  project, else the first project of the item's / doer's team) when it has
  a `SCHEMA.md`, else the global vault; plus the team vault
  (`~/.crewly/teams/<id>/wiki`) when it exists. Written through
  `WikiIngestService.ingest` with sourceType `work_record`, `sourceRef`
  `work-record:<id>#<phase>`, `callerSession` = the doer (so "own entries"
  filters find it).
- **Idempotence**: `CREWLY_HOME/work-records-state.json` remembers the
  written refs (bounded at 5 000), seeded from the vault log's
  `work_record` entries on first touch so a lost state file does not
  double-write; the ingest path also refuses an identical body.
- `CREWLY_WORK_RECORDS=false` disables it. Boot wiring in
  `backend/src/index.ts` next to the memory refresh; the trace comes from
  `TraceStore.traceByRef('workItem', id)` / `workItem.traceId`, the
  transcript from the canvas transcript locator.

### D. Digest (`WikiLogCompileService`)

Record entries are split from learnings. Ahead of the category groups the
digest renders `### Work done (n)` (one bullet per record: title → asked by →
done by → did → outputs → outcome), `### Errors and fixes (n)` (records with
errors) and `### Collaboration (n pairs)` (per `A → B`: delegations = asker →
doer and doer → delegated helper, `ask answered` / `ask unanswered` = doer →
helper asked, review = reviewer → doer). The page summary says
`k work records and m learnings (…)`. Titles only; `meta:` lines are never
rendered.

### E. Briefing and memory

- `StartupBriefingService` adds `### Your recent work (last 7 days)`: the
  agent's last `BRIEFING_MAX` (5) records as one line each
  (`**title** — asked by X — done by Y — outputs: … → outcome`), trimmed
  after the index and recent pages but before lessons when over budget.
  Records are excluded from `### Your lessons`.
- `AgentMemoryRefreshService` skips `work_record` entries: they describe what
  the agent did, not what it learned.

## What the first start does to existing data

Measured on one machine, 2026-10-17: 1 091 recordable finished items in the
last 7 days (835 verified, 191 done, 53 rejected, 11 cancelled, 1 failed), 0
blocked for over a day. The boot pass writes the 200 most recent, the hourly
tick the next 200, so the backlog clears in about six hours. 302 of those
ended within 48 h and consult a transcript (one 2 MB tail read per distinct
session per pass). Each record also reads one ticket file and one trace
(≤ 2 000 events). Team vaults exist for 11 teams, so those records land in
two logs. No model calls; disk I/O only; nothing deleted.

Example (assembled read-only from local data, home path shortened):

```
(record) **Nova, daily ops 10/16 item 1: an in-place update to /news/perm-suspension-… (section 06, …)** — verified by Owen
asked by: Owen (team lead) — "Nova, daily ops 10/16 item 1: an in-place update to /news/perm-suspension-… (section 06, …). PREVIEW …"
done by: Nova
did: Section 06 Cloudera update drafted as preview only (draft copy https://visa.careerengine.us/analysis/preview/6ad2e…), live post untouched. Facts from DOJ release and the settlement agreement PDF: …
outputs: https://visa.careerengine.us/analysis/preview/6ad2e…; ~/…/ce-core/.crewly/findings/cloudera-update-2026-10-16/report.md; ~/…/diff.zh.patch; 1 check passed; 1 message posted (Slack)
helpers: reviewed by Owen
outcome: verified by Owen, under a minute
meta: wi=820e669a-… phase=final status=verified asked_by=ce-owen-…:lead done_by=ce-nova-… outcome=lead_verified ticket=CE-376 trace=tr-20261017-… team=5ad0642a-… helpers=ce-owen-…:reviewed outcome_by=Owen
```

## Tests

`work-record.test.ts` (asker resolution, outputs, errors with resolution,
helpers, outcomes, size cap, render / parse round trip, ticket ids kept to
the meta line), `work-record-transcript.test.ts` (window slicing, error
pairing and later success, files / commits / PR URLs / posts, caps, secret
masking, tail reads), `work-record.service.test.ts` (catch-up pass,
idempotence with and without the state file, event-driven record with
delay, deferral and ticket settle, blocked then final, skipped types and
the per-pass cap, project / team / global vault routing, trace + children +
transcript folded in, kill switch); new cases in
`wiki-log-compile.service.test.ts` (record sections, no ticket ids),
`startup-briefing.service.test.ts` (recent work section, records not
lessons) and `agent-memory-refresh.service.test.ts` (records skipped).
