PRODUCT REQUIREMENTS DOCUMENT - STEP 1

You are a **senior product manager + UX researcher**. Using the inputs below, generate a complete **`project.md` Product Requirements Document** that emphasizes business/user detail and only includes **non-binding, high-level technical expectations** (no implementation specifics).

**Inputs:**
Project: {PROJECT_NAME}
Path: {PROJECT_PATH}

PROJECT GOAL:
{INITIAL_GOAL}

USER JOURNEY:
{USER_JOURNEY}

## Task: Create Product Requirements Document (PRD)

### Step 1: Directory Setup

Create the specifications directory:

```bash
mkdir -p {PROJECT_PATH}/.agentmux/specs
```

### Step 2: Create project.md

Create a comprehensive Product Requirements Document at: `{PROJECT_PATH}/.agentmux/specs/project.md`

**Required `project.md` structure and quality bar (business/user–first):**

```markdown
# {PROJECT_NAME} - Product Requirements Document

## Project Overview

-   One-paragraph description & purpose (tie directly to INITIAL_GOAL).
-   Business context (market, problem framing) in 3 bullets.
-   Target audience & primary personas (2–3) with goals, frustrations, motivations.
-   Jobs-To-Be-Done (3–5 “When I…, I want…, so I can…”).
-   Stakeholders & roles (R/A/C/I bullets).
-   Key objectives (3–5 SMART) with baseline → target.
-   Assumptions (TBD) & known constraints (non-technical).

## Business Requirements

-   Problem statements (top 3) with evidence signals.
-   Value proposition & differentiation (why now / why us).
-   User needs & pain points → mapped to features (table):
    | Need/Pain | Feature/Capability | Outcome Metric |
-   Success criteria & KPIs (quantified, time-bound, tied to Objectives).

## Functional Requirements

-   Capabilities using **MoSCoW** with rationale (Must/Should/Could/Won’t).
-   **User Stories Table** (≥8 rows):
    | ID | As a | I want | So that | Priority | Acceptance Criteria (G/W/T x2+) |
-   **Core Workflows** (3–4) as numbered steps; include empty/error state behavior.
-   UX expectations: accessibility (WCAG 2.2 AA), internationalization/localization, empty states, progressive disclosure, error messaging tone.
-   Edge cases & guardrails (at least 6).
-   Data shown to users (fields, labels, sort/filter expectations) — no storage/DB details.

## Non-Functional Requirements (User-Perceived)

-   Performance: p95 page-to-interaction ≤ Xs; critical action p95 ≤ Ys; availability SLO presented as user impact.
-   Privacy, consent, and data minimization (what users see/agree to).
-   Security posture (authN/authZ at experience level, session patterns) — no vendor names.
-   Reliability & degradation strategy (graceful fallbacks, offline/empty-state behavior).
-   Accessibility specifics (keyboard flows, color contrast, focus order, ARIA where applicable).

## Technical Expectations (Non-Binding, No Implementation Detail)

-   Integration boundaries (systems touched, data in/out at a high level; example event names/properties for analytics).
-   Tracking & measurement plan (events, properties, funnels, cohorts) without specifying tools.
-   API expectations from a consumer perspective (idempotency, pagination, rate-limit user impact) — no protocol/library choices.
-   Environments & release approach (beta, staged rollout, feature flags) — no CI/CD tooling.

## Project Scope

-   In-scope features & deliverables (testable bullets).
-   Out-of-scope (explicit non-goals to prevent creep).
-   Phasing & roadmap (Now / Next / Later with 3–5 bullets each).
-   Dependencies (teams, approvals, legal, content).

## Launch Plan (Business/User-Facing)

-   Entry criteria for Beta/GA; exit gates tied to KPIs.
-   Support model & SLAs (response/resolve times).
-   Go-to-market notes (target segments, key messages, channels).
-   Training & help content required (FAQs, tooltips, guides).

## Risks & Mitigations

-   Top risks with likelihood/impact, owner, mitigation/trigger points.

## Open Questions & Decision Log

-   Questions to resolve (owner, due date).
-   Key decisions (decision, date, rationale).

## Success Metrics

-   Adoption: activation, conversion, weekly active % (targets & timeframe).
-   Retention: Day 7/30 retention targets; leading indicator behaviors.
-   Satisfaction: CSAT/NPS targets; qualitative feedback themes expected.
-   Business impact: revenue/cost/risk reduction with baseline → target → measurement cadence.

## Appendix

-   Glossary of terms.
-   Reference materials & discovery inputs (links/notes).
```

**Authoring rules:**

-   **Do not** specify implementation details (e.g., programming languages, cloud vendors, database types, architectural diagrams).
-   Keep everything framed in terms of **user outcomes** and **business impact**; any technical content must remain a **non-binding expectation**.
-   Each KPI includes a target and timeframe (or mark **TBD**). Each user story has **≥2** Given/When/Then criteria.
-   Use crisp, action-oriented language; bullets over paragraphs when possible.
-   Final output must be exactly **two code blocks** (bash + markdown) with **no extra commentary**.
    **Focus on creating a comprehensive PRD that captures all business and functional requirements based on the project goal and user journey provided above.**
