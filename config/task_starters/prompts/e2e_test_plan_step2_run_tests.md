**E2E TEST PLAN GENERATION - STEP 2**

**Role:** You are a Senior QA Architect & TestOps engineer. Using the artifacts from **STEP 1** (evaluation scripts under `{PROJECT_PATH}/e2e_tests/` and `e2e_evaluation_instructions.md`) and the plan from **STEP 2**, **execute** the evaluation scripts to cover all user journeys, capture results/artifacts, and produce an evidence-based report plus improvement tasks. Show your reasoning **only** via explicit criteria, tables, and bullet points (no hidden chain-of-thought).

**Authoritative Inputs:**

-   **Project:** `{PROJECT_NAME}`
-   **Repo Path:** `{PROJECT_PATH}`
-   **Specs:** `{PROJECT_PATH}/.agentmux/specs/` (incl. `project.md`, user journeys)
-   **Evaluation Harness:** `{PROJECT_PATH}/e2e_tests/` (scripts + `e2e_evaluation_instructions.md`)
-   **Envs/Secrets:** `.env` / CI variables referenced by the harness

**Deliverables (must create all):**

1.  `{PROJECT_PATH}/e2e_tests/e2e_evaluation_report.md`
2.  `{PROJECT_PATH}/README.md` — **only if not exists**; include “How to run E2E evaluation” instructions
3.  Improvement tasks under `{PROJECT_PATH}/.agentmux/tasks/m*_e2e_tests_improvement/` with subfolders: `open/`, `in_progress/`, `blocked/`, `done/` (use the next milestone, e.g., `m1_e2e_tests_improvement`)

**Hard Rules:**

-   **Execute** the scripts exactly as described by `e2e_evaluation_instructions.md`. If any command is missing/ambiguous, use safe defaults documented below and mark **Assumptions**.
-   Cover **all** user journeys defined in specs (primary + key alternates). If a journey has no script, record as **Missing Coverage**.
-   For every failure, store evidence (logs, traces, screenshots, videos) and add a **Finding** with **Expect vs. Actual**; create a matching **improvement task**.
-   Never overwrite existing README content; only append or update the E2E evaluation instruction.

---

## Execution Plan

### 1\) Pre-Run Validation

-   **Clean Slate:** Remove `{PROJECT_PATH}/e2e_tests/e2e_evaluation_report.md` if it exists to ensure a fresh report.
-   Verify presence of `{PROJECT_PATH}/e2e_tests/e2e_evaluation_instructions.md` and at least one `*_e2e_tests.*` script.
-   Load `.env` if present; resolve required envs from the instructions (`BASE_URL`, `API_BASE_URL`, credentials, `BROWSERS`, etc.).
-   Ensure services are reachable (e.g., `curl $BASE_URL/health` or framework health checks). If not, mark **Env Blocker** and continue to next runnable area.

### 2\) Script Discovery & Command Matrix

Read `e2e_evaluation_instructions.md`. When unspecified, use these **fallback commands**:

| Script Pattern                         | Runner (fallback)                                  | Notes                                          |
| -------------------------------------- | -------------------------------------------------- | ---------------------------------------------- |
| `*.ts`                                 | `npx ts-node <script>`                             | Playwright/Web/API/desktop/terminal TS harness |
| `*.js`                                 | `node <script>`                                    | Node harness                                   |
| `*.py`                                 | `pytest <script>` **or** `python <script>`         | Prefer pytest if tests present                 |
| `*.java`                               | `mvn -Dtest=<Class>#<method> test` / `gradle test` | Selenium/Playwright-Java                       |
| Mobile wrapper (`mobile_e2e_tests.ts`) | `node <script>`                                    | Delegates to Appium/WDIO per env               |

> Run **sequentially** by default; enable parallelism only if the harness supports it and artifacts remain traceable.

### 3\) Run & Capture

-   For each script:
    -   Start with **headless** (unless instructions say otherwise); set timeouts from instructions or sensible defaults.
    -   Capture **stdout/stderr**, **exit code**, and collect artifacts to `e2e_tests/artifacts/`.
    -   If JUnit/Allure/HTML reports are produced, index their paths for the report.
-   Map each executed check to **User Journey IDs** from specs; anything unmapped → flag and note.

### 4\) Post-Run Analysis

-   Classify results per journey: **Pass / Fail / Skipped / Missing**.
-   For **Fail**: extract minimal reproducible evidence (error message, step name, screenshot/trace path) and fill **Expect vs. Actual**.
-   **Specifically identify UI/UX failures:**
    -   **Visual Regression:** Look for artifacts like `*-diff.png` images or specific failure logs from the test runner (e.g., "Error: Screenshot comparison failed").
    -   **Accessibility:** Look for test failures that output lists of violations (e.g., from Axe-core).
-   For **Missing**: confirm via specs/code that no script exists; propose coverage task.

---

## Output 1 — `{PROJECT_PATH}/e2e_tests/e2e_evaluation_report.md`

Populate exactly with this structure:

```markdown
# E2E Evaluation Report — {PROJECT_NAME}

**Path:** {PROJECT_PATH}/e2e_tests/e2e_evaluation_report.md
**Prepared By:** Senior QA Architect (Gemini)
**Date:** <<YYYY-MM-DD>>

## 0) Executive Summary

-   **Overall Status:** <<Green | Yellow | Red>> — rationale
-   **Scope:** Functional, **Visual, and Accessibility** checks across all user journeys from specs; scripts executed from `e2e_tests/`
-   **Environment:** <<env name/URL, versions>>
-   **Pass Rate:** <<x%>> (<<passed>> / <<total>>)
-   **Top Risks:** <<3–5 bullets, including any major visual regressions or critical a11y blockers>>

## 1) Method & Evidence

-   **Instructions Used:** `e2e_tests/e2e_evaluation_instructions.md`
-   **Scripts Executed:** <<list with command used and exit code>>
-   **Artifacts Index:** <<paths to traces/screenshots/reports>>
-   **Assumptions:** <<only if commands/envs were inferred>>

## 2) Results by User Journey

| Journey ID  | Title    | Status                    |  Duration | Artifacts | Notes                                                           |
| ----------- | -------- | ------------------------- | --------: | --------- | --------------------------------------------------------------- |
| E2E-XXX-001 | <<name>> | Pass/Fail/Skipped/Missing | <<mm:ss>> | <<links>> | <<summary; **note if failure is Visual, A11y, or Functional**>> |

## 3) Findings — Expect vs. Actual (Failures & Issues)

### Finding F-00X — <<Concise Title>>

-   **Journey/Area:** <<ID & name>>
-   **Finding Type: Functional | Visual Regression | Accessibility**
-   **Expectation (specs):** <<what should happen, e.g., "UI matches baseline", "No WCAG violations">>
-   **Actual (run):** <<what happened. **For visual, describe the change. For a11y, list top 1-3 violations.**>>
-   **Impact:** <<user/system impact>>
-   **Evidence:** <<log excerpt + artifact paths to **diff images** or **full a11y reports**>>
-   **Root Cause Hypothesis:** <<brief>>
-   **Proposed Fix:** <<one-liner, e.g., "Fix CSS bug" or "**Approve visual change and update baseline**">>
-   **Linked Task:** `./../.agentmux/tasks/m*/e2e_tests_improvement/open/IMPR-00X_<slug>.md`

> Repeat for each failure or defect category (env/config, data, flakiness, docs).

## 4) Coverage Gaps

| Journey ID  | Expected Coverage | Actual  | Gap  | Recommendation          |
| ----------- | ----------------- | ------- | ---- | ----------------------- |
| E2E-YYY-002 | smoke+negative    | Missing | High | Add spec + data seeding |

## 5) CI/CD & Data Observations

-   **CI Hooks:** <<present/absent, duration, sharding, retries>>
-   **Data/Fixtures:** <<seeding/masking status>>
-   **Env Parity:** <<dev/stage/prod differences>>

## 6) Recommendations & Next Steps

-   **Immediate (≤ 1 sprint):** <<quick wins>>
-   **Near-Term:** <<architecture/coverage>>
-   **Longer-Term:** <<stability/device coverage>>

## 7) Appendices

-   **Raw Logs Index**, **Assumptions**, **References (specs & configs)**
```

---

## Output 2 — `{PROJECT_PATH}/README.md`

If a README does **not** exist, create one with a minimal project header and this section (otherwise update it):

```markdown
## E2E Evaluation — How to Run

Scripts live in `e2e_tests/`. See `e2e_tests/e2e_evaluation_instructions.md` for required env vars and platform specifics.

### Quick Commands (examples; prefer the instructions file if they differ)

-   Run all tests: `npx ts-node e2e_tests/web_e2e_tests.ts`
-   **Update visual baselines (after an intentional UI change):** `npx playwright test --update-snapshots`

Artifacts (traces/screenshots/videos) are written to `e2e_tests/artifacts/`.
```

> If README exists, **ONLY modify the E2E evaluation part**.

---

## Output 3 — Improvement Tasks

Create a new milestone folder if none exists:
`{PROJECT_PATH}/.agentmux/tasks/m1_e2e_tests_improvement/` with subfolders `open/`, `in_progress/`, `blocked/`, `done/`.

For **each Finding (F-00X)** in the report, create a matching task in `open/`:

**Task file:** `{PROJECT_PATH}/.agentmux/tasks/m1_e2e_tests_improvement/open/IMPR-00X_<kebab-title>.md`

**Template (fill completely):**

```markdown
# IMPR-00X — <Concise Title>

**Status:** Open
**Severity:** P0 | P1 | P2 | P3
**Category:** Missing Coverage | Functional Failure | **Visual Regression** | **Accessibility** | Flakiness | Env/Config | CI/CD | Data/Fixtures | Docs/DevEx
**Related Finding:** F-00X (see `e2e_tests/e2e_evaluation_report.md`)
**User Journey IDs:** E2E-...

## Context

-   **Expectation (specs):** <quote/summary>
-   **Actual (run):** <error / behavior>
-   **Impact:** <user/system impact>

## Repro Steps

1.  Command used: `<exact command>`
2.  Env vars: `<list>`
3.  Preconditions: `<seed/state>`
4.  Steps to observe failure

## Detailed Fix Plan

-   [ ] Code/config changes (paths/files)
-   [ ] Test data/fixtures updates
-   [ ] Update visual baseline screenshots (if change is intentional)
-   [ ] Test spec(s) to add/update
-   [ ] CI: retries/sharding/timeout changes
-   [ ] Owner + estimate

## Acceptance Criteria

-   [ ] Passing run for journey `<ID>` with artifacts attached
-   [ ] No regressions in related journeys
-   [ ] CI green on PR & nightly

## Dependencies

-   `<blocked by / requires>`

## References

-   Spec: `{PROJECT_PATH}/.agentmux/specs/<file>.md`
-   Artifacts: `e2e_tests/artifacts/<files>`
```

> If **no failures** occurred but gaps exist, create **Missing Coverage** tasks accordingly.

---

## Safe Defaults & Edge Handling

-   **Timeouts:** Default 60s per navigation/API call unless instructions specify otherwise.
-   **Headless:** `HEADLESS=true` by default; flip to debug locally.
-   **Retries:** If supported, `retries=1` for CI; always collect traces on retry.
-   **Secrets:** Never print secrets to logs; rely on CI masked vars.
-   **Partial Runs:** If a script fails early, continue with remaining scripts and record partial coverage.

---

## What You Return

-   The **full content** for `e2e_evaluation_report.md`.
-   The **updated README.md** with instructions for user to start testing.
-   One **task file per finding** in the milestone folder with detailed fix plans.
