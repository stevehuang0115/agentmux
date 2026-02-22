---
title: "Social Media Launch Posts"
category: "Marketing"
tags: ["launch", "social-media", "phase-2", "twitter", "reddit", "linkedin"]
author: "Mia (Product Manager)"
version: "1.0"
date: "2026-02-21"
status: "Ready for review"
---

# Social Media Launch Posts

All posts are copy-pasteable. Character counts noted where limits apply.

---

## 1. Twitter/X Thread (7 tweets)

### Tweet 1 — Hook (271 chars)

```
We just open-sourced Crewly -- a platform that coordinates multiple AI coding agents as a team.

Give Claude Code, Gemini CLI, and Codex roles. Watch them collaborate in real time through a web dashboard.

npm install -g crewly

github.com/stevehuang0115/crewly
```

### Tweet 2 — Problem (258 chars)

```
The problem:

You're running Claude Code on one task, Gemini CLI on another, Codex on a third.

Three terminals. No coordination. They edit the same files. They duplicate work.

You spend more time managing agents than writing code.

Crewly fixes this.
```

### Tweet 3 — How it works (277 chars)

```
How it works:

1. Define a team (developer, QA, PM -- any role)
2. Point it at a project directory
3. Crewly launches each agent in its own terminal
4. Watch them all work via a live dashboard

60 seconds from install to agents running:

crewly onboard
crewly start
```

### Tweet 4 — Key differentiator (267 chars)

```
Unlike CrewAI or LangGraph, Crewly doesn't replace your tools.

It orchestrates the CLIs you already use. Each agent runs in a real PTY session with full codebase access.

No Python. No SDK. No vendor lock-in.

Your lead dev can be Claude while your QA is Gemini.
```

### Tweet 5 — Dashboard (220 chars)

```
The dashboard gives you:

- Live terminal streams for every agent
- Send keystrokes to any agent mid-task
- Task management and activity feeds
- Per-agent budget tracking
- Quality gates (build, test, lint)

[DEMO GIF HERE]
```

### Tweet 6 — Built-in features (246 chars)

```
What's built in:

- Agent memory that persists across sessions
- Skill system for agent coordination
- Team templates (web dev, research, startup)
- Slack integration for notifications
- Orchestrator that assigns and monitors work

All local. Nothing leaves your machine.
```

### Tweet 7 — CTA (198 chars)

```
Crewly is MIT licensed and free.

npm install -g crewly

We're looking for early users and feedback. What would you build with a coordinated AI team?

GitHub: github.com/stevehuang0115/crewly
```

---

## 2. Reddit Posts

### r/programming (title + body)

**Title:**
> Crewly: Open-source tool to orchestrate Claude Code, Gemini CLI, and Codex as a coordinated dev team (TypeScript, MIT)

**Body:**

```
Hey r/programming,

I've been working on Crewly, an open-source platform that coordinates multiple AI coding CLIs to work together as a team.

**The problem it solves:** If you use AI coding assistants, you've probably run into this -- you have Claude Code working on one thing, Gemini on another, maybe Codex writing tests. They're all in separate terminals with no awareness of each other. They step on each other's files, duplicate effort, and you lose track of who's doing what.

**What Crewly does:** You define a team with roles (developer, QA, PM, etc.), assign it to a project, and Crewly launches each agent in its own PTY terminal session. A web dashboard streams all terminals live so you can monitor and interact with any agent.

**How it's different from CrewAI/LangGraph/AutoGen:**

- It's not a framework or SDK. It orchestrates the CLIs you already have installed
- Each agent runs in an actual terminal -- full codebase access, same as using the CLI yourself
- Runtime-agnostic: mix Claude Code + Gemini CLI + Codex on the same team
- Live dashboard with terminal streaming, not logs-after-the-fact
- Everything runs locally, nothing leaves your machine

**Stack:** TypeScript, Express, React, node-pty, Socket.IO

**Try it:**

    npm install -g crewly
    crewly onboard
    crewly start

MIT licensed. Looking for feedback on what workflows people would actually run with coordinated AI agents.

GitHub: https://github.com/stevehuang0115/crewly
```

### r/artificial (title + body)

**Title:**
> Show r/artificial: Crewly -- coordinate multiple AI coding agents as a team with a live dashboard

**Body:**

```
Built an open-source tool called Crewly that orchestrates multiple AI coding agents working together.

Instead of running Claude Code, Gemini CLI, and Codex in separate terminals, Crewly lets you define a team -- developer, QA, PM -- and launches each in its own terminal session. A web dashboard streams all agent terminals in real time.

Key things:

- **Runtime-agnostic** -- works with Claude Code, Gemini CLI, Codex. Mix them on the same team.
- **Real terminals** -- agents run in actual PTY sessions with full codebase access. Not sandboxed API calls.
- **Live dashboard** -- watch agents work, send keystrokes, track tasks and costs.
- **Local-first** -- everything on your machine, nothing leaves your environment.
- **Skill system** -- agents coordinate through bash scripts (report-status, delegate-task, recall-memory).

The interesting part is the orchestrator agent -- it reads the project state, breaks down work, delegates tasks to specialized agents, and monitors quality gates (build, test, lint) before marking tasks done.

Ships with 3 team templates (web dev, research, startup) and example projects to try immediately.

    npm install -g crewly && crewly onboard && crewly start

TypeScript, MIT licensed.

GitHub: https://github.com/stevehuang0115/crewly

What workflows would you want to run with a multi-agent team?
```

---

## 3. LinkedIn Post (1,284 chars)

```
We just open-sourced Crewly -- a platform that coordinates AI coding agents to work as a team.

The reality of using AI coding assistants today: you run Claude Code on a feature, Gemini CLI on a refactor, and Codex on tests. Three terminals, no coordination, constant context-switching to keep track.

Crewly changes this. You define a team -- a developer agent, a QA agent, a PM agent -- and Crewly orchestrates them. Each agent runs in its own terminal session. A web dashboard shows all of them working in real time.

What makes it different from existing frameworks like CrewAI or LangGraph:

- It orchestrates the CLIs developers already use, not a new SDK to learn
- Each agent runs in a real terminal with full project access
- Live dashboard with terminal streaming and task management
- Everything runs locally -- no data leaves your environment
- Mix AI runtimes on the same team (Claude + Gemini + Codex)

The result: faster iteration with AI teams that actually coordinate instead of stepping on each other's work.

Built with TypeScript. MIT licensed. Free and open source.

Try it: npm install -g crewly

GitHub: https://github.com/stevehuang0115/crewly

We're looking for early users, feedback, and contributors. What would you build with coordinated AI agents?

#OpenSource #AI #CodingAgents #DevTools #MultiAgent #TypeScript
```

---

## Posting Schedule

| Time (PT) | Channel | Post |
|-----------|---------|------|
| Tuesday 9:00 AM | Hacker News | Show HN post (separate doc) |
| Tuesday 9:30 AM | Twitter/X | Thread (tweets 1-7, spaced 2 min apart) |
| Tuesday 10:00 AM | Product Hunt | Listing |
| Tuesday 10:30 AM | Reddit r/programming | Reddit post |
| Tuesday 11:00 AM | Reddit r/artificial | Reddit post |
| Tuesday 11:30 AM | LinkedIn | LinkedIn post |
| Tuesday 12:00 PM | Dev.to | Blog post cross-post |

## Assets Needed

- [ ] Demo GIF for Tweet 5 (dashboard with agents working, ~15 seconds)
- [ ] GitHub social preview image (1280x640, shows dashboard screenshot)
- [ ] Product Hunt listing assets (logo, gallery screenshots, tagline)
