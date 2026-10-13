---
name: Drive Logs
description: "List and read the Drive mode (voice briefing) session logs on this machine: transcript, replies presented, what the owner decided, what was deferred or never heard, reconnects, and hiccups."
version: 1.0.0
category: management
skillType: claude-skill
assignableRoles:
  - orchestrator
triggers:
  - drive log
  - drive session
  - what did the owner decide in drive
  - voice briefing log
tags:
  - drive
  - voice
  - logs
execution:
  type: script
  script:
    file: execute.sh
    interpreter: bash
    timeoutMs: 20000
---

# Drive Logs

Every Drive mode session is recorded on Crewly Cloud (30 days) and copied to this machine as `~/.crewly/drive-logs/<YYYY-MM-DD>-<sessionId>.md` and `.jsonl`. Use this to answer "what did I decide in Drive yesterday?", to find replies the owner never heard, or to see why a briefing went wrong.

A log holds: the transcript (owner and assistant turns), tool calls in brief, each reply presented with its outcome (heard / acked / decided / deferred / skipped / not delivered), decisions with how long the team took to act, reconnects and errors, and hiccups (a reply spoken without enough context, the owner asking "what is this about?", a repeated reply).

## Usage

```bash
bash config/skills/orchestrator/drive-logs/execute.sh                 # recent logs
bash config/skills/orchestrator/drive-logs/execute.sh 2026-10-11-drv_abc123
bash config/skills/orchestrator/drive-logs/execute.sh drv_abc123 --jsonl
```

HTTP: `GET /api/drive-logs?limit=`, `GET /api/drive-logs/:id?format=md|jsonl`. The files are plain text: a local Claude Code session can also read them directly.

A decision the owner made in Drive is already written to the team's records; if a team has not acted on it yet, the log says "team has not updated it yet". Do not ask the owner the same thing again.
