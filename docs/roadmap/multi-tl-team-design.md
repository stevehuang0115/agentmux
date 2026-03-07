# Design: 多 Team Leader (Multi-TL) 团队模型

## 1. 需求说明
当前 Crewly 团队模型中，每个 hierarchical 团队仅支持单一 `leaderId`。为了支持更复杂的团队架构（如：Crewly Core 团队同时拥有 PM TL 和 Dev TL），需要升级模型以支持多个 Team Leader。

### 场景示例：Crewly Core 团队
- **Team Leader 1**: Mia (PM TL) — 负责产品方向
- **Team Leader 2**: 新的 Dev TL — 负责开发方向
  - **Subordinate 1**: Sam (Developer)
  - **Subordinate 2**: 新的 Dev (Developer)

## 2. 数据模型变更

### 2.1 Team 接口变更 (`backend/src/types/index.ts`)
```typescript
export interface Team {
  id: string;
  name: string;
  // ... 其他字段
  hierarchical?: boolean;
  
  /** 
   * 已弃用：请使用 leaderIds。
   * 为了向后兼容，API 返回时应包含此字段（默认为 leaderIds[0]）。
   */
  leaderId?: string;

  /** 支持多个 Team Leader 的 ID 列表 */
  leaderIds?: string[];
  
  // ...
}
```

### 2.2 TeamMember 接口变更 (`backend/src/types/index.ts`)
无需重大变更，现有字段已支持多 TL 下的隶属关系：
- `parentMemberId`: 每个成员（如 Sam）依然指向其直接上级（Dev TL）。
- `hierarchyLevel`: 
  - TL 层的 `hierarchyLevel` 通常为 1（直接汇报给 Orchestrator）。
  - Worker 层的 `hierarchyLevel` 通常为 2（汇报给 TL）。

## 3. 关键问题设计

### 3.1 TL 之间的关系
- **平级模式（默认）**: 多个 TL 之间是平级关系，分别负责不同的专业领域（如 PM vs Dev）。
- **主次关系**: 如果需要，可以通过 `leaderIds` 的顺序来约定，`leaderIds[0]` 为 "Primary TL"（首席负责人）。

### 3.2 Subordinate 分配
- 沿用 `parentMemberId` 机制。
- 每个成员只能有一个 `parentMemberId`，这保证了任务流向的唯一性。
- 如果一个成员需要向多个 TL 汇报，目前建议将其拆分为两个角色或在逻辑上指定一个主要汇报对象。

### 3.3 任务委派 (Delegation Logic)
当 Orchestrator 向团队发送任务时：
1. **显式指定**: 如果任务消息中指定了特定 TL（通过名称或角色），直接发送给该 TL。
2. **领域识别**: 根据任务内容（通过 LLM 识别或标签）判断属于哪个领域。
   - 属于 "Product/Planning" -> 发送给 Mia。
   - 属于 "Coding/Refactor" -> 发送给 Dev TL。
3. **兜底策略**: 如果无法判断且未指定，则发送给 Primary TL (`leaderIds[0]`)。

### 3.4 向后兼容策略
- **数据层**: `TeamModel.fromJSON` 会将旧的 `leaderId` 自动封装进 `leaderIds: [data.leaderId]`。
- **视图层**: 前端如果只读 `leaderId`，后端在返回 Team 对象时，通过 Getter 或在转换时确保 `leaderId = leaderIds[0]`。

## 4. 接口变更 (API)

- `GET /api/teams/:id`: 返回数据中增加 `leaderIds` 数组。
- `POST /api/teams`: 创建团队时支持传入 `leaderIds`。
- `PATCH /api/teams/:id`: 更新团队领导层。

## 5. UI 变更

### 5.1 Team Detail 页面
- **多 TL 展示**: 不再只显示一个 "Leader" 标签。
- **分组树状图**: 
  - 展示多个 TL 节点。
  - 每个 TL 节点下方展开其对应的 `subordinates`。
  - 没有 subordinates 的 TL（如 Mia）作为独立的分支展示。

### 5.2 Team Editor 页面
- **Leader 选择**: 从单选下拉框改为多选组件。
- **归属设置**: 在设置普通成员时，`Reports To` 下拉框应列出所有已定义的 TL。

## 6. 实现步骤

1. **Phase 1 (Types & Migration)**: 修改 `types/index.ts`，并在 `TeamModel` 中实现数据迁移逻辑。
2. **Phase 2 (Logic Update)**: 更新 `HierarchyService` 和任务分发逻辑，支持多 leaderIds 的识别。
3. **Phase 3 (Frontend)**: 适配前端 Team 页面，支持多 TL 展示和编辑。
4. **Phase 4 (Validation)**: 重新配置 Crewly Core 团队为多 TL 模式并进行端到端测试。
