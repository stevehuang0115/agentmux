---
title: "Crewly Product Roadmap v3"
category: "Strategy"
tags: ["roadmap", "O1-KR2", "planning", "prioritized"]
author: "Mia (Product Manager)"
version: "3.0"
date: "2026-02-21"
derived_from: ["competitive-gap-matrix.md (v3.0, O1-KR1)", "roadmap-v2.md"]
---

# Crewly Product Roadmap v3

> **O1-KR2 Deliverable** | Prioritized & Actionable | February 2026
>
> This roadmap is Sam's daily input for O2-KR1. Pick the top unstarted item and build it.

## Roadmap Philosophy

**Build what only Crewly can build. Close what blocks adoption. Skip what doesn't matter yet.**

Three principles, in order:
1. **Adoptability first** -- if developers can't install and try Crewly in 5 minutes, nothing else matters
2. **Moat deepening** -- invest in features competitors can't easily copy (terminal streaming, team management, budget tracking)
3. **Ecosystem access** -- MCP/protocol support unlocks the entire tool ecosystem without building every tool ourselves

---

## OKR Alignment Map

Every roadmap item maps to an OKR Key Result:

| OKR Key Result | Roadmap Items |
|---------------|---------------|
| **O2-KR1**: Daily feature output per roadmap | All Phase 1 items (Sam's work queue) |
| **O2-KR2**: Code quality (80%+ tests, TS strict, docs) | Applied to every item -- not a separate feature |
| **O2-KR3**: Open-source release prep (LICENSE, CONTRIBUTING, README, `npx crewly init`) | F1, F2, F3, F4, F5 |
| **O1-KR1**: Competitive gap matrix | Complete (input to this document) |
| **O1-KR2**: Prioritized roadmap | This document |
| **O1-KR3**: Bi-weekly competitor updates | Mia ongoing -- not a build item |
| **O3** (Phase 2): Marketing/growth | Phase 2 items |
| **O4/O5** (Phase 3): Community/support | Phase 3 items |

---

## Phase 1: Research + Development (NOW)

> **Goal**: 3+ differentiated core features + complete demo flow
> **Team**: Mia (PM) + Sam (Dev)
> **Exit trigger**: 3+ core features shipped + end-to-end demo works + user confirms ready

### Theme A: Developer Experience (Adoption Blockers)

These are P0 -- without them, no one can try Crewly.

---

#### F1: `npx crewly init` Interactive Setup Wizard

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Complexity** | M (2-3 days) |
| **Owner** | Sam |
| **Closes Gap** | G1 (onboarding -- CrewAI has `crewai create`, LangGraph has `create-agent-chat-app`) |
| **Dependencies** | None -- can start immediately |
| **OKR** | O2-KR3 |

**What to build**:
- `npx crewly init` command that interactively scaffolds a new project
- Prompts: project name, directory, team template (or custom), LLM provider + API key
- Generates: `.crewly/` directory, `crewly.config.ts`, team config YAML, `.env` with API keys
- Includes `--template` flag for prebuilt teams (see F5)
- Prints "next steps" with `crewly start` command after setup

**Acceptance criteria**:
- [ ] `npx crewly init` runs without errors on macOS and Linux
- [ ] Scaffolds working `.crewly/` directory structure
- [ ] Generated project runs with `crewly start` without additional manual setup
- [ ] Interactive prompts have sensible defaults (press Enter to skip)
- [ ] `--yes` flag for non-interactive mode (CI-friendly)

---

#### F2: README.md Overhaul

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Complexity** | S (1 day) |
| **Owner** | Sam (code examples) + Mia (copy) |
| **Closes Gap** | G2 (open-source readiness) |
| **Dependencies** | F1 (needs init command for quickstart section) |
| **OKR** | O2-KR3 |

**What to build**:
- Hero section: one-liner description + GIF/screenshot of dashboard with agents working
- 3-step quickstart: `npm install -g crewly` -> `crewly init` -> `crewly start`
- Architecture diagram (text-based, Mermaid, or image)
- Feature comparison table (vs CrewAI, LangGraph -- from gap matrix)
- Badges: npm version, license, stars, CI status
- Links to docs, Discord, contributing guide

**Acceptance criteria**:
- [ ] README renders correctly on GitHub
- [ ] Quickstart actually works (tested end-to-end)
- [ ] Comparison table is factually accurate (no exaggeration)

---

#### F3: LICENSE File (MIT)

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Complexity** | S (0.5 day) |
| **Owner** | Sam |
| **Closes Gap** | G2 (open-source readiness) |
| **Dependencies** | None |
| **OKR** | O2-KR3 |

**What to build**:
- MIT license file at repo root
- Update `package.json` license field to `"MIT"` (currently `"ISC"`)
- Add license header reference in CONTRIBUTING.md

**Acceptance criteria**:
- [ ] LICENSE file exists at repo root
- [ ] `package.json` says `"license": "MIT"`
- [ ] GitHub detects and displays the license

---

#### F4: CONTRIBUTING.md

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Complexity** | S (1 day) |
| **Owner** | Mia |
| **Closes Gap** | G2 (open-source readiness) |
| **Dependencies** | None |
| **OKR** | O2-KR3 |

**What to build**:
- Development setup guide (prerequisites, clone, install, build, test)
- PR process (branch naming, commit format, review expectations)
- Code standards summary (TypeScript strict, co-located tests, JSDoc)
- Issue templates: bug report, feature request
- Code of conduct reference

**Acceptance criteria**:
- [ ] New contributor can set up dev environment following the guide
- [ ] Issue templates work on GitHub
- [ ] Links to relevant docs/specs

**Status**: Draft exists at `/CONTRIBUTING.md` (in git status as untracked). Needs review and completion.

---

#### F5: Demo Team Templates

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Complexity** | M (2 days) |
| **Owner** | Sam + Mia (template design) |
| **Closes Gap** | G13 (prebuilt templates -- LangGraph has ReAct/Supervisor/Swarm, CrewAI has project templates) |
| **Dependencies** | F1 (templates are installed via `crewly init --template`) |
| **OKR** | O2-KR3 |

**What to build**:
Three pre-configured team templates:
1. **`startup-dev`** -- Orchestrator + Developer + QA. For small teams building software. Default roles, skills, and prompts pre-configured.
2. **`content-team`** -- PM + Writer + Designer. For content creation workflows.
3. **`solo-dev`** -- Single agent with all skills. For individual developers who want an AI coding partner.

Each template includes:
- Team config YAML with roles and member definitions
- Role-specific prompt templates
- Skill assignments per role
- Example task to run immediately after init

**Acceptance criteria**:
- [ ] `crewly init --template startup-dev` creates a working team
- [ ] Each template starts and agents begin working within 60 seconds
- [ ] Templates are discoverable via `crewly init` interactive prompt

---

### Theme B: Core Platform (Close Critical Gaps)

These are P0-P1 -- the features that make Crewly competitive.

---

#### F6: LLM Adapter Layer (Multi-Model Support)

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Complexity** | L (3-4 days) |
| **Owner** | Sam |
| **Closes Gap** | G6 (LLM adapter -- every competitor supports multiple models natively) |
| **Dependencies** | None -- can start in parallel with F1 |
| **OKR** | O2-KR1 |

**What to build**:
- Abstract `LLMProvider` interface: `chat(messages, options) -> Response`
- Implementations: `ClaudeProvider`, `OpenAIProvider`, `GeminiProvider`, `OllamaProvider`
- Config via `crewly.config.ts`:
  ```typescript
  export default {
    defaultModel: 'claude-sonnet-4-5-20250929',
    models: {
      orchestrator: 'claude-opus-4-6',
      developer: 'gpt-4o',
      qa: 'ollama/codellama',
    }
  }
  ```
- Per-agent model override in team config YAML
- Fallback chain: if primary model fails, try secondary
- Streaming support for all providers

**Why this matters**: Currently Crewly spawns CLI processes (claude, gemini, codex). This is our unique strength (runtime-agnostic). The adapter layer adds a SECOND mode: direct API calls for when CLI runtimes aren't available. Both modes coexist.

**Acceptance criteria**:
- [ ] At least 3 providers working (Claude, OpenAI, Ollama)
- [ ] Per-agent model selection works
- [ ] Config file documented with examples
- [ ] Existing CLI runtime mode still works (non-breaking)

**Risk**: Scope creep. Start with Claude + OpenAI + Ollama only. Add others later.

---

#### F7: MCP Client in Agents

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Complexity** | L (3 days) |
| **Owner** | Sam |
| **Closes Gap** | G9 (MCP protocol -- LangGraph has full MCP adapters, our MCP server is basic) |
| **Dependencies** | None -- uses `@modelcontextprotocol/sdk` |
| **OKR** | O2-KR1 |

**What to build**:
- Agents can connect to external MCP servers as tool sources
- MCP server configuration in `crewly.config.ts`:
  ```typescript
  mcpServers: {
    filesystem: { command: 'npx', args: ['-y', '@anthropic/mcp-filesystem'] },
    github: { command: 'npx', args: ['-y', '@anthropic/mcp-github'] },
  }
  ```
- Agent discovers tools from configured MCP servers at startup
- Tools are available alongside existing bash skills
- Dashboard shows which MCP tools each agent has access to

**Why this matters**: MCP is becoming the standard tool protocol. LangGraph already has full adapters. With MCP client support, Crewly agents get access to hundreds of community tools without us building each one.

**Acceptance criteria**:
- [ ] Agent can call a tool from an MCP filesystem server
- [ ] At least 3 MCP servers tested (filesystem, GitHub, database)
- [ ] MCP tools appear in agent's tool list on dashboard
- [ ] Error handling: graceful degradation if MCP server is unavailable

---

#### F8: Docker Deployment

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Complexity** | M (2 days) |
| **Owner** | Sam |
| **Closes Gap** | G7 (containerization -- AutoGen has Docker sandbox, LangGraph has Platform deployments) |
| **Dependencies** | F1 (Dockerfile should scaffold correctly after init) |
| **OKR** | O2-KR1 |

**What to build**:
- `Dockerfile` at repo root: multi-stage build (build TS -> runtime image)
- `docker-compose.yml`: single `docker compose up` starts backend + frontend + tmux
- Volume mounts for `.crewly/` config and project files
- Environment variable configuration for API keys
- Health check endpoint in compose

**Acceptance criteria**:
- [ ] `docker compose up` starts Crewly and dashboard is accessible
- [ ] Works on Linux and macOS (Intel + Apple Silicon)
- [ ] `.crewly/` directory persists between container restarts
- [ ] Can pass API keys via `.env` file

---

#### F9: Vector-Based Memory with Embeddings

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Complexity** | L (3-4 days) |
| **Owner** | Sam |
| **Closes Gap** | G3 (memory -- CrewAI has LanceDB + 11 embedders + composite scoring; LangGraph has checkpointing + Store API) |
| **Dependencies** | F6 (needs LLM adapter for embedding calls) |
| **OKR** | O2-KR1 |

**What to build**:
- Add embedding-based search to `KnowledgeSearchService` (currently keyword-only)
- Use `GeminiEmbeddingStrategy` (already stubbed in codebase) or OpenAI embeddings via adapter
- Store embeddings in a local vector store (options: LanceDB, Vectra, or SQLite with vector extension)
- Hybrid search: combine keyword score + embedding similarity with configurable weights
- Automatic re-embedding when memories are updated

**Why this matters**: Keyword search (`KnowledgeSearchService` with `KeywordSearchStrategy`) works for exact matches but fails for semantic queries like "how do we deploy?" when the doc says "deployment process." CrewAI's Unified Memory with composite scoring is the gold standard here.

**Acceptance criteria**:
- [ ] Semantic search returns relevant results for paraphrased queries
- [ ] Hybrid search (keyword + embedding) outperforms keyword-only on test set
- [ ] Works offline with Ollama embeddings (no API key required for local dev)
- [ ] Existing keyword search still works as fallback

---

#### F10: Quickstart Documentation Site

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Complexity** | M (2-3 days) |
| **Owner** | Mia (content) + Sam (setup/deploy) |
| **Closes Gap** | G5 (docs -- every competitor has a docs site) |
| **Dependencies** | F1, F5 (docs reference init and templates) |
| **OKR** | O2-KR3 |

**What to build**:
- Documentation site using VitePress (TypeScript ecosystem, fast, minimal config)
- Pages: Installation, Quickstart, Concepts (Teams, Agents, Skills, Memory), Configuration, CLI Reference, FAQ
- Hosted on GitHub Pages or existing crewly.stevesprompt.com subdomain
- Includes code examples that actually run

**Acceptance criteria**:
- [ ] Docs site is accessible via public URL
- [ ] Quickstart tutorial works end-to-end for a new user
- [ ] CLI commands are documented with examples
- [ ] Search works within docs

---

### Theme C: Moat Deepening (Crewly-Only Features)

These are P1-P2 -- invest in what makes Crewly unique.

---

#### F11: Crewly as MCP Server

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Complexity** | M (2 days) |
| **Owner** | Sam |
| **Closes Gap** | Unique advantage -- lets external tools (Claude Code, Cursor, etc.) manage Crewly teams |
| **Dependencies** | F7 (MCP client first, then server) |
| **OKR** | O2-KR1 |

**What to build**:
- Expose Crewly capabilities as MCP tools:
  - `crewly_create_team` -- Create a new team
  - `crewly_assign_task` -- Assign task to an agent
  - `crewly_get_status` -- Get team/agent status
  - `crewly_recall_memory` -- Search team memory
- External agents (Claude Code, Cursor) can then orchestrate Crewly teams via MCP
- Run as a separate process or integrated into backend

**Why this matters**: This makes Crewly a "team backend" that any AI tool can control. No competitor offers this. It's our moat deepened.

**Acceptance criteria**:
- [ ] Claude Code can connect to Crewly MCP server and list tools
- [ ] Can create a team and assign a task via MCP calls
- [ ] MCP server runs alongside main backend without conflicts

---

#### F12: Structured Task Output with Validation

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Complexity** | M (2 days) |
| **Owner** | Sam |
| **Closes Gap** | G8 partial (agent quality -- CrewAI has guardrails + structured output, LangGraph has pre/post hooks) |
| **Dependencies** | None |
| **OKR** | O2-KR1 |

**What to build**:
- Task definitions can include expected output schema (Zod or JSON Schema)
- After agent completes a task, validate output against schema
- If validation fails: auto-retry with error feedback (configurable retry limit, default 2)
- Schema examples: "PR must include title, description, files changed" or "test report must have pass/fail counts"

**Acceptance criteria**:
- [ ] Task config supports `outputSchema` field
- [ ] Invalid output triggers automatic retry with error message
- [ ] Valid output is stored and accessible via API
- [ ] Works with quality gates (validates before marking task done)

---

#### F13: Context Window Management

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Complexity** | M (2 days) |
| **Owner** | Sam |
| **Closes Gap** | Unique -- no competitor handles this automatically in a team context |
| **Dependencies** | F6 (needs LLM adapter for summarization calls) |
| **OKR** | O2-KR1 |

**What to build**:
- Monitor token usage per agent session
- When approaching 80% of context limit, auto-summarize conversation history
- Use a secondary (cheap) LLM call to produce summary
- Inject summary as compressed context, continue with fresh window
- Log summarization events in agent activity feed

**Acceptance criteria**:
- [ ] Agent doesn't crash when hitting context limits on long tasks
- [ ] Summarization preserves key facts and task state
- [ ] Dashboard shows context usage percentage per agent

---

#### F14: OpenTelemetry Tracing

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Complexity** | M (2 days) |
| **Owner** | Sam |
| **Closes Gap** | G10 (observability -- LangGraph has LangSmith, CrewAI has OpenTelemetry, AutoGen has OpenTelemetry) |
| **Dependencies** | None |
| **OKR** | O2-KR1 |

**What to build**:
- Instrument backend with `@opentelemetry/sdk-node`
- Trace spans for: agent task execution, tool calls, LLM requests, memory operations
- Export to any OTEL-compatible backend (Jaeger, Grafana, Datadog)
- Console exporter for local development
- Trace ID visible in dashboard activity feed

**Acceptance criteria**:
- [ ] Traces appear in Jaeger (or similar) when running locally
- [ ] Each agent task creates a root span with child spans for sub-operations
- [ ] LLM request duration and token counts visible in traces

---

## Phase 2: Marketing + Growth (After Core Ready)

> **Trigger**: 3+ differentiated core features shipped + end-to-end demo flow works
> **Team**: Mia + Sam + new Marketing/Creative member
> **Goal**: External developers can discover, try, and share Crewly

---

#### F15: Demo Video + Launch Content

| Field | Value |
|-------|-------|
| **Priority** | P0 (for Phase 2) |
| **Complexity** | M (2-3 days) |
| **Owner** | Marketing lead + Mia |
| **Closes Gap** | G2 (open-source readiness) |
| **Dependencies** | Phase 1 core features working |
| **OKR** | O3-KR2 |

**What to build**:
- 2-minute demo video: install -> init -> start -> watch agents work in dashboard -> task completed
- Written launch post for Hacker News / Product Hunt
- Social media assets (Twitter/X thread, LinkedIn post)
- Blog post: "Why We Built Crewly: The Team-First Agent Orchestrator"

---

#### F16: GitHub Public Release + CI

| Field | Value |
|-------|-------|
| **Priority** | P0 (for Phase 2) |
| **Complexity** | S (1 day) |
| **Owner** | Sam |
| **Closes Gap** | G2 (open-source readiness) |
| **Dependencies** | F2, F3, F4 (README, LICENSE, CONTRIBUTING must be done) |
| **OKR** | O3-KR3 |

**What to build**:
- Make repo public
- GitHub Actions CI: build, test, lint on PR
- Pin issues for good-first-issue tasks
- GitHub Releases with changelog
- npm publish automation

---

#### F17: Show HN + Product Hunt Launch

| Field | Value |
|-------|-------|
| **Priority** | P0 (for Phase 2) |
| **Complexity** | S (1 day) |
| **Owner** | Mia + Marketing lead |
| **Closes Gap** | G4 (community -- all competitors have public presence) |
| **Dependencies** | F15, F16 (video and public repo must be ready) |
| **OKR** | O3-KR3 |

**What to build**:
- HN "Show HN" post timed for Tuesday 9am PT
- Product Hunt listing with screenshots and video
- Prepared responses for common questions (vs CrewAI, vs LangGraph)

---

#### F18: Community Discord

| Field | Value |
|-------|-------|
| **Priority** | P1 (for Phase 2) |
| **Complexity** | S (0.5 day) |
| **Owner** | Marketing lead |
| **Closes Gap** | G4 (community channels) |
| **Dependencies** | F16 (launch timing) |
| **OKR** | O3-KR4 |

**What to build**:
- Discord server with channels: #general, #help, #showcase, #feature-requests, #contributing
- Welcome bot with quickstart link
- Link from README and docs

---

#### F19: Weekly Technical Blog

| Field | Value |
|-------|-------|
| **Priority** | P1 (for Phase 2) |
| **Complexity** | S (ongoing, 0.5 day/week) |
| **Owner** | Marketing lead |
| **Dependencies** | Phase 2 launched |
| **OKR** | O3-KR1 |

**Content calendar** (first 4 posts):
1. "Getting Started with Crewly: Your First AI Team in 5 Minutes"
2. "How Crewly's Terminal Streaming Works (and Why It Matters)"
3. "Connecting Crewly to Any Tool via MCP"
4. "Crewly vs CrewAI vs LangGraph: An Honest Comparison"

---

#### F20: Prebuilt Team Templates (Expanded)

| Field | Value |
|-------|-------|
| **Priority** | P1 (for Phase 2) |
| **Complexity** | S (1 day per template) |
| **Owner** | Mia + Marketing lead |
| **Closes Gap** | G13 (templates as onboarding hooks) |
| **Dependencies** | F5 (base template system) |
| **OKR** | O3-KR4 |

**Additional templates beyond F5**:
- **`research-team`** -- Researcher + Analyst + Writer. For market research, competitive analysis.
- **`support-team`** -- Triage Agent + Resolver + Documenter. For issue handling.
- **`data-pipeline`** -- Collector + Processor + Reporter. For recurring data tasks.

---

## Phase 3: Community + Support (With Users)

> **Trigger**: Public launch completed + external users exist
> **Team**: Mia + Sam + Marketing + 1-2 Community/Ops + Support
> **Goal**: Sustainable community with active contributors

---

#### F21: Skill SDK + `crewly create skill`

| Field | Value |
|-------|-------|
| **Priority** | P1 (for Phase 3) |
| **Complexity** | L (3 days) |
| **Owner** | Sam |
| **Closes Gap** | Ecosystem growth -- lets community extend Crewly |
| **Dependencies** | F7 (MCP understanding informs skill design) |
| **OKR** | O4-KR2 |

**What to build**:
- `crewly create skill <name>` scaffolds a new skill directory
- Skill template: `execute.sh`, `skill.json`, `instructions.md`, `README.md`
- Skill testing framework: `crewly test skill <name>` runs skill in isolated context
- Skill publishing: `crewly publish skill` submits to marketplace

---

#### F22: Marketplace Submissions Pipeline

| Field | Value |
|-------|-------|
| **Priority** | P2 (for Phase 3) |
| **Complexity** | M (2 days) |
| **Owner** | Sam |
| **Dependencies** | F21 (SDK) |
| **OKR** | O4-KR2 |

---

#### F23: A2A Protocol Support

| Field | Value |
|-------|-------|
| **Priority** | P2 (for Phase 3) |
| **Complexity** | XL (4+ days) |
| **Owner** | Sam |
| **Closes Gap** | G9 partial (protocol support -- CrewAI and AutoGen have A2A) |
| **Dependencies** | F7, F11 (MCP first) |
| **OKR** | O2-KR1 |

---

#### F24: Flow Engine (TS-based Workflows)

| Field | Value |
|-------|-------|
| **Priority** | P2 (for Phase 3) |
| **Complexity** | XL (4+ days) |
| **Owner** | Sam |
| **Closes Gap** | G12 (workflow definition -- LangGraph graphs, CrewAI Flows) |
| **Dependencies** | F12 (structured output for flow step validation) |
| **OKR** | O2-KR1 |

---

#### F25: FAQ + Troubleshooting Docs

| Field | Value |
|-------|-------|
| **Priority** | P1 (for Phase 3) |
| **Complexity** | S (ongoing) |
| **Owner** | Support lead + Mia |
| **Dependencies** | Real user questions |
| **OKR** | O5-KR2 |

---

#### F26: Agent Evaluation Framework (`crewly test`)

| Field | Value |
|-------|-------|
| **Priority** | P2 (for Phase 3) |
| **Complexity** | L (3 days) |
| **Owner** | Sam |
| **Closes Gap** | G8 (training/evaluation -- CrewAI has `crewai train/test`, LangGraph has LangSmith evals) |
| **Dependencies** | F12 (structured output for scoring) |
| **OKR** | O2-KR1 |

---

## Sam's Sprint Board (Phase 1 Build Order)

This is the ordered work queue. Pick the top unstarted item and build it.

```
 #  | ID  | Feature                          | Priority | Size | Depends On | Status
----|-----|----------------------------------|----------|------|------------|--------
 1  | F3  | LICENSE (MIT)                    | P0       | S    | --         | Not started
 2  | F1  | npx crewly init                  | P0       | M    | --         | Not started
 3  | F5  | Demo team templates (3)          | P0       | M    | F1         | Not started
 4  | F2  | README.md overhaul               | P0       | S    | F1         | Not started
 5  | F6  | LLM adapter layer                | P1       | L    | --         | Not started
 6  | F7  | MCP client in agents             | P1       | L    | --         | Not started
 7  | F8  | Docker deployment                | P1       | M    | F1         | Not started
 8  | F9  | Vector-based memory              | P1       | L    | F6         | Not started
 9  | F10 | Documentation site               | P1       | M    | F1, F5     | Not started
10  | F12 | Structured task output           | P2       | M    | --         | Not started
11  | F13 | Context window management        | P2       | M    | F6         | Not started
12  | F11 | Crewly as MCP server             | P2       | M    | F7         | Not started
13  | F14 | OpenTelemetry tracing            | P2       | M    | --         | Not started
```

### Daily Decision Tree

```
Is there a P0 item not yet started?
  Yes -> Work on it (F3 -> F1 -> F5 -> F2)
  No  -> Is there a P0 item in progress?
    Yes -> Finish it
    No  -> Pick the top unstarted P1 (F6 -> F7 -> F8 -> F9 -> F10)
      All P1 done? -> Pick top P2 (F12 -> F13 -> F11 -> F14)
```

### Parallelization Opportunities

Sam can parallelize when blocked:
- **F3 + F1** can start simultaneously (no dependency)
- **F6 + F7** can start simultaneously (independent subsystems)
- **F8** can start while F6/F7 are in progress (Docker is isolated work)

### Mia's Work Queue (Phase 1)

| # | Item | Depends On | Status |
|---|------|-----------|--------|
| 1 | F4: CONTRIBUTING.md | -- | Draft exists, needs finalization |
| 2 | F5: Template design (content for 3 templates) | -- | Not started |
| 3 | F10: Documentation content (guides, tutorials) | F1 | Not started |
| 4 | F2: README copy (non-code sections) | F1 | Not started |
| 5 | O1-KR3: Bi-weekly competitor update | -- | Ongoing |

---

## Effort Summary

### Phase 1 (Sam): ~25-30 developer-days

| Priority | Items | Est. Days |
|----------|-------|-----------|
| P0 | F1, F2, F3, F5 | ~6 days |
| P1 | F6, F7, F8, F9, F10 | ~14 days |
| P2 | F11, F12, F13, F14 | ~8 days |

### Phase 2 (Marketing lead + Mia + Sam): ~8-10 days
### Phase 3 (Full team): ~15-20 days

**Total roadmap**: ~50-60 developer-days across all phases

---

## Complexity Legend

| Size | Meaning | Typical Scope |
|------|---------|--------------|
| S | Small (0.5-1 day) | Single file, config change, documentation |
| M | Medium (2-3 days) | Multi-file feature, integration work |
| L | Large (3-4 days) | Cross-cutting feature, new subsystem |
| XL | Extra Large (4+ days) | Major architectural addition |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| F6 (LLM adapter) scope creep | High | High | Start with Claude + OpenAI + Ollama only. No other providers until these 3 are solid. |
| F7 (MCP client) SDK compatibility | Low | High | Use official `@modelcontextprotocol/sdk`. Test against 3 popular servers early. |
| F9 (vector memory) performance on large datasets | Medium | Medium | Start with LanceDB (lightweight). Benchmark with 10K+ memories. |
| F1 (init wizard) too many prompts | Medium | Low | Maximum 5 interactive prompts. Everything else has defaults. |
| Phase 2 launch timing | Medium | High | Don't launch until F1+F5+F6 are solid. A bad first impression is worse than a late launch. |

---

## Success Metrics

### Phase 1 Exit Criteria
- [ ] `npx crewly init` -> `crewly start` -> agents working in < 5 minutes
- [ ] 3 team templates available and working
- [ ] 3+ LLM providers supported (Claude, OpenAI, Ollama)
- [ ] MCP client connects to 3+ external tool servers
- [ ] Docker compose works on Linux + macOS
- [ ] Documentation site accessible and useful

### Phase 2 Exit Criteria
- [ ] HN/Product Hunt launch completed
- [ ] GitHub repo has 200+ stars
- [ ] 50+ Discord members
- [ ] 100+ npm weekly downloads

### Phase 3 Exit Criteria
- [ ] 10+ external contributors
- [ ] 5+ community-submitted skills
- [ ] 24h issue response time
- [ ] Active Discord community

---

## Gap Coverage Summary

| Gap ID | Gap | Roadmap Item | Phase |
|--------|-----|-------------|-------|
| G1 | Onboarding (`npx crewly init`) | F1 | 1 |
| G2 | Open-source readiness | F2, F3, F4, F15, F16 | 1+2 |
| G3 | Vector-based memory | F9 | 1 |
| G4 | Community channels | F18 | 2 |
| G5 | Documentation site | F10 | 1 |
| G6 | LLM adapter layer | F6 | 1 |
| G7 | Docker deployment | F8 | 1 |
| G8 | Agent training/evaluation | F26 | 3 |
| G9 | MCP protocol completion | F7, F11 | 1 |
| G10 | Observability/tracing | F14 | 1 |
| G11 | Visual workflow builder | Deferred (post-Phase 3) | -- |
| G12 | Graph-based workflows | F24 | 3 |
| G13 | Prebuilt templates | F5, F20 | 1+2 |
| G14 | Python SDK | Deferred (not strategic) | -- |
| G15 | Checkpoint/durable execution | Deferred (post-Phase 3) | -- |

**Explicitly deferred**:
- **G11 (Visual workflow builder)**: Very high effort, low ROI at current scale. Reconsider after 500+ users.
- **G14 (Python SDK)**: Crewly's TypeScript identity is a differentiator in the Python-dominated space. Don't dilute it.
- **G15 (Checkpoint/durable execution)**: Important for enterprise but premature before we have users. Build when demand exists.

---

*Document Version: 3.0 | Last Updated: 2026-02-21 | Author: Mia (Product Manager, crewly-core-mia-member-1)*
*Derived from: competitive-gap-matrix.md (v3.0, O1-KR1) + roadmap-v2.md*
*Next Review: When Phase 1 first 4 P0 items are complete, or in 1 week, whichever comes first*
