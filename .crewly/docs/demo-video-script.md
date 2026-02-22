---
title: "Demo Video Script"
category: "Marketing"
tags: ["demo", "video", "phase-2", "launch"]
author: "Mia (Product Manager)"
version: "1.0"
date: "2026-02-21"
status: "Ready for recording"
---

# Demo Video Script

**Target duration**: 3:30 - 4:00
**Audience**: Developers who use AI coding assistants
**Tone**: Casual, technical, honest — like a dev showing a colleague something cool
**Format**: Screen recording with voiceover. No face cam needed.

---

## Pre-Recording Setup

- Clean terminal (dark theme, large font ~16pt, no cluttered prompt)
- Browser ready (Chrome/Arc, clean profile, no bookmarks bar)
- Crewly NOT running (fresh start for the demo)
- Claude Code installed and authenticated
- A clean project directory at `~/demo-project` (empty or minimal files)
- Screen resolution: 1920x1080 or 2560x1440 (record at 1080p output)
- Audio: External mic, quiet room, record voiceover separately if possible

---

## Scene 1: Hook — The Problem

**Duration**: 0:00 - 0:20 (20 seconds)
**Type**: Screen recording (or animated graphic)

### On Screen

Three terminal windows tiled on screen. Each has an AI CLI running:
- Left: Claude Code writing a feature
- Center: Gemini CLI refactoring code
- Right: Codex writing tests

The windows overlap chaotically. Quick cuts between them — the viewer can't follow any one agent.

Then: a merge conflict appears. Two agents edited the same file.

### Voiceover

> "You're running three AI agents. Claude's building a feature. Gemini's refactoring. Codex is writing tests. They have no idea each other exists. They edit the same file. They duplicate work. You spend more time managing them than writing code."

### Production Note

This can be recorded live (run three real CLIs) or mocked with screen recordings spliced together. The key visual is chaos — windows overlapping, context-switching, a merge conflict popup. If using animated graphics, show three terminal-like rectangles with scrolling text, then a red flash on two of them colliding.

---

## Scene 2: Intro — What Is Crewly

**Duration**: 0:20 - 0:35 (15 seconds)
**Type**: Title card + screen recording transition

### On Screen

Cut to a clean title card:

```
Crewly
Open-source multi-agent orchestration
for AI coding teams
```

Brief shot of the Crewly dashboard with agents working (teaser — we'll come back to this).

### Voiceover

> "Crewly fixes this. It's an open-source platform that coordinates AI coding agents as a team. You define roles, point them at a project, and watch them work together through a live dashboard."

### Production Note

Title card can be a simple slide or animated text. Dashboard teaser is a 2-second flash of the real dashboard to build anticipation.

---

## Scene 3: Install + Onboard

**Duration**: 0:35 - 1:10 (35 seconds)
**Type**: Screen recording (terminal)

### On Screen

Clean terminal. Type commands in real time:

```bash
$ npm install -g crewly
# ... install output scrolls by (speed up 4x) ...
# added 247 packages in 12s

$ crewly onboard

   ____                    _
  / ___|_ __ _____      _| |_   _
 | |   | '__/ _ \ \ /\ / / | | | |
 | |___| | |  __/\ V  V /| | |_| |
  \____|_|  \___| \_/\_/ |_|\__, |
                              |___/

  Welcome to Crewly! Let's get you set up.

  Step 1/5: AI Provider
  Which AI coding assistant do you use?

    1. Claude Code (Anthropic)      <-- select this
    2. Gemini CLI (Google)
    3. Both
    4. Skip

  Enter choice (1-4): 1

  Step 2/5: Tool Installation
  ✓ Claude Code detected (v1.0.x)

  Step 3/5: Agent Skills
  Installing 22 agent skills from marketplace...
  [1/22] accept-task
  [2/22] check-quality-gates
  ...                              <-- speed up 3x
  ✓ 22 skills installed

  Step 4/5: Team Template
  Choose a pre-built team to get started quickly:

    1. Research Team
       Researcher + Analyst + Writer for research projects

    2. Startup Team
       PM + Developer + Generalist for rapid prototyping

    3. Web Dev Team                 <-- select this
       Frontend + Backend + QA for building web applications
       Members: Frontend Dev, Backend Dev, QA Tester

    4. Skip

  Enter choice (1-4): 3
  ✓ Selected: Web Dev Team

  Step 5/5: Done!
  ✓ Setup complete!

  To get started:
    cd your-project/
    crewly start
```

### Voiceover

> "Install takes one command. The onboard wizard sets up everything — detects your AI tools, installs agent skills, and lets you pick a team template. I'll go with the Web Dev Team: a frontend developer, backend developer, and QA tester."

*[pause as template selection appears]*

> "60 seconds, and we're ready."

### Production Note

Speed up the npm install and skill installation portions (3-4x). Keep the template selection at real speed so viewers can read the options. Show the typing in real-time for `crewly onboard` to feel authentic.

---

## Scene 4: Start + Dashboard

**Duration**: 1:10 - 1:50 (40 seconds)
**Type**: Screen recording (terminal + browser)

### On Screen

```bash
$ cd ~/demo-project
$ crewly start

🚀 Starting Crewly...
Web Port: 8787
📡 Starting backend server...
⏳ Waiting for servers to initialize...
🌐 Opening dashboard...
✅ Crewly started successfully!
📊 Dashboard: http://localhost:8787
⚡ WebSocket: ws://localhost:8787
🎯 Orchestrator: Setting up in background...

Press Ctrl+C to stop all services
```

Browser opens automatically. Show the dashboard:

1. **Teams page** — Click "Create Team", select "Web Dev Team" template. Three members appear: Frontend Dev, Backend Dev, QA Tester.
2. **Projects page** — Click "Create Project", name it "Demo App", set path to `~/demo-project`.
3. **Assign team** — Assign Web Dev Team to the project.
4. **Start agents** — Click "Start" on each member. Green status indicators light up one by one.

### Voiceover

> "`crewly start` launches the backend and opens the dashboard. Let me create a team from the template we picked..."

*[clicking through team creation]*

> "Three agents, each with a role-specific prompt. Now I'll create a project and assign the team."

*[assigning and starting agents]*

> "Start each agent — and watch them spin up. Each one gets its own terminal session."

### Production Note

This is the key transition from terminal to dashboard. Make the dashboard feel snappy — if creation modals are slow, cut between actions. Show the green status lights appearing to give a sense of "things coming alive."

---

## Scene 5: Agents Working — The Main Demo

**Duration**: 1:50 - 3:10 (80 seconds)
**Type**: Screen recording (dashboard)

### On Screen

This is the centerpiece. Show agents actually collaborating:

**Part A — Delegate a task (20s)**

Go to the Chat page. Type a message to the orchestrator:

```
Build a todo app. Backend: Express REST API with CRUD endpoints.
Frontend: Simple HTML/CSS/JS served by Express. QA: Write tests
for the API endpoints.
```

The orchestrator responds, breaking the task down and delegating to each agent.

**Part B — Watch agents work (40s)**

Switch to the Teams view. Show the terminal streams:

1. **Backend Dev terminal** — Agent is writing `server.ts`, creating Express routes, setting up the data model. Terminal text scrolling in real time.
2. **Frontend Dev terminal** — Agent is writing `index.html` and `app.js`, building the UI with forms and list rendering.
3. **QA Tester terminal** — Agent is reading the other agents' code, then writing test files with assertions.

Switch between terminal views to show each agent working on its piece. Highlight the activity feed showing status updates:

```
[Backend Dev] Status: in_progress — Setting up Express server
[Frontend Dev] Status: in_progress — Building todo list UI
[Backend Dev] Status: done — API endpoints complete
[QA Tester] Status: in_progress — Writing API tests
```

**Part C — Quality gates (20s)**

Show QA Tester running quality gates:

```
[QA Tester] Running quality checks...
  ✓ Build: passed
  ✓ Tests: 8/8 passed
  ✓ Lint: no errors
[QA Tester] Status: done — All quality checks passed
```

### Voiceover

**Part A:**
> "I'll give the team a task through the orchestrator. Just plain English — 'build a todo app.'"

*[typing the message]*

> "The orchestrator breaks it down and delegates: backend to the Backend Dev, frontend to the Frontend Dev, tests to QA."

**Part B:**
> "Now watch. Each agent is working in its own terminal — real Claude Code sessions, not simulations. The Backend Dev is writing an Express API..."

*[switch to Frontend Dev terminal]*

> "...the Frontend Dev is building the UI..."

*[switch to QA terminal]*

> "...and QA is reviewing their work and writing tests. They're coordinating through skills — reporting status, sharing context."

*[show activity feed]*

> "The activity feed shows everything happening in real time."

**Part C:**
> "When QA finishes, it runs quality gates — build, tests, lint. Everything passes. The task is done."

### Production Note

This is the money shot. The viewer needs to *feel* that real work is happening. Options:

1. **Best**: Record a real session where agents build something. Speed up the slow parts (waiting for API responses) but show actual code being written.
2. **Good**: Record real terminal output, then edit for pacing. Cut between agents at interesting moments (file creation, test runs).
3. **Minimum**: Pre-record agent sessions, then replay them with voiceover timed to the action.

Key moments to capture: agent writing actual code (lines appearing), file saves, test output, quality gate pass checkmarks. The activity feed updates are important — they prove coordination is happening.

---

## Scene 6: Feature Montage

**Duration**: 3:10 - 3:40 (30 seconds)
**Type**: Quick cuts (screen recording + text overlays)

### On Screen

Fast montage of features, 5 seconds each, with text overlay labels:

1. **"Mix Runtimes"** — Dashboard settings showing one agent set to Claude Code, another to Gemini CLI. Different icons next to each agent name.

2. **"Agent Memory"** — Terminal showing an agent calling `recall` and getting previous context back. Or the Knowledge page in the dashboard with docs listed.

3. **"Slack Integration"** — A Slack channel showing an agent notification: "Backend Dev completed: API endpoints ready."

4. **"Skill Marketplace"** — Terminal running `crewly search image` and showing marketplace results. Or the Marketplace page in the dashboard.

5. **"Team Templates"** — The template selection from onboard, showing all three options (Web Dev, Research, Startup).

6. **"Budget Tracking"** — Dashboard showing per-agent cost tracking (if visible in the UI).

### Voiceover

> "A few more things. You can mix runtimes on the same team — Claude for coding, Gemini for research. Agents remember things across sessions. You get Slack notifications, a skill marketplace, pre-built team templates, and built-in cost tracking."

### Production Note

These are quick cuts — 4-5 seconds each. Use zoom-in effects or highlights to draw attention to the specific feature. Text overlays should be large and readable (bold, white text with dark background or outline). This section should feel energetic — faster pacing than the rest of the video.

---

## Scene 7: CTA — Get Started

**Duration**: 3:40 - 4:00 (20 seconds)
**Type**: Title card + terminal

### On Screen

Clean terminal showing the install command:

```bash
$ npm install -g crewly
$ crewly onboard
$ crewly start
```

Then transition to a closing card:

```
Crewly — Orchestrate AI coding teams

github.com/stevehuang0115/crewly

  ★ Star the repo
  💬 Join Discord: discord.gg/crewly
  📦 npm install -g crewly

MIT Licensed • Open Source • Local-First
```

### Voiceover

> "Crewly is free, open source, and MIT licensed. Everything runs locally on your machine."

> "Install it in 60 seconds. Star the repo on GitHub. Join our Discord. And let us know what you build."

### Production Note

End card should stay on screen for 3-4 seconds after voiceover ends. Include clickable links if publishing on YouTube (use end screen cards). The three commands should be large enough to read at a glance.

---

## Total Timing Summary

| Scene | Duration | Cumulative | Content |
|-------|----------|------------|---------|
| 1. Hook | 20s | 0:20 | The problem — managing agents is chaos |
| 2. Intro | 15s | 0:35 | What Crewly is — one-sentence pitch |
| 3. Install | 35s | 1:10 | `npm install` + `crewly onboard` |
| 4. Dashboard | 40s | 1:50 | `crewly start` + create team + assign project |
| 5. Working | 80s | 3:10 | Agents building a todo app, quality gates |
| 6. Features | 30s | 3:40 | Montage: runtimes, memory, Slack, marketplace |
| 7. CTA | 20s | 4:00 | Install commands, GitHub, Discord |
| **Total** | **4:00** | | |

---

## B-Roll Shot List

Shots to capture in addition to the main recording:

| Shot | Duration | When to Use |
|------|----------|-------------|
| Terminal zoom: code being written line by line | 10s | Scene 5, overlay or cutaway |
| Dashboard overview: full-screen wide shot | 5s | Scene 2 teaser, Scene 4 transition |
| Activity feed scrolling with status updates | 5s | Scene 5 Part B |
| Terminal split-screen: two agents side by side | 10s | Scene 5, showing parallel work |
| Green checkmarks appearing (quality gates) | 5s | Scene 5 Part C |
| npm install progress bar | 3s | Scene 3, sped up |

---

## Audio Notes

- **Background music**: Subtle, upbeat lo-fi or electronic. Low volume — voiceover is primary. Fade in at Scene 1, fade out at Scene 7. Suggestions: [Epidemic Sound](https://www.epidemicsound.com/) free tier or YouTube Audio Library.
- **Sound effects**: Optional keyboard typing sounds during terminal scenes. Terminal "ding" when quality gates pass. Keep minimal — this isn't a gaming video.
- **Voiceover pacing**: Conversational, not rushed. Leave 0.5-1s pauses between sentences so viewers can absorb the visuals. Total voiceover is ~350 words at ~100 words/minute.

---

## YouTube Metadata

**Title**: Crewly: Orchestrate AI Coding Teams from Your Terminal (Demo)

**Description**:
```
Crewly is an open-source platform that coordinates AI coding agents (Claude Code, Gemini CLI, Codex) to work as a team. Define roles, assign a project, and watch agents collaborate through a real-time web dashboard.

In this demo:
0:00 The problem
0:20 What is Crewly
0:35 Install & setup
1:10 Dashboard & team creation
1:50 Agents building a todo app
3:10 Feature highlights
3:40 Get started

Install: npm install -g crewly
GitHub: https://github.com/stevehuang0115/crewly
Discord: https://discord.gg/crewly

#AI #CodingAgents #OpenSource #DevTools #ClaudeCode #TypeScript
```

**Tags**: crewly, ai agents, multi-agent, claude code, gemini cli, codex, ai coding, developer tools, open source, orchestration, typescript

**Thumbnail**: Dashboard screenshot with three terminal streams visible. Text overlay: "AI Agents Working as a Team" in bold white.

---

*Document Version: 1.0 | Date: 2026-02-21 | Author: Mia (Product Manager, crewly-core-mia-member-1)*
