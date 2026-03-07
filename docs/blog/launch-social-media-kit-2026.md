# Crewly Open Source Launch: Social Media Kit (2026)

**Purpose:** Comprehensive multi-channel assets for the official Crewly open-source launch.
**Key Messaging:** Isolation (PTY/tmux), real-time terminal streaming, "No SDK" CLI orchestration.
**Competitive Hook:** OpenClaw CVE-2026-25253 (Security & Governance).

---

## 1. Hacker News (Show HN)

### Titles (Pick One)
- **Show HN: Crewly – Orchestrate Claude Code, Gemini CLI, and Codex as a dev team** (Conservative/Direct)
- **Show HN: Crewly – Why we chose PTY isolation over Docker for AI coding agents** (Architectural/Provocative)
- **Show HN: Crewly – I was tired of managing AI agents one terminal at a time** (Personal/Problem-first)

### Post Body
Hey HN,

I’m the creator of Crewly (https://github.com/stevehuang0115/crewly). 

Most AI agent frameworks today (CrewAI, LangGraph, AutoGen) are SDKs. They require you to write Python code, learn a new library, and lock yourself into a specific way of building agents.

**Crewly is different.** It doesn’t replace your AI tools; it orchestrates the CLIs you already use—Claude Code, Gemini CLI, and OpenAI Codex. 

Each agent runs in its own **PTY session (via tmux)**. This gives them full access to your local toolchain (compilers, git, linters) without the "Black Box" problems or the security risks of misconfigured Docker socket mounts (looking at you, OpenClaw CVE-2026-25253).

**Key Features:**
- **Live Terminal Streaming:** Watch your agents type, think, and execute in real-time via an xterm.js-powered web dashboard.
- **No SDK Required:** If it runs in a terminal, Crewly can orchestrate it. No Python or custom agent code needed.
- **Inter-Agent Coordination:** Agents use a simple bash-based "Skill" system to report status, delegate tasks, and share knowledge.
- **Real Isolation, Real Context:** PTY sessions allow agents to work on your real files with zero latency, unlike container-based isolation.
- **Human-in-the-loop:** You can reach into any terminal session mid-task to provide manual input or redirect an agent.

**Quick Start:**
```bash
npm install -g crewly
crewly onboard  # Detects your installed AI CLIs
crewly start    # Launches the dashboard at :8787
```

We’re open-sourced under the MIT license. I’d love to hear your thoughts on the PTY vs. Docker isolation trade-off and what workflows you’d run with a coordinated AI team.

GitHub: [https://github.com/stevehuang0115/crewly](https://github.com/stevehuang0115/crewly)

---

## 2. Twitter/X Launch Thread (5-7 Tweets)

### [1/7] Hook
AI agents are powerful alone, but a mess to manage in groups. You open 5 terminals, they step on each other's code, and you lose track of who's doing what.

Meet **Crewly**: The open-source orchestrator that turns your AI CLIs into a coordinated dev team. 🚀

[Attach Screenshot of Web Dashboard]

### [2/7] The Problem
Most frameworks force you to write Python code just to get agents talking.

Crewly orchestrates the tools you *already* use: @AnthropicAI Claude Code, @Google Gemini CLI, and Codex. No SDK, no framework lock-in. Just raw CLI power.

### [3/7] Real-Time Visibility
Stop guessing what your agents are doing. 

Crewly streams every terminal session live to a web dashboard. Watch them run tests, fix bugs, and commit code in real-time. You can even jump in and type if they get stuck. 📺

### [4/7] Architecture: Why PTY?
We chose PTY (via tmux) over Docker containers. Why? 

Native access to your tools, zero file-sync latency, and better security than "Black Box" containers with root-access sockets (CVE-2026-25253).

Visibility is the best security. 🛡️

### [5/7] Multi-Agent Parallelism
Run a Lead Dev, a QA Engineer, and a PM simultaneously. 

They coordinate via a bash-based Skill system—reporting status and delegating tasks like a real team. Use different runtimes for different roles!

### [6/7] Built for Developers
- `npm install -g crewly`
- Automated onboarding
- Persistent project memory
- Budget tracking per agent/project
- Slack notifications for status updates

### [7/7] Call to Action
Crewly is MIT open-source and ready for your first "One-Person Company" sprint.

Star it on GitHub: [link]
Try it: `npx crewly start`
Follow @crewly for more AI Agent Ops tips. 

Let's build. 🛠️

---

## 3. Reddit r/programming

### Title
Crewly: An open-source orchestrator for AI coding CLIs (Claude Code, Gemini CLI) using PTY isolation

### Post Body
I’ve been experimenting with running multiple AI coding agents (Claude Code, Gemini CLI, etc.) as a team, and the biggest friction point wasn't the AI—it was the orchestration. 

I built **Crewly** to treat AI agents like real team members with real terminal sessions.

**The Architecture:**
Instead of a Python SDK, Crewly uses a Node.js backend to manage `node-pty` sessions inside `tmux`. 

**Why not Docker?**
I’ve seen a lot of agent platforms get burned by Docker recently (sandbox escapes, socket mount vulnerabilities). We chose PTY because it keeps the agent in the developer's native environment. You get full access to your local tools without the latency of volume mounting, and you get 100% visibility into every command executed.

**Core Workflow:**
1. **Onboard:** Detects your installed AI tools.
2. **Orchestrate:** Define roles (Dev, QA, PM) and system prompts.
3. **Collaborate:** Agents use bash skills to communicate.
4. **Monitor:** A React dashboard streams the xterm.js output via WebSockets.

I'm curious to get your take on the security of PTY-based isolation for agents vs. the overhead of containers. 

GitHub: [link]

### Potential Rebuttals / FAQ
- **"Why not just a bash script?"** -> Managing state, concurrent terminal I/O, and real-time streaming to a UI is complex. Crewly provides the "operating system" for these sessions.
- **"Is PTY safe?"** -> It has the same permissions as your user. We argue that seeing exactly what the agent does in a live terminal is safer than a hidden "black box" container that might have root-level socket access.
- **"Does it support [Local LLM]?"** -> If it has a CLI that takes a prompt and returns text, yes. We're adding an Ollama wrapper soon.

---

## 4. 小红书 (Xiaohongshu) - 中文发布帖

### 📌 标题建议
- **程序员狂喜！我把 Claude Code 变成了我的“全自动开发团队”**
- **一人公司天花板：Crewly 开源了！带队 5 个 AI Agent 是什么体验？**
- **别再手动复制粘贴了，用这套开源工具让 AI 助理自动卷代码**

### ✍️ 正文内容
春节后的一波大动作！我做的 AI Agent 编排框架 **Crewly** 正式开源了！🚀

作为一个“一人公司”的坚信者，我受够了在 5 个终端之间反复横跳。我需要的是一个能帮我盯着所有 AI 助理干活、能自动协作、还能让我随时“插手”的指挥部。

**Crewly 到底神在哪里？**
1. **不画大饼，只跑真工具：** 它不让你学复杂的 Python SDK，而是直接指挥你电脑里现成的 Claude Code, Gemini CLI。
2. **上帝视角：** 浏览器打开仪表盘，5 个终端窗口排排坐，看着 AI 自动写码、跑测试、修 Bug，这种感觉真的会上瘾。
3. **安全隔离：** 采用 PTY 隔离技术，比 Docker 更轻快，拒绝“黑盒”操作，所有命令你都能实时看见。
4. **一键上岗：** `npm install -g crewly`，2 分钟拉起你的 AI 开发小组。

无论你是想搞副业，还是想给自己的开发流程提效 10 倍，Crewly 就是为你准备的。

源码已在 GitHub 开源（搜 crewly），欢迎大家来提 Issue，一起把“一人公司”的梦做大！

#AI一人公司 #程序员 #开源项目 #Claude #独立开发 #效率工具 #Crewly #自动化 #副业 #搞钱

### 🎨 封面文案建议
- **左侧图片：** 5 个并发的终端窗口流，中间叠一个巨大的“100x 提效”。
- **右侧图片：** Crewly Web Dashboard 截图。
- **文字大标题：** “别卷了，你的 AI 团队已上线！”（荧光绿配色）。

---
*Report generated by Crewly Content Strategist Luna*
