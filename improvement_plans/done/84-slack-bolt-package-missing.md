# Task 84: Install @slack/bolt Package for Slack Integration

## Status: Open
## Priority: High
## Date: 2026-02-01

## Summary
The Slack integration fails to connect because the `@slack/bolt` package is not installed as a dependency.

## Error Message
```
Cannot find package '@slack/bolt' imported from
/Users/yellowsunhy/Desktop/projects/agentmux/backend/src/services/slack/slack.service.ts
```

## Root Cause
The `@slack/bolt` package is imported dynamically in `slack.service.ts` (line 148-149):
```typescript
// Dynamic import of @slack/bolt to handle optional dependency
const { App, LogLevel } = await import('@slack/bolt');
```

However, the package is not listed in `package.json` dependencies.

## Solution
Install the Slack Bolt SDK:
```bash
npm install @slack/bolt
```

Or add to package.json:
```json
"dependencies": {
  "@slack/bolt": "^3.x.x"
}
```

## Testing
1. Install the package
2. Restart the backend server
3. Go to Settings → Slack tab
4. Enter tokens and click "Connect to Slack"
5. Should show "Connected" status instead of error

## Notes
- The tokens in `.env` are valid and correctly formatted
- The backend doesn't auto-load `.env` (no dotenv.config() call)
- Tokens can be entered via frontend form which passes them in request body
