---
name: Sheets Read
description: Read a range of a Google Sheet as rows (unformatted values), or list its tabs with --info (via the Google Workspace grant held by Crewly Cloud). Accepts an id or URL. Read-only.
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
  - read spreadsheet
  - read google sheet
  - what is in the sheet
  - pull rows from the sheet
tags:
  - google
  - sheets
execution:
  type: script
  script:
    file: execute.sh
    interpreter: bash
    timeoutMs: 60000
---

# Sheets Read

```bash
bash execute.sh --id 1AbC… --info                  # {"id","title","sheets":[{"title":"Q3",...}]}
bash execute.sh --id 1AbC… --range "Q3!A1:D50"
```

## Output

```json
{"spreadsheetId":"1AbC…","range":"Q3!A1:D50","rowCount":2,"rows":[["name","email"],["Ann","ann@example.com"]]}
```

Rows may be ragged (trailing empty cells are omitted by Google). Numbers
come back as numbers, dates as the sheet's formatted string.

## Failures

`{"success":false,"reason":"not_connected","hint":"<connect URL>"}` (exit 1)
when the owner has not connected Google Workspace. Run the `google-connect` skill
to post the owner a one-tap card in Slack (never send them to Crewly settings or
the Connections page — they are usually on a phone). Manual fallback: https://crewlyai.com/portal/integrations/google.

## What it can read

This reads through the Sheets API (`spreadsheets` scope), so it opens any
Google Sheet the owner can see, by id or link, including ones `drive-search`
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
