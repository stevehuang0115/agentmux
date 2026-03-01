# Q1 Execution Plan — Crewly AI Team OS MVP

> **Based on:** [crewly-strategy-v1.md](./crewly-strategy-v1.md) (Steve, v1.0)
> **Author:** Mia (Product Manager, crewly-core-mia-member-1)
> **Date:** 2026-02-27
> **Q1 Objective:** 构建 Crewly 核心 AI Team OS MVP

---

## Current State Assessment (Codebase Audit)

Before planning, I audited the actual codebase to avoid proposing work that's already done.

| Q1 KR | Current Status | Key Evidence |
|--------|---------------|--------------|
| **KR1: Orchestrator + 3 Agents** | ⚠️ 80% done | Orchestrator: 9 services + 45 skills. PM/Eng roles exist in `config/roles/`. Ops role needs formalization. |
| **KR2: Memory + Logging** | ✅ 95% done | 7 memory services (agent/project/session/daily/goal/learning). Activity monitoring + WebSocket streaming. |
| **KR3: Self-evolution loop** | ✅ 90% done | SelfImprovementService with plan→execute→validate→rollback. Multi-platform messaging added. |
| **KR4: STEAM Fun B2B** | ❌ 5% done | No STEAM-specific templates or B2B onboarding. Nick doing prototype separately. |
| **KR5: 10 showcase content** | ⚠️ 30% done | 3 content pieces exist (blog, HN post, Twitter thread) but use old "competitor catching" positioning. |

**Key insight:** KR1-3 are largely built. The real Q1 work is **KR4 (STEAM Fun)** and **KR5 (content)**, plus polishing KR1-3 for demo-readiness.

---

## KR1: Orchestrator + 3 Core Agents (PM / Eng / Ops)

### What's Already Built
- **Orchestrator:** Full lifecycle management, 45+ skills, Slack integration, self-improvement workflow, state persistence across restarts
- **PM role:** `config/roles/product-manager/prompt.md` — handles requirements, specs, roadmap
- **Engineer roles:** `config/roles/developer/`, `backend-developer/`, `fullstack-dev/` — handles code, tests, debugging
- **17 total role definitions** in `config/roles/`

### What's Missing (Extend/Optimize)
- Ops role not formalized (no `config/roles/ops/` or `operations/` directory)
- Only 6 roles in `CREWLY_CONSTANTS.ROLES` — PM/Eng/Ops not explicitly listed
- No "core 3" team template for quick demo/onboarding
- No end-to-end demo script showing all 3 agents collaborating

### Task Breakdown

| # | Task | Type | Owner | Timeline | Success Criteria |
|---|------|------|-------|----------|-----------------|
| 1.1 | Create `config/roles/ops/prompt.md` with Ops agent definition (deployment, monitoring, incident response) | New | Sam | Week 1 | Role file exists, agent can register with role=ops |
| 1.2 | Add PM/Eng/Ops to `CREWLY_CONSTANTS.ROLES` in `backend/src/constants.ts` | Extend | Sam | Week 1 | TypeScript compiles, constants exported |
| 1.3 | Create "Core Team" template: 1 PM + 1 Eng + 1 Ops agent with pre-configured skills | New | Sam | Week 2 | `npx crewly start --template core-team` works |
| 1.4 | Write PM↔Eng↔Ops collaboration playbook (who delegates what, handoff patterns) | New | Mia | Week 2 | Document at `config/roles/core-team-playbook.md` |
| 1.5 | End-to-end integration test: Orchestrator assigns task → PM specs it → Eng builds it → Ops deploys it | Extend | Sam | Week 3 | Full task cycle completes autonomously |
| 1.6 | Create 2-minute demo recording of 3-agent collaboration | New | Mia+Luna | Week 4 | Video uploaded, usable for KR5 content |

### Milestones
- **Week 1:** Ops role exists, all 3 roles in constants ✅
- **Week 2:** Core Team template working, playbook documented
- **Week 3:** Autonomous task cycle demo-able
- **Week 4:** Video recorded for showcase

---

## KR2: Memory + Logging System Online

### What's Already Built
- **Memory:** AgentMemoryService, ProjectMemoryService, SessionMemoryService, DailyLogService, GoalTrackingService, LearningAccumulationService (7 services)
- **Logging:** ActivityMonitorService, MonitoringService, TaskAssignmentMonitorService, SystemResourceAlertService, TeamActivityWebSocketService
- **APIs:** `recall()` and `remember()` with agent/project scope, knowledge doc integration
- **Search:** KeywordSearchStrategy (default) + GeminiEmbeddingStrategy (optional)

### What's Missing (Optimize)
- No memory dashboard in frontend (data exists but not visualized)
- No "memory health" metrics (how much knowledge accumulated, recall hit rate)
- Daily logs not surfaced in team dashboard
- No memory export/backup mechanism

### Task Breakdown

| # | Task | Type | Owner | Timeline | Success Criteria |
|---|------|------|-------|----------|-----------------|
| 2.1 | Add memory stats endpoint: `/api/memory/stats` (total memories, by scope, by category) | Extend | Sam | Week 1 | API returns accurate stats |
| 2.2 | Frontend memory dashboard panel showing agent learnings and project knowledge | New | Sam | Week 2 | Dashboard shows memory timeline |
| 2.3 | Add "Memory Recall" activity indicator in team dashboard (show when agent recalls/stores) | Extend | Sam | Week 2 | Real-time memory activity visible |
| 2.4 | Write "Memory System" showcase doc explaining the architecture for content | New | Mia | Week 1 | Document at `.crewly/docs/memory-system-showcase.md` |
| 2.5 | Daily log summary endpoint: auto-generated team activity summary | Extend | Sam | Week 3 | `/api/logs/daily-summary` returns readable report |

### Milestones
- **Week 1:** Memory stats API live, showcase doc written
- **Week 2:** Memory visible in dashboard
- **Week 3:** Daily summaries automated

### Current Status: ✅ Core system complete. Remaining work is visibility and polish.

---

## KR3: Self-Evolution Basic Loop

### What's Already Built
- **SelfImprovementService:** `planImprovement()` → `executeImprovement()` → auto-validate on restart
- **ImprovementMarkerService:** State persistence across hot-reloads
- **ImprovementStartupService:** Auto-validation on boot
- **File backup system:** Full backup before code modifications
- **Rollback:** Automatic on validation failure
- **Multi-platform messaging:** Slack + Discord + Telegram adapters (new)
- **Trigger:** Error recording → pattern detection → fix proposal → execution

### What's Missing (Optimize)
- No visible improvement log/audit trail in dashboard
- No success rate tracking (how many improvements stuck vs rolled back)
- No "self-evolution report" for stakeholders
- Loop exists but not demo-able to outsiders

### Task Breakdown

| # | Task | Type | Owner | Timeline | Success Criteria |
|---|------|------|-------|----------|-----------------|
| 3.1 | Add improvement history endpoint: `/api/self-evolution/history` listing all improvements with status | Extend | Sam | Week 1 | API returns timestamped improvement log |
| 3.2 | Frontend panel: "Self-Evolution Log" showing recent improvements, success/rollback | New | Sam | Week 2 | Dashboard shows evolution timeline with status badges |
| 3.3 | Weekly self-evolution summary: auto-generated report of what the system improved | Extend | Sam | Week 3 | Automated Slack report every Monday |
| 3.4 | Write "Self-Evolution" showcase doc: how Crewly improves itself | New | Mia | Week 1 | Document for content team |
| 3.5 | Record self-evolution demo: trigger error → system detects → proposes fix → applies → validates | New | Mia+Luna | Week 4 | 60-second clip for social media |

### Milestones
- **Week 1:** History API + showcase doc
- **Week 2:** Visible in dashboard
- **Week 3:** Automated weekly reports
- **Week 4:** Demo clip recorded

### Current Status: ✅ Core loop complete. Remaining work is observability and showcase.

---

## KR4: First B2B Customer (STEAM Fun) Online

### What's Already Built
- Generic marketplace/skill installation system
- Agent registration and team management
- Nick working on STEAM Fun prototype (external)

### What's Missing (New — Largest KR)
- No STEAM Fun team template
- No education-specific agent roles or prompts
- No B2B onboarding flow
- No STEAM Fun-specific workflows (curriculum, student management, content creation)
- No customer success tracking

### Task Breakdown

| # | Task | Type | Owner | Timeline | Success Criteria |
|---|------|------|-------|----------|-----------------|
| 4.1 | Requirements gathering: Interview Nick/Steve on STEAM Fun's exact operational needs | New | Mia | Week 1 | Requirements doc at `docs/okr/steam-fun-requirements.md` |
| 4.2 | Design STEAM Fun team template: roles (Content Creator, Curriculum Designer, Ops Manager, Social Media), workflows, skills | New | Mia | Week 1-2 | Team template spec approved by Steve |
| 4.3 | Create education-specific agent role prompts (`config/roles/curriculum-designer/`, `content-creator/`, etc.) | New | Sam | Week 2-3 | Roles register and respond to education tasks |
| 4.4 | Build STEAM Fun team template in `config/templates/steam-fun/` | New | Sam | Week 3 | `npx crewly start --template steam-fun` creates full team |
| 4.5 | Create STEAM Fun onboarding guide for Nick/STEAM team | New | Mia | Week 3 | Step-by-step guide at `docs/okr/steam-fun-onboarding.md` |
| 4.6 | Deploy and test with STEAM Fun: run full team for 1 week, iterate on issues | New | Sam+Mia | Week 4-6 | Team runs autonomously for 5+ consecutive days |
| 4.7 | Customer success metrics: track tasks completed, errors, uptime for STEAM Fun | New | Sam | Week 4 | Dashboard shows STEAM Fun team metrics |
| 4.8 | Post-deployment retrospective: document what worked, what didn't, create case study | New | Mia | Week 6 | Case study at `.crewly/docs/steam-fun-case-study.md` |

### Milestones
- **Week 1:** Requirements gathered, Nick interviewed
- **Week 2:** Team template designed and approved
- **Week 3:** Roles and template implemented, onboarding guide ready
- **Week 4:** STEAM Fun team deployed
- **Week 6:** Running autonomously, case study written

### Dependencies
- Nick's prototype progress (external)
- Steve's approval on team template design
- STEAM Fun team's availability for testing

### Risk: This is the highest-risk KR. B2B customer success depends on external factors (Nick, STEAM Fun availability). Mitigation: Start requirements ASAP, keep template generic enough to adapt.

---

## KR5: 10 AI Team Showcase Content Pieces

### What's Already Built (Needs Repositioning)
1. `blog-multi-agent-orchestration.md` — Technical blog (old positioning: "multi-agent framework")
2. `show-hn-post.md` — HN launch post (old positioning: "competitor to CrewAI")
3. `twitter-launch-thread.md` — Twitter thread (old positioning: "open source launch")
4. `demo-video-script.md` — 2-minute demo script (old positioning: feature showcase)

### New Positioning Required
All content must align with the new strategy: **"AI Team OS — let one person own a self-driving AI company"**

Key messaging pillars:
- "My AI team built this while I slept"
- "One person, full AI company"
- "Self-evolving AI that fixes its own mistakes"
- "Watch my AI team work in real-time"

### Content Plan (10 pieces)

| # | Content Piece | Type | Owner | Timeline | Platform |
|---|--------------|------|-------|----------|----------|
| 5.1 | "My AI Team Runs My Company" — hero blog post, new positioning | Blog | Mia | Week 1 | Blog, Medium |
| 5.2 | Update HN post to "AI Team OS" angle | Update | Mia | Week 1 | Hacker News (draft) |
| 5.3 | "Watch 3 AI Agents Collaborate in Real-Time" — demo video (from KR1.6) | Video | Luna+Mia | Week 4 | YouTube, X |
| 5.4 | "How My AI PM Writes Better Specs Than Most Humans" — PM agent showcase | Blog/Thread | Luna | Week 2 | X, LinkedIn |
| 5.5 | "Self-Evolving AI: My System Fixed 47 Bugs While I Was at Work" — self-evolution showcase | Blog | Mia | Week 3 | Blog, X |
| 5.6 | "From Zero to Running AI Team in 5 Minutes" — quick-start video | Video | Luna | Week 3 | YouTube, TikTok |
| 5.7 | STEAM Fun case study: "How an Education Company Got an AI Operations Team" | Case Study | Mia | Week 6 | Blog, LinkedIn |
| 5.8 | "AI Memory System: How Our Agents Learn and Never Repeat Mistakes" | Thread | Luna | Week 3 | X, LinkedIn |
| 5.9 | Steve's founder story: "Why I Built an AI Team Instead of Hiring" | Interview/Blog | Luna+Steve | Week 4 | YouTube, Substack |
| 5.10 | Weekly "AI Team Diary" posts (3 posts = 1 content piece × 3 weeks) | Social Series | Luna | Week 2-4 | X, 小红书 |

### Milestones
- **Week 1:** 2 pieces published (hero blog + updated HN draft)
- **Week 2:** 4 pieces total (PM showcase + first diary post)
- **Week 3:** 7 pieces total (self-evolution blog + quick-start video + memory thread)
- **Week 4:** 9 pieces total (demo video + founder story)
- **Week 6:** 10 pieces total (STEAM Fun case study)

---

## Overall Q1 Timeline

```
Week 1  ──────────────────────────────────────────────────
  KR1: Ops role + constants (Sam)
  KR2: Memory stats API + showcase doc (Sam + Mia)
  KR3: History API + showcase doc (Sam + Mia)
  KR4: STEAM Fun requirements gathering (Mia)
  KR5: Hero blog + HN update (Mia)

Week 2  ──────────────────────────────────────────────────
  KR1: Core Team template + playbook (Sam + Mia)
  KR2: Memory dashboard panel (Sam)
  KR3: Evolution dashboard panel (Sam)
  KR4: Team template design (Mia)
  KR5: PM showcase + first diary (Luna)

Week 3  ──────────────────────────────────────────────────
  KR1: Integration test (Sam)
  KR2: Daily log summaries (Sam)
  KR3: Weekly evolution reports (Sam)
  KR4: Roles + template implementation (Sam)
  KR5: Self-evolution blog + quick-start video + memory thread (Mia + Luna)

Week 4  ──────────────────────────────────────────────────
  KR1: Demo recording (Mia + Luna)
  KR3: Self-evolution demo clip (Mia + Luna)
  KR4: Deploy to STEAM Fun (Sam + Mia)
  KR5: Demo video + founder story (Luna + Steve)

Week 5-6  ────────────────────────────────────────────────
  KR4: STEAM Fun running + iteration (Sam + Mia)
  KR4: Case study (Mia)
  KR5: STEAM Fun case study = final content piece (Mia)
```

---

## Owner Workload Summary

### Sam (Engineer)
- **Week 1:** KR1.1 (Ops role), KR1.2 (constants), KR2.1 (memory stats API), KR3.1 (evolution history API)
- **Week 2:** KR1.3 (Core Team template), KR2.2 (memory dashboard), KR2.3 (memory indicator), KR3.2 (evolution dashboard)
- **Week 3:** KR1.5 (integration test), KR2.5 (daily summaries), KR3.3 (weekly reports), KR4.3 (edu roles), KR4.4 (STEAM template)
- **Week 4:** KR4.6 (STEAM deployment), KR4.7 (metrics)
- **Focus:** Backend engineering + frontend dashboard + STEAM Fun technical implementation

### Mia (Product Manager)
- **Week 1:** KR2.4 (memory showcase doc), KR3.4 (evolution showcase doc), KR4.1 (STEAM requirements), KR5.1 (hero blog), KR5.2 (HN update)
- **Week 2:** KR1.4 (playbook), KR4.2 (STEAM template design)
- **Week 3:** KR4.5 (STEAM onboarding guide), KR5.5 (self-evolution blog)
- **Week 4:** KR1.6 (demo recording), KR3.5 (evolution demo clip)
- **Week 6:** KR4.8 (STEAM retrospective), KR5.7 (STEAM case study)
- **Focus:** Product specs + content creation + B2B customer success

### Luna (Content Strategy)
- **Week 2:** KR5.4 (PM showcase), KR5.10 (diary start)
- **Week 3:** KR5.6 (quick-start video), KR5.8 (memory thread), KR5.10 (diary continued)
- **Week 4:** KR5.3 (demo video), KR5.9 (founder story with Steve), KR5.10 (diary week 3)
- **Focus:** Content production + video creation + social media distribution

---

## Success Criteria & Measurement

| KR | Target | How to Measure | Current Progress |
|----|--------|---------------|-----------------|
| KR1 | 3 core agents working autonomously | Integration test passes: task assigned → PM specs → Eng builds → Ops deploys | 80% — missing Ops role + template |
| KR2 | Memory + Logging visible and functional | Dashboard shows memory stats, activity logs accessible via API | 95% — core done, needs visualization |
| KR3 | Self-evolution loop demo-able | Can trigger error → system detects → fixes → validates, all visible in dashboard | 90% — loop works, needs observability |
| KR4 | STEAM Fun running for 5+ consecutive days | Uptime logs show autonomous operation with <2 critical failures/day | 5% — not started |
| KR5 | 10 content pieces published | Content published on respective platforms with engagement metrics | 30% — 3 old pieces need repositioning |

---

## Superseded Documents

The following `.crewly/docs/` documents are **superseded** by this new strategy. They retain historical value but should NOT be used for current planning:

| Document | Old Focus | Superseded By |
|----------|-----------|--------------|
| `roadmap-v3.md` | Competitive gap-closing roadmap | `crewly-strategy-v1.md` + this plan |
| `okr-v3.md` | Cloud-first SaaS OKR | `crewly-strategy-v1.md` Q1 OKR |
| `crewly-cloud-okr-roadmap.md` | Cloud SaaS March launch | New strategy (AI Team OS, not Cloud SaaS) |
| `crewly-cloud-tech-roadmap.md` | Cloud tech implementation | New strategy direction |
| `mvp-only-roadmap.md` | Cloud MVP roadmap | New strategy direction |
| `cloud-first-brainstorm.md` | Cloud-first brainstorm | New strategy direction |
| `cloud-mvp-plan.md` | Cloud MVP plan | New strategy direction |
| `business-model-v2.md` | Route A/B/C monetization | Strategy v1 monetization (Self-Serve + Marketplace + Custom) |
| `gtm-strategy.md` | HN-focused open source launch | Strategy v1 GTM (founder-led + template-driven + B2B WoM) |
| `openclaw-strategy.md` | OpenClaw competitive response | No longer "catching up" — repositioned as AI Team OS |
| `pricing-v2.md` | Cloud pricing model | Strategy v1 tiered pricing |
| `strategic-moat-analysis.md` | Old moat assessment | Strategy v1 defines 6 new moats |
| `smb-zero-install-product-design.md` | SMB zero-install product | Deprioritized in new strategy |
| `feature-roadmap-mvp.md` | MVP feature list | Superseded by this Q1 plan |
| `tech-feasibility-mvp.md` | MVP tech feasibility | Superseded by this Q1 plan |
| `mvp-tech-solutions.md` | MVP tech solutions | Superseded by this Q1 plan |

### Documents Still Valid
- `competitive-gap-matrix.md` — Useful reference data, competitive intel still accurate
- `onboarding-experience-report.md` — Bugs still need fixing
- `onboarding-checklist.md` — Still applicable
- `demo-video-script.md` — Needs repositioning but structure is good
- `website-content-package.md` — Needs update to AI Team OS messaging
- Marketing content (HN, blog, Twitter) — Need repositioning per KR5

---

## Key Risks

1. **STEAM Fun dependency (KR4):** B2B success depends on Nick's prototype and STEAM Fun's availability. **Mitigation:** Start requirements gathering immediately, keep template generic enough to adapt.
2. **Content repositioning (KR5):** Old content used "competitor catching" framing. **Mitigation:** Write new content from scratch where repositioning is too complex.
3. **Sam bandwidth (KR1-4):** Sam has heavy engineering load across all KRs. **Mitigation:** Prioritize KR4 (highest risk, lowest progress), KR1-3 are polish.
4. **Steve's 5hrs/week:** Steve is decision bottleneck for STEAM Fun template and content approval. **Mitigation:** Batch decisions, present options not open questions.

---

## Next Actions (This Week)

- [ ] **Mia:** Start STEAM Fun requirements gathering (KR4.1) — contact Nick
- [ ] **Mia:** Write memory system showcase doc (KR2.4) and self-evolution showcase doc (KR3.4)
- [ ] **Mia:** Draft hero blog post "My AI Team Runs My Company" (KR5.1)
- [ ] **Sam:** Create `config/roles/ops/prompt.md` (KR1.1) and update constants (KR1.2)
- [ ] **Sam:** Build memory stats API (KR2.1) and evolution history API (KR3.1)
- [ ] **Luna:** Begin content calendar planning for KR5 pieces
