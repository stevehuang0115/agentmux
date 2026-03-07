# One Orchestrator, Many Runtimes: How Crewly Manages Claude Code, Gemini CLI, and Codex Simultaneously

**Date:** March 4, 2026  
**Author:** Luna (Content Strategist, Crewly)  
**Categories:** AI Engineering, Multi-Agent Systems, Software Architecture

---

## 1. The Hook: Why One AI is Never Enough

In the early days of the AI boom, the dream was simple: "One Model to Rule Them All." We thought we’d just find the smartest LLM, give it a prompt, and watch a billion-dollar company emerge from the terminal. 

But as anyone building real-world AI agent teams quickly discovered, the "Single Model" approach is a trap. It’s like trying to build a skyscraper with a team of 50 Nobel Prize-winning physicists but no plumbers, no electricians, and no foremen. They’re brilliant at the big picture, but they’ll argue about the fluid dynamics of a U-bend for three days while the basement floods.

In a complex software project, different tasks require different "cognitive profiles." 
- **Claude 3.7 / 4.x** might be the best at architectural reasoning and refactoring "spaghetti code" without breaking logic.
- **Gemini 2.x / Pro** might be the speed king, capable of scanning 100 industry papers in seconds with a massive context window and a near-zero price tag.
- **OpenAI Codex/o1** might be the "brute force" champion for generating repetitive boilerplate or unit tests.

The challenge isn't finding the *best* AI. It’s building an orchestrator that can manage a **Hybrid Team** where a Claude agent, a Gemini agent, and a Codex agent work in the same codebase, at the same time, without stepping on each other's toes.

This is the philosophy behind **Crewly**.

---

## 2. The Value of the Multi-Runtime Stack

At Crewly, we treat AI models as "Runtimes"—interchangeable engines that power specific roles. Here’s how we break down the value of a mixed-model team:

### Claude Code: The Senior Architect
Claude remains the gold standard for **code quality and complex reasoning**. When an agent needs to refactor a legacy authentication module or debug a race condition that spans four files, you want Claude in the driver’s seat. It follows instructions with surgical precision and has a "taste" for clean code that others often lack.

### Gemini CLI: The Research & Speed Specialist
Gemini is our secret weapon for **high-velocity, high-volume tasks**. Thanks to its massive context window and generous free tiers, we use Gemini agents for "The Grunt Work":
- Scanning the entire `node_modules` for security vulnerabilities.
- Reading 50 GitHub issues to summarize a feature request.
- Monitoring real-time market signals.
It’s fast, it’s cheap (or free), and it handles "context bloat" better than almost anything else.

### Codex / GPT-o1: The Executioner
For tasks that require heavy logic "chain-of-thought" or generating 500 lines of repetitive test cases, the OpenAI stack remains a powerhouse. 

**The Crewly Thesis:** You shouldn't have to choose. You should be able to hire a "Senior Dev" powered by Claude and a "QA Intern" powered by Gemini, and let them talk to each other.

---

## 3. The Orchestration Challenge: Herding the AI Cats

Managing a multi-runtime team isn't as simple as opening three browser tabs. When you move from "Chatting with an AI" to "Orchestrating a Team," you hit three major technical walls:

### A. Format Divergence
Claude Code, Gemini CLI, and Codex all have different CLI signatures. One expects prompts via a specific flag, another uses interactive stdin, and a third might have a proprietary "thinking" animation that breaks standard regex parsers. If your orchestrator is just a "wrapper," it will break the moment a CLI updates its UI.

### B. State Tracking
How do you know when a Gemini agent has finished "Researching" so that the Claude agent can start "Building"? If they are separate processes, they are blind to each other’s progress.

### C. The Collaboration Gap
A "Hybrid Team" requires agents to share context. If a Gemini agent finds a bug in a dependency, it needs a way to hand that "Knowledge" to the Claude agent in a format both understand.

---

## 4. The Crewly Solution: A Unified Operating System for Agents

Crewly solves the multi-runtime problem by moving the orchestration logic out of the "AI prompt" and into the **System Layer**.

### 1. Unified PTY Session Management
Instead of trying to parse the varying APIs of different models, Crewly operates at the **Terminal Level**. We spawn each agent in a Pseudoterminal (PTY) session managed by `node-pty` and `tmux`. 
Whether it’s Claude, Gemini, or a custom local LLM, Crewly treats them as a **Process**. We stream the raw terminal output via WebSockets (Socket.IO) and render it in a unified xterm.js dashboard. This means we don't care about the internal API—if it prints to a terminal, we can orchestrate it.

### 2. Runtime-Agnostic Skill System
This is the heart of Crewly. Agents communicate using **Bash Skills**. 
When a Gemini agent finishes a research task, it doesn't "send a message" to the Claude agent. It executes a bash script:
```bash
bash skills/agent/report-status/execute.sh \
  '{"status":"done", "summary":"Found 3 security flaws in lib-x"}'
```
Because every AI CLI has a `run command` capability, this "Skill System" becomes a universal language. The Claude agent can then use the `recall` skill to find that summary in the project's shared memory. **The runtime doesn't matter; the bash shell is the common denominator.**

### 3. Real-Time Cross-Runtime Streaming
Our web dashboard allows you to see a Claude session and a Gemini session side-by-side. The state is synchronized through a local backend that monitors all PTY buffers simultaneously. You can see the "Hand-off" happen in real-time.

---

## 5. Case Study: The "Gemini Triple-Threat" Efficiency

To prove this architecture works, let's look at a real-world project we ran today: **The "AI Content Factory" (Code-named: 牛马工厂).**

We deployed three **Gemini CLI agents** simultaneously to handle a high-volume research and content generation sprint for a Xiaohongshu (social media) account.

**The Team Setup:**
1. **Agent A (Researcher):** Scanned 50 competitor posts to extract "Viral Hooks."
2. **Agent B (Data Analyst):** Cross-referenced the hooks with historical account performance.
3. **Agent C (Draft Writer):** Generated 10 different content versions based on the hooks and data.

**The Results:**
- **Concurrency:** Because Gemini CLI has high rate limits, all three agents ran at 100% capacity simultaneously.
- **Cost:** **$0.** By utilizing the Gemini Pro free tier across three parallel sessions, we processed over 500,000 tokens of research data in 15 minutes without spending a cent.
- **Coordination:** The "Researcher" saved its findings to a shared Markdown file using a `record-learning` skill. The "Draft Writer" then used a `query-knowledge` skill to pull that data. 

In a single-model setup, this would have been a sequential, slow, and expensive process. In Crewly's multi-runtime environment, it was a **parallelized assembly line.**

---

## 6. Conclusion: The Power of Choice

The winning AI teams of 2026 won't be the ones with the "smartest" model. They’ll be the ones with the **best orchestration**.

By treating AI as a "Runtime" and the terminal as the "Interface," Crewly gives developers the freedom to mix and match. You can hire Claude for the brains, Gemini for the speed, and Codex for the volume—and manage them all from a single, beautiful dashboard.

**Stop picking sides in the Model Wars. Start building a team that uses all of them.**

---

*Ready to build your hybrid AI team? [Join us on GitHub](https://github.com/stevehuang0115/crewly) and see how Crewly turns your favorite CLIs into a coordinated powerhouse.*
