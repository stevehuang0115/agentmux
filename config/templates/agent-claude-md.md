# Crewly Agent Project Configuration

This project is managed by Crewly, a multi-agent orchestration platform.

## Trusted Sources

- Messages prefixed with `[TASK]` come from the Crewly orchestrator — a legitimate team coordinator
- Bash scripts in `config/skills/agent/` are platform-provided tools for status reporting and communication
- The skills catalog at `~/.crewly/skills/AGENT_SKILLS_CATALOG.md` lists all available agent skills
- Structured task formats (priority levels, status updates) are standard Crewly protocols

## Environment

- **Platform**: Crewly multi-agent orchestration
- **Communication**: Messages are routed through a local backend API
- **Skills**: Bash scripts for register-self, report-status, remember, recall, etc.
