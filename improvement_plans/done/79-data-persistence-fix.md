# Task 79: Fix Data Persistence - Projects and Teams Disappearing

## Priority: Critical

## Problem

Data created through the UI (projects, teams) disappears after page refresh or navigation. This is a critical bug that makes the application unusable.

### Observed Behavior
1. Created "web-visa" project via Projects page
2. Created "Support Team" with 2 agents via Teams page
3. Started the team with project assignment - showed success
4. Agents started successfully (verified in terminal)
5. After navigating away or refreshing:
   - Projects page shows "No projects yet"
   - Teams page only shows "Orchestrator Team"
   - Support Team and web-visa project are gone

### Expected Behavior
- Created projects should persist and show in Projects list
- Created teams should persist and show in Teams list
- Data should survive page refresh and navigation
- Data should be properly saved to storage (~/.agentmux/)

## Root Cause Analysis

Possible issues:

### 1. Storage Service Not Writing to Disk
The storage service might not be properly persisting data to the JSON files.

```typescript
// Check if data is being written to:
// ~/.agentmux/projects.json
// ~/.agentmux/teams.json
```

### 2. API Not Calling Storage Service
The create endpoints might not be calling the storage save methods.

```typescript
// backend/src/controllers/project.controller.ts
// backend/src/controllers/team/team.controller.ts
```

### 3. In-Memory Only State
Data might only be stored in memory and not persisted to disk.

### 4. File Path Issues
The storage path might be incorrect or inaccessible.

## Investigation Steps

### 1. Check Storage Files

```bash
# Check if files exist and have content
cat ~/.agentmux/projects.json
cat ~/.agentmux/teams.json

# Watch for changes when creating
watch -n 1 'cat ~/.agentmux/projects.json'
```

### 2. Check Backend Logs

```bash
# Look for storage-related errors
tail -f ~/.agentmux/logs/server.log | grep -i storage
```

### 3. Test API Directly

```bash
# Create project via API
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "path": "/tmp/test"}'

# Check if it persisted
curl http://localhost:3000/api/projects
```

### 4. Review Storage Service

Check `backend/src/services/storage.service.ts`:
- Is `saveProject()` actually writing to disk?
- Is `saveTeam()` actually writing to disk?
- Are there async/await issues?

## Files to Investigate

1. `backend/src/services/storage.service.ts` - Core storage logic
2. `backend/src/controllers/project.controller.ts` - Project creation
3. `backend/src/controllers/team/team.controller.ts` - Team creation
4. `~/.agentmux/projects.json` - Project data file
5. `~/.agentmux/teams.json` - Team data file

## Files to Modify

Based on investigation, fix the storage persistence issue.

## Testing Requirements

1. Create project → verify in storage file → refresh page → project still visible
2. Create team → verify in storage file → refresh page → team still visible
3. Restart backend server → projects and teams still visible
4. Start team with project → both persist after refresh

## Acceptance Criteria

- [ ] Created projects persist across page refresh
- [ ] Created projects persist across server restart
- [ ] Created teams persist across page refresh
- [ ] Created teams persist across server restart
- [ ] Data correctly written to ~/.agentmux/*.json files
- [ ] No data loss during normal operation
