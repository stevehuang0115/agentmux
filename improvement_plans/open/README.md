# AI Employee Hub - Implementation Tasks

This folder contains detailed implementation tasks for transforming AgentMux into a comprehensive **AI Employee Hub**.

## Overview

The implementation plan covers:
1. **Settings & Roles System** - Manage AI agent personas with default prompts and skills
2. **Skills System** - Evolving from SOP with prompts, scripts, and browser automation
3. **Chat-Based Dashboard** - Conversational interface with the Orchestrator
4. **Slack Integration** - Mobile communication with orchestrator via Slack
5. **Self-Improvement** - Enable orchestrator to safely modify AgentMux codebase

---

## Sprint Organization

### Sprint 1: Foundation (Settings + Roles)

| # | Task | Description | Dependencies |
|---|------|-------------|--------------|
| 23 | [Role Types](./23-role-types.md) | TypeScript type definitions for roles | None |
| 24 | [Role Service](./24-role-service.md) | Backend service for role management | 23 |
| 25 | [Settings Service](./25-settings-service.md) | Backend service for app settings | None |
| 26 | [Settings Controllers](./26-settings-controllers.md) | REST API endpoints for settings/roles | 24, 25 |
| 27 | [Frontend Settings Page](./27-frontend-settings-page.md) | React settings page with tabs | 26 |

### Sprint 2: Skills System

| # | Task | Description | Dependencies |
|---|------|-------------|--------------|
| 28 | [Skill Types](./28-skill-types.md) | TypeScript type definitions for skills | None |
| 29 | [Skill Service](./29-skill-service.md) | Backend service for skill management | 28 |
| 30 | [Skill Executor](./30-skill-executor-service.md) | Service for executing skills | 28, 29 |
| 35 | [Default Roles & Skills](./35-default-roles-skills.md) | Built-in configuration files | 24, 29 |

### Sprint 3: Chat System Backend

| # | Task | Description | Dependencies |
|---|------|-------------|--------------|
| 31 | [Chat Types & Service](./31-chat-types-service.md) | Types and backend service for chat | None |
| 32 | [Chat Controller & WebSocket](./32-chat-controller-websocket.md) | REST API and WebSocket integration | 31 |

### Sprint 4: Chat UI + Integration

| # | Task | Description | Dependencies |
|---|------|-------------|--------------|
| 33 | [Frontend Chat Components](./33-frontend-chat-components.md) | React chat components and dashboard | 31, 32 |

### Sprint 5: Orchestrator Enhancement

| # | Task | Description | Dependencies |
|---|------|-------------|--------------|
| 34 | [Orchestrator Enhancements](./34-orchestrator-enhancements.md) | Updated prompts and MCP tools | All previous |

### Integration Gap Tasks

These tasks address integration gaps identified after the main implementation. They ensure all components are properly connected and accessible.

| # | Task | Description | Priority | Dependencies |
|---|------|-------------|----------|--------------|
| 36 | [Settings Services Index](./36-settings-services-index.md) | Create barrel export for settings services | Critical | 24, 25 |
| 37 | [Frontend Settings Route](./37-frontend-settings-route.md) | Add Settings route to App.tsx | Critical | 27 |
| 38 | [Frontend Chat Provider](./38-frontend-chat-provider.md) | Add ChatProvider wrapper to App | Critical | 33 |
| 39 | [Frontend Skill Types](./39-frontend-skill-types.md) | Create frontend skill types | Medium | 28 |
| 40 | [Frontend Types Exports](./40-frontend-types-exports.md) | Update types index exports | Medium | 39 |
| 41 | [Frontend Settings Navigation](./41-frontend-settings-navigation.md) | Add Settings link to navigation | Medium | 37 |
| 42 | [Skill Controller](./42-skill-controller.md) | Create Skill REST controller (optional) | Low | 29, 30 |

### Sprint 6: Slack Integration

Enable mobile communication with the orchestrator via Slack.

| # | Task | Description | Priority | Dependencies |
|---|------|-------------|----------|--------------|
| 43 | [Slack Types](./43-slack-types.md) | TypeScript types for Slack integration | High | None |
| 44 | [Slack Service](./44-slack-service.md) | Slack bot connection and messaging | High | 43 |
| 45 | [Slack-Orchestrator Bridge](./45-slack-orchestrator-bridge.md) | Route messages between Slack and orchestrator | High | 43, 44 |
| 46 | [Slack Controller](./46-slack-controller.md) | REST API for Slack management | High | 44, 45 |

### Sprint 7: Self-Improvement & Persistence

Enable the orchestrator to safely modify the AgentMux codebase and resume after restarts.

| # | Task | Description | Priority | Dependencies |
|---|------|-------------|----------|--------------|
| 47 | [Orchestrator State Types](./47-orchestrator-state-types.md) | Types for state persistence | High | None |
| 48 | [State Persistence Service](./48-orchestrator-state-service.md) | Save/restore orchestrator state | High | 47 |
| 49 | [Safe Restart Service](./49-safe-restart-service.md) | Graceful shutdown and restart | High | 47, 48 |
| 50 | [Self-Improvement Service](./50-self-improvement-service.md) | Safe codebase modification workflow | High | 47, 48, 49 |

### Sprint 8: Hot-Reload Resilience

Make self-improvement work correctly with `npm run dev` hot-reload.

| # | Task | Description | Priority | Dependencies |
|---|------|-------------|----------|--------------|
| 51 | [Improvement Marker System](./51-self-improvement-marker.md) | Persistent marker file for state across restarts | Critical | 50 |
| 52 | [Startup Hook](./52-self-improvement-startup-hook.md) | Validate/rollback on startup after hot-reload | Critical | 51 |
| 53 | [Integration Update](./53-self-improvement-integration.md) | Update SelfImprovementService to use markers | Critical | 51, 52 |

### Sprint 9: Implementation Gap Fixes

These tasks address gaps found after initial implementation was marked complete.

#### Backend Gaps

| # | Task | Description | Priority | Dependencies |
|---|------|-------------|----------|--------------|
| 54 | [Backend Services Exports](./54-backend-services-exports.md) | Add Slack/Orchestrator exports to services index | Critical | 44, 48 |
| 55 | [Slack Startup Initialization](./55-slack-startup-initialization.md) | Initialize Slack service on backend startup | High | 44, 45 |
| 56 | [Self-Improve MCP Tool](./56-self-improve-mcp-tool.md) | Add self_improve tool to MCP server | High | 50-53 |
| 57 | [Orchestrator Prompt Update](./57-orchestrator-prompt-update.md) | Add Slack and self-improvement instructions | High | 44-46, 50-53 |

#### Frontend Gaps

| # | Task | Description | Priority | Dependencies |
|---|------|-------------|----------|--------------|
| 58 | [Frontend Skills Service](./58-frontend-skills-service.md) | Create skills.service.ts for API calls | High | 42 |
| 59 | [useSkills Real API](./59-useskills-real-api.md) | Update useSkills hook to use real API | High | 58 |
| 60 | [SkillsTab Full Implementation](./60-skillstab-full-implementation.md) | Remove placeholder, implement full skill management | Medium | 59 |
| 61 | [Chat-Centric Dashboard](./61-chat-centric-dashboard.md) | Transform Dashboard to chat interface | Critical | 33, 38 |

### Sprint 10: Browser-Tested Gap Fixes

These gaps were identified through thorough browser testing of the running application.

#### Critical Fixes

| # | Task | Description | Priority | Dependencies |
|---|------|-------------|----------|--------------|
| 62 | [Roles API 500 Fix](./62-roles-api-500-fix.md) | Fix Roles tab returning HTTP 500 error | Critical | 24 |
| 63 | [Orchestrator Setup Endpoint](./63-orchestrator-setup-endpoint.md) | Create proper orchestrator startup flow | Critical | 48, 50 |
| 66 | [Chat-Orchestrator Connection](./66-chat-orchestrator-connection.md) | Connect chat UI to orchestrator responses | Critical | 31, 32, 63 |

#### Feature Completions

| # | Task | Description | Priority | Dependencies |
|---|------|-------------|----------|--------------|
| 64 | [Slack Integration UI](./64-slack-integration-ui.md) | Add Slack tab to Settings for configuration | High | 44, 46 |
| 65 | [Default Skills Configuration](./65-default-skills-configuration.md) | Create built-in skills that ship with AgentMux | High | 29 |

### Sprint 11: UI Consistency Fixes

These tasks address user feedback about UI consistency, styling issues, and build from atomic reusable components.

#### Critical Bug Fixes

| # | Task | Description | Priority | Dependencies |
|---|------|-------------|----------|--------------|
| 70 | [Dashboard Loading Fix](./70-dashboard-loading-fix.md) | Fix Dashboard stuck at "Loading dashboard..." state | Critical | None |

#### Atomic Component System

Build UI from ground up using atomic, reusable components with consistent theming.

| # | Task | Description | Priority | Dependencies |
|---|------|-------------|----------|--------------|
| 71 | [Atomic UI Component System](./71-atomic-ui-component-system.md) | Create design tokens and atomic components (Card, Input, Badge, Tabs, Alert) | High | None |
| 72 | [Chat UI Consistency](./72-chat-ui-consistency.md) | Refactor Chat page to use atomic components and dark theme | High | 71 |
| 73 | [Settings UI Consistency](./73-settings-ui-consistency.md) | Refactor Settings page to use atomic components and dark theme | High | 71 |

#### Legacy Tasks (Superseded)

| # | Task | Description | Status |
|---|------|-------------|--------|
| 67 | [Restore Original Dashboard](./67-restore-original-dashboard.md) | Restore cards-based dashboard layout | Superseded by 70 |
| 68 | [Dedicated Chat Page](./68-dedicated-chat-page.md) | Move chat interface to dedicated /chat route | Still valid |
| 69 | [Settings UI Consistency](./69-settings-ui-consistency.md) | Fix Settings page styling (old approach) | Superseded by 73 |

---

## Recommended Implementation Order

```
Phase 1 (Can run in parallel):
├── 23-role-types.md
├── 25-settings-service.md
├── 28-skill-types.md
└── 31-chat-types-service.md

Phase 2 (After Phase 1):
├── 24-role-service.md (depends on 23)
├── 29-skill-service.md (depends on 28)
└── 32-chat-controller-websocket.md (depends on 31)

Phase 3 (After Phase 2):
├── 26-settings-controllers.md (depends on 24, 25)
├── 30-skill-executor-service.md (depends on 28, 29)
├── 36-settings-services-index.md (depends on 24, 25) [INTEGRATION]
└── 35-default-roles-skills.md (depends on 24, 29)

Phase 4 (After Phase 3):
├── 27-frontend-settings-page.md (depends on 26)
├── 33-frontend-chat-components.md (depends on 31, 32)
├── 39-frontend-skill-types.md (depends on 28) [INTEGRATION]
└── 40-frontend-types-exports.md (depends on 39) [INTEGRATION]

Phase 5 (After Phase 4):
├── 37-frontend-settings-route.md (depends on 27) [INTEGRATION]
├── 38-frontend-chat-provider.md (depends on 33) [INTEGRATION]
├── 41-frontend-settings-navigation.md (depends on 37) [INTEGRATION]
└── 42-skill-controller.md (depends on 29, 30) [OPTIONAL]

Phase 6 (Slack Integration):
├── 43-slack-types.md (no dependencies)
├── 44-slack-service.md (depends on 43)
├── 45-slack-orchestrator-bridge.md (depends on 43, 44)
└── 46-slack-controller.md (depends on 44, 45)

Phase 7 (Self-Improvement & Persistence):
├── 47-orchestrator-state-types.md (no dependencies)
├── 48-orchestrator-state-service.md (depends on 47)
├── 49-safe-restart-service.md (depends on 47, 48)
└── 50-self-improvement-service.md (depends on 47, 48, 49)

Phase 8 (Hot-Reload Resilience):
├── 51-self-improvement-marker.md (depends on 50)
├── 52-self-improvement-startup-hook.md (depends on 51)
└── 53-self-improvement-integration.md (depends on 51, 52)

Phase 9 (Gap Fixes - Backend):
├── 54-backend-services-exports.md (depends on 44, 48) [GAP FIX]
├── 55-slack-startup-initialization.md (depends on 44, 45) [GAP FIX]
├── 56-self-improve-mcp-tool.md (depends on 50-53) [GAP FIX]
└── 57-orchestrator-prompt-update.md (depends on 44-46, 50-53) [GAP FIX]

Phase 10 (Gap Fixes - Frontend):
├── 58-frontend-skills-service.md (depends on 42) [GAP FIX]
├── 59-useskills-real-api.md (depends on 58) [GAP FIX]
└── 60-skillstab-full-implementation.md (depends on 59) [GAP FIX]
# Note: Task 61 (chat-centric-dashboard) is superseded by tasks 67-68

Phase 11 (UI Consistency Fixes - Atomic Component Approach):
├── 70-dashboard-loading-fix.md (no dependencies) [CRITICAL BUG]
├── 71-atomic-ui-component-system.md (no dependencies) [FOUNDATION]
├── 72-chat-ui-consistency.md (depends on 71) [UI FIX]
├── 73-settings-ui-consistency.md (depends on 71) [UI FIX]
└── 68-dedicated-chat-page.md (depends on 70) [UI FIX]

Phase 12 (Final):
└── 34-orchestrator-enhancements.md (depends on all)
```

---

## Key Design Decisions

1. **Skill Execution**: Agents decide autonomously - no approval workflow needed
2. **Chat Scope**: Global conversation with orchestrator across all projects
3. **Browser Automation**: Uses Claude's Chrome Extension (claude-in-chrome MCP)
4. **Response Formatting**: Agents use `[CHAT_RESPONSE]` markers for clean output
5. **Slack Integration**: Uses Socket Mode for real-time communication without webhooks
6. **State Persistence**: Orchestrator state saved to `~/.agentmux/state/` with periodic checkpoints
7. **Self-Improvement Safety**: Backup + validation + automatic rollback on failure

---

## File Summary

### Backend Files to Create

```
backend/src/
├── types/
│   ├── role.types.ts + test
│   ├── skill.types.ts + test
│   ├── chat.types.ts + test
│   ├── settings.types.ts + test
│   ├── slack.types.ts + test [43]
│   └── orchestrator-state.types.ts + test [47]
├── services/
│   ├── index.ts (update exports)
│   ├── settings/
│   │   ├── index.ts (barrel export) [36]
│   │   ├── role.service.ts + test
│   │   └── settings.service.ts + test
│   ├── skill/
│   │   ├── skill.service.ts + test
│   │   └── skill-executor.service.ts + test
│   ├── chat/
│   │   └── chat.service.ts + test
│   ├── slack/ [44-46]
│   │   ├── index.ts
│   │   ├── slack.service.ts + test
│   │   ├── slack-orchestrator-bridge.ts + test
│   │   └── slack-initializer.ts
│   └── orchestrator/ [48-53]
│       ├── index.ts
│       ├── state-persistence.service.ts + test
│       ├── safe-restart.service.ts + test
│       ├── self-improvement.service.ts + test
│       ├── improvement-marker.service.ts + test [51]
│       └── improvement-startup.service.ts + test [52]
└── controllers/
    ├── index.ts (update routes)
    ├── settings/
    │   ├── role.controller.ts
    │   └── settings.controller.ts
    ├── skill/
    │   ├── index.ts [42]
    │   └── skill.controller.ts + test [42]
    ├── chat/
    │   └── chat.controller.ts
    └── slack/ [46]
        ├── index.ts
        └── slack.controller.ts + test
```

### Frontend Files to Create

```
frontend/src/
├── App.tsx (update: add Settings route [37], ChatProvider [38])
├── pages/
│   └── Settings.tsx + test
├── components/
│   ├── Layout/
│   │   └── Sidebar.tsx (update: add Settings link [41])
│   ├── Settings/
│   │   ├── GeneralTab.tsx + test
│   │   ├── RolesTab.tsx + test
│   │   ├── SkillsTab.tsx + test
│   │   └── RoleEditor.tsx + test
│   └── Chat/
│       ├── ChatPanel.tsx + test
│       ├── ChatMessage.tsx + test
│       ├── ChatInput.tsx + test
│       ├── ChatSidebar.tsx + test
│       └── TypingIndicator.tsx + test
├── contexts/
│   └── ChatContext.tsx + test
├── types/
│   ├── index.ts (update: export new types [40])
│   ├── role.types.ts + test
│   ├── settings.types.ts + test
│   ├── chat.types.ts + test
│   └── skill.types.ts + test [39]
└── services/
    └── chat.service.ts + test
```

### Config Files to Create

```
config/
├── roles/
│   ├── developer/
│   ├── product-manager/
│   ├── qa-engineer/
│   ├── designer/
│   ├── sales/
│   └── support/
└── skills/
    ├── development/
    │   ├── code-review/
    │   ├── testing/
    │   └── documentation/
    ├── design/
    │   ├── image-generation/
    │   └── video-generation/
    └── integration/
        ├── github/
        └── slack/
```

---

## Testing Requirements

All tasks require:
- Unit tests for services and utilities
- Integration tests for API endpoints
- Component tests for React components
- Minimum 80% code coverage
- Test files placed next to source files

---

## Notes

- Each task file contains detailed implementation specifications
- Follow the project's CLAUDE.md guidelines for code standards
- All source files must have corresponding test files
- Update system specs when making architectural changes

---

## Getting Started

1. Start with **Phase 1** tasks (they have no dependencies)
2. Each task contains:
   - Implementation details with code examples
   - File structure to create
   - Acceptance criteria checklist
   - Testing requirements
3. Mark tasks as complete by moving to `../done/` folder
