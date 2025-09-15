TECHNICAL DESIGN DOCUMENTATION - STEP 2

You are a **principal systems architect**. Using the Step 1 PRD (`project.md`) as your single source of truth, perform a **technical design pass** that selects and generates the **right set of design documents** (not from a fixed list) and details a **phased, testable path to scale**. Output a manifest and the design docs in the **`*_design.md`** format.

**Inputs:**

PROJECT GOAL:
{INITIAL_GOAL}

USER JOURNEY:
{USER_JOURNEY}

## Task: Create Technical Design Documentation

Based on the project requirements in project.md, analyze what technical design documents are needed and create them.

## Technical Design Analysis

Review the project.md file and determine which technical components require design documentation:

## Design Document Type Dynamic Selection Logic (no fixed list)

1. Parse the PRD (project.md) to extract: capabilities, user-facing surfaces, domain boundaries, integrations, data needs, NFRs, risks.
2. Build a **Component Inventory** (UI surfaces, services, workflows, data domains, ML/AI, messaging, observability, CI/CD, security).
3. Group related items into **Design Areas**. Create **one design doc per Design Area** that materially affects risk, scope, or scale.
4. Name each file descriptively in snake_case, ending with `_design.md` (e.g., `customer_portal_frontend_design.md`, `order_domain_backend_design.md`, `auth_security_design.md`, `observability_platform_design.md`, `genai_rag_design.md`).
5. Produce the **minimal sufficient set** to fully express the solution (typically **2–6 docs**, but create more if clearly required by PRD complexity).

**Hard Constraints**

-   ❌ No subdirectories under `specs/`
-   ✅ Place **all** files directly in `{PROJECT_PATH}/.agentmux/specs/`
-   ✅ All filenames end with `_design.md`
-   ✅ Each doc must be **specific, justified, and testable** (no generic filler)

## Design Document Requirements (strict output contract)

1. **MANIFEST (JSON)** — first code block:

    - `project_name`
    - `selected_docs`: array of filenames
    - `design_areas`: map of filename → 1–2 line scope summary
    - `rationale`: per file, how it maps to PRD goals, risks, NFRs
    - `assumptions_tbd`: explicit gaps found in PRD (owner if known)
    - `traceability`: PRD objectives/KPIs each doc supports
    - `phase_plan_overview`: high-level phases with goals & exit criteria

2. **Design Documents** — one **markdown code block per file**, content only.
   Each block must start with an HTML comment containing the **absolute path**, e.g.:

    ```markdown
    <!-- {PROJECT_PATH}/.agentmux/specs/order_domain_backend_design.md -->
    ```

## Required Content for _each_ `*_design.md`

Tailor deeply to the PRD. Include at least **one diagram** (Mermaid). Prefer specifics over options; when uncertain, state **Assumptions (TBD)**.

```markdown
# [Component/Area] Design Document

## Architecture Overview

-   Context tied to PRD objectives/NFRs
-   Component interactions & data flow (**Mermaid C4** context/container or sequence diagram)
-   Technology choices with trade-offs & constraints

## Research & Stack Selection

-   Problem-fit criteria (latency/throughput, team skill, cost, ecosystem, compliance)
-   3–5 candidate options with a **comparison table** (pros/cons, risks, cost/latency rough order of magnitude)
-   Decision & rationale (why chosen, why not others)

## Detailed Design

-   Core components & responsibilities (and key alternatives rejected)
-   Data structures/models (ER diagram or schema tables where applicable)
-   Key algorithms/business rules (pseudocode/flows; edge cases & failure modes)
-   Interaction contracts (request/response schemas, events, idempotency, rate limits)

## Infrastructure & Operations

-   Environments, topology, tenancy, **scaling model** (horizontal/vertical), capacity assumptions
-   Networking, messaging, storage classes; backup/restore, DR objectives (RPO/RTO)
-   Observability (logs/metrics/traces), SLOs & alerting rules; feature flags & config strategy

## Security & Compliance

-   AuthN/AuthZ model (roles/claims), session/secret management
-   Data protection (in transit/at rest), PII handling, retention
-   Threat model (**STRIDE/OWASP**) with mitigations

## Performance & Scalability

-   Budgets/targets (e.g., p95 latencies, throughput, availability) linked to PRD NFRs
-   Caching/indexing strategies, batching/pagination, back-pressure
-   Load shedding, degradation behavior, hotspot analysis

## Integration Points

-   External systems & protocols; retries, timeouts, circuit breakers
-   API contracts or **OpenAPI/GraphQL SDL excerpts** (where relevant)
-   Eventing/analytics plan (key events & properties; privacy notes)

## Phased Design & Test Gates

-   **Phase 0 – Spike/Prototype**: scope, thin slice architecture, KPIs, exit criteria, test plan
-   **Phase 1 – MVP**: scope, deltas vs Phase 0, KPIs, test plan (unit/contract/e2e; perf baseline)
-   **Phase 2 – Scale-Up**: sharding/queueing/caching/search, infra upgrades, KPIs, load tests
-   **Phase 3 – Hardening/Optimizations**: resilience patterns, cost/perf tuning, SRE runbook updates
-   Each phase is independently deployable & **good for testing** (clear entry/exit gates)

## Testing Strategy

-   Test pyramid (unit/integration/contract/e2e) & required fixtures
-   Non-functional tests (perf, chaos, security, accessibility where applicable)
-   Data migration/rollback tests; sandbox/staging validation plan

## Risks, Trade-offs & Decisions

-   Top risks with likelihood/impact/owner; mitigations & triggers
-   ADR-style decisions (context, decision, consequences)
-   Open questions & next steps with owners/dates

## Assumptions (TBD)

-   Explicit gaps inferred from PRD (owner, resolution plan)
```

**Document-Type Guidance (non-exhaustive examples; pick what the PRD actually needs):**

-   `*_frontend_design.md` (web/desktop), `*_mobile_design.md`, `*_backend_design.md`, `*_api_design.md`, `*_database_design.md`,
    `*_genai_design.md` (LLM/RAG/evals), `*_messaging_design.md` (Kafka/SQS/etc.), `*_security_auth_design.md`,
    `*_observability_platform_design.md`, `*_devops_infra_design.md`, `*_analytics_tracking_design.md`, `*_data_pipeline_design.md`.

---

## Authoring Rules

-   Ground every choice in the PRD’s **users, objectives, KPIs, NFRs** (maintain traceability).
-   Prefer concrete specs (schemas, limits, timeouts) over vague guidelines.
-   Include **Mermaid** diagrams (C4/sequence/ER) where appropriate.
-   Keep vendor choices justified by the **Research & Stack Selection** analysis.
-   Output only: **1 JSON manifest block**, followed by **N markdown blocks** (one per file). **No extra commentary.**
-   All files go directly in `{PROJECT_PATH}/.agentmux/specs/`.

**Create the appropriate technical design documents now based on your analysis of the project requirements.**
