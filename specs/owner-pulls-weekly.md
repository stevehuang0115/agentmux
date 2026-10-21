# Owner pulls, weekly (#1387, first slice)

Status: first slice implemented. Measures only; it never changes when agents ping the owner.

## Goal

Once a week the owner sees one short line: how often agents pulled them in, by kind, how those pulls ended, which teams caused them, and the change from last week. A good setup calls the owner only where needed; without a count that cannot be checked.

## Where it appears

- **Slack receipt.** The nightly owner receipt (`specs/owner-receipt.md`) carries the line once a week, on the local weekday `OWNER_RECEIPT_CONSTANTS.PULLS_WEEKLY.REPORT_WEEKDAY` (Sunday), once per local date (`lastPullsLocalDate` in `owner-receipt.json`). If the receipt has nothing else to say that night, the line is sent alone. If the owner has the nightly receipt off, nothing is sent (no new channel).
- **API.** `GET /api/owner-receipt/pulls` returns `{ pulls, text }` for the seven days ending now.
- No new UI. English only. No ticket or card numbers on the line.

```
*Pulled you in 7 times this week* (down 3 from last week)
• By kind: 4 decision needed, 2 review or approval, 1 agent stuck or error
• Answered 4, aged out 2, ignored 1
• By team: CE 4, SteamFun 3
• You replied or approved 9 times in runs (last week 12)
```

## Sources

| Source | What it gives |
|---|---|
| Decision cards (`ask-owner`, `OwnerDecision`) | Kind, team (`teamId`, else the asker's team), time (`askedAt`/`createdAt`), outcome from `status` |
| Questions agents left in replies (Request `openItems`, type `question`) | Plain-chat "needs your answer" pulls. A question that has a card (`requestRef`) is counted once, by the card; `superseded`/`cancelled` items are not pulls |
| Trace owner touches (`computeTraceMetrics`: answered / approved / sentBack / corrected / other) | The owner's own touches in runs, this week vs last. Owner to agent only: it is the "you replied" side, not a pull count. Agent-authored chat is already excluded there |

The week is the 7 days before the report (`[now-7d, now)`); the comparison is the 7 days before that.

## Kinds

- **decision needed**: an ask-owner card, or a question left in a reply.
- **review or approval**: a held action the owner must release: kinds `browser_action`, `gmail_send`, `app_collaborator`, `app_template`, `model_tier_change`, a merge card (`merge`), or any `sensitive` card.
- **agent stuck or error**: a `spend_cap` card (an agent was stopped).
- **FYI that did not need an answer**: see the rule below.

Cards the harness asks itself (`system`: runtime terms, receipt format) are not agent pulls and are left out, except `spend_cap`.

## Outcomes

- **answered**: the owner chose or replied.
- **aged out**: the deadline default was applied (`defaulted`, or `resolved` via `deadline`), or the card/question expired or was parked unanswered.
- **ignored**: the owner skipped it ("no need").
- **open**: still waiting.
- A card the agent withdrew (`cancelled`) is not a pull: the owner was not bothered.

## Rule: "FYI that did not need an answer"

An agent post to the owner (a plain message, not a card) is an **FYI** only if all three hold:

1. it did not end with a question,
2. it did not open a decision card, and
3. no WorkItem stayed blocked on the owner afterwards.

Any one failing makes it a pull that needed an answer (decision); a post that reports a failure or stuck work is `stuck`. Decision cards always ask, so they are never FYIs. This is the issue's first guess, on facts the harness already has, so the owner is never asked per post. Code: `classifyAgentPost` in `backend/src/services/v3/owner-receipt/owner-pulls-weekly.ts`.

## Not in this slice

- **FYI count is not collected yet.** Plain agent posts that asked nothing are not recorded anywhere the loader reads, so the FYI figure stays 0 (and its kind is omitted from the line). The rule and classifier exist; wiring a post log is the next step.
- "Stuck or error" only covers spend caps; stalled-on-error traces are not counted yet.
- Owner active minutes, per-agent top sources, a dashboard panel, and whether agents see the number (they could game it; today the API is not owner-gated but the line goes only to the owner).

## Code

`owner-pulls-weekly.ts` (pure rollup + render), `owner-pulls-weekly.loader.ts` (reads the stores), `owner-receipt.service.ts` (weekly send, `pullsWeekly()`), `owner-receipt.controller.ts` (`/pulls`), constants in `OWNER_RECEIPT_CONSTANTS.PULLS_WEEKLY` and `PULLS_WEEKLY_KIND_LABELS`.
