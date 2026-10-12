---
name: Usage Categories
description: Save, list or remove the owner's own categories for usage reports (for example "self-media" and "book"). Categories are optional and only change how reports group tickets; they never alter ticket facts.
version: 1.0.0
category: monitoring
skillType: claude-skill
assignableRoles:
  - orchestrator
triggers:
  - usage categories
  - track time by category
  - split usage into
  - count self-media separately
tags:
  - usage
  - categories
  - report
execution:
  type: script
  script:
    file: execute.sh
    interpreter: bash
    timeoutMs: 20000
---

# Usage Categories

The owner decides how usage should be grouped ("how much on self-media vs the book?"). Turn what they say into a category and save it. Nothing is required: with no categories, reports group by team.

## Usage

```bash
bash execute.sh list

# The description doubles as the keyword list when it is comma separated
bash execute.sh set --name self-media --description "Xiaohongshu, Substack, LinkedIn, videos"

# Explicit hints: keywords match ticket titles and text; teams / projects match by name
bash execute.sh set --name book --keywords "chapter,manuscript,Bible study book" --teams "Writers"

bash execute.sh remove --name book
bash execute.sh clear
```

## How a ticket gets its category

At report time, in this order:

1. Keywords (case-insensitive), then team and project hints. The best score wins.
2. If nothing matched and a small model is available, one batched question for the unmatched tickets.
3. Otherwise `other`.

The result is cached per ticket and category set, and changes the moment a definition changes. Tickets themselves are never modified, so redefining categories re-slices all past usage.

## Etiquette

- Use the owner's own words for names. Do not invent categories they did not ask for.
- After saving, offer to run `usage-report --by category` so they see the split.
- `other` is reserved and cannot be defined.
