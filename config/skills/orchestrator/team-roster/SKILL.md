---
name: Team Roster
description: "Who owns what: every team's charter, members with roles and specialties, projects, channel, current work and what it finished this week."
version: 1.0.0
category: management
skillType: claude-skill
assignableRoles:
  - orchestrator
triggers:
  - team roster
  - who owns
  - which team
  - what is each team doing
tags:
  - team
  - routing
  - roster
execution:
  type: script
  script:
    file: execute.sh
    interpreter: bash
    timeoutMs: 20000
---

# Team Roster

The harness builds this from live records (team charters, members, projects, project tickets, WorkItems). No model is involved, so it is cheap and never invented. A short version is already in your start prompt; run this after a compaction, when you suspect it is stale, or when the prompt version was cut for budget.

## Usage

```bash
bash {{ORCHESTRATOR_SKILLS_PATH}}/team-roster/execute.sh            # markdown
bash {{ORCHESTRATOR_SKILLS_PATH}}/team-roster/execute.sh --json     # structured
bash {{ORCHESTRATOR_SKILLS_PATH}}/team-roster/execute.sh --fresh    # skip the 60-second cache
```

## Reading it

- **Charter** is what the team owns. `(derived)` means the lead has not written one: it was assembled from roles, projects and recent work, so trust the "Now" and "Done" lines over it.
- **Now** lists open tickets and WorkItems; **Done 7d** lists what finished this week. Recurring scheduled runs are left out.
- **PAUSED (owner)** teams are not handed work.

To route a request, use `find-owner-for`. To ask how something is going, ask the owning team's lead.
