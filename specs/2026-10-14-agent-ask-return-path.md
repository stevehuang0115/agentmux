# Agent ask return path (2026-10-14)

## Problem

Agent-to-agent messages (`send-message`, `POST /terminal/:to/write`) create no
WorkItem and no completion event. When the receiver finishes, nothing carries
the result back. On 2026-10-14 the owner asked in #awesome-videos for a video
replica; Ella handed it to Pia ("@Pia please take it"), which closed the owner's
request as answered; Pia sent it to Dex; Dex rendered it, wrote "both parts are
done" in its own terminal and stopped. Seven hours of silence.

## Design

`AgentAskLedger` (`backend/src/services/messaging/agent-ask-ledger.service.ts`):

- **Record.** `TraceContext.noteTurnDelivery` sees a turn triggered by an
  `agent_message` and records `{sender, target, excerpt, deliveredAt}`.
- **Clear.** The target writing to the sender (`noteAgentToAgent` in the
  terminal controller) answers the ask. A chat post by the target (not interim,
  not a stated intent) after `deliveredAt` counts as answered where it was asked.
- **Return.** On each turn end (`settleAfterTurn`), for asks of that target:
  - posted since delivery, or turn ended 15 s – 2 min after delivery (read and
    let go): dropped quietly;
  - ended under 15 s after delivery: kept (the turn that ended was the previous one);
  - 2+ min with no post: one `[ANSWER FROM <NAME>]` message per sender, with the
    target's last assistant text since delivery from its Claude/Codex
    transcript (last 2 MB read, secrets masked, last 3000 chars kept).
- **Store.** `CREWLY_HOME/agent-asks.json`, 12 h TTL, 300 asks max.
- **Off switch.** `CREWLY_AGENT_ASK_RETURN=off`.

No model call; one transcript tail read per returned ask.

## Ticket review gates

`TicketReviewService`:

- A reply that @-mentions another agent by name (`handsWorkOn`) is a hand-off,
  not the answer.
- `submitAnswered` waits while the answering agent has open asks
  (`openAsksBy(reply.by) > 0`).

## Not covered

A per-request "where is it now" view for the owner (proposed, separate work).

## Where a request is now (fix 3)

`GET /api/requests/:id/whereabouts` (id or `TKT-n`) answers "who has it,
doing what, since when" without reading transcripts. Built by
`computeWhereabouts` (`services/v3/request-whereabouts.service.ts`) from:

- the request's open WorkItems (by `requestId` or `workItemIds`): the
  `target` while running / queued / blocked, the reviewer once the worker is
  `done_by_worker` (review items are folded into the item they review);
  `since` = `statusChangedAt ?? startedAt ?? createdAt`;
- with no open WorkItem: for `awaiting_followup`, each agent that still owes
  an open item (`open` / `ready` / `overdue`, `handling`, since the item was
  said); the owner for `waiting_confirmation`, or for `awaiting_followup` when
  every owed item is `waiting_owner`; else `assignee` / `ownerAgent`
  (`handling`);
- open asks from this ledger (`openAsks()`): a holder that asked another
  agent after it took the work is `waiting_on_agent` and the asked agent
  holds it, followed up to 4 hops.

Returns `{requestId, ticketNumber?, title, status, finished, finishedAt?,
holders: [{session, state, since, forMs, workItemId?, what?, from?,
blockedReason?}], summary}`, holders longest-held first.

Surfaces: `trace-read --where TKT-12` (agents answering "how is X going"),
and a "Now:" line on the request detail page.

Limits: an ask carries no request id, so a holder's asks are attributed to
the request by time (sent after the holder took the work). An agent holding
two requests at once can show the same ask under both.
