# Manual Test: Orchestrator Offline UX

**Related ticket:** #90
**Estimated time:** 5-10 minutes

## Goal

Verify that the Chat page gracefully handles the orchestrator being offline — disabling input or showing a banner — and that it recovers once the orchestrator becomes active.

---

## Prerequisites

- AgentMux is running (`npm start`)
- Browser open to `http://localhost:8787`

---

## Test 1: Chat shows offline state when orchestrator is inactive

**Goal:** Confirm the chat UI indicates the orchestrator is unavailable when it is not running.

### Steps

1. First, verify the orchestrator is **not** active. Check via the API:
   ```bash
   curl http://localhost:8787/api/orchestrator/status
   ```
   If the orchestrator is already active, **skip this test** (or stop it first if possible).
2. Navigate to the **Chat** page (`/chat`).
3. Wait ~3 seconds for the status to load.
4. Observe the chat interface.

### Expected Result

At least one of the following should be true:
- The chat message input is **disabled** (you cannot type in it).
- An **offline banner** is visible (e.g., a banner indicating the orchestrator is offline, matching `[data-testid="orchestrator-offline-banner"]`).

---

## Test 2: Chat enables after orchestrator starts

**Goal:** Confirm the chat input becomes usable once the orchestrator reaches Active status.

### Steps

1. Navigate to `/teams/orchestrator`.
2. If there's an error dialog from a previous failed attempt, dismiss it by clicking **OK**.
3. Click **Start Orchestrator**.
4. Wait for the orchestrator to reach **Active** status (may take up to 2 minutes). You can verify via:
   ```bash
   curl http://localhost:8787/api/orchestrator/status
   ```
   Look for `"isActive": true`.
5. Navigate to the **Chat** page (`/chat`).
6. Wait up to 30 seconds for the UI to update.

### Expected Result

- The chat message input is **enabled** (you can click and type in it).
- The offline banner is **not visible**.
- You can type a test message (e.g., `test message`) into the input field and the text appears.
