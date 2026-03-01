# Weekly Roadmap Update — Week 9 (Feb 24-27, 2026)

> **Authoritative Strategy:** [crewly-strategy-v1.md](./crewly-strategy-v1.md)
> **Q1 Execution Plan:** [q1-execution-plan.md](./q1-execution-plan.md)
> **Author:** Mia (Product Manager)
> **Date:** 2026-02-27

---

## Q1 KR Progress Summary

| KR | Last Week | This Week | Delta | Status |
|----|-----------|-----------|-------|--------|
| **KR1: Orchestrator + 3 Agents** | 80% | 82% | +2% | On Track |
| **KR2: Memory + Logging** | 95% | 95% | -- | Complete (polish) |
| **KR3: Self-evolution loop** | 90% | 92% | +2% | On Track |
| **KR4: STEAM Fun B2B** | 5% | 15% | +10% | At Risk |
| **KR5: 10 showcase content** | 30% | 40% | +10% | On Track |

---

## This Week's Progress by Team Member

### Sam (Engineer)

**Completed:**
1. **PR #110 merged** — Resolved open issues #94, #95, #97, #98 (3 rounds of review)
2. **PR #96 merged** — Self-evolution system with multi-platform messaging, OAuth, and user identity
3. **F13 Context Window Management** — Gemini CLI token-count detection (was missing % pattern), post-compact verification, compact timer cleanup. 88 tests passing.
4. **rednote-reader v3.0-3.1** — Removed all Web API code (caused account ban), rewrote as pure iPad Accessibility API mode. Added search with CJK clipboard paste, dynamic AXTextField detection, verify_focus() guard, goto-profile action.
5. **Stability fixes** — SchedulerService empty sessionName guard, stale agent log spam fix, filed GitHub issues #104-#108
6. **Task Management "Smart Delegate"** — delegate-task v2.0 with auto-monitoring (idle events + fallback checks), auto-cleanup on task completion. Subscription TTL increased from 30→120 min.
7. **crewly-web /business page** — 7 components, BookACall form, Calendly integration
8. **crewly-web i18n** — next-intl v4.8.3 implementation with locale routing

**In Progress:**
- Continued stability and dogfooding improvements

### Mia (Product Manager)

**Completed:**
1. **Strategy v1.0 alignment** — Read new strategy, audited codebase, created Q1 execution plan with 30 tasks across 5 KRs
2. **crewlyai.com migration plan** — Infrastructure findings (CELB2 nginx, Docker on DO), deployment steps
3. **crewlyai.com execution plan v1 & v2** — 6-page plan, then minimal version after Steve feedback
4. **Workflow template design** — Pattern for template JSON with category/vertical/skills/workflow
5. **STEAM Fun requirements** — Detailed project analysis (Google Workspace native, 8 P0 features, Apps Script constraints)
6. **Content channel strategy** (this session) — Full channel matrix, compliance rules, publishing workflow
7. Marked 10+ old strategy docs as superseded

### Luna (Content Strategy)

**Completed:**
1. **Content ops skill gap analysis** — Comprehensive capability assessment (30% covered, biggest gap = publishing APIs)
2. **Week 1 content plan** — 6 pieces planned for 3/3-3/5 (3 Crewly brand + 3 Steve personal)
3. **Channel/account strategy recommendations** — Q1 use @stevesprompt only, defer @crewlyai
4. **小红书 influencer research** — Benchmark accounts with follower data

### Ethan (Strategist)

**Completed:**
1. **Positioning correction** — Rewrote STRATEGIST-FRAMEWORK.md, reframed Crewly as AI-native transformation service provider
2. **Business opportunities report** — Four product lines mapped (open source → install → services → cloud)

### Nick (SteamFun Dev)

**Completed:**
1. **STEAM Fun prototype testing** — 3 roles tested, 4 fixes applied in AI Studio
2. **SteamFun identity flow** — identifyUser(email) for Teachers/Parents, binding form with invite codes
3. **Apps Script deployment** — clasp deploy with access:ANYONE

---

## KR Detail Updates

### KR1: Orchestrator + 3 Core Agents (82%)

| Task | Status | Notes |
|------|--------|-------|
| 1.1 Create Ops role prompt | Not started | Blocked on Sam bandwidth |
| 1.2 Add PM/Eng/Ops to constants | Not started | |
| 1.3 Core Team template | Not started | |
| 1.4 Collaboration playbook | Not started | Mia can start this |
| 1.5 Integration test | Not started | Depends on 1.1-1.3 |
| 1.6 Demo recording | Not started | Depends on 1.5 |

**Assessment:** KR1 tasks haven't started this week. Sam was focused on stability fixes (issues #94-98, #104-108), task management improvements, and crewly-web features. These were higher urgency but KR1 remains behind schedule.

### KR2: Memory + Logging (95%)

| Task | Status | Notes |
|------|--------|-------|
| 2.1 Memory stats API | Not started | |
| 2.2 Memory dashboard | Not started | |
| 2.3 Memory recall indicator | Not started | |
| 2.4 Memory system showcase doc | Not started | Mia |
| 2.5 Daily log summary | Not started | |

**Assessment:** Core system complete. Polish tasks not started. Low risk — these are nice-to-haves, not blockers.

### KR3: Self-evolution loop (92%)

| Task | Status | Notes |
|------|--------|-------|
| 3.1 History API | Not started | |
| 3.2 Evolution dashboard | Not started | |
| 3.3 Weekly reports | Not started | |
| 3.4 Showcase doc | Not started | Mia |
| 3.5 Demo clip | Not started | |

**Assessment:** PR #96 merged self-evolution system with multi-platform messaging. Core loop is stronger. Observability tasks not started.

### KR4: STEAM Fun B2B (15%)

| Task | Status | Notes |
|------|--------|-------|
| 4.1 Requirements gathering | **Done** | Mia completed detailed analysis. Google Workspace native, 8 P0 features. |
| 4.2 Team template design | Not started | Needs Steve template approval |
| 4.3 Education role prompts | Not started | Sam |
| 4.4 STEAM Fun template | Not started | Sam |
| 4.5 Onboarding guide | Not started | Mia |
| 4.6 Deploy + test | Not started | |
| 4.7 Metrics tracking | Not started | |
| 4.8 Case study | Not started | |

**Assessment:** Requirements gathered (15% → done). Nick's prototype is progressing separately in AI Studio (React+Tailwind). Nick has identity flow working with invite codes. P0 admin routing bug remains. This KR depends heavily on Nick's prototype completion and Steve's approval of the team template.

**Risk: AT RISK** — B2B customer success depends on external factors. Nick's AI Studio prototype has persistent bugs (window.fetch TypeError). STEAM Fun team template design needs Steve decision.

### KR5: 10 Showcase Content (40%)

| # | Content Piece | Status | Notes |
|---|--------------|--------|-------|
| 5.1 | Hero blog "My AI Team Runs My Company" | Not started | Needs AI Team OS repositioning |
| 5.2 | Updated HN post | Not started | |
| 5.3 | 3-agent collaboration demo video | Not started | Depends on KR1 demo |
| 5.4 | PM agent showcase | Not started | Luna Week 2 |
| 5.5 | Self-evolution showcase blog | Not started | |
| 5.6 | Quick-start video | Not started | Luna Week 3 |
| 5.7 | STEAM Fun case study | Not started | Depends on KR4 |
| 5.8 | Memory system thread | Not started | Luna Week 3 |
| 5.9 | Founder story | Not started | Needs Steve |
| 5.10 | AI Team Diary series | Not started | Luna Week 2 |

**New this week:**
- Luna completed content ops skill gap analysis (foundation for content production)
- Luna created Week 1 content plan (6 pieces for 3/3-3/5)
- Content channel strategy document created (compliance rules, publishing workflow)
- Progress is in **planning/infrastructure**, not published content yet

**Assessment:** 40% = 3 old pieces (need repositioning) + planning infrastructure built. Actual published content at 0/10. Luna's Week 1 plan kicks off 3/3. On track if execution starts next week.

---

## Phase 1→2 Trigger Assessment

**Trigger criteria:** 3+ differentiated core features + complete demo flow + user confirms ready

| Criterion | Status | Evidence |
|-----------|--------|---------|
| 3+ differentiated features | **MET** | Terminal streaming, team dashboard, quality gates, budget tracking, Slack integration, self-evolution, MCP server+client, context window management |
| Complete demo flow | **PARTIAL** | Onboard→start→dashboard→agents works. Missing Ops role for full 3-agent demo. |
| User confirms ready | **NOT MET** | Strategy pivot to AI Team OS means new demo flow needed. Steve hasn't confirmed. |

**Verdict:** Phase 1→2 transition NOT ready. Strategy pivot changed the demo requirements. Need:
1. Ops role created (KR1.1)
2. AI Team OS-positioned demo recorded
3. Steve's green light

---

## Key Decisions / Blockers This Week

1. **Steve feedback:** Strategy reports must distinguish "verified deliverable" vs "unverified assumption". Crewly capabilities are mostly theoretical — need real delivery validation.
2. **Steve feedback:** Don't self-build coding agent runtime. Use open source (Aider, SWE-agent, OpenHands). Need research on which works best with Claude API.
3. **Steve feedback:** Website v1 execution plan too big (1136 lines). Prefers minimal, additive changes. V2 minimal plan adopted.
4. **Content channel compliance:** Steve personal accounts must not conflict with Google interests. Angle = "one-person company amplification". Crewly official has no restrictions.
5. **Context management pattern confirmed:** Do NOT restart agents when context is low. Just send new message — Claude Code auto-compresses.

---

## Next Week Priorities

### Sam
1. **KR1.1-1.2:** Create Ops role + update constants (overdue)
2. **Stability:** Continue resolving GitHub issues #104-108
3. **KR4.3-4.4:** Start education role prompts + STEAM Fun template (if requirements approved)

### Mia
1. **KR1.4:** Write PM↔Eng↔Ops collaboration playbook
2. **KR2.4 + KR3.4:** Memory + self-evolution showcase docs
3. **KR5.1:** Draft hero blog "My AI Team Runs My Company"
4. **Content channel strategy:** Ensure Luna has compliance checklist

### Luna
1. **KR5.10:** Start AI Team Diary series (Week 1 posts)
2. **KR5.4:** PM agent showcase content
3. **Week 1 execution:** Produce 6 content pieces per plan (3/3-3/5)

### Nick
1. **KR4:** Fix P0 admin routing bug in AI Studio
2. **KR4:** Continue STEAM Fun prototype development

---

## Metrics

| Metric | Value |
|--------|-------|
| GitHub stars | 61 |
| npm version | 1.0.11 |
| Open GitHub issues | #100, #104-108 (5 new this week) |
| PRs merged this week | 2 (#96, #110) |
| Total docs in .crewly/docs/ | 31+ |
| Active team members | 5 (Sam, Mia, Luna, Ethan, Nick) |
| Content pieces published | 0/10 (planning phase) |

---

*Mia — Product Manager | Crewly Core Team*
*Next update: Week 10 (March 3-7, 2026)*
