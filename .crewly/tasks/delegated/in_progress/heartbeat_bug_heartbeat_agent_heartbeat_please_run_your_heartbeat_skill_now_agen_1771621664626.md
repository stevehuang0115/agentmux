# 修复 Heartbeat 误杀 Bug

## 问题描述
Heartbeat 系统会向正在工作的 agent 发送 heartbeat 提示（'Please run your heartbeat skill now'），打断他们的工作流。更严重的是，agent 可能被误判为 idle 然后被 suspend/terminate，即使他们正在执行任务。

## 根因分析（之前的调查结果）
1. IdleDetection 不检查 workingStatus — 即使 agent 状态是 in_progress，也可能被判定为 idle
2. PtyActivityTracker 依赖 WebSocket 连接 — 只在有人看 UI 时才记录活动
3. ActivityMonitor、PtyActivityTracker、IdleDetection 三个系统互不通信

## 修复方案
1. IdleDetection 加入 workingStatus 检查 — workingStatus 为 in_progress 时不算 idle
2. PtyActivityTracker 脱离 WebSocket 依赖 — session 创建时直接 hook
3. 合并信号：terminal diff 5分钟没变化 + 没有 API 活动 → 才算真正 idle
4. 只有真正 idle 5分钟以上才发 heartbeat prompt

## ⚠️ 重要：批量修改策略
**修改 backend 代码时，务必遵守以下规则：**
- 先规划好所有需要改动的文件
- 一次性完成所有 .ts 文件的修改
- 所有改动完成后，只做一次 `npm run build:backend`
- **不要改一个文件就 build 一次** — 每次 build 会触发 Crewly 重启，打断所有 agent
- 修改完成后用 npx jest 跑相关测试验证

## 相关文件
- backend/src/services/agent/idle-detection.service.ts
- backend/src/services/agent/pty-activity-tracker.service.ts
- backend/src/services/monitoring/activity-monitor.service.ts
- backend/src/services/agent/agent-heartbeat.service.ts
- backend/src/services/agent/agent-heartbeat-monitor.service.ts

## 完成标准
1. 正在工作的 agent (workingStatus=in_progress) 不会收到 heartbeat prompt
2. 只有真正 idle 5分钟以上的 agent 才会被检测为 idle
3. 相关测试通过
4. 只触发一次 build（不要多次 build）

完成后请用 report-status 汇报。

## Task Information
- **Priority**: high
- **Milestone**: delegated
- **Created at**: 2026-02-20T21:07:44.626Z
- **Status**: In Progress

## Assignment Information
- **Assigned to**: crewly-dev-sam-217bfbbf
- **Assigned at**: 2026-02-20T21:07:44.626Z
- **Status**: In Progress

## Task Description

修复 Heartbeat 误杀 Bug

## 问题描述
Heartbeat 系统会向正在工作的 agent 发送 heartbeat 提示（'Please run your heartbeat skill now'），打断他们的工作流。更严重的是，agent 可能被误判为 idle 然后被 suspend/terminate，即使他们正在执行任务。

## 根因分析（之前的调查结果）
1. IdleDetection 不检查 workingStatus — 即使 agent 状态是 in_progress，也可能被判定为 idle
2. PtyActivityTracker 依赖 WebSocket 连接 — 只在有人看 UI 时才记录活动
3. ActivityMonitor、PtyActivityTracker、IdleDetection 三个系统互不通信

## 修复方案
1. IdleDetection 加入 workingStatus 检查 — workingStatus 为 in_progress 时不算 idle
2. PtyActivityTracker 脱离 WebSocket 依赖 — session 创建时直接 hook
3. 合并信号：terminal diff 5分钟没变化 + 没有 API 活动 → 才算真正 idle
4. 只有真正 idle 5分钟以上才发 heartbeat prompt

## ⚠️ 重要：批量修改策略
**修改 backend 代码时，务必遵守以下规则：**
- 先规划好所有需要改动的文件
- 一次性完成所有 .ts 文件的修改
- 所有改动完成后，只做一次 `npm run build:backend`
- **不要改一个文件就 build 一次** — 每次 build 会触发 Crewly 重启，打断所有 agent
- 修改完成后用 npx jest 跑相关测试验证

## 相关文件
- backend/src/services/agent/idle-detection.service.ts
- backend/src/services/agent/pty-activity-tracker.service.ts
- backend/src/services/monitoring/activity-monitor.service.ts
- backend/src/services/agent/agent-heartbeat.service.ts
- backend/src/services/agent/agent-heartbeat-monitor.service.ts

## 完成标准
1. 正在工作的 agent (workingStatus=in_progress) 不会收到 heartbeat prompt
2. 只有真正 idle 5分钟以上的 agent 才会被检测为 idle
3. 相关测试通过
4. 只触发一次 build（不要多次 build）

完成后请用 report-status 汇报。
