# Crewly Prioritized Roadmap v1

> **OKR**: Phase 1, O1-KR2 | **Author**: Mia (Product Manager) | **Date**: 2026-02-24 | **Version**: 1.0
> **Input**: `mia-gap-matrix.md` (O1-KR1) | **Cadence**: 2-week sprints

---

## Strategic Goal

**Close the top adoption-blocking gaps in 6 weeks, then widen the moat for 8 more weeks.**

Crewly's unique value (live terminal streaming, runtime-agnostic orchestration, team dashboard) is already built. The bottleneck is **not features — it's adoptability**. Users can't find us, can't onboard easily, and can't get help. Fix that first.

---

## Sprint Plan (2-Week Execution Cycles)

### Sprint 1 (Weeks 1-2): "Make It Adoptable"

**Theme**: Remove all barriers to a developer's first successful experience.

| ID | Task | Gap | Owner | Effort | KR | Confidence |
|----|------|-----|-------|--------|-----|------------|
| R1.1 | `npx crewly init` interactive wizard — detect tools, pick template, create team, start dashboard | G1 | Sam | 5d | O2-KR1 | HIGH |
| R1.2 | Open-source prep: add MIT LICENSE, CONTRIBUTING.md, clean README with badges/GIF, GitHub Release v1.0 | G2 | Sam | 2d | O2-KR3 | HIGH |
| R1.3 | Create Discord server with channels (#general, #help, #showcase, #dev) + invite link in README | G4 | Mia | 1d | O1-KR3 | HIGH |
| R1.4 | 3 prebuilt team templates: `dev-team` (2 devs + PM), `qa-team` (tester + dev), `content-team` (writer + editor) | G13 | Sam | 3d | O2-KR1 | HIGH |
| R1.5 | Fix onboarding bugs: wrong Gemini package name, template doesn't create team, missing tmux check | Bugs | Sam | 1d | O2-KR1 | HIGH |

**Sprint 1 Success Criteria**:
- [ ] `npx crewly init` works end-to-end on clean macOS + Linux
- [ ] GitHub repo has LICENSE, CONTRIBUTING, clean README with install instructions
- [ ] Discord server live with invite link
- [ ] 3 templates selectable during `crewly init`
- [ ] All known onboarding bugs fixed

**Risks**:
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `npx crewly init` scope creep | MEDIUM | Delays Sprint 1 | Scope to: detect tools + pick template + create team. No custom config in v1. |
| README/docs quality insufficient | LOW | Poor first impression | Review cycle: Sam drafts, Mia reviews |

---

### Sprint 2 (Weeks 3-4): "Close Core Gaps"

**Theme**: Add the features developers expect from a modern agent framework.

| ID | Task | Gap | Owner | Effort | KR | Confidence |
|----|------|-----|-------|--------|-----|------------|
| R2.1 | LLM adapter layer: unified interface for Claude/Gemini/Codex/OpenAI/Ollama with provider config | G6 | Sam | 5d | O2-KR1 | MEDIUM |
| R2.2 | Vector memory: add embedding-based recall using LanceDB or ChromaDB, keep keyword as fallback | G5 | Sam | 5d | O2-KR1 | MEDIUM |
| R2.3 | MCP protocol completion: full tool registration, resource handling, prompt serving per MCP spec | G7 | Sam | 4d | O2-KR1 | MEDIUM |
| R2.4 | Documentation site v1: Docusaurus/VitePress with getting-started, concepts, API reference, deploy to GitHub Pages | G3 | Mia+Sam | 3d | O2-KR3 | MEDIUM |

**Sprint 2 Success Criteria**:
- [ ] `crewly init` offers model provider selection (Claude/Gemini/OpenAI/Ollama)
- [ ] `recall` returns semantically relevant results (not just keyword matches)
- [ ] MCP server passes protocol conformance for tools + resources
- [ ] docs.crewly.dev live with getting-started guide

**Risks**:
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LLM adapter complexity (different auth, streaming, tool-calling APIs) | HIGH | Scope bloat | Start with Claude + OpenAI only. Add others in Sprint 3. |
| Embedding model costs for memory | LOW | Budget impact | Use local embeddings (all-MiniLM-L6-v2) first, cloud optional |
| MCP spec ambiguity | MEDIUM | Integration issues | Reference LangGraph's MCP adapter implementation |

**Sources for implementation**:
- MCP spec: https://spec.modelcontextprotocol.io/
- LanceDB: https://lancedb.github.io/lancedb/
- Docusaurus: https://docusaurus.io/
- VitePress: https://vitepress.dev/

---

### Sprint 3 (Weeks 5-6): "Production Ready"

**Theme**: Make Crewly deployable and observable for real teams.

| ID | Task | Gap | Owner | Effort | KR | Confidence |
|----|------|-----|-------|--------|-----|------------|
| R3.1 | Docker deployment: Dockerfile + docker-compose for Crewly server + agents, `crewly init --docker` flag | G8 | Sam | 4d | O2-KR1 | MEDIUM |
| R3.2 | OpenTelemetry tracing: instrument agent sessions, tool calls, LLM requests with spans + traces | G9 | Sam | 5d | O2-KR1 | LOW |
| R3.3 | Demo video (2 min): install → dashboard → agents working → quality gates → Slack notification | — | Mia | 3d | O2-KR3 | HIGH |
| R3.4 | Additional LLM adapters: Gemini, Ollama, Anthropic API (beyond Claude CLI) | G6 | Sam | 3d | O2-KR1 | MEDIUM |

**Sprint 3 Success Criteria**:
- [ ] `docker-compose up` starts full Crewly stack
- [ ] OpenTelemetry traces visible in Jaeger/Zipkin
- [ ] Demo video published on YouTube + embedded in docs
- [ ] 4+ LLM providers supported via adapter layer

**Risks**:
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| tmux in Docker complexity | HIGH | Agents can't spawn terminals | Use tmux inside container. Test early. Fallback: process-based sessions. |
| OTel instrumentation scope | MEDIUM | Takes longer than estimated | Start with agent lifecycle spans only. Add LLM-level later. |

---

### Sprint 4 (Weeks 7-8): "Widen the Moat"

**Theme**: Build features competitors don't have, deepen existing advantages.

| ID | Task | Gap | Owner | Effort | KR | Confidence |
|----|------|-----|-------|--------|-----|------------|
| R4.1 | Agent evaluation framework: define test scenarios, run agents, score outputs, track improvement | G10 | Sam | 5d | O2-KR1 | LOW |
| R4.2 | Checkpoint/state persistence: save agent state to disk/DB, resume after crash | G11 | Sam | 5d | O2-KR1 | LOW |
| R4.3 | Dashboard v2: agent performance graphs, cost trends, task velocity charts | — | Sam | 4d | O2-KR1 | MEDIUM |
| R4.4 | Skill SDK: `crewly create-skill` CLI, skill testing harness, publish to marketplace | — | Sam | 3d | O2-KR1 | MEDIUM |

**Sprint 4 Success Criteria**:
- [ ] `crewly test` runs evaluation suite against agent team
- [ ] Agent state survives process restart
- [ ] Dashboard shows performance metrics over time
- [ ] Developers can create + test custom skills via CLI

---

## KR Mapping

| KR | Deliverables | Sprint |
|----|-------------|--------|
| **O1-KR1**: Gap matrix complete | `mia-gap-matrix.md` (this sprint) | Done |
| **O1-KR2**: Prioritized roadmap | `mia-roadmap-v1.md` (this document) | Done |
| **O1-KR3**: Bi-weekly competitive updates | Discord channel + recurring review | Sprint 1+ |
| **O2-KR1**: Daily feature delivery per roadmap | R1.1-R4.4 (Sam executes) | Sprints 1-4 |
| **O2-KR2**: Code quality (tests 80%+, TS strict) | All PRs must pass quality gates | Ongoing |
| **O2-KR3**: Open-source release prep | R1.2, R2.4, R3.3 | Sprints 1-3 |

---

## Confidence Levels by Sprint

| Sprint | Overall Confidence | Rationale |
|--------|-------------------|-----------|
| Sprint 1 | **HIGH** (90%) | Well-scoped, fixes known bugs, no new architecture. Biggest risk is `npx crewly init` scope. |
| Sprint 2 | **MEDIUM** (65%) | LLM adapter + vector memory are significant new subsystems. MCP spec compliance uncertain. |
| Sprint 3 | **MEDIUM** (60%) | Docker + tmux is an unknown. OTel instrumentation scope could expand. |
| Sprint 4 | **LOW** (40%) | Agent eval + checkpointing are research-heavy. Scope will likely shift based on Sprint 1-3 learnings. |

---

## Immediate Next Tasks for Sam (Priority Order)

These are the first things Sam should pick up, ordered by impact:

### 1. Fix onboarding bugs (R1.5) — Day 1
- Fix Gemini CLI package name: `@anthropic-ai/gemini-cli` → `@google/gemini-cli` at `cli/src/commands/onboard.ts:199,203`
- Fix template selection: must actually create team after user picks template
- Add tmux detection during onboard (required for agent sessions)
- **Files**: `cli/src/commands/onboard.ts`

### 2. `npx crewly init` wizard (R1.1) — Days 1-5
- Interactive CLI: detect installed tools (Claude CLI, Gemini CLI, tmux, Node.js version)
- Prompt user to select team template (dev-team, qa-team, content-team)
- Auto-create team config + project structure
- Start dashboard after setup
- **Files**: New `cli/src/commands/init.ts`, modify `cli/src/index.ts`

### 3. Open-source readiness (R1.2) — Days 5-6
- Add MIT LICENSE file to repo root
- Write CONTRIBUTING.md (dev setup, PR process, code standards from CLAUDE.md)
- Rewrite README.md: hero section with GIF, quick install, feature highlights, architecture diagram
- Create GitHub Release v1.0.0 with changelog
- **Files**: `/LICENSE`, `/CONTRIBUTING.md`, `/README.md`

### 4. 3 team templates (R1.4) — Days 7-9
- Create template configs at `config/templates/{dev-team,qa-team,content-team}/`
- Each template: team.json (roles + member configs), prompt files, skill selections
- Wire into `crewly init` template selection
- **Files**: New `config/templates/` directory

### 5. LLM adapter layer (R2.1) — Days 10-14 (Sprint 2 start)
- Abstract interface: `ILLMAdapter { send(prompt, options): AsyncIterable<string> }`
- Implementations: ClaudeCliAdapter, GeminiCliAdapter, OpenAiApiAdapter
- Provider config in team settings
- **Files**: New `backend/src/services/llm/` directory

---

## Budget & Resource Assumptions

| Resource | Allocation | Notes |
|----------|-----------|-------|
| Sam (Dev) | Full-time | Primary implementer for all R-items |
| Mia (PM) | Part-time | Discord setup, docs content, demo video, competitive monitoring |
| Steve | 5 hrs/week | Approvals, design decisions, demo recording |
| Infra cost | $0 (Phase 1) | All local/self-hosted. Docker on existing DO infra. |
| LLM costs | ~$1.80/session (Sonnet) | Per business-model-v2.md |

---

## Review Cadence

- **Daily**: Sam reports progress via `report-status` skill
- **Weekly**: Mia reviews sprint progress, updates roadmap if needed
- **Bi-weekly**: Competitive landscape update (O1-KR3), roadmap iteration
- **Sprint boundary**: Demo + retrospective, re-prioritize based on learnings

---

## Appendix: Gap-to-Sprint Traceability

| Gap ID | Gap Description | Sprint | Task IDs |
|--------|----------------|--------|----------|
| G1 | `npx crewly init` | Sprint 1 | R1.1 |
| G2 | Open-source readiness | Sprint 1 | R1.2 |
| G3 | Documentation site | Sprint 2 | R2.4 |
| G4 | Community Discord | Sprint 1 | R1.3 |
| G5 | Vector memory | Sprint 2 | R2.2 |
| G6 | LLM adapter layer | Sprint 2+3 | R2.1, R3.4 |
| G7 | MCP protocol completion | Sprint 2 | R2.3 |
| G8 | Docker deployment | Sprint 3 | R3.1 |
| G9 | Observability/tracing | Sprint 3 | R3.2 |
| G10 | Agent training/eval | Sprint 4 | R4.1 |
| G11 | Checkpoint/durable execution | Sprint 4 | R4.2 |
| G13 | Prebuilt templates | Sprint 1 | R1.4 |

---

*This roadmap will be updated bi-weekly per O1-KR3. Next update: 2026-03-10.*
*Companion document: `mia-gap-matrix.md` (feature comparison + gap analysis)*
