---
name: Find Owner For
description: Rank which team and member should own an owner request, by matching it against team charters, member specialties, projects and recent tickets.
version: 1.0.0
category: management
skillType: claude-skill
assignableRoles:
  - orchestrator
triggers:
  - find owner
  - who should handle
  - route request
tags:
  - team
  - routing
execution:
  type: script
  script:
    file: execute.sh
    interpreter: bash
    timeoutMs: 20000
---

# Find Owner For

Use when the owner asks for something and names no agent. Pass their words as written (any language); matching is BM25 over team charters, names, projects, member roles and specialties, and the titles of recent tickets and work.

## Usage

```bash
bash {{ORCHESTRATOR_SKILLS_PATH}}/find-owner-for/execute.sh "record a promo video for the flopost launch"
bash {{ORCHESTRATOR_SKILLS_PATH}}/find-owner-for/execute.sh '{"request":"fix the login bug on CE","limit":2}'
```

## Output

Ranked lines: `team — hand to <lead> (likely doer: <member>) · score · matched words`.

- **Hand to** the team lead; the lead assigns the member (the "likely doer" is only a hint).
- **Clear winner:** delegate, then tell the owner whom you handed it to in one line.
- **Top two are close:** only then ask the owner which team; offer both.
- **No match:** ask the owner, or read `team-roster` and decide.
- **PAUSED (owner):** never hand it work.
