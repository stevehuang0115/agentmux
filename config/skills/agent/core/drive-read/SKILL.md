---
name: Drive Read
description: "Read the content of a Google Drive file Crewly created or the owner opened with Crewly (via the Google Workspace grant held by Crewly Cloud) — Docs → text, Sheets → CSV, Slides → text, other files downloaded (text printed, binaries saved with --out). Any Google Doc / Sheet / Slides link also works. Read-only."
version: 1.0.0
category: productivity
skillType: claude-skill
triggers:
  - read drive file
  - open file from drive
  - download from drive
tags:
  - google
  - drive
execution:
  type: script
  script:
    file: execute.sh
    interpreter: bash
    timeoutMs: 600000
---

# Drive Read

```bash
bash execute.sh --id 1AbC…                        # print content (text/CSV) as JSON
bash execute.sh --id 1AbC… --out /tmp/report.pdf  # save (binary decoded) and print metadata
bash execute.sh --id "https://docs.google.com/spreadsheets/d/1AbC…/edit"
```

`--id` takes a file id or a Docs / Sheets / Slides / Drive URL.

## What it can open

The Drive grant is `drive.file`: the Drive API reaches only files Crewly
created or the owner opened with Crewly. A Google Doc, Sheet or Slides deck
is the exception: when Drive refuses one, it is read through the Docs /
Sheets / Slides API instead, so any such file the owner can see still comes
back as text. Pass its URL when you have it (the URL says which kind it is).
Any other file Crewly did not create (a PDF, .docx, image…) fails with
`reason: "file_not_accessible"`: ask the owner to upload it. Do not ask them
to reconnect Google; that cannot widen this access.

## Output

```json
{"file":{"id":"1AbC…","name":"Q3 plan","mimeType":"application/vnd.google-apps.document","webViewLink":"https://…"},"contentType":"text/plain","encoding":"utf8","bytes":1234,"content":"…"}
```

For a Google Doc / Sheet / Slides prefer `docs-read` / `sheets-read` /
`slides-read` — they keep structure (headings, cell grid, per-slide lines).
Files over 10 MB are refused with a `webViewLink` to open instead.

## Failures

`{"success":false,"reason":"not_connected","hint":"<connect URL>"}` (exit 1)
when the owner has not connected Google Workspace. Run the `google-connect` skill
to post the owner a one-tap card in Slack (never send them to Crewly settings or
the Connections page — they are usually on a phone). Manual fallback: https://crewlyai.com/portal/integrations/google.
`{"success":false,"reason":"file_not_accessible","message":"Crewly can open only Drive files it created or that you opened with Crewly. …"}`
(exit 1): see "What it can open" above.

## Choosing a Google account

Several Google accounts can be connected at once. Without `--account` the call uses the default one (the first you connected, or whichever the owner marked default). Name one explicitly when it matters:

```bash
bash execute.sh --account work@company.com ...
```

The account must be connected *for this product* — Google consent is per product (Gmail / Calendar / Drive), so an account connected only for Calendar cannot read Drive.
