# Team leads delegate instead of doing the work (crewly#1083)

Status: implemented on `feat/tl-delegation`.

## Problem

Measured 10/03–10/04 in `token-usage.json`: Think Tank's lead Atlas used
1384 turns / 306M context tokens against Sage 132 / 16M and Kai 42 / 5M;
Marketing's lead Ella 1201 / 174M against Luna 267 / 33M. WorkItem counts
say delegation happens; the cost is leads executing owner Slack-thread
requests themselves (owner DMs and un-@ channel messages route to the lead),
at ~220k context per lead turn.

Two reasons a lead keeps the work:

1. **To keep the owner informed.** The answer has to land in the owner's
   thread, so the lead keeps the work rather than relaying.
2. **The "who does what" rule.** "Delegate by role … take a ticket yourself
   … when no member fits" made Atlas treat app-building as unfit for his two
   `researcher` members and build the app himself. Every member runs the same
   runtime and can code; role is a preference, not a limit (owner decision
   2026-10-04).

## 1. The delegated member answers in the owner's thread

Already in place: a WorkItem created while the creator answers the owner
inherits `metadata.origin = {kind:'owner', conversationId, slackChannelId,
threadTs}` (TaskPoolService.inheritOrigin, from the creator's last owner
turn), and `reply --work-item <id>` resolves to that origin.

Added:

- **Explicit thread.** `delegate-task --thread <key>` (the
  `[SLACK-THREAD:<key>]` of the owner message) stamps the owner origin from
  that key, so a lead that answered other messages meanwhile still hands over
  the right thread. Body field `ownerThread` (or `metadata.ownerThread`); the
  conversation is the creator's turn origin when it is the same thread, else
  the conversation the Slack channel maps to. An unreadable key is ignored
  (the normal inheritance applies).
- **The member is told.** `POST /api/task-pool/add` answers with
  `data.ownerThread = {key, note}` when the stored item's origin is an owner
  Slack thread; `delegate-task` appends the note to the delivered brief:

  > The owner asked for this in Slack thread [SLACK-THREAD:<key>]. Post your
  > progress and your result there yourself, under your own name: `reply
  > --work-item <id> "<message>"`. <Lead> does not relay it for you.

- **The reply gate lets the member through.** The one-responder gate
  (`heldReplyFor`) held a post when another chosen responder (the lead)
  already answered the owner's latest message. An agent holding a live
  WorkItem (queued / accepted / running / blocked, or done within the last
  hour) whose owner origin is this thread was handed the message, so its post
  is never held.
- **DM threads.** A member's bot cannot post in the owner's DM with the lead.
  When the destination is another agent's owner DM, the reply goes to the
  member's own DM with the owner, opened with `*Re: <work title>*`. Logged as
  a fallback; never silent.

The lead prompt says: when you delegate an owner request, pass `--thread`
and let the member answer in the thread; do not keep work to keep the owner
informed.

### 1a. A delegation is the owner's only when the lead says so (crewly#1357)

**Incidents, 2026-10-17.** 12:54Z: Ella delegated "Refresh today's X reply
prep" to Lyra on her own initiative; the item inherited an owner DM from
2026-10-08 (her running item's origin) and Lyra's internal completion report
went to the owner, footed "Triggered by your request". 15:47Z: Ella delegated
two items while answering the owner in the #awesome-videos 「什么是投资」
thread; both inherited that thread, and when they finished with no report the
harness posted "Ella finished: <WorkItem titles> Results: <PR link, codec,
file sizes> — sent by Crewly because no report was posted" into the video
thread.

**Rule.** For a delegation (an agent adds an item whose target is not
itself — `X-Agent-Session` or `metadata.delegatedBy`):

- It takes an owner origin only when the delegator names the place:
  `--thread <key>` (`metadata.ownerThread`, Slack key, tag or chat message id)
  or `--conversation <id>` (`metadata.ownerConversation`, chat conversation;
  the delegator's turn there supplies the thread and Slack place). Or when it
  continues a parent item (verify / retry / subtask) that has one.
- A named place is not taken when the owner last wrote there more than
  `WORK_ITEM_DESTINATION_CONSTANTS.ORIGIN_INHERIT_MAX_AGE_MS` (2 h) ago. The
  age is the delegator's own turn there, else the newest owner message in the
  place (`TaskPoolService.setOwnerAskedAtLookup`, chat-v2); unknown ages are
  taken as given. A verbatim `metadata.origin` in the body is kept as it is.
- Otherwise the origin is the delegator: `{ kind: 'agent', sessionName }`.
  The delegator's fresh owner turn, owner request context (app comment /
  hand-over) and running work are never consulted for a delegation. A
  ticket-linked delegation keeps the ticket as origin.
- The member's `reply --work-item <id>` for an agent origin reaches the
  delegator as an internal `[RESULT] From <member> about WorkItem …` message
  (`setAgentMessenger`, `deliverToWorkDestination` kind `agent`); it is not a
  Slack place. `POST /api/task-pool/add` answers `data.resultRoute = {to,
  note}`, which `delegate-task` appends to the brief ("Report your result to
  <lead>… Do not post it to the owner.").
- Items an agent creates for itself keep the existing inheritance (fresh turn
  → context → running work), except that an owner origin read off running
  work older than 2 h is dropped.
- Harness-created items (dispatcher auto-route, scheduled owner follow-ups,
  ticket auto-route, verify / retry items) are unchanged.

**Completion report.** `OwnerCompletionReportService` only ever reports
chains of genuine owner origins, so agent-origin work is never reported to
the owner. For a genuine chain: ONE nudge to the responsible agent (plain
words, in the owner's language, no ids / links / paths / sizes), then after
`OWNER_COMPLETION_REPORT_CONSTANTS.NUDGE_GRACE_MS` (30 min) with nothing
posted, one line for it: the deliverable in plain words (first clause of the
item's summary or title; URLs, uuids, 8+-hex ids, ticket ids, paths, file
names, code spans and parentheses holding digits removed —
`owner-completion-report.text.ts`), in the owner's language (read off the
owner's own messages in that thread, else their recent messages; default
English), plus a short marker: "Ella 做完了排期里 5 张卡的文案和教程页的录屏，
细节稍后补在这里。 — 由 Crewly 代发" / "Ella finished …; the details will
follow here. — sent by Crewly". No second reminder, no "Results:" dump.

## 2. Execution nudge

Signal: the Claude Code agent-status hook (already installed per session,
`config/hooks/agent-status/report.sh`) reports `PostToolUse`. It now also
sends `tool_name` (a plain identifier; nothing else from the payload) and,
for `PostToolUse` only, reads the response. The backend counts file-edit
tools (`Edit`, `Write`, `MultiEdit`, `NotebookEdit`) per lead session in a
sliding window; at `EDIT_THRESHOLD` (6) edits within `WINDOW_MS` (20 min) it
returns `additionalContext`, which the hook prints as
`hookSpecificOutput.additionalContext` — Claude Code adds it to the model's
context after that tool call. It never blocks: the tool already ran, any
failure drops the note.

- Only team leads (team `leaderIds`, else a lead role) of a team with at
  least one other member are nudged.
- At most one nudge per lead per `NUDGE_COOLDOWN_MS` (30 min).
- The note names the best-fit members: idle first, then stopped (available),
  then working; at most 3, with their role.
- Counted per lead: nudges, and nudges followed by a delegation (a WorkItem
  added with that lead as delegator, to another session) within
  `FOLLOW_WINDOW_MS` (30 min). Persisted in
  `$CREWLY_HOME/tl-delegation.json`.

Not covered: Codex / Gemini / in-process runtimes (no PostToolUse hook);
long builds or renders (the hook does not send the command — tool inputs are
never sent).

Note text (English):

> [CREWLY-NUDGE] You have edited files 6 times in the last 20 minutes. As
> team lead, hand hands-on work to a member: Sage (researcher, idle), Kai
> (researcher, stopped — starts when assigned). Any member can do any work
> that needs no special account, tool or permission. Delegate with
> delegate-task (pass --thread <key> for an owner request). Keep it only if
> the change is tiny, every member is busy, or it needs your own judgment —
> then record why: delegate-task --no-member-fits "<what is missing>" --task
> "<the work>".

## 3. Lead share in the daily report

`computeLeadShares(teams, ledger, now)`: per team (≥ 2 members), the lead
sessions' tokens (`eventTokens().total`, cached input included) over the
team's, today (local midnight) and the last 7 days. `flagged` when the share
is over 50% with a team total of at least `MIN_TEAM_TOKENS`.

- The evening "Tickets today" digest gets a "Team leads" block: one line per
  team with a lead share, marked "over half" when above 50%; plus nudges / delegated-after
  and the lead's kept-work records for the day.
- `GET /api/teams/:id/lead-share` returns the team's row, nudge counts and
  the last records; the team page shows it under More → "Lead share".

## 4. "No member fits" is recorded

`delegate-task --no-member-fits "<reason>" --task "<work>" [--work-item <id>]
[--ticket <ID> --project <path>]` posts to `POST
/api/teams/lead-self-work`: the lead's session (X-Agent-Session), team,
reason and work, kept in `$CREWLY_HOME/tl-delegation.json` (last 500). With
`--work-item` a `[NO-MEMBER-FITS] <reason>` note is added to that WorkItem.
Nothing is delivered. The reason must name what is missing (access, tool,
permission, everyone busy, lead judgment) — a role mismatch alone is not a
reason (the prompt says so; not enforced by code).

The daily digest lists the reasons per team so the owner sees missing roles.

## 5. Prompt rule ("who does what")

Replaced everywhere it is stated (`prompt.md`, `tl-addon.md`,
`fragments/role-boundary.md`, `delegate-task/SKILL.md`, the triage brief
`TICKET_AUTOPILOT_ASSIGNMENT_GUIDANCE`, the tech-lead default prompt):

> Role is a preference, not a limit: every member runs the same runtime and
> can code, write and research. Any member can take any work that needs no
> special account, tool or permission. Prefer an idle (or stopped) member
> over doing it yourself. Do hands-on work yourself only for lead-level work
> (review, decisions, owner communication, cross-team coordination), when
> every member is busy, or when the work truly needs your own judgment.
> "No member fits" is rare: record it with what is missing.

Tests assert the prompt files carry the rule and not the old "whose role
fits" wording.
