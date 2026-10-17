# The wiki log, the ingest queue and agent memory

What Crewly does on its own with the "maybe useful" tier of knowledge, and
the switches for it. Design: `specs/2026-10-17-wiki-log-memory-hygiene.md`.

## The vault activity log (`llm-curated/log.md`)

- Agents append learnings here when something is not worth a page yet.
  Templated records (a WorkItem state transition, a "Task completed" stub)
  and identical repeats are refused at the door.
- **Search reads it.** `wiki-query`, `recall` and the Wiki search rank the
  entries of the last 30 days one by one, below pages of equal relevance. A
  hit looks like `llm-curated/log.md#2026-10-17T02:18:57.704Z`.
- **It is rotated.** Over 2 MB or 2000 entries, the file moves to
  `llm-curated/log-archive/log-YYYY-MM-DD.md` (kept, never searched) and a
  fresh log starts with the last 30 days of real entries.
- **It is compiled.** Once a day the week's new entries become
  `llm-curated/digests/<ISO week>.md`, grouped by topic and indexed. Promote
  what still matters into its own page; the digest is a starting point.

## The ingest queue (`~/.crewly/wiki-queue/`)

Items an agent queued with `wiki-queue-add` that nobody claimed within a day
are filed into their vault's log by the backend (content, the agent's
reason, original source) and marked processed. The LLM classification path
(`WikiWorkItemBridgeService`) is optional; when it is on, agents get the
first 24 hours.

## Agent memory

Once a day each active agent's own recent log entries are reflected into
its `memory.json` (gotchas as anti-patterns) and, for gotchas and
decisions, into the project's memory. At registration an agent gets
`## Your Project Knowledge`: owner threads waiting on it, its lessons of the
last 7 days, the recently changed pages and the wiki index.

## Switches

| Env | Effect |
|---|---|
| `CREWLY_WIKI_MAINTENANCE=false` | No drain, rotation or compile. |
| `CREWLY_AGENT_MEMORY_REFRESH=false` | No daily memory refresh. |
| `WIKI_BRIDGE_ENABLED=false` | No LLM classification WorkItems (the drain still runs). |

State files under `~/.crewly/`: `wiki-maintenance-state.json`,
`agent-memory-refresh-state.json`; per vault `.wiki-compile-state.json`.
