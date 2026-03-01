# CLI Init Gap Resolution

**Author:** Sam (crewly-core-sam)
**Date:** 2026-02-24
**Status:** Complete

## Problem

All planning docs (roadmap, gap matrix, decision brief, taskboard, blog) reference `npx crewly init` as the onboarding command, but the CLI only had `crewly onboard`. Users following docs would get "unknown command" errors.

## Decision: Add `init` as alias for `onboard` (Option A)

### Why alias, not rename or docs-only fix

| Option | Pros | Cons |
|--------|------|------|
| **A: Add `init` alias** | Industry standard (`npm init`, `git init`, `cargo init`). Zero breaking change. Both commands work. All planning docs become correct without edits. | Two command names for same thing (minor). |
| B: Rename `onboard` → `init` | Clean single name. | Breaks any existing scripts using `onboard`. README/getting-started.md need updates. |
| C: Docs-only fix | No code changes. | Goes against industry convention. Every planning doc needs editing (30+ references). Blog post needs editing. |

**Chosen: Option A.** One-line code change, zero breaking changes, all docs instantly correct.

## Implementation

### Change

Added `.alias('init')` to the `onboard` command registration in `cli/src/index.ts`:

```typescript
program
  .command('onboard')
  .alias('init')
  .description('Interactive setup wizard for new Crewly users')
  .option('-y, --yes', 'Non-interactive mode: use all defaults (CI-friendly)')
  .option('--template <id>', 'Select a team template by ID (e.g. web-dev-team)')
  .action(onboardCommand);
```

### Files Changed

| File | Change |
|------|--------|
| `cli/src/index.ts` | Added `.alias('init')` to onboard command (1 line) |

### What Both Commands Now Support

All flags and behaviors are identical:

```
crewly init                        # interactive wizard
crewly init --yes                  # non-interactive with defaults
crewly init --template web-dev-team  # specific template
crewly onboard                     # same as above (original name)
npx crewly init                    # works via npx
```

### Help Output Verification

```
$ crewly --help
Commands:
  ...
  onboard|init [options]      Interactive setup wizard for new Crewly users
  ...

$ crewly init --help
Usage: crewly onboard|init [options]

Interactive setup wizard for new Crewly users

Options:
  -y, --yes        Non-interactive mode: use all defaults (CI-friendly)
  --template <id>  Select a team template by ID (e.g. web-dev-team)
  -h, --help       display help for command
```

## Test Results

```
Test Suites: 1 passed, 1 total
Tests:       57 passed, 57 total (all existing onboard tests)
```

No new tests needed — Commander.js alias routing is a framework feature, not custom logic. The existing 57 onboard tests validate all wizard functionality regardless of which command name invoked it.

## Acceptance Criteria Check

| Criterion (from mia-next-2-weeks-taskboard) | Status |
|---------------------------------------------|--------|
| `npx crewly init` runs without errors on macOS | PASS |
| `crewly init --template <id>` creates working team | PASS (via `--template` flag) |
| Templates discoverable in `crewly init` interactive prompt | PASS (Step 4/5) |
| `--yes` flag works for CI | PASS |
| 3-step quickstart works (`npm install -g crewly` → `crewly init` → `crewly start`) | PASS (init alias routes to full onboard wizard) |

## Migration Notes

- **No breaking changes.** `crewly onboard` continues to work exactly as before.
- **No doc updates required.** All 30+ references to `crewly init` in planning docs are now correct.
- **README.md** uses `crewly onboard` — both names now work, no change needed.
- **Blog post** (`docs/blog/01-introducing-crewly.md`) references `crewly init` — now valid.

## Rollback

Remove the `.alias('init')` line from `cli/src/index.ts`. Single-line revert, no side effects.
