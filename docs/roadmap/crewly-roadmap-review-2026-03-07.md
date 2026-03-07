# Crewly Roadmap 完整梳理与优先级审查 (2026-03-07)

**负责人**: Mia (Product Manager)  
**日期**: 2026-03-07  
**战略定位**: 从“AI 工具”升级为 **“AI 团队实时运维管理控制台” (Live Operations Management Console for AI Teams)**。

---

## 1. 核心进展回顾 (Completed Milestones)

目前 Crewly 已完成从单 Agent 助手向复杂团队编排框架的底层转型：

- **分层架构 (Hierarchical Architecture)**: 6 个阶段全部完成。支持 Orchestrator -> Team Leader -> Worker 的多级任务分发与状态同步。
- **实时观测栈 (Observability Stack)**: 实现了基于 xterm.js 的 PTY 终端实时串流，用户可实时查看并干预 Agent 执行过程。
- **质量门禁 (Quality Gates)**: 建立了代码级交付标准（Build/Test/Lint/Typecheck），确保 Agent 输出符合工程规范。
- **预算追踪 (Budget Tracking)**: 实现了 Agent/项目级的 Token 消耗监控与成本预警。
- **MCP 基础集成**: 已完成 `McpClientService` 开发，支持通过标准 MCP 协议调用外部工具（Filesystem, GitHub 等）。

---

## 2. 正在进行的工作 (In-Progress)

- **Team Organization (v2)**: 正在完善 `TeamMember` 级联管理逻辑，支持团队级的 `parentTeamId` 组织架构。
- **远程节点 MVP (Remote Agent Support)**: 基于 WebSocket 代理实现双机互联，支持 Steve 在 MacBook 上控制 Mac mini 上的 Agent（用于绕过账号风控或利用特定硬件）。
- **Onboarding 体验优化**: 修复 `npx crewly init` 在某些环境下的包名错误与依赖缺失问题。

---

## 3. 下一步优先级排序 (Priority Audit)

基于 **“Open Source 获客 + Pro 交付价值”** 的双轨战略，建议优先级调整如下：

### **P0: 开源发布准备与稳定性 (Short-term / 1-2周)**
*   **Onboarding 歼灭战 (Optimize)**: 修复 `onboard.ts` 的所有 P0 Bug，确保 Time-to-First-Agent < 60 秒。
*   **OSS 合规整备 (New)**: 正式确定 MIT 协议，清理 `.env` 泄露风险，完善 `CONTRIBUTING.md`。
*   **1-Click SMB 安装包 (New)**: 提供 Docker-bundled 镜像，包含前端 Dashboard + 后端 + 预设环境，降低 SMB 部署门槛。

### **P1: 核心差异化特性 (Mid-term / 3-4周)**
*   **AI Apprentice Mode V1 (New)**: “学徒模式”。录制人类在浏览器/系统的操作流，自动生成 SOP Markdown 和对应的 Skill 代码。
*   **A2A 协议支持 (Extend)**: 支持 Agent-to-Agent 标准协议，使 Crewly 能指挥运行在外部框架（如 LangGraph, CrewAI）上的 Agent。
*   **Wechaty 适配器 (New)**: 满足 SteamFun 等客户在微信生态内进行自动课程运营的需求。

### **P2: 行业模板与生态 (Mid-term / 5-6周)**
*   **垂直行业 Skill Packs (Extend)**: 
    - **Education**: 课程同步、作业批改 Skill。
    - **UGC Video**: 结合 Remotion 的视频自动剪辑、字幕生成模板。
*   **Skill Marketplace (New)**: 基于 MCP 的技能市场原型，支持一键导入社区发布的 MCP Server。

### **P3: 长期演进 (Long-term / 7-8周)**
*   **可视化工作流编辑器**: 拖拽式 SOP 编辑界面，替代现有的 JSON/YAML 配置。
*   **智能模型路由 (Smart Router)**: 根据任务复杂度自动在 Sonnet 3.5 (推理) 与 Haiku/Gemini (执行) 之间切换以优化成本。

---

## 4. 建议执行时间线 (8-Week Roadmap)

| 阶段 | 目标 | 关键交付物 |
| :--- | :--- | :--- |
| **Sprint 1 (W1-2)** | **极致上手体验** | 修复 Init Bug, 发布 MIT 版本, 录制 3-Agent Demo。 |
| **Sprint 2 (W3-4)** | **跨机与学徒模式** | 远程节点 MVP, AI Apprentice V1, A2A 协议对接。 |
| **Sprint 3 (W5-6)** | **垂直行业深耕** | SteamFun 微信集成, UGC 视频模板, 预算超支熔断。 |
| **Sprint 4 (W7-8)** | **商业化闭环** | 交付 5 个付费 Pilot, 企业级管理面板 (/enterprise) 上线。 |

---

## 5. 风险评估

1.  **安全风险**: 随着 A2A 和远程节点的引入，需防范未经授权的远程命令执行。需在 V2 中强制开启 API Key 握手。
2.  **模型依赖**: 目前深度依赖 Claude 的代码生成能力，若 Anthropic 调整 API 策略或被封号，需具备一键切换至 Gemini 1.5 Pro 的能力（已在 Smart Router 计划中）。
3.  **安装门槛**: 复杂的依赖（tmux, node, docker）依然是 SMB 用户的障碍。必须坚持 **"Docker Is All You Need"** 的分发策略。

---
*文档生成：Mia (crewly-core-mia-member-1)*  
*日期：2026-03-07*
