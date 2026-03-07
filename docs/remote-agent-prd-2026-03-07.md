# PRD: Crewly 双机互联 (Remote Agent Support)

## 1. 需求概述
Steve 在两台电脑（例如：MacBook 和 Mac mini）上运行 Crewly。其中一台电脑（Remote Node）拥有特定的资源或环境（如：已登录的小红书/TikTok 账号、特定的 GPU 环境或网络权限），而另一台电脑（Main Node）作为他的主工作站运行 Orchestrator。

本需求旨在实现：**主电脑的 Orchestrator 可以无缝调用、管理和监控运行在另一台电脑上的 Agent。**

## 2. 用户故事
- **核心故事**: 作为 Steve，我希望在定义团队成员时，可以指定某个 Agent 运行在“我的 Mac mini”上，这样该 Agent 就能使用 Mac mini 上的浏览器环境操作小红书，而我依然在 MacBook 上通过一个统一的 Dashboard 监控所有进度。
- **管理故事**: 作为 Steve，我希望只需配置一次远程机器的 IP 地址，之后所有远程 Agent 的启动、停止、日志查看都像本地 Agent 一样简单。
- **安全故事**: 作为 Steve，我不希望局域网内的其他人能随意连接我的远程 Crewly Node，需要有基础的认证机制。

## 3. 技术方案评估

| 方案 | 描述 | 优点 | 缺点 | 评估 |
| :--- | :--- | :--- | :--- | :--- |
| **A) HTTP API 直连** | 两台机器通过 REST API 同步任务和状态。 | 简单，标准。 | 终端实时流（PTY）难以通过 HTTP 高效实现，延迟大。 | 不推荐（仅用于元数据同步） |
| **B) WebSocket 代理 (WS Proxy)** | **推荐方案**。在 WS 上封装 PTY 协议，实现双向实时流。 | 实时性最高，现有 `TerminalGateway` 易于扩展，双向通信自然。 | 需要处理连接稳定性。 | **首选方案** |
| **C) SSH 隧道 (SSH Tunnel)** | 通过 `ssh -L` 将远程 PTY 端口映射到本地。 | 极高安全性，自带加密，成熟。 | 配置复杂（需要 SSH Key，防火墙开启 SSH），不便于集成到 UI。 | 备选（作为底层传输） |
| **D) MCP (Model Context Protocol)** | 使用 MCP 协议作为跨机通信标准。 | 标准化程度高，符合 Crewly 长期架构。 | MCP 目前对原生终端流（Terminal Stream）的支持较弱。 | 长期演进方向 |

## 4. 推荐方案：WebSocket 远程会话代理 (Crewly Node)

### 4.1 核心架构
1. **Remote Node (Agent 端)**: 正常运行 Crewly Backend，开启 WebSocket 监听。
2. **Main Node (Orchestrator 端)**: 
   - 实现 `RemoteSessionBackend` (继承 `ISessionBackend`)。
   - 实现 `RemoteSession` (继承 `ISession`)。
   - 当启动远程 Agent 时，`RemoteSession` 通过 WebSocket 连接远程节点，并代理所有 `write`, `resize`, `onData` 事件。

### 4.2 数据结构变更
在 `TeamMember` 接口中增加可选字段：
```typescript
interface TeamMember {
  // ... 现有字段
  nodeId?: string; // 指定运行节点 ID，默认为 'local'
}
```

在系统设置中增加 `nodes` 配置：
```typescript
interface RemoteNode {
  id: string;
  name: string;
  address: string; // e.g. "192.168.1.10:3000"
  apiKey: string;
}
```

### 4.3 安全机制
- **MVP**: 使用 `X-Crewly-API-Key` 请求头验证。
- **V2**: 支持自签名证书的 WSS (Secure WebSocket)。

## 5. 实现步骤 (Roadmap)

### 第一阶段：MVP (V1) - 局域网手动互联
- [ ] 后端：实现 `RemoteSessionBackend` 和 `RemoteSession` 类。
- [ ] 后端：在 `SessionBackendFactory` 中根据 `nodeId` 分发会话创建请求。
- [ ] 协议：定义一套简单的 WS 消息协议（`cmd: create_session`, `cmd: write`, `event: data`）。
- [ ] UI：支持在配置文件或 Settings 中手动添加远程 Node。

### 第二阶段：V2 - 易用性与安全增强
- [ ] 发现机制：集成 mDNS/Bonjour，自动发现局域网内的其他 Crewly 实例。
- [ ] 认证：增加 API Key 握手流程。
- [ ] UI：在 Team 编辑器中增加“运行节点”下拉选择框。

### 第三阶段：V3 - 公网穿透与多节点管理
- [ ] 穿透：集成 Tailscale 或 Cloudflare Tunnel 选项，支持非局域网互联。
- [ ] 状态监控：在 Dashboard 实时显示各节点的 CPU/内存负载。

## 6. 预估工期
- **方案设计与协议定义**: 1天
- **后端 Proxy 核心逻辑实现**: 3天
- **联调与双机测试**: 2天
- **UI 适配**: 2天
- **总计**: 约 8 个工作日

## 7. 风险与注意事项
- **延迟问题**: 在公网环境下，PTY 交互可能会有明显延迟，需要优化 buffer 策略。
- **版本兼容性**: 两台机器的 Crewly 版本需保持一致，否则消息协议可能不兼容。
- **文件系统**: Agent 往往需要读写文件。远程 Agent 读写的是它本机的磁盘。Orchestrator 需要意识到这一点（或通过 MCP 远程读写文件）。
