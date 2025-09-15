E2E TEST PLAN GENERATION - STEP 1
Project: {PROJECT_NAME}
Path: {PROJECT_PATH}

PROJECT GOAL:
{INITIAL_GOAL}

USER JOURNEY:
{USER_JOURNEY}

## Task: Analyze Project Type and Choose E2E Testing Technology

### Step 1: Project Analysis
Review the project specifications and codebase structure to understand:

1. **Project Type Identification**:
   - Examine {PROJECT_PATH}/.agentmux/specs/project.md for technology details
   - Scan the project structure to identify the platform/framework
   - Determine if this is: Web App, Mobile App (iOS/Android), Desktop App, API/Backend, or Hybrid

2. **Technology Stack Analysis**:
   - Frontend framework (React, Vue, Angular, Flutter, React Native, etc.)
   - Backend technology (Node.js, Python, Java, .NET, etc.)
   - Database and external integrations
   - Deployment target (web browser, mobile device, desktop OS)

### Step 2: E2E Testing Technology Selection
Based on your analysis, recommend the most appropriate E2E testing framework:

**For Web Applications:**
- Playwright (modern, cross-browser, robust)
- Cypress (developer-friendly, real browser testing)
- Selenium WebDriver (mature, wide browser support)

**For Mobile Applications:**
- iOS: XCUITest (native), Detox (React Native), Appium (cross-platform)
- Android: Espresso (native), UIAutomator, Appium (cross-platform)
- Flutter: Flutter Driver, Patrol

**For Desktop Applications:**
- Electron apps: Playwright, Spectron
- Native desktop: platform-specific tools (WinAppDriver, etc.)

**For APIs:**
- Postman/Newman, REST Assured, Supertest

### Step 3: User Journey E2E Test Mapping
Create a comprehensive test strategy covering:

1. **Critical User Paths**: Main flows from user journey
2. **Integration Points**: External APIs, payment systems, authentication
3. **Cross-Device/Browser Testing**: If applicable
4. **Data Management**: Test data setup, cleanup, state management
5. **Error Scenarios**: Network failures, invalid inputs, edge cases

**Create your analysis and technology recommendation document in:**
`{PROJECT_PATH}/.agentmux/tasks/m0_defining_project/open/03_e2e_test_strategy_qa.md`