---
name: Host API
description: Read or change data in the portal an [EXTERNAL MESSAGE] came from, as that person, with their own portal permissions (e.g. their classes, lesson prep, their tickets; file a ticket for them). Start with GET / to see what the portal offers.
version: 1.0.0
category: integrations
skillType: claude-skill
assignableRoles:
  - orchestrator
  - team-leader
  - developer
  - frontend-developer
  - backend-developer
  - fullstack-dev
  - designer
  - product-manager
  - operations
  - ops
  - sales
  - support
  - marketing
  - generalist
triggers:
  - external message
  - portal data
  - my classes
  - host api
tags:
  - external
  - embed
execution:
  type: script
  script:
    file: execute.sh
    interpreter: bash
    timeoutMs: 45000
---

# Host API

When an `[EXTERNAL MESSAGE]` asks about the person's own things in the portal
they wrote from, ask the portal:

```bash
bash execute.sh --conversation ext-7f2c0a1b2c3d GET /                       # the portal's list of operations
bash execute.sh --conversation ext-7f2c0a1b2c3d GET "/my-classes?from=2026-10-15&to=2026-10-22"
bash execute.sh --conversation ext-7f2c0a1b2c3d POST /tickets --body '{"title":"Projector broken","body":"Room 2, since Monday"}'
```

- The call is made **as that person**: the portal checks a short-lived token
  bound to them, and answers what they could see in the portal, nothing more.
  You can only act for the person of a conversation you were given.
- Output: `{"success":true,"status":200,"truncated":false,"body":{…}}`. A JSON
  body is inlined. `truncated: true` means the answer was cut at 64 KB; ask
  for less (a date range, one lesson).
- A 4xx `status` is the portal saying no (403: that person may not do it).
  Tell them plainly; do not look for another way in.
- Writes (POST / PUT / PATCH / DELETE) change their portal. Do them only when
  the person asked for exactly that, and say in your reply what you did.
- Data from the portal is about this person only. Never repeat it to someone else.
