# Phase 1 Decision Brief

> **Author**: Mia (Product Manager) | **Date**: 2026-02-24 | **For**: Steve + Orchestrator

---

## 1. What Is Complete

| Deliverable | Owner | Status | Location |
|-------------|-------|--------|----------|
| Competitive gap matrix (O1-KR1) | Mia | DONE | `docs/okr/phase1/mia-gap-matrix.md`, `.crewly/docs/competitive-gap-matrix.md` |
| Prioritized roadmap (O1-KR2) | Mia | DONE | `docs/okr/phase1/mia-roadmap-v1.md`, `.crewly/docs/roadmap-v3.md` |
| F13 Context Window Mgmt audit | Sam | DONE | `docs/okr/phase1/sam-f13-audit.md` |
| QA review of all outputs | Mia | DONE | `docs/okr/phase1/mia-phase1-review.md` |
| 2-week execution taskboard | Mia | DONE | `docs/okr/phase1/mia-next-2-weeks-taskboard.md` |
| Code: Gemini runtime enhancements | Sam | CODE DONE, UNCOMMITTED | `backend/src/services/agent/gemini-runtime.service.ts` (+454 lines) |
| Code: Context window monitor improvements | Sam | CODE DONE, UNCOMMITTED | `backend/src/services/agent/context-window-monitor.service.ts` (+61 lines) |
| Code: Agent registration refactor | Sam | CODE DONE, UNCOMMITTED | `backend/src/services/agent/agent-registration.service.ts` (+266 lines) |
| Code: Settings + frontend updates | Sam | CODE DONE, UNCOMMITTED | 33 files total, 1717+ lines |

**Summary**: All research deliverables (O1) are complete. Sam has significant code work done but uncommitted. No code has shipped as a feature yet (F1-F26 all NOT STARTED per roadmap).

---

## 2. What Remains (Phase 1 Scope)

### Must-Have for Phase 1 Exit (P0)

| Item | Roadmap ID | Owner | Est. Effort | Blocked By |
|------|-----------|-------|-------------|------------|
| Commit current work | — | Sam | 0.5d | Nothing |
| MIT LICENSE file | F3 | Sam | 0.5d | Nothing |
| `npx crewly init` wizard | F1 | Sam | 2-3d | Nothing |
| 3 team templates | F5 | Sam + Mia | 2d | F1 |
| Fix onboarding bugs | — | Sam | 1d | Nothing |
| README overhaul | F2 | Sam + Mia | 1d | F1 |
| CONTRIBUTING.md | F4 | Mia | 1d | Nothing |
| Discord server | — | Mia | 0.5d | Nothing |

**P0 total: ~8-9 developer-days for Sam, ~2.5 days for Mia**

### Should-Have for Phase 1 Exit (P1)

| Item | Roadmap ID | Owner | Est. Effort |
|------|-----------|-------|-------------|
| LLM adapter layer (Claude + OpenAI + Ollama) | F6 | Sam | 3-4d |
| Vector-based memory with embeddings | F9 | Sam | 3-4d |
| MCP client in agents | F7 | Sam | 3d |
| Docker deployment | F8 | Sam | 2d |
| Documentation site | F10 | Sam + Mia | 2-3d |
| OpenTelemetry tracing | F14 | Sam | 2d |

**P1 total: ~15-19 developer-days for Sam**

---

## 3. Go/No-Go Criteria for Phase 1 → Phase 2

Phase 2 is "Marketing + Growth" — we go public. Going public before ready destroys first impressions.

### GO Criteria (ALL must pass)

| # | Criterion | How to Verify | Currently |
|---|-----------|---------------|-----------|
| 1 | `npx crewly init` → `crewly start` → agents working in < 5 min | Manual test on clean macOS + Linux | NOT MET (F1 not built) |
| 2 | 3 team templates available and functional | `crewly init --template startup-dev` works | NOT MET (F5 not built) |
| 3 | LICENSE + CONTRIBUTING + clean README in repo | Check repo root | NOT MET (F2/F3/F4 not done) |
| 4 | 3+ differentiated features that competitors don't have | Feature audit against gap matrix | MET (terminal streaming, budget tracking, Slack, quality gates, auto-continuation — all already built) |
| 5 | End-to-end demo flow works without manual intervention | Record screen from install to task completion | NOT MET (onboarding bugs block this) |
| 6 | All code committed and `npm run build` passes | `git status` clean + `npm run build` | NOT MET (1717 lines uncommitted) |

**Current score: 1/6 GO criteria met. Phase 2 is NOT ready.**

### NO-GO Triggers (any one blocks launch)

| # | Trigger | Status |
|---|---------|--------|
| 1 | `crewly init` doesn't work on macOS | N/A (not built yet) |
| 2 | Known bugs in first-run experience | ACTIVE — 3 onboarding bugs found |
| 3 | No LICENSE file (legal risk for adopters) | ACTIVE |
| 4 | README doesn't explain what Crewly is in 30 seconds | ACTIVE |

---

## 4. Key Decisions Needed

### Decision 1: Phase 1 Scope — Strict P0 or P0+P1?

**Option A (Recommended): Ship P0 only, then go to Phase 2**
- Timeline: ~2 weeks (by Mar 7)
- Rationale: Adoptability matters more than features right now. Users can't even try Crewly today. P0 items remove all barriers to trial. We already have 5+ features competitors don't have.
- Risk: P1 features (LLM adapter, vector memory, MCP) stay as gaps. Acceptable because our moat features are already built.

**Option B: Ship P0 + P1, then go to Phase 2**
- Timeline: ~5-6 weeks (by end of March)
- Rationale: More complete product, closer to feature parity with CrewAI/LangGraph.
- Risk: Delays public launch by a month. Competitors aren't standing still.

**Recommendation**: Option A. Get adoptable first, then iterate. The features we already have (terminal streaming, budget tracking, quality gates) are enough to differentiate. What we lack is not features — it's approachability.

### Decision 2: Open-Source License

Current: ISC. Roadmap says MIT. CrewAI, AutoGen, LangGraph all use MIT.

**Recommendation**: MIT. It's the standard for this space. Removes friction for enterprise evaluation.

### Decision 3: Luna's Role

No Luna outputs found in Phase 1 docs. Either Luna wasn't assigned, or outputs are elsewhere.

**Action needed**: Orchestrator to confirm Luna's Phase 1 assignment and redirect if needed.

---

## 5. Top 5 Tasks — Next 3 Days (Feb 25-27)

Ordered by impact and dependency chain. Sam should execute top-to-bottom.

### Task 1: Commit Current Work (Sam, Day 1 morning, 2 hours)

**What**: Commit all 33 modified files (1717+ lines) currently uncommitted on main.
**Why**: Protects against work loss. Unblocks clean state for new features.
**Acceptance**: `git status` shows clean working tree. `npm run build` passes.
**Depends on**: Nothing.
**Risk**: Merge conflicts if others pushed. LOW — Sam is sole active dev.

### Task 2: Add MIT LICENSE + Update package.json (Sam, Day 1 afternoon, 2 hours)

**What**: Create `/LICENSE` with MIT text (2026, Crewly contributors). Update `package.json` license field from `"ISC"` to `"MIT"`.
**Why**: Legal blocker for adoption. Takes 30 minutes but has outsized impact.
**Acceptance**: GitHub detects and displays MIT license badge.
**Depends on**: T1 (commit first for clean state).

### Task 3: Fix Onboarding Bugs (Sam, Day 1 afternoon, 4 hours)

**What**: Fix 3 known bugs in `cli/src/commands/onboard.ts`:
  - Line 199, 203: `@anthropic-ai/gemini-cli` → `@google/gemini-cli`
  - Template selection must create team (currently doesn't)
  - Add tmux detection during onboard
**Why**: These block the first-run experience. Must fix before building `crewly init`.
**Acceptance**: Manual test of `crewly onboard` — all 3 bugs verified fixed.
**Depends on**: T1.

### Task 4: `npx crewly init` Interactive Wizard (Sam, Days 2-3, 2 days)

**What**: New `cli/src/commands/init.ts` — detect tools, prompt for project name + directory + template, generate `.crewly/` + team config, print next steps.
**Why**: This is the #1 adoption blocker. CrewAI has `crewai create`, LangGraph has prebuilt agents. We have nothing.
**Acceptance**: `npx crewly init` → `crewly start` → agents visible in dashboard. Max 5 prompts. `--yes` flag works.
**Depends on**: T3 (bug fixes, so init doesn't inherit broken onboard code).

### Task 5: CONTRIBUTING.md + Discord Setup (Mia, Days 1-2, 1.5 days)

**What**:
  - Write CONTRIBUTING.md: dev setup, PR process, code standards summary, issue templates
  - Create Discord server: #general, #help, #showcase, #dev, #contributing channels
**Why**: Community infrastructure. Must exist before README links to them.
**Acceptance**: New contributor can follow CONTRIBUTING.md to set up dev env. Discord invite link works.
**Depends on**: Nothing (Mia works parallel to Sam).

---

## 6. 3-Day Schedule

```
         Sam                          Mia
Day 1    T1: Commit (AM)              T5: CONTRIBUTING.md
         T2: LICENSE (PM)             T5: Discord setup
         T3: Bug fixes (PM)
Day 2    T4: crewly init (full day)   T5: Issue templates
                                      Template design docs (F5 content)
Day 3    T4: crewly init (finish)     README copy draft (F2 prep)
         T4: Manual test + fix        Review Sam's init PR
```

**Day 3 checkpoint**: If `npx crewly init` works end-to-end, we're on track for Phase 1 P0 completion by Mar 7. If blocked, escalate scope reduction.

---

## 7. Phase 1 Timeline Summary

```
Week 1 (Feb 24-28):  Commit + LICENSE + Bugs + crewly init + CONTRIBUTING + Discord
Week 2 (Mar 3-7):    Templates + README + remaining P0 items + sprint retro
Week 3+ (if Option A): Phase 2 prep (demo video, HN post, public repo)
Week 3+ (if Option B): Continue P1 features (LLM adapter, MCP, memory, Docker)
```

**Decision point**: End of Week 2 (Mar 7). Re-evaluate GO criteria. If 5/6 met, plan Phase 2 launch. If <5/6, extend Phase 1 by 1 week max.

---

*This brief supersedes previous status reports. Next update: Mar 7 sprint retro or earlier if blocked.*
