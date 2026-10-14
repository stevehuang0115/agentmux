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
