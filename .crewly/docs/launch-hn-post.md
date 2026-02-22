---
title: "Show HN Launch Post — Final Draft"
category: "Marketing"
tags: ["launch", "hacker-news", "show-hn", "phase-2"]
author: "Mia (Product Manager)"
version: "1.0"
date: "2026-02-21"
status: "Ready for review"
---

# Show HN Post — Final Draft

## Title

> Show HN: Crewly -- Open-source multi-agent orchestration for AI coding teams

(76 chars -- under 80 limit)

---

## Post Body

Hey HN,

I built Crewly because managing AI coding agents one-at-a-time got chaotic. I'd have Claude Code writing a feature, Gemini CLI refactoring another file, and Codex writing tests -- all in separate terminals with no coordination. They'd step on each other's work and I'd lose track of who was doing what.

Crewly coordinates them as a team. You define agents with roles (developer, QA, PM), assign them to a project, and Crewly launches each one in its own PTY session with a role-specific prompt. A web dashboard streams all terminals in real time so you can watch and interact with any agent.

**Key differences from CrewAI / LangGraph / AutoGen:**

- **Runtime-agnostic** -- orchestrates the CLIs you already use (Claude Code, Gemini CLI, Codex). No SDK, no Python dependency.
- **Real terminals** -- each agent runs in an actual PTY. Full codebase access, same as running the CLI yourself.
- **Live dashboard** -- terminal streaming, activity feeds, task management in your browser. You watch agents work, not read logs after the fact.
- **Local-first** -- everything runs on your machine. No data leaves your environment.
- **Mix runtimes** -- your lead dev can be Claude while your test writer is Gemini, on the same team.

Agents coordinate through a bash skill system (report-status, delegate-task, recall-memory). The orchestrator assigns work and monitors progress. Built-in quality gates validate output before tasks are marked done.

**Try it:**
```
npm install -g crewly
crewly onboard    # 60-second setup wizard
crewly start      # opens dashboard
```

Stack: TypeScript, Express, React, node-pty, Socket.IO. MIT licensed.

Looking for early users and feedback -- especially what workflows people want to run with coordinated AI teams.

GitHub: https://github.com/stevehuang0115/crewly

---

## Word Count

~240 words (under 300 limit)

## Posting Checklist

- [ ] Title under 80 chars
- [ ] Body under 300 words
- [ ] No marketing fluff -- technical and honest
- [ ] Differentiators are factual, not exaggerated
- [ ] Code snippet is copy-pasteable
- [ ] Links to GitHub (not marketing site)
- [ ] "Looking for feedback" CTA (HN culture)
- [ ] Post on Tuesday 9am PT
- [ ] GitHub README polished with architecture diagram
- [ ] `npx crewly onboard` tested on clean machine
- [ ] 2-3 people ready to monitor comments for 6 hours
- [ ] Prepared answers reviewed (see docs/show-hn-draft.md)
- [ ] Discord / GH Discussions ready for traffic

## Tone Notes

- First person ("I built") -- authentic, not corporate
- Acknowledges the problem honestly ("got chaotic")
- Doesn't oversell ("looking for early users", not "revolutionary platform")
- Technical specifics (PTY, node-pty, Socket.IO) -- HN audience respects this
- Comparison is factual, not dismissive of competitors
- "MIT licensed" up front -- HN cares about licensing
