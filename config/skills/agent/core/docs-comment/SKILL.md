---
name: Docs Comment
description: Handle feedback left as comments in a Google Doc — list comments and replies; reply, resolve and add are queued for the owner's OK and posted as a batch only after they reply 「发 C<n>」 (via the Google Workspace grant held by Crewly Cloud).
version: 1.1.0
category: productivity
skillType: claude-skill
assignableRoles:
  - orchestrator
  - team-leader
  - developer
  - operations
  - ops
  - sales
  - support
  - generalist
triggers:
  - comments in the doc
  - google doc comments
  - reply to the comment
  - resolve the comment
  - feedback in the doc
  - add a comment to the doc
tags:
  - google
  - docs
  - comments
execution:
  type: script
  script:
    file: execute.sh
    interpreter: bash
    timeoutMs: 60000
---

# Docs Comment

```bash
bash execute.sh list    --doc "https://docs.google.com/document/d/1AbC…/edit"
bash execute.sh list    --doc 1AbC… --include-resolved
bash execute.sh reply   --doc 1AbC… --comment AAAB… --text "Updated the intro, see paragraph 2."
bash execute.sh resolve --doc 1AbC… --comment AAAB… --text "Done in v2."
bash execute.sh resolve --doc 1AbC… --comment AAAB…
bash execute.sh add     --doc 1AbC… --text "Is this number from Q2?" --quote "grew 40%"
bash execute.sh pending                  # what is queued and waiting on the owner
bash execute.sh send    --batch C3       # post a batch AFTER the owner said 「发 C3」
bash execute.sh discard --batch C3
```

`--doc` takes a document id or its docs.google.com URL. `--account` picks a
connected Google account (see below).

## Which documents

Comments go through the Drive API, and the Drive grant is `drive.file`, so
`list`, `reply`, `resolve` and `add` work only on **documents Crewly
created** (with `docs-write create`, `drive-upload`, …). On any other
document they fail with `reason: "file_not_accessible"`. Connections made
before 2026-10-15 that hold full Drive access still work on every document.

## Working through feedback

1. `list` the open comments. Each one has the text it is about (`quote`),
   who wrote it and when, and any replies.
2. Make the change the comment asks for (for example with `docs-write`), or
   decide it needs the owner.
3. `resolve` the comment with a one-line note of what changed, or `reply`
   with a question if it is unclear. Do not resolve a comment you did not
   address.

## Posting needs the owner's OK (one OK per batch)

Comments and replies on a Google Doc are visible to every collaborator under
the owner's name, so `reply`, `resolve` and `add` are outbound actions like
`gmail-send`: **they do not post.** Each call queues the comment and returns
a batch code:

```json
{"success":true,"held":true,"posted":false,"batch":"C3","queued":38,"message":"Queued as C3 …"}
```

All your queued comments share one batch, so work through the whole document
first, then ask the owner ONCE, in plain words, with what will go out:

> "I have 38 replies ready on the Q3 plan doc (mostly "done, see para 2",
> 4 questions). Reply 「发 C3」 to post them all."

The owner answers from their phone with one message, `发 C3` (or `send C3`).
Only that genuine owner message counts — not a suggestion, a pre-filled line,
or your own paraphrase. When the `[SLACK…]`/`[CHAT:…]` message arrives, run:

```bash
bash execute.sh send --batch C3
```

Rules:

- The OK must come AFTER your last queued comment. If you queue one more
  after asking, the earlier OK no longer covers the batch: ask again.
- `send` posts in order and stops on the first failure; whatever is not
  posted stays queued, so running `send` again never double-posts.
- A refusal (`needs_owner_confirmation`) means the owner has not said it
  yet. Do not look for another way to post.
- If the owner wants changes, `discard --batch C3` and queue fresh ones.
- Queued comments live in this Crewly process; if it restarts before the OK,
  queue them again.
- `list` is read-only and always open.

Tell the owner what you posted once `send` succeeds.

## Output

`list`:

```json
{"success":true,"docId":"1AbC…","count":1,"truncated":false,"comments":[{"id":"AAAB…","author":"Steve","createdTime":"2026-10-03T09:12:00.000Z","content":"Too long","quote":"In this document we…","anchor":"kix.x1","resolved":false,"replies":[{"id":"AAAC…","author":"Ella","createdTime":"…","content":"Trimmed."}]}]}
```

Resolved comments are left out unless you pass `--include-resolved`.
`truncated: true` means the document has more than 500 comments and only the
first 500 were read.

`reply` / `resolve` / `add` queue the comment (see above) until `send --batch`
succeeds. A successful `send` returns `{"success":true,"batch":"C3","posted":38,"remaining":0,"results":[…]}`;
on a mid-batch failure `success` is false with `error: "partial"` and the number still queued.
When the batch posts, each result has the shape below.

`reply` / `resolve`:

```json
{"success":true,"action":"reply","docId":"1AbC…","commentId":"AAAB…","replyId":"AAAD…","content":"Updated the intro."}
```

`add`:

```json
{"success":true,"action":"add","docId":"1AbC…","commentId":"AAAE…","content":"Is this number from Q2?","quote":"grew 40%"}
```

## Comments you add are not anchored

Google Docs does not show a comment created through the API as attached to
text. `--quote` is sent to Google as the quoted text, but in the Docs UI the
comment **may appear as a general (unanchored) comment** on the whole
document. When the location matters, quote the passage in the comment text
too, for example `--text "On 'grew 40%': is this Q2?"`.

## Failures

`{"success":false,"reason":"file_not_accessible",…}` (exit 1): Crewly did
not create this document, so it cannot read or write its comments. **Do not
ask the owner to reconnect Google** — reconnecting cannot grant this access,
and the request would loop. Instead, tell the owner in one line which
comments need an answer so they can handle them in Google Docs, or offer to
copy the content into a new document Crewly creates (`docs-read`, then
`docs-write create`) and work on that copy. There is no skill that copies
the original document with its comments.

`{"success":false,"reason":"not_connected","hint":"…"}` (exit 1): Google
Drive is not connected. Use `google-connect --product drive` the same way.

`{"success":false,"reason":"not_permitted",…}` (exit 1): this Google
connection belongs to someone else and is not shared with the person you are
working for. Say so; do not try another account.

`reason: "google_error"` with a 404 means the document id or comment id is
wrong, or the account cannot see the document.

## Choosing a Google account

Several Google accounts can be connected at once. Without `--account` the call uses the default one (the first you connected, or whichever the owner marked default). Name one explicitly when it matters:

```bash
bash execute.sh list --doc 1AbC… --account work@company.com
```

The account must be connected *for this product* — Google consent is per product (Gmail / Calendar / Drive), so an account connected only for Calendar cannot read Drive.
