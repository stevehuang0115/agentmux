# Team roster: the orchestrator knows who owns what

Status: implemented in this change. Owner feedback: "the orchestrator does not really know what each team is doing or responsible for, so every time I have to direct it to the right agent myself."

## Problem

At boot the orchestrator saw, about teams: `get-team-status` (compact: team id, name, **project UUIDs**, members with name/role/status). No description, no charter, no projects by name, nothing about current work. `list-colleagues` is for agents on other machines. The start prompt carried Active Work, Standing Answers and the soul, but nothing that said which team owns what. So a request that named nobody had nothing to route by, and the only fallbacks were guessing or asking the owner.

Meanwhile every needed fact already existed in the harness: team `description` / `mission` / `ownershipScope` / `serviceContract`, members' roles and skills, projects, project tickets (`team`, `assignee`, status) and WorkItems.

## Design

A harness-built roster, no LLM, rebuilt on demand and cached for 60 s.

- **Builder** (`services/team-roster/team-roster.builder.ts`, pure): teams, projects, tickets, WorkItems, Slack channels in; per team a charter, leads, members (role, specialties), projects, channel, open work, work finished in the last 7 days, backlog size.
- **Charter precedence**: the lead-written `Team.charter` (new, <= 400 chars) > `description` (if it says something; CJK counts per character) > a charter derived from roles, projects and recent titles (marked `(derived)`). `ownershipScope`, `serviceContract` (takes / avoids) and a distinct `mission` are appended.
- **Work attribution**: ticket `team`, else assignee session, else the only team on the ticket's project; WorkItem by target session or `metadata.teamId`. A WorkItem linked to a ticket is shown once, as the ticket. Harness bookkeeping (verify / retry / follow-up / standing-answer refresh / watchers / goal replans) and recurring trigger runs are not listed (trigger runs are counted).
- **Render under a token budget** (`PROMPT_MAX_TOKENS` = 2500, CJK counted per character). Detail tiers, richest first: 4 open + 3 done + long charters, then 2 + 1, then counts only, then short charters and no specialties; if still over, the least active teams collapse to a "not detailed" line naming them.
- **Matching** (`findOwnersFor`): BM25 over each team's charter, name, projects, member roles / specialties / briefs and recent titles, a flat boost for a request that names a member or team, stop words and CJK filler characters removed. Result: ranked teams, the lead to hand it to, a likely doer, matched words, `paused`, and `ambiguous` when the runner-up scores within 85% of the best.

## Surfaces

- Prompt module `team-roster` (orchestrator only, priority 1.8, compactable): re-read at every orchestrator registration, which covers restarts and fresh-conversation handovers.
- SessionStart hook: after a `compact` or `clear`, the orchestrator's hook response carries the roster as `additionalContext` (`config/hooks/agent-status/report.sh`).
- API: `GET /api/team-roster` (markdown, `?format=json`, `?fresh=1`), `GET /api/team-roster/find?q=`, `PUT /api/teams/:id/charter`.
- Skills: `team-roster`, `find-owner-for` (orchestrator); `update-charter` (team leader).
- Rules: orchestrator prompt ("Task Routing"), recovery fragment, team-leader addon (keep the charter current).

## Rules the orchestrator follows

1. The owner names nobody: route it from the roster to the best team's lead and say whom in one line.
2. Ask the owner only when two teams are genuinely equally plausible.
3. "What is the status of X": ask the owning team, do not answer from roster titles.
4. Never hand work to a paused team; the approval boundary still applies to routing.

## Charter writes

`PUT /api/teams/:id/charter { charter }`: the owner, the orchestrator, or a lead of that team. Empty clears it. Stored with `charterUpdatedAt` / `charterUpdatedBy`. The roster cache is dropped on write.

## Not in scope

- Cross-machine colleagues (`list-colleagues`): other instances' teams are not in this roster.
- Learning routing from outcomes (which team actually finished what the roster predicted).
- Rewriting stale descriptions: the roster shows current work next to the charter so staleness is visible, and the team-leader prompt asks leads to keep their charter current.
