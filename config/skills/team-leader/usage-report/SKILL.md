---
name: Usage Report
description: How much owner time, agent time and tokens went into each category, team, project, agent or ticket (for example self-media vs the book). Computed from the immutable ticket ledger; categories are applied at report time.
version: 1.0.0
category: monitoring
skillType: claude-skill
assignableRoles:
  - team-leader
triggers:
  - usage report
  - how much time did we spend
  - how many tokens
  - time and tokens per project
  - where did the tokens go
tags:
  - usage
  - tokens
  - time
  - cost
  - report
execution:
  type: script
  script:
    file: execute.sh
    interpreter: bash
    timeoutMs: 60000
---

# Usage Report

Answers "how much time and how many tokens went into X?". Every ticket's facts (agent busy time, tokens and estimated cost per model, owner active minutes) are recorded as they happen and never change. This skill adds them up for a window and groups them the way the owner asks.

## Usage

```bash
# Last 7 days by category (the owner's categories, else by team)
bash execute.sh --since 7d --by category

# Just the short text to read out or post to Slack
bash execute.sh --since 30d --by category --text

# Compare two of the owner's categories
bash execute.sh --since 14d --by category --categories "self-media,book"

# One-off categories (not saved): name:keyword,keyword;name:keyword
bash execute.sh --since 7d --categories "media:xiaohongshu,substack,linkedin;book:chapter,bible"

# Other groupings
bash execute.sh --since 7d --by team
bash execute.sh --since 7d --by project
bash execute.sh --since 7d --by agent
bash execute.sh --since 2d --by ticket --limit 10
```

`--since` takes `24h`, `7d`, `2w` or a date. Figures are summed per UTC hour, so a window edge is accurate to the hour.

## Categories

Categories are never required and never stored on tickets. If the owner has defined categories (see the `usage-categories` skill) the report uses them. If not, tickets are grouped by team (then project). A ticket that matches no category is `other`; usage that happened outside any ticket is `(no ticket)`.

When the owner asks for a new grouping ("how much on self-media vs the book?"), either pass `--categories` for one report or save it with `usage-categories set`.

## Output

Each group has: owner minutes, agent busy minutes, tokens (cost-weighted: cache reads count 0.1x), raw tokens, estimated cost in USD, ticket count and its top 5 tickets. `summary` is a short text suitable for speech or Slack. `notes` lists caveats (for example tickets rebuilt from history are marked inferred).

## Reading the numbers to the owner

- Lead with the summary line, then the two or three biggest groups.
- Owner minutes are an estimate from message times (messages on one ticket within 10 minutes form one span).
- Say "about" for cost; it is an API-price estimate, not a bill.
