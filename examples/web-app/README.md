# Web App Example — Todo App

A full-stack todo application built by a 3-agent web dev team. This example demonstrates how Crewly coordinates frontend, backend, and QA agents to build a working web app together.

## Team

| Agent | Role | What They Do |
|-------|------|-------------|
| Frontend Dev | `frontend-developer` | Builds the React UI with components, state management, and styling |
| Backend Dev | `backend-developer` | Builds the Express API with routes, data models, and persistence |
| QA Tester | `qa` | Reviews code, writes e2e tests, verifies acceptance criteria |

## Project Structure

```
web-app/
├── .crewly/config.json    # Team configuration (web-dev-team template)
├── README.md              # This file
├── package.json           # Project dependencies
└── src/
    ├── server.ts          # Express API entry point (Backend Dev starts here)
    └── app.tsx            # React app entry point (Frontend Dev starts here)
```

## How to Run

```bash
# 1. Navigate to this example
cd examples/web-app

# 2. Start Crewly
crewly start

# 3. In the dashboard:
#    - Create a team using the "Web Dev Team" template
#    - Assign it to this project directory
#    - Start the agents

# 4. Give the team a task via the orchestrator, e.g.:
#    "Build a todo app with add, complete, and delete functionality.
#     Backend: REST API with in-memory storage.
#     Frontend: React UI with a clean, minimal design."
```

## What to Expect

1. **Backend Dev** sets up the Express server with todo CRUD endpoints
2. **Frontend Dev** builds React components for the todo list UI
3. **QA Tester** reviews both agents' code, writes tests, and reports issues
4. Agents coordinate on API contracts (request/response formats)

## Suggested Tasks

- "Add user authentication with JWT tokens"
- "Add filtering by todo status (all, active, completed)"
- "Add drag-and-drop reordering for todos"
- "Set up a SQLite database instead of in-memory storage"
