# Manual Test: Agent Continuation & Session Persistence

**Related tickets:** #07, #08, #09
**Estimated time:** 10-15 minutes

## Goal

Verify that Crewly persists session state to disk when agents are running, and that agents can resume their work after a full system restart.

---

## Prerequisites

- Crewly is running (`npm start`)
- Browser open to `http://localhost:8787`
- Access to the filesystem at `~/.crewly/`

---

## Test 1: Session state file is created with active sessions

**Goal:** Confirm that when a team is started, session state is written to disk.

### Steps

1. Navigate to the **Teams** page (`/teams`).
2. Click **New Team** and create a team named `business_os`.
3. Add one member with the role **developer**.
4. Click **Create** / **Save** to create the team.
5. Open the team detail page and click **Start** to start the team.
6. Wait for the team member status to show **Active** (may take up to 60 seconds).
7. Navigate to the **Dashboard** (`/`).
8. Verify the orchestrator shows as **Active** in the status banner.

### Expected Result

- The team `business_os` appears on the Teams page with a running developer member.
- The orchestrator status on the dashboard shows **Active**.

---

## Test 2: Agent resumes work after restart

**Goal:** Confirm that after a full restart, the orchestrator and team members come back online and the team is still visible.

### Steps

1. Complete **Test 1** so that `business_os` team is running with an active developer.
2. Open the **Chat** page (`/chat`).
3. Start a fresh conversation (click new conversation if available).
4. Send the message: `Tell the business_os developer to create a hello world Express server in the project`
5. Wait for a response from the orchestrator.
6. Wait 5 seconds for state to settle.
7. **Restart Crewly** — stop the server (Ctrl+C in terminal) and start it again (`npm start`).
8. Once the server is back, open the browser to `http://localhost:8787`.
9. Navigate to the orchestrator team page (`/teams/orchestrator`) and click **Start Orchestrator** if it's not already active.
10. Wait for orchestrator to reach **Active** status.
11. Navigate to the **Teams** page.
12. Wait for the `business_os` team member to reach **Active** status (may take up to 60 seconds).

### Expected Result

- After restart, the orchestrator can be started and reaches Active.
- The `business_os` team is still visible on the Teams page.
- The team member resumes and eventually shows as Active.

---

## Test 3: Session state file contains valid session entries

**Goal:** Verify the content and structure of the persisted session state file.

### Steps

1. Complete **Test 1** so that `business_os` team is running.
2. **Restart Crewly** — stop the server and start it again. This triggers a state save on shutdown.
3. Open the session state file at `~/.crewly/session-state.json` in a text editor or terminal:
   ```bash
   cat ~/.crewly/session-state.json
   ```
4. Inspect the JSON contents.

### Expected Result

The file should contain valid JSON with this structure:

```json
{
  "version": 1,
  "savedAt": "<ISO timestamp>",
  "sessions": [
    {
      "name": "<session name>",
      "cwd": "<working directory>",
      "command": "<command>",
      "args": ["<arg1>", "<arg2>"],
      "runtimeType": "claude-code",
      "role": "<role name>",
      "teamId": "<team UUID>"
    }
  ]
}
```

Verify:
- `version` is `1`
- `sessions` array has at least one entry
- At least one session has `runtimeType` set to `"claude-code"`
- `savedAt` is a valid ISO date string

5. Start the orchestrator again and verify the `business_os` team is still visible on the Teams page.
