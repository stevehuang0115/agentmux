# Show HN Draft for Crewly

**OKR:** O2-KR1 PMF Validation
**Date:** 2026-02-21
**Status:** Draft v1

---

## Recommended Title

**Option A (recommended):**
> Show HN: Crewly - Orchestrate Claude Code, Gemini CLI, and Codex as a dev team

**Option B (shorter):**
> Show HN: Crewly - Run multiple AI coding agents as a coordinated team

**Option C (problem-first):**
> Show HN: Crewly - I was tired of managing AI agents one at a time

---

## Post Body

Hey HN,

I built Crewly because I was running Claude Code on one task, Gemini CLI on another, and Codex on a third - and there was no way to coordinate them. I'd constantly switch terminals, forget which agent was doing what, and have agents step on each other's work.

Crewly orchestrates multiple AI coding CLIs as a team. You define a team (a developer agent, a QA agent, a PM agent), assign it to a project directory, and Crewly launches each agent in its own PTY session with role-specific system prompts. A web dashboard lets you watch all agents work in real time.

**What makes it different from CrewAI, LangGraph, etc.:**

- **No framework** - Crewly doesn't replace your AI tools. It orchestrates the CLIs you already use (Claude Code, Gemini CLI, Codex). No Python, no SDK.
- **Real CLI sessions** - Each agent runs in a real terminal. They're not sandboxed API calls - they have full access to your codebase just like when you use them manually.
- **Web dashboard** - Live terminal streaming, activity monitoring, and task management in your browser.
- **Runs locally** - Everything stays on your machine. No cloud, no data leaving your environment.
- **Runtime-agnostic** - Mix runtimes on the same team. Your lead dev can be Claude Code while your test writer is Gemini CLI.

**Quick start:**
```bash
npm install -g crewly
npx crewly start
```

This opens a dashboard where you create a team, point it at a project, and watch agents go. Takes about 2 minutes from install to agents working.

**Stack:** TypeScript, Express, React, node-pty, Socket.IO. Open source (MIT).

**What I'm looking for:** Early users and feedback. The core orchestration works well, but I want to understand what workflows people actually want to run with multi-agent teams. Happy to answer any questions.

GitHub: https://github.com/stevehuang0115/crewly
npm: https://www.npmjs.com/package/crewly

---

## Expected Questions & Prepared Answers

### "How is this different from CrewAI?"

CrewAI is a Python framework where you write agent code using their SDK. Crewly is the opposite - it orchestrates existing AI CLI tools (Claude Code, Gemini CLI, Codex) that you already have installed. No framework to learn, no Python required, no custom agent code to write. You just define a team in the web UI and Crewly launches real CLI sessions.

### "How do the agents coordinate and not conflict?"

Agents communicate through a bash skill system. Each agent has skills like `report-status`, `delegate-task`, and `remember`. The orchestrator agent coordinates work assignments. Agents work in their own terminal sessions and file changes propagate through normal git/filesystem mechanisms. Crewly also has an activity monitoring layer that tracks what each agent is doing.

### "Isn't running CLI agents with --dangerously-skip-permissions risky?"

This is the same flag you'd use running Claude Code manually in autonomous mode. Crewly runs locally on your machine with the same permissions you'd grant manually. You can also customize the launch command per agent in settings to use whatever permission model you prefer. The key point: Crewly doesn't add any new risk beyond what the underlying CLI tools already have.

### "Does this work on Windows?"

Currently best supported on macOS and Linux. Windows support via WSL is possible but not fully tested yet. We're tracking this as a priority item.

### "What about token costs?"

Crewly doesn't add any cost on top of the underlying AI CLIs. Each agent uses its own API key/authentication. If you run 3 Claude Code agents, you pay for 3 sessions of Claude API usage. Crewly itself is free and open source.

### "What's on the roadmap?"

Key areas we're exploring: (1) Better inter-agent conflict resolution, (2) Skill marketplace for sharing custom agent skills, (3) Project templates for common team configurations, (4) Better support for non-Claude runtimes. Very open to user feedback on priorities.

### "Can I use this with local/self-hosted models?"

Currently supports Claude Code, Gemini CLI, and Codex as runtimes. Adding a new runtime is straightforward - you just need a CLI tool that accepts prompts from stdin and writes output to stdout. We'd love PRs adding support for Ollama, LM Studio, or other local runtimes.

---

## Posting Checklist

- [ ] Post on Tuesday or Wednesday, 8-10am ET
- [ ] Title under 80 characters
- [ ] Demo video / GIF linked in body (once created)
- [ ] GitHub repo README polished with screenshots
- [ ] `npx crewly start` tested on clean machine
- [ ] Have 2-3 people ready to monitor and respond to comments for first 6 hours
- [ ] Prepared answers reviewed and rehearsed
- [ ] Community channel (Discord/GH Discussions) ready for post-launch traffic
