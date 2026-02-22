# Research Project Example — AI Framework Competitive Analysis

A competitive analysis project powered by a 3-agent research team. This example demonstrates how Crewly coordinates research, analysis, and writing agents to produce a polished deliverable.

## Team

| Agent | Role | What They Do |
|-------|------|-------------|
| Researcher | `developer` | Gathers data from docs, repos, and public sources |
| Analyst | `product-manager` | Produces structured comparisons, gap matrices, and recommendations |
| Writer | `designer` | Turns findings into polished reports, blog posts, and presentations |

## Project Structure

```
research-project/
├── .crewly/config.json    # Team configuration (research-team template)
├── README.md              # This file
├── brief.md               # Research brief — the assignment for the team
└── output/                # Agents write deliverables here
    └── .gitkeep
```

## How to Run

```bash
# 1. Navigate to this example
cd examples/research-project

# 2. Start Crewly
crewly start

# 3. In the dashboard:
#    - Create a team using the "Research Team" template
#    - Assign it to this project directory
#    - Start the agents

# 4. Give the team the research brief via the orchestrator, e.g.:
#    "Read brief.md and complete the competitive analysis.
#     Researcher: gather data on each framework.
#     Analyst: build the comparison matrix.
#     Writer: produce the final report in output/report.md."
```

## What to Expect

1. **Researcher** reads the brief and gathers information on each framework
2. **Analyst** takes the raw findings and builds comparison tables and gap analyses
3. **Writer** produces a polished final report with executive summary and recommendations
4. All deliverables land in the `output/` directory

## Suggested Tasks

- "Add a section comparing pricing models and free tiers"
- "Create a one-page executive summary for leadership"
- "Research community health metrics (stars, contributors, release cadence)"
- "Write a blog post summarizing the top 3 findings"
