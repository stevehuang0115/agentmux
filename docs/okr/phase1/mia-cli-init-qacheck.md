# CLI Init Gap Resolution — PM QA Check

> **Reviewer**: Mia (Product Manager) | **Date**: 2026-02-24 | **Source**: `sam-week1-exec-status.md` Section 3

---

## 1. Sam's Finding

Sam validated the CLI commands and found:

- **`crewly init` does not exist.** The equivalent command is `crewly onboard`.
- The CLI exposes: `start`, `stop`, `status`, `onboard`, `create-team`, `list-teams`, `add-member`, `config`, `help`.
- README already references `npx crewly onboard` in Quick Start.
- Sam recommends adding `init` as an alias if desired — small change to `cli/src/index.ts`.

---

## 2. Decision Quality Assessment

| Check | Pass/Fail | Notes |
|-------|-----------|-------|
| **Did Sam verify the actual CLI binary?** | PASS | Ran `node dist/cli/cli/src/index.js --help` — output shown with full command list |
| **Is the finding accurate?** | PASS | `init` is absent from command list. `onboard` exists as the setup command. |
| **Did Sam check onboard functionality?** | PARTIAL | Verified command exists and README references it. Did NOT test the actual `onboard` flow end-to-end (known bugs from my onboarding audit still unconfirmed as fixed). |
| **Was the recommendation actionable?** | PASS | Clear next step: add `init` as alias in `cli/src/index.ts`. Small scope, no architecture impact. |
| **Did Sam identify the naming gap vs competitors?** | PASS | Noted that roadmap says `crewly init` but CLI has `onboard` — flagged the discrepancy. |

**Decision quality: PASS (4/5, 1 PARTIAL)**

---

## 3. User Onboarding Impact Assessment

### Current State

| Aspect | Status | Risk |
|--------|--------|------|
| **Discovery**: Can a user figure out how to start? | MEDIUM RISK | `onboard` is a non-standard name. Every competitor uses `init` or `create`: `crewai create`, `npm init`, `npx create-react-app`. Users will try `crewly init` first and get an error. |
| **First-run experience**: Does `crewly onboard` work? | HIGH RISK | 3 known bugs (Gemini package name wrong, template doesn't create team, no tmux check) remain unverified as fixed. Sam's status report says "no changes needed" for open-source essentials but does not confirm onboard bugs are fixed. |
| **Documentation alignment**: Do docs match reality? | PASS | README says `npx crewly onboard` which matches the actual CLI. But roadmap and all planning docs say `crewly init` — creates internal confusion. |
| **Competitor parity**: How does naming compare? | FAIL | `init` is the universal convention: `npm init`, `crewai create`, `git init`, `cargo init`. `onboard` is unique but unintuitive for developers. |

### Recommendation

**Add `crewly init` as the primary command. Keep `onboard` as a hidden alias for backward compatibility.**

Rationale:
- `init` is what developers will try first
- Every competitor and every package manager uses `init` or `create`
- The roadmap, gap matrix, and all 6 planning docs already say `crewly init`
- Renaming `onboard` → `init` aligns docs with code, eliminating confusion
- Effort: trivial — one line in `cli/src/index.ts` to add alias, or rename + alias

---

## 4. Release Risk Assessment

| Risk | Severity | Status | Mitigation |
|------|----------|--------|------------|
| **Users try `crewly init`, get "unknown command" error** | HIGH | OPEN | Add `init` command/alias before public launch |
| **`crewly onboard` has 3 known bugs** | HIGH | OPEN — UNVERIFIED FIX | Sam's report does not confirm these are fixed. Must verify before Phase 2 GO gate. |
| **Internal docs say `init`, CLI says `onboard`** | MEDIUM | OPEN | Rename to `init` resolves both doc and CLI alignment |
| **`onboard` wizard scope unclear for `init` rewrite** | LOW | RESOLVED | Sam confirmed: existing `onboard` code in `cli/src/commands/onboard.ts` is the base. Adding `init` alias or renaming is minimal work. |

---

## 5. Pending Checks (Awaiting Sam Action)

These items cannot be verified until Sam completes the work:

| # | Check | Blocked On | Expected Artifact |
|---|-------|-----------|-------------------|
| P1 | `crewly init` command exists and runs | Sam adds alias or renames `onboard` → `init` | Updated `cli/src/index.ts` |
| P2 | Onboarding bugs fixed (Gemini pkg, template→team, tmux) | Sam implements fixes in `cli/src/commands/onboard.ts` | Test evidence or manual test log |
| P3 | End-to-end test: `npx crewly init` → `crewly start` → dashboard | P1 + P2 complete | Screen recording or terminal log |
| P4 | `--yes` flag for non-interactive mode (CI-friendly) | Sam implements | CLI `--help` shows flag |
| P5 | `--template <name>` flag works with 3 templates | Sam implements F5 templates | `crewly init --template startup-dev` test |

**I will re-run this QA check and update pass/fail once Sam delivers P1-P5.**

---

## 6. Verdict

| Dimension | Rating | Rationale |
|-----------|--------|-----------|
| Sam's analysis quality | GOOD | Accurate CLI verification, honest finding, actionable recommendation |
| Onboarding readiness | NOT READY | Known bugs unconfirmed fixed, `init` command missing, no end-to-end test |
| Release risk | HIGH | If we launch without `crewly init`, first impression fails for every developer |
| Recommended action | **Rename `onboard` → `init` (keep `onboard` as alias) + fix 3 bugs + end-to-end test** | Aligns code with all planning docs. Est. 1-2 days Sam work. |

### Next Steps for Sam (Priority Order)

1. Fix 3 onboarding bugs in `cli/src/commands/onboard.ts`
2. Add `crewly init` as primary command (rename or alias `onboard`)
3. Add `--yes` and `--template` flags
4. Run manual end-to-end test and capture output
5. Commit with test evidence

### Next Step for Mia

- Re-run this QA check once Sam delivers. Update P1-P5 from PENDING to PASS/FAIL.
- Update all planning docs to confirm `init` is the canonical command name.

---

*This document will be updated when Sam's CLI init implementation lands.*
