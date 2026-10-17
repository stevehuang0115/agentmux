# Agent conversation continuity (crewly#1344, 2026-10-17)

## Why

Plain Claude Code keeps one conversation and compacts it itself at 350k tokens
(Crewly sets `autoCompactWindow` to 350k). Crewly reset member conversations
far more often than that and replaced each one with a 16k-character handover
tail. Audit of one machine's logs and `~/.crewly/handover/`, 2026-10-16/17:

- per-task `/clear`: 137 in 48 h, no minimum size (seen at 56k);
- fresh start at relaunch past 150k: 58 in 48 h; idle cap past 200k: 17;
- a switch between Claude Code accounts (`claude-code` ↔ `claude-code@<acct>`,
  a different `CLAUDE_CONFIG_DIR`) always started fresh: the transcript stayed
  in the other account's config dir;
- a team move left transcripts out, so every agent arrived blank; the Slack
  room's chat channel was not recreated (404 on its messages) and the team
  arrived with no project;
- churn in 9 h: 50 idle stops at 10 min, 29 memory-pressure stops, 32 slot
  evictions, some at `idleMinutes: 0`;
- the Slack "thread so far" block had no root message, 500 chars per message,
  bare file names for attachments;
- an owner-thread record from a team that had moved away was re-stamped
  "restarted" on every boot for ten days.

The owner approved every change below, including the larger contexts they cost.

## Rules

### 1. Resets are a safety net above Claude's own compaction

| Reset | Before | Now | Env |
|---|---|---|---|
| Member fresh start at launch | 150k | **400k** | `CREWLY_MEMBER_FRESH_CONTEXT_TOKENS` |
| Member idle-boundary cap | 200k | **450k** | `CREWLY_MEMBER_CONTEXT_CAP_TOKENS` (`0` off) |
| New-task `/clear` floor | none | **≥ fresh-start threshold** | same as fresh start |
| Orchestrator fresh start | 300k | 300k | `CREWLY_ORC_FRESH_CONTEXT_TOKENS` |

`FRESH_TASK_CONVERSATION_CONSTANTS` (backend/src/constants.ts) holds the
defaults. `decideFreshConversation` gets `contextTokens` (the last turn of the
current transcript) and `minContextTokens`; an unknown size is not cleared.

### 2. Never clear into an owner conversation

`OwnerThreadSentinelService.ownerActiveRecently(agent)`: the owner wrote to
the agent in a watched thread, or the agent promised the owner something
there, within `OWNER_ACTIVE_MS` (2 h), answered or not. `prepareForTask`
reads it (`FreshTaskDeps.ownerConversationActive`) and keeps the conversation
(`reason: 'owner conversation'`).

### 3. An account switch keeps the conversation

`RuntimeFallbackDeps.carryConversation` (wired by
`runtime-fallback.wiring.carryClaudeConversation`): when both targets run
Claude Code, `copyClaudeConversation` copies
`<from home>/projects/<cwd slug>/<id>.jsonl` and its sidecar folder `<id>/`
into the target account's config dir (`~/.crewly/claude-accounts/<acct>` or
`~/.claude`), under the same slug. `recordSwitch` then keeps the conversation
id instead of clearing it; `planRuntimeSession` checks `conversationExists`
under the account the session runs on now (`claudeHomeOverride`) and passes
`--resume <id>`. The kickoff note says "Your conversation came with you". The
revert (`doRevert`, `finishRevertOffline`) copies the conversation that went
on on the fallback account back and resumes it; the primary's pre-switch id is
the fallback when the copy fails. Any other hop, or a failed copy, starts
fresh with the handover as before. Only the transcript moves — never
credentials, settings or history.

### 4. A team move carries the conversation (and the room, and the projects)

- `team-move-transcripts.collectAgentTranscripts`: each Claude Code member's
  current conversation (session state, else `last-conversations.json`) is
  staged as `transcripts/<session>/<id>.jsonl` (+ sidecar) when under
  `TEAM_MOVE_CONSTANTS.TRANSCRIPT_MAX_BYTES` (64 MiB); `manifest.conversations`
  lists it or the reason it was skipped.
- `importAgentTranscript` writes it under the target's Claude home for the
  member's cwd there (paths rewritten line by line) and records it in
  `last-conversations.json`; the first launch resumes it.
- The room behind the Slack mapping always travels (`readTeamChat
  includeChannelIds`), with its newest 500 messages (4 MiB cap,
  `records/chat-channels.json#messages`), written with `INSERT OR IGNORE`.
- `SlackTeamChannelService.healMissingChatChannels` runs at start: a mapping
  whose chat channel does not exist gets a fresh huddle with the known roster
  (logged, saved).
- `bindProjects`: a project the team lists that did not come along gets a
  placeholder `<projects root>/<name>-NEEDS-PATH`, stays in `projectIds`, is
  named in the report, and the owner gets one DM (`ImportDeps.notifyOwner`).

### 5. Calmer churn

- `RESOURCE_MODE_CONSTANTS.MIN_IDLE_BEFORE_EVICT_MS` (5 min): never a slot
  victim, not for an owner-message waiter, not when the rules relax; only
  critical memory overrides. #1335's start-window, hysteresis and waits-on
  rules are unchanged.
- `owesOwnerThread` (index.ts) also counts `ownerActiveRecently`: an agent
  the owner spoke to in the last 2 h is not evicted for a slot.
- `AGENT_SUSPEND_CONSTANTS.OWNER_THREAD_IDLE_TIMEOUT_MINUTES` (30): such an
  agent waits at least 30 minutes before an idle stop, whatever the configured
  or pressure timeout says. Memory-pressure and critical stops still apply.

### 6. Thread block

`SLACK_THREAD_CONTEXT_CONSTANTS`: `BLOCK_PER_MESSAGE_CHARS` 1,500, `MAX_CHARS`
12,000, `MAX_MESSAGES` 40, `ROOT_MARK`. The root message always opens a thread
block (when the read started at the root), followed by "… N older messages
omitted …". Attachments: `describeSlackFiles` → kind (image / video / audio /
PDF / `<type> file`), file name, title, alt text. The member path appends
`[Full thread: chat channel <id>, thread <id> — read it with search-chat …]`.

### 7. Handover file

`ORC_CONVERSATION_CONSTANTS`: 60 messages × 2,000 chars, 40k total,
`HANDOVER_TOOL_RESULT_CHARS` 200. `buildHandoverSummary` adds one line per
tool call (`↳ <tool>: <input…>`) and tool result (`↳ <tool> result: <text…>`),
images as `[N images returned]` / `[image attached]`.

### 8. Owner-thread sentinel hygiene

`STALE_AFTER_MS` (3 days, no owner activity) and
`OwnerThreadSentinelDeps.agentOnThisMachine` drop entries at load and on each
tick; `owingAgentsOnDisk` / `ownerThreadSessionsAtBoot` apply the same
filters (`liveAgentSessions`, `movedAwayTeamIds` from `team-moves/*/state.json`).

## Not done / open

- A live cross-account `claude --resume` was not exercised end to end here (a
  scratch `CLAUDE_CONFIG_DIR` has no login); the copy is proven at file level
  (`conversationExists` finds the copy under the target home) and the launch
  path already looks there.
- Codex and Antigravity conversations are not relocated by a team move.
- Chat history outside the team's Slack room still stays on the source.
