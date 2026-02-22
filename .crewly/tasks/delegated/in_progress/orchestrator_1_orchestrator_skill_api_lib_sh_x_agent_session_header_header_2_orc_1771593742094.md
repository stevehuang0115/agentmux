# 开发 Orchestrator 心跳改进功能。具体需求：

1. **隐式心跳** — orchestrator 每次调用 skill 或 API 时自动算作心跳。lib.sh 已有 X-Agent-Session header 基础，后端需要在收到带此 header 的请求时更新心跳时间戳。

2. **主动心跳请求** — 当系统检测到 orchestrator 长时间（比如 2 分钟）无心跳时，向 orchestrator 的 PTY session 发送心跳请求消息。

3. **自动重启 + resume** — 如果心跳请求也无响应（再等 1 分钟），自动重启 orchestrator 的 PTY session 并立即 resume（不重启整个 Crewly app）。使用已有的 orchestrator-restart.service.ts 作为基础。

4. **磁盘清理** — 检查磁盘空间，清理 Docker images/volumes、日志文件等。可以创建一个 disk-cleanup 服务。

关键文件参考：
- backend/src/services/orchestrator/orchestrator-restart.service.ts
- backend/src/services/monitoring/activity-monitor.service.ts
- config/skills/_common/lib.sh (X-Agent-Session header)
- backend/src/middleware/ (heartbeat middleware)

注意：每个新文件都需要对应的 .test.ts 测试文件。遵循项目 CLAUDE.md 的规范。

## Task Information
- **Priority**: high
- **Milestone**: delegated
- **Created at**: 2026-02-20T13:22:22.094Z
- **Status**: In Progress

## Assignment Information
- **Assigned to**: crewly-dev-sam-217bfbbf
- **Assigned at**: 2026-02-20T13:22:22.094Z
- **Status**: In Progress

## Task Description

开发 Orchestrator 心跳改进功能。具体需求：

1. **隐式心跳** — orchestrator 每次调用 skill 或 API 时自动算作心跳。lib.sh 已有 X-Agent-Session header 基础，后端需要在收到带此 header 的请求时更新心跳时间戳。

2. **主动心跳请求** — 当系统检测到 orchestrator 长时间（比如 2 分钟）无心跳时，向 orchestrator 的 PTY session 发送心跳请求消息。

3. **自动重启 + resume** — 如果心跳请求也无响应（再等 1 分钟），自动重启 orchestrator 的 PTY session 并立即 resume（不重启整个 Crewly app）。使用已有的 orchestrator-restart.service.ts 作为基础。

4. **磁盘清理** — 检查磁盘空间，清理 Docker images/volumes、日志文件等。可以创建一个 disk-cleanup 服务。

关键文件参考：
- backend/src/services/orchestrator/orchestrator-restart.service.ts
- backend/src/services/monitoring/activity-monitor.service.ts
- config/skills/_common/lib.sh (X-Agent-Session header)
- backend/src/middleware/ (heartbeat middleware)

注意：每个新文件都需要对应的 .test.ts 测试文件。遵循项目 CLAUDE.md 的规范。
