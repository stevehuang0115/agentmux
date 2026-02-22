# 你有两个任务，请按顺序完成：

## 任务 1: 部署 Marketing Page 到 Prod

项目路径: /Users/yellowsunhy/Desktop/projects/stevesprompt/apps/crewly

你刚才完成的 blog 优化已经构建验证通过（13 页面成功生成）。现在需要部署到 production。
- 查看项目的部署配置（docker-compose, Dockerfile 等）
- 注意：monorepo .dockerignore 可能排除 markdown 文件（之前的 gotcha）
- Apple Silicon 需要 --platform linux/amd64
- 确保构建和部署成功

## 任务 2: 开发 Orchestrator 心跳自动检测和自动重启功能

项目路径: /Users/yellowsunhy/Desktop/projects/crewly

### 需求

#### 2a. 隐式心跳
- 当前 `config/skills/_common/lib.sh` 的 `api_call()` 已发送 `X-Agent-Session` header
- 后端需要将每次收到的 orchestrator API 请求记录为心跳时间戳
- 查看 `backend/src/services/monitoring/activity-monitor.service.ts` 和 `backend/src/middleware/` 了解现有实现
- 确保每次 orchestrator 调用 skill/API 时，后端自动更新心跳时间

#### 2b. 主动请求心跳
- 当 orchestrator 长时间无心跳（比如 2 分钟没有任何 API 调用），后端应向 orchestrator 的 PTY session 发送一个心跳请求消息
- orchestrator 收到后执行 heartbeat skill 回应
- 这覆盖了 orchestrator 空闲但还活着的情况

#### 2c. 自动重启 + Resume
- 如果发送心跳请求后仍然无响应（再等 1 分钟），则：
  1. 重启 orchestrator 的 PTY session（不是重启整个 Crewly app）
  2. 立即执行 resume session（恢复上一次对话）
- 查看 `backend/src/services/orchestrator/orchestrator-restart.service.ts` 了解现有重启逻辑
- 查看 `resume-session` skill 了解 resume 机制

### 技术要点
- 心跳超时和重启逻辑应在后端服务中实现
- 不要修改 orchestrator 的 Claude Code 逻辑，只修改后端检测和重启逻辑
- 写好单元测试（co-located .test.ts 文件）
- 确保 npm run build 通过

完成后用 report-status 通知我：
bash config/skills/agent/report-status/execute.sh '{"sessionName":"crewly-dev-sam-217bfbbf","status":"done","summary":"..."}'

## Task Information
- **Priority**: high
- **Milestone**: delegated
- **Created at**: 2026-02-20T06:39:59.171Z
- **Status**: In Progress

## Assignment Information
- **Assigned to**: crewly-dev-sam-217bfbbf
- **Assigned at**: 2026-02-20T06:39:59.171Z
- **Status**: In Progress

## Task Description

你有两个任务，请按顺序完成：

## 任务 1: 部署 Marketing Page 到 Prod

项目路径: /Users/yellowsunhy/Desktop/projects/stevesprompt/apps/crewly

你刚才完成的 blog 优化已经构建验证通过（13 页面成功生成）。现在需要部署到 production。
- 查看项目的部署配置（docker-compose, Dockerfile 等）
- 注意：monorepo .dockerignore 可能排除 markdown 文件（之前的 gotcha）
- Apple Silicon 需要 --platform linux/amd64
- 确保构建和部署成功

## 任务 2: 开发 Orchestrator 心跳自动检测和自动重启功能

项目路径: /Users/yellowsunhy/Desktop/projects/crewly

### 需求

#### 2a. 隐式心跳
- 当前 `config/skills/_common/lib.sh` 的 `api_call()` 已发送 `X-Agent-Session` header
- 后端需要将每次收到的 orchestrator API 请求记录为心跳时间戳
- 查看 `backend/src/services/monitoring/activity-monitor.service.ts` 和 `backend/src/middleware/` 了解现有实现
- 确保每次 orchestrator 调用 skill/API 时，后端自动更新心跳时间

#### 2b. 主动请求心跳
- 当 orchestrator 长时间无心跳（比如 2 分钟没有任何 API 调用），后端应向 orchestrator 的 PTY session 发送一个心跳请求消息
- orchestrator 收到后执行 heartbeat skill 回应
- 这覆盖了 orchestrator 空闲但还活着的情况

#### 2c. 自动重启 + Resume
- 如果发送心跳请求后仍然无响应（再等 1 分钟），则：
  1. 重启 orchestrator 的 PTY session（不是重启整个 Crewly app）
  2. 立即执行 resume session（恢复上一次对话）
- 查看 `backend/src/services/orchestrator/orchestrator-restart.service.ts` 了解现有重启逻辑
- 查看 `resume-session` skill 了解 resume 机制

### 技术要点
- 心跳超时和重启逻辑应在后端服务中实现
- 不要修改 orchestrator 的 Claude Code 逻辑，只修改后端检测和重启逻辑
- 写好单元测试（co-located .test.ts 文件）
- 确保 npm run build 通过

完成后用 report-status 通知我：
bash config/skills/agent/report-status/execute.sh '{"sessionName":"crewly-dev-sam-217bfbbf","status":"done","summary":"..."}'
