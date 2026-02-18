# Manual Test: Agent Memory Persistence Across Restart

**Related ticket:** #06
**Estimated time:** 15-20 minutes

## Goal

Verify that agent memory (facts the orchestrator or team members are told to remember) is written to disk and persists across a full system restart.

---

## Prerequisites

- Crewly is running (`npm start`)
- Browser open to `http://localhost:8787`
- Orchestrator is active (start from `/teams/orchestrator` if needed)
- Access to the filesystem at `~/.crewly/agents/`

---

## Test 1: Orchestrator remembers knowledge across restart

**Goal:** Confirm the orchestrator can store a fact to memory and recall it after a restart.

### Steps

1. Navigate to the **Chat** page (`/chat`) and start a **fresh conversation**.
2. Send the message: `Please remember that our production deployment uses Docker on AWS ECS in us-east-1`
3. Wait for the orchestrator to respond. Verify the response is non-empty (acknowledges the information).
4. Check the filesystem for agent memory files:
   ```bash
   ls ~/.crewly/agents/*/memory.json
   ```
5. Read the memory file contents:
   ```bash
   cat ~/.crewly/agents/*/memory.json
   ```
6. Verify the memory file contains references to the stored information (look for keywords like `docker`, `aws ecs`, or `us-east-1` — case-insensitive).
7. **Restart Crewly** — stop the server (Ctrl+C) and start it again (`npm start`).
8. Once the server is back, navigate to `/teams/orchestrator` and click **Start Orchestrator**.
9. Wait for the orchestrator to reach **Active** status.
10. Navigate to **Chat** and start a **fresh conversation**.
11. Send the message: `How do we deploy to production?`
12. Wait for the orchestrator to respond.

### Expected Result

- Before restart: The memory file on disk contains the deployment information.
- After restart: The orchestrator's response mentions **Docker**, **AWS ECS**, **ECS**, or **us-east-1**, demonstrating it recalled the stored knowledge.

---

## Test 2: Team member remembers deployment method across restart

**Goal:** Confirm a non-orchestrator team member can store facts to memory and recall them after a restart.

### Steps

1. Navigate to the **Teams** page and create a team named `business_os` with a **developer** member (skip if already exists).
2. Start the team and wait for the developer member to reach **Active** status.
3. Navigate to **Chat** and start a **fresh conversation**.
4. Send the message: `Tell the business_os developer to remember that we deploy using Docker to AWS ECS in us-east-1`
5. Wait for a response from the orchestrator.
6. Wait an additional ~10 seconds for the developer agent to process and save the memory.
7. Check the memory files on disk:
   ```bash
   ls ~/.crewly/agents/*/memory.json
   ```
8. Read the memory files and find one that belongs to a non-orchestrator agent and contains deployment information:
   ```bash
   for f in ~/.crewly/agents/*/memory.json; do echo "=== $f ==="; cat "$f"; done
   ```
9. Verify at least one non-orchestrator memory file mentions `docker`, `aws ecs`, or `us-east-1`.
10. **Restart Crewly** — stop and restart the server.
11. Start the orchestrator and wait for it to reach **Active** status.
12. Wait for the `business_os` team member to reach **Active** status (check the Teams page or poll the API).
13. Navigate to **Chat** and start a **fresh conversation**.
14. Send the message: `Ask the business_os developer how we deploy our application`
15. Wait for the response.

### Expected Result

- Before restart: A non-orchestrator agent's memory file on disk contains deployment info.
- After restart: The response mentions **Docker**, **AWS ECS**, or **us-east-1**, showing the team member retained its memory.
