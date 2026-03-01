# crewlyai.com Website Execution Plan v1.0

> **Status:** DRAFT — Pending Steve Approval
> **Author:** Mia (Product Manager)
> **Date:** 2026-02-27
> **Based on:** crewlyai-website-strategy-v1.md (Steve, v1.0)
> **Core principle:** Sell results and trust, not SaaS features

---

## Table of Contents

1. [Page Specifications](#1-page-specifications)
   - [Homepage (/)](#11-homepage-)
   - [Community (/community)](#12-community-community)
   - [Docs (/docs)](#13-docs-docs)
   - [Enterprise (/enterprise)](#14-enterprise-enterprise)
   - [Case Study (/case)](#15-case-study-case)
   - [Blog (/blog)](#16-blog-blog)
2. [Navigation Redesign](#2-navigation-redesign)
3. [Technical Implementation Tasks](#3-technical-implementation-tasks)
4. [Book a Call Integration](#4-book-a-call-integration)
5. [P0/P1/P2 Timeline](#5-p0p1p2-timeline)

---

## 1. Page Specifications

### 1.1 Homepage (/)

**Purpose:** B2B conversion page. Establish credibility, show real capabilities, hint at vision, funnel to Book a Call.

#### Section 1: Hero

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  We build AI teams that run your operations.                │
│                                                             │
│  Design and deploy AI agents to handle content, ops,        │
│  communication, and workflows — tailored to your business.  │
│                                                             │
│  [Book a Call]  (primary, indigo)                            │
│  [View Case Study →]  (secondary, text link)                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Copy:**
- H1: `We build AI teams that run your operations.`
- Subhead: `Design and deploy AI agents to handle content, ops, communication, and workflows — tailored to your business.`
- Primary CTA: `Book a Call` → links to Calendly embed or /enterprise#book
- Secondary CTA: `View Case Study →` → links to /case

**Design assets needed:**
- Abstract hero illustration (optional): AI agents working together (geometric/minimal style, matches dark theme). Can launch with gradient-only background initially.

---

#### Section 2: What We Do

```
┌─────────────────────────────────────────────────────────────┐
│  What we do                                                 │
│                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │ 📝            │  │ ⚙️             │  │ 🔄            │   │
│  │ AI Content    │  │ AI Operations │  │ AI Workflow   │   │
│  │ Teams         │  │ Teams         │  │ Automation    │   │
│  │               │  │               │  │               │   │
│  │ Writing,      │  │ Customer      │  │ Cross-tool    │   │
│  │ editing,      │  │ comms,        │  │ data flows,   │   │
│  │ publishing,   │  │ scheduling,   │  │ notifications,│   │
│  │ distribution  │  │ reporting,    │  │ processing,   │   │
│  │ across        │  │ archiving     │  │ and           │   │
│  │ channels.     │  │ — on          │  │ coordination  │   │
│  │               │  │ autopilot.    │  │ — automated.  │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Copy:**

Section heading: `What we do`

Card 1 — AI Content Teams
- Icon: `FileText` (Lucide)
- Title: `AI Content Teams`
- Body: `Writing, editing, publishing, and distribution across channels. Your AI content team produces and manages content at scale — blog posts, social media, newsletters, and more.`

Card 2 — AI Operations Teams
- Icon: `Settings` (Lucide)
- Title: `AI Operations Teams`
- Body: `Customer communication, scheduling, reporting, and archiving — on autopilot. Reduce manual ops work by 80% with agents that handle the repetitive stuff.`

Card 3 — AI Workflow Automation
- Icon: `Workflow` (Lucide)
- Title: `AI Workflow Automation`
- Body: `Cross-tool data flows, notifications, processing, and coordination. Connect your existing tools and let AI agents manage the handoffs between them.`

**Design assets:** 3 Lucide icons (FileText, Settings, Workflow). Existing card pattern: `bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-gray-700`.

---

#### Section 3: Case Preview

```
┌─────────────────────────────────────────────────────────────┐
│  Real results                                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  STEAM Fun (Science Cheese)                         │    │
│  │  Education company — Shanghai, China                │    │
│  │                                                     │    │
│  │  • Student and class data management                │    │
│  │  • Automated parent communication                   │    │
│  │  • Teaching record archiving                        │    │
│  │  • Operations workflow automation                   │    │
│  │                                                     │    │
│  │  [Read the full case study →]                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Copy:**

Section heading: `Real results`

Case card:
- Label: `Case Study`
- Client: `STEAM Fun (Science Cheese)`
- Subtitle: `Education company — Shanghai, China`
- Bullets:
  - `Student and class data management`
  - `Automated parent communication`
  - `Teaching record archiving`
  - `Operations workflow automation`
- CTA: `Read the full case study →` → /case

**Design assets:** STEAM Fun logo (if available), or use a generic education icon placeholder. Single wide card, slight left-aligned gradient accent.

---

#### Section 4: How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  How it works                                               │
│                                                             │
│  1 ─── Discovery                                            │
│        We learn your business, goals, and pain points.      │
│                                                             │
│  2 ─── Team Design                                          │
│        We design AI agent roles, workflows, and             │
│        integrations specific to your operations.            │
│                                                             │
│  3 ─── Deployment                                           │
│        Your AI team goes live — local or hybrid,            │
│        with full visibility and control.                    │
│                                                             │
│  4 ─── Optimization                                         │
│        Your AI team learns, adapts, and improves            │
│        continuously. We handle ongoing support.             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Copy:**

Section heading: `How it works`

Step 1 — Discovery
- Number badge: `1`
- Title: `Discovery`
- Body: `We learn your business, goals, and pain points. Every engagement starts with understanding what matters most to your operations.`

Step 2 — Team Design
- Number badge: `2`
- Title: `Team Design`
- Body: `We design AI agent roles, workflows, and integrations specific to your operations. Each agent gets a tailored prompt, skillset, and knowledge base.`

Step 3 — Deployment
- Number badge: `3`
- Title: `Deployment`
- Body: `Your AI team goes live — local or hybrid, with full visibility and control. Watch agents work in real-time through the team dashboard.`

Step 4 — Optimization
- Number badge: `4`
- Title: `Optimization`
- Body: `Your AI team learns, adapts, and improves continuously. Memory, self-evolution, and feedback loops make the system smarter over time. We handle ongoing support.`

**Design:** Vertical numbered timeline layout. Indigo number badges (`bg-indigo-500/20 text-indigo-400 rounded-full w-10 h-10`). Connecting line between steps.

---

#### Section 5: Vision

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  "Our long-term vision is to build an AI Team Operating     │
│   System — enabling one person to run a full company        │
│   with a self-driving AI team."                             │
│                                                             │
│  Open source core. Community-driven ecosystem.              │
│  Enterprise-grade delivery.                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Copy:**

Blockquote: `Our long-term vision is to build an AI Team Operating System — enabling one person to run a full company with a self-driving AI team.`

Supporting line: `Open source core. Community-driven ecosystem. Enterprise-grade delivery.`

**Design:** Centered blockquote with subtle indigo gradient border-left or quotation styling. Subdued background (`bg-gray-900/30`).

---

#### Section 6: Final CTA

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Ready to put AI to work for your business?                 │
│                                                             │
│  [Book a Call]                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Copy:**
- Heading: `Ready to put AI to work for your business?`
- Subhead: `Tell us about your operations. We'll design an AI team that fits.`
- CTA: `Book a Call` → Calendly link

**Design:** Full-width section with subtle gradient background. Centered text. Large indigo CTA button.

---

### 1.2 Community (/community)

**Purpose:** Showcase the open-source ecosystem. Entry point for developers. Distinguish free vs. paid.

#### Section 1: Hero

**Copy:**
- H1: `Everything you need to build your own AI team`
- Subhead: `Open source orchestration framework, templates, tutorials, and a growing community of builders.`

**CTAs (row of 3 buttons):**
- `View on GitHub` → github.com/stevehuang0115/crewly (outline style)
- `Read Docs` → /docs (outline style)
- `Book a Call` → Calendly (solid indigo, "For Business" subtitle)

---

#### Section 2: Open Source Core

**Copy:**

Section heading: `Open source core`

- Title: `Crewly Framework`
- Body: `The open-source orchestration engine that powers AI teams. Create teams, assign roles, delegate tasks, and monitor agents — all from a real-time dashboard.`
- Bullet features:
  - `Multi-agent orchestration with role-based prompts`
  - `Real-time terminal monitoring dashboard`
  - `Persistent memory and knowledge base`
  - `Skill-based extensibility`
  - `MIT licensed — free forever`
- CTA: `View on GitHub →`

---

#### Section 3: Templates & Examples

**Copy:**

Section heading: `Templates & examples`
Subtitle: `Pre-built AI team configurations to get started fast.`

Template cards (2-column grid):

Card 1:
- Title: `Startup Team`
- Body: `PM + Engineer + Ops — a 3-agent team for building and shipping software.`
- Badge: `Available`

Card 2:
- Title: `Content Team`
- Body: `Writer + Editor + Strategist — produce and distribute content at scale.`
- Badge: `Available`

Card 3:
- Title: `Research Team`
- Body: `Researcher + Analyst + Writer — deep research with structured outputs.`
- Badge: `Coming Soon`

Card 4:
- Title: `E-commerce Team`
- Body: `Catalog + Support + Marketing — manage your online store operations.`
- Badge: `Coming Soon`

---

#### Section 4: Tutorials & Best Practices

**Copy:**

Section heading: `Learn & build`
Subtitle: `Guides to get the most out of Crewly.`

Link list:
- `Getting Started Guide` → /docs
- `Creating Your First AI Team` → /blog/getting-started (or /docs#quick-start)
- `Writing Custom Skills` → /docs#skills
- `Memory & Knowledge Base` → /docs#memory

---

#### Section 5: Free vs. Paid

**Copy:**

Section heading: `Choose your path`

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Community (Free) │  │ Pro Support Pack │  │ Enterprise       │
│                  │  │                  │  │                  │
│ Open source      │  │ Everything in    │  │ Custom AI team   │
│ framework        │  │ Community, plus: │  │ built for your   │
│                  │  │                  │  │ business         │
│ • Full framework │  │ • Quick setup    │  │                  │
│ • Basic templates│  │   assistance     │  │ • Discovery call │
│ • Documentation  │  │ • Premium        │  │ • Custom roles   │
│ • Community      │  │   template pack  │  │   & workflows    │
│   support        │  │ • Priority       │  │ • Deployment     │
│                  │  │   support        │  │ • Ongoing        │
│                  │  │ • Office hours   │  │   optimization   │
│                  │  │                  │  │                  │
│ [View on GitHub] │  │ [Coming Soon]    │  │ [Book a Call]    │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

Card 1 — Community (Free):
- Features: `Full open source framework`, `Basic templates & examples`, `Documentation & guides`, `Community support (GitHub Issues)`
- CTA: `View on GitHub`

Card 2 — Pro Support Pack:
- Features: `Everything in Community, plus:`, `Quick setup & configuration assistance`, `Premium template pack`, `Priority support & office hours`
- CTA: `Coming Soon` (disabled/gray button)

Card 3 — Enterprise:
- Features: `A custom AI team built for your business`, `Discovery call & needs assessment`, `Custom roles, workflows, & integrations`, `Deployment & ongoing optimization`
- CTA: `Book a Call`

---

#### Section 6: Contribute

**Copy:**

Section heading: `Join the community`
Body: `Crewly is built by a growing community of developers and AI practitioners. Contribute skills, templates, documentation — or just star the repo.`

CTAs:
- `Star on GitHub` → GitHub repo
- `Join Discord` → Discord invite (or "Coming Soon")
- `Read Contributing Guide` → /docs#contributing or GitHub CONTRIBUTING.md

---

### 1.3 Docs (/docs)

**Purpose:** Installation, setup, tutorials for developers. Download/install methods move here from the removed /download page.

#### Section 1: Hero

**Copy:**
- H1: `Documentation`
- Subhead: `Install Crewly, create your first AI team, and start building.`

---

#### Section 2: Quick Start (NEW — absorbs /download)

**Copy:**

Section heading: `Quick Start`

Install methods (tabbed interface, reuse existing pattern from old Hero):

Tab 1 — Quick Install:
```bash
curl -fsSL https://crewlyai.com/install.sh | bash
```

Tab 2 — npm:
```bash
npm install -g crewly && crewly onboard
```

Tab 3 — npx (no install):
```bash
npx crewly start
```

System Requirements box:
- `Node.js 20+`
- `macOS, Linux, or Windows`
- `tmux (for agent sessions)`
- `At least one AI coding CLI installed`

---

#### Section 3: Existing Docs Content (Keep)

Retain the current sections with updated URLs:
- Prerequisites
- Creating a Team
- Communicating with Your Team
- Knowledge Base & Memory
- Skills Marketplace

All `crewly.stevesprompt.com` references → `crewlyai.com`

---

### 1.4 Enterprise (/enterprise)

**Purpose:** Core conversion page for B2B Custom AI Team service. This is where money is made.

#### Section 1: Hero

**Copy:**
- H1: `A custom AI operations team for your business`
- Subhead: `We design, deploy, and manage AI agent teams tailored to your operations — so you can focus on growth.`
- CTA: `Schedule a Call` (large, indigo)

---

#### Section 2: Who It's For

**Copy:**

Section heading: `Built for businesses that run on operations`

Cards (2x2 grid):

Card 1 — Education:
- Icon: `GraduationCap` (Lucide)
- Title: `Education`
- Body: `Student management, parent communication, curriculum planning, and admin workflows.`

Card 2 — E-commerce:
- Icon: `ShoppingBag` (Lucide)
- Title: `E-commerce`
- Body: `Product catalog management, customer support, order workflows, and marketing automation.`

Card 3 — Services:
- Icon: `Briefcase` (Lucide)
- Title: `Professional Services`
- Body: `Client communications, project tracking, billing, and operational reporting.`

Card 4 — Content:
- Icon: `PenTool` (Lucide)
- Title: `Content & Media`
- Body: `Editorial workflows, publishing pipelines, social media management, and audience growth.`

---

#### Section 3: What We Deliver

**Copy:**

Section heading: `What you get`

Checklist format:
- `Custom AI agent roles designed for your business processes`
- `Workflow automation that connects your existing tools`
- `Persistent memory — your AI team learns your business over time`
- `Real-time dashboard to monitor every agent's work`
- `Self-evolving system that improves with every task cycle`
- `Ongoing optimization and support from our team`

---

#### Section 4: How It Works (mirrors homepage)

Same 4-step process as homepage Section 4 (Discovery → Team Design → Deployment → Optimization). Reuse component.

---

#### Section 5: Pricing

**Copy:**

Section heading: `Investment`

```
┌────────────────────────────────────────────────┐
│                                                │
│  Setup                         $500 – $2,000+  │
│  Needs assessment, team design,                │
│  role configuration, initial deployment        │
│                                                │
│  Monthly Support               $200 – $500+    │
│  Ongoing optimization, monitoring,             │
│  prompt tuning, and priority support           │
│                                                │
│  Final pricing depends on scope,               │
│  number of agents, and complexity.             │
│                                                │
│  [Schedule a Call to discuss your needs]        │
│                                                │
└────────────────────────────────────────────────┘
```

**Design:** Single card with price ranges. Clean, transparent layout. No tiered pricing grid. Subtle indigo accent on price numbers.

---

#### Section 6: FAQ

**Copy:**

Q: `How long does setup take?`
A: `Most engagements go from discovery call to live AI team in 1-2 weeks. Complex setups with multiple integrations may take 3-4 weeks.`

Q: `Do I need technical skills?`
A: `No. We handle all the technical setup. You just tell us about your operations and what you want automated.`

Q: `What happens after deployment?`
A: `Your AI team runs continuously. We monitor performance, tune prompts, and optimize workflows on an ongoing basis. You have full dashboard access to watch your team work.`

Q: `Is my data secure?`
A: `Yes. Crewly runs on your infrastructure (local or your own cloud). Your data never passes through our servers. We use encrypted connections for all remote support.`

Q: `Can I cancel anytime?`
A: `Yes. Monthly support has no long-term commitment. You own all configurations and can run the system independently.`

---

#### Section 7: Final CTA (with Booking Embed)

**Copy:**
- Heading: `Let's build your AI team`
- Subhead: `Tell us about your business. We'll design a team that fits.`
- Embedded Calendly widget (inline, not popup) — OR —
- CTA button: `Schedule a Call` → opens Calendly in new tab

This section includes the **Qualification Form** (see Section 4 of this doc for details).

---

### 1.5 Case Study (/case)

**Purpose:** Proof of results. Detailed breakdown of STEAM Fun engagement.

#### Section 1: Hero

**Copy:**
- Label badge: `Case Study`
- H1: `How STEAM Fun automated their education operations with an AI team`
- Subhead: `From manual parent communication and scattered records to a fully automated operations workflow.`

---

#### Section 2: Client Overview

**Copy:**

Section heading: `About STEAM Fun`

- Full name: `STEAM Fun (Science Cheese / 科学奶酪)`
- Industry: `STEAM Education`
- Location: `Shanghai, China`
- Challenge: `A growing education company struggling to scale operations — student tracking, parent communication, class scheduling, and teaching records were all manual and fragmented.`

---

#### Section 3: The Challenge

**Copy:**

Section heading: `The challenge`

Body: `STEAM Fun's operations were hitting a wall. As the student base grew, the team spent more time on admin than teaching. Key pain points:`

Bullet list:
- `Student and class data spread across multiple spreadsheets`
- `Parent communication handled manually — one message at a time`
- `Teaching records and session notes filed inconsistently`
- `Scheduling conflicts and missed follow-ups`
- `No centralized view of operations`

---

#### Section 4: The Solution

**Copy:**

Section heading: `What we built`

Body: `We designed a custom AI operations team for STEAM Fun with four specialized agents:`

Agent cards (vertical list):

1. `Ops Manager` — `Handles scheduling, resource allocation, and operational workflows. Monitors team workload and flags bottlenecks.`
2. `Communications Agent` — `Manages parent communication — class updates, schedule changes, progress reports. Drafts and sends messages in the right tone.`
3. `Records Agent` — `Archives teaching records, session notes, and student progress data. Makes everything searchable and organized.`
4. `Data Agent` — `Structures student and class data. Generates reports on enrollment, attendance, and performance trends.`

---

#### Section 5: Results

**Copy:**

Section heading: `Results`

Metrics (large number + label format):

- `80%` — `Reduction in manual ops work`
- `4` — `AI agents running daily operations`
- `100%` — `Parent communications automated`
- `Real-time` — `Operational visibility through dashboard`

Note: `Results based on the STEAM Fun deployment. Specific metrics may vary by engagement.`

---

#### Section 6: CTA

**Copy:**
- Heading: `Want similar results for your business?`
- Subhead: `Every AI team is custom-built for your operations.`
- CTA: `Book a Call`

**Design assets needed:**
- STEAM Fun logo (request from Steve/Nick)
- Optional: 1-2 screenshots of the dashboard showing agents working (can blur sensitive data)

---

### 1.6 Blog (/blog)

**Purpose:** Founder-led distribution. Content marketing aligned with AI Team OS narrative.

#### Changes from Current

- **Hero text update only.** Keep existing blog infrastructure, card layout, and rendering.

Current hero:
> Tutorials, guides, and deep dives into AI agent orchestration

New hero:
- H1: `Blog`
- Subhead: `Stories, tutorials, and insights from building AI teams that run real businesses.`

- **Add category filters** (optional P1): `All`, `Case Studies`, `Tutorials`, `Behind the Scenes`, `AI Teams`

- **Content strategy** (post ideas for Steve/Luna):
  1. "What We Learned Building an AI Operations Team for an Education Company"
  2. "Why We're Building an AI Team OS, Not Another AI Tool"
  3. "How Self-Evolving AI Agents Fix Their Own Mistakes"
  4. "One Person, Full AI Company: The Crewly Experiment"
  5. "AI Memory Systems: How Our Agents Learn and Never Repeat Mistakes"

---

## 2. Navigation Redesign

### 2.1 Header

**New navigation:**

```
[CREWLY logo]  Community | Docs | For Business | Case Study | Blog    [Book a Call]
```

**Implementation in constants.ts:**

```typescript
export const NAV_LINKS = [
  { label: 'Community', href: '/community' },
  { label: 'Docs', href: '/docs' },
  { label: 'For Business', href: '/enterprise' },
  { label: 'Case Study', href: '/case' },
  { label: 'Blog', href: '/blog' },
] as const;
```

**Header component changes:**
- Add `Book a Call` CTA button to right side of nav (indigo bg, rounded, visible on desktop)
- Keep GitHub link as icon-only button next to CTA (subtle, not text link)
- Mobile: hamburger menu with all links + Book a Call as full-width button at bottom

**Mobile responsive (hamburger menu):**
```
┌────────────────┐
│ ✕ Close        │
│                │
│ Community      │
│ Docs           │
│ For Business   │
│ Case Study     │
│ Blog           │
│                │
│ [Book a Call]  │ ← full-width indigo button
│                │
│ GitHub ↗       │
└────────────────┘
```

**Technical notes:**
- Current Header.tsx has no mobile hamburger menu — needs to be added
- Use `useState` for mobile menu open/close
- Breakpoint: hide nav links below `md`, show hamburger icon
- CTA button: `bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold`

### 2.2 Footer

**New footer structure (3-column + bottom bar):**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  CREWLY              Product           Connect              │
│                      Community         GitHub                │
│  AI Team OS          Docs              X (Twitter)           │
│                      For Business      YouTube               │
│                      Case Study        LinkedIn              │
│                      Blog              Discord (Coming Soon) │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  (c) 2026 Crewly. Open source under MIT license.           │
└─────────────────────────────────────────────────────────────┘
```

**Social links:**
- GitHub: `github.com/stevehuang0115/crewly`
- X: `x.com/stevesprompt`
- YouTube: `youtube.com/@stevesprompt`
- LinkedIn: `linkedin.com/in/yanghuang0115`

---

## 3. Technical Implementation Tasks

### 3.1 New Files to Create

| File | Description |
|------|-------------|
| `src/app/community/page.tsx` | Community page |
| `src/app/enterprise/page.tsx` | Enterprise/B2B conversion page |
| `src/app/case/page.tsx` | Case study page (STEAM Fun) |
| `src/components/Landing/WhatWeDo.tsx` | 3-card service offering section |
| `src/components/Landing/CasePreview.tsx` | Homepage case study preview card |
| `src/components/Landing/HowItWorksNew.tsx` | 4-step process (numbered timeline) |
| `src/components/Landing/Vision.tsx` | Vision blockquote section |
| `src/components/Landing/CTANew.tsx` | New CTA with Book a Call |
| `src/components/Community/OpenSourceCore.tsx` | Open source framework showcase |
| `src/components/Community/Templates.tsx` | Template grid with availability badges |
| `src/components/Community/Tiers.tsx` | Free / Pro / Enterprise comparison |
| `src/components/Community/Contribute.tsx` | Community contribution CTA |
| `src/components/Enterprise/WhoItsFor.tsx` | 4-card industry grid |
| `src/components/Enterprise/WhatYouGet.tsx` | Checklist of deliverables |
| `src/components/Enterprise/Pricing.tsx` | Price range card |
| `src/components/Enterprise/EnterpriseFAQ.tsx` | Enterprise-specific FAQ |
| `src/components/Enterprise/BookingEmbed.tsx` | Calendly embed wrapper |
| `src/components/Case/ClientOverview.tsx` | Client info card |
| `src/components/Case/Challenge.tsx` | Problem statement section |
| `src/components/Case/Solution.tsx` | Agent cards with role descriptions |
| `src/components/Case/Results.tsx` | Metrics display (large numbers) |

### 3.2 Files to Modify

| File | Changes |
|------|---------|
| `src/lib/constants.ts` | Update `SITE_URL` to `https://crewlyai.com`, update `SITE_DESCRIPTION` to `AI Team Operating System`, update `NAV_LINKS` to new structure, update `FEATURES` array, update install command URLs, add `BOOKING_URL` constant |
| `src/app/layout.tsx` | Update all metadata (title, description, keywords, OpenGraph, Twitter, JSON-LD structured data). Remove references to specific AI models in meta descriptions. Update canonical URL. |
| `src/app/page.tsx` | Replace all Landing component imports with new sections (WhatWeDo, CasePreview, HowItWorksNew, Vision, CTANew). Remove: DemoPlayer, SocialProof, WhatIsCrewly, Runtimes, Features, HowItWorks, FAQ, CTA. |
| `src/components/Layout/Header.tsx` | Add mobile hamburger menu. Add `Book a Call` CTA button. Replace GitHub text link with icon. Add responsive breakpoint logic. |
| `src/components/Layout/Footer.tsx` | Redesign to 3-column layout with Product links, social links, and branding. |
| `src/app/docs/page.tsx` | Add Quick Start / install section at top (absorbing /download content). Update all URLs from `crewly.stevesprompt.com` to `crewlyai.com`. |
| `src/app/blog/page.tsx` | Update hero heading and description. |
| `package.json` | Bump version to `1.0.16` |

### 3.3 Files to Delete or Deprecate

| File | Action |
|------|--------|
| `src/app/download/page.tsx` | **Delete** — install content moves to /docs |
| `src/app/download/` (directory) | **Delete** |
| `src/components/Download/` | **Delete** — if exists |
| `src/app/marketplace/page.tsx` | **Keep but remove from nav** — accessible via /community and direct URL |
| `src/app/marketplace/[id]/page.tsx` | **Keep** — still accessible |
| `src/components/Landing/Hero.tsx` | **Rewrite in place** — new hero copy |
| `src/components/Landing/Runtimes.tsx` | **Delete** — no longer showing specific models |
| `src/components/Landing/SocialProof.tsx` | **Delete** — not applicable for B2B trust page |
| `src/components/Landing/WhatIsCrewly.tsx` | **Delete** — replaced by WhatWeDo |
| `src/components/Landing/DemoPlayer.tsx` | **Delete or hide** — can re-add later when demo video is ready |

### 3.4 Domain Migration Steps

Referencing the infrastructure audit from the previous plan (crewlyai-migration-plan.md):

**Step 1: Cloudflare DNS** (Steve)
- Add `crewlyai.com` zone to Cloudflare
- A record `@` → CELB2 IP, Proxy ON
- A record `www` → CELB2 IP, Proxy ON
- SSL/TLS mode: Full
- Enable "Always Use HTTPS"

**Step 2: Nginx Config** (Sam)
- Create `ce-core/do-provision/nginx-configs/crewlyai.conf`:
```nginx
upstream crewlyai_web {
    least_conn;
    server ceappnode1:10014;
    server ceappnode2:10014;
}

server {
    listen 80;
    server_name crewlyai.com www.crewlyai.com;

    access_log /var/log/nginx/crewlyai-web-access.log;
    error_log  /var/log/nginx/crewlyai-web-error.log error;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        gzip on;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $http_host;
        proxy_pass http://crewlyai_web;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**Step 3: 301 Redirect** (Sam)
- Update `ce-core/do-provision/nginx-configs/crewly-stevesprompt.conf`:
```nginx
server {
    listen 80;
    server_name crewly.stevesprompt.com;
    return 301 https://crewlyai.com$request_uri;
}
```

**Step 4: Deploy** (Sam)
```bash
sh masterScript.sh CELB2 update-nginx crewlyai
sh masterScript.sh CELB2 update-nginx crewly-stevesprompt

# After website code is updated:
docker build --platform linux/amd64 -f apps/crewly/Dockerfile \
  -t dr.careerengine.dev/crewly-web:1.0.16 .
docker push dr.careerengine.dev/crewly-web:1.0.16

# Update docker-compose.yml → crewly-web image: 1.0.16
sh masterScript.sh CEAppNode1 restart crewly-web
sh masterScript.sh CEAppNode2 restart crewly-web
```

**Step 5: Verify**
- `curl -I https://crewlyai.com` → 200
- `curl -I https://crewly.stevesprompt.com` → 301 to crewlyai.com
- `curl -I https://www.crewlyai.com` → 301 to crewlyai.com (or 200 if we serve both)
- All pages render correctly
- OpenGraph previews show correct URLs (test with Twitter card validator)

---

## 4. Book a Call Integration

### 4.1 Tool Recommendation: Calendly

**Why Calendly:**
- Free tier supports 1 event type (sufficient for initial launch)
- Embeddable inline widget or popup
- Google Calendar / Outlook sync
- Automatic timezone detection
- Confirmation + reminder emails built-in
- Custom questions support (for qualification form)
- Widely recognized and trusted by B2B buyers

**Alternative considered:** Cal.com (open source, self-hostable). Good option if Steve wants full control later, but Calendly is faster to set up now.

**Recommendation:** Start with Calendly Free. Upgrade to Calendly Standard ($10/mo) if needed for custom branding and multiple event types.

### 4.2 Calendly Setup

1. Create Calendly account for Steve (or use existing)
2. Create event type: "Crewly AI Team — Discovery Call"
   - Duration: 30 minutes
   - Availability: Steve's calendar (linked via Google/Outlook)
   - Location: Google Meet or Zoom
   - Buffer: 15 min before/after

### 4.3 Qualification Form (Calendly Custom Questions)

When a visitor clicks "Book a Call", they see these questions **before** selecting a time slot:

| Field | Type | Required | Options |
|-------|------|----------|---------|
| Company/Business Name | Text | Yes | — |
| Industry | Dropdown | Yes | Education, E-commerce, Professional Services, Content & Media, Other |
| What 1-2 problems do you want to solve with AI? | Textarea | Yes | — |
| Current team size | Dropdown | Yes | Just me, 2-5, 6-20, 20+ |
| Budget range | Dropdown | Yes | Under $500/mo, $500-$1,000/mo, $1,000-$3,000/mo, $3,000+/mo, Not sure yet |
| How did you hear about Crewly? | Dropdown | No | Google, Twitter/X, YouTube, LinkedIn, GitHub, Referral, Other |

### 4.4 Embed Implementation

**Option A: Inline Embed (Recommended for /enterprise)**

```tsx
// src/components/Enterprise/BookingEmbed.tsx

'use client';

import { useEffect } from 'react';

interface BookingEmbedProps {
  calendlyUrl: string; // e.g., 'https://calendly.com/steve-crewly/discovery-call'
}

export function BookingEmbed({ calendlyUrl }: BookingEmbedProps) {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  return (
    <div
      className="calendly-inline-widget"
      data-url={calendlyUrl}
      style={{ minWidth: '320px', height: '700px' }}
    />
  );
}
```

**Option B: Popup Widget (For nav CTA button)**

```tsx
// In Header.tsx or wherever CTA button appears

<a
  href="https://calendly.com/steve-crewly/discovery-call"
  target="_blank"
  rel="noopener noreferrer"
  className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
>
  Book a Call
</a>
```

**Recommendation:** Use inline embed on /enterprise page (the full conversion page), and simple link/popup for all other Book a Call buttons.

### 4.5 Constants Addition

```typescript
// Add to constants.ts
export const BOOKING_URL = 'https://calendly.com/steve-crewly/discovery-call';
// Steve to replace with actual Calendly URL after setup
```

---

## 5. P0/P1/P2 Timeline

### P0 — This Week (Days 1-5)

**Goal:** Homepage becomes B2B conversion page. New core pages live. Navigation unified.

| # | Task | Owner | Est. | Day |
|---|------|-------|------|-----|
| P0-1 | Steve: Set up Calendly account + event type with qualification questions | Steve | 30 min | Day 1 |
| P0-2 | Steve: Add crewlyai.com to Cloudflare, configure DNS A records | Steve | 30 min | Day 1 |
| P0-3 | Mia: Finalize all page copy in this document (review with Steve) | Mia | 2 hr | Day 1 |
| P0-4 | Sam: Create nginx config for crewlyai.com + 301 redirect for old domain | Sam | 30 min | Day 1 |
| P0-5 | Sam: Deploy nginx configs to CELB2 | Sam | 15 min | Day 1 |
| P0-6 | Sam: Update constants.ts (SITE_URL, NAV_LINKS, BOOKING_URL, SITE_DESCRIPTION) | Sam | 30 min | Day 2 |
| P0-7 | Sam: Rewrite homepage — Hero, WhatWeDo, CasePreview, HowItWorks, Vision, CTA | Sam | 6 hr | Day 2-3 |
| P0-8 | Sam: Build /enterprise page (all 7 sections + Calendly embed) | Sam | 4 hr | Day 3 |
| P0-9 | Sam: Build /community page (all 6 sections) | Sam | 3 hr | Day 3-4 |
| P0-10 | Sam: Build /case page (STEAM Fun case study, all 6 sections) | Sam | 3 hr | Day 4 |
| P0-11 | Sam: Redesign Header.tsx — new nav links, Book a Call CTA, mobile hamburger | Sam | 2 hr | Day 4 |
| P0-12 | Sam: Redesign Footer.tsx — 3-column layout with social links | Sam | 1 hr | Day 4 |
| P0-13 | Sam: Update layout.tsx metadata (title, description, OG, JSON-LD) | Sam | 1 hr | Day 4 |
| P0-14 | Sam: Delete deprecated pages/components (Runtimes, SocialProof, DemoPlayer, /download) | Sam | 30 min | Day 5 |
| P0-15 | Sam: Build Docker image v1.0.16, push, deploy to both nodes | Sam | 30 min | Day 5 |
| P0-16 | Sam + Mia: Verify all pages, links, mobile responsiveness, redirects, SEO | Sam+Mia | 1 hr | Day 5 |

**P0 Total:** ~1 hr Steve, ~2 hr Mia, ~22 hr Sam (~3 full dev days)

**P0 Milestone:** crewlyai.com live with new homepage, /enterprise, /community, /case, updated nav. Book a Call is primary CTA everywhere.

---

### P1 — Next Week (Days 6-10)

**Goal:** Docs updated. Community content fleshed out. STEAM Fun case study polished.

| # | Task | Owner | Est. | Day |
|---|------|-------|------|-----|
| P1-1 | Sam: Update /docs page — add Quick Start with install tabs (absorb /download) | Sam | 2 hr | Day 6 |
| P1-2 | Sam: Update all URL references from crewly.stevesprompt.com → crewlyai.com | Sam | 1 hr | Day 6 |
| P1-3 | Mia: Write STEAM Fun case study detail (interview Nick for specifics, get approval) | Mia | 4 hr | Day 6-7 |
| P1-4 | Sam: Polish case study page with real content from Mia | Sam | 2 hr | Day 7 |
| P1-5 | Mia: Write 2-3 tutorial blog posts for Community page links | Mia | 4 hr | Day 7-8 |
| P1-6 | Sam: Add category filter badges to /blog (All, Case Studies, Tutorials, Behind the Scenes) | Sam | 2 hr | Day 8 |
| P1-7 | Sam: Mobile responsive polish pass on all new pages | Sam | 2 hr | Day 9 |
| P1-8 | Mia: Submit new sitemap to Google Search Console | Mia | 30 min | Day 9 |
| P1-9 | Sam: Build + deploy v1.0.17 with all P1 changes | Sam | 30 min | Day 10 |
| P1-10 | Mia: QA pass — all pages, forms, links, CTA tracking | Mia | 1 hr | Day 10 |

**P1 Total:** ~9.5 hr Mia, ~10 hr Sam

**P1 Milestone:** Complete, polished website with real case study content. Docs absorb download page. Blog has category filters.

---

### P2 — Following Weeks

**Goal:** Add depth. More case studies. Pro Support Pack. Pre-research AI Sales Agent.

| # | Task | Owner | Est. | Priority |
|---|------|-------|------|----------|
| P2-1 | Add 2nd case study (e-commerce or content client) | Mia | 4 hr | After new client engaged |
| P2-2 | Add 3rd case study | Mia | 4 hr | After 3rd client |
| P2-3 | Design and launch Pro Support Pack offering on /community | Mia+Sam | 6 hr | When demand warrants |
| P2-4 | Add Stripe integration for Pro Support Pack payment | Sam | 4 hr | After P2-3 |
| P2-5 | Pre-research AI Sales Agent for pre-qualification | Mia | 4 hr | After 10+ leads |
| P2-6 | Add testimonial quotes to homepage and /enterprise (from real clients) | Mia | 2 hr | After STEAM Fun go-live |
| P2-7 | Add dashboard screenshots/video to /enterprise and homepage | Sam+Mia | 3 hr | When demo assets ready |
| P2-8 | SEO optimization pass — blog posts targeting "AI operations team" keywords | Mia | 4 hr | Ongoing |
| P2-9 | Set up email capture (newsletter) on blog and homepage | Sam | 3 hr | When content cadence established |

---

## Appendix A: Success Metrics

From strategy Section 14:

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Weekly Book a Call count | 3+ per week | Calendly dashboard |
| Qualified lead rate | >50% of bookings | Manual tracking by Steve |
| Deals closed per month | 1+ | Manual tracking |
| Average deal size | $500+ setup, $200+/mo | Manual tracking |

**Analytics to set up:**
- Google Analytics event: `book_a_call_click` on every Book a Call button
- Google Analytics goal: `/enterprise` page visit → Calendly click
- Calendly webhook (optional): notification on new booking

---

## Appendix B: Content Style Guide (Quick Reference)

**Do use:**
- "AI team" / "AI operations team"
- "We build..." / "We design and deploy..."
- "Self-driving AI team" (capability claim)
- "AI Team OS" (vision/future, not current product name)
- Business outcomes: "reduce manual work", "scale operations", "automate workflows"

**Don't use:**
- ~~"Orchestrate AI Coding Agents"~~
- ~~"Multi-runtime support"~~
- ~~Specific model names~~ (Claude, Gemini, Codex — only in /docs)
- ~~SaaS language~~ ("plans", "tiers", "seats", "upgrade")
- ~~Technical jargon in hero/enterprise~~ ("PTY", "terminal streaming", "MCP protocol")

**Tone:** Professional but approachable. Confident but honest. Show results, not just features. Speak to business owners, not developers (except on /docs and /community).

---

## Appendix C: JSON-LD Structured Data Updates

Replace existing schema with B2B-focused structured data:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "name": "Crewly",
      "url": "https://crewlyai.com",
      "description": "We build AI teams that run your operations. Custom AI agent teams for content, ops, communication, and workflow automation.",
      "sameAs": [
        "https://github.com/stevehuang0115/crewly",
        "https://x.com/stevesprompt",
        "https://youtube.com/@stevesprompt"
      ]
    },
    {
      "@type": "WebSite",
      "name": "Crewly — AI Team Operating System",
      "url": "https://crewlyai.com"
    },
    {
      "@type": "Service",
      "name": "Custom AI Operations Team",
      "provider": {
        "@type": "Organization",
        "name": "Crewly"
      },
      "description": "We design, deploy, and manage AI agent teams tailored to your business operations.",
      "areaServed": "Worldwide",
      "serviceType": "AI Operations Consulting"
    }
  ]
}
```
