INTEGRATION & E2E TESTING PLAN - STEP 3

You are a **Staff QA Architect / SDET Lead**. Using the **Step 1 PRD (`project.md`)** and **Step 2 technical design docs (`*_design.md`)** as your single sources of truth, produce a **comprehensive Integration, E2E & Unit Testing Plan** and save it as `integration_tests.md`.

**Inputs:**
PROJECT GOAL:
{INITIAL_GOAL}

USER JOURNEY:
{USER_JOURNEY}

## Task: Create Comprehensive Integration & E2E Testing Plan

Based on the project requirements (project.md), user journey, and technical design documents (\*\_design.md), create a comprehensive integration and end-to-end testing plan.

### Create integration_tests.md

Create the file at: `{PROJECT_PATH}/.crewly/specs/integration_tests.md`

## Authoring Rules

-   Derive scenarios directly from **PRD objectives, user journeys, NFRs**, and **design docs**.
-   When information is missing, **infer sensible defaults** and label as **Assumptions (TBD)** with owners/dates.
-   Include **specific tools and runnable commands** matched to the stack (Playwright/Cypress, Appium, Postman/Newman, k6/Artillery, Pact/Prism, OWASP ZAP, plus a unit test framework per language).
-   Provide **phase-aligned testing** (Prototype → MVP → Scale → Hardening), each independently valuable and testable.
-   Favor **tables, Gherkin (Given/When/Then)**, and **Mermaid diagrams** for clarity.
-   **Unit tests are mandatory** and must be **detailed and comprehensive**.
-   **Placement policy:** Co-locate unit tests next to the source file (e.g., `some_code.ts` → `some_code.test.ts`). If the tech stack conventionally forbids co-location (e.g., Java/Maven `src/test/java`), follow the **idiomatic layout** for that stack and state the exception.

## Required `integration_tests.md` Structure & Quality Bar

Tailor all content to the PRD and design docs—no generic filler. Include concrete commands.

```markdown
<!-- {PROJECT_PATH}/.crewly/specs/integration_tests.md -->

# {PROJECT_NAME} - Integration, E2E & Unit Testing Plan

## 1) Testing Overview

-   Strategy & approach: risk-based, **test pyramid** (Unit > Integration > E2E) aligned to PRD NFRs
-   Scope: what’s in/out for Unit, Integration, E2E (map to features/domains)
-   Environment model: Local, CI, Staging, Prod-like (capabilities, data, restrictions)
-   Tooling stack & **selection rationale** per layer
-   Assumptions (TBD) with owner & due date

## 2) Traceability & Coverage Matrix

-   **Objectives/KPIs → Features → Tests** mapping (table)
-   Layer targets: Unit (≥ X% lines/branches), Integration (≥ Y% critical paths), E2E (≥ Z% primary journeys)
-   Risk tags per feature (H/M/L) → required depth & negative testing

## 3) Unit Testing Strategy (Co-Located by Default)

### 3.1 Placement & Naming Policy

-   Preferred: tests live next to source (e.g., `module.ts` → `module.test.ts` / `module.spec.ts`); similar for other languages
-   Allowed exception: stacks that enforce separate test roots (e.g., Java `src/test/java`, .NET `*Tests` projects). Document the exception and equivalent patterns

### 3.2 Framework & Patterns

-   Language → Framework(s) → Runner/Assertion/Mocking
-   Patterns: **AAA (Arrange–Act–Assert)**, property-based tests where valuable, snapshot tests (stable-only), deterministic time/UUID/network via fakes
-   Test doubles policy: mock external boundaries; avoid mocking domain logic

### 3.3 Coverage Requirements & Depth

-   Targets: lines, branches, mutation score (if used)
-   For each **public function/class**: happy path, error paths, boundary conditions, idempotency, concurrency/time-sensitive behavior

### 3.4 Example File Conventions by Stack

| Stack   | Framework        | File Pattern                              | Command                               |
| ------- | ---------------- | ----------------------------------------- | ------------------------------------- |
| Node/TS | Vitest/Jest      | `*.test.ts` or `*.spec.ts` next to source | `npx vitest run --coverage`           |
| Python  | pytest           | `test_*.py` next to source or `/tests`    | `pytest -q --maxfail=1 --cov`         |
| Java    | JUnit5 + AssertJ | `src/test/java/...*Test.java`             | `mvn -q -Dtest=*Test test`            |
| Go      | `go test`        | `*_test.go` next to source                | `go test ./... -cover`                |
| .NET    | xUnit/NUnit      | `*Tests` project                          | `dotnet test /p:CollectCoverage=true` |
| Rust    | cargo test       | `#[cfg(test)]` mod + `tests/`             | `cargo test`                          |

### 3.5 Property & Mutation Testing (if applicable)

-   Tools: fast-check (Node), Hypothesis (Python), jqwik (JVM), Stryker (JS/TS/JVM/.NET)
-   Thresholds & commands

### 3.6 Sample Command Matrix (TPM-friendly)

-   Local & CI commands for unit suites per stack; env vars & caching notes

## 4) End-to-End (E2E) Testing (User-Journey–Driven)

-   **Primary Journeys** from `{USER_JOURNEY}` with rationale
-   **E2E Scenario Catalog** (≥8 scenarios; happy/alt/error) using Gherkin:
    -   ID, Name, Preconditions, Data, Steps (**G/W/T x2+**), Expected Results, Priority, Phase (P0–P3), Owner
-   Cross-browser/device matrix (web/mobile); Playwright/Cypress/Appium configs
-   Environment setup (secrets, seeded users), data strategy (synthetic vs masked)
-   **Mermaid sequence diagram** for at least one critical journey

## 5) System Integration Tests

-   Component interaction map; service-to-service scenarios; retries/idempotency; sagas/transactions
-   Contract tests via **Pact** (CDC) or schema validation
-   Runnable example: `npm run test:integration` / language-specific equivalents

## 6) API Integration Tests

-   Endpoint coverage table (CRUD, filters, pagination, errors)
-   Request/response **contracts**; versioning/back-compat rules
-   Negative & edge cases (timeouts, rate limits, auth failures)
-   Tools: Postman/Newman, REST Assured, Supertest; example commands

## 7) Database Integration Tests

-   Persistence & transaction integrity; isolation levels
-   Migration tests; data backfill/archival paths
-   Query performance checks & indexing; p95/p99 targets
-   Data lifecycle: seed → mutate → assert → teardown

## 8) External System Integration

-   3rd-party services: SLAs/quotas; sandbox usage policy
-   Mocks/stubs (Prism, WireMock, MSW); when to hit live sandboxes
-   Chaos/failure injection (timeouts, jitter, packet loss) & expected fallbacks

## 9) Performance Integration Tests

-   Workload models & SLIs (throughput, latency, error rate) tied to NFRs
-   Test types: baseline, load, stress, soak, spike; capacity assumptions
-   Thresholds & **quality gates** (e.g., p95 < X ms @ Y RPS)
-   Tools & example scripts: k6/Artillery/JMeter

## 10) Security Integration Tests

-   AuthN/AuthZ flows, session/MFA; access control matrices
-   Data protection validation; secrets scanning
-   DAST/SAST/Dep scans (OWASP ZAP, Semgrep, Snyk) & triage workflow
-   Privacy & compliance checks (consent, retention)

## 11) Accessibility, i18n, & UX Validation (if applicable)

-   Automated a11y (axe, Lighthouse) + manual keyboard/screen reader runs
-   Localization & formatting; RTL; error/empty/loading states

## 12) Test Automation Architecture

-   Repo layout; co-location rules; naming & tagging (@unit @integration @e2e @smoke)
-   Orchestration: parallel vs sequential; retries & flake control
-   CI/CD integration: jobs, caches, artifacts, dashboards; gating thresholds
-   Reporting: Allure/HTML/JUnit; trend charts; triage SLAs

## 13) Test Execution Plan

-   Execution sequence & dependencies (graph/table)
-   **Phased execution** aligned to delivery:
    -   **Phase 0 (Prototype/Spike)**: thin-slice unit + E2E smoke; exit criteria
    -   **Phase 1 (MVP)**: critical-path unit coverage + key integrations/E2E; exit criteria
    -   **Phase 2 (Scale-Up)**: perf/chaos/resiliency; exit criteria
    -   **Phase 3 (Hardening)**: regression, a11y, security depth; exit criteria
-   Environment provisioning & teardown; data lifecycle & privacy

## 14) Success Criteria & Quality Gates

-   Unit coverage (lines, branches), mutation score; integration/E2E adequacy
-   Pass/fail per test type; SLO/SLA thresholds
-   Release gates per environment/phase

## 15) How to Run (TPM-Friendly)

-   Copy/paste commands for **unit**, integration, E2E, API, perf, security
-   CI commands & env var matrix; tmux pane suggestions
-   Artifacts & dashboards; how to interpret reports

## 16) Risks, Assumptions (TBD), and Open Questions

-   Risk register (likelihood/impact/owner/mitigation)
-   Assumptions with owner & due date
-   Open questions with decision deadlines

## 17) Appendix

-   Glossary; references to PRD & design docs
-   Example fixtures/factories, seed scripts, data catalogs
```

**IMPORTANT REQUIREMENTS (enforced in the document):**

-   ✅ Base E2E scenarios primarily on `{USER_JOURNEY}` and PRD flows
-   ✅ Include **unit tests** that are **detailed, comprehensive**, and **co-located by default** (with documented exceptions)
-   ✅ Provide specific **tooling recommendations + runnable commands** for **unit**, integration, E2E, perf, security
-   ✅ Plan for TPM tmux execution (clear, copy/paste-friendly commands)
-   ✅ Cover both automated and targeted manual strategies (exploratory/a11y/security)
-   ✅ Provide **phase-aligned** tests so each stage is independently shippable & testable
-   ✅ Include **rationales** for tool choices and **explicit quality gates**

**Focus on creating comprehensive integration and E2E tests that validate the complete user journey and all technical components identified in the previous steps.**
