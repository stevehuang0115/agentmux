# GO Gate Blocker Burndown

> **Author**: Mia (Product Manager) | **Date**: 2026-02-24 | **Tracks**: [`mia-phase1-go-gate.md`](./mia-phase1-go-gate.md) unresolved gates

---

## Active Blockers (2 FAIL + 1 PARTIAL)

### B1: Uncommitted Code — Gate G4

| Field | Value |
|-------|-------|
| **Owner** | Sam |
| **Severity** | CRITICAL — all other work builds on clean state |
| **ETA** | Feb 25 AM (2 hours) |
| **Depends on** | Nothing |
| **What's blocked** | G5 templates, G6 end-to-end test, any new feature work |
| **Definition of done** | `git status` clean on main. `npm run build` exits 0. `npx tsc --noEmit` exits 0. |

**Scope**: 33 files, 1717+ lines. Key changes: Gemini runtime (+454), agent registration (+266), context window monitor (+61), settings, frontend, skills.

**Risk**: If build breaks after commit, Sam must fix before moving to B2. Estimated fix: <1 hour (these changes already passed `tsc --noEmit` per Sam's week1 status).

---

### B2: Team Templates — Gate G5

| Field | Value |
|-------|-------|
| **Owner** | Sam (code) + Mia (template content design) |
| **Severity** | HIGH — `crewly init --template` flag exists but no templates to select |
| **ETA** | Feb 27 EOD (2-3 days) |
| **Depends on** | B1 (commit first for clean state) |
| **What's blocked** | G6 end-to-end demo, Phase 2 GO decision |
| **Definition of done** | 3 dirs in `config/templates/` each with team.json + role prompts + skill assignments. `crewly init --template startup-dev` creates working team. Agents start within 60s. |

**Templates to build**:

| Template | Roles | First Task |
|----------|-------|------------|
| `startup-dev` | Orchestrator + Developer + QA | "Create a hello-world Express API with tests" |
| `content-team` | PM + Writer + Editor | "Draft a blog post about AI agent teams" |
| `solo-dev` | Single agent with all skills | "Review this project's README and suggest improvements" |

**Mia deliverable**: Template content specs (role descriptions, example prompts, skill selections) — deliver to Sam by Feb 25 PM so he can wire them into code on Feb 26-27.

---

### B3: Onboarding Bug Verification — Gate G6

| Field | Value |
|-------|-------|
| **Owner** | Sam |
| **Severity** | MEDIUM — init alias works, but underlying onboard flow has 3 known bugs |
| **ETA** | Feb 26 (4 hours, can overlap with B2) |
| **Depends on** | B1 |
| **What's blocked** | G6 full PASS, end-to-end demo recording |
| **Definition of done** | All 3 bugs verified fixed OR fixes committed. Manual `crewly init` test log captured. |

**Known bugs** (from [`mia-phase1-review.md`](./mia-phase1-review.md) + onboarding audit):

| Bug | File | Fix |
|-----|------|-----|
| Gemini package name wrong (`@anthropic-ai/gemini-cli`) | `cli/src/commands/onboard.ts:199,203` | Change to `@google/gemini-cli` |
| Template selection doesn't create team | `cli/src/commands/onboard.ts` | Call team creation after template pick |
| No tmux detection during onboard | `cli/src/commands/onboard.ts` | Add tmux check, warn if missing |

**Note**: Sam's week1 status says "no changes needed" for open-source essentials but does NOT mention these bugs. They may already be fixed in the uncommitted 1717 lines — Sam should verify after B1 commit.

---

## Burndown Schedule

```
Feb 25 (Day 1)
├─ AM: Sam commits all code (B1) ← CRITICAL PATH START
├─ AM: Sam verifies build + tsc clean
├─ PM: Sam checks if onboard bugs are fixed in committed code (B3)
├─ PM: Mia delivers template content specs to Sam (B2 prep)
└─ EOD checkpoint: B1 should be DONE

Feb 26 (Day 2)
├─ AM: Sam fixes any remaining onboard bugs (B3)
├─ AM: Sam starts template implementation (B2)
├─ PM: Sam continues templates — startup-dev first (highest value)
└─ EOD checkpoint: B3 should be DONE, B2 in progress (1/3 templates)

Feb 27 (Day 3)
├─ AM: Sam finishes content-team + solo-dev templates (B2)
├─ PM: Sam runs end-to-end test: crewly init --template startup-dev → crewly start
├─ PM: Mia re-runs GO gate scoring
└─ EOD checkpoint: B2 should be DONE, G6 should be PASS
```

---

## Daily Check Criteria

### Feb 25 EOD — Day 1 Check

| Question | Expected Answer | If NO |
|----------|----------------|-------|
| Is `git status` clean? | Yes (B1 done) | ESCALATE — all Day 2-3 work blocked |
| Does `npm run build` pass? | Yes | Sam fixes build before anything else |
| Are onboard bugs confirmed fixed or identified? | Yes (B3 assessed) | Sam adds bug fixes to Day 2 AM |
| Did Mia deliver template specs? | Yes | Mia delivers by Day 2 AM latest |

### Feb 26 EOD — Day 2 Check

| Question | Expected Answer | If NO |
|----------|----------------|-------|
| Are all 3 onboard bugs fixed and committed? | Yes (B3 done) | Sam finishes Day 3 AM — delays templates |
| Is at least 1 template working? | Yes (startup-dev) | Reduce scope: ship 1 template, defer 2 |
| Does `crewly init --template startup-dev` create a team? | Yes | Debug — this is the critical path |

### Feb 27 EOD — Day 3 Check (STOP/GO)

| Question | Expected Answer | If NO |
|----------|----------------|-------|
| Are 3 templates in `config/templates/`? | Yes (B2 done) | Ship with 1-2 templates — acceptable for GO |
| Does end-to-end flow work? | Yes (G6 full PASS) | Identify specific failure, fix or scope-reduce |
| GO gate score? | 6/6 or 5/6 | See STOP/GO decision below |

---

## STOP/GO Checkpoint — Feb 27 EOD

### GO (proceed to Phase 2 prep)

Score 5/6 or 6/6. Specifically:
- G4 (committed): MUST be PASS
- G5 (templates): At least 1 working template acceptable (2-3 preferred)
- G6 (end-to-end): MUST be PASS for at least 1 template path

**Action if GO**: Mia writes Phase 2 launch plan. Luna starts blog publication. Sam begins P1 features (LLM adapter F6).

### HOLD (extend Phase 1 by 3 days)

Score 4/6. Specifically:
- G4 still FAIL (code not committed) → CRITICAL — investigate why Sam is blocked
- G5 still FAIL (0 templates) → Sam needs 2 more days, acceptable delay
- G6 still FAIL (end-to-end broken) → Debug session required, Mia + Sam

**Action if HOLD**: Extend to Mar 3. No Phase 2 work starts. Sam focuses exclusively on G4/G5/G6.

### STOP (re-scope Phase 1)

Score ≤3/6 after 3 days of focused execution.

**Action if STOP**: Escalate to Steve. Likely cause: architectural issue in onboard/init flow or fundamental blocker not yet surfaced. Mia produces revised scope document within 24h.

---

## Blocker Status Tracker

Updated by Mia at each daily check.

| Blocker | Feb 25 | Feb 26 | Feb 27 |
|---------|--------|--------|--------|
| B1: Commit code | _pending_ | | |
| B2: Templates | _pending_ | | |
| B3: Onboard bugs | _pending_ | | |
| **Gate score** | _/6_ | _/6_ | _/6_ |
| **Verdict** | | | GO / HOLD / STOP |

---

*This document is the daily standup reference for Feb 25-27. Mia updates the tracker table at each EOD checkpoint.*
