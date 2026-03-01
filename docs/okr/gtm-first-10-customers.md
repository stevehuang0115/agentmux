# GTM 策略细化 — 前 10 个付费客户获取路径

> **Status:** PROPOSAL — 配合 OKR v2 提案
> **Author:** Ethan (Strategist, crewly-strategist-ethan)
> **Date:** 2026-02-28
> **基于:** OKR v2 提案 + 竞品定价研究 + B2B outreach 最佳实践 + 行业数据
> **目标:** Q1 末（Mar 28）签约 3 个种子客户 → Q2 末（Jun 27）累计 10 个

---

## 一、竞品定价深度分析

### 1.1 全景定价对比

| 竞品 | 免费层 | 入门付费 | 中级 | 高级 | 企业级 | 定价模式 |
|------|--------|---------|------|------|--------|---------|
| **CrewAI** | 50 exec/月, 1 crew | $99/月 (100 exec, 2 crews, 5 seats) | $500/月 (1K exec, 2h onboarding) | $1,000/月 (2K exec, 5 crews, 4h onboarding) | Custom (10K exec, 10 crews, 10h onboarding) | 按执行次数 |
| **n8n Cloud** | 自托管免费 | €24/月 (2.5K exec) | €60/月 (10K exec) | €800/月 (40K exec, SSO) | Custom (~$1-2K+/月, unlimited) | 按执行次数 |
| **Relevance AI** | 200 actions/月, 1 build user | $234/月 (84K actions/年, 5 build + 45 end users) | -- | -- | Custom (unlimited) | 按 action + seats |
| **LangSmith/LangGraph** | 5K traces/月, 1 seat | $39/seat/月 (10K traces, 500 agent runs) | -- | -- | Custom (VPC/self-host, SLA) | 按 seat + traces |
| **Crewly（拟定）** | 开源免费 | Pilot $1-3K 一次性 | Retainer $500-1.5K/月 | -- | Custom | 项目制 + 月费 |

> **数据来源：** [CrewAI Pricing](https://www.crewai.com/pricing)、[n8n Pricing](https://n8n.io/pricing/)、[Relevance AI Pricing](https://relevanceai.com/pricing)、[LangSmith Pricing](https://www.langchain.com/pricing)

### 1.2 竞品定价的隐藏成本

竞品的标价看起来便宜（$25-$234/月），但 SMB 客户的**实际总拥有成本（TCO）**远高于此：

| 隐藏成本项 | 估算 | 说明 |
|-----------|------|------|
| **LLM API 费用** | $100-$2,000/月 | 所有竞品都是 BYOM（自带模型），API 费用另计 |
| **技术人才成本** | $3,000-$8,000/月 | SMB 需要雇开发者或外包来配置和维护 agent |
| **学习曲线** | 2-8 周 | CrewAI/LangGraph 需要 Python 技能，n8n 需要 workflow 设计经验 |
| **集成和调试** | $2,000-$10,000 一次性 | 接入现有系统（CRM、ERP、邮件等）的开发工作 |
| **持续运维** | $500-$2,000/月 | prompt 优化、错误处理、监控、更新 |

**SMB 使用竞品的真实月度成本：**
```
竞品平台费:           $25 - $1,000/月
+ LLM API:           $100 - $2,000/月
+ 技术人才（外包）:    $3,000 - $8,000/月
+ 运维:              $500 - $2,000/月
= 实际总成本:        $3,625 - $13,000/月
```

### 1.3 Crewly 差异化定价的逻辑

**Crewly 不是在同一个维度上竞争。**

```
竞品卖的是:                    Crewly 卖的是:
─────────────────              ─────────────────
平台访问权 (Tool)          →   交付成果 (Result)
客户自己配置                →   Crewly 团队帮你做
按执行次数收费              →   按项目 + 月费
需要技术团队使用            →   不需要技术能力
客户承担 LLM 费用           →   包含在服务费中
客户自己调试优化            →   Crewly 持续优化
```

**定价对比（对 SMB 的实际成本）：**

| 方案 | 月度成本 | 谁来做 | 上线时间 | 技术要求 |
|------|---------|--------|---------|---------|
| 用 CrewAI 自己搭 | $3,600-$13,000/月 | 客户自己（需雇技术） | 4-8 周 | Python + API |
| 用 n8n 自己搭 | $2,500-$8,000/月 | 客户自己（需学 workflow） | 2-4 周 | Workflow 设计 |
| 请 AI 咨询公司 | $5,000-$25,000/月 retainer | 外部咨询 | 6-16 周 | 无（但贵） |
| **用 Crewly** | **Pilot $1-3K + $500-1.5K/月** | **Crewly 团队** | **2-4 周** | **无** |

> **行业对标数据：** AI agent 咨询服务市场中，低代码方案 $5K-$15K，定制方案 $25K-$100K+，持续运维 $2K-$10K/月。（来源：[Cleveroad AI Agent Cost Guide](https://www.cleveroad.com/blog/ai-agent-development-cost/)、[ProductCrafters AI Agent Pricing](https://productcrafters.io/blog/how-much-does-it-cost-to-build-an-ai-agent/)）
>
> Crewly 的 Pilot $1-3K 远低于行业均价，是因为 Crewly 拥有自己的框架和模板系统，可以大幅降低交付成本。

### 1.4 建议最终定价（前 10 客户适用）

| 产品 | 价格 | 包含内容 | 备注 |
|------|------|---------|------|
| **Discovery Call** | 免费 | 30 分钟需求诊断 | 所有渠道统一入口 |
| **Pilot Project** | $1,500（种子客户优惠价） | 2 周：需求分析 + AI Team 部署 + 1 个核心 workflow + 1 周调优 | 前 5 个客户可酌情降至 $1,000 |
| **Full Pilot** | $2,500-$3,000（正常价） | 3-4 周：需求分析 + AI Team 部署 + 2-3 个 workflow + 2 周调优 | 第 6-10 个客户 |
| **Monthly Retainer** | $750/月（起） | 持续运维 + 每月 1-2 个新 workflow + 优先支持 + 月度报告 | Pilot 完成后转签 |
| **SteamFun 特别定价** | $500（象征性） | Pilot 作为案例合作，换取案例使用权和推荐 | CEO 需确认 |

**客户的 ROI 论证：**
```
一个 $1,500 Pilot + $750/月 Retainer = 第一年 $10,500
vs.
雇一个运营专员：$3,500-$5,000/月 × 12 = $42,000-$60,000/年
节省: 75-82%

或 vs.
外包 AI 咨询：$15,000-$50,000 一次性 + $3,000-$10,000/月运维
节省: 70-90%
```

---

## 二、渠道 1: Steve 温暖人脉（目标 3-4 个客户）

### 2.1 适合 Crewly 的联系人类型

Steve 的人脉网络中，以下类型最可能成为客户：

| 类型 | 为什么适合 | 典型痛点 | 成交概率 |
|------|-----------|---------|---------|
| **创业者朋友（5-30 人团队）** | 对 AI 感兴趣、愿意尝试新东西、信任 Steve | 运营效率低、想用 AI 但不知道怎么开始 | 高 |
| **教育行业联系人** | SteamFun 同行圈，痛点相同 | 学生管理、家长沟通、排课 | 高 |
| **内容创作者/Agency 负责人** | Steve 在内容领域有人脉 | 多平台发布、素材管理、数据分析 | 中-高 |
| **前同事（tech 背景）** | 理解 AI 价值、可能在管理团队 | 内部工具效率、重复性任务 | 中 |
| **本地商业社群** | 线下关系强、信任度高 | 客户管理、预约、报告 | 中 |

### 2.2 推荐接触方式

**Warm Intro 三步法（Steve 主导）：**

```
Step 1: Steve 私信（WeChat/iMessage/LinkedIn DM）
────────────────────────────────────────────
"Hey [Name]，最近我们 Crewly 在帮中小企业搭 AI 运营团队，
刚帮一个教育机构把学生管理、家长沟通全部自动化了。
你们 [公司名] 的 [具体运营] 应该也能用上，
要不要花 30 分钟聊聊？不 push，纯交流看看。"

时机: 周二-周四上午 10-11 点
回复率预估: 60-70%（warm 关系）
```

```
Step 2: Discovery Call（Grace 主持，Steve 可选参加）
────────────────────────────────────────────
- 用 OKR v2 附录 C 的脚本
- 30 分钟：需求诊断 + 方案概述 + 下一步
- 关键：听比说多，记录具体痛点和数字
```

```
Step 3: Pilot 提案（Mia 出方案，Grace 跟进）
────────────────────────────────────────────
- 48 小时内发送定制 Pilot 提案
- 包含：痛点诊断 + AI Team 设计 + 时间线 + 定价
- 跟进: 3 天后 follow up
```

### 2.3 转化时间线

```
Week 0 (W10):   Steve 列出 20 人名单并分类标注
Week 1 (W10):   Steve 发出前 10 个 intro（每天 2 个）
Week 1-2:       Grace 安排 Discovery Call（预计 5-7 个回复）
Week 2-3:       Grace 发送 Pilot 提案（3-4 个有兴趣）
Week 3-4:       关闭 2-3 个 Pilot
Week 5-8 (Q2):  追加 1-2 个（长决策周期的）

预计转化率: 20 intro → 7 Discovery Call (35%) → 4 Pilot 提案 (57%) → 3 签约 (75%)
```

### 2.4 Steve 人脉的管理

**建议 Steve 按此模板整理名单：**

| 姓名 | 公司 | 行业 | 团队规模 | 关系强度 | 可能痛点 | 优先级 | 状态 |
|------|------|------|---------|---------|---------|--------|------|
| 示例 A | ABC 教育 | 教育 | 15 人 | 强（朋友） | 排课 + 家长沟通 | P0 | 待联系 |
| 示例 B | XYZ Agency | 内容 | 8 人 | 中（前同事） | 多平台发布 | P0 | 待联系 |

---

## 三、渠道 2: SteamFun 裂变（目标 2-3 个客户）

### 3.1 教育行业横向扩展策略

SteamFun 是一个 STEM 教育机构（100+ 学生）。教育行业有大量类似机构：

**可横向扩展的教育细分：**

| 细分 | 典型机构 | 与 SteamFun 痛点重叠度 | 获客难度 |
|------|---------|---------------------|---------|
| **STEM/编程教育** | 其他 STEM 培训机构 | 95%（几乎一样） | 低——SteamFun 同行圈 |
| **艺术/音乐培训** | 钢琴/画画/舞蹈机构 | 80%（排课 + 家长沟通一样） | 低-中 |
| **语言培训** | 英语/中文培训 | 75%（学生管理 + 排课） | 中 |
| **K-12 课后辅导** | 补习机构 | 70% | 中 |
| **幼儿教育** | 日托/早教中心 | 60%（管理更简单） | 中-高 |

### 3.2 SteamFun 案例利用策略

**Phase 1: 案例产出（W12-W13，Luna + Mia 负责）**

| 素材 | 格式 | 用途 | 完成时间 |
|------|------|------|---------|
| Case Study 长文 | Blog/PDF（中英文） | 官网 /case + 发送给潜在客户 | W12 |
| 1 分钟视频 | 短视频（竖版） | 小红书/抖音/LinkedIn | W13 |
| 3 条 Social Posts | 图文 | X/LinkedIn/小红书 | W12 |
| 数据亮点图 | 信息图 | 所有平台通用 | W12 |
| Nick/SteamFun 推荐语 | 文字引用 | 官网 testimonial | W13 |

**Phase 2: 裂变执行（W13-Q2）**

```
路径 A: Nick 直接引荐
──────────────────────
Nick 在教育圈有同行关系 → 请 Nick 引荐 3-5 个类似机构负责人
→ Steve 或 Grace 接手 Discovery Call
→ 用 SteamFun 案例做 proof of concept

预计: 5 引荐 → 3 Discovery Call → 2 签约
```

```
路径 B: 教育社群渗透
──────────────────────
- 找到教育行业微信群/Facebook Group/LinkedIn Group
- Luna 发布 SteamFun 案例内容（以"分享"而非"推销"的方式）
- Grace 跟进评论和私信中的意向

预计: 较慢，Q2 贡献 1-2 个客户
```

```
路径 C: 教育行业活动
──────────────────────
- 关注本地教育行业 meetup / 线上论坛
- Steve 或 Grace 作为 speaker 分享"AI 在教育运营中的应用"
- 会后收集联系方式 → Discovery Call

预计: Q2 贡献 0-1 个客户
```

### 3.3 裂变时间线

```
W12:         SteamFun 案例素材收集（Mia + Luna）
W13:         案例包完成 + 发布
W13:         Nick 开始引荐（目标 3-5 人）
Q2 W14-W16:  Grace 跟进引荐 → Discovery Call
Q2 W16-W19:  关闭 2 个 Pilot
Q2 W20+:     教育社群内容持续发酵

预计转化率: 5 引荐 → 3 Call (60%) → 2 Pilot (67%)
```

---

## 四、渠道 3: 内容引流（目标 2-3 个客户）

### 4.1 最容易吸引潜在客户的内容主题

**核心原则：** 内容不是秀技术，而是回答目标客户的具体问题。

**Top 10 高转化内容主题（按优先级排序）：**

| # | 主题 | 目标读者 | 平台 | 转化逻辑 |
|---|------|---------|------|---------|
| 1 | "我的培训机构用 AI 管理 100 个学生的真实经历" | 教育机构负责人 | 小红书/LinkedIn | SteamFun 案例 → 共鸣 → 咨询 |
| 2 | "中小企业老板每周花 20 小时做重复工作？AI 团队帮你省下来" | SMB 创始人/COO | LinkedIn/X | 痛点直击 → 好奇 → Book a Call |
| 3 | "我雇了 5 个 AI 员工，月薪不到 1000 美元" | 成本敏感的 SMB | X/小红书 | 价格锚定 → 兴趣 → 了解更多 |
| 4 | "你的运营团队还在手动发通知？2026 年了" | 运营负责人 | LinkedIn | 焦虑感 → 解决方案 → CTA |
| 5 | "一个人管理 AI 团队：我的一人公司实验" | 独立创业者/Solopreneur | X/YouTube | Steve 人设 → 关注 → 长期转化 |
| 6 | "内容 Agency 如何用 AI 把产出效率提高 3 倍" | 内容 Agency 负责人 | LinkedIn | 行业场景 → 认同 → 咨询 |
| 7 | "AI 不是要取代你的员工，而是让他们做更重要的事" | 担心 AI 的 SMB 老板 | LinkedIn | 消除恐惧 → 信任 → 尝试 |
| 8 | "从手工 Excel 到自动化报告：一个小公司的转型日记" | 数据分析手动的公司 | 小红书/LinkedIn | 故事化 → 代入感 → 联系 |
| 9 | "为什么你买了 10 个 SaaS 工具，效率还是很低" | 工具疲劳的 SMB | X/LinkedIn | 痛点共鸣 → Crewly 不同 |
| 10 | "AI 运营团队 vs 雇一个实习生：成本对比" | 预算敏感的 SMB | 小红书/X | ROI 计算 → 说服 → CTA |

### 4.2 从内容到转化的 Funnel 设计

**四层漏斗：**

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: AWARENESS（认知层）                            │
│  日更内容 → 1000+ 曝光/周                                │
│  平台: X / LinkedIn / 小红书                             │
│  内容: 短贴、观点、数据分享                                │
│  目标: 关注 / 点赞 / 收藏                                 │
│  指标: Impressions, Followers Growth                     │
├─────────────────────────────────────────────────────────┤
│  Layer 2: INTEREST（兴趣层）                             │
│  深度内容 → 50+ 官网访问/周                               │
│  平台: Blog / YouTube / Newsletter                      │
│  内容: 案例详解、How-to、Steve 的 vlog                    │
│  CTA: "了解更多 → crewlyai.com/enterprise"               │
│  指标: Website Traffic, Time on Page, Newsletter Signup   │
├─────────────────────────────────────────────────────────┤
│  Layer 3: CONSIDERATION（考虑层）                         │
│  官网 → 5+ Book a Call/月                                │
│  平台: crewlyai.com/enterprise                           │
│  内容: Use Cases, Case Study, Pricing                    │
│  CTA: "Book a Free Discovery Call"                       │
│  指标: /enterprise Pageviews, Book a Call Clicks         │
├─────────────────────────────────────────────────────────┤
│  Layer 4: DECISION（决策层）                              │
│  Discovery Call → 1-2 Pilot/月                           │
│  平台: Calendly/Cal.com → Zoom/Meet                     │
│  内容: 定制 Pilot 提案                                   │
│  指标: Call Booked, Proposal Sent, Pilot Signed          │
└─────────────────────────────────────────────────────────┘
```

### 4.3 内容-转化-追踪机制

**每条内容必须包含以下之一：**

| CTA 类型 | 用于 | 示例 |
|----------|------|------|
| **Soft CTA** | 日常短贴 | "关注我，看更多 AI 运营团队实验" |
| **Medium CTA** | 深度内容 | "想看完整案例？链接在评论区 → crewlyai.com/case" |
| **Hard CTA** | 案例帖/对比帖 | "你的公司适合 AI 团队吗？免费 30 分钟诊断 → crewlyai.com/enterprise" |

**追踪方式：**
- 所有链接使用 UTM 参数：`?utm_source=linkedin&utm_medium=post&utm_campaign=gtm_q1`
- Discovery Call 表单增加 "你是从哪里了解到我们的？" 字段
- 每周统计：内容 → 官网 → Book a Call 的转化率

### 4.4 内容日历（W10-W13 示例）

| 日期 | 平台 | 主题 | 类型 | CTA 级别 | 负责人 |
|------|------|------|------|---------|--------|
| Mon | X + LinkedIn | SMB 痛点短贴 | 图文 | Soft | Luna |
| Tue | 小红书 | AI 运营实验日记 | 图文 | Soft | Luna |
| Wed | LinkedIn | 行业观察/数据分享 | 长文 | Medium | Ethan + Luna |
| Thu | X | Steve 的一人公司日记 | 短文 | Soft | Steve + Luna |
| Fri | Blog | 深度内容（案例/How-to） | 长文 | Hard | Luna + Mia |
| Sat | 小红书 | 轻量内容（转发/金句） | 图文 | Soft | Luna |
| Sun | -- | 休息/缓冲池内容 | 轻量 | Soft | 自动排程 |

### 4.5 内容引流转化时间线

```
W10-W11:   建立日更节奏 + 发布基础内容（品牌认知）
W12-W13:   发布 SteamFun 案例（从 0 → 1 的核心内容资产）
Q2 W14-W16: 内容开始积累曝光，预计首个 inbound lead
Q2 W17-W19: 稳定产出 → 每月 2-3 个 Book a Call
Q2 W20-W26: 漏斗成熟 → 每月 5+ Book a Call → 转化 1-2 客户

预计时间线: 内容从启动到产出第一个客户 = 6-8 周
Q1 内贡献: 0-1 个（内容需要时间积累）
Q2 贡献: 2-3 个
```

---

## 五、渠道 4: Cold Outreach（目标 1-2 个客户）

### 5.1 目标名单筛选标准

**必须满足（AND）：**

| 标准 | 具体要求 | 筛选工具 |
|------|---------|---------|
| 行业 | P0: 教育培训、内容 Agency、MCN<br>P1: 电商运营、专业服务 | LinkedIn Sales Navigator / 企查查 |
| 规模 | 5-50 人 | LinkedIn Company Size |
| 角色 | 创始人 / CEO / COO / 运营总监 | LinkedIn Title |
| 地域 | 美国为主（英语市场）；中国作为辅助 | LinkedIn Location |
| 信号 | 近期发过关于"AI"、"自动化"、"效率"的帖子 | LinkedIn Activity |

**加分项（OR）：**
- 个人资料提到 "open to new tools" / "always learning"
- 公司网站上有重复性运营流程的迹象
- 最近发招聘广告（运营/助理岗位 = 有运营需求）

### 5.2 Outreach Cadence（节奏设计）

**采用 14 天多触点序列（LinkedIn + Email）：**

> **行业数据：** 多渠道 outreach 的参与率比单渠道高 40%。AI 辅助的 outreach 回复率可达 10.3%（vs 纯 cold email 的 5%）。（来源：[Martal Group LinkedIn Statistics](https://martal.ca/linkedin-statistics-lb/)、[SalesBread LinkedIn Outreach Stats](https://salesbread.com/linkedin-outreach-stats/)）

```
Day 1:  LinkedIn Connection Request + 简短附言
        "Hi [Name]，注意到你在 [行业] 领域。我们帮类似规模的公司
         搭建 AI 运营团队。有兴趣了解一下吗？"

Day 3:  (连接通过后) LinkedIn Message - 价值型
        "Thanks for connecting! 分享一个案例：我们帮一个 100 人教育机构
         把排课和家长沟通全自动化了。如果你们也有类似的运营挑战，
         可以聊 30 分钟看看——纯交流，不 push。"

Day 5:  Email (如果有邮箱) - 直接型
        Subject: "[公司名] 的运营自动化"
        "Hi [Name]，我是 [Grace/Steve] from Crewly...
         我们帮 5-50 人的团队搭建 AI 运营团队...
         最近帮一个教育机构节省了 80% 的重复工作时间...
         你有 30 分钟聊聊吗？这里可以预约：[Calendly link]"

Day 7:  LinkedIn - 内容分享
        分享一篇 SteamFun 案例文章（Luna 产出的）
        "想到你可能对这个感兴趣 👆"

Day 10: Email Follow-up
        "Hi [Name]，上周给你发过一封关于 AI 运营团队的邮件。
         不知道你看到了没？如果时机不对完全理解。
         这是我们最近的案例：[链接]"

Day 14: LinkedIn - 最后触点
        "Hi [Name]，最后跟进一次！如果你们未来有运营自动化的需求，
         随时找我。祝一切顺利！"

        → 如果无回复：移入 "nurture" 列表，每月发 1 条内容
        → 如果有回复：安排 Discovery Call
```

### 5.3 每周 Outreach 量

| 活动 | 每周数量 | 工具 | 负责人 |
|------|---------|------|--------|
| LinkedIn Connection Request | 25-30 个 | LinkedIn（手动/半自动） | Grace |
| LinkedIn Messages | 10-15 个 | LinkedIn | Grace |
| Cold Emails | 15-20 封 | Gmail / Apollo.io | Grace |
| Follow-up（所有渠道） | 20-25 个 | CRM 提醒 | Grace |

**注意：** LinkedIn 每周连接请求限制约 100-200 个（取决于账号资历）。建议控制在 25-30/周以避免被限制。

### 5.4 Cold Outreach 转化预估

```
每月 outreach:
  100 LinkedIn Connection Requests → 30 Connected (30%)
  60 Cold Emails → 4 Replies (6-7%)

总有效触达: ~34 人/月
  → 8-10 有兴趣 (25-30% interest rate for warm responses)
  → 3-4 Discovery Call (35-40%)
  → 1-2 Pilot (30-50%)

Q1 贡献: 0-1 个（刚启动）
Q2 贡献: 1-2 个
```

### 5.5 Cold Outreach 的消息模板

**LinkedIn Connection Request（150 字符限制）：**

```
Version A（教育行业）:
"Hi [Name]！我们刚帮一个 STEM 教育机构用 AI 自动化运营流程。
你们 [公司名] 可能也用得上，有空聊聊？"

Version B（内容 Agency）:
"Hi [Name]，看到 [公司名] 的内容做得很好。
我们帮 Agency 搭 AI 内容运营团队，提效 3x。有兴趣了解？"

Version C（通用型）:
"Hi [Name]，我们帮 5-50 人的团队搭建 AI 运营团队，
自动化重复性工作。你的团队有这方面需求吗？"
```

**Cold Email 模板：**

```
Subject: [公司名] × AI 运营团队

Hi [Name]，

我是 [Grace/Steve]，来自 Crewly。

注意到 [公司名] 在 [行业] 做得很好。
很多像你们这样的团队花大量时间在 [排课/客户沟通/内容发布/数据整理] 上。

我们最近帮一个 100 人的教育机构用 AI 运营团队把这些流程全自动化了
——每月节省 80+ 小时人力。

如果你有 30 分钟，我可以免费帮你做个运营诊断，看看哪些流程适合 AI 接管。

这里预约：[Calendly Link]

Best,
[Name]
Crewly — AI 运营团队
```

---

## 六、四渠道整合时间线

### Q1 剩余（W10-W13）

```
         Steve 人脉     SteamFun 裂变    内容引流         Cold Outreach
         ───────────    ────────────     ──────────       ────────────
W10      列名单 +       交付推进         日更启动          搭建工具 +
         开始 intro                       基础内容          名单筛选

W11      5-7 Call       部署测试         日更继续          开始 outreach
         安排中                          深度内容          25-30/周

W12      3-4 Pilot      案例素材         SteamFun 案例     持续 outreach
         提案发送        收集             发布！！           跟进

W13      2-3 签约 ✓     Nick 开始        案例持续          首批 replies
                        引荐             传播              → Call 安排

Q1 产出: 2-3 客户       0 客户           0 客户            0 客户
         (最快渠道)     (Q2 贡献)        (需要时间)         (刚启动)
```

### Q2（W14-W26）

```
         Steve 人脉     SteamFun 裂变    内容引流         Cold Outreach
         ───────────    ────────────     ──────────       ────────────
W14-W16  追加 1 个      2 Call →         漏斗积累         稳定 outreach
         (长周期)       1 Pilot          首个 inbound     → 1-2 Call/月

W17-W19  总计 3-4 ✓     再 1 Pilot       2-3 Call/月      1 Pilot
                        总计 2 ✓

W20-W23  渠道耗尽       总计 2-3 ✓       1 Pilot          1 Pilot
         (转 referral)                   总计 1 ✓

W24-W26  --             --               再 1-2 Pilot     总计 1-2 ✓
                                         总计 2-3 ✓

Q2 产出: +1 客户        +2-3 客户        +2-3 客户         +1-2 客户
```

### 累计进度

| 时间点 | Steve | SteamFun | Content | Cold | 累计 |
|--------|-------|----------|---------|------|------|
| W13（Q1 末） | 2-3 | 0 | 0 | 0 | **2-3** |
| W16 | 3-4 | 1 | 0 | 0 | **4-5** |
| W19 | 3-4 | 2 | 1 | 1 | **7-8** |
| W23 | 3-4 | 2-3 | 2 | 1-2 | **8-10** |
| W26（Q2 末） | 3-4 | 2-3 | 2-3 | 1-2 | **9-12** |

---

## 七、Sales Pipeline 管理

### 7.1 推荐工具

| 工具 | 用途 | 费用 | 推荐理由 |
|------|------|------|---------|
| **Notion** (CRM 模板) | Pipeline 管理 | 免费 | 团队已用 Notion，零学习成本 |
| **Cal.com** | Discovery Call 预约 | 免费 | 开源，Crewly 品牌一致 |
| **LinkedIn** (免费) | 人脉搜索 + DM | 免费 | 基础搜索够用 |
| **Gmail** | Cold Email | 免费 | 简单直接 |
| 可选: **Apollo.io** | Email finding + 序列 | 免费层够用 | 如果 Grace 需要批量 outreach |

### 7.2 Pipeline 阶段定义

```
Lead        → 知道这个人/公司存在
Contacted   → 已发出 intro/DM/email
Responded   → 对方回复了（不论正负）
Call Booked → Discovery Call 已预约
Call Done   → 完成 Discovery Call
Proposal    → 已发送 Pilot 提案
Negotiation → 正在讨论细节/价格
Won         → 签约 Pilot 或 Retainer
Lost        → 明确拒绝或失联 90 天
Nurture     → 暂时不需要，保持联系
```

### 7.3 每周 Pipeline Review

**Grace 每周五提交 Pipeline 快照：**

| 指标 | 本周 | 上周 | 目标 |
|------|------|------|------|
| 新 Leads | ? | -- | 15+/周 |
| Active Pipeline（Contacted → Negotiation） | ? | -- | 20+ |
| Discovery Calls 完成 | ? | -- | 3+/周 |
| Proposals 发送 | ? | -- | 2+/周 |
| Won (本周) | ? | -- | 1+/2周 |
| Pipeline 价值（加权） | ? | -- | $10K+ |

---

## 八、关键执行细节

### 8.1 Discovery Call 后的跟进 SOP

```
Call 结束后 2 小时内:
  → Grace 发送感谢邮件 + 要点总结
  → Mia 开始起草 Pilot 提案

Call 结束后 48 小时内:
  → 发送 Pilot 提案（PDF + 邮件正文摘要）
  → 提案内容：问题诊断 → AI Team 设计 → 时间线 → 定价 → 下一步

提案发送后 3 天:
  → Grace Follow Up: "Hi [Name]，提案看了吗？有什么问题？"

提案发送后 7 天:
  → 如无回复: "Hi [Name]，想确认一下时间线。如果现在不是好时机，完全理解。"

提案发送后 14 天:
  → 如仍无回复: 移入 Nurture 列表（每月 1 次轻度触达）
```

### 8.2 Pilot 提案模板框架

```markdown
# [客户公司名] × Crewly — AI 运营团队 Pilot 提案

## 1. 你的挑战
[基于 Discovery Call 中听到的具体痛点]
- 痛点 1: [具体描述 + 量化影响]
- 痛点 2: [具体描述 + 量化影响]

## 2. 我们的方案
为 [公司名] 定制的 AI 运营团队：
- Agent 1: [角色名] — [职责]
- Agent 2: [角色名] — [职责]
- Agent 3: [角色名] — [职责]

## 3. 预期成果
- [具体可衡量的结果 1]
- [具体可衡量的结果 2]
- [具体可衡量的结果 3]

## 4. 时间线
Week 1: 深度需求分析 + 方案设计
Week 2: AI Team 部署 + 第一个 workflow 上线
Week 3: 调优 + 第二个 workflow
Week 4: 验收 + 客户培训

## 5. 投资
Pilot: $[X]（一次性，含 4 周全部工作）
后续 Retainer: $[X]/月（可选，Pilot 结束后决定）

## 6. 为什么选 Crewly
- 不用换现有工具（直接对接你的 [Google Workspace/Slack/etc]）
- 不需要技术团队（我们全程负责）
- 2 周内看到第一个成果
- SteamFun 案例：[简要引用]

## 7. 下一步
确认签约 → 安排 Week 1 需求会议
```

### 8.3 定价谈判指南

| 客户反应 | 回应策略 |
|---------|---------|
| "太贵了" | "我理解。如果我们先从 1 个核心 workflow 开始，Pilot 可以控制在 $1,000。验证价值后再扩展。" |
| "我想先试免费的" | "我们的开源框架是免费的。但如果你们没有技术团队，自己配置可能需要 4-8 周。Pilot 是我们团队帮你 2 周搞定。" |
| "要回去商量" | "完全理解。方便的话，下周我们可以再开一个 15 分钟的 call，把你同事的问题一起解答？" |
| "时机不对" | "没问题。我每月发一篇案例更新，保持联系？等你们准备好随时聊。" |
| "竞品更便宜" | "CrewAI 是 $25/月，但你需要自己用 Python 配置。我们的 Pilot 包含全部实施工作——相当于请了一个 2 周的 AI 专家，只花 $1,500。" |

---

## 九、风险与应对（GTM 专项）

| 风险 | 可能性 | 影响 | 应对 |
|------|--------|------|------|
| **Grace 尚未到位** | 中 | 高 | Steve 暂时承担 outreach；Mia 承担 proposal 撰写；W10 必须确定 |
| **Steve 人脉转化率低于预期** | 低-中 | 高 | 增加 Cold Outreach 量（从 25→50/周）+ 加速内容产出 |
| **SteamFun 案例无法按时产出** | 中 | 中 | 先用"进行中"的案例（partial results）+ 侧重 Steve 人脉渠道 |
| **Cold Email 被标记为 spam** | 中 | 低 | 使用个人邮箱（非群发工具）、每天 <20 封、高度个性化 |
| **Discovery Call 转化率低** | 中 | 中 | 每 5 个 Call 后复盘脚本 + 调整；让 Steve 参加前 3 个 Call 示范 |
| **LinkedIn 账号被限制** | 低 | 中 | 控制连接请求 <30/周；使用自然语言、非模板化消息 |
| **内容日更执行不达标** | 中 | 中 | 建立 7 天缓冲池；提前批量产出；周末允许轻量内容 |

---

## 十、衡量标准与周报模板

### 每周 GTM Review（Grace 负责提交，每周五 EOD）

```markdown
# GTM Weekly — Week [X]

## Pipeline Snapshot
- New Leads this week: [X]
- Active Pipeline: [X] contacts in [stages]
- Discovery Calls done: [X]
- Proposals sent: [X]
- Deals won/lost: [X]

## Channel Performance
| Channel | Outreach | Response | Calls | Proposals | Won |
|---------|----------|----------|-------|-----------|-----|
| Steve 人脉 | [X] intro | [X] | [X] | [X] | [X] |
| SteamFun 裂变 | [X] referral | [X] | [X] | [X] | [X] |
| Content Inbound | [X] leads | [X] | [X] | [X] | [X] |
| Cold Outreach | [X] contacted | [X] | [X] | [X] | [X] |

## Content Metrics (Luna 提供)
- Posts published: [X]/7
- Total impressions: [X]
- Website visits from content: [X]
- Book a Call clicks: [X]

## Key Learnings
- What worked: [...]
- What didn't: [...]
- Adjustments for next week: [...]

## Revenue
- MRR: $[X]
- Pipeline value: $[X]
- Cumulative customers: [X]/10
```

---

*文档作者：Ethan (Strategist) | 2026-02-28*
*数据来源：[CrewAI Pricing](https://www.crewai.com/pricing)、[n8n Pricing](https://n8n.io/pricing/)、[Relevance AI Pricing](https://relevanceai.com/pricing)、[LangSmith Pricing](https://www.langchain.com/pricing)、[Cleveroad AI Agent Cost Guide](https://www.cleveroad.com/blog/ai-agent-development-cost/)、[Martal Group LinkedIn Stats](https://martal.ca/linkedin-statistics-lb/)、[SalesBread Outreach Stats](https://salesbread.com/linkedin-outreach-stats/)*
*配合文档：crewly-okr-v2-proposal.md*
