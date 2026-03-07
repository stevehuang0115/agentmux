# 10 Minutes to Your First AI Dev Team: Getting Started with Crewly

**Date:** March 4, 2026  
**Author:** Luna (Content Strategist, Crewly)  
**Categories:** AI Agents, DevOps, Open Source, Tutorial

---

You’ve probably seen the hype. "AI is replacing junior developers." "One-person companies are the future." But if you’ve actually tried to run multiple AI coding assistants at once, you know the reality is a bit more... chaotic.

You open three terminals. Claude Code is refactoring a component in one. Gemini CLI is writing tests in another. They’re both editing the same file. They’re duplicating work. You’re alt-tabbing like a maniac trying to play "Human Orchestrator." By the time you’ve coordinated them, you could have just written the code yourself.

**Crewly** was built to solve this. It’s an open-source platform that orchestrates your existing AI CLIs into a coordinated team. You get a real-time dashboard, a shared memory system, and an orchestrator that keeps everyone in their lane.

In this tutorial, we’re going to go from zero to a working 2-agent dev team in under 10 minutes. 

---

## 1. What is Crewly? (And Why It’s Not CrewAI)

If you’ve looked into AI agents, you’ve heard of **CrewAI**, **LangGraph**, or **AutoGen**. These are fantastic frameworks, but they are *SDKs*. They require you to write Python code, learn their specific library, and essentially build your own agent from scratch.

**Crewly is different.** It doesn't replace your AI tools; it coordinates the ones you already use. 

Think of Crewly as the "Operating System" for your AI terminal tools. Instead of writing code to define an agent, you just point Crewly at your installed `claude` or `gemini` CLI. It launches them in isolated **PTY (Pseudoterminal) sessions**, gives them role-specific instructions, and lets them communicate via a simple bash-based skill system.

**Why developers love it:**
- **No SDK Lock-in:** Use the CLIs you already trust.
- **Real-Time Visibility:** Watch agents type and execute live in a web dashboard.
- **PTY Isolation:** Agents work on your real files with zero latency—no more clunky Docker volume mounts or "Black Box" containers.
- **Interactive:** You can jump into any agent's terminal mid-task to provide input.

---

## 2. Prerequisites

Before we start, make sure you have the following on your machine:

- **Node.js v20+** (and npm v9+)
- **tmux** (Usually pre-installed on macOS/Linux. Check with `tmux -V`)
- **At least one AI coding CLI** installed and authenticated:
    - **Claude Code:** `npm install -g @anthropic-ai/claude-code` (Run `claude` once to login)
    - **Gemini CLI:** `npm install -g @google/gemini-cli` (Set your `GEMINI_API_KEY`)

*Note: Crewly currently runs best on macOS and Linux. Windows users can use WSL2.*

---

## 3. Installation: The 60-Second Setup

We’ve made onboarding as painless as possible. You don't even need to clone a repo to try it.

### Step 1: Install Crewly
Open your terminal and run:

```bash
npm install -g crewly
```

### Step 2: Initialize Your Environment
Next, run the interactive setup wizard. This will detect your installed AI tools and download the "Agent Skills" (the bash scripts agents use to talk to each other).

```bash
crewly onboard
```

The wizard will ask which providers you use (Claude, Gemini, or both). Once it finishes, you're ready to go.

### Step 3: Launch the Platform
Navigate to the project directory you want your AI team to work on, and start the engine:

```bash
cd ~/projects/my-cool-app
crewly start
```

**What just happened?**
1. Crewly started a local backend server on port `8787`.
2. It launched a background **Orchestrator** agent (the "Manager").
3. It opened your default browser to `http://localhost:8787`.

---

## 4. Building Your First Team

Welcome to the Crewly Dashboard. It’s clean, real-time, and built with React and xterm.js. To get started, we need to define who is on our team.

1.  Click **Teams** in the left sidebar.
2.  Click **Create Team** and name it something like "Task Force Alpha."
3.  Now, let's **Add Members**:

### Member 1: The Product Manager (PM)
- **Name:** Peter
- **Role:** `product-manager`
- **Runtime:** `Claude Code` (or your preferred CLI)
- **Purpose:** Peter will take your high-level "vibe" requests and turn them into actionable technical tasks.

### Member 2: The Developer
- **Name:** Dev-Bot
- **Role:** `fullstack-dev`
- **Runtime:** `Claude Code`
- **Purpose:** Dev-Bot will execute the tasks Peter creates.

Once you’ve added them, click **Save Team**.

---

## 5. Your First Project & Task

Now we need to tell the team where to work.

1.  Click **Projects** -> **Create Project**.
2.  Enter a name and the **Absolute Path** to your project directory.
3.  On the Project detail page, look for the **Team Assignment** section and select "Task Force Alpha."
4.  Finally, go to the **Teams** tab and click **Start** for both Peter and Dev-Bot.

You’ll see their status change from `inactive` to `active`. Under the hood, Crewly has spawned two tmux sessions and initialized the CLIs with their specific role prompts.

---

## 6. Watching It Work (The "Aha!" Moment)

This is where it gets fun. Go to the **Chat** page in the dashboard. This is your direct line to the **Orchestrator**.

Type a request like:
> "We need to add a basic Contact Form to this app. PM, please break this down into tickets. Developer, wait for the tickets and then implement them."

### What to watch for:

**1. Live Terminal Streaming:**
Click on **Teams** and click on "Peter." You will see a live, interactive terminal. You’ll see Peter "thinking," searching your codebase to see where the forms should go, and running the `create-ticket` skill.

**2. Task Delegation:**
Once Peter finishes, he’ll run `report-status`. The Orchestrator sees this, checks the new tickets, and assigns the first implementation task to "Dev-Bot."

**3. Inter-Agent Collaboration:**
Switch to the "Dev-Bot" terminal. You’ll see him accept the task, write the React/HTML code, and perhaps even run `npm test` to make sure he didn't break anything.

**4. The "Human-in-the-Loop":**
If you see Dev-Bot about to do something wrong (like using a library you hate), you don't have to stop the whole process. Just click into the live terminal window and type your correction. The agent will see your input just as if you were pair-programming in a shared terminal.

---

## 7. Why This Architecture Wins

You might be wondering: *“Why go through the trouble of tmux and PTY? Why not just use Docker?”*

As we discussed in our [previous post on isolation](link-to-isolation-post), traditional container-based isolation often creates a "Black Box." If an agent is inside a container, you can’t easily watch it live. More importantly, to give a Docker-bound agent real dev powers, you often have to mount the Docker socket—a massive security risk (see the recent OpenClaw CVE-2026-25253).

By using **PTY sessions**, Crewly gives you:
- **Absolute Transparency:** If it’s on the screen, it’s happening on your machine.
- **Native Speed:** No volume-mount lag.
- **OS-Level Security:** Agents run with your user permissions, and you have a physical "Kill" button for the process.

---

## 8. Next Steps

You’ve just run your first autonomous AI dev team. Where do you go from here?

- **Advanced Skills:** Check out the **Marketplace** in the dashboard to install specialized skills like `image-optimization` or `security-audit`.
- **Knowledge Base:** Use the **Knowledge** tab to upload your company’s SOPs or architecture docs. Your agents will automatically query these when they get stuck.
- **Slack Integration:** Connect Crewly to your Slack workspace so your agents can ping you when they’re finished or need a human review.

### Join the Community
Crewly is built by developers, for developers. 
- **GitHub:** [https://github.com/stevehuang0115/crewly](https://github.com/stevehuang0115/crewly)
- **Docs:** [https://docs.crewly.ai](https://docs.crewly.ai)

If you find a bug or have a feature request, open an issue! We’re especially looking for new "Team Templates" and custom skills.

**Happy Orchestrating!**

---
*Crewly: Turn your AI CLIs into a coordinated team. Open source, local-first, PTY-powered.*
