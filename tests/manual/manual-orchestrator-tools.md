# Manual Test: Orchestrator MCP Tools

**Related ticket:** #34
**Estimated time:** 10 minutes

## Goal

Verify that the orchestrator can use its MCP tools to perform actions (creating projects, listing roles) when instructed through chat.

---

## Prerequisites

- Crewly is running (`npm start`)
- Browser open to `http://localhost:8787`
- Orchestrator is active (start from `/teams/orchestrator` if needed)

---

## Test 1: Create a project through chat

**Goal:** Confirm the orchestrator can create a project when asked via chat, and the project appears in the Projects page.

### Steps

1. Navigate to the **Chat** page (`/chat`) and start a **fresh conversation**.
2. Send the message: `Create a new project called test-e2e-project`
3. Wait for the orchestrator to respond (may take up to 60 seconds).
4. Read the response.
5. Navigate to the **Projects** page (`/projects`).
6. Look for `test-e2e-project` in the project list.

### Expected Result

- The orchestrator's response references creating a project or mentions `test-e2e-project`.
- The project `test-e2e-project` is visible on the Projects page.

---

## Test 2: List available roles through chat

**Goal:** Confirm the orchestrator can query and report the available agent roles.

### Steps

1. Navigate to the **Chat** page (`/chat`) and start a **fresh conversation**.
2. Send the message: `What roles are available?`
3. Wait for the orchestrator to respond.
4. Read the response.

### Expected Result

- The orchestrator responds with a non-empty message.
- The response mentions at least one of the following known roles: **developer**, **designer**, **qa**, **orchestrator**.
