---
title: "Crewly Demo Video Script (2-Minute Version)"
category: "Marketing"
tags: ["demo", "video", "script", "marketing"]
author: "Mia (Product Manager)"
version: "2.0"
date: "2026-02-22"
purpose: "2-minute product demo video for website hero, YouTube, and social media clips"
supersedes: "v1.0 (4-minute version from 2026-02-21)"
---

# Crewly Demo Video — 2-Minute Script

> **Duration**: 2:00 (120 seconds)
> **Audience**: Developers who use AI coding assistants
> **Tone**: Conversational, confident, developer-friendly
> **Format**: Screen recording with voiceover
> **Music**: Lo-fi or ambient tech background (low volume)

---

## Pre-Recording Setup

- Clean macOS desktop, dark theme
- Terminal: iTerm2 or Warp (dark theme, large font ~16pt)
- Browser: Chrome (clean profile, no bookmarks bar)
- Crewly NOT running (fresh start)
- Claude Code installed and authenticated
- A clean project directory at `~/demo-project`
- Record at 1920x1080 (export for YouTube + vertical social clips)
- Disable all notifications (Do Not Disturb)

---

## Script

### [0:00 - 0:08] Hook (8 seconds)

**[SCREEN]**: Split screen — left: empty terminal. Right: text appearing word by word.

**[VOICEOVER]**:
> "What if you could hire an entire dev team... that works 24/7... for the cost of a lunch?"

**[TEXT OVERLAY]**: "Meet Crewly" (fade in with logo)

**[PRODUCTION NOTE]**: Hook must grab attention in 3 seconds. The ellipsis pauses create suspense. Text animation syncs with voiceover timing.

---

### [0:08 - 0:22] Install & Onboard (14 seconds)

**[SCREEN]**: Terminal, typing the command.

**[VOICEOVER]**:
> "Getting started takes one command."

**[TERMINAL]**:
```
$ npx crewly onboard
```

**[SCREEN]**: Show the wizard running — speed up 3x. Flash through: provider selection (Claude Code selected), skill installation (progress bar), template selection (Web Dev Team selected).

**[VOICEOVER]**:
> "Pick your AI runtime, choose a team template, and you're done. Under two minutes."

**[TERMINAL]**:
```
$ crewly start
  Starting Crewly...
  Dashboard: http://localhost:8787
  Crewly is ready!
```

**[SCREEN]**: Browser opens automatically. Dashboard loads.

**[PRODUCTION NOTE]**: Speed up install portions (3-4x) but keep template selection readable for 2 seconds. The transition from terminal → browser opening is a key visual moment.

---

### [0:22 - 0:42] The Dashboard — Meet Your Team (20 seconds)

**[SCREEN]**: Dashboard overview — team page showing 3 agent cards.

**[VOICEOVER]**:
> "Here's your team. Three AI agents — a developer, a QA engineer, and a product manager. Each has their own role, skills, and terminal."

**[SCREEN]**: Brief highlight on each card (hover effect or zoom). Show role labels and green status indicators lighting up one by one.

**[VOICEOVER]**:
> "Assign them to any project on your machine, and they start working."

**[SCREEN]**: Show project assignment (quick click) → agents spin up. Status changes from gray to green.

**[PRODUCTION NOTE]**: The "lights coming on" moment is visually powerful. Emphasize the green status indicators appearing in sequence. Keep the mouse movements smooth and deliberate.

---

### [0:42 - 1:02] Live Terminal Streaming — The Magic Moment (20 seconds)

**[SCREEN]**: Click on the developer agent. Live terminal fills the right panel with code flowing in real-time.

**[VOICEOVER]**:
> "This is what makes Crewly different. You can watch your agents work — in real time."

**[SCREEN]**: Show the agent clearly reading a file, then writing new code. Lines of TypeScript/JavaScript appearing character by character. Not instant — real agent speed.

**[VOICEOVER]**:
> "This is Sam writing a new feature. And you're not just watching — you can type directly into the terminal to guide them."

**[SCREEN]**: Quick demo of typing a short instruction into the terminal input bar. Agent acknowledges and adjusts.

**[TEXT OVERLAY]**: "Real-time. Interactive. Transparent."

**[PRODUCTION NOTE]**: This is the money shot. The viewer must feel that real code is being written by a real agent. Don't speed this up — the natural typing speed of Claude Code is impressive on its own. The interactive input is a 5-second wow moment.

---

### [1:02 - 1:18] Quality Gates & Task Board (16 seconds)

**[SCREEN]**: Switch to task board view (Kanban). A task card moves from "In Progress" to "Review".

**[VOICEOVER]**:
> "Tasks flow through a built-in board. When an agent finishes, Crewly runs quality gates automatically — typecheck, tests, lint, build."

**[SCREEN]**: Quality gate panel with checkmarks appearing in sequence:
```
✓ TypeScript compilation
✓ Unit tests (8/8 passed)
✓ ESLint (no errors)
✓ Build (success)
```

**[VOICEOVER]**:
> "If something fails, the agent fixes it. No more reviewing code that doesn't compile."

**[PRODUCTION NOTE]**: The checkmarks appearing one by one create a satisfying visual rhythm. If a gate genuinely fails during recording, even better — show the agent fixing it. That's more compelling than a perfect run.

---

### [1:18 - 1:32] Budget Tracking & Slack (14 seconds)

**[SCREEN]**: Budget tracking panel — per-agent cost bars with dollar amounts.

**[VOICEOVER]**:
> "You always know what your AI team costs. Per agent. Per project. With alerts before you hit your limit."

**[SCREEN]**: Quick cut to Slack. A message from the Crewly bot:

```
[Crewly] Backend Dev completed task: "API endpoints for todo app"
  Quality gates: ✓ All passed
  Cost: $0.47
```

**[VOICEOVER]**:
> "Everything connects to Slack. Task updates, cost alerts, right in your team channel."

**[PRODUCTION NOTE]**: The Slack notification should look authentic — real Slack UI, real bot formatting. The $0.47 cost is a deliberate choice to anchor the "cost of a lunch" hook from the opening.

---

### [1:32 - 1:48] The Power Moment (16 seconds)

**[SCREEN]**: Zoomed-out dashboard view showing all three agents in split terminal layout. All three terminals have active output scrolling simultaneously.

**[VOICEOVER]**:
> "Three agents. Working in parallel. A developer writing code. QA testing it. A PM tracking everything. All visible. All coordinated. All on your local machine."

**[SCREEN]**: Slow, dramatic zoom out to show the full dashboard. Activity feed scrolling on the side. All terminals active.

**[TEXT OVERLAY]**: "Your code never leaves your machine."

**[PRODUCTION NOTE]**: This is the emotional peak. The zoom-out reveals the full scope of what's running. Slight pause after the voiceover lets the visual sink in. The "local machine" text reinforces data privacy.

---

### [1:48 - 2:00] CTA (12 seconds)

**[SCREEN]**: Clean slide with Crewly logo and install command.

**[VOICEOVER]**:
> "Crewly. Open source. Free to start. One command to install."

**[SCREEN]**: Large, centered text:

```
npx crewly onboard
```

**[TEXT OVERLAYS]** (stacked below, appearing one by one):
- "Open Source (MIT)"
- "Free Forever"
- "crewly.stevesprompt.com"

**[VOICEOVER]**:
> "Star us on GitHub. Join the Discord. Build your AI team today."

**[SCREEN]**: Crewly logo animation. GitHub star button + Discord link. Fade to black.

**[PRODUCTION NOTE]**: End card stays on screen for 3 seconds after voiceover ends. If on YouTube, use end screen cards for GitHub and Discord links.

---

## Timing Summary

| Scene | Duration | Cumulative | Content |
|-------|----------|------------|---------|
| 1. Hook | 8s | 0:08 | "Hire an AI dev team" |
| 2. Install | 14s | 0:22 | `npx crewly onboard` + `crewly start` |
| 3. Dashboard | 20s | 0:42 | Meet the team, assign project |
| 4. Terminal streaming | 20s | 1:02 | Watch agent code in real-time + interactive input |
| 5. Quality gates | 16s | 1:18 | Task board + auto quality checks |
| 6. Budget + Slack | 14s | 1:32 | Cost tracking + Slack notifications |
| 7. Power moment | 16s | 1:48 | 3 agents in parallel, zoom out |
| 8. CTA | 12s | 2:00 | Install command, GitHub, Discord |
| **Total** | **2:00** | | |

---

## Social Media Clips

Cut from the main video for platform-specific content:

| Clip | Time Range | Duration | Platform | Hook Text |
|------|-----------|----------|----------|-----------|
| **Install clip** | 0:08-0:22 | 14s | Twitter/X, TikTok | "Install an AI dev team in 2 minutes" |
| **Terminal streaming** | 0:42-1:02 | 20s | Twitter/X, LinkedIn | "Watch your AI agents code in real-time" |
| **Quality gates** | 1:02-1:18 | 16s | LinkedIn | "Auto-test AI-generated code before it ships" |
| **3 agents parallel** | 1:32-1:48 | 16s | Twitter/X, Reddit | "3 AI agents. Working in parallel. On your laptop." |
| **Full demo** | 0:00-2:00 | 120s | YouTube, Website hero | Full product demo |

---

## Recording Checklist

```
Pre-Recording:
[ ] Clean desktop (hide personal files, bookmarks, notifications)
[ ] Dark theme on terminal and browser
[ ] Font size 16pt+ (readable on mobile)
[ ] Crewly installed and NOT running (fresh start)
[ ] Claude Code installed and authenticated
[ ] Slack test workspace with Crewly bot connected
[ ] Close all apps except terminal, browser, and recorder
[ ] Do Not Disturb enabled
[ ] Test audio levels

During Recording:
[ ] Move mouse deliberately (no jittery movements)
[ ] Pause 1-2 seconds at visual transitions
[ ] Let terminal output flow at natural speed (Scene 4)
[ ] Show REAL agent output (not scripted/faked)
[ ] Capture at 1920x1080 minimum

Post-Recording:
[ ] Trim dead time (loading screens, long API waits)
[ ] Speed up install/onboard portions (3-4x)
[ ] Add text overlays at timestamps above
[ ] Add subtle zoom effects on small UI elements
[ ] Add background music (lo-fi, low volume)
[ ] Color grade for consistency
[ ] Export: MP4 H.264, 1080p, 30fps
[ ] Create 4 social media clips (see table)
[ ] Upload to YouTube with metadata below
[ ] Embed on crewly.stevesprompt.com homepage
```

---

## YouTube Metadata

**Title**: "Crewly: Build AI Agent Teams That Work Together (2-Min Demo)"

**Description**:
```
Crewly is an open-source platform that coordinates AI coding agents
(Claude Code, Gemini CLI, Codex) to work together as a team.

Watch agents code, test, and coordinate in real-time through a live dashboard.

0:00 Hook
0:08 Install & Setup
0:22 Meet Your Team
0:42 Live Terminal Streaming
1:02 Quality Gates
1:18 Budget & Slack
1:32 3 Agents in Parallel
1:48 Get Started

Install free:
npx crewly onboard

Links:
Website: https://crewly.stevesprompt.com
GitHub: https://github.com/stevehuang0115/crewly
Discord: [link]

#AI #AIAgents #CodingAssistant #OpenSource #DevTools
```

**Tags**: AI agents, multi-agent, coding assistant, Claude Code, Gemini CLI, open source, dev tools, AI team, orchestration, Crewly

**Thumbnail**: Dashboard screenshot with three terminal streams visible. Text overlay: "AI Agents Working as a Team" in bold white. Crewly logo in corner.

---

*Version: 2.0 | Date: 2026-02-22 | Author: Mia (Product Manager)*
*Supersedes: v1.0 (4-minute version)*
