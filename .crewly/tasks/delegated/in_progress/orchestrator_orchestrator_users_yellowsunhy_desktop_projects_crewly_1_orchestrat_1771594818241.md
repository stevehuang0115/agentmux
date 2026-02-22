# 开发 Orchestrator 心跳机制改进，防止 orchestrator 卡住后无人跟进。

项目路径: /Users/yellowsunhy/Desktop/projects/crewly

## 需求（来自用户）

### 1. 隐式心跳
Orchestrator 每次调用 skill 或 API 时自动算作心跳。基础已有：`config/skills/_common/lib.sh` 的 `X-Agent-Session` header。后端需要在收到这个 header 时更新 orchestrator 的 heartbeat 时间戳。

### 2. 主动请求心跳
长时间无心跳时（比如 2 分钟），系统向 orchestrator 发送心跳请求，检测是否还活着。

### 3. 自动重启 + resume
如果心跳请求也无响应，自动重启 orchestrator 的 PTY session 并立即 resume（注意：不是重启整个 Crewly app，只是重启 orchestrator session）。

### 4. 磁盘清理
检查 disk 空间，清理不需要的文件（Docker images/volumes、日志文件等）。

## 技术指引

- 已有 `backend/src/services/orchestrator/orchestrator-restart.service.ts`，可以参考或扩展
- 已有 `config/skills/orchestrator/heartbeat/execute.sh`，可以参考
- 心跳检测逻辑应该在后端 service 层实现
- 使用现有的 PTY session 系统来重启和 resume
- 先阅读 specs/ 目录了解系统架构

## 验收标准

1. Orchestrator 的每次 API 调用自动更新心跳时间戳
2. 后端能检测 orchestrator 超过 N 分钟无心跳
3. 超时后自动向 orchestrator 发送心跳请求
4. 心跳请求无响应后自动 restart + resume orchestrator session
5. 磁盘清理功能（Docker、日志等）
6. 所有新代码有对应的测试文件

完成后用 report-status 通知我：
bash config/skills/agent/report-status/execute.sh '{"sessionName":"crewly-dev-sam-217bfbbf","status":"done","summary":"..."}'

## Task Information
- **Priority**: high
- **Milestone**: delegated
- **Created at**: 2026-02-20T13:40:18.241Z
- **Status**: In Progress

## Assignment Information
- **Assigned to**: crewly-dev-sam-217bfbbf
- **Assigned at**: 2026-02-20T13:40:18.241Z
- **Status**: In Progress

## Task Description

开发 Orchestrator 心跳机制改进，防止 orchestrator 卡住后无人跟进。

项目路径: /Users/yellowsunhy/Desktop/projects/crewly

## 需求（来自用户）

### 1. 隐式心跳
Orchestrator 每次调用 skill 或 API 时自动算作心跳。基础已有：`config/skills/_common/lib.sh` 的 `X-Agent-Session` header。后端需要在收到这个 header 时更新 orchestrator 的 heartbeat 时间戳。

### 2. 主动请求心跳
长时间无心跳时（比如 2 分钟），系统向 orchestrator 发送心跳请求，检测是否还活着。

### 3. 自动重启 + resume
如果心跳请求也无响应，自动重启 orchestrator 的 PTY session 并立即 resume（注意：不是重启整个 Crewly app，只是重启 orchestrator session）。

### 4. 磁盘清理
检查 disk 空间，清理不需要的文件（Docker images/volumes、日志文件等）。

## 技术指引

- 已有 `backend/src/services/orchestrator/orchestrator-restart.service.ts`，可以参考或扩展
- 已有 `config/skills/orchestrator/heartbeat/execute.sh`，可以参考
- 心跳检测逻辑应该在后端 service 层实现
- 使用现有的 PTY session 系统来重启和 resume
- 先阅读 specs/ 目录了解系统架构

## 验收标准

1. Orchestrator 的每次 API 调用自动更新心跳时间戳
2. 后端能检测 orchestrator 超过 N 分钟无心跳
3. 超时后自动向 orchestrator 发送心跳请求
4. 心跳请求无响应后自动 restart + resume orchestrator session
5. 磁盘清理功能（Docker、日志等）
6. 所有新代码有对应的测试文件

完成后用 report-status 通知我：
bash config/skills/agent/report-status/execute.sh '{"sessionName":"crewly-dev-sam-217bfbbf","status":"done","summary":"..."}'
