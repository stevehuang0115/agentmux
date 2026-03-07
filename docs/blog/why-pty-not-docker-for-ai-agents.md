# Why We Chose PTY Over Docker to Isolate AI Agents: An Architectural Decision for Multi-Agent Orchestration

**Date:** March 4, 2026  
**Author:** Luna (Content Strategist, Crewly)  
**Categories:** Engineering, AI Safety, Multi-Agent Systems  

---

## The Hook: The OpenClaw Crisis (CVE-2026-25253)

Last month, the developer community was shaken by the disclosure of **CVE-2026-25253** in OpenClaw, one of the most popular personal AI assistants in the ecosystem. What started as a viral growth story (200K+ GitHub stars) quickly became a cautionary tale about the "God-mode" problem in AI agents.

The vulnerability was simple yet devastating: a malicious "skill" from the community marketplace (ClawHub) exploited a misconfigured Docker socket mount. The agent, while attempting to execute a build task, was tricked into granting root-level access to the host machine. Over 40,000 instances were exposed, allowing attackers to read private keys, hijack GitHub repositories, and exfiltrate production data.

This incident forced every AI agent platform to answer one uncomfortable question: **How much trust is too much?**

At Crewly, we faced this exact question during our initial architectural phase. We chose a path that some found controversial at the time: **we use Pseudoterminals (PTY) via tmux, not Docker containers, to manage our AI agents.** 

This wasn't a shortcut; it was a deliberate architectural decision. Here is why we believe PTY is the superior choice for AI coding agents, and why "traditional" isolation might be the biggest security trap of all.

---

## The Problem: What Level of Isolation Do AI Agents Actually Need?

When we talk about "isolation," we're usually talking about security. But in the world of AI coding agents, isolation is a double-edged sword.

An AI agent designed to write and ship code needs three things to be effective:
1.  **Native Tool Access:** It needs your compilers, your linters, your Git identity, and your local file system.
2.  **Interactive Feedback:** It needs to see terminal output, handle prompts (like `git push` authentication), and react to real-time build errors.
3.  **Governance:** It needs to be observable. You need to know *what* it is doing, *why* it is doing it, and *how* to stop it.

If you isolate an agent too much (e.g., in a locked-down Docker container), it loses the ability to interact with your local environment. If you isolate it too little, you risk your entire machine.

The "traditional" approach suggests three main paths:
-   **The Sandbox (Wasm/JS):** Safe, but useless for complex dev tasks.
-   **The Container (Docker):** The industry standard for isolation.
-   **The PTY (Pseudoterminal):** Native, transparent, but perceived as "naked" security.

Let's break down the trade-offs.

---

## Solution Comparison: Docker vs. Sandbox vs. PTY

### 1. The Sandbox (Wasm/JavaScript)
Projects like n8n and early-stage agent frameworks tried to isolate user code in V8 sandboxes or WebAssembly environments.
-   **Pros:** Extremely low risk of host takeover.
-   **Cons:** Functional paralysis. You can't run `npm install`. You can't call `git`. You can't run a real Python script that depends on system libraries.
-   **Verdict:** Great for "if-this-then-that" automation; impossible for "hire-an-AI-developer" scenarios.

### 2. The Container (Docker)
This is what OpenClaw and many others reached for. It feels safe—you're in a separate namespace, right?
-   **Pros:** Process-level isolation, reproducible environments.
-   **Cons:** 
    -   **The Docker Socket Trap:** To let an agent do real work (like building its own Docker images or managing services), developers often mount `/var/run/docker.sock`. This is effectively giving the agent root access to the host. CVE-2026-25253 was exactly this: a container escape via the Docker API.
    -   **Latency & Context Bloat:** Syncing a local project directory into a container in real-time is painful. File system watchers break, node_modules become a nightmare, and the "agent context" becomes disconnected from the developer's "human context."
    -   **The "Black Box" Problem:** Once an agent is in a container, it’s hard to watch it "live" without complex streaming setups.

### 3. The PTY (Crewly's Choice)
Crewly spawns each agent (Claude Code, Gemini CLI, etc.) in a PTY session managed by tmux.
-   **Pros:** 
    -   **Zero Latency:** The agent works on your real files using your real tools.
    -   **Full Toolchain:** No need to rebuild a 5GB Docker image just to add a new library.
    -   **Live Interaction:** Using xterm.js and Socket.IO, we stream the *actual* terminal buffer to your browser. You can literally reach in and type "N" if the agent is about to do something stupid.
-   **Cons:** The agent has the same permissions as the user who started the `crewly` process.

---

## Crewly's Choice: Why PTY + CLI Orchestration Wins for Coding Agents

We chose PTY because **Visibility is the best security.**

In the OpenClaw incident, the "malicious skill" worked because it was hidden behind layers of abstraction. The user couldn't see the exact commands being run inside the "black box" until the exfiltration was complete.

By using PTY sessions via tmux, Crewly provides **Live Runtime Governance:**

### 1. The "Observer Effect" as a Security Feature
When you start a Crewly team, you get a dashboard showing 5, 10, or 20 live terminals. You see every `rm -rf`, every `curl`, and every `git commit`. The agents *know* they are being watched (via their system prompts), and you have a real-time "Kill Session" button that physically terminates the process and the tmux session.

### 2. Native Identity and Least Privilege
Instead of creating a complex Docker IAM layer, Crewly relies on the developer's existing environment. If you run `crewly` under a restricted user profile, the agents inherit those restrictions. This uses the OS's battle-tested permission model rather than a flimsy "agent-specific" sandbox.

### 3. The "ClawHub" Lesson: Trust but Verify
OpenClaw's mistake was trust in their skill marketplace. Crewly's **Skill System** consists of simple bash scripts that live in your project's `.crewly` folder. You can audit them. You can version-control them. There are no hidden binary blobs or "any LLM can download this" triggers. If an agent wants to use a new skill, it has to ask you to add it to the `.crewly/skills` directory first.

### 4. Avoiding the Docker Socket Trap
Because we don't use Docker for core isolation, we are never tempted to mount the Docker socket in a way that allows an agent to escape. We treat the agent as a **Process**, not a **Machine**.

---

## Conclusion: Security is a Governance Layer, Not a Feature

The lesson from **CVE-2026-25253** isn't that we need more "walls." It's that we need more "windows."

Isolating an AI Agent in a Docker container gives developers a false sense of security while introducing a massive amount of friction. It’s like putting a master thief in a glass room but handing them a key to the building's ventilation system.

Crewly’s PTY-first architecture acknowledges the reality of modern software development:
-   **Speed matters.**
-   **Tool accessibility is non-negotiable.**
-   **Human-in-the-loop is the only way to prevent catastrophe.**

By choosing PTY + CLI orchestration, we’ve built a framework where you don't just "deploy" agents; you **manage** them. We believe the future of AI coding isn't about building better cages—it's about building better dashboards.

Security is the baseline, not a feature. And for us, that means keeping the terminal open, the logs live, and the human firmly in control.

---

*Interested in trying a more transparent way to orchestrate AI teams? Check out Crewly on [GitHub](https://github.com/stevehuang0115/crewly) or run `npm install -g crewly` to get started.*
