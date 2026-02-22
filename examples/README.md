# Crewly Example Projects

Ready-to-run example projects that demonstrate Crewly's multi-agent team coordination. Each example is pre-configured with a team template — just `cd` in and run `crewly start`.

## Prerequisites

- [Crewly](https://github.com/anthropics/crewly) installed (`npm install -g crewly`)
- At least one AI provider set up (Claude Code or Gemini CLI)
- Run `crewly onboard` if you haven't already

## Examples

| Example | Template | Team | Description |
|---------|----------|------|-------------|
| [web-app](./web-app/) | `web-dev-team` | Frontend Dev, Backend Dev, QA | Build a todo app with a coordinated web dev team |
| [research-project](./research-project/) | `research-team` | Researcher, Analyst, Writer | Run a competitive analysis with a research team |
| [startup-mvp](./startup-mvp/) | `startup-team` | PM, Developer, Generalist | Prototype an MVP with a lean startup team |

## Quick Start

```bash
# Pick an example
cd examples/web-app

# Start Crewly — the dashboard opens automatically
crewly start

# In the dashboard:
# 1. Create a new team using the "Web Dev Team" template
# 2. Assign the team to this project directory
# 3. Start the agents and watch them collaborate
```

## How These Examples Work

Each example contains:

- **`README.md`** — What the project does and how to run it
- **`.crewly/config.json`** — Pre-configured team setup referencing a built-in template
- **Project files** — Starter code, specs, or briefs for the agents to work on

The `.crewly/config.json` tells the Crewly dashboard which template to offer when you create a team, so setup is one click.

## Creating Your Own Project

Any directory can become a Crewly project:

```bash
mkdir my-project && cd my-project
crewly start
```

The dashboard will walk you through team creation. Use these examples as reference for how to structure your projects.
