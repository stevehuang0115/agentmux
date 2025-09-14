# Agent Management Consolidation Architecture

## Overview

This specification documents the unified agent management architecture that consolidates orchestrator and team member operations to eliminate code duplication and maintain consistency across all agent lifecycle operations.

## Problem Statement

Prior to consolidation, the AgentMux system had duplicate code paths for managing orchestrator agents versus regular team member agents:

- **Duplicate session management** - Separate create/terminate logic for orchestrator vs team members
- **Duplicate messaging** - Different approaches for sending messages to orchestrator vs team members  
- **Duplicate health checks** - Inconsistent health monitoring across agent types
- **Inconsistent status updates** - Different timing for updating agent status in teams.json
- **Hardcoded orchestrator logic** - Special-case code scattered throughout controllers

## Solution Architecture

### Unified AgentRegistrationService

All agent lifecycle operations are consolidated into a single service: `AgentRegistrationService`

**Location**: `/backend/src/services/agent/agent-registration.service.ts`

#### Core Unified Methods

```typescript
// Session Management
async createAgentSession(config: {
  sessionName: string;
  role: string;
  projectPath?: string;
  windowName?: string;
  memberId?: string;
}): Promise<AgentSessionResult>

async terminateAgentSession(
  sessionName: string, 
  role: string
): Promise<AgentOperationResult>

// Communication
async sendMessageToAgent(
  sessionName: string, 
  message: string
): Promise<AgentOperationResult>

async sendKeyToAgent(
  sessionName: string, 
  key: string
): Promise<AgentOperationResult>

// Health Monitoring
async checkAgentHealth(
  sessionName: string, 
  role?: string, 
  timeout?: number
): Promise<AgentHealthResult>
```

### Controller Integration

#### Orchestrator Controller Consolidation

**Location**: `/backend/src/controllers/orchestrator/orchestrator.controller.ts`

**Functions Updated to Use Unified Methods**:

```typescript
// Session Lifecycle
setupOrchestrator() → agentRegistrationService.createAgentSession()
stopOrchestrator() → agentRegistrationService.terminateAgentSession()

// Communication
sendOrchestratorMessage() → agentRegistrationService.sendMessageToAgent()
sendOrchestratorEnter() → agentRegistrationService.sendKeyToAgent()

// Health Monitoring  
getOrchestratorHealth() → agentRegistrationService.checkAgentHealth()

// Task Assignment
assignTaskToOrchestrator() → agentRegistrationService.checkAgentHealth()
                           → agentRegistrationService.sendMessageToAgent()
```

**Functions Remaining Orchestrator-Specific**:
- `getOrchestratorCommands()` - UI command history (orchestrator-specific)
- `executeOrchestratorCommand()` - Orchestrator CLI interface (orchestrator-specific)

#### Team Member Controller Integration

**Location**: `/backend/src/controllers/team/team.controller.ts`

**Functions Using Unified Methods**:
- `createAgentSession()` → `agentRegistrationService.createAgentSession()`
- `terminateAgentSession()` → `agentRegistrationService.terminateAgentSession()`
- `sendMessageToMember()` → `agentRegistrationService.sendMessageToAgent()`
- Health checks → `agentRegistrationService.checkAgentHealth()`

## Implementation Details

### Session Configuration

The unified `createAgentSession()` method handles both orchestrator and team member configurations:

```typescript
// Orchestrator Configuration
{
  sessionName: ORCHESTRATOR_SESSION_NAME,  // 'agentmux-orc'
  role: ORCHESTRATOR_ROLE,                 // 'orchestrator'
  projectPath: process.cwd(),
  windowName: ORCHESTRATOR_WINDOW_NAME     // 'main'
}

// Team Member Configuration  
{
  sessionName: `${teamId}-${memberId}`,
  role: member.role,                       // 'dev', 'qa', etc.
  projectPath: sessionConfig.projectPath,
  memberId: member.id
}
```

### Status Update Strategy

**Immediate Status Updates**: All termination operations immediately update `agentStatus` in `teams.json`:

```typescript
// In terminateAgentSession()
await this.storageService.updateAgentStatus(sessionName, 'inactive');
```

**Background Monitoring**: `ActivityMonitorService` continues to run every 30 seconds for ongoing health monitoring, but critical status changes are updated immediately.

### Error Handling Consistency

All unified methods return consistent result objects:

```typescript
interface AgentOperationResult {
  success: boolean;
  error?: string;
  message?: string;
  sessionName?: string;
  data?: any;
}
```

## Benefits Achieved

### Code Reduction
- **Eliminated duplicate session creation/termination logic**
- **Unified message sending across all agent types**
- **Consistent health checking implementation**
- **Single source of truth for agent operations**

### Consistency
- **Same error handling patterns** across orchestrator and team members
- **Consistent status update timing** (immediate vs delayed)
- **Unified logging and monitoring** for all agent operations
- **Standardized operation result formats**

### Maintainability
- **Single location for agent management logic** changes
- **Reduced risk of drift** between orchestrator and team member behavior
- **Easier testing** with consolidated mock requirements
- **Clear separation** between generic agent operations and orchestrator-specific business logic

## Architecture Boundaries

### What is Consolidated
✅ **Session lifecycle** (create, terminate, health check)
✅ **Communication** (message sending, key sending)
✅ **Status management** (immediate agentStatus updates)
✅ **Error handling patterns**
✅ **Tmux session management**

### What Remains Separate
⚠️ **Orchestrator CLI commands** (`get_team_status`, `list_projects`, etc.)
⚠️ **Command history tracking** (UI-specific functionality)
⚠️ **Orchestrator-specific business logic** (task assignment prompts, etc.)
⚠️ **Frontend routing** (orchestrator routes vs team member routes)

## Migration Impact

### Breaking Changes
- **None** - All existing APIs maintain backward compatibility

### Internal Changes
- **Controller methods updated** to delegate to unified service
- **Test mocks consolidated** to cover unified methods
- **Error responses standardized** across all agent operations

### Performance Impact
- **Positive** - Reduced code paths and consistent caching
- **Improved reliability** - Single implementation reduces bugs
- **Better monitoring** - Unified logging for all agent operations

## Future Considerations

### Extensibility
The unified architecture supports future agent types without code duplication:
- New agent roles can use the same lifecycle methods
- Communication patterns are standardized
- Health monitoring scales automatically

### Configuration Management
Agent-specific configuration is handled through the config parameter pattern:
- **Type-safe configuration objects**
- **Extensible without breaking changes**
- **Clear separation of concerns**

## Implementation Status

### ✅ Completed
- Unified AgentRegistrationService with core methods
- Orchestrator controller migration to unified methods
- Team member controller integration
- Immediate status update implementation
- Build verification and testing

### 📋 Documentation Status
- Architecture specification ✅
- API documentation (covered in existing specs)
- Migration guide (this document)

## Related Specifications

- **Core Architecture**: `/specs/project.md`
- **MCP Integration**: `/specs/mcp-design.md`
- **Agent Registration MCP**: `/specs/agent-registration-mcp.md`
- **Backend Testing**: `/specs/backend-testing.md`

---

**Last Updated**: 2024-09-11
**Version**: 1.0
**Status**: Implemented