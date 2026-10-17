# Worktree janitor (disk janitor)

Status: implemented. Code: `backend/src/services/worktree/worktree-janitor.service.ts`,
`scratch-janitor.ts` (stale scratch sweep), `low-disk-guard.ts` (free-space checks
and the owner notice), `worktree-tiers.ts` (age tiers for kept worktrees),
`transcript-janitor.ts` (agent transcript retention), `tmp-janitor.ts`
(`~/.crewly/tmp` retention and log caps). Extended 2026-10-17 (crewly#1354).

## Problem

Agents create a git worktree per code task (Claude Code subagents under
`<repo>/.claude/worktrees/<name>`, the developer role under
`/tmp/crewly-worktrees/<session>-<slug>`) and never delete it. One Mac collected
30+ worktrees, tens of GB. Owner decision: once the PR is merged, the worktree is
removed automatically.

2026-09-29: the owner's Mac hit ENOSPC anyway. The janitor kept 13 finished
worktrees as `not-agent-worktree` because agents also create worktrees at arbitrary
paths (`/private/tmp/claude-501/visa-cm-wt` in ce-core, `../crewly-wt-805`), each
with its own node_modules (~2 GB). It also never saw full clones and test homes in
Claude Code's per-session temp dirs (`/private/tmp/claude-<uid>/<slug>/<uuid>/`),
0.5–1.8 GB each, dozens of GB in total. The location rule was dropped, a scratch
sweep and a low-disk guard were added.

## Schedule

Started at boot. The first pass runs 10 minutes after start, then every 30 minutes.
Kill switch: `CREWLY_WORKTREE_JANITOR=0` (also `off`, `false`, `no`). It stops the
timer and the manual trigger. The dry-run listing still works.

## Repos

The janitor scans every registered project path that is inside a git repo, plus the
running Crewly package root when it is a dev checkout, plus every repo that owns a
linked worktree found under the temp roots (`/tmp`, `os.tmpdir()`, and the Claude
scratch roots below; searched 4 levels deep, `node_modules` skipped, at most 20,000
directories per root). A worktree's `.git` file (`gitdir: <main>/.git/worktrees/<name>`)
names its repo, so a repo that is not a registered project, such as ce-core, is
still found. Repos are de-duplicated by their main worktree, and each is read with
`git worktree list --porcelain`.

## Removal rules

A worktree is removed only when **all** of these hold:

| # | Rule | Kept reason |
|---|---|---|
| 1 | A linked worktree of a known repo — any path, any branch. Not the main worktree, not bare, and its directory exists. A missing directory is left to `git worktree prune`. | `main-worktree`, `bare`, `prunable` |
| 2 | Not locked. Claude Code locks the worktree of a running subagent. | `locked` |
| 3 | Not under `<repo>/.crewly/worktrees/`, which the per-WorkItem worktree feature (#814) owns and cleans. | `managed-by-workitem-worktrees` |
| 4 | No Crewly agent session was started inside it, and no process of this user has its cwd inside it. If the probe fails, the worktree is kept. | `agent-session-inside`, `process-inside`, `cwd-probe-failed` |
| 5 | Idle: last touched more than **2 hours** ago in a known agent location (`<main>/.claude/worktrees/`, `<tmp>/crewly-worktrees/`, or a `worktree-agent-*` branch), more than **24 hours** ago anywhere else. "Touched" is the newest mtime of the directory and of its git dir's `index`, `HEAD` and `logs/HEAD`. | `recent` |
| 6 | `git status --porcelain --untracked-files=all` is empty. Ignored files do not count. | `dirty`, `status-failed` |
| 7 | HEAD is an ancestor of `origin/<default>` after a quiet fetch, **or** `gh` (installed and authenticated) shows a MERGED PR for the branch whose head commit equals HEAD, which covers squash merges. A repo with no origin (e.g. not on GitHub) has neither, so its worktrees stay. | `not-merged` |

Until 2026-09-29 a fourth rule required an agent location or branch
(`not-agent-worktree`); it is retired. Location now only picks the idle threshold.
Safety comes from rules 2–7: a worktree whose work is not committed, not landed,
or in use is never removed. A false "keep" costs disk space; a false "remove"
costs work.

All janitor git calls run with `GIT_OPTIONAL_LOCKS=0`, so a status never rewrites
the index (which would reset the idle clock and contend with agents' git).

## Removal

The janitor runs `git worktree remove` without `--force`. If git refuses while the
status is still clean (only ignored output is left) and there are no submodules, it
retries once with `--force`. It then deletes the local branch with `-D`, but only
when the branch still points at the verified HEAD and is not `main`, `master`,
`develop` or the default branch. `git worktree prune` runs once per repo.

Each pass logs one line:
`Worktree janitor: removed N, kept M (reason: count, ...)`. A pass never throws.

## Scratch sweep

After the worktrees, the janitor sweeps Claude Code's per-session temp dirs.

Roots: `<os.tmpdir()>/claude-<uid>`, `/private/tmp/claude-<uid>` and
`/tmp/claude-<uid>`, de-duplicated by real path. The unit is a session dir
`<root>/<project-slug>/<uuid>/`. Nothing else under the root is touched (loose files,
worktrees like `<root>/visa-cm-wt`, non-UUID dirs). Symlinked slug or session dirs
are skipped; symlinks are never followed.

A session dir is deleted (`rm -rf`) only when **all** of these hold:

| # | Rule | Kept reason |
|---|---|---|
| 1 | Idle for more than **3 days**: the newest mtime of the dir and everything in its top two levels, and of every git repo's `HEAD`, `index`, `logs/` inside it. | `recent` |
| 2 | No process of this user and no Crewly session has its cwd inside. If the probe fails, everything is kept. | `process-inside`, `agent-session-inside`, `cwd-probe-failed` |
| 3 | It holds no linked worktree of a repo outside it. Those belong to the worktree rules (`git worktree remove`), which run first; once removed there, the session dir can go on a later pass. | `contains-worktree` |
| 4 | Every git repo inside (a dir with a `.git` dir or file, searched 3 levels deep, `node_modules` skipped, not descending into repos) is clean: `git status --porcelain --untracked-files=all` is empty. Untracked files count; ignored ones do not. | `dirty` |
| 5 | Every repo has a remote. A repo with no remote may be the only copy of its history. | `no-remote` |
| 6 | No commit is missing from the remotes: `git rev-list HEAD --branches --not --remotes` is empty (detached HEAD included), and there is no stash. | `unpushed`, `stash` |
| 7 | No repo inside has a linked worktree outside the session dir (deleting the clone would orphan it). | `has-external-worktrees` |

Any git error keeps the dir (`git-failed`). A session dir with no repo at all (test
homes, notes) is removed on rules 1–2 alone. Size is measured with `du -sk` before
deleting. Each pass logs one line:
`Scratch janitor: removed N session dir(s), freed X GB, kept M (reason: count, ...)`.

Remote-tracking refs are not fetched first. A stale ref can only make a commit
look unpushed (kept), never the reverse — except when a remote branch was deleted
upstream after the clone fetched it, which is accepted.

## Age tiers for kept worktrees (crewly#1354)

2026-10-16 the owner's Mac filled up again. The janitor had kept 21 worktrees
(`not-merged: 6, dirty: 4, …`), each with a full `node_modules` (2.4–2.7 GB), ≈15 GB,
some untouched for weeks. Kept work is still never deleted, but a kept worktree is
no longer kept *as it is* forever.

"Untouched" for the tiers is the newest of: the shallow tree mtime (the worktree
and two levels below it, `latestTreeMtimeMs`), the git-dir mtime (`index`, `HEAD`,
`logs/HEAD`) and the newest commit (`git log -1 --format=%ct`). A worktree with a
process or agent session inside, `locked`, or `recent` by the removal rules never
reaches a tier (those rules run first).

| Tier | When | What |
|---|---|---|
| **strip** | kept as `dirty` or `not-merged`, untouched ≥ **3 days** (≥ **1 day** under low disk, or once the WorkItem that worked in it finished) | delete its regenerable dirs: `node_modules`, `.next`, `dist`, `.turbo`, `.cache` (`RECLAIM_DIRS`), found ≤ 3 levels deep, symlinks removed as links. A directory **git tracks anything under** is never deleted (`git ls-files -- <dir>` non-empty; a repo that commits `dist`). Source and tracked files are untouched. The owning team's lead (else the orchestrator) is told once per worktree: path, why it is kept, days idle, dirs, MB, "run `npm install` before using it again". |
| **archive** | kept as `dirty` or `not-merged`, untouched ≥ **14 days** | save its work as one patch under `<CREWLY_HOME>/worktree-archive/<repo basename>/<worktree basename>-<date>.patch`: a `#` header (repo, worktree, branch, HEAD, default ref, unmerged commit count, how to apply), `git diff --binary HEAD` (tracked changes, staged or not), then one `git diff --no-index` hunk per untracked, non-regenerable file (`git ls-files --others --exclude-standard`, filtered by `isRegenerablePath`). Capped at 64 MB and 2000 files; files that would push it over are listed in a trailer. The **branch is kept** (its commits stay in the repo); a detached HEAD with commits not on the default branch gets `refs/crewly-archive/<name>-<date>`. Then `git worktree remove --force` (the dirt was just archived) and `git worktree prune`. The lead is told once: patch path, what it holds, where the commits are, "check out the branch in a new worktree and `git apply --3way` the patch". If the patch cannot be written (tracked diff over the cap, git error) or removal fails, the worktree stays (`tier.action = failed`, patch left in place when it was written). |

Verdicts carry `tier: { tier, idleMs, action: done | would | failed, dirs?, freedBytes, patch?, error? }`;
`reclaimed` keeps its pre-#1354 meaning (a low-disk reclaim, done or planned). The
summary gains `archived`, `archivedBytes`, `freed` (bytes by kind) and
`retentionArmed`. Managed per-WorkItem worktrees (`.crewly/worktrees`, #814) are
only stripped — never archived — and only once their WorkItem finished; their
shared symlinks are kept (`keepSymlinks`). The pass logs
`Worktree janitor: removed N (k archived as patches, X GB), kept M (…), stripped Y GB …; not yet armed: would strip a (Z GB), archive b`.

### Task-end hook

`requestTidy(workItemId)` is called for `task:done`, `task:verified`,
`task:cancelled` and `task:failed`. Besides the debounced tidy pass (unchanged:
a landed worktree is removed at once), the WorkItem's worktree
(`metadata.worktree.path`, recorded by the per-WorkItem worktree feature) is noted
as **finished** in `<CREWLY_HOME>/worktree-tiers.json`; its strip tier then needs
1 day untouched instead of 3. Worktrees Claude Code's own worktree tool created for
a task are not linked to a WorkItem, so they get the 3-day tier. `worktree-tiers.json`
also remembers which worktrees were stripped / archived (so the lead is told once);
records of worktrees that no longer exist, and anything older than 30 days, are
pruned each pass.

### Harness-created worktrees share dependencies

The per-WorkItem worktree feature already symlinked the root `node_modules`. It now
also symlinks every workspace package's `node_modules` (`backend/node_modules`,
`packages/ui/node_modules`, ≤ 2 levels deep) when the lock file
(`package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`) is byte-identical in repo and
worktree (`nestedInstallDirs`); a branch that changed the lock gets its own install.
Tracked dirs are still skipped. Agents that create worktrees themselves (Claude
Code's worktree tool, the developer role's `git worktree add`) are told in the
prompt hint and the developer prompt to symlink `node_modules` from the main
checkout instead of `npm install` when the lock is unchanged.

## Transcript retention (crewly#1354)

Claude Code keeps every conversation under `<claude home>/projects/<cwd slug>/<id>.jsonl`
plus a sibling `<id>/` directory (tool results) and prunes them after 30 days at most.
Agents write far more than a person (10 GB on one Mac, half older than a week), and
agents on the default account share `~/.claude` with the owner's own sessions, so a
shorter blanket retention would hit the owner. Once a day
(`TRANSCRIPT_SWEEP_INTERVAL_MS`) the pass sweeps `~/.claude` and every account config
dir under `<CREWLY_HOME>/claude-accounts/*` that has a `projects/` folder.

A transcript is **Crewly-launched** when either

- its id is one Crewly recorded: `session-state.json` (`sessions[].claudeSessionId`),
  `last-conversations.json`, or the body of a handover file newer than 30 days
  (`<CREWLY_HOME>/handover/*.md`, UUIDs), or the live session persistence; or
- the head of the file (first 256 KB) carries Claude Code's `agentSetting` entry
  (written when Claude is launched with `--agent <name>`, which Crewly always does)
  naming a **known Crewly session**: the orchestrator, every persisted / remembered /
  live session name, every team member's `sessionName`, and the session names in
  handover file names.

Everything else is `foreign` and never touched, read or counted beyond its
existence. A Crewly-launched transcript is pruned (file + sibling dir) when the newer
of its mtime and the sibling dir's is older than **14 days** and its id is not the
current conversation of a live, persisted or remembered session (`keepIds`,
reason `live-session`). The summary lists pruned / would-prune / live / failed
transcripts and counts `recent` and `foreign`. Log line:
`Transcript janitor: pruned N agent transcript(s) older than 14 days, freed X; scanned S in H home(s), kept …`.

## `~/.crewly/tmp` and logs (crewly#1354)

Every 6 hours (`TMP_SWEEP_INTERVAL_MS`) the pass sweeps `<CREWLY_HOME>/tmp`, where
agents, skills and Crewly put scratch output and nothing ever removed it:

- a top-level entry whose shallow tree mtime (two levels) is older than **7 days** is
  removed;
- sub-directories with their own per-child policy stay, their children are swept by
  age: `slack-files`, `slack-images`, `slack-pdfs` **30 days**; `crewly-web-release`
  **2 days**; `skill-output` **7 days**;
- never removed: symlinks (`symlink`), anything a process or agent session has as
  cwd (`process-inside` / `agent-session-inside`; probe failed → everything kept,
  `cwd-probe-failed`), and any entry holding a git checkout within two levels
  (`contains-git`) — a linked worktree in tmp belongs to the worktree rules
  (`<CREWLY_HOME>/tmp` was added to their discovery roots), a clone may be the only
  copy of its history.

Then the log caps: `<CREWLY_HOME>/logs/archive` is kept under **300 MB** and
`logs/sessions` under **100 MB** by deleting the oldest files first. A file written
in the last hour, or the log of a live / persisted session (`<session>.log`), is never
deleted; what stays over the cap because of that is reported (`overCapBytes`).
Log lines: `Tmp janitor: removed N entries of <root>, freed X, kept M (…)`,
`Log janitor: <dir> was X (cap Y), deleted N oldest file(s), freed Z`.

## Arming (first pass reports only)

Every delete added in crewly#1354 — the strip tier outside low disk, the archive
tier, transcripts, tmp and logs — is **dry-run until one day after the first real
pass** that ran this code. That pass writes `retentionArmedAt` into
`disk-janitor-state.json`, logs
`Disk janitor: first pass with worktree tiers and transcript/tmp/log retention — reporting only today, deleting from tomorrow`
and reports what it would do (counts and MB, in the summary and the log lines marked
"dry run, not yet armed"). From the next day the same passes delete. This includes the
1-day strip under low disk, which replaces the old low-disk reclaim (same dirs plus
`dist` / `.turbo` / `.cache`, with the tracked-dir check): a machine that is already
low when it updates still gets one reporting-only day. `GET /api/worktree-janitor/worktrees`
(`plan()`) stays a pure dry run and never arms.

## Low-disk guard

Every 10 minutes the janitor reads the free space (`fs.statfs`, blocks available to
the user) and the size (`blocks × bsize`) of the volume holding `CREWLY_HOME`.

- **Low** = free below **max(15 GB, 8 % of the disk)** (`LOW_DISK_FRACTION`; a 926 GB
  Mac already misbehaves at 5–8 % free, so its mark is ≈74 GB; a 100 GB disk keeps
  15 GB). A pass runs at once (unless one ran in the last 30 minutes). Every pass that
  starts while space is low uses halved idle thresholds, never below 2 hours
  (worktrees 2 h / 12 h, scratch 36 h) and the 1-day strip tier.
- **Still low after the pass**: the owner gets one Slack notice through the usual
  owner-notification path (`SlackService.sendNotification`, the owner DM), at most
  once per 24 hours. It says how much is free of how much, what the pass freed by
  kind ("Today I freed 3.2 GB (node_modules of idle worktrees 2.1 GB, old agent
  transcripts 1.1 GB), but it is not enough."), the 5 biggest items the janitor left
  with path, size and the reason in plain words ("has commits that were never
  pushed"), and that it only cleans what agents left behind — the owner's own files,
  downloads and app caches are never touched.
- **Critical** = free below **max(5 GB, 3 % of the disk)** (`CRITICAL_DISK_FRACTION`):
  the notice is marked urgent (critical urgency, "URGENT" title) and may repeat every
  6 hours.

A notice that could not be delivered (Slack not connected) is not recorded, so the
next check retries. When the owner was last told is kept in
`<CREWLY_HOME>/disk-janitor-state.json` (and in memory, when a full disk refuses the
write). The kill switch `CREWLY_WORKTREE_JANITOR=0` also stops the guard.

All thresholds are in `WORKTREE_JANITOR_CONSTANTS` (`backend/src/constants.ts`).
State files under `CREWLY_HOME`: `disk-janitor-state.json` (notice cadence,
`retentionArmedAt`, last transcript / tmp sweep), `unmerged-worktree-notices.json`,
`worktree-tiers.json` (stripped / archived / finished per worktree path).

## API

These routes are under `/api`, with the same API-token middleware as every other route.

- `GET /api/worktree-janitor/worktrees`: dry run. It returns the verdict and reason
  for every worktree (with its `tier`, when one is reached), the scratch sweep plan
  (`scratch`: per session dir verdict), the transcript / tmp / log plans when they
  are due (`transcripts`, `tmp`, `logs`), `lowDisk` / `freeBytes` / `totalBytes` /
  `retentionArmed` as seen by the pass, the current free space
  (`disk: { path, freeBytes, totalBytes, lowBytes, criticalBytes, level }`), plus
  `disabled` and `lastRun`. It removes nothing, but may run `git fetch`.
- `POST /api/worktree-janitor/run`: runs one pass now. Returns 409 when the kill
  switch is on.

## Known limits

- The task-end hook only knows worktrees the per-WorkItem worktree feature
  recorded; a worktree Claude Code's own tool made for a task gets the 3-day tier.
- A full clone (not a linked worktree) under `~/.crewly/tmp` is never removed by the
  tmp sweep (`contains-git`); the scratch rules only cover Claude Code's session dirs.
- The archive patch restores on a checkout of the same HEAD; a worktree whose tracked
  diff alone exceeds 64 MB is kept (`archive-failed`).
- A Crewly-launched transcript whose `agentSetting` names a session that no longer
  appears anywhere (team deleted, no handover, no record) is treated as foreign.

- Ignored files inside a removed worktree or session dir are deleted with it, for
  example a copied `.env` or gitignored `.crewly/` notes.
- A Claude Code session that is still open but has not touched its scratch dir
  for 3 days (36 h in low-disk mode) can lose its scratch clone if that clone is
  clean and fully pushed. Claude Code's own process runs in the project dir, not
  the scratch dir, so the cwd probe does not protect it.
- A symlinked `node_modules` counts as untracked unless an ignore rule matches the
  symlink. `node_modules/` with a trailing slash matches only directories;
  `node_modules` or `/node_modules` matches the symlink too. Such worktrees are kept
  as `dirty`.
