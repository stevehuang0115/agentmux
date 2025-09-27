E2E TEST PLAN GENERATION - STEP 1

**Role:** You are a Senior QA Architect specializing in E2E **evaluation** (framework choice + minimal harness) across web, mobile, desktop, API, and terminal apps. Work deterministically, avoid speculation, and show reasoning **only** via explicit criteria, tables, and bullet points (no hidden chain-of-thought).

**Project Inputs:**

-   **Project:** `{PROJECT_NAME}`
-   **Repo/Path:** `{PROJECT_PATH}`
-   **Goal:** `{INITIAL_GOAL}`
-   **User Journey (primary flow + key alternates):**
    `{USER_JOURNEY}`

**Repository Conventions (must honor):**

-   **Specs live in:** `{PROJECT_PATH}/.agentmux/specs/`
-   **Tasks live in:** `{PROJECT_PATH}/.agentmux/tasks/`
-   **This task’s outputs must be saved under:** `{PROJECT_PATH}/e2e_tests/`

**Artifacts to Inspect (request immediately if not provided):**

1. `{PROJECT_PATH}/.agentmux/specs/project.md` (authoritative tech/platform constraints)
2. All specs under `{PROJECT_PATH}/.agentmux/specs/` (including any user-journey docs)
3. A **directory tree** (depth 3–4) for `{PROJECT_PATH}`
4. Key files if present: `package.json`, lockfiles, `requirements.txt`/`pyproject.toml`, `pom.xml`/`build.gradle`, `pubspec.yaml`, `android/app/build.gradle`, `ios/Podfile`, `electron-builder.yml`, `Dockerfile`, CI configs (`.github/workflows/*`, `gitlab-ci.yml`, etc.), framework configs (`next.config.js`, `angular.json`, `capacitor.config.*`, etc.)

> If anything is missing, explicitly note it and proceed with clearly-labeled **Assumptions**.

---

## Step 0 — Check for Existing Evaluation & Project Analysis

**1) Check for Existing E2E Evaluation Artifacts**

-   First, check if these files exist:
    -   `{PROJECT_PATH}/e2e_tests/e2e_evaluation_instructions.md`
    -   `{PROJECT_PATH}/e2e_tests/e2e_evaluation_report.md`
-   If `e2e_evaluation_report.md` exists, its content must guide your new evaluation. Your primary goal is to build upon the previous run, addressing any failures, gaps, or regressions identified in the report while still fulfilling the original `{INITIAL_GOAL}`.
-   If these files do not exist, proceed with a fresh project analysis from scratch.

**2) Project Analysis (Specs → Codebase Reality)**

Produce a concise analysis (≤ 14 bullets) that **compares specs to the current codebase**:

**a) Project Type Identification**

-   Decide: **Web**, **Mobile (iOS/Android)**, **Desktop (Electron/native)**, **API/Backend**, **Terminal/CLI**, or **Hybrid**.
-   Cite signals (files/deps like `react`, `next`, `flutter`, `react-native`, `electron`, `express`, `fastapi`, `spring`, CLI entrypoints, etc.).
-   Note deployment targets (browsers, devices/OS, distributions).

**b) Technology Stack (from specs vs. code)**

-   **Frontend:** framework(s), build tool, SSR/SSG, state mgmt, styling.
-   **Backend/API:** language/runtime, framework, auth (OIDC/JWT), protocols (REST/GraphQL/gRPC), jobs/queues.
-   **Data/Integrations:** DBs, caches, 3rd-party APIs (payments, auth, analytics).
-   **CI/CD & Environments:** pipelines, environments, containers, existing test tooling.
-   **Existing E2E/Integration Tooling:** anything already used (Cypress/Playwright/Appium configs, etc.).

**c) Constraints & Non-functionals**

-   Parallelization needs, flake tolerance, security/compliance (PII/SOC2), a11y/perf budgets, coverage expectations (devices/browsers).

**d) Diff & Gaps**

-   Where **specs** and **codebase** diverge; risks and blockers for E2E evaluation.

**Deliverable for Step 1:**

-   A **one-paragraph summary** + **bullet list of decisive indicators** with pointers to files/lines.

## Step 1 — Project Analysis (Specs → Codebase Reality)

Produce a concise analysis (≤ 14 bullets) that **compares specs to the current codebase**:

**1) Project Type Identification**

-   Decide: **Web**, **Mobile (iOS/Android)**, **Desktop (Electron/native)**, **API/Backend**, **Terminal/CLI**, or **Hybrid**.
-   Cite signals (files/deps like `react`, `next`, `flutter`, `react-native`, `electron`, `express`, `fastapi`, `spring`, CLI entrypoints, etc.).
-   Note deployment targets (browsers, devices/OS, distributions).

**2) Technology Stack (from specs vs. code)**

-   **Frontend:** framework(s), build tool, SSR/SSG, state mgmt, styling.
-   **Backend/API:** language/runtime, framework, auth (OIDC/JWT), protocols (REST/GraphQL/gRPC), jobs/queues.
-   **Data/Integrations:** DBs, caches, 3rd-party APIs (payments, auth, analytics).
-   **CI/CD & Environments:** pipelines, environments, containers, existing test tooling.
-   **Existing E2E/Integration Tooling:** anything already used (Cypress/Playwright/Appium configs, etc.).

**3) Constraints & Non-functionals**

-   Parallelization needs, flake tolerance, security/compliance (PII/SOC2), a11y/perf budgets, coverage expectations (devices/browsers).

**4) Diff & Gaps**

-   Where **specs** and **codebase** diverge; risks and blockers for E2E evaluation.

**Deliverable for Step 1:**

-   A **one-paragraph summary** + **bullet list of decisive indicators** with pointers to files/lines.

---

## Step 2 — E2E Evaluation Technology Selection (Framework Choice, Not Test Authoring)

Pick the **evaluation** framework(s) per platform to **exercise end-to-end flows** (not a full suite). Provide a decision matrix with **scores 1–5**:

**Criteria:** Platform Fit, Developer UX, Stability/Auto-waits, Cross-Browser/Device Coverage, CI/Parallelization, Ecosystem/Plugins (a11y/visual/network mocks), Maintenance Cost, Scalability, Licensing/Cost.

**Candidate Pool (select relevant only):**

-   **Web:** Playwright, Cypress, Selenium
-   **Mobile:** iOS (XCUITest, Detox, Appium), Android (Espresso, UIAutomator, Appium), Flutter (Patrol/Flutter Driver)
-   **Desktop:** Electron (Playwright, Spectron), Native (WinAppDriver, Appium for Windows/macOS)
-   **API:** Postman/Newman, REST Assured (Java), Supertest (Node), pytest+requests (Python)
-   **Terminal/CLI:** Node `child_process` + **expect/pexpect**-style automation; or Playwright’s **TTY** helpers where applicable

**Output Requirements (Step 2):**

-   **Decision Matrix** (table with scores + brief rationale).
-   **Recommendation:** Name **1 primary** tool per platform (or dual-stack for hybrid) + 3–5 bullets on why it fits **this project**.
-   **Risks & Mitigations:** selectors strategy, network controls, device farm choice, flake handling.
-   **Alternatives:** if org or infra constraints block the top choice.

---

## Step 3 — Map User Journey to an E2E **Evaluation Plan** (Not Execution)

Transform `{USER_JOURNEY}` into a practical **evaluation plan** executed by a single entry script per platform. Prioritize coverage breadth over test depth.

1. **Critical Paths → Scenario IDs** (e.g., `E2E-LOGIN-001`)
2. **Integrations:** auth, payments, email/SMS, analytics — choose **stub/sandbox/live-preprod** strategy for evaluation.
3. **Coverage Matrix:** browsers (and versions), viewports, devices/simulators, desktop OSes.
4. **Data Management:** seed/fixtures, per-test identities, cleanup, PII masking.
5. **Resilience:** network failures, slow/offline, 4xx/5xx, retries, rate limits, boundary inputs.
6. **Observability:** traces, screenshots, videos, console/network logs; failure triage workflow.
7. **CI Hooks:** when to run (PR smoke/nightly), sharding, time budgets, flake thresholds.

---

## Step 4 — Produce Evaluation Script(s) **and** Instructions (Do **Not** Execute)

Generate a **minimal evaluation harness** that calls the chosen framework(s) programmatically to drive the user-journey checks. Keep it lightweight; **no full test authoring**. The script should orchestrate framework runs, basic assertions for reachability/health, and artifact capture (traces/screenshots/videos) as supported.

**Where to save outputs (MANDATORY):**
All files must be returned as content **ready to save** under:
`{PROJECT_PATH}/e2e_tests/`

**Output Files:**

1. **Evaluation Script(s)** — name by platform and language detected (choose the best fit; examples):

    - Web (TS): `{PROJECT_PATH}/e2e_tests/web_e2e_tests.ts`
    - Web (Java): `{PROJECT_PATH}/e2e_tests/web_e2e_tests.java` (Playwright/Selenium)
    - API (TS): `{PROJECT_PATH}/e2e_tests/api_e2e_tests.ts`
    - API (Python): `{PROJECT_PATH}/e2e_tests/api_e2e_tests.py`
    - Mobile (JS/TS wrapper): `{PROJECT_PATH}/e2e_tests/mobile_e2e_tests.ts` (delegates to Appium/WDIO)
    - Desktop (Electron+Playwright): `{PROJECT_PATH}/e2e_tests/desktop_e2e_tests.ts`
    - Terminal (TS + pty): `{PROJECT_PATH}/e2e_tests/terminal_e2e_tests.ts`

    > Use **one script per relevant platform** (or multiple if hybrid). For non-Node stacks, the script may shell out to platform tools (`newman`, `appium`, `xcodebuild`, `gradlew`) via `child_process`/`subprocess`.

2. **Detailed Instruction Doc:**
   `{PROJECT_PATH}/e2e_tests/e2e_evaluation_instructions.md` — clearly explains prerequisites, env vars/secrets, how a separate “runner” task will execute the script(s), expected artifacts, and how scenarios map to user-journey items. It must link to the script(s) in (1).

**Script Skeleton Requirements (examples):**

-   **Web (Playwright, TS):** programmatic API to launch Chromium/Firefox/WebKit; navigate main critical paths; save traces/videos; exit non-zero on failed assertions.
-   **Web (Selenium, Java):** JUnit/TestNG skeleton, grid-ready; minimal health checks + navigation placeholders.
-   **API (Supertest or Python requests):** smoke calls for critical endpoints, validate 2xx/expected payloads, record perf timings.
-   **Mobile (Appium/Detox):** start server/simulator, install app, run shallow navigations, capture logs/screens.
-   **Desktop (Electron):** launch app, verify window/menu boot flow.
-   **Terminal (pty):** spawn process, send keystrokes, assert prompts/outputs, capture transcript.

> **Do not execute** any script. Only generate content.

---

## Final Deliverables (return **both** items in one response)

-   **A) Evaluation Script File(s):** saved under `{PROJECT_PATH}/e2e_tests/` with appropriate extension(s) per tech stack.
-   **B) Detailed Instruction Markdown:** `{PROJECT_PATH}/e2e_tests/e2e_evaluation_instructions.md`.

---

### Example Skeletons (generate only those that match the detected stack)

**Web — `web_e2e_tests.ts` (Playwright programmatic API with Visual & A11y checks)**

```ts
// {PROJECT_PATH}/e2e_tests/web_e2e_tests.ts
// Potential new dev dependencies: @axe-core/playwright
import { chromium, firefox, webkit, Browser, Page, expect } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const BROWSERS = (process.env.BROWSERS || 'chromium').split(',');
const HEADLESS = process.env.HEADLESS !== 'false';

async function runBrowser(name: string, fn: (b: Browser) => Promise<void>) {
	const browser = await ({ chromium, firefox, webkit } as any)[name].launch({
		headless: HEADLESS,
	});
	try {
		await fn(browser);
	} finally {
		await browser.close();
	}
}

async function checkAccessibility(page: Page) {
	const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
	expect(accessibilityScanResults.violations).toEqual([]);
}

async function criticalPathSmoke(browser: Browser) {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	await ctx.tracing.start({ screenshots: true, snapshots: true, sources: true });
	const page = await ctx.newPage();
	await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

	// --- Functional, Visual, and Accessibility Checks ---
	await page.waitForLoadState('networkidle');
	// 1. Functional check: Is the header visible?
	await expect(page.locator('header').first()).toBeVisible();

	// 2. Visual Regression check: Does the page look correct?
	// This will take a screenshot on the first run and compare against it on subsequent runs.
	await expect(page).toHaveScreenshot('landing-page.png', { maxDiffPixels: 100 });

	// 3. Accessibility check: Are there any violations?
	await checkAccessibility(page);

	// TODO: Add more steps based on {USER_JOURNEY}
	// Example: await page.getByRole('button', { name: 'Sign In' }).click();
	// await expect(page).toHaveScreenshot('signin-modal.png');
	// await checkAccessibility(page);

	await ctx.tracing.stop({ path: `./artifacts/trace-${Date.now()}.zip` });
	await ctx.close();
}

(async () => {
	for (const name of BROWSERS) await runBrowser(name, criticalPathSmoke);
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
```

**Web — `web_e2e_tests.java` (Selenium + JUnit 5)**

```java
// {PROJECT_PATH}/e2e_tests/web_e2e_tests.java
import org.junit.jupiter.api.*;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;

public class WebE2ETests {
  private WebDriver driver;
  private static final String BASE_URL = System.getenv().getOrDefault("BASE_URL","http://localhost:3000");
  @BeforeEach void setUp(){ driver = new ChromeDriver(); }
  @AfterEach  void tearDown(){ if (driver!=null) driver.quit(); }

  @Test void landingPageLoads(){
    driver.get(BASE_URL);
    Assertions.assertTrue(driver.findElement(By.tagName("header")).isDisplayed(), "Header not visible");
  }
}
```

**API — `api_e2e_tests.ts` (Supertest)**

```ts
// {PROJECT_PATH}/e2e_tests/api_e2e_tests.ts
import supertest from 'supertest';
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
const client = supertest(BASE_URL);

(async () => {
	const health = await client.get('/health').expect(200);
	if (!health.body?.status) throw new Error('Healthcheck missing status');
	// TODO: Add 2–3 critical endpoints from {USER_JOURNEY}
	process.exit(0);
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
```

**API — `api_e2e_tests.py` (pytest + requests style)**

```python
# {PROJECT_PATH}/e2e_tests/api_e2e_tests.py
import os, requests
BASE_URL = os.getenv("API_BASE_URL", "http://localhost:4000")

def test_health():
    r = requests.get(f"{BASE_URL}/health")
    assert r.status_code == 200
    assert r.json().get("status")
```

**Mobile — `mobile_e2e_tests.ts` (Appium/WDIO delegate)**

```ts
// {PROJECT_PATH}/e2e_tests/mobile_e2e_tests.ts
import { spawn } from 'child_process';
const cmd = process.env.MOBILE_CMD || 'npx';
const args = (process.env.MOBILE_ARGS || 'wdio run ./wdio.appium.conf.ts').split(' ');
const child = spawn(cmd, args, { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 1));
```

**Desktop — `desktop_e2e_tests.ts` (Electron + Playwright)**

```ts
// {PROJECT_PATH}/e2e_tests/desktop_e2e_tests.ts
import { _electron as electron } from 'playwright';
(async () => {
	const app = await electron.launch({ args: ['.'] });
	const window = await app.firstWindow();
	await window.waitForLoadState('domcontentloaded');
	// TODO: verify main window title/menu/boot flow
	await app.close();
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
```

**Terminal — `terminal_e2e_tests.ts` (PTY smoke)**

```ts
// {PROJECT_PATH}/e2e_tests/terminal_e2e_tests.ts
import { spawn } from 'node-pty';
const shell = process.env.SHELL || 'bash';
const pty = spawn(shell, [], { cols: 120, rows: 30 });
pty.onData((d) => process.stdout.write(d));
pty.write('your-cli --help\r');
setTimeout(() => process.exit(0), 3000);
```

**Detailed Instructions — `e2e_evaluation_instructions.md`**

```markdown
# E2E Evaluation Instructions

**Purpose:** This document explains how a separate “runner” task will execute the generated `*_e2e_tests.*` scripts to perform an **evaluation run** across the critical user journeys. This task does **not** execute the scripts.

## Scripts Produced

-   <<list only the relevant script(s): web_e2e_tests.ts | ... >>
-   Location: `{PROJECT_PATH}/e2e_tests/`

## Prerequisites

-   Appropriate runtime(s): Node.js LTS, etc.
-   Project services running (see project README)
-   Dependencies installed:
    -   JS/TS: `pnpm i playwright @playwright/test @axe-core/playwright`
-   Env vars:
    -   `BASE_URL` / `API_BASE_URL`
    -   `BROWSERS=chromium,firefox,webkit` (Web/Playwright)
    -   Secrets for test accounts (via `.env` or CI secrets)

## How to Run (by the subsequent task)

-   Execute examples:
    -   Web (Playwright): `ts-node e2e_tests/web_e2e_tests.ts` (env: `HEADLESS=true`)
    -   ...

## Managing Visual Baselines

The evaluation script uses Playwright's visual regression capability (`toHaveScreenshot`).

-   **First Run:** When you run the script for the first time, it will generate baseline screenshots (e.g., `landing-page.png`) inside a new `e2e_tests/web_e2e_tests.ts-snapshots` directory. **You must review and commit these initial images to your repository.**
-   **Subsequent Runs:** The script will compare the current UI against these committed baseline images and fail if there are any visual differences.
-   **Updating Baselines:** If a UI change is intentional, you must update the baseline images by running the test runner with an update flag (e.g., `npx playwright test --update-snapshots`).

## Artifacts

-   Traces/videos/screenshots/logs under `./artifacts` or CI workspace.
-   **Visual Diffs:** If a visual test fails, Playwright will generate `*-diff.png` and `*-actual.png` files showing the discrepancy.
-   **Accessibility Violations:** If an accessibility check fails, the test output will list the specific violations found by Axe-core.

## Scenario Mapping

-   `E2E-XXX-001` → <<script section/function or test method>>
-   `E2E-XXX-002` → <<…>>

> Keep live credentials in CI secrets; never commit PII.
```
