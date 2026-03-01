# Crewly OKR v2 — 以客户获取为中心的战略重构

> **Status:** PROPOSAL — 待 CEO 审核
> **Author:** Ethan (Strategist, crewly-strategist-ethan)
> **Date:** 2026-02-28
> **基于:** CEO 战略指示 + crewly-strategy-v1.md + Q1 执行计划 + W9 周报 + 竞品矩阵 v3.2
> **核心转变:** 从「先做产品再找客户」→「边找客户边迭代产品」

---

## 一、战略转型说明

### CEO 原话

> 在不被外部环境影响（譬如竞争者变多）下，按照自己的节奏去找到能付费的客户，然后再根据客户的需求来推进内部系统的迭代进化。内容可以保持日更的节奏就好。

### 为什么要转

当前 OKR（goals.md + q1-execution-plan.md）的核心逻辑是：

```
Phase 1: 调研 + 研发（Mia + Sam）
    ↓ 触发条件：3+ 功能 + demo flow + Steve 确认
Phase 2: 推广（+Marketing）
    ↓ 触发条件：首次发布 + 有用户
Phase 3: 运营 + 支持（+Community/Ops）
```

**问题在于：** 这是一个串行的"产品→市场"路径。按照 W9 进度，Phase 1→2 触发条件仍未满足（Ops 角色未建、demo 未录、Steve 未确认）。如果继续按此路径，客户获取可能延迟到 Q2 中后期。

**新逻辑应该是：**

```
客户获取（Grace + Steve）────→ 客户需求 ────→ 产品迭代（Sam）
       ↑                                          ↓
内容日更（Luna）←──────── 案例 + 学习 ←─────── 交付成果（Mia）
```

产品迭代不再是线性的"先做完再推"，而是被客户需求驱动的持续循环。

### 三个核心原则

| 原则 | 含义 | 落地方式 |
|------|------|---------|
| **客户优先** Customer First | 先找到愿意付费的客户，再根据他们的真实需求迭代产品 | Grace 和 Steve 并行获客；Sam 的开发优先级由客户需求决定 |
| **自主节奏** Own Pace | 不被 CrewAI/n8n/LangGraph 的动态影响决策 | 停止竞品追赶式开发；聚焦 Crewly 独有定位 |
| **内容日更** Daily Content | 稳定输出，服务获客，不求爆发 | Luna 每日 1 条内容，围绕客户痛点和案例 |

---

## 二、四个关键问题

### Q1: Crewly 的目标客户画像是什么？

**一句话：** 有 5-50 人团队、大量重复性运营工作、没有技术团队但愿意为效率买单的 SMB。

| 维度 | 描述 |
|------|------|
| **行业** | P0: 教育机构（SteamFun 验证）、内容服务商（MCN/Agency）<br>P1: 电商运营、专业服务（法律/会计/咨询）<br>P2: 本地服务业（餐饮连锁、健身房、诊所） |
| **规模** | 5-50 人团队，年营收 $500K-$5M |
| **共同痛点** | 1) 运营靠人力堆，人效低<br>2) 想用 AI 但没有技术团队<br>3) 买了 SaaS 工具但各工具之间数据不通<br>4) 老板/创始人时间被运营细节占满 |
| **决策者** | 创始人 / COO / 运营负责人（能直接拍板） |
| **预算特征** | 愿意为"省人力"付费，月预算 $500-$3,000 |
| **非目标客户** | 大企业（决策链太长）、纯技术团队（会自己搭）、个人用户（付费意愿低） |

**为什么 P0 是教育和内容：**
- 教育：SteamFun 已验证场景，复制成本低
- 内容服务商：天然需要多角色协作（写手→编辑→设计→发布），AI Team 概念最容易被理解

### Q2: 定价策略建议

**建议采用：项目制 Setup + 月费 Retainer 双层模型**

| 层级 | 定价 | 包含内容 | 对标 |
|------|------|---------|------|
| **Discovery Call** | 免费 | 30 分钟需求诊断，判断是否适合 | 行业标准 |
| **Pilot Project** | $1,000-$3,000 一次性 | 2-4 周：需求分析 + 定制 AI Team + 部署 + 1 周调优 | 低于咨询公司日费率 |
| **Monthly Retainer** | $500-$1,500/月 | 持续运维 + 优化 + 新 workflow 开发 + 优先支持 | Relevance AI Team 级 $234/mo，但 Crewly 包含人工服务 |
| **One-Click Install**（未来） | $99-$299/月 SaaS | 自助安装 + BYOM + 模板 + 社区支持 | CrewAI $25/mo，但 Crewly 目标不同 |

**定价逻辑：**
1. 对 SMB 来说，$1K-$3K 的 Pilot 相当于雇一个月实习生的成本，ROI 非常容易算
2. $500-$1.5K/月的 Retainer 远低于雇一个全职运营（$3-5K/月）
3. 先用 Pilot 验证价值，再转 Retainer——降低客户决策门槛
4. "One-Click Install" 作为 Q3 目标，当前不急

**竞品定价参考（Feb 2026）：**

| 竞品 | 定价模式 | 价格区间 |
|------|---------|---------|
| CrewAI Enterprise | 按执行次数 | $0-$1,000+/月 |
| n8n Cloud | 按执行次数 | $24-$800/月 |
| Relevance AI | 按 seat | $0-$234+/月 |
| LangGraph Platform | 按 seat | $0-$39+/月 |
| **Crewly（服务型）** | **项目 + 月费** | **Pilot $1-3K + $500-1.5K/月** |

**关键差异：** 竞品卖的是 Tool（客户自己用），Crewly 卖的是 Result（帮客户做到）。这意味着 Crewly 可以收更高的价格，因为客户不需要技术能力。

### Q3: 从 SteamFun 看 Crewly 的核心价值主张

**SteamFun 案例分析（基于 Mia 的需求调研 + Nick 的原型进展）：**

| 维度 | SteamFun 的情况 | 可提炼的通用价值 |
|------|---------------|----------------|
| 痛点 | 100+ 学生数据管理、家长沟通、排课、教学记录——全靠人工 | SMB 的运营痛点是"重复性高、跨系统、耗人力" |
| 方案 | 5 个 AI Agent 分工协作（运营、内容、家长沟通、质检、数据） | Crewly = "给你的公司配一个 AI 运营团队" |
| 技术栈 | Google Workspace 原生 + Apps Script + Crewly | 不需要迁移现有工具，AI 团队直接嫁接 |
| 交付形式 | 定制化部署 + 持续优化 | 服务型交付，不是丢一个软件让客户自己折腾 |

**提炼的核心价值主张：**

> **"不用换工具，不用懂技术，直接拥有一个 AI 运营团队。"**
>
> Crewly 不是另一个 SaaS 工具。
> 我们为你的业务量身定制一支 AI 团队，
> 它们用你现有的工具（Google Workspace、Slack、Excel）干活，
> 你只需要看结果。

**英文版 Value Proposition:**
> "Your own AI operations team — no new tools, no tech skills needed."

### Q4: 第一批 10 个付费客户从哪里来？

**渠道策略：三管齐下，预计 Q2 结束前达成**

| 渠道 | 目标数量 | 策略 | 负责人 |
|------|---------|------|--------|
| **Steve 温暖人脉** Warm Network | 3-4 个 | Steve 身边的创业者朋友、教育行业联系人、前同事。直接介绍 Discovery Call | Steve + Grace |
| **SteamFun 案例裂变** Referral | 2-3 个 | SteamFun 上线后产出案例 → Nick/SteamFun 团队引荐教育圈同行 | Grace + Nick |
| **内容获客** Inbound | 2-3 个 | Luna 日更内容（X/LinkedIn/小红书）→ 吸引 SMB 主动咨询 → Grace 跟进 | Luna + Grace |
| **Cold Outreach** | 1-2 个 | Grace 在 LinkedIn/教育社群定向 cold DM 教育机构和内容 Agency 负责人 | Grace |

**转化漏斗预估：**

```
内容曝光（1000+/周）→ 官网访问（50+/周）→ Book a Call（5+/月）→ Discovery Call（3+/月）→ Pilot 签约（1-2/月）
Steve 人脉（20 人）→ 介绍（10 人）→ 有兴趣（5 人）→ Discovery Call（3-4 人）→ Pilot（2-3 人）
SteamFun 裂变 → 教育圈引荐（5-8 人）→ Discovery Call（3-4 人）→ Pilot（2 人）
Cold Outreach（50 人/月）→ 回复（10 人）→ Discovery Call（3-4 人）→ Pilot（1 人）
```

**时间线：**
- W10-W13（Q1 剩余）：种子客户 1-3 个（主要来自 Steve 人脉 + SteamFun 引荐）
- Q2 April-June：累计 7-10 个（内容漏斗开始贡献 + Cold Outreach）

---

## 三、新 OKR 框架

### 总览

```
O1: 获得前 10 个付费客户（Revenue Engine）          ← 最高优先级
O2: 建立客户驱动的产品迭代循环（Product Flywheel）   ← 服务 O1
O3: 建立稳定的内容日更引擎（Content Engine）        ← 服务 O1
```

**注意：** 旧 OKR 的 KR1-KR3（Orchestrator、Memory、Self-evolution）已完成 80-95%，不再设为独立 Objective。它们的剩余工作（polish + 可视化）归入 O2 "按需迭代"。

---

### O1: 获得前 10 个付费客户

**Owner:** Grace (Sales/BD Lead) + Steve (Founder Network)
**时间线:** Q1 剩余 + Q2（Feb 28 - June 30）
**成功定义:** 10 个客户签约 Pilot 或 Retainer，累计合同金额 $15K+

| KR | 描述 | 负责人 | 时间线 | 成功标准 | 衡量方式 |
|----|------|--------|--------|---------|---------|
| **KR1.1** | 完成 SteamFun Pilot 交付并转为月付客户 | Mia + Sam + Nick | Q1 W10-W13 | SteamFun AI Team 连续运行 5 天 + 签 Retainer | 运行日志 + 合同 |
| **KR1.2** | 搭建完整的 Sales Pipeline（CRM + Discovery Call 流程 + 报价模板） | Grace | Q1 W10-W11 | Pipeline 工具上线 + 3 个 Discovery Call 模板 | CRM 记录 |
| **KR1.3** | 激活 Steve 人脉网络，完成 10 次 warm intro | Steve + Grace | Q1 W10 - Q2 W15 | 10 次引荐 → 5 次 Discovery Call → 2-3 个 Pilot | CRM 转化率 |
| **KR1.4** | 签约 3 个种子客户（含 SteamFun） | Grace + Steve | Q1 W13 前 | 3 个签约（Pilot 或 Retainer） | 合同 |
| **KR1.5** | Q2 累计签约 10 个客户 | Grace + 全团队 | Q2 W26 前 | 10 个签约，$15K+ 累计合同金额 | 财务记录 |
| **KR1.6** | 建立标准化 Pilot 交付流程（从 Discovery → Deploy → Retainer） | Mia + Grace | Q2 W16 前 | 流程文档 + 第 2-3 个客户复用该流程 | 交付时间缩短 30% |

**关键活动（Q1 剩余 4 周）：**

| 周 | Grace | Steve | Mia | Sam |
|----|-------|-------|-----|-----|
| W10 | 搭建 CRM + Pipeline；撰写 Cold DM 模板 | 列出 20 个可引荐人脉 | SteamFun 交付推进 | SteamFun 技术支持 |
| W11 | 启动 Cold Outreach（教育 + 内容 Agency）；跟进 Steve intro | 开始引荐 warm intro（每周 3-5 个） | SteamFun 部署测试 | SteamFun 部署 + 修 bug |
| W12 | 跟进 Pipeline；安排 Discovery Call | 持续引荐 | SteamFun 客户成功跟踪 | 客户反馈驱动的修复 |
| W13 | 力争关闭 2-3 个种子客户 | 参加关键 Discovery Call | 产出 SteamFun 案例初稿 | 产品按客户反馈迭代 |

---

### O2: 建立客户驱动的产品迭代循环

**Owner:** Sam (Engineer) + Mia (PM)
**时间线:** 持续（Q1 W10 开始）
**成功定义:** 每个产品迭代决策都有明确的客户需求来源

| KR | 描述 | 负责人 | 时间线 | 成功标准 | 衡量方式 |
|----|------|--------|--------|---------|---------|
| **KR2.1** | 建立客户反馈 → 产品需求的闭环机制 | Mia | Q1 W10-W11 | 反馈收集模板 + 需求优先级排序系统上线 | 文档 + 工具 |
| **KR2.2** | SteamFun 交付中提炼可复用的 Team Template 系统 | Sam + Mia | Q1 W11-W13 | 至少 1 个可复用模板（教育运营） | 模板可被第 2 个客户使用 |
| **KR2.3** | 完成 /enterprise 和 /case 页面上线（业务转化层） | Sam | Q1 W10-W11 | crewlyai.com/enterprise 可访问 + Book a Call 功能可用 | 页面上线 + Calendly 接入 |
| **KR2.4** | 每 2 周一次产品迭代，优先级由客户需求决定（非竞品追赶） | Sam + Mia | Q2 持续 | 每次迭代有对应的客户需求编号 | Changelog + 需求映射 |
| **KR2.5** | 旧 KR 收尾：Ops 角色 + Core Team 模板 + 3-agent demo | Sam | Q1 W10-W12 | 可展示的 3-agent demo flow | Demo 可录制 |

**产品迭代优先级原则（新规则）：**

```
P0: 客户在用的功能出了 Bug（当天修）
P1: 当前客户的新需求（本 Sprint 内）
P2: 下一个目标客户行业需要的功能
P3: 技术债 + 系统稳定性
P4: 竞品有但客户没要求的功能（默认不做）
```

**注意：** 旧 OKR 中的 G1-G15 差距清单（competitive-gap-matrix.md）不再作为开发优先级输入。只有当客户明确需要某功能时，才从差距清单中提取。例如：如果客户不需要 Vector-based Memory（G3），就不做。

---

### O3: 建立稳定的内容日更引擎

**Owner:** Luna (Content Strategy) + Steve (Founder Story)
**时间线:** Q1 W10 开始，持续
**成功定义:** 日更节奏稳定运行 8 周 + 内容直接带来 Discovery Call

| KR | 描述 | 负责人 | 时间线 | 成功标准 | 衡量方式 |
|----|------|--------|--------|---------|---------|
| **KR3.1** | 建立内容日更 SOP（选题 → 撰写 → 发布 → 数据复盘） | Luna | Q1 W10 | SOP 文档完成 + 第一周执行 7 条内容 | 发布记录 |
| **KR3.2** | 内容主题围绕客户痛点（不是技术展示） | Luna + Grace | 持续 | 80% 的内容回答目标客户的具体问题 | 内容审计 |
| **KR3.3** | 每周至少 1 条内容带 CTA（引导到 Book a Call 或 /enterprise） | Luna | 持续 | 每周有可追踪的 CTA 内容 | 链接点击数据 |
| **KR3.4** | SteamFun 案例包产出（case study + 短视频 + social posts 5 条） | Luna + Mia | Q1 W12-W13 | 完整案例包发布 | 发布记录 |
| **KR3.5** | 8 周日更不断更（允许轻量内容，不允许停更） | Luna | Q1 W10 - Q2 W18 | 连续 56 天有内容发布（含周末轻量内容） | 发布日历 |
| **KR3.6** | 内容引流 → 每月 5+ Book a Call | Luna + Grace | Q2 W18 前 | 可追踪到内容来源的 Discovery Call ≥ 5/月 | UTM 追踪 + CRM |

**内容策略（日更节奏）：**

| 类型 | 频率 | 平台 | 目的 | 负责人 |
|------|------|------|------|--------|
| **SMB 痛点短贴** "你还在手动发家长通知？" | 每日 1 条 | X / 小红书 / LinkedIn | 引起共鸣 → 关注 | Luna |
| **Steve 的一人公司日记** "今天我的 AI 团队做了什么" | 每周 2-3 条 | X / LinkedIn / YouTube Shorts | 个人品牌 → 信任 | Steve + Luna |
| **客户案例深度** "SteamFun 如何用 AI 团队管理 100 个学生" | 每月 1 篇 | Blog / LinkedIn | 转化 → Book a Call | Luna + Mia |
| **教程/How-to** "如何给你的公司搭一个 AI 运营助手" | 每周 1 篇 | Blog / YouTube | SEO + 长尾流量 | Luna |
| **行业观察** "AI Agent 在教育/电商/内容行业的应用" | 每周 1 篇 | LinkedIn / 小红书 | 思想领导力 | Ethan + Luna |

**内容合规（Steve 特别指示）：**
- Steve 个人账号内容角度 = "one-person company amplification"，避免与 Google 利益冲突
- Crewly 官方账号无限制
- 内容服务于获客，不是为了刷存在感

---

## 四、Q1 剩余计划（W10-W13，Mar 3 - Mar 28）

### 团队焦点

| 成员 | 旧 OKR 焦点 | **新 OKR 焦点** | 变化 |
|------|------------|----------------|------|
| **Grace** | 不在旧 OKR 中 | **O1 主力：Sales Pipeline + Outreach + Discovery Call** | 从 0 → 核心角色 |
| **Steve** | 决策者（5h/周） | **O1 支持：人脉引荐 + 关键 Call 参与** | 从被动审批 → 主动获客 |
| **Mia** | PM（产品规划 + STEAM Fun 需求） | **O1+O2：STEAM Fun 交付 + 客户成功 + 反馈闭环** | 焦点从规划 → 交付 |
| **Sam** | 全栈开发（KR1-4 全线） | **O2：STEAM Fun 技术 + /enterprise 页面 + 客户驱动修复** | 从竞品追赶 → 客户需求 |
| **Luna** | 内容策略（规划中，0/10 发布） | **O3 主力：日更内容 + 案例包 + 获客支撑** | 从规划 → 立即执行 |
| **Ethan** | 战略分析 | **O1 支持：ICP 研究 + 行业观察内容 + 定价策略** | 从战略报告 → 获客支撑 |
| **Nick** | SteamFun 原型 | **O1：SteamFun 交付 + 教育圈引荐** | 不变，增加引荐职责 |

### 每周计划

#### W10（Mar 3-7）— "Engine Setup"

| 负责人 | 任务 | 对应 KR | 产出 |
|--------|------|---------|------|
| Grace | 搭建 Sales Pipeline（Notion/HubSpot Free）；写 3 套 Cold DM 模板（教育、内容 Agency、电商）；创建 Discovery Call 脚本 | KR1.2 | CRM + 模板文档 |
| Steve | 列出 20 个可引荐的人脉名单（按行业标注） | KR1.3 | 人脉清单 |
| Sam | /enterprise + /case 页面开发（基于 v2-minimal 方案）；Book a Call 接入 | KR2.3 | 页面上线 |
| Sam | 创建 Ops role + Core Team template（旧 KR1.1-1.3） | KR2.5 | 角色 + 模板 |
| Mia | SteamFun 交付推进：协调 Nick 原型 + 定义部署计划 | KR1.1 | 部署计划文档 |
| Luna | 建立日更 SOP + 开始执行：第一周 7 条内容 | KR3.1 | 7 条内容发布 |
| Ethan | 完成 3 个行业 ICP 深度画像（教育、内容 Agency、电商）供 Grace 使用 | KR1.2 支撑 | ICP 文档 |

#### W11（Mar 10-14）— "First Outreach"

| 负责人 | 任务 | 对应 KR | 产出 |
|--------|------|---------|------|
| Grace | 启动 Cold Outreach：每天 5-10 个 LinkedIn DM（教育 + 内容行业）；跟进 Steve 引荐 | KR1.3, KR1.4 | 50+ Outreach + 跟进记录 |
| Steve | 开始引荐 warm intro（本周 5 个） | KR1.3 | 5 个引荐 |
| Sam | SteamFun 技术部署 + 测试 | KR1.1 | 部署完成 |
| Sam | 根据 SteamFun 部署反馈修 Bug | KR2.4 | Bug 修复 |
| Mia | SteamFun 部署现场支持 + 用户培训 | KR1.1 | 培训完成 |
| Luna | 日更继续（7 条）+ 准备 SteamFun 案例素材收集 | KR3.2, KR3.4 | 内容 + 素材 |

#### W12（Mar 17-21）— "First Calls"

| 负责人 | 任务 | 对应 KR | 产出 |
|--------|------|---------|------|
| Grace | 安排并执行 3-5 个 Discovery Call；跟进 Pipeline | KR1.4 | Call 记录 + 跟进 |
| Steve | 参加 1-2 个关键 Discovery Call；继续引荐 | KR1.3 | 引荐 + Call |
| Sam | 客户反馈驱动的产品修复 + SteamFun 调优 | KR2.4 | 修复记录 |
| Mia | SteamFun 客户成功跟踪（运行数据收集）；反馈 → 需求映射 | KR1.1, KR2.1 | 运行报告 |
| Luna | 日更继续 + SteamFun 案例包初稿（case study + 3 条 social posts） | KR3.4 | 案例包初稿 |

#### W13（Mar 24-28）— "First Closes"

| 负责人 | 任务 | 对应 KR | 产出 |
|--------|------|---------|------|
| Grace | 跟进 Pipeline 中的热线索；力争关闭 2-3 个种子客户 Pilot | KR1.4 | 2-3 个签约 |
| Steve | 支持关键签约对话 | KR1.4 | 签约支持 |
| Sam | 第 2 个客户的 Pilot 需求评估 + 可复用模板提取 | KR2.2 | 模板 v1 |
| Mia | SteamFun 案例完稿；标准化 Pilot 交付流程初稿 | KR1.6, KR3.4 | 案例 + 流程文档 |
| Luna | 日更继续 + 发布 SteamFun 案例（Blog + LinkedIn + 小红书） | KR3.4 | 案例发布 |

---

## 五、Q2 展望（Apr - Jun 2026）

### Q2 目标：从 3 → 10 客户，建立可重复的销售和交付引擎

| 阶段 | 时间 | 焦点 | 目标 |
|------|------|------|------|
| **Q2 前半** W14-W19 | Apr 1 - May 9 | 复制 SteamFun 模式到 2-3 个新行业 | 累计 5-6 个客户 |
| **Q2 后半** W20-W26 | May 12 - Jun 27 | 规模化：内容漏斗开始贡献 + 流程自动化 | 累计 10 个客户 |

### Q2 关键 Milestones

| Milestone | 时间 | 描述 |
|-----------|------|------|
| **M1: SteamFun Retainer** | W14 | SteamFun 从 Pilot 转为月付 Retainer |
| **M2: 第二行业模板** | W16 | 第二个行业（内容 Agency 或电商）的 Team Template 完成 |
| **M3: 5 个客户** | W19 | 累计 5 个付费客户（Pilot 或 Retainer） |
| **M4: 内容漏斗 validated** | W20 | 至少 2 个客户可追踪到内容引流来源 |
| **M5: 10 个客户** | W26 | 达成 10 个付费客户目标 |
| **M6: Pilot 流程标准化** | W18 | 从 Discovery Call 到 Deploy 的标准流程文档化 + 模板化 |

### Q2 财务预估

```
假设：
- 10 个客户，平均 Pilot $2,000 + 平均 Retainer $750/月
- SteamFun 转 Retainer 从 W14 开始
- 其他客户陆续签约

Q2 预估收入：
  Pilot 收入：7 × $2,000 = $14,000（7 个新 Pilot，SteamFun + W13 的 2 个已计入 Q1）
  Retainer 收入：逐步累积
    W14-W17: 1 客户 × $750 = $3,000
    W18-W21: 3 客户 × $750 = $9,000
    W22-W26: 5 客户 × $750 = $9,375
  Q2 Retainer 合计: ~$21,375

Q2 总收入预估: ~$35,000
月度 Run Rate (Q2 末): ~$7,500/月 (= $90K ARR)
```

**距离 12-Month $1M ARR 目标：** Q2 末 $90K ARR，需要 Q3-Q4 10 倍增长。这意味着 Q3 必须从服务型转向半自助模式（One-Click Install），否则单靠服务无法 scale。

---

## 六、Crewly 差异化定位（自主节奏原则）

### 停止做什么

| 停止 | 原因 |
|------|------|
| 追赶 CrewAI/LangGraph 的功能清单 | 他们卖 Tool 给开发者，我们卖 Result 给 SMB |
| 把 GitHub stars 当北极星指标 | 我们的客户不看 GitHub |
| 在产品没人用的情况下做 Vector Memory、MCP 协议完善等技术债 | 客户没要求就不做 |
| Phase 1→2→3 串行思维 | 获客和产品应该并行 |

### 继续做什么

| 继续 | 原因 |
|------|------|
| Live terminal streaming + Team Dashboard | 这是 Crewly 独有的 moat，没有竞品有 |
| Runtime-agnostic（Claude/Gemini/Codex） | 不锁定模型 = 客户安心 |
| PTY session isolation | 安全性差异化（OpenClaw 和 n8n 都出了安全事故） |
| 服务型交付 | 竞品无法复制"帮你做"的模式 |

### Crewly 的本质定位

```
竞品定位：                    Crewly 定位：
"AI Agent Framework"    →    "AI Team as a Service"
卖工具给开发者           →    卖结果给 SMB
客户自己搭建             →    我们帮你搭 + 运维
按执行次数收费           →    按交付成果收费
```

**一句话定位（对外）：**
> "我们帮中小企业搭建和运营定制化的 AI 运营团队——不用换工具，不用懂技术，直接看结果。"

---

## 七、团队架构与职责矩阵

### 角色优先级调整

```
旧 OKR 优先级：
  Sam (开发) >>>>>>> Mia (PM) >> Luna (内容) >> 其他

新 OKR 优先级：
  Grace (Sales)  =  Luna (内容)  =  Sam (开发)  =  Mia (交付)
          ↑                 ↑              ↑             ↑
      客户获取          获客引擎       客户需求驱动     客户成功
```

### RACI 矩阵

| 活动 | Grace | Steve | Mia | Sam | Luna | Ethan | Nick |
|------|-------|-------|-----|-----|------|-------|------|
| 客户开发 & Outreach | **R** | **A** | I | I | C | C | C |
| Discovery Call | **R** | **A**/R | C | I | I | C | I |
| Pilot 需求分析 | C | A | **R** | C | I | I | C |
| Pilot 技术交付 | I | A | **R** | **R** | I | I | C |
| 客户成功 & 反馈 | C | I | **R** | C | I | I | I |
| 产品迭代开发 | I | A | C | **R** | I | I | I |
| 日更内容生产 | I | C | C | I | **R** | C | I |
| 案例包产出 | I | A | **R** | I | **R** | I | C |
| 行业研究 & ICP | C | I | C | I | I | **R** | I |
| SteamFun 交付 | I | A | **R** | **R** | I | I | **R** |

*R=Responsible, A=Accountable, C=Consulted, I=Informed*

---

## 八、核心指标与追踪

### 北极星指标（变更）

```
旧：Active AI Teams running weekly
新：Monthly Recurring Revenue (MRR) from paying customers
```

### 每周追踪仪表盘

| 指标 | 来源 | 目标（Q1 末） | 目标（Q2 末） |
|------|------|-------------|-------------|
| **付费客户数** | CRM | 3 | 10 |
| **MRR** | 财务 | $1,500 | $7,500 |
| **Pipeline 中 Discovery Call 数** | CRM | 5+/月 | 15+/月 |
| **内容发布数** | 发布日历 | 28 条（日更 4 周） | 90 条（日更 13 周） |
| **内容引流 Book a Call** | UTM + CRM | 1 | 5+/月 |
| **SteamFun 运行天数** | 运行日志 | 5+ 连续天 | 持续 |
| **Pilot 平均交付周期** | 项目记录 | -- | ≤ 3 周 |

### 旧指标处置

| 旧指标 | 处理方式 |
|--------|---------|
| GitHub stars（61） | 降级为观察指标，不作为目标 |
| npm weekly downloads | 降级为观察指标 |
| Discord members | 暂缓，社区建设在有 10+ 客户后再启动 |
| Time-to-first-team | 保留但优先级降低 |

---

## 九、风险与应对

| 风险 | 可能性 | 影响 | 应对 |
|------|--------|------|------|
| **Grace 尚未到位或经验不足** | 中 | 高 — O1 依赖 Grace 执行 | Steve 前 4 周亲自带队获客；明确 Grace 的 Week 1 培训计划 |
| **SteamFun 交付延迟**（Nick 原型 Bug） | 高 | 中 — 影响第一个案例 | 缩小 MVP 范围：先交付最核心的 1-2 个 workflow，后续迭代 |
| **内容日更断更** | 中 | 中 — 影响长期获客漏斗 | 建立 7 天内容缓冲池；允许周末发轻量内容（转发/金句） |
| **客户获取速度不达预期** | 中 | 高 — 影响整体目标 | 第一个月专注 warm leads；如 W12 仍无 Pipeline，调整为更激进的 Cold Outreach |
| **Sam 带宽不足**（唯一开发） | 高 | 高 — 同时支持 SteamFun + 新客户 + /enterprise 页面 | W10 优先 /enterprise 页面（1 天搞定）；SteamFun 复用现有功能，减少新开发 |
| **定价过高/过低** | 中 | 中 | 前 3 个客户作为定价实验；根据成交率和客户反馈调整 |

---

## 十、与旧 OKR 的映射关系

| 旧 KR | 状态 | 在新 OKR 中的位置 |
|--------|------|------------------|
| KR1: Orchestrator + 3 Agents (82%) | 收尾 | → KR2.5（旧 KR 收尾） |
| KR2: Memory + Logging (95%) | 基本完成 | → 不设独立 KR，按客户需求迭代 |
| KR3: Self-evolution loop (92%) | 基本完成 | → 不设独立 KR，按客户需求迭代 |
| KR4: STEAM Fun B2B (15%) | 最高优先级 | → KR1.1（升级为 O1 第一个 KR） |
| KR5: 10 showcase content (40%) | 重新定义 | → O3 全部（从"showcase"转为"获客引擎"） |

---

## 十一、行动召唤（给 CEO 的建议）

### 本提案需要 CEO 确认的决策点

| # | 决策 | 选项 | 建议 |
|---|------|------|------|
| 1 | **Grace 角色确认** | A) 已有人选，立即到岗<br>B) 需要招聘<br>C) Steve 暂时兼任 | 建议 A 或 C，获客不能等 |
| 2 | **SteamFun Pilot 定价** | A) 免费（纯案例价值）<br>B) 优惠价 $500-$1,000<br>C) 正常价 $1,500-$3,000 | 建议 B（象征性收费验证付费意愿） |
| 3 | **Steve 投入时间** | A) 维持 5h/周<br>B) 增加到 10h/周（前 4 周获客冲刺） | 建议 B（前期 Steve 人脉是最快路径） |
| 4 | **北极星指标变更** | A) 维持 "Active AI Teams running weekly"<br>B) 改为 MRR | 建议 B（新 OKR 的核心是收入验证） |
| 5 | **竞品追赶策略** | A) 继续关注并对标<br>B) 仅按客户需求决定开发内容 | 建议 B（原则 2：自主节奏） |
| 6 | **社区建设（Discord）** | A) 立即启动<br>B) 10 个客户后再启动 | 建议 B（当前精力全放获客） |

---

## 附录

### A. 竞品定价详情（Feb 2026）

| 竞品 | 免费层 | 付费起步 | 企业级 | 模式 |
|------|--------|---------|--------|------|
| CrewAI | 50 exec/月 | $25/月（100 exec） | 自定义（30K exec, SOC2, HIPAA） | 按执行次数 |
| n8n | 自托管免费 | €24/月（2.5K exec） | €800/月（100K exec） | 按执行次数 |
| Relevance AI | 免费 100 runs | $234/月 Team | 自定义 | 按 seat |
| LangGraph Platform | 免费 100K nodes 自托管 | $39/seat/月 | 自定义 | 按 seat |
| **Crewly** | **开源免费** | **Pilot $1-3K 一次性** | **Retainer $500-1.5K/月** | **项目+月费** |

### B. ICP 行业画像概要

**P0: 教育机构**
- 典型客户：5-20 人 STEM/艺术培训机构
- 核心痛点：学生管理、家长沟通、排课、教学记录
- 预算：$500-$1,500/月
- 获客路径：SteamFun 案例裂变 + 教育社群
- 已验证：SteamFun（进行中）

**P0: 内容服务商（MCN/Agency）**
- 典型客户：5-30 人内容制作团队
- 核心痛点：选题→写作→编辑→发布流程低效；多平台分发耗时；数据回收分散
- 预算：$1,000-$3,000/月
- 获客路径：Steve 内容矩阵吸引 + LinkedIn DM
- 待验证：需要第 2 个 Pilot

**P1: 电商运营**
- 典型客户：10-50 人电商团队
- 核心痛点：客服、库存更新、订单处理、多平台商品管理
- 预算：$500-$2,000/月
- 获客路径：Cold Outreach + 内容引流
- 待验证

### C. Discovery Call 脚本框架（供 Grace 使用）

```
1. 开场（2 分钟）
   - 自我介绍 + Crewly 一句话说明
   - 确认对方角色和决策权

2. 需求诊断（15 分钟）
   - "你们团队目前最耗时间的 3 个运营流程是什么？"
   - "这些流程现在是谁在做？大概每周花多少小时？"
   - "你们试过哪些自动化工具？遇到什么问题？"
   - "如果这些流程能自动化，你觉得最大的价值是什么？"

3. 方案概述（8 分钟）
   - 根据对方痛点，描述可能的 AI Team 配置
   - 展示 SteamFun 案例（如果相关）
   - 说明 Pilot 模式：2-4 周，$X，验证价值后再决定

4. 下一步（5 分钟）
   - "如果我们下周发一个详细的 Pilot 方案给你，你觉得可以吗？"
   - 确认联系方式和决策时间线
```

---

*文档作者：Ethan (Strategist) | 2026-02-28*
*基于：CEO 战略指示、crewly-strategy-v1.md、q1-execution-plan.md、weekly-update-w9、competitive-gap-matrix v3.2、recall 项目知识*
*下一步：CEO 审核 → 确认 6 个决策点 → 团队对齐会 → 执行*
