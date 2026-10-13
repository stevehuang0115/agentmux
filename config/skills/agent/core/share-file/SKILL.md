---
name: Share File
description: Hand the OWNER a LARGE file you made (an HD video, an archive, up to 4 GB) as a private link they open on their phone, watch right in the page and download. Reverse of request-file. Use instead of Slack, Drive or asking the owner to come to the machine.
version: 1.0.0
category: productivity
skillType: claude-skill
assignableRoles:
  - "*"
triggers:
  - share file
  - share the video
  - send the owner a file
  - put the video on a link
  - the video is ready
  - download link for the owner
  - hand the file to the owner
tags:
  - files
  - owner
  - video
execution:
  type: script
  script:
    file: execute.sh
    interpreter: bash
    timeoutMs: 7200000
---

# Share File

Gives **the owner**, who is probably on a phone and away from the machine, a
private link to a big file you made. They open it, **watch or listen right in
the page** (video, images and audio play inline and can be scrubbed) and tap
**Download** to save it to the phone. Needs the machine to be signed in to
Crewly Cloud. The file is streamed from disk (never loaded into memory).

```bash
bash execute.sh --path out/final.mp4 --note "the HD cut, 1.2 GB"
bash execute.sh --status                 # your shared files and their links
bash execute.sh --status sf_AbCdEfGhIjKlMnOpQrStUv
bash execute.sh --cancel sf_AbCdEfGhIjKlMnOpQrStUv
```

Prints, once the upload is finished (big files print `uploaded 10%` ... lines to stderr while it runs):

```json
{"success":true,"shareId":"sf_…","url":"https://crewlyai.com/portal/files/sf_…","fileName":"final.mp4",
 "sizeBytes":1288490188,"expiresAt":"…","instruction":"Post the url to the owner…"}
```

## What to do with it

1. **Post the `url` to the owner** where you are talking to them (the Slack
   thread, the chat), in your own words: what the file is, that they can open it
   on their phone, watch it in the page and download it, and that it stays for
   7 days. One short message. Do not paste this skill's JSON.
2. The owner signs in to their Crewly account if asked. Nobody else can open
   the link. If they say it expired, run the skill again for a fresh link.
3. `--cancel` takes a file down you no longer want shared. A mistake (wrong
   file) is a good reason to cancel straight away.

## Rules

- `--path` must be a regular file **inside your project directory**: not a
  symlink, not inside Crewly's home. Up to 4 GB. Copy files from elsewhere
  into the project first.
- `--name` is the name the owner sees and saves it under (default: the file's
  name). `--note` is one line for the owner (up to 500 characters).
- The account may hold 20 GB / 20 shared files at once; cancel old ones or wait
  for them to expire (7 days after upload).
- Use for the finished thing the owner wants to see or keep. Not for secrets
  or credentials, and not for files under ~5 MB that fit in a message. To get
  a file FROM the owner, use `request-file`.
