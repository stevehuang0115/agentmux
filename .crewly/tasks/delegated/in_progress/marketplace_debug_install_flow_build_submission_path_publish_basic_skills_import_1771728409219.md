# Marketplace: Debug Install Flow + Build Submission Path + Publish Basic Skills

IMPORTANT: Codebase audit first! The marketplace already has extensive backend/frontend/CLI code. Read these files BEFORE writing anything:
- backend/src/services/marketplace/marketplace.service.ts
- backend/src/services/marketplace/marketplace-installer.service.ts
- backend/src/controllers/marketplace/marketplace.routes.ts
- frontend/src/pages/Marketplace.tsx
- frontend/src/services/marketplace.service.ts
- cli/src/commands/install.ts
- cli/src/utils/marketplace.ts
- backend/src/types/marketplace.types.ts

Also read the marketing site registry:
- /Users/yellowsunhy/Desktop/projects/stevesprompt/apps/crewly/content/registry.json
- /Users/yellowsunhy/Desktop/projects/stevesprompt/apps/crewly/src/app/api/registry/route.ts
- /Users/yellowsunhy/Desktop/projects/stevesprompt/apps/crewly/src/app/api/assets/[...path]/route.ts

You decide the phasing (A/B/C), but the priorities are:

## Priority 1: Fix Frontend Install Flow
The frontend Marketplace page has Install/Uninstall/Update buttons but they reportedly don't work. Debug and fix:
- Test the full flow: browse → click Install → skill downloads and installs
- Check API connectivity (frontend → backend /api/marketplace/:id/install)
- Check the marketing site registry URL is reachable from backend
- Verify SHA-256 checksum + tar.gz extraction works
- Make sure installed skills appear correctly in the UI

## Priority 2: Build Submission Path
There's no way to publish/submit skills. Build:
1. CLI command: `crewly publish` — packages a skill directory into tar.gz, generates/validates skill.json, uploads
2. Backend submission API: receives skill package, validates structure (skill.json + execute.sh required), stores asset
3. Registry update mechanism: new submissions get added to registry
4. Basic validation: skill.json schema check, file size limits, required files present

## Priority 3: Develop Basic Skills
Create 3-5 useful skills and publish them to the marketplace. Ideas:
- A git helper skill (commit, PR creation)
- A documentation generator skill
- A test runner skill
- A deployment helper skill
Each skill needs: execute.sh, skill.json, instructions.md, and should be packaged + added to registry.

Write co-located tests for all new code. Run npm run build to verify.

After completing each phase, report status.

## Task Information
- **Priority**: high
- **Milestone**: delegated
- **Created at**: 2026-02-22T02:46:49.219Z
- **Status**: In Progress

## Assignment Information
- **Assigned to**: crewly-core-sam-217bfbbf
- **Assigned at**: 2026-02-22T02:46:49.219Z
- **Status**: In Progress

## Task Description

Marketplace: Debug Install Flow + Build Submission Path + Publish Basic Skills

IMPORTANT: Codebase audit first! The marketplace already has extensive backend/frontend/CLI code. Read these files BEFORE writing anything:
- backend/src/services/marketplace/marketplace.service.ts
- backend/src/services/marketplace/marketplace-installer.service.ts
- backend/src/controllers/marketplace/marketplace.routes.ts
- frontend/src/pages/Marketplace.tsx
- frontend/src/services/marketplace.service.ts
- cli/src/commands/install.ts
- cli/src/utils/marketplace.ts
- backend/src/types/marketplace.types.ts

Also read the marketing site registry:
- /Users/yellowsunhy/Desktop/projects/stevesprompt/apps/crewly/content/registry.json
- /Users/yellowsunhy/Desktop/projects/stevesprompt/apps/crewly/src/app/api/registry/route.ts
- /Users/yellowsunhy/Desktop/projects/stevesprompt/apps/crewly/src/app/api/assets/[...path]/route.ts

You decide the phasing (A/B/C), but the priorities are:

## Priority 1: Fix Frontend Install Flow
The frontend Marketplace page has Install/Uninstall/Update buttons but they reportedly don't work. Debug and fix:
- Test the full flow: browse → click Install → skill downloads and installs
- Check API connectivity (frontend → backend /api/marketplace/:id/install)
- Check the marketing site registry URL is reachable from backend
- Verify SHA-256 checksum + tar.gz extraction works
- Make sure installed skills appear correctly in the UI

## Priority 2: Build Submission Path
There's no way to publish/submit skills. Build:
1. CLI command: `crewly publish` — packages a skill directory into tar.gz, generates/validates skill.json, uploads
2. Backend submission API: receives skill package, validates structure (skill.json + execute.sh required), stores asset
3. Registry update mechanism: new submissions get added to registry
4. Basic validation: skill.json schema check, file size limits, required files present

## Priority 3: Develop Basic Skills
Create 3-5 useful skills and publish them to the marketplace. Ideas:
- A git helper skill (commit, PR creation)
- A documentation generator skill
- A test runner skill
- A deployment helper skill
Each skill needs: execute.sh, skill.json, instructions.md, and should be packaged + added to registry.

Write co-located tests for all new code. Run npm run build to verify.

After completing each phase, report status.
