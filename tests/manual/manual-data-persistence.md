# Manual Test: Data Persistence After Page Refresh

**Related ticket:** #79
**Estimated time:** 5 minutes

## Goal

Verify that projects and teams persist after a browser page refresh, ensuring that data is properly saved and not just held in frontend state.

---

## Prerequisites

- AgentMux is running (`npm start`)
- Browser open to `http://localhost:8787`

---

## Test 1: Project persists after page refresh

**Goal:** Confirm a created project survives a browser refresh.

### Steps

1. Create a test project. You can do this via the UI or by calling the API directly:
   ```bash
   curl -X POST http://localhost:8787/api/projects \
     -H "Content-Type: application/json" \
     -d '{"path": "/tmp/persist-test-project", "name": "persist-test-project"}'
   ```
   (A `409` response is OK if the project already exists.)
2. Navigate to the **Projects** page (`/projects`).
3. Verify that `persist-test-project` is visible in the project list.
4. **Refresh the page** (F5 or Ctrl+R / Cmd+R).
5. Wait for the page to fully reload.

### Expected Result

- After the page refresh, `persist-test-project` is still visible in the project list.

---

## Test 2: Team persists after page refresh

**Goal:** Confirm a created team survives a browser refresh.

### Steps

1. Navigate to the **Teams** page (`/teams`).
2. Click **New Team** and create a team named `persist-team`.
3. Add one member with the role **developer**.
4. Click **Create** / **Save**.
5. Verify that `persist-team` appears in the teams list.
6. **Refresh the page** (F5 or Ctrl+R / Cmd+R).
7. Wait for the page to fully reload.
8. Navigate to the **Teams** page again if needed.

### Expected Result

- After the page refresh, `persist-team` is still visible in the teams list.
