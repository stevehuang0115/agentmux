# Wiki log hygiene, queue drain, memory refresh, startup knowledge (2026-10-17)

Status: implemented (crewly#1345). Extends `specs/wiki-knowledge-base.md`
(page contract, retention gate, queue) and `specs/2026-09-26-startup-briefing-modular-prompt.md`
(where briefings travel in the registration prompt).

## Problem

Measured on one machine, 2026-10-17:

| Finding | Evidence |
|---|---|
| `llm-curated/log.md` is write-only noise | Project vault log 19 MB / 152k lines / 8.3k entries; 6.2k are `system:auto-learning` records of the shape `[pattern] [[WorkItem-…]] task:done running→done. timestamp=… Source: …`; 3.3k exact duplicate lines. Global vault log 6.6 MB. |
| Search never reads the log | `wiki-vault-walk` treats `log.md` as a seed file; `wiki-search`, `wiki-query` and recall rank pages only. The curation rule still sends "maybe useful" content to the log. |
| Pages barely change | 173 pages, 2 changed in 3 days. Bookkeep fires at 10 net-new pages (never); reflect wakes the orc, which queues items nobody drains. |
| The ingest queue is stuck | 219 pending items (oldest a month old), 130 already dead-lettered. The queue's only consumer, `WikiWorkItemBridgeService`, turns items into WorkItems for an agent's LLM and is switched off (`WIKI_BRIDGE_ENABLED=false`); the sweep lived inside its tick. |
| Agent memory is stale | `memory.json` moves only on an explicit remember/record-learning; the consolidation sweep writes an empty report; the startup briefing carries session memory and active work only. |

## Design

Everything below is code in the backend, runs without an LLM, is dry-run
capable, and deletes nothing.

### A. No noise at the source

- `AutoLearningSubscriber` (`backend/src/services/memory/auto-learning.subscriber.ts`)
  keeps its subscriptions, category map and idempotency, but logs one
  structured `AutoLearning transition` line instead of calling
  `recordLearning`. The transition stays in observability where it is useful.
- `isNoiseLogBody()` (`backend/src/services/wiki/wiki-log-entries.ts`) names
  the content-free shapes: templated transitions and `Task completed:` stubs.
  `MemoryService.recordLearning` drops them before project learnings;
  `WikiIngestService` refuses them for `log.md` with reason `content_free`.
- Conversation-handover snapshots (`**Conversation handover — <agent> — task <id>**`,
  mirrored by the fresh-conversation path; ~1 000 a week in the global vault
  on the measured machine) are state, not knowledge: `isHandoverLogBody()`
  keeps them out of search, the digest, memory refresh and the briefing.
  They stay in the log and are carried through a rotation, since an agent
  may be pointed at one.
- `WikiIngestService` dedupes `log.md` appends: a bounded set of recent body
  keys per log (seeded from the file tail on first use) refuses an identical
  body with reason `duplicate`. A rotation resets the set.

### B. Rotation (`WikiLogRotationService`)

When `log.md` is over `WIKI_LOG_CONSTANTS.ROTATE_MAX_BYTES` (2 MB) or
`ROTATE_MAX_ENTRIES` (2000): the file moves unchanged to
`llm-curated/log-archive/log-YYYY-MM-DD.md` (`-2`, `-3` on the same day) and a
fresh log is written with the standard header, a rotation marker line, and
the non-noise, deduped entries of the last `CARRY_FORWARD_DAYS` (30) days,
capped at `CARRY_FORWARD_MAX_ENTRIES` (500), oldest first. Every walker
(`walkCuratedPages`, search, bookkeep, lint, recent, backlinks, cleanup)
skips `log-archive/`.

### C. Retrieval and compile

- **Search.** `WikiSearchService.collectDocs` never treats `log.md` as one
  document. `collectLogEntryDocs(vault)` yields one virtual document per
  non-noise entry of the last `SEARCH_WINDOW_DAYS` (30), newest first,
  capped at `SEARCH_MAX_ENTRIES_PER_VAULT` (300), scored with BM25 and
  multiplied by `SEARCH_ENTRY_WEIGHT` (0.6) so a page of equal relevance
  ranks first. A hit's path is `llm-curated/log.md#<ISO timestamp>`; its
  snippet comes from the entry. Recall (`MemoryService.wikiRecallSearch`)
  and `wiki-query` candidates (`WikiQueryService.findCandidatePages`) use the
  same documents; `wiki-query` explains the pseudo path in `callerNotes` and
  drops noise from `recentLog`.
- **Compile (`WikiLogCompileService`).** Once a day per vault: the
  non-noise, not-yet-compiled entries of the last `COMPILE_WINDOW_DAYS` (7),
  at least `COMPILE_MIN_ENTRIES` (3), at most `COMPILE_MAX_ENTRIES` (150),
  grouped by `<category> / <topic>` (category from the `(gotcha)` /
  `(decision)` prefix; topic from a `[[wikilink]]`, a bold lead, or the
  category), are written through `WikiIngestService.ingest` to
  `llm-curated/digests/<ISO week>.md` with `title`, `summary`,
  `keep_because: reusable_method`, so the page is indexed and has history.
  A later run in the same week appends. Compiled body keys are kept in
  `<vault>/.wiki-compile-state.json` (bounded) so nothing is compiled twice.
- Bookkeep and reflect are unchanged: reflect's output (queue items) now
  lands in the log through D and is retrievable; the deterministic compile
  replaces the page-count-gated bookkeep as the thing that turns the log
  into pages. An agent may still rewrite a digest into a topic page.

### D. Queue drain (`WikiQueueDrainService`)

Root cause: the queue's only consumer was the bridge (LLM path, switched
off), and the sweep ran inside its tick. The drain is the code path:

- every hourly tick, pending items older than `DRAIN_MIN_AGE_MS` (24 h, so
  an agent with the bridge on still gets first pick), oldest first, up to
  `DRAIN_BATCH_SIZE` (100) per pass with `DRAIN_ITEM_PAUSE_MS` between
  items;
- each item is claimed by `system:wiki-queue-drain`, then its content plus
  `_Why kept (<agent>):_ <reason>` is appended to the vault's `log.md` under
  the original source type, ref and queueing agent, and the item is marked
  `processed` with `targetPath: llm-curated/log.md`;
- a content-free item, a duplicate, or a confidentiality refusal is marked
  `skipped` with the reason (never the value);
- an item whose vault has no `SCHEMA.md` is left pending for the sweep;
- `WikiQueueService.sweep()` runs after each pass (claim release, 30-day
  expiry to dead-letter, per-vault backlog), independent of the bridge;
- idempotent through the queue's status transitions; one summary log line
  per pass.

### E. Agent memory refresh (`AgentMemoryRefreshService`)

Daily, plus a delayed boot catch-up, for every active member and the
orchestrator: the agent's own non-noise entries since its last run (first
run: last 24 h) in the project vault it works in and the global vault are
reflected into `memory.json` role knowledge (`(gotcha)` → `anti-pattern`,
otherwise `best-practice`; `learnedFrom`/`evidence` = the entry ref;
confidence 0.5; `addRoleKnowledge` reinforces a similar existing entry, so a
re-run adds nothing), capped at `MAX_ENTRIES_PER_AGENT` (10) per run.
Gotchas and decisions also go to the project's memory (`addGotcha`,
`addDecision`, both deduped). `standing.md` stays agent-written: the moved
memory watermark is what raises the existing standing-refresh WorkItem.
State: `CREWLY_HOME/agent-memory-refresh-state.json`.
`CREWLY_AGENT_MEMORY_REFRESH=false` disables it.

### F. Startup knowledge (`StartupBriefingService`)

Registration adds one section, `## Your Project Knowledge`, after the
session briefing (same `sessionBriefing` module, compactable), capped at
`STARTUP_BRIEFING_CONSTANTS.MAX_CHARS` (12 000):

1. owner threads waiting on the agent, from the owner-thread sentinel
   (unanswered owner message, standing promise, open card) — never cut;
2. the agent's lessons of the last 7 days: role knowledge plus its own
   entries in the project and global vault logs, deduped, newest first, up
   to 12;
3. the most recently changed topic pages (title + summary, up to 5);
4. the project wiki index, one line per page, trimmed to 4 000 chars.

Over budget, the index is trimmed first, then recent pages, then lessons.
The hook in `agent-registration.service.ts` is one try/catch next to the
existing session-briefing block.

### Scheduler (`WikiMaintenanceService`)

Hourly tick: drain every tick; rotation then compile for every discovered
vault once per `MAINTENANCE_DAILY_MS` (24 h), and on the first tick after
boot when the last daily pass is older than that. First tick
`MAINTENANCE_BOOT_DELAY_MS` (90 s) after start. State:
`CREWLY_HOME/wiki-maintenance-state.json`. `CREWLY_WIKI_MAINTENANCE=false`
disables it. Every step is non-fatal.

## What the first start does to existing data

- Rotates every vault log over the caps (on the measured machine: the
  project vault's 19 MB and the global vault's 6.6 MB) into
  `log-archive/`, carrying forward at most 500 recent non-noise entries each.
- Files the pending queue backlog into the vault logs: 100 items per hourly
  pass, so ~220 items clear within three hours; items for a vault without a
  `SCHEMA.md` stay pending until the 30-day sweep dead-letters them.
- Writes one digest page per vault with ≥ 3 uncompiled entries in the last
  7 days.
- Refreshes every active agent's `memory.json` from its last 24 h of
  entries (≤ 10 entries each).

No model calls; disk I/O only; nothing deleted.

## Tests

`wiki-log-entries.test.ts`, `wiki-vault-walk.test.ts`,
`wiki-log-rotation.service.test.ts`, `wiki-log-compile.service.test.ts`,
`wiki-queue-drain.service.test.ts`, `wiki-maintenance.service.test.ts`,
`agent-memory-refresh.service.test.ts`, `startup-briefing.service.test.ts`;
new cases in `wiki-search`, `wiki-query`, `wiki-ingest`, `memory.service`;
`auto-learning.subscriber.test.ts` rewritten for observability-only.
