# Agent Project Structure Standardization — 产品设计 (v1.0)

**状态**：草案 (待技术评审)  
**设计人**：Mia (PM, crewly-core-mia-member-1)  
**日期**：2026-03-04  
**目标**：规范化 Agent 工作空间结构与启动协议，彻底解决 Agent 启动时的“失忆”问题，确保上下文的一致性与连续性。

---

## 1. Agent Workspace 标准目录结构

每个受 Crewly 管理的项目根目录下必须存在一个 `.crewly/` 目录。这是 Agent 的“外部长期记忆”。

### 1.1 目录树规范 (ASCII)

```text
[Project Root]/
├── .crewly/
│   ├── CONTEXT.md            # [必选] 核心上下文：项目现状、技术栈、决策记录的“唯一真理”
│   ├── goals/                # [必选] 目标管理
│   │   ├── active.md         # 当前正在执行的高层目标
│   │   └── history.md        # 已完成目标的归档
│   ├── sops/                 # [必选] 标准操作流程 (Standard Operating Procedures)
│   │   ├── core/             # 通用 SOP (如 git 规范, 状态汇报)
│   │   └── roles/            # 角色特定 SOP (如 frontend-dev, content-strategist)
│   ├── tasks/                # [必选] 任务管理
│   │   ├── open/             # 待处理任务 (Markdown 格式)
│   │   ├── in_progress/      # 正在执行的任务
│   │   └── done/             # 已完成的任务
│   ├── memory/               # [可选] 持续学习与知识库
│   │   ├── learnings.md      # Agent 在此项目中积累的经验、Gotchas
│   │   └── patterns.md       # 项目特有的代码或内容模式
│   ├── reports/              # [必选] 产出物与报告
│   │   ├── daily/            # 每日进度汇总
│   │   └── weekly/           # 每周复盘报告
│   └── knowledge/            # [可选] 业务知识、PRD、设计稿镜像
```

### 1.2 角色差异化配置

-   **Developer**: `sops/` 下应包含 `testing-protocol.md`, `ci-cd-flow.md`。
-   **Product Manager**: `knowledge/` 目录是核心，包含 PRDs 和用户反馈。
-   **Content Strategist**: `sops/` 下包含 `brand-voice.md`, `seo-guidelines.md`。

---

## 2. Agent 启动协议 (Boot Protocol)

Agent 启动后必须按此顺序“自举”，严禁直接向用户/上级提问。

### 2.1 执行序列 (Boot Sequence)

1.  **Identity Check**: 读取 `~/.crewly/agents-index.json` 确认自己的 Member ID、角色及在上级 (Team Leader) 中的位置。
2.  **Infrastructure Load**: 确认 `AGENT_SKILLS_PATH` 环境变量，测试基础 Skill (如 `recall`)。
3.  **Context Loading**:
    -   优先读取 `[PROJECT]/.crewly/CONTEXT.md` 建立大局观。
    -   读取 `[PROJECT]/.crewly/goals/active.md` 明确当前阶段任务。
4.  **Task Pickup**: 扫描 `[PROJECT]/.crewly/tasks/in_progress/` 下属于自己的任务文件。
5.  **Status Readiness**: 调用 `register-self` 汇报状态，并在 terminal 输出：`[READY] Context loaded from .crewly/. Awaiting next instruction.`

### 2.2 启动完成标志
只有在读取完 `CONTEXT.md` 和 `goals/active.md` 后，Agent 才能被视为 `Active`。

---

## 3. Orchestrator 启动协议

Orchestrator 是团队的“守夜人”，其启动必须恢复管理状态。

### 3.1 恢复项目
1.  **State Persistence**: 从 `~/.crewly/message-delivery-logs.json` 和 `recurring-checks.json` 恢复消息队列和调度计划。
2.  **Hierarchy Restoration**: 扫描 `team.json` 结合后端 `parentMemberId` 字段，重建 3 层级树状视图。
3.  **Pilot Monitoring**: 自动向所有 `Working` 状态的 Team Leader 发送隐形心跳包，确认链路完整性。

---

## 4. Context Recovery 机制 (解决上下文压缩失忆)

当 Agent context 接近上限触发 compaction (压缩) 时，执行以下策略：

### 4.1 核心持久化策略
-   **Ephemeral vs Persistent**: 会话中的琐碎对话 (chat logs) 属于 Ephemeral，决策和事实属于 Persistent。
-   **Auto-Update CONTEXT.md**: 每当任务状态变为 `done` 或 `handle-failure` 发生后，Agent 必须调用 `update-context` skill (待开发) 更新 `CONTEXT.md`。

### 4.2 压缩后的恢复步骤
1.  如果 context 被清空，Agent 重新执行 **Boot Protocol** 第 3 步。
2.  从 `memory/learnings.md` 提取最近 3 条经验注入当前 context。

---

## 5. SOP 模板系统与 Team Template 集成

### 5.1 SOP 定义格式
SOP 不再是纯文本，而是包含 **Trigger-Action-Verification** 结构的结构化 Markdown。

### 5.2 集成点
-   **Team Template 自动解压**: 当用户基于 `dev-fullstack` 模板创建团队时，Orchestrator 自动将对应的 `sops/` 模板文件夹解压到项目根目录。
-   **SOP 强制执行**: Team Leader 在 `verify-output` 时，对比产出是否符合 `sops/` 中的规定。

---

## 6. 实现优先级建议

1.  **P0 (急需)**: 定义 `CONTEXT.md` 规范模板，并让所有 Agent 启动第一步必读该文件。
2.  **P0 (急需)**: 实现 `register-self` 的启动自检逻辑。
3.  **P1 (重要)**: 实现 Orchestrator 的 `Hierarchy Restoration` 逻辑，确保重启后看板不丢失。
4.  **P2 (增强)**: 开发 `update-context` 自动维护 skill。

---
*设计人：Mia (Product Manager) | 2026-03-04*
