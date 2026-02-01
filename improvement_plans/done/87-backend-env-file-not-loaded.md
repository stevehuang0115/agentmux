# Task 87: Backend Does Not Load .env File Automatically

## Problem
The backend server does not automatically load environment variables from the `.env` file at startup. This causes confusion when users configure Slack tokens in `.env` but the `/api/slack/config` endpoint reports `hasToken: false`.

## Root Cause
The backend entry point (`backend/src/index.ts`) does not import or call `dotenv.config()` to load environment variables from `.env` files.

## Impact
- **Developer Experience**: Confusing setup process
- **Configuration**: Users must manually export env vars or use wrapper scripts
- **Priority**: Medium

## Current Workarounds
1. Export variables in terminal: `export SLACK_BOT_TOKEN=xxx && npm run dev:backend`
2. Use the API to pass tokens directly in request body
3. Configure tokens via Settings page (not persisted)

## Suggested Fix

### Option A: Add dotenv to backend startup
```typescript
// backend/src/index.ts
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
```

### Option B: Update npm scripts
```json
{
  "scripts": {
    "dev:backend": "dotenv -e .env -- npx tsx watch backend/src/index.ts"
  }
}
```

## Testing
1. Add tokens to `.env` file in project root
2. Start backend with `npm run dev:backend`
3. Check `/api/slack/config` returns `hasToken: true`
4. Verify Slack auto-connects on startup

## Related Files
- `backend/src/index.ts` - Entry point
- `.env` - Environment file (project root)
- `package.json` - npm scripts

---
*Created: 2026-02-01*
*Status: Open*
*Priority: Medium*
