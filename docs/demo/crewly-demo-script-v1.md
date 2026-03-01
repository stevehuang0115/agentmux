# Crewly Live Demo Script — "One Person, Full AI Company"

> **Duration:** 5:00 (300 seconds)
> **Format:** Live terminal demo with voiceover (screen recording)
> **Audience:** Developers, indie hackers, technical founders
> **Positioning:** AI Team OS — one person manages a self-driving AI team
> **Resolution:** 1920x1080 (16:9), export 1080x1920 vertical clips for TikTok/Reels
> **Version:** 1.0
> **Author:** Mia (Product Manager)
> **Date:** 2026-02-28

---

## Pre-Recording Checklist

### Environment
- [ ] macOS, dark theme, Do Not Disturb ON
- [ ] Terminal: iTerm2 or Warp, dark theme, font 16pt, opacity 100%
- [ ] Browser: Chrome clean profile (no bookmarks bar, no extensions showing)
- [ ] Desktop wallpaper: solid dark (#0a0a0a) — no distractions
- [ ] All notifications OFF (Slack, email, system)

### Crewly Setup
- [ ] Crewly installed (`npm install -g crewly` or dev mode)
- [ ] Crewly NOT running (fresh start for demo)
- [ ] Claude Code CLI installed and authenticated
- [ ] Clean demo project directory at `~/crewly-demo`
- [ ] API key set in environment (`ANTHROPIC_API_KEY`)

### Recording
- [ ] OBS or ScreenFlow configured at 1920x1080, 30fps
- [ ] Mic test done (clear audio, no echo)
- [ ] Lo-fi background music track ready (low volume, 10-15%)
- [ ] Timer visible to presenter (not on screen)

### Dry Run
- [ ] Run full demo once to ensure all commands work
- [ ] Verify agents register within 30 seconds
- [ ] Verify dashboard loads at localhost:8787
- [ ] Prepare fallback: pre-recorded segments for slow agent startup

---

## Act 1: Opening — The Problem (0:00 - 0:30)

### [0:00 - 0:15] Hook

**[SCREEN]:** Terminal with blinking cursor. Nothing else.

**[VOICEOVER]:**
> "You have an idea. You need a product manager to spec it out, an engineer to build it, and someone to test and deploy it. That's three people. Three salaries. Three Slack channels. Three standups."

**[SCREEN]:** Text overlay appears:

```
PM:  $120K/yr
Eng: $180K/yr
Ops: $140K/yr
─────────────
     $440K/yr
```

**[RECORDING NOTE]:** Pause 1 second after the total appears. Let it sink in.

---

### [0:15 - 0:30] The Alternative

**[VOICEOVER]:**
> "Or... you could have an AI team that does all three. Running 24/7. For the cost of API calls. Let me show you."

**[SCREEN]:** Text overlay fades. Terminal becomes full screen.

**[TEXT OVERLAY]:** "Crewly — AI Team OS" (subtle fade-in, bottom right, Crewly logo)

**[RECORDING NOTE]:** Confident tone. Not salesy. Matter-of-fact.

---

## Act 2: Setup — From Zero to Team (0:30 - 1:30)

### [0:30 - 0:55] Install and Init

**[SCREEN]:** Clean terminal. Type the command live.

**[VOICEOVER]:**
> "One command. That's all you need."

**[TYPE IN TERMINAL]:**
```bash
npx crewly init
```

**[SCREEN]:** Crewly ASCII banner appears:

```
   ____                    _
  / ___|_ __ _____      _| |_   _
 | |   | '__/ _ \ \ /\ / / | | | |
 | |___| | |  __/\ V  V /| | |_| |
  \____|_|  \___| \_/\_/ |_|\__, |
                              |___/

  Welcome to Crewly! Let's get you set up.
```

**[VOICEOVER]:**
> "Crewly detects your AI tools, installs skills, and sets up your team structure."

**[SCREEN]:** The wizard progresses through steps (show them quickly):
```
Step 1/5: AI Provider Selection
  [x] Claude Code (detected)
  [ ] Gemini CLI
  [ ] Codex

Step 2/5: Tool Detection
  tmux ............ v3.4 ✓
  Claude Code ..... v1.0.31 ✓

Step 3/5: Installing Skills
  Installing 22 agent skills... done ✓

Step 4/5: Choose Team Template
  > Startup Team (PM + Developer + Generalist)
    Web Dev Team
    Research Team
    Content Generation Team
    Code Review Team
    Social Media Ops Team

Step 5/5: Project Setup
  Project name: crewly-demo
  Created .crewly/ directory ✓
```

**[RECORDING NOTE]:** Speed up wizard steps to ~25 seconds total. Show each step briefly (2-3s each). The audience should see the flow, not read every line.

---

### [0:55 - 1:30] Create and Start the Team

**[VOICEOVER]:**
> "I picked the Startup Team template — a PM, a developer, and a generalist. Now let's bring them online."

**[TYPE IN TERMINAL]:**
```bash
crewly start
```

**[SCREEN]:** Backend starts, dashboard URL appears:

```
Starting Crewly...
  Backend ......... running on port 8787
  Frontend ........ building...
  Frontend ........ ready ✓

  Dashboard: http://localhost:8787

Opening browser...
```

**[VOICEOVER]:**
> "Crewly spins up the backend, the dashboard, and tmux sessions for each agent. Let's switch to the browser."

**[SCREEN]:** Browser opens automatically. Dashboard loads at localhost:8787.

**[DASHBOARD VIEW]:** Shows:
- Stat cards: Teams (1), Projects (1), Members (3)
- Startup Team card with 3 member avatars
- All members showing status: "inactive" (not yet started)

**[VOICEOVER]:**
> "Here's the dashboard. One team, three members, all waiting for work. Let me start the team."

**[SCREEN]:** Click into the Startup Team card. Team Detail page shows:
- Team name: "Startup Team"
- 3 members listed: Product Manager, Developer, Generalist
- "Start Team" button visible

**[CLICK]:** "Start Team" button. Modal appears → select project → confirm.

**[SCREEN]:** Agent statuses transition: inactive → activating → active (with green dots)

**[VOICEOVER]:**
> "Watch — each agent starts its own Claude Code session in a real terminal. No fake API calls. Real coding CLIs doing real work."

**[RECORDING NOTE]:** This is the FIRST "wow" moment. Give it 5 seconds to show all 3 agents going green. If agents take >15 seconds, use a cut or speed-up.

---

## Act 3: Demo Core — The AI Team at Work (1:30 - 4:00)

### [1:30 - 2:00] Assign a Task

**[VOICEOVER]:**
> "Now let's give them something to do. I'll open the orchestrator terminal and delegate a real task."

**[SCREEN]:** Click on the terminal icon next to the orchestrator (or any agent). The Terminal Panel slides out from the right side, showing a live tmux session.

**[VOICEOVER]:**
> "This is a live terminal. That's a real Claude Code session running inside tmux. You can see everything the agent is thinking and doing."

**[SCREEN]:** In the orchestrator terminal, type (or show the orchestrator doing this autonomously):

```bash
bash config/skills/orchestrator/delegate-task/execute.sh '{
  "to": "startup-team-developer",
  "task": "Create a REST API with Express.js that has GET /health and GET /api/users endpoints. Include TypeScript types and a basic test file.",
  "priority": "high",
  "projectPath": "/Users/steve/crewly-demo",
  "monitor": {"idleEvent": true, "fallbackCheckMinutes": 5}
}'
```

**[SCREEN]:** Response appears:
```json
{"success": true, "message": "Task delegated to startup-team-developer"}
```

**[VOICEOVER]:**
> "I just told the developer to build a REST API. Notice the monitor flag — Crewly will automatically track progress and alert me when the agent finishes or gets stuck."

**[RECORDING NOTE]:** If typing the JSON is too slow for demo, pre-write it in a temp file and use `$(cat /tmp/task.json)`. Or show a simplified version. The key point is showing delegate-task, not the JSON syntax.

---

### [2:00 - 2:45] Watch Agents Work (Terminal Streaming)

**[VOICEOVER]:**
> "Now watch. This is the part that blows people's minds."

**[SCREEN]:** Switch to the Developer agent's terminal (click the terminal icon for the Developer member). Show the live Claude Code session:

```
Claude Code is thinking...

I'll create a REST API with Express.js and TypeScript.

Let me start by setting up the project structure...

> Creating src/index.ts
> Creating src/types/user.ts
> Creating src/routes/users.ts
> Creating tests/api.test.ts

[file content streaming in real-time...]
```

**[VOICEOVER]:**
> "That's not a simulation. That's Claude Code writing real files in a real terminal. Every keystroke, every file creation, streamed live to your dashboard."

**[SCREEN]:** Split view — show the Terminal Panel on the right, Dashboard on the left. Agent status shows "in_progress" with a spinner.

**[VOICEOVER]:**
> "While the developer works, let me assign the PM a task too."

**[SCREEN]:** Quick cut — delegate another task to PM:

```bash
bash config/skills/orchestrator/delegate-task/execute.sh '{
  "to": "startup-team-pm",
  "task": "Write API documentation for the /health and /api/users endpoints. Include request/response examples.",
  "priority": "normal",
  "projectPath": "/Users/steve/crewly-demo"
}'
```

**[VOICEOVER]:**
> "Two agents working simultaneously. Independent tasks, parallel execution. The PM writes docs while the developer writes code. And I didn't have to set up any infrastructure — Crewly handles the orchestration."

**[RECORDING NOTE]:** This is the MONEY SHOT. Show both agents actively working at the same time. Click between their terminals. Let the audience see real code being written in real time. Spend at least 30 seconds here. If an agent finishes too fast, that's actually good — it shows speed.

---

### [2:45 - 3:15] Dashboard Monitoring

**[VOICEOVER]:**
> "But you don't have to watch terminals all day. The dashboard gives you the full picture."

**[SCREEN]:** Navigate back to Dashboard → Team Detail page. Show:

1. **Agent cards** — all 3 visible with status indicators:
   - PM: active (green), working on docs
   - Developer: active (green), writing code
   - Generalist: active (green), idle (waiting for tasks)

2. **Click an agent card** → Agent Detail Modal opens showing:
   - Role, session name, status
   - "View Terminal" button

**[VOICEOVER]:**
> "Every agent's status updates in real time via WebSocket. You can see who's working, who's idle, and click into any terminal for the full picture."

**[SCREEN]:** Quickly show other dashboard pages:
- **Teams page** — grid of all teams
- **Projects page** — project with progress bar
- **Knowledge page** — accumulated team memory

**[VOICEOVER]:**
> "Teams, projects, knowledge — everything in one dashboard. No switching between tabs, no checking Slack, no wondering what happened overnight."

**[RECORDING NOTE]:** Quick cuts between dashboard pages. 2-3 seconds per page. Don't linger. The point is breadth, not depth.

---

### [3:15 - 3:45] Agent Completion and Quality

**[VOICEOVER]:**
> "Let's check on our developer."

**[SCREEN]:** Click into the Developer's terminal. Show the agent finishing:

```
I've created the following files:
- src/index.ts (Express server with /health and /api/users)
- src/types/user.ts (User interface)
- src/routes/users.ts (users route handler)
- tests/api.test.ts (endpoint tests)

Running tests...

 PASS  tests/api.test.ts
  GET /health
    ✓ returns 200 with status ok (15ms)
  GET /api/users
    ✓ returns array of users (8ms)

Tests: 2 passed, 2 total
```

**[VOICEOVER]:**
> "The developer wrote the code AND ran the tests. Tests pass. And Crewly can enforce this with quality gates — if tests fail, the task doesn't close."

**[SCREEN]:** Show the agent reporting status:

```
Task completed. Reporting status...
{"success": true, "status": "done"}
```

**[SCREEN]:** Dashboard auto-updates — Developer status changes from "in_progress" to "idle". Notification appears.

**[VOICEOVER]:**
> "Automatic status reporting. The orchestrator knows the task is done, monitoring is cleaned up, and the agent is ready for the next assignment. No manual check-ins needed."

**[RECORDING NOTE]:** If the real agent hasn't finished by this point in the recording, use a time-lapse cut showing the terminal output at 4x speed, then slow to 1x when tests run.

---

### [3:45 - 4:00] Memory and Learning

**[VOICEOVER]:**
> "One more thing. Every task, every decision, every fix — Crewly remembers."

**[SCREEN]:** Show terminal command:

```bash
bash config/skills/agent/core/recall/execute.sh '{
  "agentId": "startup-team-developer",
  "context": "express api setup",
  "projectPath": "/Users/steve/crewly-demo"
}'
```

**[SCREEN]:** Response shows recalled memories:

```json
{
  "success": true,
  "data": {
    "agentMemories": [
      "[best-practice] Express API pattern: use separate route files, TypeScript interfaces for all models, co-located test files..."
    ]
  }
}
```

**[VOICEOVER]:**
> "The team learns. Next time an agent sets up an Express API, it remembers the patterns. Your AI team gets better over time."

---

## Act 4: Results (4:00 - 4:30)

### [4:00 - 4:30] Show the Deliverables

**[VOICEOVER]:**
> "Let's look at what the team actually produced."

**[SCREEN]:** Switch to terminal. Show the file tree:

```bash
$ tree src/
src/
├── index.ts
├── types/
│   └── user.ts
└── routes/
    └── users.ts

$ tree tests/
tests/
└── api.test.ts
```

**[VOICEOVER]:**
> "Clean project structure. TypeScript types. Route separation. Tests. The PM also wrote API docs — let me show you."

**[SCREEN]:** Quick view of the docs file:

```bash
$ head -20 docs/api-docs.md
# API Documentation

## GET /health
Returns server health status.

**Response:**
{ "status": "ok", "uptime": 12345 }

## GET /api/users
Returns all users.

**Response:**
[{ "id": 1, "name": "Alice", "email": "alice@example.com" }]
```

**[VOICEOVER]:**
> "Real code. Real docs. Real tests. All produced by AI agents that I managed from one dashboard. No context switching. No meetings. No Jira tickets."

**[SCREEN]:** Cut back to dashboard showing all 3 agents idle, task completed.

**[RECORDING NOTE]:** The deliverables must be REAL output from the demo run. Don't fake this. If the agent produced slightly different output, use that. Authenticity matters more than perfection.

---

## Act 5: CTA — Get Started (4:30 - 5:00)

### [4:30 - 4:45] The Pitch

**[SCREEN]:** Dashboard full view with all 3 agents.

**[VOICEOVER]:**
> "This is Crewly. An AI Team Operating System. One person. Full AI company. You set the goals, the AI team does the work."

**[SCREEN]:** Text overlay appears, centered:

```
What you just saw:
  1 human + 3 AI agents
  1 task delegated → code + tests + docs produced
  Real terminals, real code, real results
  Total time: under 5 minutes
```

---

### [4:45 - 5:00] Install

**[VOICEOVER]:**
> "Try it yourself. One command."

**[SCREEN]:** Terminal, centered command:

```bash
npx crewly init
```

**[SCREEN]:** Below the command, links appear:

```
GitHub:  github.com/stevehuang0115/crewly
Docs:    crewly.stevesprompt.com/docs
X:       @stevesprompt
```

**[VOICEOVER]:**
> "Open source. MIT licensed. Star us on GitHub."

**[TEXT OVERLAY]:** "Crewly — Your AI Team, Your Rules" + logo

**[FADE TO BLACK]**

**[RECORDING NOTE]:** End on the `npx crewly init` command. This is the action the viewer should take. Keep it on screen for 5 full seconds.

---

## Production Notes

### Timing Guide

| Segment | Start | End | Duration | Key Action |
|---------|-------|-----|----------|------------|
| **Hook** | 0:00 | 0:15 | 15s | Problem statement + cost comparison |
| **Alternative** | 0:15 | 0:30 | 15s | "Or... AI team" transition |
| **Install** | 0:30 | 0:55 | 25s | `npx crewly init` wizard |
| **Start Team** | 0:55 | 1:30 | 35s | `crewly start` + dashboard + team activation |
| **Assign Task** | 1:30 | 2:00 | 30s | `delegate-task` to developer |
| **Terminal Streaming** | 2:00 | 2:45 | 45s | Watch agents code in real time (MONEY SHOT) |
| **Dashboard Tour** | 2:45 | 3:15 | 30s | Navigate dashboard pages |
| **Completion** | 3:15 | 3:45 | 30s | Agent finishes, tests pass, status reports |
| **Memory** | 3:45 | 4:00 | 15s | recall demonstrates learning |
| **Deliverables** | 4:00 | 4:30 | 30s | Show actual code/docs output |
| **CTA** | 4:30 | 5:00 | 30s | Install command + links |

### Key Recording Breakpoints

If recording in segments (recommended), these are natural cut points:

1. **Cut 1** (0:00 - 0:30): Opening — can be recorded with just text overlays
2. **Cut 2** (0:30 - 1:30): Setup — run `crewly init` + `crewly start` in one take
3. **Cut 3** (1:30 - 3:45): Demo core — requires agents to actually work. Longest unbroken segment. Have fallback recordings ready.
4. **Cut 4** (3:45 - 4:30): Results — can be recorded after agents finish (no time pressure)
5. **Cut 5** (4:30 - 5:00): CTA — simple screen recording with voiceover

### Fallback Plans

| Risk | Probability | Fallback |
|------|------------|----------|
| Agent takes >60s to start | Medium | Pre-start agents before recording, cut to "a few moments later" |
| Agent errors during task | Medium | Use time-lapse to skip error, show recovery |
| Dashboard doesn't load | Low | Pre-load dashboard, start recording from loaded state |
| Agent produces wrong output | Medium | Use whatever output is produced — authenticity > perfection |
| Task takes >3 min | High | Time-lapse the coding section at 4x speed |

### Social Media Clip Cuts

From this 5-minute demo, extract these shorter clips:

| Clip | Duration | Segment | Platform | Hook |
|------|----------|---------|----------|------|
| "AI Team in 60 seconds" | 60s | 0:30-1:30 | TikTok, Reels | Init + start + agents go live |
| "Watch AI Code Live" | 45s | 2:00-2:45 | X, LinkedIn | Terminal streaming money shot |
| "3 Agents, 1 Person" | 30s | 0:00-0:30 | TikTok, Reels | Hook + cost comparison |
| "Tests Pass First Try" | 30s | 3:15-3:45 | X | Agent runs tests + completion |
| "Full Demo" | 5:00 | Full | YouTube | Complete demo |

### Voiceover Guidelines

- **Tone:** Confident, not hype. Like showing a friend something cool you built.
- **Speed:** Slightly slower than conversation. Let the screen do the talking.
- **Pauses:** 2-3 second pauses after key moments (agent going active, tests passing).
- **No jargon overload:** Say "AI agents" not "autonomous LLM-powered coding agents."
- **Authenticity:** If something unexpected happens during recording, address it. "Looks like the agent is taking a different approach — that's real AI, not scripted."

---

## Appendix: Exact Commands Reference

All commands used in the demo, copy-pasteable:

```bash
# Act 2: Setup
npx crewly init
crewly start

# Act 3: Task delegation (developer)
bash config/skills/orchestrator/delegate-task/execute.sh '{"to":"startup-team-developer","task":"Create a REST API with Express.js that has GET /health and GET /api/users endpoints. Include TypeScript types and a basic test file.","priority":"high","projectPath":"/Users/steve/crewly-demo","monitor":{"idleEvent":true,"fallbackCheckMinutes":5}}'

# Act 3: Task delegation (PM)
bash config/skills/orchestrator/delegate-task/execute.sh '{"to":"startup-team-pm","task":"Write API documentation for the /health and /api/users endpoints. Include request/response examples.","priority":"normal","projectPath":"/Users/steve/crewly-demo"}'

# Act 3: Memory recall
bash config/skills/agent/core/recall/execute.sh '{"agentId":"startup-team-developer","context":"express api setup","projectPath":"/Users/steve/crewly-demo"}'

# Act 4: Show deliverables
tree src/
tree tests/
head -20 docs/api-docs.md
```

---

*Mia — Product Manager | Crewly Core Team*
*Demo script v1.0 | 2026-02-28*
*Review by: Steve (approval needed before recording)*
