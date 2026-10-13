# Canvas links, projects and recency (machine side)

Follow-up to the canvas machine side (#1247). Wire contract: CANVAS-V2-CONTRACT.md (shared with Cloud and web).

## What the owner asked for

1. Reporting lines per team (team lead -> members, orchestrator -> team leads).
2. Collaboration lines between agents: delegations, messages, shared ticket work.
3. The project(s) a team and an agent work in, to group by project.
4. When each agent was last active, so the UI can fold long-idle agents.

## Design

- `BoardSnapshot.links` is the full set; deltas carry `links` (upserts) and `removedLinks` (identities `kind|from|to`).
- Reporting, delegation and shared-ticket links are computed from data a full build already reads (teams, WorkItems, tickets, current tasks) - no extra disk reads. Delegator = WorkItem `metadata.delegatedBy`, else `orchestrator` owner -> `crewly-orc`, else `team_lead` owner -> the target's team lead.
- Messaging links come from an in-memory recorder (sender, receiver, time; never contents): the terminal-write API (what `send-message` calls) with an agent identity, and agent chat messages that @mention another agent. Two-hour window; "active" = last message within 10 minutes.
- Deltas recompute links only after a message was recorded and diff against what Cloud already has. Everything else rides the 60 s snapshot.
- Cross-machine colleagues use `<session>@<instanceId>` and are accepted wherever the machine knows both parts. No source feeds them yet (see gaps).
- `projects` on teams (Team.projectIds) and agents (current WorkItem `metadata.projectId`, else the team's projects, `projectKnown` tells which). `lastActiveAt` = now while working, else the newest tool step or WorkItem activity, at minute granularity so a working agent's row does not change on every delta.

## Gaps

- Slack @mentions between agents and messages from agents on other machines are not recorded as messaging links: chat-v2 does not store agent @mentions in `mentions`, and remote agents are only known by display name.
- Agent -> agent delegation without `delegatedBy` and without a `team_lead` / `orchestrator` owner is not linked.
