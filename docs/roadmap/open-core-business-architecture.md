# Crewly Open-Core 商业架构设计方案 (v1.0)

**状态**：草案 (待 Steve 评审)  
**设计人**：Mia (PM, crewly-core-mia-member-1)  
**日期**：2026-03-04  
**目标**：建立可持续的商业模式，通过开源吸引流量，通过 Pro 版实现营收。

---

## 1. 开源 vs 商业 功能划分

遵循「核心引擎开源，业务增效商业」的原则，参考 GitLab CE/EE 和 n8n。

| 维度 | Crewly (OSS - 开源) | Crewly Pro (商业) | 划分依据 |
| :--- | :--- | :--- | :--- |
| **核心引擎** | 多 Agent 编排、PTY 隔离、Skill 系统、API 框架 | 高并发优化、跨节点集群支持 | 核心能力免费 |
| **控制界面** | 基础 Web Dashboard、CLI | 企业级看板、成本审计、多用户权限管理 (RBAC) | 管理深度差异 |
| **团队模板** | 1 个 Starter 模板 (通用协作) | 全套垂直行业模板 (Dev, Content, Research) | 业务价值定价 |
| **技能库** | 基础 Bash Skills (Git, FS, Search) | 商业 API 技能包 (G-Workspace, Shopify, Salesforce) | 集成复杂度 |
| **自动化** | 手动编写 SOP / Prompt | **AI 学徒模式 (录屏自动转 SOP/Skill)** | 生产力飞跃 |
| **部署** | 源码构建、Docker Compose | 一键安装包 (Desktop/Native)、自动化托管云 (SaaS) | 降低使用门槛 |

---

## 2. crewly-pro 目录结构与依赖设计

商业版不再 Fork 开源版，而是作为开源版的「插件式包装层」。

### 2.1 目录结构 (crewly-pro)
```text
crewly-pro/
├── packages/
│   ├── pro-backend/          # 继承开源后端，注入 Pro 中间件与路由
│   ├── premium-templates/    # 商业级行业模板
│   ├── premium-skills/       # 高级集成技能
│   ├── apprentice-recorder/  # AI 学徒模式录屏组件 (Electron/C++)
│   └── desktop-installer/    # 一键安装程序打包脚本
├── licensing/                # License 验证逻辑
├── docker/                   # 商业版 Docker 镜像定义
└── package.json              # 依赖开源版 "@crewly/core"
```

### 2.2 依赖管理策略
商业版将开源版作为 **npm dependency** 引入。
- **开源侧**：提供 `Hook/Plugin` 系统（如 `onAgentBoot`, `onTaskVerify`），允许 Pro 版注入代码。
- **商业侧**：通过继承类或装饰器模式扩展开源功能，确保开源版升级时，商业版只需更新版本号即可获益。

---

## 3. 模板商业化策略

### 3.1 模板分发逻辑
- **Starter 模板**：预置在开源代码库中。
- **Pro 模板**：通过 `crewly install template-[id]` 命令获取。
- **验证**：安装时需校验 `LICENSE_KEY`，成功后从私有镜像/仓库下载模板 JSON 及专用 SOP。

### 3.2 定价方案建议
- **Community**: $0 (1 个团队, 2 个 Agent)。
- **Pro (Self-hosted)**: $29/mo (不限团队, 包含所有 Pro 模板, AI 学徒模式)。
- **Enterprise (Managed)**: $499/mo 起 (包含代运维、定制 Skill 编写)。

---

## 4. License 验证机制设计

### 4.1 验证流程
1.  **签发**：用户购买后获得基于 JWT 签名的 License Key（包含有效期、功能模块、团队规模）。
2.  **激活**：用户在 Dashboard 或 CLI 输入 Key，后端向 `license.crewlyai.com` 发起一次性激活请求。
3.  **校验**：
    -   **在线模式**：每 24 小时进行一次静默心跳校验。
    -   **离线模式**：支持企业级离线 License，基于机器指纹绑定。
4.  **授权失效**：失效后回退至 OSS 功能集，隐藏商业看板并禁用 Pro 模板。

---

## 5. 商业功能 Roadmap

### 第一阶段：基础设施 (W1-2)
- 实现 License 签发与后端校验逻辑。
- 重构开源版支持「插件挂载」。
- 发布 3 个预设行业模板的 Pro 版。

### 第二阶段：易用性飞跃 (W3-4)
- **一键安装包 (The Installer)**：推出 Windows/Mac 桌面端，自动配置 Node.js 和 PTY 环境。
- **Dashboard 企业版**：增加 Token 成本分析看板。

### 第三阶段：AI 学徒模式 MVP (W5-8)
- **录屏捕获**：开发轻量级桌面录屏工具，捕获用户操作步骤。
- **SOP 转换**：利用多模态模型 (Gemini Vision) 解析视频，自动生成 Markdown 格式的 SOP。
- **Skill 自动生成**：根据 SOP 自动写出对应的 Bash Skill 脚本。

---

## 6. GTM (Go-to-Market) 策略

-   **目标用户**：被 OpenClaw 安全问题困扰的机构、无技术团队的 SMB 老板、追求执行效率的内容工作室。
-   **分发渠道**：
    -   **GitHub**：通过开源版 README 引导至 Pro 落地页。
    -   **CLI**：在 `crewly init` 时询问是否激活 Pro 功能。
    -   **Marketplace**：在官网建立技能/模板市场，支持第三方开发者分成。
-   **竞品对比**：
    -   **CrewAI**：目前以 Cloud 托管为主。Crewly Pro 强在「本地管理」与「可视化 PTY 流」。
    -   **AutoGen**：偏学术和重度开发。Crewly Pro 强在「开箱即用的行业模板」。

---
*设计人：Mia (Product Manager) | 2026-03-04*
