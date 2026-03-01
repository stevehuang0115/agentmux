# Crewly Website Strategy — Final Decisions (v1.0)

Owner: Steve
Audience: Product, Design, Eng, Growth
Goal: 用当前网站真实转化 B2B 客户，同时为未来 AI Team OS 愿景做铺垫（不过度承诺）

## 1) 信息架构（单域名 + Path）

结论：使用 path，不使用 subdomain。

```
/                首页（B2B 转化 + 真实能力 + 愿景一层）
/community       开源 + 模板 + 示例 + 贡献（对外叫 Community）
/docs            安装、教程、架构（面向开发者）
/enterprise      定制 AI Team 服务（核心转化页）
/case            案例（STEAM Fun 为主）
/blog            内容（Founder-led distribution）
```

说明：后续如果有云端产品/登录，再新增 app.crewlyai.com。当前阶段不需要 subdomain。

## 2) 命名与分区

- Open Source 对外统一命名为：Community
- 对外语义：AI Team ecosystem（生态入口）
- 内部仍保留开源 repo 与 license

## 3) 导航（Header）

```
Community | Docs | For Business | Case Study | Blog | [Book a Call]
```

- 移除 "Download" 主导航（放到 Docs）
- 主 CTA：Book a Call（唯一核心转化入口）

## 4) 首页（/）— Reality-aligned + Vision hook

### Hero（主标题）

> We build AI teams that run your operations.
> Design and deploy AI agents to handle content, ops, communication, and workflows — tailored to your business.

CTA：[Book a Call]（主） / [View Case Study]（次）

### What we do（我们现在能做的）

- AI 内容团队（写作/编辑/发布/分发）
- AI 运营团队（客户沟通/排班/报表/归档）
- AI 工作流自动化（跨工具、数据整理、通知）

### Case（真实案例）

STEAM Fun（科学奶酪）
- 学生/班级数据结构
- 家长沟通自动化
- 教学记录归档
- 运营流程自动化

### How it works（交付流程）

1. Discovery（理解业务与目标）
2. Team Design（角色与流程设计）
3. Deployment（本地/混合部署）
4. Optimization（持续优化与进化）

### Vision（愿景一层）

> Our long-term vision is to build an AI Team Operating System — enabling one person to run a full company.

### CTA（收尾）

Book a Call

## 5) Community 页面（/community）

定位：Everything you need to build your own AI team

内容结构：
- 开源核心（Crewly core / orchestration / examples）
- 模板与示例（现有可用 + Coming Soon）
- 教程与最佳实践
- 贡献与社区

明确区分：Free vs Paid（但不过度产品化）
- Free：开源框架、基础示例、文档
- Paid（Pro/Support Pack，非 SaaS 功能包）：
  - 快速安装与配置支持
  - 高质量模板包
  - 优先答疑 / Office hours
- Enterprise：定制 AI Team（见 /enterprise）

按钮：
- View on GitHub
- Read Docs
- Book a Call (For Business)

## 6) Enterprise 页面（/enterprise）— 核心转化页

### 标题

> A custom AI operations team for your business

### 内容

- 适用场景：教育 / 电商 / 服务业 / 内容团队
- 能做什么：内容、运营、客服、报表、流程自动化
- 交付流程（同首页）
- 定价（范围即可）
  - Setup：$500 – $2,000+
  - Monthly support：$200 – $500+

CTA：Schedule a Call

## 7) Case 页面（/case）

- 重点：STEAM Fun（详细拆解：问题 → 方案 → 结果）
- 后续逐步加入 1–2 个新案例（电商/内容）

CTA：Book a Call

## 8) Pricing（当前阶段策略）

- 不做 SaaS 分层定价页
- 只在 /enterprise 提供服务区间报价
- Community 页面解释 Free / Paid（Support Pack）/ Enterprise 的差异

## 9) Sales Funnel（当前阶段）

Primary Funnel：Founder-led, high-touch

```
Website → Book a Call → Qualification Form → Founder Call → Proposal → Close
```

### Qualification 表单（在预约前）

必填字段：
- 行业/业务类型
- 想解决的 1–2 个核心问题
- 当前团队规模
- 预算范围（区间）

## 10) AI Sales Agent（阶段性决策）

- 现在：不作为主入口
- 未来：作为预筛选层（pre-qualification）
  - 收集需求 → 评分 → 符合条件才给预约链接

## 11) Messaging 规范（统一话术）

保留关键词：
- AI Team
- AI Team OS（愿景层）
- AI operations team
- Self-driving AI team（能力表述）
- One person, full AI company（愿景）

避免在首页使用的表述：
- "Orchestrate AI Coding Agents"
- "Multi-runtime support"
- 具体模型名（Claude/Gemini/Codex）— 放到 Docs

## 12) 范围控制（现在不做）

在没有 cloud managed / API / self-serve 之前，不做：
- SaaS 定价层（agents 数量、Slack 集成等）
- 模板 marketplace UI（可展示 coming soon）
- API / SDK 页面
- 登录/云端 App

## 13) 执行优先级

**P0（本周）：**
- 首页改为 B2B 转化版
- 新建 /enterprise、/community、/case
- 导航与 CTA 统一为 Book a Call

**P1（下周）：**
- Docs 更新（安装与 Quick Start）
- Community 内容补齐（示例/教程/贡献入口）
- 1 个详细案例上线（STEAM Fun）

**P2（后续）：**
- 增加第 2–3 个案例
- 打磨 Support Pack（Pro）内容
- 预研 AI Sales Agent（仅作预筛选）

## 14) 成功指标（当前阶段）

- 每周 Book a Call 预约数
- Qualified lead 比例（>50%）
- 成交数 / 月
- 客单价（Setup + Monthly）

---

**一句话对齐：**
现在的网站不是卖 SaaS，而是卖结果与信任；
Community 展示生态与能力，Enterprise 完成转化，愿景作为上层叙事即可。
