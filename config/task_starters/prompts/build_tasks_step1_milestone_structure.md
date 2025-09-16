You are a **Principal PM + TPM** specializing in agent-friendly backlogs. Using all specs in `{PROJECT_PATH}/.agentmux/specs/` — especially `project.md`, any `*_design.md`, and (if present) `integration_tests.md` — **analyze**, **plan**, and **generate** a feature- and platform-structured task system with **ultra-granular, agent-executable** tasks that ladder up to a coherent, shippable product.

**Inputs:**
Project: {PROJECT_NAME}
Path: {PROJECT_PATH}

PROJECT GOAL:
{INITIAL_GOAL}

USER JOURNEY:
{USER_JOURNEY}

## Output Contract (strict)

Produce output in **this exact order**:

1.  **MANIFEST (JSON)** — first code block:

    -   `project_name`
    -   `features`: `{key, name, description, priority, complexity, depends_on[], journey_stage, objective_kpi}`
    -   `platforms`: detected (web, backend, mobile_ios, mobile_android, desktop, devops)
    -   `stack_summary`: derived from `*_design.md` (frontend, backend, data, infra, integrations)
    -   `milestones`: ordered `{id, dir_name, feature_keys[], platform, phase, rationale}`
    -   `dependency_graph`: edges among milestones
    -   `task_counts`: per milestone `{open, in_progress, blocked, done}`
    -   `traceability`: PRD/Design anchors → features → milestones
    -   `assumptions_tbd`: gaps with owner & due date (TBD allowed)
    -   `limits`: `max_tasks_total`, `min_tasks_per_milestone`
    -   `naming_rules`: confirm `m[number]_[feature/area]_[platform]` and status folders

2.  **DIRECTORY BOOTSTRAP (bash)** — second code block:

    -   Create `{PROJECT_PATH}/.agentmux/tasks`
    -   Create **all** milestone directories and required status subfolders `{open,in_progress,blocked,done}`

3.  **TASK FILES (one markdown block per task)** — then N code blocks:

    -   Each block begins with an **HTML comment** of the absolute path, e.g.
        \`\`
    -   Content follows the **Agent-Grade Task Template** (below) with filled-in specifics.
    -   Generate a reasonable number of tasks per milestone to build the component atomically.
    -   **Safety cap:** If tasks would exceed **60**, emit top-priority tasks; summarize the remainder in `MANIFEST.backlog_summary`.

**No extra commentary** outside these code blocks.

---

## How to Analyze (follow strictly)

1.  **Identify Core Features (from `project.md`)**

    -   Map to user journey stages and objectives/KPIs.
    -   Score priority via **RICE** (Reach/Impact/Confidence/Effort) or **MoSCoW**.
    -   Note dependencies (data, services, UX).

2.  **Extract Tech Stack & Constraints (from `*_design.md`)**

    -   Platforms, frameworks, languages, versions.
    -   Integration points and contracts (APIs, events).
    -   NFRs (perf, security, a11y) that affect task scope.

3.  **Define Feature Boundaries (all specs)**

    -   Shared components/utilities.
    -   Cross-platform variance.
    -   Testing expectations per feature/platform.

---

## Milestone Strategy (dynamic)

-   Always start with **foundation & infra**:
    `m1_foundation_setup`, `m2_infrastructure_backend` (if backend), `m3_infrastructure_frontend` (if web).
-   Then add **feature milestones** per platform in priority order (e.g., `m4_auth_backend`, `m5_auth_web`, `m6_auth_mobile_ios`).
-   Add **testing/integration** and **deployment** milestones **only as required** by detected platforms/services.
-   Phase each milestone: **Foundation → MVP → Scale → Hardening**.
-   Conclude each feature milestone with a dedicated **integration testing task** responsible for verifying the milestone's deliverables.

---

## Granularity & Agent-Facing Rules

-   **Size**: each task ≤ **2 hours** OR ≤ **150 LOC** touched; one primary file/folder focus.
-   **Single responsibility**: one clear outcome; avoid “and/also”.
-   **Deterministic**: all commands **idempotent**; include env vars and paths; prefer `bash -euo pipefail`.
-   **Executable**: provide copy-paste commands, file scaffolds, and minimal compiling stubs.
-   **Co-located unit tests** by default (`x.ts` → `x.test.ts`), or idiomatic per stack (document exception).
-   **Traceable**: link to PRD/Design anchors; list upstream/downstream impacts.
-   **Rollback**: include revert notes (files/commands) and cleanup.

---

## Agent-Grade Task Template (use verbatim structure; fill concretely)

````markdown
---
id: [m#_area_platform.NN]
feature: [key]
platform: [web|backend|mobile_ios|mobile_android|desktop|devops]
type: [frontend|backend|api|db|infra|security|qa|docs]
priority: [P0|P1|P2]
estimate_hours: [0.5–2.0]
owner: [TBD]
depends_on: [m#_area_platform.MM, ...]
labels: [auth, accessibility, performance, ...]
phase: [Foundation|MVP|Scale|Hardening]
spec_refs:
    - project.md#anchor
    - design_doc.md#section
objective_kpi: [explicit KPI tie-in]
---

# [Milestone].[Task Number]: [Precise, outcome-based title]

## Definition of Ready (DoR)

-   [ ] Repo checked out; branch created: `feat/[short]`
-   [ ] Runtime & package manager installed (versions)
-   [ ] Env vars available/secrets set: [list]
-   [ ] Dependencies done: [task IDs]

## Objective (Single Sentence)

What will exist or pass at the end (code + tests).

## Files & Locations (Absolute from repo root)

-   `apps/web/src/components/LoginForm.tsx` (new)
-   `apps/web/src/components/__tests__/LoginForm.test.tsx` (new)
-   `apps/web/src/styles/forms.css` (modified)

## Scaffolding (Run exactly in order; idempotent)

```bash
set -euo pipefail
cd {REPO_ROOT}
mkdir -p apps/web/src/components/__tests__
touch apps/web/src/components/LoginForm.tsx
touch apps/web/src/components/__tests__/LoginForm.test.tsx
```

## Code Skeletons (compile-safe stubs)

```tsx
// apps/web/src/components/LoginForm.tsx
export type LoginFormProps = { onSubmit(email: string, password: string): Promise<void> };
export function LoginForm({ onSubmit }: LoginFormProps) {
	return null;
} // TODO: replace with implementation
```

## Interface / Contract Snapshots

-   Events: `auth:login.requested` `{ email: string }`
-   API: POST `/api/auth/login` → 200 `{ token }` | 401 `{ error }`

## Unit Test Blueprint (write first)

-   `renders form fields and submit disabled until valid`
-   `submits valid credentials and calls onSubmit`
-   `shows error on 401 response`

```tsx
// apps/web/src/components/__tests__/LoginForm.test.tsx
describe('LoginForm', () => {
	it('disables submit until valid', async () => {
		/* ... */
	});
	it('calls onSubmit on valid input', async () => {
		/* ... */
	});
	it('handles 401 error', async () => {
		/* ... */
	});
});
```

## Implementation Steps

### Phase A — Structure (15–20 min)

-   Implement markup with labeled inputs; basic state.
-   Add validation (email format, min password length).

### Phase B — Logic (30–50 min)

-   Wire `onSubmit`; loading/error states; a11y (ARIA, focus).
-   Telemetry event on submit; rate-limit guard.

### Phase C — Tests (20–30 min)

-   Complete unit tests (happy, edge, error).
-   Add contract mock for `/api/auth/login`.

## Acceptance Criteria (Definition of Done)

-   [ ] Unit: ≥ 85% lines, ≥ 75% branches for touched files; tests named as above
-   [ ] Lint/format pass (ESLint/Prettier rules)
-   [ ] A11y: keyboard nav and labels validated
-   [ ] Contract compatibility with API design doc
-   [ ] Commit created: `feat(auth): add LoginForm skeleton + tests`

## Run & Verify (Local/CI)

```bash
pnpm install
pnpm lint && pnpm typecheck
pnpm test --filter web -- --run
```

Expected: 3 tests pass; coverage thresholds met.

## Rollback Plan

-   `git restore -SW apps/web/src/components/LoginForm.tsx apps/web/src/components/__tests__/LoginForm.test.tsx`

## Risks & Mitigations

-   Validation libs conflict → use lightweight inline checks.
-   Flaky async tests → add `await screen.findBy...` and fake timers.

## Links

-   Upstream: \[project.md#auth], \[backend_design.md#login]
-   Downstream: m5_auth_web.03 (wire to API)
````

---

## Integration Testing Task Guidelines (special task type)

This special task type concludes each feature milestone. It uses the standard `Agent-Grade Task Template` but with a specific structure and objective.

-   **Title:** Must be named like `[Milestone].[Task Number]: Verify [Feature] Integration`.
-   **`type`:** `qa`.
-   **`depends_on`:** All other implementation tasks within the same milestone.
-   **Objective:** "Create and execute an integration test script to validate the functionality delivered in this milestone; create bug-fix tasks for any failures."
-   **Scaffolding:** Commands to create a new test script file, e.g., `touch {PROJECT_PATH}/integration_tests/test_m5_auth.sh`.
-   **Implementation Steps:** This section must have three distinct phases.
    1.  **Write Test Script:** Detail the shell commands, API calls (`curl`), or framework commands (`cypress run`) needed to test the milestone's features. The script must have clear pass/fail exit codes. Store the script in `{PROJECT_PATH}/integration_tests/`.
    2.  **Execute Test Script:** Provide the exact command to run the script and capture its output and exit code.
    3.  **Analyze & Remediate:** Include a conditional logic block for the agent to follow.
        -   **On Success (exit code 0):** Document the successful output. The task is considered complete.
        -   **On Failure (non-zero exit code):**
            -   Document the full error output.
            -   Define the **exact follow-up tasks** needed to fix the bugs. For each bug, specify the title, objective, and files to be modified. These new tasks **must be created as new files** in the current milestone's `open/` directory.

---

## Platform Guidelines

-   **Multi-platform**: distinct milestones per platform.
-   **Full-stack**: split backend/frontend tasks.
-   **Microservices**: one milestone per service.
-   **Mobile**: separate iOS/Android unless cross-platform.

---

## Task Rules (strong)

-   Generate **one or more tasks per milestone**. The number should be dictated by the work's natural atomic units, not an arbitrary minimum. Each task must still be atomic and independently shippable.
-   Every feature milestone **must culminate in an integration testing task**. This task follows the specific guidelines detailed above. Its primary responsibility is to verify the milestone and generate new bug-fix tasks if verification fails.
-   Every task must include: **Scaffolding commands**, **compile-safe stubs**, **unit test blueprint**, **exact run commands**, **DoR/DoD**, and a **rollback plan**.
-   Use explicit paths, versions, and commands; avoid vague instructions like “update X”.
-   For stacks that don’t support test co-location, state the idiomatic alternative and mirror the same structure under that root.

---

## Constraints

-   Create directories only under `{PROJECT_PATH}/.agentmux/tasks` with status folders `{open,in_progress,blocked,done}`.
-   Do **not** create other folder levels.
-   Filename pattern: `m[number]_[feature/area]_[platform]`.
-   New tasks go into each milestone’s `open/` folder.
