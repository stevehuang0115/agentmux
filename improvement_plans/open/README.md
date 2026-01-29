# AgentMux Improvement Tasks

This directory contains detailed task breakdowns for the AgentMux Autonomous Agent Enhancement Plan.

## Task Overview

| ID | Title | Phase | Priority | Est. Hours | Status |
|----|-------|-------|----------|------------|--------|
| 01 | Design Memory Data Models | 1 | P0 | 8 | open |
| 02 | Implement Agent Memory Service | 1 | P0 | 12 | open |
| 03 | Implement Project Memory Service | 1 | P0 | 12 | open |
| 04 | Create Memory Service Coordinator | 1 | P0 | 6 | open |
| 05 | Integrate Memory into Prompts | 1 | P0 | 6 | open |
| 06 | Create Memory MCP Tools | 1 | P0 | 10 | open |
| 07 | Design Continuation Detection | 2 | P0 | 8 | open |
| 08 | Implement Output Analyzer | 2 | P0 | 10 | open |
| 09 | Implement Continuation Service | 2 | P0 | 12 | open |
| 10 | Create Continuation Prompts | 2 | P0 | 6 | open |
| 11 | Add Iteration Tracking | 2 | P0 | 6 | open |
| 12 | Design Quality Gate System | 3 | P1 | 6 | open |
| 13 | Implement Quality Gate Service | 3 | P1 | 10 | open |
| 14 | Enhance complete_task Tool | 3 | P1 | 8 | open |
| 15 | Design SOP Data Model | 4 | P1 | 6 | open |
| 16 | Implement SOP Service | 4 | P1 | 10 | open |
| 17 | Create Default SOP Library | 4 | P1 | 8 | open |
| 18 | Integrate SOPs into Prompts | 4 | P1 | 6 | open |
| 19 | Design Auto-Assignment System | 5 | P2 | 6 | open |
| 20 | Implement Auto-Assign Service | 5 | P2 | 10 | open |
| 21 | Implement Budget Service | 5 | P2 | 8 | open |
| 22 | Enhance Scheduler for PTY | 5 | P2 | 6 | open |

**Total Estimated Hours: 180**

## Phases

### Phase 1: Structured Memory System (P0)
**Tasks 01-06 | 54 hours**

Build the two-level memory system for agent and project knowledge.

```
01 Memory Data Models ─┬─► 02 Agent Memory Service ─┬─► 04 Memory Coordinator ─┬─► 05 Prompt Integration
                       │                            │                          │
                       └─► 03 Project Memory Service┘                          └─► 06 MCP Tools
```

### Phase 2: Continuation Service (P0)
**Tasks 07-11 | 42 hours**

Enable automatic continuation when agents stop or go idle.

```
07 Continuation Detection ─► 08 Output Analyzer ─► 09 Continuation Service ─┬─► 10 Continuation Prompts
                                                                            │
                                                                            └─► 11 Iteration Tracking
```

### Phase 3: Quality Gates (P1)
**Tasks 12-14 | 24 hours**

Enforce quality checks before task completion.

```
12 Quality Gate Design ─► 13 Quality Gate Service ─► 14 complete_task Enhancement
```

### Phase 4: SOP System (P1)
**Tasks 15-18 | 30 hours**

Standardize agent behavior with role-specific procedures.

```
15 SOP Data Model ─┬─► 16 SOP Service ─► 18 SOP Prompt Integration
                   │
                   └─► 17 SOP Library
```

### Phase 5: Autonomous Operations (P2)
**Tasks 19-22 | 30 hours**

Enable fully autonomous 24/7 operation.

```
19 Auto-Assign Design ─► 20 Auto-Assign Service
09 Continuation Service ─► 21 Budget Service
09 Continuation Service ─► 22 Scheduler Enhancement
```

## Dependency Graph

```
                    ┌─────────────────────────────────────────────────┐
                    │              PHASE 1: MEMORY                    │
                    │                                                 │
                    │    ┌────┐                                       │
                    │    │ 01 │ Memory Data Models                    │
                    │    └─┬──┘                                       │
                    │      │                                          │
                    │   ┌──┴──┐                                       │
                    │   ▼     ▼                                       │
                    │ ┌────┐ ┌────┐                                   │
                    │ │ 02 │ │ 03 │ Agent & Project Memory            │
                    │ └─┬──┘ └─┬──┘                                   │
                    │   │     │                                       │
                    │   └──┬──┘                                       │
                    │      ▼                                          │
                    │    ┌────┐                                       │
                    │    │ 04 │ Memory Coordinator                    │
                    │    └─┬──┘                                       │
                    │      │                                          │
                    │   ┌──┴──┐                                       │
                    │   ▼     ▼                                       │
                    │ ┌────┐ ┌────┐                                   │
                    │ │ 05 │ │ 06 │ Prompt Integration & MCP Tools    │
                    │ └─┬──┘ └─┬──┘                                   │
                    │   │     │                                       │
                    └───┼─────┼───────────────────────────────────────┘
                        │     │
                        ▼     ▼
                    ┌─────────────────────────────────────────────────┐
                    │            PHASE 2: CONTINUATION                │
                    │                                                 │
                    │    ┌────┐                                       │
                    │    │ 07 │ Continuation Detection                │
                    │    └─┬──┘                                       │
                    │      ▼                                          │
                    │    ┌────┐                                       │
                    │    │ 08 │ Output Analyzer                       │
                    │    └─┬──┘                                       │
                    │      ▼                                          │
                    │    ┌────┐                                       │
                    │    │ 09 │ Continuation Service                  │
                    │    └─┬──┘                                       │
                    │      │                                          │
                    │   ┌──┴──┐                                       │
                    │   ▼     ▼                                       │
                    │ ┌────┐ ┌────┐                                   │
                    │ │ 10 │ │ 11 │ Prompts & Iteration Tracking      │
                    │ └────┘ └─┬──┘                                   │
                    │          │                                      │
                    └──────────┼──────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────────────────────────────────┐
                    │           PHASE 3: QUALITY GATES                │
                    │                                                 │
                    │    ┌────┐                                       │
                    │    │ 12 │ Quality Gate Design                   │
                    │    └─┬──┘                                       │
                    │      ▼                                          │
                    │    ┌────┐                                       │
                    │    │ 13 │ Quality Gate Service                  │
                    │    └─┬──┘                                       │
                    │      ▼                                          │
                    │    ┌────┐                                       │
                    │    │ 14 │ complete_task Enhancement             │
                    │    └────┘                                       │
                    │                                                 │
                    └─────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────────────────┐
                    │              PHASE 4: SOP SYSTEM                │
                    │                                                 │
                    │    ┌────┐                                       │
                    │    │ 15 │ SOP Data Model                        │
                    │    └─┬──┘                                       │
                    │      │                                          │
                    │   ┌──┴──┐                                       │
                    │   ▼     ▼                                       │
                    │ ┌────┐ ┌────┐                                   │
                    │ │ 16 │ │ 17 │ SOP Service & Library             │
                    │ └─┬──┘ └─┬──┘                                   │
                    │   │     │                                       │
                    │   └──┬──┘                                       │
                    │      ▼                                          │
                    │    ┌────┐                                       │
                    │    │ 18 │ SOP Prompt Integration                │
                    │    └────┘                                       │
                    │                                                 │
                    └─────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────────────────┐
                    │         PHASE 5: AUTONOMOUS OPS (P2)            │
                    │                                                 │
                    │    ┌────┐                                       │
                    │    │ 19 │ Auto-Assign Design                    │
                    │    └─┬──┘                                       │
                    │      ▼                                          │
                    │    ┌────┐                                       │
                    │    │ 20 │ Auto-Assign Service                   │
                    │    └────┘                                       │
                    │                                                 │
                    │    ┌────┐                                       │
                    │    │ 21 │ Budget Service                        │
                    │    └────┘                                       │
                    │                                                 │
                    │    ┌────┐                                       │
                    │    │ 22 │ Scheduler Enhancement                 │
                    │    └────┘                                       │
                    │                                                 │
                    └─────────────────────────────────────────────────┘
```

## Priority Legend

- **P0 (Critical)**: Must have for basic autonomous operation
- **P1 (High)**: Important for quality and consistency
- **P2 (Nice to Have)**: Enhances automation but not required initially

## Getting Started

1. Start with **Task 01** (Memory Data Models)
2. Follow the dependency chain within each phase
3. Complete P0 tasks before moving to P1
4. P2 tasks can be done after core functionality works

## File Format

Each task file includes:
- YAML frontmatter with metadata
- Objective and background
- Detailed deliverables with code examples
- Implementation steps
- Acceptance criteria
- Notes and considerations

## Moving Tasks

When a task is started:
```bash
mv open/01-memory-data-models.md in_progress/
```

When a task is completed:
```bash
mv in_progress/01-memory-data-models.md done/
```
