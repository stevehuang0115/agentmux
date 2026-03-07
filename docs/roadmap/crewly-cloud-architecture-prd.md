# PRD: CrewlyAI Cloud 商业化架构设计

## 1. 愿景与目标
CrewlyAI Cloud 是 Crewly 生态的商业化核心。采用 **"Open Core + Cloud Premium"** 模型：核心多 Agent 编排框架开源，而高级团队模板、专家级 Skills、跨地域双机互联以及企业级管理功能通过云端订阅解锁。

## 2. 云端架构设计 (CrewlyAI Cloud)

### 2.1 云服务组成
- **Auth Service**: 处理账号注册、多设备绑定（Device ID 映射）、OAuth 授权。
- **Template & Skill Registry (Premium)**: 
  - 存储付费级模板（如：TikTok 运营专家组、全栈架构师组）。
  - 云端拉取，不通过 npm 安装包分发。
- **WebSocket Relay Node (WS 中枢)**: 
  - 为双机互联提供公网信令转发和数据中继。
  - 支持 NAT 穿透，解决本地机器无公网 IP 的问题。
- **License / Usage Monitoring**: 
  - 监控 Pro/Enterprise 用户的资源使用量（如并发 Agent 数、云端 API 调用次数）。

### 2.2 API 设计
- `GET /v1/cloud/sync`: 同步本地配置与云端订阅状态。
- `GET /v1/templates/premium`: 获取云端模板列表。
- `POST /v1/relay/register`: 注册本地实例为 Relay 节点，获取 Session ID。
- `POST /v1/auth/token`: 设备授权与心跳。

## 3. 付费功能的云端交付

### 3.1 Premium 模板交付
- **逻辑**: 本地 `TemplateService` 在加载时，会并发请求 `CrewlyAI Cloud`。
- **防泄露**: 
  - 模板详情（System Prompt、任务编排）在内存中动态加载。
  - 不写回本地 `config/templates/`。
  - 前端 UI 仅显示脱敏后的摘要，直到任务开始执行。

### 3.2 Premium Skills 交付
- **流式加载**: 对于 Python/JS 类型的 Skill，由云端加密下发脚本，本地执行器在沙箱中运行，并在执行后清除。
- **配置下发**: 部分 Skill（如：高频金融数据接口）在云端封装 API，本地 Skill 仅作为 Proxy 调用云端中转。

### 3.3 云中枢 (双机互联 Relay)
- **设计**: 当 Orchestrator 尝试连接 `remote` 节点且直连失败时，自动切换至云端 Relay 模式。
- **Relay 流程**: Node A (Agent) <-> Cloud (Relay) <-> Node B (Orchestrator)。
- **加密**: 采用端到端加密（E2EE），Relay 仅转发加密流量，不解析内容。

## 4. 开源 Crewly 的集成点

### 4.1 本地新增模块
- **`CloudClientService`**: 负责与云端 API 的所有交互（心跳、拉取、认证）。
- **`CloudAuthMiddleware`**: 在执行 Premium 功能点（如 `QualityGate` 的高级检查）前校验云端 Token。
- **Login UI**: Dashboard 右上角增加 "Connect to CrewlyAI Cloud" 入口。

### 4.2 开源 vs 云端独占
- **开源**: PTY 驱动、基础编排、本地 Skill 加载、基础 Quality Gates (Lint/Test)。
- **云端独占**: 
  - 多机互联公网 Relay。
  - 专家级系统提示词库（Team Templates）。
  - 第三方应用高级插件库（如 Salesforce, SAP 集成）。
  - 企业级权限审计日志。

### 4.3 降级体验
- 离线/未登录用户仅能使用本地安装的模板。
- Dashboard 对应功能置灰并显示 "Upgrade to Pro"。

## 5. Crewly Pro (SMB) 一键安装包
- **角色**: 预装了 `CREWLY_CLOUD_URL` 和 `PRO_LICENSE_KEY` 的特制包。
- **流程**: 
  1. 用户购买后下载 .dmg / .exe。
  2. 启动后自动跳转云端激活页面，完成绑定。
  3. Dashboard 默认加载 "SMB Suite" 模板，实现零配置上手。

## 6. 商业模式与层级建议

| 层级 | 目标用户 | 定价 (建议) | 核心功能 |
| :--- | :--- | :--- | :--- |
| **Free (OS)** | 个人开发者 | $0 | 本地单机, 基础模板, 社区支持 |
| **Pro (Cloud)** | 自由职业者/小团队 | $29/mo | **云端模板库, 双机互联 Relay, 10个并发 Agent** |
| **Enterprise** | 中大型企业 | Custom | **私有云部署, 审计日志, 1对1 部署支持, 无限 Agent** |

## 7. 安全与防抓包
- **Payload 混淆**: 云端下发的模板内容通过动态密钥混淆，本地内存解密。
- **设备指纹**: 检测 Token 是否在异常多的设备间共享。
- **动态门禁**: 核心编排逻辑在执行前需云端“授权”，防止静态破解。
