# Team Leader 核心 Skill 产品说明书 (Phase 2)

**目标**：为 Team Leader (TL) 提供管理 subordinates 的工具链。  
**技术底座**：基于 Sam 的 `parentMemberId` 层级模型和 `verificationPipeline` 架构。

---

## 1. decompose-goal (目标拆解)
-   **用途**：将 Orchestrator 下达的高层 Objective 拆解为多个原子化的 Tasks。
-   **触发条件**：TL 收到新任务或现有任务需要进一步细分时。
-   **输入参数 (JSON)**：
    -   `objective`: (string) 原始目标描述。
    -   `context`: (object) 项目背景、代码库信息等。
-   **期望输出**：一个包含多个任务对象的数组，包含 `title`, `description`, `requiredSkill`, `acceptanceCriteria`。
-   **产品逻辑**：TL 会利用 LLM 的推理能力，结合项目的 `.crewly/tasks/` 现状进行拆解，确保任务不重复且有依赖顺序。

---

## 2. verify-output (结果验证)
-   **用途**：执行当前团队模板定义的验证管道，确交付物质量。
-   **触发条件**：Worker 调用 `report-status` 标记任务为 `done` 时。
-   **输入参数 (JSON)**：
    -   `taskId`: (string) 待验证的任务 ID。
    -   `workerId`: (string) 执行该任务的 Worker ID。
-   **期望输出**：`{ "passed": boolean, "score": number, "feedback": string, "failedSteps": [] }`。
-   **产品逻辑**：此 Skill 会读取 `team.templateId` 下的 `verificationPipeline` 配置。按照管道顺序调用具体的验证工具（如 `playwright_test` 或 `content_scan`）。必须满足 `passPolicy` 才认为通过。

---

## 3. aggregate-results (结果汇总)
-   **用途**：汇总当前所有活跃子任务的产出，生成一份发给 Orchestrator 的完整报告。
-   **触发条件**：所有子任务完成，或需要进行周报/日报汇报时。
-   **输入参数 (JSON)**：
    -   `taskIds`: (array) 包含在报告中的任务 ID 列表。
    -   `reportType`: (enum) "milestone" | "daily" | "final"。
-   **期望输出**：一份结构化的 Markdown 报告，包含成功项、失败项、交付物链接及资源消耗。
-   **产品逻辑**：Skill 会遍历各个任务的 `output.json`，提取核心结论，过滤掉琐碎的 log，形成高维度的业务总结。

---

## 4. handle-failure (失败决策)
-   **用途**：当验证失败或 Worker 执行异常时，决定下一步动作。
-   **触发条件**：`verify-output` 返回 `passed: false` 或 Worker 报告 `Blocked`。
-   **输入参数 (JSON)**：
    -   `failureInfo`: (object) 包含错误日志、失败步骤、已重试次数。
    -   `workerId`: (string) 报错的 Worker。
-   **期望输出**：`{ "action": "retry" | "reassign" | "escalate", "nextWorkerId": string, "instructions": string }`。
-   **产品逻辑**：
    -   如果 `retries < 2`，通常选择 `retry`。
    -   如果是技能不匹配，从团队中搜索符合 `requiredSkill` 的其他 Worker，选择 `reassign`。
    -   如果是资源/权限问题，选择 `escalate` 上报给 Orchestrator。

---

## 5. delegate-task (TL版)
-   **用途**：将具体任务下发给属于该 TL 的 Worker。
-   **触发条件**：`decompose-goal` 完成后，或 `handle-failure` 决定 `reassign` 时。
-   **输入参数 (JSON)**：
    -   `task`: (object) 任务详情。
    -   `workerId`: (string) 接收任务的 Worker。
-   **期望输出**：`{ "success": boolean, "sessionId": string }`。
-   **产品逻辑**：复用原有的 `delegate-task` 逻辑，但后端逻辑会根据 `workerId` 校验其 `parentMemberId` 是否属于当前 TL，确保管理的合法性。下发后，TL 的 Dashboard 应显示该 Worker 处于 `Working` 状态。

---
*设计人：Mia (PM) | 2026-03-04*
