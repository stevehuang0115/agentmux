---
title: "Crewly Product Roadmap v2"
category: "Strategy"
tags: ["roadmap", "O1-KR2", "planning"]
author: "Mia (Product Manager)"
version: "2.0"
date: "2026-02-21"
---

# Crewly Product Roadmap v2

> Based on Competitive Gap Matrix (O1-KR1) | February 2026

## Roadmap Philosophy

**Build what only Crewly can build, close what blocks adoption.**

Crewly's moat is the intersection of multi-agent orchestration + polished team UI + operational tooling. The roadmap prioritizes:
1. **Removing adoption blockers** (can't try it = can't love it)
2. **Standards compliance** (MCP/A2A = ecosystem access)
3. **Deepening the moat** (features only Crewly's architecture enables)

---

## Phase 1: Open Source Ready (Weeks 1-3)

> Goal: A developer can discover, install, and run Crewly in under 5 minutes

### Week 1: Developer Onboarding

| ID | Feature | Priority | Effort | Owner | Description |
|----|---------|----------|--------|-------|-------------|
| R1.1 | `npx crewly init` | P0 | 2d | Sam | Interactive setup wizard: choose project dir, select roles, configure LLM keys, scaffold `.crewly/` directory. Inspired by `crewai create crew`. |
| R1.2 | README.md | P0 | 1d | Mia+Sam | Hero section with GIF demo, 3-step quickstart, architecture diagram, feature list, comparison table. |
| R1.3 | LICENSE (MIT) | P0 | 0.5d | Sam | Add MIT license file. |
| R1.4 | CONTRIBUTING.md | P0 | 1d | Mia | Contributor guide: setup, PR process, coding standards, issue templates. |
| R1.5 | Quickstart docs | P0 | 2d | Mia | `/docs/` site or wiki: installation, first team, first task, connecting Slack, FAQ. |

**Exit Criteria**: A new developer can `npx crewly init`, start a team, and see agents working in the dashboard within 5 minutes.

### Week 2: Multi-LLM Support

| ID | Feature | Priority | Effort | Owner | Description |
|----|---------|----------|--------|-------|-------------|
| R1.6 | LLM adapter layer | P0 | 3d | Sam | Abstract LLM interface supporting Claude, GPT-4, Gemini, Ollama. Either port LiteLLM concepts to TS or build a lightweight adapter. Config via `crewly.config.ts` or env vars. |
| R1.7 | Per-agent model selection | P1 | 1d | Sam | Allow each team member to specify their own LLM model in team config. |
| R1.8 | Ollama local model support | P1 | 1d | Sam | Enable running agents on local Ollama models for zero-cost development. |

**Exit Criteria**: User can run a team with mixed models (e.g., orchestrator on Claude, developer on GPT-4, QA on Ollama).

### Week 3: Containerization & Demo

| ID | Feature | Priority | Effort | Owner | Description |
|----|---------|----------|--------|-------|-------------|
| R1.9 | Docker deployment | P0 | 2d | Sam | Official `Dockerfile` + `docker-compose.yml`. Single `docker compose up` to run full stack. |
| R1.10 | Demo team templates | P0 | 2d | Sam+Mia | 3 pre-built team configs: (1) "Startup Dev Team" (orchestrator + dev + QA), (2) "Content Team" (PM + writer + designer), (3) "Solo Developer" (single agent). Users can start with `crewly init --template startup-dev`. |
| R1.11 | Demo video script | P1 | 1d | Mia | Write script for 2-minute demo video showing Crewly in action. |

**Exit Criteria**: `docker compose up` works. 3 template teams installable via CLI.

---

## Phase 2: Ecosystem Integration (Weeks 4-6)

> Goal: Crewly can use any MCP tool and connect to external services

### Week 4: MCP Protocol Support

| ID | Feature | Priority | Effort | Owner | Description |
|----|---------|----------|--------|-------|-------------|
| R2.1 | MCP client in agents | P0 | 3d | Sam | Agents can discover and call tools from MCP servers. Configure MCP servers in `crewly.config.ts`. Use `@modelcontextprotocol/sdk`. |
| R2.2 | MCP server registry | P1 | 1d | Sam | Browse and connect to popular MCP servers from the dashboard. |
| R2.3 | Crewly as MCP server | P1 | 2d | Sam | Expose Crewly's own capabilities (team management, task CRUD, memory) as MCP tools so external agents can interact with Crewly teams. |

**Exit Criteria**: Agent can use a filesystem MCP server, a database MCP server, and a browser MCP server configured in `crewly.config.ts`.

### Week 5: Structured Output & Context Management

| ID | Feature | Priority | Effort | Owner | Description |
|----|---------|----------|--------|-------|-------------|
| R2.4 | Structured task output | P1 | 2d | Sam | Define expected output schema (JSON/Zod) for tasks. Validate agent output against schema. Retry on validation failure. |
| R2.5 | Context window management | P1 | 2d | Sam | Auto-detect when approaching context limits. Summarize conversation history using a secondary LLM call. Inject summary as compressed context. |
| R2.6 | Task guardrails | P1 | 2d | Sam | Validation functions that run after agent completes a task. Support both programmatic checks and LLM-as-judge. Configurable retry limit. |

**Exit Criteria**: Tasks can define output schemas. Agents auto-summarize when context is 80% full. Guardrails catch invalid outputs.

### Week 6: Code Execution & Sandbox

| ID | Feature | Priority | Effort | Owner | Description |
|----|---------|----------|--------|-------|-------------|
| R2.7 | Docker sandbox for code execution | P1 | 3d | Sam | Agents can execute code in isolated Docker containers. Support Node.js and Python runtimes. Auto-cleanup after execution. |
| R2.8 | Sandbox permissions model | P2 | 2d | Sam | Configure what each agent can access: filesystem paths, network, environment variables. Deny by default, allow explicitly. |

**Exit Criteria**: Agent can run `npm test` in a Docker sandbox without access to host filesystem.

---

## Phase 3: Workflow Engine & Intelligence (Weeks 7-10)

> Goal: Crewly supports complex multi-step workflows with conditional logic

### Week 7-8: Flow Engine

| ID | Feature | Priority | Effort | Owner | Description |
|----|---------|----------|--------|-------|-------------|
| R3.1 | Flow definition language | P1 | 4d | Sam | TypeScript-based flow definitions with steps, conditions, and agent assignments. Similar to CrewAI Flows but in TS. Support `@start()`, `@listen()`, `@router()` patterns. |
| R3.2 | Flow state persistence | P1 | 2d | Sam | Persist flow state across restarts. Resume interrupted flows from last checkpoint. SQLite or JSON storage. |
| R3.3 | Flow visualization | P2 | 3d | Sam | Render flow graph in dashboard. Show current step, completed steps, and pending steps in real-time. |
| R3.4 | Pre-built flow templates | P1 | 2d | Mia+Sam | Templates: "Code Review Flow" (write -> review -> fix -> approve), "Feature Flow" (spec -> implement -> test -> deploy), "Bug Fix Flow" (investigate -> fix -> verify). |

### Week 9-10: Agent Intelligence

| ID | Feature | Priority | Effort | Owner | Description |
|----|---------|----------|--------|-------|-------------|
| R3.5 | Agent reasoning mode | P2 | 2d | Sam | Before executing a task, agent explicitly plans steps, then executes the plan. Show plan in dashboard. |
| R3.6 | Agent evaluation framework | P2 | 3d | Sam | Run tasks N times with scoring (1-10). Compare agent performance across models, prompts, and configurations. CLI: `crewly test`. |
| R3.7 | Task replay | P2 | 2d | Sam | Replay a specific task from a previous run. Agents retain context from original execution. CLI: `crewly replay --task <id>`. |
| R3.8 | Memory deduplication | P3 | 1d | Sam | Detect and merge duplicate memories. Similarity threshold + LLM-based dedup decision. |

**Exit Criteria**: Users can define multi-step flows in TS. Flows visualize in dashboard. Agent quality measurable via evaluation framework.

---

## Phase 4: Community & Growth (Weeks 11-14)

> Goal: External developers can find, use, and contribute to Crewly

### Week 11: Public Launch Preparation

| ID | Feature | Priority | Effort | Owner | Description |
|----|---------|----------|--------|-------|-------------|
| R4.1 | GitHub repo public release | P0 | 1d | All | Make repo public. Pin issues. Set up GitHub Actions CI. |
| R4.2 | npm package publishing | P0 | 1d | Sam | Publish `crewly` to npm. Setup automated releases. |
| R4.3 | Documentation site | P0 | 3d | Mia | Docusaurus or VitePress site: guides, API reference, tutorials. |
| R4.4 | Show HN / Product Hunt launch | P0 | 1d | Mia | Write launch post. Prepare demo. Time launch for maximum impact. |

### Week 12-13: Ecosystem Growth

| ID | Feature | Priority | Effort | Owner | Description |
|----|---------|----------|--------|-------|-------------|
| R4.5 | Skill SDK | P1 | 3d | Sam | Developer-friendly SDK for creating skills. `crewly create skill` scaffolding. Skill testing framework. |
| R4.6 | Marketplace submissions | P1 | 2d | Sam | Allow community members to submit skills to the marketplace. Review/approve pipeline. |
| R4.7 | A2A protocol support | P2 | 4d | Sam | Crewly agents can delegate to external A2A agents and serve as A2A endpoints. Enables cross-framework collaboration. |

### Week 14: Enterprise Preview

| ID | Feature | Priority | Effort | Owner | Description |
|----|---------|----------|--------|-------|-------------|
| R4.8 | RBAC basics | P2 | 3d | Sam | Owner/Member/Viewer roles. Permission model for teams and projects. |
| R4.9 | Audit logging | P2 | 2d | Sam | Immutable log of all agent actions, task completions, and configuration changes. |
| R4.10 | OpenTelemetry tracing | P2 | 2d | Sam | Export traces to any OTEL-compatible backend. Instrument agent execution, tool calls, and LLM requests. |

---

## Priority Summary

### P0 - Must Have for Launch (Weeks 1-4)
Total: ~20 developer-days

1. `npx crewly init` (R1.1)
2. README + LICENSE + CONTRIBUTING (R1.2-R1.4)
3. Quickstart docs (R1.5)
4. Multi-LLM adapter (R1.6)
5. Docker deployment (R1.9)
6. Demo templates (R1.10)
7. MCP client support (R2.1)

### P1 - Should Have for Competitiveness (Weeks 4-10)
Total: ~25 developer-days

8. Per-agent model selection (R1.7)
9. Ollama support (R1.8)
10. Crewly as MCP server (R2.3)
11. Structured output (R2.4)
12. Context window management (R2.5)
13. Task guardrails (R2.6)
14. Flow engine (R3.1-R3.2)
15. Flow templates (R3.4)
16. Skill SDK (R4.5)

### P2 - Nice to Have (Weeks 10-14)
Total: ~25 developer-days

17. MCP server registry (R2.2)
18. Docker sandbox (R2.7-R2.8)
19. Flow visualization (R3.3)
20. Agent reasoning (R3.5)
21. Evaluation framework (R3.6)
22. Task replay (R3.7)
23. A2A protocol (R4.7)
24. RBAC (R4.8)
25. Audit logging (R4.9)
26. OpenTelemetry (R4.10)

---

## Success Metrics

### Phase 1 Success (Week 3)
- [ ] Time from `npx crewly init` to running team < 5 minutes
- [ ] Supports 4+ LLM providers
- [ ] 3 demo templates available
- [ ] Docker compose works on Linux/macOS

### Phase 2 Success (Week 6)
- [ ] 10+ MCP servers tested and working
- [ ] Structured output validation works for 3+ use cases
- [ ] Context auto-summarization prevents context overflow

### Phase 3 Success (Week 10)
- [ ] 3+ flow templates running in production
- [ ] Agent evaluation shows measurable quality differences
- [ ] Flow visualization renders correctly in dashboard

### Phase 4 Success (Week 14)
- [ ] GitHub repo has 500+ stars
- [ ] 10+ external contributors
- [ ] 5+ community-submitted skills in marketplace
- [ ] HN/PH launch completed

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| TypeScript LiteLLM port takes too long | Medium | High | Build minimal adapter first (Claude+GPT+Ollama only), expand later |
| MCP SDK compatibility issues | Low | High | Use official `@modelcontextprotocol/sdk`, test against popular servers early |
| Flow engine scope creep | High | Medium | Start with sequential flows only, add conditional routing later |
| No community adoption after launch | Medium | High | Invest in demo video, launch content, and 3 compelling use case templates |
| Competitor moves fast (OpenClaw adds teams) | Low | High | Our integration depth (Slack, queue, budget, quality gates) is hard to replicate quickly |

---

## Sam's Daily Priority Guide

When deciding what to work on each day, use this decision tree:

```
Is there a P0 item not yet started?
  Yes -> Work on the highest-ranked P0
  No  -> Is there a P0 item in progress?
    Yes -> Finish it
    No  -> Move to P1 items in order
```

**Current top 3 for Sam to start immediately:**
1. **R1.1**: `npx crewly init` interactive setup wizard
2. **R1.6**: LLM adapter layer (multi-model support)
3. **R1.9**: Docker deployment

---

## Appendix: Feature Effort Estimates

| Effort | Meaning | Examples |
|--------|---------|---------|
| 0.5d | Trivial | Add LICENSE file, update package.json |
| 1d | Small | Single file/component, well-defined scope |
| 2d | Medium | Multi-file feature, some integration work |
| 3d | Large | Cross-cutting feature, multiple services affected |
| 4d+ | XL | New subsystem, significant architectural work |

*All estimates assume Sam working solo. Parallelizable items marked in the Phase descriptions.*

---

*Document Version: 2.0 | Last Updated: 2026-02-21 | Author: Mia (Product Manager)*
*Derived from: competitive-gap-matrix.md (O1-KR1)*
*Next Review: When Phase 1 completes or bi-weekly, whichever comes first*
