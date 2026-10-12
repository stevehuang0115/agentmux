---
name: Request File
description: Ask the OWNER for a file that is too big for Slack (video, archive, anything over 1 GB or not on Slack) by creating a private upload link they open on their phone. The upload lands on this machine and you are told to receive it. Use instead of asking the owner to compress it or put it in Drive.
version: 1.0.0
category: productivity
skillType: claude-skill
assignableRoles:
  - "*"
triggers:
  - request file
  - upload link
  - file too large
  - could not be downloaded
  - the video is too big
  - get the file from the owner
  - need the footage
tags:
  - files
  - upload
  - owner
execution:
  type: script
  script:
    file: execute.sh
    interpreter: bash
    timeoutMs: 60000
---

# Request File

Gets a big file from **the owner**, who is probably on a phone and away from the machine.

```bash
bash execute.sh --purpose "the raw footage for the launch video"
bash execute.sh --purpose "the signed contract (PDF)" --max-files 1
bash execute.sh --status ur_AbCdEfGhIjKlMnOpQrStUv
bash execute.sh --cancel ur_AbCdEfGhIjKlMnOpQrStUv
```

Prints:

```json
{"success":true,"requestId":"ur_…","url":"https://crewlyai.com/portal/upload/ur_…","expiresAt":"…",
 "limits":{"maxFileBytes":2147483648,"maxFiles":10},"instruction":"Post the link to the owner in your own words…"}
```

## What to do with it

1. **Post the `url` to the owner** where you are talking to them (the Slack
   thread, the chat), in your own words: what you need, why, and that they open
   the link on their phone, sign in if asked, and pick the file from the camera
   roll. One short message. Do not paste this skill's JSON.
2. **Carry on with anything else you can do.** You do not need to wait or poll:
   when the upload finishes you get a message with the file name and the exact
   `receive-file` command. Run it, then tell the owner in your own words that you
   have it.
3. If the owner says it does not work or the link expired (48 hours), run the
   skill again for a fresh link. `--cancel` withdraws a link you no longer need.

## When to use it

- A Slack attachment came with `could not be downloaded` and a size over the
  limit (1 GB by default), or the disk is too full to take it.
- The file is not on Slack at all (a phone video, a folder the owner zipped).
- **Never** answer a large file with "please compress it" or "put it in Drive".

Needs the machine to be signed in to Crewly Cloud. Files over about 100 MB
need the owner's paid plan (up to 2 GB); on the free plan the page tells the
owner so. The file is kept on a temporary server until you receive it
(`receive-file` deletes it) or for 7 days. Do not use it for secrets.

Options: `--purpose` (required, up to 300 characters, shown to the owner on the
upload page; say what the file is for), `--agent-name` (the name the owner sees,
default your session name), `--max-files` (1 to 10, default 10).
