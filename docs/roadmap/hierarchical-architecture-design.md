# Crewly 层级化架构设计 — 技术方案

> **Author:** Sam (Developer)
> **Date:** 2026-03-06
> **Status:** Draft
> **Companion Doc:** Mia's product workflow design (hierarchical-workflow-design.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Part 1: Agent 层级结构设计](#2-part-1-agent-层级结构设计)
3. [Part 2: A2A 通信协议分析](#3-part-2-a2a-通信协议分析)
4. [Part 3: 通信层设计](#4-part-3-通信层设计)
5. [Part 4: 上报链实现](#5-part-4-上报链实现)
6. [Part 5: Team Template 系统设计](#6-part-5-team-template-系统设计)
7. [Implementation Roadmap](#7-implementation-roadmap)
8. [Risk Analysis](#8-risk-analysis)

---

## 1. Executive Summary

Crewly 当前采用扁平的 Orchestrator → Agents 两层架构。所有任务分配、状态监控、结果收集都由 Orchestrator 单点负责。随着团队规模扩大（5+ agents），Orchestrator 成为瓶颈：context window 被大量协调工作占满，任务拆解粒度粗，缺乏中间层质量把关。

本方案设计三层架构：**Orchestrator → Team Leaders → Workers**，引入 Team Leader 角色承担目标拆解、任务分配、质量验证和结果汇总职责。通信层沿用现有 REST API + PTY 体系，但借鉴 Google A2A 协议的 Task 状态机和消息格式做标准化升级。

**核心设计决策：**
- 数据模型：扁平存储 + 层级字段（`parentMemberId` + `hierarchyLevel`），不嵌套 JSON，天然支持 N 层深度
- 任务系统：扩展现有 `InProgressTask` 类型，不新建并行系统，复用 17 个 API 端点和 `.crewly/tasks/` 文件存储
- 通信：不全面 adopt A2A，而是借鉴其 Task lifecycle 概念做标准化
- 上报：逐级汇总上报，异常情况可越级
- Team Template：预定义团队配方（角色 + skills + verification pipeline），支持一键创建层级化团队
- 实现：增量式改造，不破坏现有功能

---

## 2. Part 1: Agent 层级结构设计

### 2.1 当前架构分析

```
Current: Flat Architecture
┌──────────────────────────────────┐
│         Orchestrator             │
│  (crewly-orc PTY session)       │
│                                  │
│  Responsibilities:               │
│  - Goal understanding            │
│  - Task decomposition            │
│  - Task assignment               │
│  - Progress monitoring           │
│  - Quality verification          │
│  - Result aggregation            │
│  - Error handling                │
│  - Slack communication           │
└────┬────┬────┬────┬────┬────┬───┘
     │    │    │    │    │    │
     ▼    ▼    ▼    ▼    ▼    ▼
   Agent Agent Agent Agent Agent Agent
   (Sam) (Mia) (Joe) (Leo) (Dev5)(Dev6)
```

**当前架构的问题：**

| 问题 | 影响 | 严重度 |
|------|------|--------|
| **Orchestrator context 过载** | 协调 5+ agents 时，context window 被状态追踪、消息路由占满，核心决策能力下降 | Critical |
| **任务拆解粒度粗** | Orchestrator 不具备每个领域的专业知识，拆出的子任务往往太大或方向不对 | High |
| **缺乏中间质量把关** | Worker 产出直接交给 Orchestrator，但 Orchestrator 缺乏时间和专业度做细致 review | High |
| **单点故障** | Orchestrator session 挂掉 = 整个团队瘫痪 | High |
| **协调开销线性增长** | 每增加一个 agent，Orchestrator 需要多管理一路通信、一组状态，O(n) 复杂度 | Medium |
| **无法并行协调** | Orchestrator 串行处理所有 agent 的汇报和问题，高峰期形成队列 | Medium |

**数据支撑（基于当前代码）：**
- `agent-registration.service.ts` 4,003 行，处理所有 agent 的注册、消息投递、状态追踪
- `delegate-task` skill 每次调用涉及：消息投递 + 事件订阅 + 定时检查 = 3 次 API call
- Orchestrator 每个 agent 需要维护：task state + monitoring subscription + scheduled check = O(3n) 资源

### 2.2 新架构设计

```
New: Hierarchical Architecture
┌──────────────────────────────────┐
│         Orchestrator             │
│  (crewly-orc PTY session)       │
│                                  │
│  Responsibilities (reduced):     │
│  - Strategic goal setting        │
│  - Team Leader assignment        │
│  - Cross-team coordination       │
│  - Escalation handling           │
│  - External communication        │
└────────┬──────────┬──────────────┘
         │          │
         ▼          ▼
┌─────────────┐  ┌─────────────┐
│ Team Leader │  │ Team Leader │
│ (Frontend)  │  │ (Backend)   │
│             │  │             │
│ - Planning  │  │ - Planning  │
│ - Assigning │  │ - Assigning │
│ - Verifying │  │ - Verifying │
│ - Reporting │  │ - Reporting │
└──┬─────┬────┘  └──┬─────┬────┘
   │     │          │     │
   ▼     ▼          ▼     ▼
 Worker Worker    Worker Worker
 (Dev1) (QA1)    (Dev2) (Dev3)
```

**关键设计原则：**

1. **Orchestrator 只管 Team Leaders**：从 O(n) 降到 O(k)，k = team leader 数量（通常 2-4）
2. **Team Leader 自治**：拿到高层目标后自行拆解、分配、验证，只在完成或异常时上报
3. **Worker 只认 Team Leader**：正常情况下 Worker 只与其 Team Leader 通信
4. **越级通道保留**：异常情况（Team Leader 无响应）Worker 可直接联系 Orchestrator

### 2.3 Team Leader 角色定义

Team Leader 是一个增强版的 Agent，拥有 orchestrator 级别的 skill subset：

**能力矩阵：**

| 能力 | 描述 | 对应 Skill |
|------|------|-----------|
| **目标拆解** | 将 Orchestrator 的高层目标分解为具体可执行任务 | `decompose-goal` (new) |
| **任务分配** | 将任务分配给下属 Worker，含优先级和上下文 | `delegate-task` (reuse, scoped) |
| **进度监控** | 订阅 Worker 事件，定时检查进度 | `subscribe-event` + `schedule-check` (reuse) |
| **质量验证** | 审核 Worker 产出，决定是否通过 | `verify-output` (new) |
| **结果汇总** | 汇总所有 Worker 结果，形成统一报告 | `aggregate-results` (new) |
| **上报** | 向 Orchestrator 汇报进展和最终结果 | `report-status` (reuse, enhanced) |
| **异常处理** | Worker 失败时决定重试、重分配或上报 | `handle-failure` (new) |

**Team Leader 系统 Prompt 结构：**

```markdown
# Team Leader: {team_name}

## Your Role
You are a Team Leader responsible for managing a team of {n} workers.
You receive high-level goals from the Orchestrator and break them down
into specific tasks for your workers.

## Your Workers
{{WORKER_LIST}}  <!-- Populated at runtime -->

## Your Skills
- delegate-task: Assign tasks to your workers
- check-status: Check worker progress
- verify-output: Review worker deliverables
- report-up: Report results to Orchestrator
- handle-failure: Manage worker failures

## Workflow
1. Receive goal from Orchestrator
2. Decompose into worker-level tasks
3. Assign tasks to appropriate workers
4. Monitor progress and handle blockers
5. Verify completed work meets requirements
6. Aggregate results and report up
```

### 2.4 Worker Agent 角色定义

Worker 保持当前 Agent 的能力，增加结构化汇报：

| 能力 | 描述 | 对应 Skill |
|------|------|-----------|
| **执行任务** | 接收 Team Leader 的具体任务并执行 | 现有开发/测试能力 |
| **进度上报** | 主动向 Team Leader 报告进度 | `report-status` (enhanced) |
| **完成上报** | 任务完成时提交结果 | `complete-task` (enhanced) |
| **求助** | 遇到阻塞时向 Team Leader 求助 | `request-help` (new) |
| **越级上报** | 紧急情况直接联系 Orchestrator | `escalate` (new) |

### 2.5 数据模型变化

#### 2.5.1 TeamMember 类型扩展

```typescript
// backend/src/types/index.ts — TeamMember changes

interface TeamMember {
  // === Existing fields (unchanged) ===
  id: string;
  name: string;
  sessionName: string;
  role: TeamMemberRole;  // Extended with new roles
  agentStatus: AgentStatus;
  workingStatus: WorkingStatus;
  runtimeType: RuntimeType;
  systemPrompt: string;
  skillOverrides?: string[];
  excludedRoleSkills?: string[];
  currentTickets?: string[];
  createdAt: string;
  updatedAt: string;

  // === New hierarchy fields ===

  /**
   * Parent member ID in the hierarchy.
   * - Orchestrator: undefined (root)
   * - Team Leader: orchestrator's virtual member ID
   * - Worker: Team Leader's member ID
   */
  parentMemberId?: string;

  /**
   * Position in hierarchy.
   * - 0: Orchestrator
   * - 1: Team Leader
   * - 2: Worker
   * Future expansion allows deeper nesting.
   */
  hierarchyLevel: number;

  /**
   * IDs of direct subordinate members.
   * Denormalized for fast lookup. Maintained by backend on
   * member add/remove operations.
   * - Orchestrator: [teamLeader1.id, teamLeader2.id]
   * - Team Leader: [worker1.id, worker2.id]
   * - Worker: [] (leaf node)
   */
  subordinateIds?: string[];

  /**
   * Whether this member can delegate tasks to subordinates.
   * true for Orchestrator and Team Leaders, false for Workers.
   */
  canDelegate: boolean;

  /**
   * Maximum number of concurrent tasks this member can handle.
   * Team Leaders: higher (managing multiple workers)
   * Workers: lower (executing individual tasks)
   */
  maxConcurrentTasks?: number;
}
```

#### 2.5.2 Role 类型扩展

```typescript
// Add new role type for Team Leaders
type TeamMemberRole =
  | 'orchestrator'
  | 'team-leader'       // NEW: manages a sub-team
  | 'tpm'
  | 'architect'
  | 'developer'
  | 'frontend-developer'
  | 'backend-developer'
  | 'fullstack-dev'
  | 'qa'
  | 'qa-engineer'
  | 'tester'
  | 'designer'
  | 'product-manager'
  | 'pgm'
  | 'sales'
  | 'support';
```

#### 2.5.3 扩展现有 InProgressTask 类型（非新建并行系统）

**设计决策：不新建 HierarchyTask，而是扩展现有 InProgressTask。**

现有 `InProgressTask`（定义于 `backend/src/types/task-tracking.types.ts`）已具备：
- 任务标识：`id`, `taskName`, `taskFilePath`
- 团队关联：`projectId`, `teamId`, `assignedTeamMemberId`, `assignedSessionName`
- 状态管理：`status` ('assigned' | 'active' | 'blocked' | 'pending_assignment' | 'completed')
- 监控关联：`scheduleIds`, `subscriptionIds`（完成时自动清理）
- 优先级：`priority`

现有 17 个 API 端点（create, assign, complete, block, unblock, take-next, sync 等）和 `.crewly/tasks/` 文件系统存储继续复用。

**扩展字段：**

```typescript
// backend/src/types/task-tracking.types.ts — InProgressTask extensions

export interface InProgressTask {
  // === Existing fields (ALL unchanged) ===
  id: string;
  projectId: string;
  teamId: string;
  taskFilePath: string;
  taskName: string;
  targetRole: string;
  assignedTeamMemberId: string;
  assignedSessionName: string;
  assignedAt: string;
  status: InProgressTaskStatus;  // Extended (see below)
  lastCheckedAt?: string;
  blockReason?: string;
  priority?: 'low' | 'medium' | 'high';
  scheduleIds?: string[];
  subscriptionIds?: string[];

  // === New: Hierarchy & Delegation fields ===

  /**
   * Member ID who created/delegated this task.
   * - For Orc→TL tasks: orchestrator's virtual member ID
   * - For TL→Worker tasks: Team Leader's member ID
   * Enables tracing the full delegation chain.
   */
  delegatedBy?: string;

  /**
   * Session name of the delegator (for direct reply routing).
   */
  delegatedBySession?: string;

  /**
   * Parent task ID for sub-task decomposition.
   * When Team Leader decomposes a goal into worker tasks,
   * each worker task references the TL-level task as parent.
   * Supports recursive decomposition (N levels deep).
   */
  parentTaskId?: string;

  /**
   * Child task IDs decomposed from this task.
   * Maintained by backend when child tasks are created.
   * Enables: "show me all subtasks of this goal"
   */
  childTaskIds?: string[];

  /**
   * Hierarchy level of the member this task is assigned to.
   * Denormalized from TeamMember for query efficiency.
   * 0=orchestrator, 1=team leader, 2=worker, etc.
   */
  assigneeHierarchyLevel?: number;

  // === New: A2A-inspired structured results ===

  /**
   * Structured artifacts produced by this task.
   * Replaces free-text summary in report-status.
   * Examples: files created, test results, documents.
   */
  artifacts?: TaskArtifact[];

  /**
   * Chronological record of status changes.
   * Each entry captures who changed it, when, and why.
   * Enables: audit trail, progress timeline, debugging.
   */
  statusHistory?: TaskStatusEntry[];

  /**
   * ISO timestamp when task reached a terminal state.
   */
  completedAt?: string;

  /**
   * Verification result from the delegator (Team Leader or Orchestrator).
   * Set when TL reviews worker output.
   */
  verificationResult?: {
    verdict: 'approved' | 'rejected' | 'revision_needed';
    feedback?: string;
    verifiedBy: string;
    verifiedAt: string;
  };
}

/**
 * Extended task status — backwards-compatible superset.
 *
 * Original 5 statuses preserved for backwards compatibility.
 * New A2A-inspired statuses added for hierarchical workflows.
 * Existing code checking for 'assigned'|'active'|'blocked'|
 * 'pending_assignment'|'completed' continues to work unchanged.
 */
export type InProgressTaskStatus =
  // === Original (unchanged) ===
  | 'assigned'              // Task assigned but not yet started
  | 'active'                // Agent actively working
  | 'blocked'               // Blocked (with blockReason)
  | 'pending_assignment'    // Created but not yet assigned
  | 'completed'             // Successfully finished
  // === New: A2A-inspired statuses ===
  | 'submitted'             // Created and sent to assignee, awaiting ack
  | 'working'               // Actively being executed (alias for 'active')
  | 'input_required'        // Needs clarification from delegator
  | 'verifying'             // Output submitted, awaiting review by delegator
  | 'failed'                // Failed (terminal, with blockReason as error)
  | 'cancelled';            // Cancelled by delegator

/**
 * Structured artifact produced by a task.
 * Inspired by A2A Artifact concept.
 */
export interface TaskArtifact {
  id: string;
  name: string;
  type: 'file' | 'text' | 'url' | 'structured';
  content: string;        // File path, text content, URL, or JSON string
  mediaType?: string;     // MIME type hint (e.g. 'application/json')
  createdAt: string;
}

/**
 * A single entry in the task status history.
 * Provides audit trail for task lifecycle.
 */
export interface TaskStatusEntry {
  timestamp: string;
  fromStatus: InProgressTaskStatus;
  toStatus: InProgressTaskStatus;
  message?: string;       // Human-readable explanation
  reportedBy: string;     // Member ID who triggered the change
}
```

**状态映射（向后兼容）：**

| 原始状态 | 新状态 | 说明 |
|---------|--------|------|
| `pending_assignment` | `pending_assignment` 或 `submitted` | 未分配 vs 已发送待确认 |
| `assigned` | `assigned` | 保持不变 |
| `active` | `active` 或 `working` | 同义，`working` 是 A2A 对齐名称 |
| `blocked` | `blocked` 或 `input_required` | 通用阻塞 vs 需要上级输入 |
| `completed` | `completed` | 保持不变 |
| — | `verifying` | 新增：产出待审核 |
| — | `failed` | 新增：终态失败 |
| — | `cancelled` | 新增：被取消 |

**关键原则：所有新字段都是 optional，所有新 status 值只在层级化工作流中使用。** 现有扁平团队的任务继续使用原始 5 种 status，不受影响。

**存储不变：** `~/.crewly/in_progress_tasks.json` 继续作为全局 JSON overlay，`.crewly/tasks/{milestone}/{status}/` 文件系统继续使用。新增的 `artifacts` 和 `statusHistory` 存储在 JSON overlay 中（体积可控，每个任务增加约 1-2KB）。

#### 2.5.4 团队配置变化

```typescript
/**
 * Enhanced team config supporting hierarchy.
 * Backwards-compatible: teams without hierarchy fields
 * default to flat structure.
 */
interface Team {
  // === Existing (unchanged) ===
  id: string;
  name: string;
  description?: string;
  members: TeamMember[];
  projectIds: string[];
  createdAt: string;
  updatedAt: string;

  // === New fields ===

  /**
   * Whether this team uses hierarchical management.
   * false = flat (current behavior, Orchestrator manages all)
   * true = hierarchical (Team Leader manages Workers)
   * Default: false for backwards compatibility.
   */
  hierarchical: boolean;

  /**
   * Member ID of the team leader (if hierarchical).
   * Must reference a member with role 'team-leader'.
   */
  leaderId?: string;

  /**
   * Template ID this team was created from.
   * References a TeamTemplate definition (see Part 5).
   * Enables: verification pipeline lookup, skill presets,
   * and template-based team recreation.
   */
  templateId?: string;
}
```

#### 2.5.5 Migration Strategy

```
Phase 1: Add new fields with defaults (non-breaking)
  - hierarchyLevel defaults to 2 (worker) for all existing members
  - parentMemberId defaults to undefined
  - canDelegate defaults to false
  - hierarchical defaults to false on teams

Phase 2: Orchestrator gets hierarchyLevel=0 automatically
  - Virtual orchestrator member gets level 0 at runtime

Phase 3: When user creates hierarchical team via UI/CLI:
  - Team Leader member gets level 1, canDelegate=true
  - Workers get level 2, parentMemberId=leader's ID
  - Team.hierarchical=true, Team.leaderId set

No migration script needed — all new fields are optional
with sensible defaults. Existing flat teams continue to work.
```

### 2.6 多层级兼容性设计（N-Level Hierarchy Support）

**当前数据模型天然支持 3+ 层级，无需任何改动。** 这是 `parentMemberId` + `hierarchyLevel` 扁平存储设计的核心优势。

#### 2.6.1 为什么不需要改动数据模型

`parentMemberId` 是一个通用指针，指向任意层级的父节点。`hierarchyLevel` 是一个整数，不限定上限。这两个字段组合形成了一个**隐式树结构**（adjacency list pattern），可以表达任意深度的层级：

```
4-Level Example: Orchestrator → Department Lead → Team Lead → Worker

┌──────────────────────────────────────┐
│ Orchestrator (level=0)               │
│ parentMemberId: undefined            │
│ subordinateIds: [dept-lead-1, ...]   │
└──────────┬───────────────────────────┘
           │
┌──────────▼───────────────────────────┐
│ Department Lead (level=1)            │
│ parentMemberId: orchestrator-id      │
│ subordinateIds: [tl-fe, tl-be]       │
│ canDelegate: true                    │
└──────┬───────────────┬───────────────┘
       │               │
┌──────▼──────┐  ┌─────▼───────┐
│ TL: FE      │  │ TL: BE      │
│ (level=2)   │  │ (level=2)   │
│ parent:     │  │ parent:     │
│  dept-lead  │  │  dept-lead  │
│ canDelegate │  │ canDelegate │
│  : true     │  │  : true     │
└──┬──────┬───┘  └──┬──────┬───┘
   │      │         │      │
   ▼      ▼         ▼      ▼
Worker  Worker    Worker  Worker
(lv=3)  (lv=3)   (lv=3)  (lv=3)
parent: parent:  parent: parent:
 tl-fe   tl-fe    tl-be   tl-be
```

#### 2.6.2 层级化行为由 `hierarchyLevel` 驱动

| 行为 | 触发条件 | 不受固定层级约束 |
|------|---------|----------------|
| 获得 delegation skills | `canDelegate === true` | 任何 level 都可以是 delegator |
| 接收上报 | `subordinateIds.length > 0` | 任何有下属的节点都能接收上报 |
| 向上汇报目标 | `parentMemberId` 指向的节点 | 自动解析，不硬编码 "level 1 reports to level 0" |
| 越级通道 | 沿 `parentMemberId` 链向上遍历 | Worker → TL → DeptLead → Orc 逐级尝试 |
| Skill 分配 | 由 `role` + `canDelegate` 决定 | 不绑定 level 数字 |

#### 2.6.3 代码层面的层级无关设计

所有层级化逻辑都应基于**关系**（parent/subordinate）而非**硬编码层数**：

```typescript
// ✅ GOOD: Relationship-based (works for any depth)
function getReportTarget(member: TeamMember, allMembers: TeamMember[]): TeamMember | null {
  if (!member.parentMemberId) return null; // Root node
  return allMembers.find(m => m.id === member.parentMemberId) ?? null;
}

function getSubordinates(member: TeamMember, allMembers: TeamMember[]): TeamMember[] {
  return allMembers.filter(m => m.parentMemberId === member.id);
}

function getEscalationChain(member: TeamMember, allMembers: TeamMember[]): TeamMember[] {
  const chain: TeamMember[] = [];
  let current = member;
  while (current.parentMemberId) {
    const parent = allMembers.find(m => m.id === current.parentMemberId);
    if (!parent) break;
    chain.push(parent);
    current = parent;
  }
  return chain; // [immediate parent, grandparent, ..., orchestrator]
}

// ❌ BAD: Hardcoded level checks (breaks if depth changes)
if (member.hierarchyLevel === 2) { /* worker logic */ }
if (member.hierarchyLevel === 1) { /* team leader logic */ }
```

`hierarchyLevel` 的用途仅限于：
- **显示/排序**：UI 中按层级缩进展示
- **EventFilter**：订阅特定层级的事件
- **权限快查**：快速判断 "此 agent 在哪一层" 而不需要遍历 parent 链

#### 2.6.4 何时扩展到 3+ 层级

**当前推荐 3 层（Orc→TL→Worker）**，因为：
- 每多一层增加约 2-5s 通信延迟
- 更多层级需要更多 agents（成本线性增长）
- 多数团队 ≤ 15 人，3 层足够

**适合 4 层的场景**（未来）：
- 大型组织：20+ agents，按部门划分
- 多项目并行：每个项目有独立的 Team Lead
- 跨职能团队：Department Lead 协调前端、后端、QA 各自的 Team Lead

**扩展时无需改动数据模型**，只需：
1. 新增 `department-lead` 角色（`config/roles/department-lead/`）
2. 新增对应的 skill set（delegation + aggregation scope 更大）
3. 创建团队时设置正确的 `parentMemberId` 和 `hierarchyLevel` 值

---

## 3. Part 2: A2A 通信协议分析

### 3.1 Google A2A 协议概述

Google A2A (Agent-to-Agent) 是一个开放协议，用于 AI agent 间的标准化通信。当前版本：RC v1.0（规范定义于 Protocol Buffers）。

**核心概念映射：**

| A2A Concept | 描述 | Crewly 对应 |
|-------------|------|------------|
| **Agent Card** | Agent 自描述清单（能力、skill、认证方式） | 部分存在：`role.json` + `skill.json` 提供能力描述 |
| **Task** | 工作单元，有完整生命周期状态机 | 部分存在：`.crewly/tasks/` 文件 + `in_progress_tasks.json` |
| **Message** | 一次通信轮次（含 Parts） | 现有：PTY session write（纯文本） |
| **Artifact** | 任务产出（文档、代码、数据） | 不存在：结果通过 report-status 文本描述 |
| **Part** | 消息最小单元（text/file/data） | 不存在：所有通信都是纯文本 |

**A2A 核心架构：**

```
A2A Protocol Stack:

Layer 3: Transport Bindings
  ├── JSON-RPC 2.0 over HTTP (primary)
  ├── gRPC (high-performance)
  └── HTTP+JSON/REST (simple)

Layer 2: Operations
  ├── SendMessage (create/continue task)
  ├── SendStreamingMessage (real-time)
  ├── GetTask / ListTasks (query)
  ├── CancelTask (lifecycle control)
  ├── SubscribeToTask (streaming updates)
  └── Push Notifications (webhooks)

Layer 1: Data Model (Protocol Buffers)
  ├── AgentCard (discovery + capabilities)
  ├── Task (state machine: submitted→working→completed)
  ├── Message (communication turn, role + parts)
  ├── Artifact (task outputs)
  └── Part (text | raw | url | structured data)
```

**A2A Task 状态机：**

```
                    ┌──────────────┐
                    │  SUBMITTED   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
              ┌─────│   WORKING    │─────┐
              │     └──────┬───────┘     │
              │            │             │
    ┌─────────▼──┐  ┌──────▼───────┐  ┌──▼──────────┐
    │ INPUT_     │  │  COMPLETED   │  │   FAILED     │
    │ REQUIRED   │  │  (terminal)  │  │  (terminal)  │
    └─────────┬──┘  └──────────────┘  └──────────────┘
              │
              │ (client provides input)
              │
    ┌─────────▼──┐
    │  WORKING   │  (resumes)
    └────────────┘

Additional terminal states: CANCELLED, REJECTED
Additional interrupted state: AUTH_REQUIRED
```

### 3.2 对比分析：Crewly 当前 vs A2A

| 维度 | Crewly 当前 | A2A 协议 | 差距 |
|------|------------|----------|------|
| **通信协议** | REST API → PTY session write（文本注入） | JSON-RPC 2.0 / gRPC / REST | Crewly 通信是"终端模拟"，A2A 是结构化 RPC |
| **消息格式** | 纯文本字符串 | 结构化 Message + Parts（text/file/data） | Crewly 无法携带文件引用、结构化数据 |
| **任务状态** | 文件名约定（in_progress/done 目录）+ JSON overlay | 7 种显式状态 + 状态机转换规则 | Crewly 状态追踪松散，无正式状态机 |
| **结果传递** | report-status 的文本 summary | Artifacts（独立对象，含类型和元数据） | Crewly 无结构化结果传递 |
| **Agent 发现** | teams.json 静态配置 | Agent Card（自描述，含 skills/capabilities） | Crewly agent 能力不自描述 |
| **认证** | 无（本地 trusted） | OAuth2, API Key, mTLS, OIDC | 不需要（本地系统） |
| **流式通信** | WebSocket（终端输出流） | SSE / gRPC streaming | 功能类似但用途不同 |
| **Push 通知** | EventBus + 事件订阅 | Webhook-based push notifications | 概念类似，实现不同 |
| **跨网络** | 不支持（本地 localhost） | 设计目标就是跨网络互操作 | N/A（不是我们的需求） |

### 3.3 完全 Adopt A2A 的工作量评估

如果要让 Crewly 完全兼容 A2A 协议：

| 改造项 | 工作量 | 描述 |
|--------|--------|------|
| **实现 A2A Server** | 2-3 周 | 每个 Agent 需要暴露 A2A HTTP 端点，实现 SendMessage、GetTask 等方法 |
| **实现 A2A Client** | 1-2 周 | Orchestrator 和 Team Leaders 需要作为 A2A Client 发送结构化消息 |
| **Agent Card 生成** | 3-5 天 | 从 role.json + skill.json 自动生成 A2A Agent Card |
| **Task 状态机** | 1 周 | 替换文件系统任务追踪为 A2A Task 模型 |
| **Message/Part 系统** | 1-2 周 | 替换纯文本通信为结构化 Message + Parts |
| **Artifact 系统** | 1 周 | 实现结构化结果传递 |
| **PTY 桥接层** | 2-3 周 | **最大难点**：Claude Code 只接受文本输入。需要在 A2A 结构化消息和 PTY 文本之间双向转换 |
| **测试 + 调试** | 2-3 周 | 端到端测试、状态机边界case |
| **总计** | **10-15 周** | 约 2.5-4 个月的全职开发 |

**最大障碍：PTY 文本桥接**

Crewly 的根本特点是 agents 运行在 PTY 终端中，只接受文本输入/输出。A2A 设计假设 agents 有结构化 API 端点。这意味着即使实现了 A2A Server，最终还是要把结构化消息序列化为文本注入 PTY，再从 PTY 输出中解析结构化响应。这个桥接层会很脆弱。

### 3.4 推荐路径：选择性借鉴

**结论：不全面 adopt A2A，而是借鉴其中 3 个核心概念。**

理由：
1. **Crewly 是本地系统**：A2A 的核心价值是跨网络互操作。Crewly agents 运行在同一台机器，通过 localhost API 通信，不需要跨网络协议。
2. **PTY 文本桥接成本太高**：双向转换层会成为持续维护负担。
3. **认证/发现不需要**：本地 agents 不需要 OAuth 或 Agent Card 发现机制。
4. **A2A 过重**：对于本地 orchestration 场景，JSON-RPC 规范、版本协商等是不必要的复杂度。

**借鉴的 3 个概念：**

| A2A 概念 | 借鉴方式 | 实现复杂度 |
|----------|----------|-----------|
| **Task 状态机** | 采用 A2A 的 8 种 TaskState（submitted/working/completed/failed/cancelled/input_required/rejected/auth_required），替换当前松散的文件目录状态追踪 | Low（纯数据模型改动） |
| **Artifact 模型** | 任务完成时返回结构化 Artifact（type + content），而非纯文本 summary | Medium（需要修改 report-status 和 complete-task skill） |
| **消息标准化** | 定义统一的 TaskMessage 格式（含 taskId、role、parts），替换当前的自由文本 | Medium（需要修改 delegate-task 和消息投递流程） |

**预估工作量：2-3 周**（vs 全面 adopt 的 10-15 周）

### 3.5 未来 A2A 兼容路径

如果未来需要与外部 A2A agents 互操作（例如接入第三方 AI agent 服务），可以增加一个 **A2A Gateway** 层：

```
External A2A Agent
       ↕ (A2A JSON-RPC)
┌──────────────────┐
│  A2A Gateway     │  ← 新增组件，翻译 A2A ↔ Crewly 内部格式
│  (future phase)  │
└────────┬─────────┘
         ↕ (Internal REST API)
  Crewly Backend
```

这样 Crewly 内部通信保持轻量高效，只在需要外部互操作时才承担 A2A 协议的复杂度。

---

## 4. Part 3: 通信层设计

### 4.1 通信拓扑

```
Communication Topology (New)

                 Orchestrator
                 ┌─────────┐
                 │crewly-orc│
                 └─┬─────┬─┘
          ┌────────┘     └────────┐
          ▼                       ▼
   ┌──────────┐           ┌──────────┐
   │ TL: FE   │           │ TL: BE   │
   │(team-lead│           │(team-lead│
   │ session) │           │ session) │
   └─┬──────┬─┘           └─┬──────┬─┘
     │      │                │      │
     ▼      ▼                ▼      ▼
  Worker  Worker          Worker  Worker
  (dev1)  (qa1)           (dev2)  (dev3)

Communication paths:
──── Normal (via REST API + PTY)
- - - Escalation (bypass Team Leader)
```

**设计决策：Team Leader ↔ Worker 直接通信，不经过 Orchestrator 中转。**

理由：
1. 中转增加延迟，Orchestrator 不需要看到每条 TL↔Worker 消息
2. TL 和 Worker 在同一台机器上，可以直接调用 `/api/terminal/{session}/deliver`
3. Orchestrator 只需要关心 TL 的汇总报告

### 4.2 消息格式标准化

定义 4 种标准消息类型：

#### 4.2.1 Task Assignment（任务分配）

```typescript
/**
 * Sent by: Orchestrator → Team Leader, or Team Leader → Worker
 * Replaces: current free-text task delegation
 */
interface TaskAssignment {
  /** Message type identifier */
  type: 'task_assignment';

  /** Unique task ID for tracking */
  taskId: string;

  /** Human-readable task title */
  title: string;

  /** Detailed instructions */
  description: string;

  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical';

  /** Optional: parent task this was decomposed from */
  parentTaskId?: string;

  /** Expected deliverables */
  expectedArtifacts?: string[];

  /** Context files the assignee should read */
  contextFiles?: string[];

  /** Deadline hint (not enforced, for prioritization) */
  deadlineHint?: string;

  /** Who delegated this */
  delegatedBy: string;
}
```

**序列化为 PTY 文本的格式：**

```markdown
---
[TASK ASSIGNMENT]
Task ID: {taskId}
Title: {title}
Priority: {priority}
Delegated by: {delegatedBy}
Parent Task: {parentTaskId || "none"}
---

## Instructions
{description}

## Expected Deliverables
{expectedArtifacts as bullet list}

## Context
Read these files first: {contextFiles as bullet list}

---
When done, report back using:
bash .../report-status/execute.sh '{"taskId":"{taskId}","status":"done","summary":"..."}'
```

#### 4.2.2 Status Report（状态上报）

```typescript
/**
 * Sent by: Worker → Team Leader, or Team Leader → Orchestrator
 */
interface StatusReport {
  type: 'status_report';
  taskId: string;
  state: TaskState;
  progress?: number;          // 0-100 percentage
  message: string;            // Human-readable update
  artifacts?: TaskArtifact[]; // Completed deliverables
  blockers?: string[];        // What's blocking progress
  reportedBy: string;
}
```

#### 4.2.3 Verification Request（验证请求）

```typescript
/**
 * Sent by: Worker → Team Leader (requesting review)
 * or Team Leader → Orchestrator (requesting approval)
 */
interface VerificationRequest {
  type: 'verification_request';
  taskId: string;
  artifacts: TaskArtifact[];  // What to verify
  summary: string;            // What was done
  testResults?: string;       // Test output if applicable
  requestedBy: string;
}
```

#### 4.2.4 Verification Result（验证结果）

```typescript
/**
 * Sent by: Team Leader → Worker (feedback on verification)
 * or Orchestrator → Team Leader (approval/rejection)
 */
interface VerificationResult {
  type: 'verification_result';
  taskId: string;
  verdict: 'approved' | 'rejected' | 'revision_needed';
  feedback?: string;          // What needs to change
  verifiedBy: string;
}
```

### 4.3 通信实现方式

**不改变底层传输机制。** 继续使用：
- REST API `/api/terminal/{session}/deliver` 做可靠消息投递
- REST API `/api/terminal/{session}/write` 做即时消息
- PTY session 做实际文本注入

**改变的是消息内容的结构化程度：**

```
Current:  "请实现用户登录功能，参考 specs/auth.md"
                    ↓ (free text, no tracking)

New:      TaskAssignment JSON → serialize to markdown template
          → inject via /deliver → agent parses structured header
                    ↓ (trackable via taskId)
```

**Skill 改造：**

| Skill | 当前行为 | 改造后 |
|-------|---------|--------|
| `delegate-task` | 自由文本 + 监控设置 | 生成 TaskAssignment 结构 → 序列化为 markdown → 投递 |
| `report-status` | 自由文本 summary | 生成 StatusReport → 包含 taskId + state + artifacts |
| `complete-task` | 标记文件为 done + 自由文本 | 生成 VerificationRequest → 包含 artifacts |

### 4.4 EventBus 升级

#### 4.4.1 当前 EventBus 评估

现有 EventBus 支持：
- 7 种事件类型（status_changed, idle, busy, active, inactive, context_warning, context_critical, oauth_url）
- 按 sessionName/memberId/teamId 过滤
- oneShot 和 TTL 过期
- 消息模板

**结论：现有 EventBus 架构足够，只需新增事件类型。**

#### 4.4.2 新增事件类型

```typescript
// Add to EVENT_TYPES in event-bus.types.ts
export const EVENT_TYPES = [
  // === Existing ===
  'agent:status_changed',
  'agent:idle',
  'agent:busy',
  'agent:active',
  'agent:inactive',
  'agent:context_warning',
  'agent:context_critical',
  'agent:oauth_url',

  // === New: Hierarchical task events ===
  'task:submitted',          // New task created
  'task:accepted',           // Assignee acknowledged task
  'task:working',            // Task execution started
  'task:input_required',     // Task blocked, needs input
  'task:verification_requested', // Worker requesting review
  'task:completed',          // Task finished successfully
  'task:failed',             // Task failed
  'task:cancelled',          // Task cancelled

  // === New: Hierarchy communication events ===
  'hierarchy:escalation',    // Worker bypassing Team Leader
  'hierarchy:delegation',    // Task delegated down the chain
  'hierarchy:report_up',     // Results reported up the chain
] as const;
```

#### 4.4.3 增强 EventFilter

```typescript
interface EventFilter {
  // === Existing ===
  sessionName?: string;
  memberId?: string;
  teamId?: string;

  // === New ===
  taskId?: string;           // Filter events for specific task
  hierarchyLevel?: number;   // Filter by agent level (0=orc, 1=TL, 2=worker)
  parentMemberId?: string;   // Filter events from a specific leader's subordinates
}
```

### 4.5 错误处理策略

```
Worker Failure Handling by Team Leader:

┌─────────────────┐
│ Worker reports   │
│ task:failed      │
└────────┬────────┘
         │
    ┌────▼─────────┐
    │ Assess failure│
    │ severity      │
    └────┬─────────┘
         │
    ┌────┴────────────────────────────┐
    │                                  │
    ▼                                  ▼
Recoverable?                     Unrecoverable?
    │                                  │
    ├─ Retry same worker              ├─ Reassign to another worker
    │  (max 2 retries)                │  (if available)
    │                                  │
    ├─ Provide additional             ├─ Merge remaining work with
    │  context/hints                   │  another worker's task
    │                                  │
    └─ If retries exhausted ──────────┤
                                       │
                                  ┌────▼────────┐
                                  │ All options  │
                                  │ exhausted?   │
                                  └────┬────────┘
                                       │
                                  ┌────▼────────┐
                                  │ Escalate to  │
                                  │ Orchestrator  │
                                  │ with summary  │
                                  └──────────────┘
```

**Team Leader 失败处理规则：**

```typescript
interface FailurePolicy {
  /** Max retries before reassignment */
  maxRetries: 2;

  /** Max reassignments before escalation */
  maxReassignments: 1;

  /** Timeout before considering worker unresponsive (minutes) */
  unresponsiveTimeout: 15;

  /** Whether to auto-escalate on unrecoverable failures */
  autoEscalate: true;
}
```

**Worker 直接越级的条件：**

1. Team Leader session 不存在（`agentStatus === 'inactive'`）
2. Team Leader 连续 15 分钟无响应
3. Worker 收到 `escalation_authorized` 标记的任务

---

## 5. Part 4: 上报链实现

### 5.1 逐级上报机制

```
Reporting Chain:

Worker                    Team Leader               Orchestrator
  │                           │                         │
  │ ① complete-task           │                         │
  │ (StatusReport +           │                         │
  │  artifacts)               │                         │
  │──────────────────────────▶│                         │
  │                           │                         │
  │                           │ ② verify output         │
  │                           │ (review artifacts)      │
  │                           │                         │
  │           ┌───────────────┤                         │
  │           │ approved?     │                         │
  │           ▼               ▼                         │
  │         Yes              No                         │
  │           │               │                         │
  │           │    ③ send back│                         │
  │           │    feedback   │                         │
  │◀──────────┼───────────────│                         │
  │           │               │                         │
  │           │ (worker revises and resubmits)          │
  │           │                                         │
  │           ▼                                         │
  │     ④ aggregate results                             │
  │     from all workers                                │
  │           │                                         │
  │           │ ⑤ report-up                             │
  │           │ (aggregated StatusReport)               │
  │           │────────────────────────────────────────▶│
  │           │                                         │
  │           │                         ⑥ Orchestrator  │
  │           │                         acknowledges    │
  │           │◀────────────────────────────────────────│
```

### 5.2 汇总 vs 透传

**设计决策：Team Leader 汇总后上报，不透传原始内容。**

理由：
1. Orchestrator 不需要看到每个 Worker 的细节，只需要知道"前端团队完成了 3/5 个任务，有 1 个被 block"
2. 汇总减少 Orchestrator 的 context 消耗（这是最初要解决的核心问题）
3. 如果 Orchestrator 需要细节，可以向 TL 追问

**汇总报告格式：**

```typescript
/**
 * Aggregated report from Team Leader to Orchestrator.
 */
interface AggregatedReport {
  type: 'aggregated_report';

  /** The goal/task that Orchestrator originally delegated */
  parentTaskId: string;

  /** Overall status */
  overallState: TaskState;

  /** Summary written by Team Leader */
  summary: string;

  /** Per-worker task breakdown */
  subtaskSummary: {
    total: number;
    completed: number;
    failed: number;
    inProgress: number;
    blocked: number;
  };

  /** Key artifacts (curated by Team Leader) */
  keyArtifacts?: TaskArtifact[];

  /** Issues requiring Orchestrator attention */
  escalations?: string[];

  /** Team Leader's assessment of quality */
  qualityAssessment?: 'pass' | 'partial' | 'fail';

  reportedBy: string;
  timestamp: string;
}
```

**Orchestrator 收到的上报示例（序列化为 markdown）：**

```markdown
---
[AGGREGATED REPORT]
Parent Task: task-fe-auth-001
Overall Status: completed
Quality: pass
Reported by: Frontend Team Leader
---

## Summary
Frontend authentication flow implementation is complete. All 3 subtasks
finished successfully and verified.

## Subtask Breakdown
- Total: 3 | Completed: 3 | Failed: 0 | In Progress: 0 | Blocked: 0

## Subtasks
1. [DONE] Login form component (Dev1) - React hook form with validation
2. [DONE] Auth API integration (Dev1) - JWT token handling + refresh
3. [DONE] Auth guard HOC (QA1) - Route protection + redirect logic

## Key Deliverables
- frontend/src/components/LoginForm.tsx (new)
- frontend/src/hooks/useAuth.ts (new)
- frontend/src/guards/AuthGuard.tsx (new)
- 12 test files, all passing

## Escalations
None.
```

### 5.3 异常上报（越级）

Worker 可以跳过 Team Leader 直接找 Orchestrator 的条件：

| 条件 | 检测方式 | 处理 |
|------|---------|------|
| **TL session 不存在** | Worker 调用 `/api/terminal/{tl-session}/deliver` 返回 404 | 自动路由到 Orchestrator |
| **TL 无响应** | Worker 等待 15 分钟无回复 | Worker 主动 escalate |
| **关键安全问题** | Worker 发现安全漏洞 | 标记 `escalation: 'security'` 直接上报 |
| **跨团队依赖** | Worker 需要其他团队的资源 | 通过 TL 上报（TL 自身也需要上报给 Orchestrator 协调） |

**越级通信实现：**

```typescript
/**
 * New skill: escalate
 * Available to Workers (hierarchyLevel >= 2)
 */
interface EscalationMessage {
  type: 'escalation';
  taskId: string;
  reason: 'tl_unresponsive' | 'tl_inactive' | 'security' | 'cross_team' | 'other';
  message: string;
  originalAssignedTo: string;   // Team Leader who should have handled this
  escalatedBy: string;          // Worker's member ID
}
```

**路由逻辑（在 send-message skill 中增强）：**

```
When Worker sends message:
  1. Check target session exists (GET /api/sessions/{tl-session})
  2. If exists → deliver normally
  3. If NOT exists:
     a. Look up Worker's parentMemberId → find Team Leader
     b. Look up Team Leader's parentMemberId → find Orchestrator
     c. Deliver to Orchestrator with escalation wrapper
     d. Emit 'hierarchy:escalation' event
```

---

## 6. Part 5: Team Template 系统设计

### 6.1 设计目标

Team Template 定义了一种团队的**完整配方**：角色组成 + skill 预设 + verification pipeline + 层级结构。不同类型的团队有完全不同的验证方式和工作流程。

这与 OKR 中"3 个预设团队模板作为 onboarding 钩子"完全对齐：用户选择一个模板 → 一键创建层级化团队 → 自动配置 skills 和验证管道 → 开箱即用。

### 6.2 TeamTemplate 类型定义

```typescript
// backend/src/types/team-template.types.ts

/**
 * A complete team recipe: roles, skills, hierarchy, and verification pipeline.
 * Templates are stored in config/templates/ and can be published to the marketplace.
 */
export interface TeamTemplate {
  // === Metadata ===

  /** Unique template identifier (slug format, e.g. 'dev-fullstack') */
  id: string;

  /** Human-readable template name */
  name: string;

  /** Template description (shown in marketplace/selector) */
  description: string;

  /** Template category for browsing/filtering */
  category: TemplateCategory;

  /** Version string (semver) */
  version: string;

  /** Template author */
  author?: string;

  /** Tags for search/discovery */
  tags?: string[];

  /** Icon URL or emoji for visual display */
  icon?: string;

  // === Team Structure ===

  /**
   * Whether this template creates a hierarchical team.
   * true = has Team Leaders and Workers
   * false = flat team (all members report to Orchestrator)
   */
  hierarchical: boolean;

  /**
   * Role definitions with hierarchy configuration.
   * Order matters: first member with canDelegate=true becomes the leader.
   */
  roles: TemplateRole[];

  /**
   * Default runtime for all members (can be overridden per role).
   */
  defaultRuntime: 'claude-code' | 'gemini-cli' | 'codex-cli';

  // === Verification Pipeline ===

  /**
   * Verification pipeline configuration.
   * Defines HOW task outputs are verified for this team type.
   * Team Leader executes these steps when reviewing worker output.
   */
  verificationPipeline: VerificationPipeline;

  // === Operational Defaults ===

  /**
   * Default monitoring configuration for delegated tasks.
   */
  monitoringDefaults?: {
    /** Subscribe to agent:idle events (default: true) */
    idleEvent: boolean;
    /** Fallback check interval in minutes (default: 5) */
    fallbackCheckMinutes: number;
  };

  /**
   * Maximum number of workers per team leader (default: 4).
   */
  maxWorkersPerLeader?: number;

  /**
   * Whether to auto-assign tasks to idle workers (default: false).
   */
  autoAssign?: boolean;
}

/**
 * Template categories matching common team types.
 */
export type TemplateCategory =
  | 'development'      // Software dev teams
  | 'content'          // Content creation, social media
  | 'research'         // Research and analysis
  | 'operations'       // Ops, DevOps, infrastructure
  | 'custom';          // User-defined

/**
 * A role definition within a template.
 * Specifies the member's position in the hierarchy,
 * their default skills, and their verification responsibilities.
 */
export interface TemplateRole {
  /** Role identifier (matches TeamMember.role) */
  role: string;

  /** Human-readable label for this position (e.g. "Lead Developer") */
  label: string;

  /** Default member name (user can override during creation) */
  defaultName: string;

  /** Number of members with this role to create (default: 1) */
  count: number;

  /** Hierarchy level (0=orchestrator, 1=leader, 2=worker, etc.) */
  hierarchyLevel: number;

  /** Whether this role can delegate tasks to subordinates */
  canDelegate: boolean;

  /**
   * Which role is this member's parent?
   * References another TemplateRole.role in this template.
   * undefined = reports to Orchestrator.
   */
  reportsTo?: string;

  /**
   * Default skills assigned to this role.
   * Merged with role-level skills from config/roles/{role}/role.json.
   */
  defaultSkills: string[];

  /**
   * Skills to exclude from the role's default set.
   */
  excludedSkills?: string[];

  /**
   * Custom system prompt additions (appended to role prompt).
   */
  promptAdditions?: string;

  /**
   * AI runtime override for this specific role.
   */
  runtimeOverride?: 'claude-code' | 'gemini-cli' | 'codex-cli';

  /** Whether to enable browser automation for this role */
  enableBrowser?: boolean;
}
```

### 6.3 Verification Pipeline 类型

**关键洞察：不同模板的验证方式完全不同。** Dev 团队验证代码质量，内容团队验证视觉效果，研究团队验证信息准确性。因此 verification pipeline 必须是可配置的。

```typescript
/**
 * Defines the verification steps the Team Leader executes
 * when reviewing worker output. Each step uses specific tools
 * and has pass/fail criteria.
 */
export interface VerificationPipeline {
  /** Pipeline display name */
  name: string;

  /** Verification steps executed in order */
  steps: VerificationStep[];

  /**
   * Overall pass policy:
   * - 'all': All steps must pass (strict)
   * - 'majority': >50% of steps must pass
   * - 'critical_only': Only steps marked critical must pass
   */
  passPolicy: 'all' | 'majority' | 'critical_only';

  /**
   * Maximum retry attempts for failed verification (default: 2).
   * Worker gets feedback and chance to revise.
   */
  maxRetries: number;
}

/**
 * A single verification step in the pipeline.
 */
export interface VerificationStep {
  /** Step identifier */
  id: string;

  /** Human-readable step name */
  name: string;

  /** Description of what this step verifies */
  description: string;

  /**
   * Verification method — determines HOW the TL checks output.
   */
  method: VerificationMethod;

  /** Whether this step is critical for overall pass/fail */
  critical: boolean;

  /** Step-specific configuration (depends on method) */
  config: Record<string, unknown>;
}

/**
 * Verification methods available to Team Leaders.
 * Each method corresponds to a specific skill or tool chain.
 */
export type VerificationMethod =
  // === Development verification ===
  | 'quality_gates'      // Run typecheck + tests + lint + build
  | 'e2e_test'           // Run Playwright/Cypress E2E tests
  | 'code_review'        // AI-assisted code review (TL reads diff)
  | 'browser_test'       // Open in browser, take screenshot, verify visually

  // === Content/Visual verification ===
  | 'screenshot_review'  // Take screenshot and review visually
  | 'gemini_vision'      // Send screenshot/image to Gemini for visual analysis
  | 'content_check'      // Check content against style guide / brand rules

  // === Research verification ===
  | 'fact_check'         // Cross-reference claims against multiple sources
  | 'source_verify'      // Verify that cited sources exist and are credible
  | 'data_validate'      // Check data consistency and accuracy

  // === Universal ===
  | 'manual_review'      // TL reads output and makes judgment call
  | 'custom_script';     // Run a custom verification script
```

### 6.4 预设模板示例

#### 6.4.1 Dev 团队模板（开发）

```typescript
const devFullstackTemplate: TeamTemplate = {
  id: 'dev-fullstack',
  name: 'Fullstack Development Team',
  description: 'Team Leader + developers + QA for building web applications',
  category: 'development',
  version: '1.0.0',
  tags: ['development', 'web', 'fullstack', 'testing'],
  icon: '💻',

  hierarchical: true,
  defaultRuntime: 'claude-code',

  roles: [
    {
      role: 'team-leader',
      label: 'Tech Lead',
      defaultName: 'Tech Lead',
      count: 1,
      hierarchyLevel: 1,
      canDelegate: true,
      reportsTo: undefined,  // Reports to Orchestrator
      defaultSkills: [
        'decompose-goal',
        'delegate-task',
        'verify-output',
        'aggregate-results',
        'handle-failure',
        'code-review',         // Can review code
      ],
      enableBrowser: true,
    },
    {
      role: 'developer',
      label: 'Developer',
      defaultName: 'Developer',
      count: 2,
      hierarchyLevel: 2,
      canDelegate: false,
      reportsTo: 'team-leader',
      defaultSkills: [
        'report-status',
        'complete-task',
        'request-help',
      ],
      enableBrowser: false,
    },
    {
      role: 'qa-engineer',
      label: 'QA Engineer',
      defaultName: 'QA',
      count: 1,
      hierarchyLevel: 2,
      canDelegate: false,
      reportsTo: 'team-leader',
      defaultSkills: [
        'report-status',
        'complete-task',
        'request-help',
      ],
      enableBrowser: true,   // Needs browser for E2E testing
    },
  ],

  verificationPipeline: {
    name: 'Development Quality Pipeline',
    steps: [
      {
        id: 'quality-gates',
        name: 'Quality Gates',
        description: 'Run typecheck, unit tests, lint, and build',
        method: 'quality_gates',
        critical: true,
        config: {
          gates: ['typecheck', 'tests', 'build'],  // lint optional
        },
      },
      {
        id: 'code-review',
        name: 'Code Review',
        description: 'TL reviews code diff for patterns and quality',
        method: 'code_review',
        critical: true,
        config: {
          maxDiffLines: 500,
          checkPatterns: true,
        },
      },
      {
        id: 'browser-test',
        name: 'Browser Verification',
        description: 'Open in browser, screenshot, verify UI matches spec',
        method: 'browser_test',
        critical: false,
        config: {
          screenshotTool: 'computer-use',
          viewports: ['desktop'],
        },
      },
      {
        id: 'e2e',
        name: 'E2E Tests',
        description: 'Run Playwright end-to-end test suite',
        method: 'e2e_test',
        critical: false,
        config: {
          framework: 'playwright',
          testDir: 'tests/e2e',
        },
      },
    ],
    passPolicy: 'critical_only',
    maxRetries: 2,
  },

  monitoringDefaults: {
    idleEvent: true,
    fallbackCheckMinutes: 5,
  },
  maxWorkersPerLeader: 4,
};
```

#### 6.4.2 社媒/内容团队模板

```typescript
const socialMediaTemplate: TeamTemplate = {
  id: 'social-media-ops',
  name: 'Social Media Operations Team',
  description: 'Content creation, visual review, and multi-platform publishing',
  category: 'content',
  version: '1.0.0',
  tags: ['content', 'social-media', 'visual', 'marketing'],
  icon: '📱',

  hierarchical: true,
  defaultRuntime: 'claude-code',

  roles: [
    {
      role: 'team-leader',
      label: 'Content Director',
      defaultName: 'Content Director',
      count: 1,
      hierarchyLevel: 1,
      canDelegate: true,
      reportsTo: undefined,
      defaultSkills: [
        'decompose-goal',
        'delegate-task',
        'verify-output',
        'aggregate-results',
        'handle-failure',
        'screenshot-review',   // Visual content review
      ],
      enableBrowser: true,   // Needs browser for visual verification
    },
    {
      role: 'designer',
      label: 'Content Creator',
      defaultName: 'Creator',
      count: 2,
      hierarchyLevel: 2,
      canDelegate: false,
      reportsTo: 'team-leader',
      defaultSkills: [
        'report-status',
        'complete-task',
        'request-help',
      ],
      enableBrowser: true,   // Creates visual content
    },
  ],

  verificationPipeline: {
    name: 'Content Quality Pipeline',
    steps: [
      {
        id: 'screenshot-review',
        name: 'Visual Screenshot Review',
        description: 'Take screenshot of content and review visually',
        method: 'screenshot_review',
        critical: true,
        config: {
          captureMethod: 'computer-use',
          checkBranding: true,
        },
      },
      {
        id: 'gemini-vision',
        name: 'AI Visual Analysis',
        description: 'Use Gemini Vision to analyze visual quality and brand consistency',
        method: 'gemini_vision',
        critical: true,
        config: {
          model: 'gemini-2.0-flash',
          checkCriteria: ['brand_consistency', 'visual_quality', 'text_readability'],
        },
      },
      {
        id: 'content-check',
        name: 'Content Guidelines Check',
        description: 'Verify content follows style guide and tone',
        method: 'content_check',
        critical: false,
        config: {
          styleGuide: '.crewly/docs/style-guide.md',
        },
      },
    ],
    passPolicy: 'critical_only',
    maxRetries: 2,
  },

  maxWorkersPerLeader: 3,
};
```

#### 6.4.3 研究/策略团队模板

```typescript
const researchTemplate: TeamTemplate = {
  id: 'research-analysis',
  name: 'Research & Analysis Team',
  description: 'Research lead + analysts for competitive analysis and strategy',
  category: 'research',
  version: '1.0.0',
  tags: ['research', 'analysis', 'strategy', 'competitive'],
  icon: '🔬',

  hierarchical: true,
  defaultRuntime: 'claude-code',

  roles: [
    {
      role: 'team-leader',
      label: 'Research Lead',
      defaultName: 'Research Lead',
      count: 1,
      hierarchyLevel: 1,
      canDelegate: true,
      reportsTo: undefined,
      defaultSkills: [
        'decompose-goal',
        'delegate-task',
        'verify-output',
        'aggregate-results',
        'handle-failure',
        'fact-check',          // Can cross-reference findings
      ],
      enableBrowser: true,
    },
    {
      role: 'developer',
      label: 'Research Analyst',
      defaultName: 'Analyst',
      count: 2,
      hierarchyLevel: 2,
      canDelegate: false,
      reportsTo: 'team-leader',
      defaultSkills: [
        'report-status',
        'complete-task',
        'request-help',
        'web-search',          // Web research capability
      ],
      enableBrowser: true,     // Needs browser for research
    },
  ],

  verificationPipeline: {
    name: 'Research Quality Pipeline',
    steps: [
      {
        id: 'source-verify',
        name: 'Source Verification',
        description: 'Verify all cited sources exist and are credible',
        method: 'source_verify',
        critical: true,
        config: {
          minSources: 3,
          requirePrimarySources: true,
        },
      },
      {
        id: 'fact-check',
        name: 'Cross-Reference Check',
        description: 'Cross-check key claims against multiple independent sources',
        method: 'fact_check',
        critical: true,
        config: {
          minCrossReferences: 2,
          flagContradictions: true,
        },
      },
      {
        id: 'data-validate',
        name: 'Data Validation',
        description: 'Check numerical data, dates, and statistics for consistency',
        method: 'data_validate',
        critical: false,
        config: {
          checkDates: true,
          checkNumbers: true,
          checkPercentages: true,
        },
      },
    ],
    passPolicy: 'critical_only',
    maxRetries: 1,
  },

  maxWorkersPerLeader: 3,
};
```

### 6.5 Template 存储与发现

**存储位置：**

```
config/templates/
├── dev-fullstack/
│   └── template.json           # TeamTemplate JSON
├── social-media-ops/
│   └── template.json
├── research-analysis/
│   └── template.json
├── core-team/                   # Existing (will be migrated)
│   └── template.json
├── education-smb/               # Existing
│   └── template.json
└── insurance-smb/               # Existing
    └── template.json
```

**Discovery API：**

```typescript
// New API endpoints
GET  /api/templates               // List all available templates
GET  /api/templates/:id           // Get template detail
POST /api/teams/from-template     // Create team from template
```

**`POST /api/teams/from-template` 流程：**

```
1. User selects template (e.g. 'dev-fullstack')
2. User optionally customizes:
   - Member names
   - Worker count
   - Runtime overrides
3. Backend creates team:
   a. Create Team with hierarchical=true, templateId=template.id
   b. For each TemplateRole:
      - Create TeamMember with correct hierarchyLevel, parentMemberId
      - Apply defaultSkills + excludedSkills
      - Set canDelegate based on template
   c. Set Team.leaderId to the first canDelegate=true member
   d. Store verificationPipeline reference via templateId
4. Return created team (ready to start)
```

### 6.6 Verification Pipeline 执行模型

**Team Leader 如何使用 verification pipeline：**

```
Worker completes task (report-status with status=done)
         │
         ▼
Team Leader receives notification
         │
         ▼
TL loads verification pipeline from template
(GET /api/templates/{team.templateId} → pipeline config)
         │
         ▼
┌─────────────────────────────────────────┐
│ For each step in pipeline.steps:        │
│                                          │
│   Execute verification method:           │
│   ├─ quality_gates → run build/test/lint │
│   ├─ screenshot_review → take screenshot │
│   ├─ gemini_vision → call Gemini API     │
│   ├─ code_review → read diff + analyze   │
│   ├─ fact_check → web search + compare   │
│   └─ custom_script → bash execute        │
│                                          │
│   Record result: pass/fail + details     │
└─────────────────────────────────────────┘
         │
         ▼
Apply passPolicy:
├─ 'all': every step passed?
├─ 'majority': >50% passed?
└─ 'critical_only': all critical steps passed?
         │
    ┌────┴────┐
    │         │
  PASS      FAIL
    │         │
    ▼         ▼
  Approve    Send feedback to worker
  task       (revision_needed)
    │         │
    ▼         ▼
  Aggregate  Worker revises
  results    (up to maxRetries)
```

**TL 的 verify-output skill 改造：**

```bash
# config/skills/team-leader/verify-output/execute.sh

# Input: { taskId, sessionName, templateId }
# 1. Fetch template's verificationPipeline
# 2. Fetch task artifacts from InProgressTask
# 3. Execute each verification step
# 4. Apply passPolicy
# 5. Update task: verificationResult = { verdict, feedback }
# 6. If approved: complete task
# 7. If rejected: send feedback to worker
```

### 6.7 与现有 Template 系统的关系

`config/templates/` 已有 3 个模板（`core-team`, `education-smb`, `insurance-smb`），格式是简单的 team config JSON：

```json
// Existing format (config/templates/core-team/template.json)
{
  "name": "Core Team",
  "members": [
    { "name": "Sam", "role": "developer", "systemPrompt": "..." },
    { "name": "Mia", "role": "product-manager", "systemPrompt": "..." }
  ]
}
```

**迁移策略：**

1. 新 `TeamTemplate` 格式是现有格式的超集
2. 现有模板可渐进迁移：加入 `hierarchical`, `verificationPipeline`, `category` 等字段
3. 模板加载器（`TemplateService`）同时支持新旧格式：
   - 如果有 `verificationPipeline` → 使用新格式
   - 如果没有 → 按旧格式处理（flat team, no verification pipeline）
4. CLI 的 `crewly init` 已有 `createTeamFromTemplate()` → 扩展为支持新格式

---

## 7. Implementation Roadmap

### Phase 1: Data Model Foundation (3-5 days)

| Task | Files | Effort |
|------|-------|--------|
| Add hierarchy fields to TeamMember type | `types/index.ts` | 1 day |
| Extend InProgressTask with hierarchy + artifact fields | `types/task-tracking.types.ts` | 1 day |
| Add `team-leader` role | `types/index.ts`, `config/roles/team-leader/` | 1 day |
| Extend Team type with `hierarchical` + `templateId` | `types/index.ts` | 0.5 day |
| Update team controller for hierarchy-aware creation | `team.controller.ts` | 1 day |
| Tests for all new types and controllers | Co-located `.test.ts` files | 1 day |

### Phase 2: Team Leader Skills (5-7 days)

| Task | Files | Effort |
|------|-------|--------|
| Create `decompose-goal` skill | `config/skills/team-leader/decompose-goal/` | 1 day |
| Port `delegate-task` for Team Leaders | `config/skills/team-leader/delegate-task/` | 1 day |
| Create `verify-output` skill | `config/skills/team-leader/verify-output/` | 1 day |
| Create `aggregate-results` skill | `config/skills/team-leader/aggregate-results/` | 1 day |
| Create `handle-failure` skill | `config/skills/team-leader/handle-failure/` | 1 day |
| Team Leader role prompt | `config/roles/team-leader/prompt.md` | 1 day |
| Integration tests for TL skill chain | Test files | 1 day |

### Phase 3: Message Standardization (3-5 days)

| Task | Files | Effort |
|------|-------|--------|
| Define message type schemas | `types/hierarchy-message.types.ts` | 1 day |
| Update `delegate-task` to use TaskAssignment format | `config/skills/orchestrator/delegate-task/` | 1 day |
| Update `report-status` to use StatusReport format | `config/skills/agent/core/report-status/` | 1 day |
| Update `complete-task` to use VerificationRequest format | `config/skills/agent/core/complete-task/` | 1 day |
| Serialization helpers (struct → markdown) | `backend/src/utils/message-serializer.ts` | 1 day |

### Phase 4: EventBus & Reporting (3-5 days)

| Task | Files | Effort |
|------|-------|--------|
| Add new event types | `types/event-bus.types.ts` | 0.5 day |
| Enhance EventFilter with hierarchy fields | `types/event-bus.types.ts` | 0.5 day |
| Implement aggregated reporting | `backend/src/services/hierarchy/` | 2 days |
| Implement escalation routing | `backend/src/services/hierarchy/` | 1 day |
| End-to-end test: Orc → TL → Worker → Report chain | Integration tests | 1 day |

### Phase 5: Frontend & UX (3-5 days)

| Task | Files | Effort |
|------|-------|--------|
| Team hierarchy visualization (tree view) | `frontend/src/components/` | 2 days |
| Task flow visualization | `frontend/src/components/` | 1 day |
| Team Leader creation in UI | `frontend/src/pages/` | 1 day |
| Hierarchy-aware team status dashboard | `frontend/src/pages/` | 1 day |

### Phase 6: Team Template System (5-7 days)

| Task | Files | Effort |
|------|-------|--------|
| Define TeamTemplate + VerificationPipeline types | `types/team-template.types.ts` (new) | 1 day |
| TemplateService: load, list, get templates | `backend/src/services/template/` (new) | 1 day |
| Template API endpoints (list, get, create-from) | `backend/src/controllers/template/` (new) | 1 day |
| Create 3 preset templates (dev, content, research) | `config/templates/` | 1 day |
| Migrate existing templates to new format | `config/templates/{core-team,education-smb,insurance-smb}` | 0.5 day |
| verify-output skill: execute pipeline from template | `config/skills/team-leader/verify-output/` | 1 day |
| CLI `crewly init` integration with new templates | `cli/src/` | 0.5 day |
| Tests for template service + controller | Co-located `.test.ts` files | 1 day |

**Total estimated effort: 22-34 days (4.5-7 weeks)**

### Phasing Strategy

```
Phase 1-2 is the MVP: hierarchical teams work, TL can delegate and report.
Phase 3 improves quality: structured messages reduce ambiguity.
Phase 4 completes the loop: event-driven monitoring + escalation.
Phase 5 makes it user-friendly: visual hierarchy management.
Phase 6 enables onboarding: template-based team creation with verification.

Phases 1-2 can ship independently as a usable feature.
Phases 3-6 are incremental improvements.
Phase 6 can be developed in parallel with Phases 3-5 (no dependency).
```

---

## 8. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Team Leader context overload** | Medium | High | TL manages max 4 workers; auto-escalate if TL context hits 80% |
| **Message format parsing failures** | Medium | Medium | Graceful fallback to free-text if structured parsing fails; keep backwards compatibility |
| **Backwards compatibility break** | Low | High | All new fields are optional with defaults; `hierarchical: false` preserves flat behavior |
| **Increased latency** | Medium | Low | One extra hop (Orc→TL→Worker vs Orc→Worker) adds ~2-5s per delegation; acceptable for async work |
| **Orchestrator still bottleneck for cross-team** | Medium | Medium | Cross-team requests go through Orchestrator by design; future: direct TL↔TL channel |
| **Worker confusion on reporting target** | Low | Medium | Worker's `parentMemberId` unambiguously identifies their TL; skill scripts auto-resolve target |
| **TL single point of failure per team** | Medium | High | Escalation path to Orchestrator; future: TL hot-standby |
| **Template verification pipeline complexity** | Medium | Medium | Start with `manual_review` as fallback; pipeline steps are optional, not mandatory |
| **Template format migration** | Low | Low | New format is superset of old; loader supports both; no breaking changes |

---

## Appendix A: Comparison with Mia's Workflow

Mapping Mia's product workflow roles to technical implementation:

| Mia's Workflow Role | Technical Implementation |
|---------------------|------------------------|
| **Goal Setter** | Orchestrator receives user goal, creates high-level task |
| **Planner** | Team Leader decomposes goal into worker tasks via `decompose-goal` skill |
| **Executor** | Workers execute tasks, report progress via `report-status` |
| **Verifier** | Team Leader reviews outputs via `verify-output` skill |
| **Reporter** | Team Leader aggregates and reports via `aggregate-results` + `report-up` |

The Team Leader combines Planner + Verifier + Reporter roles. This is intentional:
- Reduces number of agents needed (cost efficiency)
- Planner naturally understands what to verify (they defined the tasks)
- Reporter has full context from planning + verification

## Appendix B: A2A Protocol Quick Reference

For future reference when considering A2A adoption:

| A2A Element | Spec Version | Crewly Equivalent (after this design) |
|-------------|-------------|--------------------------------------|
| AgentCard | RC v1.0 | role.json + skill.json (partial) |
| Task | RC v1.0 | InProgressTask (extended with A2A-inspired states) |
| Message | RC v1.0 | TaskAssignment / StatusReport (simplified) |
| Artifact | RC v1.0 | TaskArtifact (adopted concept) |
| SendMessage | RC v1.0 | POST /terminal/{session}/deliver |
| GetTask | RC v1.0 | GET /api/tasks/{id} (to be built) |
| CancelTask | RC v1.0 | task state → cancelled (to be built) |
| SubscribeToTask | RC v1.0 | EventBus subscription with taskId filter |
| Push Notifications | RC v1.0 | EventBus event delivery to subscriber session |

**Crewly's A2A compatibility score: ~40% after this design (up from ~15%).**
Full compatibility possible via A2A Gateway in future phase.
