# Task 80: Fix MCP Server Import Error

## Status: Open
## Priority: High
## Date: 2026-02-01

## Summary
The MCP server fails to start due to a module import error. The `MemoryService` export is not found when trying to import from the backend.

## Error Message
```
/Users/yellowsunhy/Desktop/projects/agentmux/mcp-server/src/server.ts:13
import { MemoryService } from '../../backend/src/services/memory/memory.service.js';
         ^

SyntaxError: The requested module '../../backend/src/services/memory/memory.service.js'
does not provide an export named 'MemoryService'
```

## Root Cause
The MCP server is trying to import `MemoryService` from the backend, but either:
1. The export name has changed
2. The file has been refactored
3. The export is not properly defined

## Impact
- MCP server cannot start
- Agents cannot use MCP tools directly
- Orchestrator has to use REST API workarounds instead of native MCP calls

## Proposed Solution
1. Check `backend/src/services/memory/memory.service.ts` for correct export name
2. Update the import statement in `mcp-server/src/server.ts`
3. Ensure all cross-module imports are compatible

## Files to Check
- `mcp-server/src/server.ts` - Import statement at line 13
- `backend/src/services/memory/memory.service.ts` - Export definition
- `backend/src/services/memory/index.ts` - Re-exports if any

## Testing
```bash
npm run dev:mcp
# Should start without errors
curl -s http://localhost:3001/health
# Should return healthy status
```
