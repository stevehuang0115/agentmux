# Remove the `crewly init` command from the CLI — keep only `crewly onboard` as the single entry point.

Changes needed in `cli/src/index.ts`:
1. Remove lines 76-78 (the `init` command registration)
2. Keep the `onboard` command (lines 80-83) but update its description from 'Alias for "crewly init"' to something like 'Interactive setup wizard for new Crewly users'
3. Make sure no other files reference `crewly init` that need updating (check README.md, docs, etc.)
4. Run `npm run build` to verify it compiles

This is a small cleanup task — should be quick.

## Task Information
- **Priority**: normal
- **Milestone**: delegated
- **Created at**: 2026-02-21T22:36:38.608Z
- **Status**: In Progress

## Assignment Information
- **Assigned to**: crewly-core-sam-217bfbbf
- **Assigned at**: 2026-02-21T22:36:38.608Z
- **Status**: In Progress

## Task Description

Remove the `crewly init` command from the CLI — keep only `crewly onboard` as the single entry point.

Changes needed in `cli/src/index.ts`:
1. Remove lines 76-78 (the `init` command registration)
2. Keep the `onboard` command (lines 80-83) but update its description from 'Alias for "crewly init"' to something like 'Interactive setup wizard for new Crewly users'
3. Make sure no other files reference `crewly init` that need updating (check README.md, docs, etc.)
4. Run `npm run build` to verify it compiles

This is a small cleanup task — should be quick.
