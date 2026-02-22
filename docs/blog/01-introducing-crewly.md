---
title: "Introducing Crewly: Orchestrate AI Coding Teams from Your Terminal"
date: "2026-02-21"
author: "Steve Huang"
tags: ["announcement", "open-source", "ai-agents", "multi-agent"]
description: "Crewly is an open-source platform that coordinates multiple AI coding agents to work together as a team. Here's why we built it and how it works."
---

# Introducing Crewly: Orchestrate AI Coding Teams from Your Terminal

AI coding assistants are powerful individually. Claude Code writes features, Gemini CLI refactors code, Codex generates tests. But run more than one at a time and things fall apart fast.

You open three terminals. Each agent works on its piece. They edit the same file. They duplicate work. They break each other's changes. You alt-tab between windows trying to keep track. By the time you've coordinated them, you could have done the work yourself.

We built Crewly to fix this.

## What Crewly Does

Crewly is an open-source orchestration platform for AI coding agents. You define a team -- a developer, a QA engineer, a PM -- and Crewly launches each agent in its own terminal session with a role-specific prompt. A web dashboard lets you watch all of them work in real time.

Here's what that looks like:

```bash
# Install and set up (takes about 60 seconds)
npm install -g crewly
crewly onboard

# Start the platform
crewly start
```

The `onboard` command detects your installed AI tools, downloads agent skills, and optionally picks a team template. `crewly start` launches the backend and opens the dashboard in your browser.

From the dashboard, you:

1. **Create a team** with agents assigned to roles (developer, QA, PM, designer, etc.)
2. **Point it at a project** -- any local code directory
3. **Start the agents** and watch them collaborate through live terminal streams

Each agent gets a role-specific system prompt that shapes its behavior. The developer focuses on building features. The QA agent reviews code and writes tests. The PM defines requirements and coordinates. They communicate through a bash skill system -- reporting status, delegating tasks, sharing knowledge.

## Why Not CrewAI or LangGraph?

Fair question. Both are excellent frameworks, and we studied them closely (we maintain a [detailed comparison](https://github.com/stevehuang0115/crewly)). The fundamental difference is architectural:

**CrewAI and LangGraph are SDKs.** You write Python code to define agents, connect to LLMs via API, and orchestrate conversations programmatically. They're frameworks for building agent applications.

**Crewly orchestrates existing CLIs.** It doesn't replace your AI tools -- it coordinates the ones you already use. Each agent is a real Claude Code / Gemini CLI / Codex process running in a PTY session. No SDK, no Python dependency, no custom agent code.

This means:

- **Agents have full tool access.** They read files, run tests, commit code -- the same things they do when you run them manually. No sandboxed API calls.
- **You can mix runtimes.** Your lead developer can be Claude Code while your test writer is Gemini CLI. Each uses whatever model works best for its role.
- **The dashboard shows real terminals.** Not formatted chat logs -- actual terminal output streamed via WebSocket. You can send keystrokes to any agent mid-task.

## How It Works Under the Hood

Crewly has three layers:

```
Web Dashboard (React + xterm.js)
        ↕ WebSocket
Backend Server (Express + Socket.IO)
        ↕ PTY
Agent Sessions (Claude Code / Gemini CLI / Codex)
```

When you start an agent, Crewly spawns a PTY session (via `node-pty`) and launches the agent's CLI with a role-specific prompt. The backend pipes terminal output to the dashboard via Socket.IO, and the dashboard renders it with xterm.js -- the same terminal emulator used by VS Code.

Agents coordinate through **skills**: bash scripts that call the Crewly API. When a developer finishes a feature, it runs the `report-status` skill. The orchestrator agent sees the update and delegates a review to the QA agent using the `delegate-task` skill. Agents persist knowledge between sessions using `remember` and `recall`.

```bash
# Example: agent reports its status
bash skills/agent/report-status/execute.sh \
  '{"status":"done","summary":"Implemented user auth with JWT"}'

# Example: orchestrator delegates a task
bash skills/orchestrator/delegate-task/execute.sh \
  '{"memberId":"qa-1","task":"Review the JWT auth implementation"}'
```

Built-in **quality gates** validate work before it's marked complete. You configure what checks to run -- build, test, lint, typecheck -- and agents must pass them before a task closes.

## Getting Started in 5 Minutes

### Prerequisites

- Node.js v20+ and npm v9+
- At least one AI coding CLI installed:

```bash
# Claude Code (recommended)
npm install -g @anthropic-ai/claude-code

# Or Gemini CLI
npm install -g @google/gemini-cli

# Or Codex
npm install -g @openai/codex
```

### Install and Run

```bash
# Install Crewly
npm install -g crewly

# Run the setup wizard
crewly onboard

# Start the platform
crewly start
```

The dashboard opens at `http://localhost:8787`. Create a team, assign it to a project directory, start the agents, and watch them go.

### Try an Example Project

We ship three example projects pre-configured with team templates:

```bash
# Clone and try the todo app example
git clone https://github.com/stevehuang0115/crewly.git
cd crewly/examples/web-app
crewly start
```

This example comes with a 3-agent web dev team (Frontend Dev, Backend Dev, QA) ready to build a todo application.

## What's Unique About Crewly

After studying every major framework in the space -- CrewAI, LangGraph, AutoGen, OpenHands -- we identified what's missing. No one has built a tool that treats AI agents like team members you can *watch and interact with in real time*. Here's what that gives you:

- **Live terminal streaming** -- Watch agents type, think, and execute. Not logs after the fact -- the actual terminal, live.
- **Interactive debugging** -- Send keystrokes to any agent mid-task. Unstick a confused agent or redirect its approach.
- **Budget tracking** -- Per-agent, per-project cost tracking. Know exactly what each agent costs you.
- **Slack integration** -- Two-way bridge for team notifications. Get pinged when an agent finishes or gets stuck.
- **Quality gates** -- Build, test, lint, typecheck validation before tasks close. Agents can't ship broken code.
- **Persistent memory** -- Agents learn across sessions. Knowledge is shared project-wide.

## What's Next

Crewly is in active development. Here's what's coming:

- **`crewly init`** -- Project-level scaffolding to set up teams in any directory
- **Docker deployment** -- `docker compose up` for containerized runs
- **Documentation site** -- Hosted guides, tutorials, and API reference
- **Vector-based memory** -- Semantic search over agent knowledge using embeddings
- **Skill marketplace** -- Community-contributed skills for specialized workflows

We'd love your feedback. What workflows would you run with a coordinated AI team? What's missing?

- **GitHub**: [github.com/stevehuang0115/crewly](https://github.com/stevehuang0115/crewly)
- **npm**: `npm install -g crewly`
- **License**: MIT

---

*Crewly is open source and free. Built with TypeScript, Express, React, node-pty, and Socket.IO.*
