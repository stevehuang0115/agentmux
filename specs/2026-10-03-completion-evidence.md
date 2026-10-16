# Completion evidence contract — no "done" without evidence (#873)

Status: implemented, **warn mode** this release. Owner: task-pool. Related:
`specs/2026-09-26-workitem-verification-gate.md` (who may verify),
`specs/2026-09-27-give-up-recovery.md` (blocked/failed stops).

## Claim this makes true

A WorkItem is marked done only with evidence the server can check: artifacts
that exist and commands that exited 0. A worker that could not finish says
which step failed and why, and the item is recorded as **blocked**, not done.

Why: after a tool call fails, tool-using agents often still report success. A
structured evidence contract cut false-success from 22.8% to 0.8% in the
reference study (an instruction alone: 9.3%). Before this, `complete` needed
only a free-text `summary`.

## The contract — `body.result.evidence`

`POST /api/task-pool/complete/:id` body:

```json
{
  "agentId": "<session>",
  "result": {
    "summary": "what I produced",
    "evidence": [
      { "type": "artifact", "path": "src/importer.ts" },
      { "type": "artifact", "path": "https://github.com/o/r/pull/7" },
      { "type": "command", "command": "npx jest src/importer", "exitCode": 0, "outputTail": "Tests: 9 passed" },
      { "type": "blocked", "step": "deploy to staging", "reason": "no credentials" }
    ]
  }
}
```

Types and the shape validator: `backend/src/types/v2/completion-evidence.types.ts`
(`CompletionEvidence`, `validateCompletionEvidence`, `isCompletionEvidence`).
The decision: `backend/src/services/task-pool/completion-evidence.service.ts`
(`decideCompletion`). Evidence goes inside `result` (it is persisted with the
result onto `WorkItem.output.evidence`); a top-level `evidence` is a 400
(`evidence_misplaced`) rather than silently ignored.

## What the server does (in order)

| Evidence | Response | WorkItem |
|---|---|---|
| missing or `[]`, **warn** mode | 200 + `warning`, `evidenceMode: "warn"`; logged | done (as before) |
| missing or `[]`, **enforce** mode | 400 `evidence_required`, message says exactly what to send | unchanged |
| malformed (any mode) | 400 `evidence_malformed`, names `evidence[i]` and the field | unchanged |
| any `blocked` entry | 200 `{recordedAs: "blocked"}` | **blocked** via the same path as `POST /task-pool/block/:id` (claim released, `task:blocked`, give-up classification, projection). Reason: `Blocked at "<step>": <reason>` |
| a `command` with `exitCode ≠ 0` | 400 `evidence_command_failed` ("a failing command is not evidence of done; report blocked/failed") | unchanged |
| an `artifact` local path that does not exist | 400 `evidence_artifact_not_found`, names it and where it looked | unchanged |
| a relative `artifact` path, no project/worktree on the item | 400 `evidence_artifact_relative_path` (send an absolute path) | unchanged |
| a local `artifact` file of 0 bytes (#1313) | 400 `evidence_artifact_empty` | unchanged |
| a local `artifact` file last modified more than 5 min (`STALE_GRACE_MS`) before the WorkItem's `createdAt` (#1313) | 400 `evidence_artifact_stale` ("not this task's output") | unchanged |
| otherwise | 200 | done; evidence persisted on `output.evidence`, each checked local file with `sizeBytes` and `mtime` (#1313) |

- Relative paths resolve against `metadata.worktree.workdir`, then
  `metadata.worktree.path`, then `metadata.projectPath`. `~/` expands to the
  server user's home; `file://` URLs are checked like paths; `http(s)://` URLs
  are accepted without fetching; other schemes are malformed. A directory only
  has to exist (its size and mtime say nothing about the work inside). The age
  check uses `createdAt`, not the claim time, so a retry can still attach what
  the first attempt made.
- A review item's verdict completion (`result.verdict` set) is exempt from the
  missing-evidence rule — the verdict is the deliverable. Malformed evidence is
  still rejected.
- The decision is made before anything is written, so a rejected completion
  leaves the WorkItem as it was.

## Rollout

- **Mode:** `COMPLETION_EVIDENCE_CONSTANTS.EVIDENCE_ENFORCEMENT_MODE`
  (`backend/src/constants.ts`), overridden per process by
  `CREWLY_EVIDENCE_MODE=warn|enforce` (read per request).
- **Default: `enforce` (#1312, 2026-10-14).** A completion without evidence
  is refused with 400 `evidence_required` and nothing is written. Set
  `CREWLY_EVIDENCE_MODE=warn` to go back to accepting it with a `warning`.
- **Who must send evidence:** WorkItem types in
  `COMPLETION_EVIDENCE_CONSTANTS.REQUIRED_FOR_TYPES` (`delegate`,
  `project_task`, `review`) and items with no type (`evidenceRequiredFor`).
  Bookkeeping types (`ticket_triage`, `goal_replan`, retros, `reconcile`,
  `notify`, …) complete without it. A review with a string `verdict` is
  exempt as before.
- **Before the flip** (pool, 2026-10-10 → 10-14): 304 of 1081 done items had
  no evidence — 221 delegate, 53 review (34 of them with a verdict, so already
  exempt), 26 project_task, 4 bookkeeping. They came through `report-status`
  and `complete-task` without evidence flags; those skills now print the 400
  and, for report-status, a `next` line naming the flags to add.
- **Callers outside the controller** are unchanged: `V3DataService.onTaskCompleted`
  (no production emitter) and the `OpenItemsService` follow-up closes
  (`open-items.wiring.ts`, system, not worker deliverables).
- `packages/crewly-agent` `report_status` used to drop a failed
  auto-complete silently; it now returns `completionError` so the agent
  sees the WorkItem is still open.

## Callers updated

| Caller | How it sends evidence |
|---|---|
| `config/skills/agent/core/complete-task` | `evidence` JSON array; prints the server `warning` on stderr |
| `config/skills/agent/core/report-status` (`--status done`) | `--artifact` (repeatable), `--command … --exit-code N [--output-tail …]` (repeatable), `--blocked-step/--blocked-reason`, `--evidence '<json>'` or JSON `evidence`; prints `warning` / `markedAs: blocked` |
| `config/skills/orchestrator/complete-task` | `evidence` JSON array |
| `packages/crewly-agent` tools `complete_task`, `report_status` | optional zod-typed `evidence` |

## Reviewers read the evidence first

- `config/skills/team-leader/verify-output` returns `evidence` as the first
  field of its verdict and sets `evidenceWarning` (leading `feedback`) when a
  done item carries no evidence, or reports blocked steps.
- The bridge's `Verify: …` review item description now has an `Evidence:` line
  (counts, or `NONE — … check the work directly or send it back`).

## Prompts

Worker communication module (`communication.module.ts`) states the contract
("Reporting Done — Evidence Contract"); the TL rules add "Done needs evidence"
and "read its evidence first"; the developer role's task-pool steps and the
orchestrator's skill table show evidence.

## Reviewer check record (#1314)

A rubber-stamp accept looked the same as a real check. Accepting a review
item (`type: review`, `metadata.verifyOf` → a source still `done_by_worker`,
`verdict` absent or `verified`) now needs `body.result.checks`:

```json
[{"entry": 0, "did": "opened report.md: covers the 3 asks", "outcome": "pass"},
 {"entry": null, "did": "loaded the page on staging", "outcome": "pass"}]
```

- `entry` is an index into the worker's `output.evidence`, or `null` for a
  direct look at the work. Out-of-range or non-integer → 400
  `review_checks_malformed`.
- When the worker sent evidence, at least one check names an entry of it;
  otherwise one `null` check is enough. No checks → 400 `review_unchecked`.
- A check with `outcome: "fail"` cannot be accepted → 400
  `review_check_failed`; send it back with `verdict: "rejected"`.
- `verdict: "rejected"` needs no checks.
- `CREWLY_EVIDENCE_MODE=warn` accepts a missing record with a `warning` and
  stamps the source `unchecked`; malformed and failed checks are refused in
  both modes.
- Decided by `decideReviewAccept` (completion-evidence.service.ts) in
  `completeItem`, before anything is written.

**Where it is visible:** the review item's `output.checks`, and the source's
`metadata.reviewChecks` = `{reviewItemId, reviewer, at, checks}` (or
`unchecked: true`).

**Callers:** the review item's description lists the worker's evidence
numbered (first 10); `verify-output` returns each entry with its `index`
and an `acceptWith` hint; `complete-task` (agent core) and crewly-agent
`complete_task` pass `checks` (plus `verdict`/`feedback`). The owner's
dashboard verdict (`POST /task-pool/items/:id/verdict`) is not affected.
