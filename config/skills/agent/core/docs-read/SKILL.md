---
name: Docs Read
description: Read a Google Doc as plain text — headings become `#` lines, bullets `-`, table rows `a | b` (via the Google Workspace grant held by Crewly Cloud). Accepts a document id or its URL. Read-only.
version: 1.0.0
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
  - read google doc
  - open the doc
  - what does the document say
  - summarize this doc
tags:
  - google
  - docs
execution:
  type: script
  script:
    file: execute.sh
    interpreter: bash
    timeoutMs: 60000
---

# Docs Read

```bash
bash execute.sh --id 1AbC…
bash execute.sh --id "https://docs.google.com/document/d/1AbC…/edit"
```

## Output

```json
{"id":"1AbC…","title":"Q3 plan","webViewLink":"https://docs.google.com/document/d/1AbC…/edit","text":"# Q3 plan\n\n- Ship…"}
```

## Failures

`{"success":false,"reason":"not_connected","hint":"<connect URL>"}` (exit 1)
when the owner has not connected Google Workspace. Run the `google-connect` skill
to post the owner a one-tap card in Slack (never send them to Crewly settings or
the Connections page — they are usually on a phone). Manual fallback: https://crewlyai.com/portal/integrations/google.

## What it can read

This reads through the Docs API (`documents` scope), so it opens any
Google Doc the owner can see, by id or link, including ones `drive-search`
cannot find (search covers only files Crewly created or was given). When
you cannot find a file, ask the owner for its link. A `403` with
`reason: "reauth_required"` means this Google connection predates that
scope; the harness posts the owner a reconnect card.

## Choosing a Google account

Several Google accounts can be connected at once. Without `--account` the call uses the default one (the first you connected, or whichever the owner marked default). Name one explicitly when it matters:

```bash
bash execute.sh --account work@company.com ...
```

The account must be connected *for this product* — Google consent is per product (Gmail / Calendar / Drive), so an account connected only for Calendar cannot read Drive.
