# AgentMux Enhancement Plan - Executive Summary (Revised)

## Goal
Transform AgentMux into a fully autonomous "one-man company" platform where AI agent teams (PM, Engineers, Sales, Ops) work autonomously with role-specific knowledge bases and SOPs.

---

## Key Insight

**AgentMux doesn't need Claude Code's stop hook** because it directly controls PTY sessions:
- Can detect when agents stop via `onExit()` callback
- Can detect idle via `ActivityMonitorService` (2-min polling)
- Can inject continuation prompts directly

---

## What AgentMux Already Has

```
✅ PTY Session Management (onData, onExit listeners)
✅ Activity Monitoring (2-min poll + 30-min stale detection)
✅ Ticket System (10+ MCP tools, file-based status)
✅ Scheduled Check-ins (SchedulerService)
✅ Context Loading (ContextLoaderService)
✅ Prompt Building (PromptBuilderService)
✅ Memory Logs (project/.agentmux/memory/)
```

## What We Need to Add

```
❌ Structured Memory → Agent + Project scoped (not just logs)
❌ Auto-Continue → Detect idle/stop, inject continuation
❌ Quality Gates → Verify before task completion
❌ SOP System → Role-specific procedures
❌ Learnings Extraction → Knowledge accumulation
```

---

## Two-Level Memory System

Since AgentMux is **project-based**, memory needs to exist at two levels:

| Level | Location | Purpose |
|-------|----------|---------|
| **Agent** | `~/.agentmux/agents/{id}/` | Role knowledge, preferences, custom SOPs |
| **Project** | `project/.agentmux/knowledge/` | Patterns, decisions, gotchas, learnings |

---

## Implementation Phases

```
Phase 1 (Weeks 1-2): STRUCTURED MEMORY [P0]
├── MemoryService (agent + project scoped)
├── MCP tools: remember, recall, record_learning
└── Prompt builder integration

Phase 2 (Weeks 3-4): CONTINUATION SERVICE [P0]
├── PTY onExit() integration
├── Terminal output analyzer
├── Continuation prompt injection
└── Iteration tracking

Phase 3 (Weeks 5-6): QUALITY GATES [P1]
├── QualityGateService
├── Enhanced complete_task MCP tool
└── Project gate configuration

Phase 4 (Weeks 7-8): SOP SYSTEM [P1]
├── SOPService
├── Default SOPs for PM/Dev/QA
└── Agent-created custom SOPs

Phase 5 (Weeks 9+): AUTONOMOUS OPS [P2]
├── Auto-assignment
├── Budget controls
├── External channels (Telegram/Slack)
└── Self-writing tools
```

---

## Continuation Logic

```typescript
When agent stops/goes idle:
├── TASK_COMPLETE → Move to done, assign next
├── WAITING_INPUT → Notify owner
├── STUCK_OR_ERROR → Handle error
└── INCOMPLETE → Inject continuation prompt
                 (if iterations < max)
```

---

## Key Changes from Original Plan

| Original | Revised |
|----------|---------|
| Stop hook integration | **Use PTY onExit()** |
| Ralph PRD system | **Enhance existing tickets** |
| Multi-channel P0 | **Multi-channel P2** |
| Generic memory | **Agent + Project scoped** |
| Self-writing extensions P0 | **P2** |

---

## New MCP Tools

| Tool | Purpose |
|------|---------|
| `remember` | Store memory (agent/project scope) |
| `recall` | Retrieve relevant memories |
| `record_learning` | Log a learning |
| `check_quality_gates` | Run quality gates |
| `get_sops` | Get relevant SOPs |

---

## Success Criteria

- **>70%** tasks complete without human intervention
- **>85%** quality gates pass on first try
- **<5** iterations per standard task
- **>90%** continuation success rate

---

## Quick Win: Start with Phase 1

Build **Structured Memory System** first because:
1. Agents stop losing context between sessions
2. Project-specific knowledge persists
3. Foundation for continuation service
4. Enables SOP injection later
