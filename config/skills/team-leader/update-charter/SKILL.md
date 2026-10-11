---
name: Update Charter (TL)
description: "Write your team's charter: what it owns, what it takes, what it avoids. The orchestrator routes owner requests by it, so keep it current."
version: 1.0.0
category: management
skillType: claude-skill
assignableRoles:
  - team-leader
triggers:
  - update charter
  - team charter
  - what our team owns
tags:
  - team
  - routing
  - charter
execution:
  type: script
  script:
    file: execute.sh
    interpreter: bash
    timeoutMs: 20000
---

# Update Charter (TL Version)

The orchestrator decides which team gets an owner request by reading each team's charter next to its members and current work. A stale or missing charter sends work to the wrong team, or makes the owner name an agent by hand.

## When to run it

- Right after you take over a team, if its charter is missing or says something that is no longer true.
- When the team's focus shifts (new project, new product line, work it no longer takes).
- When you notice requests reaching you that belong elsewhere, or requests for you that never arrive.

## Usage

```bash
bash {{TL_SKILLS_PATH}}/update-charter/execute.sh '{"teamId":"{{TEAM_ID}}","charter":"Owns the CE visa-probability product: data pipeline, backend API and content. Takes bug fixes and new data sources for CE. Avoids marketing copy and anything outside CE."}'
bash {{TL_SKILLS_PATH}}/update-charter/execute.sh '{"teamId":"{{TEAM_ID}}","charter":""}'   # clear
```

## Writing a good one (400 characters max)

1. What the team **owns**: products, projects, kinds of deliverable.
2. What it **takes**: the requests it is the right place for.
3. What it **avoids**: the requests that belong to another team.

Plain words, present tense, no names of who is on vacation. Only the lead of the team, the orchestrator or the owner can write it.
