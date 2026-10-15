---
name: Drive Search
description: Search the Google Drive files Crewly created or the owner opened with Crewly, by text, type or folder (via the Google Workspace grant held by Crewly Cloud). Not the owner's whole Drive. Returns file ids to pass to drive-read / docs-read / sheets-read / slides-read. Read-only.
version: 1.0.0
category: productivity
skillType: claude-skill
triggers:
  - search drive
  - find file in drive
  - look up a document
  - which spreadsheet
tags:
  - google
  - drive
execution:
  type: script
  script:
    file: execute.sh
    interpreter: bash
    timeoutMs: 60000
---

# Drive Search

```bash
bash execute.sh --query "Q3 plan"                 # names + full text, newest first
bash execute.sh --mime sheet --max 5              # 5 most recent spreadsheets
bash execute.sh --folder 1AbC... --query budget   # inside one folder
```

## Output

```json
{"count":1,"files":[{"id":"1x…","name":"Q3 plan","mimeType":"application/vnd.google-apps.document","modifiedTime":"…","webViewLink":"https://…","owners":["ann@example.com"]}]}
```

`mimeType` tells you which skill reads it: `…document` → `docs-read`,
`…spreadsheet` → `sheets-read`, `…presentation` → `slides-read`, anything
else → `drive-read`.

## What search covers

Search finds only files Crewly created or the owner opened with Crewly
(the Drive grant is `drive.file`). It does not see the rest of the owner's
Drive, so an empty result does not mean the file does not exist; the
output then carries a `note`. For any other file, ask the owner for its
link: a Google Doc, Sheet or Slides link opens with `docs-read` /
`sheets-read` / `slides-read`; for another kind of file, ask them to upload it.

```json
{"count":0,"files":[],"note":"Drive search covers only files Crewly created or the owner opened with Crewly. …"}
```

## Failures

`{"success":false,"reason":"not_connected","hint":"<connect URL>"}` (exit 1)
when the owner has not connected Google Workspace. Run the `google-connect` skill
to post the owner a one-tap card in Slack (never send them to Crewly settings or
the Connections page — they are usually on a phone). Manual fallback: https://crewlyai.com/portal/integrations/google.

## Choosing a Google account

Several Google accounts can be connected at once. Without `--account` the call uses the default one (the first you connected, or whichever the owner marked default). Name one explicitly when it matters:

```bash
bash execute.sh --account work@company.com ...
```

The account must be connected *for this product* — Google consent is per product (Gmail / Calendar / Drive), so an account connected only for Calendar cannot read Drive.
