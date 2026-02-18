# Manual Test: Chat Pipeline & Team Awareness

**Related tickets:** #66, #77, #83, #34
**Estimated time:** 10-15 minutes

## Goal

Verify that the chat pipeline works end-to-end (user message reaches orchestrator, response comes back) and that the orchestrator is aware of active teams and their members.

---

## Prerequisites

- Crewly is running (`npm start`)
- Browser open to `http://localhost:8787`
- Orchestrator is active (start from `/teams/orchestrator` if needed)

---

## Test 1: Chat to orchestrator about active teams

**Goal:** Confirm the orchestrator can report which teams are currently active.

### Steps

1. Navigate to the **Teams** page (`/teams`).
2. If the team `business_os` does not exist, create it:
   - Click **New Team**, name it `business_os`, add a member with role **developer**, and save.
3. Start the `business_os` team and wait for the member to reach **Active** status.
4. Navigate to the **Chat** page (`/chat`).
5. Start a **fresh conversation** (create a new conversation to avoid leftover messages).
6. Type and send: `What teams are active?`
7. Wait for the orchestrator to respond (may take up to 60 seconds).

### Expected Result

- The orchestrator responds with a non-empty message.
- The response mentions `business_os` by name.

---

## Test 2: Chat to orchestrator about team members

**Goal:** Confirm the orchestrator knows who is on a team and what their roles are.

### Steps

1. Ensure the `business_os` team with a **developer** member is active (from Test 1).
2. Navigate to the **Chat** page and start a **fresh conversation**.
3. Type and send: `Who is on the business_os team and what are their roles?`
4. Wait for the orchestrator to respond.

### Expected Result

- The orchestrator responds with a non-empty message.
- The response mentions the role **developer**.

---

## Test 3: Multiple chat messages in a single conversation

**Goal:** Confirm that multiple back-and-forth messages work correctly within one conversation.

### Steps

1. Ensure the orchestrator is active.
2. Navigate to the **Chat** page and start a **fresh conversation**.
3. Type and send: `Hello, what can you help me with?`
4. Wait for the orchestrator to respond.
5. Verify the response is non-empty.
6. In the same conversation, type and send: `Tell me about the system status.`
7. Wait for the orchestrator to respond.

### Expected Result

- Both messages receive non-empty responses from the orchestrator.
- After both exchanges, there should be at least **4 messages** visible in the conversation:
  - Message 1: Your first message
  - Message 2: Orchestrator's first response
  - Message 3: Your second message
  - Message 4: Orchestrator's second response
