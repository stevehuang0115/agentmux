# Crewly 层级化架构：产品工作流设计 (v1.1)

**状态**：草案 (待技术评审)  
**设计人**：Mia (PM, crewly-core-mia-member-1)  
**日期**：2026-03-04  
**目标**：将 Crewly 从扁平化 Agent 协作升级为多层级、自动化的「AI 员工公司」架构。

---

## Part 1: 自动化工作流设计 (The 5-Role Loop)

层级化架构的核心是实现「从意图到交付」的完整闭环，通过五个核心角色定义职责边界：

### 1. Goal Setter (目标设定者)
-   **角色身份**：人类用户 (Steve) 或 高级业务代理 (Orchestrator)。
-   **核心职责**：定义「做什么」和「做成什么样」。
-   **自动化触发**：当目标存入 `goals.md` 时，触发下一级。

### 2. Planner (规划者)
-   **角色身份**：Team Lead (TL, hierarchyLevel=1)。
-   **核心职责**：目标拆解、依赖管理、资源分配。

### 3. Executor (执行者)
-   **角色身份**：Worker Agent (parentMemberId 指向 TL)。
-   **核心职责**：专注执行任务、心跳汇报、异常上报。

### 4. Verifier (验证者)
-   **角色身份**：QA/Reviewer Agent 或 TL 触发的自动化管道。
-   **核心职责**：执行质量门禁、自动化测试、结果核验。

### 5. Reporter (上报者)
-   **角色身份**：TL 自动汇总。
-   **核心职责**：进度 Rollup、异常快速通道、生成定期报告。

---

## Part 2: 场景演示 (Scenarios)

### 场景 A：开发 Web App (CRM 系统)
**流程**：Steve (Goal Setter) -> Orchestrator -> PM Lead (Planner) -> Tech Lead (Verifier/Reporter) -> Dev Agents (Executor)。

### 场景 B：社媒内容运营 (3 篇小红书)
**流程**：Steve -> Orchestrator -> GTM Lead (Planner/Reporter) -> Luna/Mila/Ella (Executor) -> Iris (Verifier)。

---

## Part 3: 现有差距分析

| 需求点 | 当前 Crewly 已有 | 缺失项 | 优先级 |
| :--- | :--- | :--- | :--- |
| **多层级定义** | `team.json` 扁平结构 | 支持 `parentMemberId` 和 `hierarchyLevel` | **P0** |
| **状态上报** | `report-status` 技能 | 跨层级的「自动 Rollup」统计 | **P0** |
| **任务状态机** | 基础状态 | 借鉴 A2A 的状态机 (submitted->working->completed) | **P1** |

---

## Part 4: Team Template 产品设计

Team Template 是实现「一键部署 AI 团队」的核心配方。它不仅定义了团队的成员组成，还定义了业务逻辑的「硬性约束」。

### 1. 概念定义
-   **Team Template**：一个预配置的「团队蓝图」，包含角色定义、必需技能、标准工作流以及特定的验证算法。
-   **核心组件**：
    -   `Roles`：TL 与 Workers 的角色分配。
    -   `Skillsets`：该团队必须安装的技能包（如 Playwright, Web-search）。
    -   `Workflow Schema`：默认的任务拆解模板。
    -   `Verification Pipeline`：该行业特有的质量标准定义。

### 2. 三个预设模板定义

#### 模板 A：开发团队 (Dev Team)
*   **适用场景**：Web 应用开发、脚本编写、Bug 修复。
*   **角色配置**：Tech Lead (TL) + Developer(s) + QA。
*   **核心工具**：`computer-use`, `chrome-browser`, `playwright`, `jest`。
*   **验证方式 (Verification Pipeline)**：
    1.  **Static Check**：Linting 与类型检查。
    2.  **Logic Test**：运行 Unit Tests。
    3.  **Visual Test**：使用 Playwright 打开浏览器 -> 模拟操作 -> 截图对比。
    4.  **Security Scan**：检查硬编码密钥。

#### 模板 B：内容/社媒团队 (Content Team)
*   **适用场景**：小红书/公众号运营、营销文案生成、SEO 博客。
*   **角色配置**：Content Lead (TL) + Writer(s) + Designer + Reviewer。
*   **核心工具**：`screenshot`, `gemini-vision`, `nano-banana-image` (图像生成)。
*   **验证方式 (Verification Pipeline)**：
    1.  **Brand Sync**：检查是否包含预设关键词、语气是否匹配 Brand Voice。
    2.  **Visual Review**：Gemini 视觉解析图片，检查文字是否有误、风格是否统一。
    3.  **De-AI Filter**：检查文本流利度，去除明显的 AI 常用词汇。
    4.  **Link Check**：确保文中引用的链接均有效。

#### 模板 C：研究/策略团队 (Research Team)
*   **适用场景**：竞品分析、市场调研报告、投资建议书。
*   **角色配置**：Research Lead (TL) + Analyst(s) + Fact-Checker。
*   **核心工具**：`web-search`, `chrome-browser`, `pdf-parser`。
*   **验证方式 (Verification Pipeline)**：
    1.  **Source Validation**：核查引用的 URL 是否为 404，是否来自高权重域名。
    2.  **Cross-Check**：对比至少两个不同来源的数据点，标记矛盾项。
    3.  **Logic Review**：检查推论逻辑是否严密。

### 3. Verification Pipeline 产品逻辑

验证不再是单一的「通过/失败」，而是一个**多级门禁系统**。

-   **Pipeline 流程**：
    -   **Step 1: Automated Scrutiny** (脚本自动化扫描)。
    -   **Step 2: Cross-Agent Review** (由 Verifier 角色进行语义审查)。
    -   **Step 3: Human-in-the-Loop** (可选，对于 P0 级交付物，TL 发送 Slack 请求人类确认)。
-   **不通过处理机制**：
    -   **Auto-Correction**：如果是格式或 Lint 错误，直接触发 `fix` 指令返回给原 Executor。
    -   **Escalation**：如果是逻辑或质量不达标，TL 重新激活该任务，并在 `context` 中注入详细的打回理由。
    -   **Threshold**：如果同一个任务重试 3 次仍未通过，TL 标记任务为 `Blocked` 并向 Orchestrator 报错。

---
*设计人：Mia (Product Manager) | 2026-03-04*
