# Startup MVP Example — Habit Tracker

A minimal habit tracking app built rapidly by a 3-agent startup team. This example demonstrates how Crewly coordinates a PM, developer, and generalist to go from product spec to working prototype.

## Team

| Agent | Role | What They Do |
|-------|------|-------------|
| Product Manager | `product-manager` | Defines requirements, prioritizes features, reviews deliverables |
| Developer | `developer` | Builds core features, sets up infrastructure, writes tests |
| Generalist | `fullstack-dev` | Fills gaps — frontend, backend, docs, testing, whatever's needed |

## Project Structure

```
startup-mvp/
├── .crewly/config.json    # Team configuration (startup-team template)
├── README.md              # This file
├── specs/
│   └── product-spec.md    # Product specification — the MVP scope
└── package.json           # Project dependencies (agents will install more as needed)
```

## How to Run

```bash
# 1. Navigate to this example
cd examples/startup-mvp

# 2. Start Crewly
crewly start

# 3. In the dashboard:
#    - Create a team using the "Startup Team" template
#    - Assign it to this project directory
#    - Start the agents

# 4. Give the team the product spec via the orchestrator, e.g.:
#    "Read specs/product-spec.md and build the habit tracker MVP.
#     PM: break the spec into tasks and prioritize.
#     Developer: build the backend API and data model.
#     Generalist: build the frontend and write docs."
```

## What to Expect

1. **PM** reads the spec, breaks it into user stories, and assigns priorities
2. **Developer** builds the core backend — API, data model, persistence
3. **Generalist** picks up frontend work, writes tests, handles docs
4. The team iterates until the MVP is functional and tested

## Suggested Tasks

- "Add streak tracking — show how many days in a row a habit was completed"
- "Add a simple analytics dashboard showing completion rates"
- "Set up a Docker Compose file for easy deployment"
- "Add email reminders using a cron job"
