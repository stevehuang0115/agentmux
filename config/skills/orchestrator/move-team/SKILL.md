---
name: Move Team
description: Move a whole team (members, memory, tickets, wiki, schedules, Slack identity) to another machine of the owner's account. Use only after the owner said yes to a specific team and machine.
version: 1.0.0
category: management
skillType: claude-skill
assignableRoles:
  - orchestrator
triggers:
  - move team
  - move the team to
  - move to the other machine
  - move to my Air
  - migrate team to another machine
tags:
  - team
  - machines
  - migration
execution:
  type: script
  script:
    file: execute.sh
    interpreter: bash
    timeoutMs: 60000
---

# Move Team

The owner's Mac runs out of CPU or memory; another machine of the same account has room. "Move team CE to the Air" moves the whole team: members, prompts, memory and handover notes, tickets, wiki, schedules, open decisions, channels, and the agents' Slack identity. Code of git projects is cloned on the target from its git remote; projects that are not git repositories travel with their files (without node_modules and build output). Credentials and logins do not move; the owner gets a short list to reconnect. Crewly Cloud only carries an encrypted package.

## Steps (the owner is on their phone: never ask for a terminal step)

1. List the machines: `bash {{ORCHESTRATOR_SKILLS_PATH}}/move-team/execute.sh '{"action":"machines"}'`. Offer only machines with `canReceive: true`. For the others, tell the owner what `hints` says ("update Crewly on <machine>"); do not offer them as targets.
2. If the owner did not name the machine, or the name is ambiguous, ask which one (show the names).
3. Check what would block it: `... '{"action":"check","team":"CE"}'`. If a repository has unpushed or uncommitted work, tell the owner in one sentence what to push (the lines it returns) and stop. Never move with `allowDirty` unless the owner says to move without that work.
4. Ask the owner for approval in your own words, in the owner's thread: team, from which machine to which machine, and that the team stops here and starts there. Wait for a yes. A move without a yes in chat is refused by the backend.
5. Start it: `... '{"action":"start","team":"CE","to":"Air"}'`. It returns a move id and runs in the background.
6. Do not narrate progress in the owner's thread. Crewly Cloud sends the owner one summary (what moved, what to reconnect, a rollback link) when it is done.

## Actions

| Parameter | Used by | Description |
|-----------|---------|-------------|
| `action` | all | `machines`, `check`, `start`, `status`, `moves` |
| `team` | check, start | Team name or id on this machine |
| `to` | start | Target machine name (from `machines`) |
| `moveId` | status | A move id |
| `allowDirty` | start | `true` only on the owner's word: move although a repo has unpushed work (that work stays here) |
| `skipFlagged` | start | `true` to leave out notes that hold credentials instead of stopping |

## Rollback

Within 7 days the owner can undo a move from the portal ("Moves") or by asking you. Rolling back is the owner's call: it needs the owner's tap, not yours.
