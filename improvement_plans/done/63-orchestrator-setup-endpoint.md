# Task 63: Orchestrator Setup Endpoint Integration

## Overview

The UI shows "Orchestrator is managed at system level. Use /orchestrator/setup endpoint instead." when trying to start the orchestrator team. Need to either implement this endpoint or provide proper UI for orchestrator startup.

## Problem

When clicking "Start Team" on the Orchestrator Team page and selecting a project:
1. Error modal appears: "Orchestrator is managed at system level. Use /orchestrator/setup endpoint instead."
2. Users cannot start the orchestrator through the normal team UI
3. Chat messages don't get responses because orchestrator is stopped

## Current State

- Orchestrator shows as "Stopped" in Teams page
- Chat UI accepts messages but gets no response
- No clear way to start orchestrator from UI

## Implementation Options

### Option A: Implement /orchestrator/setup Endpoint

Create a dedicated setup flow for the orchestrator:

**`backend/src/controllers/orchestrator/orchestrator.controller.ts`**

```typescript
import { Router, Request, Response } from 'express';
import { getOrchestratorService } from '../../services/orchestrator/index.js';

const router = Router();

/**
 * POST /api/orchestrator/setup
 * Initialize and start the orchestrator
 */
router.post('/setup', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.body;
    const orchestratorService = getOrchestratorService();

    await orchestratorService.setup({
      projectId,
      autoStart: true,
    });

    res.json({
      success: true,
      message: 'Orchestrator started successfully',
      status: 'running'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to setup orchestrator',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/orchestrator/status
 * Get orchestrator status
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const orchestratorService = getOrchestratorService();
    const status = await orchestratorService.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * POST /api/orchestrator/stop
 * Stop the orchestrator
 */
router.post('/stop', async (_req: Request, res: Response) => {
  try {
    const orchestratorService = getOrchestratorService();
    await orchestratorService.stop();
    res.json({ success: true, message: 'Orchestrator stopped' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to stop orchestrator' });
  }
});

export default router;
```

### Option B: Add Orchestrator Setup to Dashboard

Add a setup banner/wizard to the Dashboard when orchestrator is not running:

```typescript
// frontend/src/components/Chat/OrchestratorSetup.tsx

export const OrchestratorSetup: React.FC = () => {
  const [setting, setSetting] = useState(false);
  const { projects } = useProjects();
  const [selectedProject, setSelectedProject] = useState('');

  const handleSetup = async () => {
    setSetting(true);
    try {
      await fetch('/api/orchestrator/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProject }),
      });
      // Refresh page or update state
    } finally {
      setSetting(false);
    }
  };

  return (
    <div className="orchestrator-setup-banner">
      <h3>Start Orchestrator</h3>
      <p>Select a project to begin working with the orchestrator.</p>
      <select onChange={(e) => setSelectedProject(e.target.value)}>
        <option value="">Select project...</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <button onClick={handleSetup} disabled={!selectedProject || setting}>
        {setting ? 'Starting...' : 'Start Orchestrator'}
      </button>
    </div>
  );
};
```

### Option C: Auto-Start on First Message

Start orchestrator automatically when user sends first chat message:

```typescript
// In ChatPanel or ChatContext
const sendMessage = async (content: string) => {
  // Check if orchestrator is running
  const status = await fetch('/api/orchestrator/status').then(r => r.json());

  if (status.state !== 'running') {
    // Auto-start with current project
    await fetch('/api/orchestrator/setup', {
      method: 'POST',
      body: JSON.stringify({ autoSelectProject: true }),
    });
  }

  // Then send message
  await chatService.sendMessage(content);
};
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `backend/src/controllers/orchestrator/orchestrator.controller.ts` | Create |
| `backend/src/controllers/orchestrator/index.ts` | Create barrel export |
| `backend/src/controllers/index.ts` | Add orchestrator routes |
| `frontend/src/components/Chat/OrchestratorSetup.tsx` | Create (Option B) |
| `frontend/src/components/Chat/ChatPanel.tsx` | Add setup check |

## Acceptance Criteria

- [ ] `/api/orchestrator/setup` endpoint works
- [ ] `/api/orchestrator/status` returns current state
- [ ] Users can start orchestrator from UI
- [ ] Chat messages get responses after orchestrator starts
- [ ] Clear feedback when orchestrator is starting/running/stopped

## Dependencies

- Task 48: State Persistence Service
- Task 50: Self-Improvement Service

## Priority

**Critical** - Chat functionality is unusable without orchestrator
