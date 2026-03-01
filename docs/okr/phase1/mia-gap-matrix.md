# Crewly vs Competitors: Feature Gap Matrix

> **OKR**: Phase 1, O1-KR1 | **Author**: Mia (Product Manager) | **Date**: 2026-02-24 | **Version**: 1.0

## Executive Summary

Crewly competes in the multi-agent orchestration space against four primary frameworks. This matrix maps feature-by-feature gaps, scores priorities, and feeds directly into the Phase 1 roadmap.

**Crewly's moat**: Live terminal streaming + runtime-agnostic CLI orchestration + team dashboard + budget tracking + Slack integration. No competitor has this combination.

**Critical gaps to close**: Developer onboarding (`npx crewly init`), open-source readiness, vector memory, documentation site, community channels.

---

## 1. Competitor Overview

| Framework | Stars | Language | Model | License | Latest Version |
|-----------|-------|----------|-------|---------|----------------|
| **Crewly** | ~61 | TypeScript | Hub-and-spoke orchestrator + agents | ISC | 1.0.11 |
| **OpenClaw** | ~200K+ | TypeScript/MD | Single-agent, skill-based | Apache 2.0 | — |
| **CrewAI** | ~44.4K | Python | Role-based Crews | MIT | v1.9.0 (Jan 2026) |
| **AutoGen** | ~54.6K | Python/.NET | Actor model, group chat | MIT | v0.4 (maintenance mode) |
| **LangGraph** | ~24.9K | Python/TS | Directed graph state machines | MIT | v1.0.9 (Feb 2026) |

**Sources**:
- CrewAI GitHub: https://github.com/crewAIInc/crewAI
- AutoGen GitHub: https://github.com/microsoft/autogen
- LangGraph GitHub: https://github.com/langchain-ai/langgraph
- LangGraph.js: https://github.com/langchain-ai/langgraphjs

---

## 2. Feature-by-Feature Comparison

### 2.1 Core Architecture

| Feature | Crewly | OpenClaw | CrewAI | AutoGen | LangGraph | Confidence |
|---------|--------|----------|--------|---------|-----------|------------|
| Multi-agent orchestration | YES | NO | YES | YES | YES | HIGH |
| Runtime-agnostic (Claude/Gemini/Codex) | YES | Partial (any LLM API) | YES (any LLM) | YES (OpenAI/Azure/Ollama) | YES (via LangChain) | HIGH |
| PTY terminal sessions (tmux) | YES | NO | NO | NO | NO | HIGH |
| Event-driven pub/sub | YES | NO | YES (v1.9) | YES (CloudEvents/gRPC) | YES (state events) | HIGH |
| Protocol support (MCP/A2A) | MCP (basic) | NO | A2A (v1.8+) | A2A, gRPC | MCP adapters | HIGH |
| Sandboxed execution | tmux isolation | NO (security issue) | NO | Docker containers | NO | HIGH |
| Distributed runtime | NO | NO | NO | YES (gRPC) | YES (Platform) | HIGH |

### 2.2 Agent Capabilities

| Feature | Crewly | OpenClaw | CrewAI | AutoGen | LangGraph | Confidence |
|---------|--------|----------|--------|---------|-----------|------------|
| Tool/skill system | 24+ agent, 17+ orc skills | 3000+ ClawHub skills | Python tools + CrewAI Tools | Python async functions | Python/TS + MCP | HIGH |
| Memory system | Dual-layer, keyword search | Markdown files | LanceDB + 11 embedding providers | ListMemory + Mem0/Zep | Checkpointing + Store API | HIGH |
| Knowledge base (RAG) | YAML/MD docs, keyword/embedding search | Skills-as-knowledge | ChromaDB RAG, PDF/web/YouTube | NO built-in | Via LangChain integrations | HIGH |
| Human-in-the-loop | Dashboard terminal input | CLI interaction | HITL for Flows (v1.8+) | Max-turn pause | First-class `interrupt()` | HIGH |
| Budget/cost tracking | YES (per-agent/project) | NO | NO | NO | LangSmith traces | HIGH |
| Quality gates | YES (build/test/lint/typecheck) | NO | Built-in guardrails | NO | Pre/post model hooks | HIGH |
| Agent training/eval | NO | NO | `crewai train`/`crewai test` | NO | LangSmith evaluations | HIGH |
| Auto-continuation | YES (state analysis + retry) | NO | NO | NO | Durable execution | HIGH |

### 2.3 Developer Experience

| Feature | Crewly | OpenClaw | CrewAI | AutoGen | LangGraph | Confidence |
|---------|--------|----------|--------|---------|-----------|------------|
| CLI onboarding | `crewly onboard` (buggy) | Download + configure | `crewai create crew` | pip install (confusing) | `create-react-agent` ~10 LOC | HIGH |
| `npx/init` quick start | NO | NO | YES (`crewai create`) | NO | YES (prebuilt agents) | HIGH |
| Visual UI | Real-time dashboard (React) | Terminal only | CrewAI Studio | AutoGen Studio | LangGraph Studio v2 | HIGH |
| Live terminal streaming | YES (xterm.js/WebSocket) | NO | NO | NO | NO | HIGH |
| Debugging | Live terminal + activity feed | Print debugging | Traces/logs | Studio real-time view | LangSmith + Studio time-travel | HIGH |
| Documentation site | NO (README + specs/) | YES | YES (docs.crewai.com) | YES | YES (extensive) | HIGH |
| Deploy story | `npm install -g crewly` | Local only | `crewai deploy` to AMP | Docker + self-host | Platform (Cloud/Hybrid/Self) | HIGH |
| Docker support | NO | NO | NO | YES (sandbox) | YES (Platform) | HIGH |

**Sources**:
- CrewAI docs: https://docs.crewai.com
- LangGraph docs: https://langchain-ai.github.io/langgraph/
- AutoGen docs: https://microsoft.github.io/autogen/

### 2.4 Team & Project Management (Crewly Differentiator)

| Feature | Crewly | OpenClaw | CrewAI | AutoGen | LangGraph |
|---------|--------|----------|--------|---------|-----------|
| Team dashboard | YES (full web UI) | NO | Studio (workflow view) | Studio (drag-drop) | Studio (graph view) |
| Live terminal streaming | YES | NO | NO | NO | NO |
| Interactive terminal input | YES | NO | NO | NO | NO |
| Task management (Kanban) | YES (YAML tickets) | NO | Task delegation in Crews | NO | NO |
| Auto-assignment by role/load | YES | NO | Within-Crew allocation | SelectorGroupChat | Graph-defined |
| Agent status monitoring | YES (real-time heartbeat) | NO | NO | NO | Via LangSmith |
| Slack integration (two-way) | YES (Bolt SDK) | NO | NO | NO | NO |
| Scheduled check-ins | YES | NO | NO | NO | NO |
| Self-improvement | YES (orc modifies codebase) | NO | NO | NO | NO |

### 2.5 Community & Ecosystem

| Metric | Crewly | OpenClaw | CrewAI | AutoGen | LangGraph |
|--------|--------|----------|--------|---------|-----------|
| GitHub stars | ~61 | ~200K+ | ~44.4K | ~54.6K | ~24.9K |
| Contributors | 2 | Hundreds | — | 559 | 286 |
| Community | None | Active | Forum | Split (AG2 21.4K / MS 5.3K) | LangChain community |
| Marketplace | Early | ClawHub 3000+ | Tools ecosystem | Extensions API | LangChain integrations |
| Enterprise customers | None public | Viral individual | Enterprise (unnamed) | Microsoft ecosystem | ~400 (Uber, LinkedIn, Klarna) |
| Funding | Self-funded | Open source | VC-funded | Microsoft Research | $260M ($1.25B valuation) |

---

## 3. Gap Analysis with Priority Scoring

Scoring: **Impact** (1-5) x **Urgency** (1-5) = **Priority Score** (max 25)

### P0 — CRITICAL (Score 20-25, must close to compete)

| ID | Gap | Impact | Urgency | Score | Competitors Have It | Effort |
|----|-----|--------|---------|-------|---------------------|--------|
| G1 | `npx crewly init` onboarding wizard | 5 | 5 | 25 | CrewAI, LangGraph | M (1-2 weeks) |
| G2 | Open-source readiness (LICENSE, CONTRIBUTING, README, Releases) | 5 | 5 | 25 | All competitors | M (1 week) |
| G3 | Published documentation site | 5 | 4 | 20 | CrewAI, AutoGen, LangGraph | H (2-3 weeks) |
| G4 | Community Discord + contributor guide | 4 | 5 | 20 | All competitors | L (2-3 days) |

### P1 — HIGH (Score 15-19, significant competitive disadvantage)

| ID | Gap | Impact | Urgency | Score | Competitors Have It | Effort |
|----|-----|--------|---------|-------|---------------------|--------|
| G5 | Vector-based memory with embeddings | 4 | 4 | 16 | CrewAI (LanceDB), LangGraph (Store) | H (2-3 weeks) |
| G6 | LLM adapter layer (unified model API) | 4 | 4 | 16 | CrewAI, AutoGen, LangGraph | H (2 weeks) |
| G7 | Full MCP protocol implementation | 4 | 4 | 16 | LangGraph (MCP adapters) | M (1-2 weeks) |
| G8 | Docker deployment support | 3 | 4 | 12 | AutoGen, LangGraph | M (1 week) |
| G9 | Observability/tracing (OpenTelemetry) | 3 | 3 | 9 | LangGraph (LangSmith), CrewAI (OTel) | H (2 weeks) |

### P2 — MEDIUM (Score 6-14, nice-to-have for differentiation)

| ID | Gap | Impact | Urgency | Score | Competitors Have It | Effort |
|----|-----|--------|---------|-------|---------------------|--------|
| G10 | Agent training/evaluation framework | 3 | 3 | 9 | CrewAI, LangGraph | H (3 weeks) |
| G11 | Checkpoint/durable execution | 3 | 2 | 6 | LangGraph (Postgres/Redis) | H (3 weeks) |
| G12 | Visual workflow builder | 2 | 2 | 4 | CrewAI Studio, LangGraph Studio | VH (6+ weeks) |
| G13 | Prebuilt team templates (dev/QA/content) | 3 | 3 | 9 | LangGraph (ReAct/Supervisor), CrewAI | M (1 week) |
| G14 | Python SDK | 2 | 1 | 2 | CrewAI, AutoGen, LangGraph | VH (months) |

---

## 4. Crewly's Competitive Advantages (Moat)

| ID | Advantage | Unique To Crewly | Defensibility |
|----|-----------|-------------------|---------------|
| A1 | Live terminal streaming (xterm.js/WebSocket) | YES | HIGH — deep PTY integration |
| A2 | Runtime-agnostic CLI orchestration (Claude/Gemini/Codex) | YES | MEDIUM — competitors could add |
| A3 | Persistent PTY sessions (survive browser disconnect) | YES | HIGH — architectural advantage |
| A4 | Interactive terminal input to live agents | YES | HIGH |
| A5 | Built-in per-agent/project budget tracking | YES | MEDIUM |
| A6 | Two-way Slack bridge (Bolt SDK) | YES | MEDIUM |
| A7 | Orchestrator self-improvement (modifies own codebase) | YES | HIGH — unique paradigm |
| A8 | Quality gates system (build/test/lint/typecheck) | YES | MEDIUM |
| A9 | Auto-continuation with state analysis | YES | MEDIUM |
| A10 | Integrated task management (Kanban + YAML) | YES | MEDIUM |

---

## 5. Threat Assessment

| Competitor | Threat | Rationale | Watch Items |
|-----------|--------|-----------|-------------|
| **LangGraph** | HIGH | Most complete platform, $1.25B backing, ~400 enterprise customers, massive PyPI downloads (~30M/mo). Graph paradigm is complex but powerful. | LangGraph Platform pricing, JS feature parity |
| **CrewAI** | HIGH | Closest multi-agent competitor. Great DX, enterprise traction, A2A protocol. No terminal streaming or budget tracking. | CrewAI Enterprise features, A2A adoption |
| **OpenClaw** | MEDIUM | Massive mindshare (200K+ stars) but single-agent. Security crisis (CVE-2026-25253, malicious skills) undermines enterprise trust. Skills marketplace validates our approach. | Security fixes, potential multi-agent pivot |
| **AutoGen** | LOW | Entering maintenance mode → Microsoft Agent Framework. Community split. | MS Agent Framework GA timeline |

**Sources**:
- LangChain funding: https://blog.langchain.dev/
- CrewAI Signal conference: https://www.crewai.com/
- OpenClaw security: CrowdStrike + Trend Micro reports (Dec 2025 - Jan 2026)
- AutoGen → MS Agent Framework: https://github.com/microsoft/autogen/discussions

---

## 6. Key Industry Trends (Feb 2026)

1. **Consolidation**: AutoGen → MS Agent Framework. LangChain → LangGraph Platform. CrewAI expanding OSS → enterprise.
2. **Protocol wars**: A2A (Google/CrewAI) vs MCP (Anthropic/LangGraph). Both gaining adoption. Crewly has basic MCP, needs deeper integration.
3. **Security backlash**: OpenClaw's 40K exposed instances + malicious skills making enterprise buyers cautious. Opportunity for security-conscious positioning.
4. **Enterprise monetization**: LangGraph $39/seat, CrewAI $25/mo. No competitor charges for CLI team orchestration — underexplored niche.
5. **"Prototype fast, ship reliably"**: Gap between easy-to-start (CrewAI) and production-ready (LangGraph). Crewly can bridge this.

---

## 7. Recommendations for Roadmap

### Immediate (Weeks 1-2): Make It Adoptable
- G1: `npx crewly init` — blocks all user growth
- G2: Open-source readiness — can't grow without LICENSE/README/CONTRIBUTING
- G4: Discord — users need a place to get help
- G13: 3 prebuilt team templates — reduce time-to-value

### Short-term (Weeks 3-6): Close Biggest Gaps
- G6: LLM adapter layer — remove runtime coupling
- G5: Vector memory — keyword search can't compete with semantic
- G7: MCP protocol completion — access the tool ecosystem
- G3: Documentation site — sustained growth driver

### Medium-term (Weeks 7-14): Widen the Moat
- G8: Docker deployment — enterprise requirement
- G9: OpenTelemetry — debugging at scale
- G10: Agent training/eval — systematic improvement
- G11: Durable execution — production reliability

**See companion document**: `mia-roadmap-v1.md` for full 2-week sprint sequencing.

---

*KR Mapping: This deliverable satisfies O1-KR1 (Complete Crewly vs OpenClaw/CrewAI/AutoGen feature gap matrix)*
