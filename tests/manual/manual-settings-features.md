# Manual Test: Settings Page Features

**Related tickets:** #27, #62, #64, #65
**Estimated time:** 5 minutes

## Goal

Verify that the Settings page loads correctly, all tabs are functional, and each tab renders its expected content.

---

## Prerequisites

- Crewly is running (`npm start`)
- Browser open to `http://localhost:8787`

---

## Test 1: Settings tabs load without errors

**Goal:** Confirm all four settings tabs can be clicked and their content panels render.

### Steps

1. Navigate to the **Settings** page (`/settings`).
2. Verify the page heading says **Settings**.
3. Click the **General** tab.
4. Verify the tab content panel is visible (content area below the tabs loads without errors).
5. Click the **Roles** tab.
6. Verify the tab content panel is visible.
7. Click the **Skills** tab.
8. Verify the tab content panel is visible.
9. Click the **Slack** tab.
10. Verify the tab content panel is visible.

### Expected Result

- All four tabs (General, Roles, Skills, Slack) can be clicked.
- Each tab shows a content panel without errors or blank screens.

---

## Test 2: Roles tab shows role cards

**Goal:** Confirm the Roles tab displays at least one configured role.

### Steps

1. Navigate to the **Settings** page (`/settings`).
2. Click the **Roles** tab.
3. Look for role cards or role name entries in the content area.

### Expected Result

- At least one role name is visible (e.g., developer, designer, orchestrator, qa, etc.).
- Roles are displayed as cards or list items.

---

## Test 3: Skills tab shows default skills

**Goal:** Confirm the Skills tab has content loaded.

### Steps

1. Navigate to the **Settings** page (`/settings`).
2. Click the **Skills** tab.
3. Observe the content area.

### Expected Result

- The Skills tab renders content (not an empty/blank panel).
- Default skills or a skills configuration interface is visible.

---

## Test 4: Slack tab renders configuration form

**Goal:** Confirm the Slack tab shows a configuration form with input fields.

### Steps

1. Navigate to the **Settings** page (`/settings`).
2. Click the **Slack** tab.
3. Look for form elements (input fields, buttons, labels) in the content area.

### Expected Result

- The Slack tab displays a configuration form.
- Form elements such as input fields or toggle switches are visible.
