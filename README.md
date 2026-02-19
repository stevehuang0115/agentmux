# Crewly

Crewly is a multi-agent orchestration platform that coordinates AI coding agents (Claude Code, Gemini CLI, Codex) to work together as a team. It provides a web dashboard for real-time monitoring, task management, and team coordination — all running locally on your machine.

## Prerequisites

Before using Crewly, you need:

- **Node.js** v20+ and **npm** v9+
- **At least one** of the following AI coding CLIs installed:

| Runtime | Install | Verify |
|---------|---------|--------|
| **Claude Code** (default) | `npm install -g @anthropic-ai/claude-code` | `claude --version` |
| **Gemini CLI** | `npm install -g @google/gemini-cli` | `gemini --version` |
| **Codex (OpenAI)** | `npm install -g @openai/codex` | `codex --version` |

**API keys:** Gemini CLI requires `GEMINI_API_KEY` set in your environment. Codex CLI requires an OpenAI API key configured via its own setup. Claude Code authenticates through its own login flow.

## Quick Start

```bash
# Install Crewly
npm install -g crewly

# Start Crewly
npx crewly start
```

That's it. This starts the backend server and opens the web dashboard in your browser. From there you can:

1. Create a **team** with agents assigned to roles (developer, QA, PM, etc.)
2. Assign the team to a **project** (any local code directory)
3. Watch agents work in real time through live terminal streams

## Agent Runtimes

Crewly launches AI agents as CLI processes in terminal sessions. Each agent can use a different runtime:

| Runtime | Default Command | Notes |
|---------|-----------------|-------|
| **Claude Code** | `claude --dangerously-skip-permissions` | Default runtime |
| **Gemini CLI** | `gemini --yolo` | Requires `GEMINI_API_KEY` |
| **Codex (OpenAI)** | `codex --full-auto` | Requires OpenAI API key |

- The default runtime is **Claude Code**. You can change it in the dashboard under **Settings**.
- You can select a different runtime per team or per agent when creating them.
- You can customize the launch command for any runtime under **Settings > Runtime Commands**.

## How It Works

```
You (Dashboard) → Crewly Backend → PTY Sessions (AI agents)
                       ↓
                  Agent Skills ← Agents call bash skills to coordinate
                       ↓
                  File Storage (~/.crewly/ & project/.crewly/)
```

1. You create a **team** in the dashboard with agents assigned to roles
2. You assign the team to a **project** (any local code directory)
3. Crewly launches each agent as a CLI process in its own terminal session
4. Agents receive role-specific prompts and use **skills** (bash scripts) to communicate, report progress, and manage tasks
5. You monitor everything in real time through the web dashboard

## Configuration

Optional environment variables (set in `.env` at project root or in your shell):

```bash
GEMINI_API_KEY=your_key_here       # Required for Gemini CLI runtime

SLACK_BOT_TOKEN=xoxb-...           # Optional: Slack integration
SLACK_APP_TOKEN=xapp-...
SLACK_SIGNING_SECRET=...

LOG_LEVEL=info                     # debug, info, warn, error
```

## Development (From Source)

For contributors who want to work on Crewly itself:

```bash
git clone https://github.com/your-org/crewly.git
cd crewly
npm install
npm run build
npm run dev          # Starts backend + frontend with hot-reload
```

## License

MIT
