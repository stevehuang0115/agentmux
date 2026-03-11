# Crewly vs Competitors: Feature Gap Matrix

> **OKR**: Phase 1, O1-KR1 | **Author**: Mia (Product Manager) | **Date**: 2026-03-07 | **Version**: 1.1 (Updated for Sprint 2)

## Executive Summary

Crewly has pivoted from a general-purpose "AI Agent Framework" to an **"AI Team as a Service" (Management Console)** targeting SMBs (Education, Insurance, Content Agency). This version reflects the completion of P0 infrastructure (LICENSE, README, basic onboarding) and the emergence of our technical moat: **Hierarchical Architecture**.

**Crewly's moat**: Live terminal streaming + Hierarchical Orchestration (6-Phase) + Runtime-agnostic CLI coordination + SMB-specific Team Templates + Two-way Slack bridge.

**Critical gaps remaining**: High-reliability onboarding (buggy `onboard.ts`), Vector Memory (semantic search), Unified LLM API adapter.

---

## 1. Competitor Overview

| Framework | Stars | Language | Model | License | Latest Version |
|-----------|-------|----------|-------|---------|----------------|
| **Crewly** | ~85 | TypeScript | Hub-and-spoke + Hierarchy | MIT | 1.2.3 |
| **OpenClaw** | ~248K+ | TypeScript/MD | Single-agent, skill-based | Apache 2.0 | v2026.3.7 (Mar 2026) |
| **CrewAI** | ~48.2K | Python | Role-based Crews | MIT | v1.10.1 (Mar 2026) |
| **MAF (MS Agent Framework)** | ~58.1K | Python/.NET | Official AutoGen successor | MIT | v1.0.0 RC (Feb 2026) |
| **LangGraph** | ~28.5K | Python/TS | Directed graph state machines | MIT | v1.1.2 (Mar 2026) |

**Key Competitor Shifts (Mar 2026)**:
- **OpenClaw**: v2026.3.7 released. **ContextEngine** provides plug-and-play memory strategies. Surpassed Linux stars. Founder Peter Steinberger joined OpenAI.
- **LangGraph**: Now at v1.1. Durable execution (checkpointing) is GA with Postgres/Redis backends.
- **CrewAI**: Removed LangChain dependency entirely. Launched "CrewAI Studio". Native A2A protocol support.
- **MAF**: Microsoft's unified successor to AutoGen. Deep Azure and Windows Copilot integration.

---

## 2. Feature-by-Feature Comparison

### 2.1 Core Architecture

| Feature | Crewly | OpenClaw | CrewAI | MAF | LangGraph | Confidence |
|---------|--------|----------|--------|---------|-----------|------------|
| Multi-agent orchestration | YES | NO | YES | YES | YES | HIGH |
| Hierarchical Orchestration | **YES (6-Phase)** | NO | Partial | YES | YES (Graph) | HIGH |
| Runtime-agnostic | YES | Partial | YES | Partial (Azure-first) | YES | HIGH |
| PTY terminal sessions | **YES** | NO | NO | NO | NO | HIGH |
| Protocol support | MCP (Advanced) | NO | A2A (v1.10) | A2A, gRPC | MCP adapters | HIGH |
| Sandboxed execution | tmux isolation | NO | NO | Docker | NO | HIGH |

### 2.2 Agent Capabilities

| Feature | Crewly | OpenClaw | CrewAI | MAF | LangGraph | Confidence |
|---------|--------|----------|--------|---------|-----------|------------|
| Memory system | Dual-layer | ContextEngine | LanceDB | Mem0 | Store API | HIGH |
| Vector Memory | **NO** | YES | YES | YES | YES | HIGH |
| Human-in-the-loop | Dashboard Terminal | CLI | Studio HITL | Pause/Resume | `interrupt()` | HIGH |
| Budget/cost tracking | YES | NO | NO | YES | LangSmith | HIGH |
| Quality gates | **YES** | NO | Built-in | NO | Pre/post hooks | HIGH |
| Auto-continuation | **YES** | NO | NO | NO | Durable Execution | HIGH |

### 2.3 Developer Experience

| Feature | Crewly | OpenClaw | CrewAI | MAF | LangGraph | Confidence |
|---------|--------|----------|--------|---------|-----------|------------|
| CLI onboarding | `crewly onboard` | Download | `crewai create` | pip install | `create-react-agent` | HIGH |
| `npx/init` quick start | **PARTIAL** | NO | YES | NO | YES | HIGH |
| Visual UI | Real-time Dashboard | Terminal | Studio | Studio | Studio v2 | HIGH |
| Live terminal streaming | **YES** | NO | NO | NO | NO | HIGH |
| Documentation site | NO (in-repo) | YES | YES | YES | YES | HIGH |
| Prebuilt templates | **YES (10+)** | ClawHub | YES | NO | YES | HIGH |

---

## 3. Gap Analysis with Priority Scoring (Revised)

### P0 — CRITICAL (Ship blockers for Phase 2)

| ID | Gap | Impact | Urgency | Score | Status | Effort |
|----|-----|--------|---------|-------|--------|--------|
| G1 | Reliable `onboard` wizard | 5 | 5 | 25 | **DONE** (Aliased to `init`) | — |
| G2 | Open-source readiness | 5 | 5 | 25 | **DONE** | — |
| G3 | Professional Landing Page | 5 | 5 | 25 | **IN PROGRESS** (v2 minimal) | M (1 week) |
| G4 | SteamFun Pilot Delivery | 5 | 5 | 25 | **DONE** (Sprint 3 Cloud MVP) | — |

### P1 — HIGH (Strategic disadvantage)

| ID | Gap | Impact | Urgency | Score | Status | Effort |
|----|-----|--------|---------|-------|--------|--------|
| G5 | Vector-based memory | 5 | 5 | 25 | **HIGH PRIORITY** (VS ContextEngine) | H (2 weeks) |
| G6 | LLM adapter layer (Unified API) | 4 | 4 | 16 | **PARTIAL** (CLI only) | M (1 week) |
| G7 | Full MCP tool discovery UI | 4 | 3 | 12 | NOT STARTED | M (1 week) |

---

## 4. Crewly's Moats (Why We Win SMB)

| ID | Advantage | Rationale |
|----|-----------|-----------|
| **A1** | **Hierarchy Engine** | Our 6-phase escalation/reporting logic handles complex business processes (e.g. SteamFun) better than flat crews. |
| **A2** | **Live Visibility** | Business owners (SMB) trust AI when they can see the terminal "thinking" and "working" in real-time. |
| **A3** | **Interactive Control** | Ability to type into an agent's terminal to fix a specific blocker without restarting the session. |
| **A4** | **Platform-native QA** | Built-in quality gates ensure AI agents don't "hallucinate" successfully completed tasks. |
| **A5** | **Zero-Migration** | Agents use existing CLIs (Claude, Gemini) — customers keep their own tools and data. |

---

## 5. Strategic Recommendations

1. **Stop Chasing LangGraph Features**: LangGraph is for "Agent Engineers". Crewly is for "Business Operations". We don't need a Visual Graph Builder if we have specialized Team Templates.
2. **Double Down on "AI Team as a Service"**: Focus on the delivery of SteamFun and next 2 Pilots. Product iteration must be 100% driven by these customers.
3. **Fix Onboarding P0s Immediately**: A buggy `npx crewly onboard` kills any chance of viral adoption from content.
4. **Leverage "Claude Code" Momentum**: Position Crewly as the "Fleet Manager" for Claude Code agents.

---
*Deliverable for O1-KR1 (Complete Gap Matrix) | Mia (PM)*
