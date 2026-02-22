# Crewly User Acquisition Plan

**OKR:** O2-KR1 PMF Validation - User Acquisition
**Owner:** Product (Mia)
**Date:** 2026-02-21
**Status:** Draft v1

---

## 1. Current State Assessment

### Product Readiness

| Asset | Status | Notes |
|-------|--------|-------|
| **npm package** | Published (v1.0.4, 5 versions) | `npm install -g crewly` works |
| **GitHub repo** | Public, 61 stars, 13 forks | github.com/stevehuang0115/crewly |
| **Website** | crewly.stevesprompt.com | Subdomain, not ideal for discoverability |
| **License** | MIT | Open source, no barrier |
| **Documentation** | README only | No dedicated docs site |
| **Demo/Video** | None | Critical gap |
| **Getting Started guide** | Basic (README Quick Start) | Needs expansion |
| **Blog** | Marketing site has /blog | Content pipeline needed |

### Competitive Landscape (Feb 2026)

The multi-agent AI orchestration space is exploding (Gartner reports 1,445% surge in multi-agent system inquiries Q1 2024 - Q2 2025). Key competitors:

| Competitor | Stars | Model | Differentiator |
|------------|-------|-------|----------------|
| **CrewAI** | ~60K | Python framework, hosted platform (AMP) | Code-first, large community, venture-backed |
| **Claude-Flow** | ~5K | Claude-native orchestration | MCP protocol, swarm intelligence |
| **Intent (Augment Code)** | N/A | Commercial product | Shared workspace + living specs |
| **OpenClaw** | 145K+ | Personal AI assistant | Viral growth, ClawHub skill marketplace |
| **VS Code Multi-Agent** | N/A | Built into VS Code | Microsoft distribution advantage |

**Crewly's unique positioning:** The only tool that orchestrates _existing_ AI coding CLIs (Claude Code, Gemini CLI, Codex) as a team with a real-time web dashboard. No framework lock-in, no Python required, no SDK to learn. Just `npx crewly start`.

---

## 2. Target User Personas

### Persona 1: Solo Developer Power User (Primary)

- **Who:** Individual developer using Claude Code or Gemini CLI daily
- **Pain:** Manually managing one agent at a time; can't parallelize work across agents
- **Desire:** Run multiple agents simultaneously on different tasks, see all progress in one place
- **Where they hang out:** Hacker News, Reddit (r/LocalLLaMA, r/ClaudeAI, r/singularity), Twitter/X, Discord (Anthropic, AI coding communities)
- **Trigger:** "I wish I could have Claude do the frontend while Gemini handles the tests"
- **Key message:** "Your AI coding agents, working as a team"

### Persona 2: Tech Lead / Engineering Manager

- **Who:** Manages a dev team, exploring AI agent adoption
- **Pain:** No visibility into what AI agents are doing; hard to coordinate agent work across team members
- **Desire:** Dashboard to monitor AI agent activity; structured team coordination
- **Where they hang out:** Hacker News, LinkedIn, engineering blogs, CTO/VP Eng communities
- **Trigger:** "How do I scale AI agent usage across my team?"
- **Key message:** "Monitor and orchestrate your AI dev team from a single dashboard"

### Persona 3: AI/LLM Tinkerer

- **Who:** Early adopter who experiments with every new AI tool, builds custom workflows
- **Pain:** Each agent tool is siloed; wants to combine runtimes
- **Desire:** Mix Claude Code + Gemini CLI + Codex on the same project, customize agent skills
- **Where they hang out:** r/LocalLLaMA, AI Discord servers, GitHub trending, Product Hunt
- **Trigger:** "Can I run Claude and Gemini on the same codebase simultaneously?"
- **Key message:** "Runtime-agnostic agent orchestration. Use any combination of Claude, Gemini, and Codex."

### Persona 4: Agency / Freelance Developer

- **Who:** Builds software for clients, juggles multiple projects
- **Pain:** Needs to parallelize work across codebases efficiently
- **Desire:** Assign AI agents to different client projects, track progress across all
- **Where they hang out:** Indie Hackers, Twitter/X, freelancer communities
- **Trigger:** "I need to ship 3 client projects this week"
- **Key message:** "Your AI dev agency in a box"

---

## 3. Acquisition Channels & Action Plan

### Channel 1: Hacker News (Show HN)

**Priority:** P0 - Highest impact for developer tools
**Timeline:** Week 2 (after prep materials are ready)
**Goal:** 100+ upvotes, front page

**Preparation (Week 1):**
- [ ] Polish README with GIF/screenshot of the dashboard
- [ ] Record a 2-minute demo video (terminal -> dashboard -> agents working)
- [ ] Ensure `npx crewly start` works flawlessly on macOS and Linux
- [ ] Test the full onboarding flow on a fresh machine
- [ ] Prepare answers for expected questions (vs CrewAI, security, pricing, roadmap)

**Post Day:**
- [ ] Post "Show HN" between 8-10am ET on a Tuesday or Wednesday
- [ ] Have 2-3 people ready to answer comments within first hour
- [ ] Title + body drafted in `docs/show-hn-draft.md`

**Follow-up:**
- [ ] Respond to every comment thoughtfully
- [ ] Create GitHub issues for feature requests mentioned in comments
- [ ] Write a follow-up post if it gets significant traction

### Channel 2: Reddit

**Priority:** P0
**Timeline:** Week 2-3 (stagger with HN by 2-3 days)
**Goal:** 500+ total reach across subreddits

**Target subreddits:**

| Subreddit | Subscriber Count | Post Type | Timing |
|-----------|-----------------|-----------|--------|
| r/ClaudeAI | ~100K+ | Tool showcase | Day 1 |
| r/LocalLLaMA | ~500K+ | Tool announcement | Day 2 |
| r/singularity | ~2M+ | Tool share | Day 3 |
| r/MachineLearning | ~3M+ | [P] Project post | Day 5 |
| r/ChatGPTPro | ~200K+ | Cross-post | Day 5 |

**Post strategy per subreddit:**
- r/ClaudeAI: Focus on Claude Code multi-agent angle. "I built a tool to run multiple Claude Code agents as a team"
- r/LocalLLaMA: Emphasize runtime flexibility. "Orchestrate Claude Code + Gemini CLI + Codex in one dashboard"
- r/singularity: Vision angle. "Multi-agent AI dev teams are here"

**Rules:**
- Authentic, personal tone ("I built this because...")
- No marketing speak
- Include screenshots/GIFs inline
- Respond to every comment for 48 hours

### Channel 3: Twitter/X

**Priority:** P1
**Timeline:** Ongoing, starting Week 1
**Goal:** 1,000 impressions per post, 50 followers in first month

**Content cadence (3x/week):**

| Day | Content Type | Example |
|-----|-------------|---------|
| Monday | Demo clip (30s) | Screen recording of agents collaborating |
| Wednesday | Technical insight | "How Crewly coordinates PTY sessions across agents" |
| Friday | Meme / relatable | "When your 3 AI agents all edit the same file..." |

**Key accounts to engage:**
- @AnthropicAI, @ClaudeCode (tag when relevant)
- @GoogleDeepMind (Gemini CLI)
- AI developer influencers who post about coding agents
- Indie hackers building with AI

**Thread strategy:**
- Launch thread: "I built a platform to orchestrate AI coding agents as a team. Here's why:"
- Technical deep-dive threads on architecture
- "Day X of building with AI agent teams" series

### Channel 4: Developer Communities & Discord

**Priority:** P1
**Timeline:** Week 2+
**Goal:** 50 active community members in first month

**Target communities:**

| Community | Action | Notes |
|-----------|--------|-------|
| Anthropic Discord | Share in #projects or #tools channel | Core audience |
| Claude Code users | Direct outreach in relevant channels | Primary runtime |
| AI Engineer Discord | Tool showcase | AI-focused devs |
| Indie Hackers | Product launch post | Builder audience |
| Dev.to | Tutorial article | SEO + discovery |

**Own community:**
- Create a Crewly Discord server (or GitHub Discussions) before launch
- Link from README, website, and all posts
- Seed with 5-10 active members before public launch

### Channel 5: GitHub Ecosystem

**Priority:** P0
**Timeline:** Week 1 (pre-launch)
**Goal:** 500 stars within first month

**Actions:**
- [ ] Add GitHub topics/tags: `ai-agents`, `multi-agent`, `claude-code`, `orchestration`, `developer-tools`
- [ ] Create a proper `.github/` folder with CONTRIBUTING.md, issue templates, PR template
- [ ] Submit to awesome-lists: `awesome-ai-agents`, `awesome-mcp`, `awesome-claude-code`
- [ ] Create GitHub Discussions (enable on repo)
- [ ] Add "good first issue" labels to 5-10 easy issues
- [ ] Add social preview image (Open Graph) for repo
- [ ] Create Releases on GitHub (currently 0 releases)

### Channel 6: Product Hunt

**Priority:** P2
**Timeline:** Week 4-5
**Goal:** Top 5 Product of the Day

**Preparation:**
- [ ] Create Product Hunt maker profile
- [ ] Prepare 5 screenshots + 1 demo video
- [ ] Write tagline and description
- [ ] Line up 10+ early supporters to upvote and review
- [ ] Schedule for a Tuesday/Wednesday launch

### Channel 7: Content Marketing & SEO

**Priority:** P1
**Timeline:** Ongoing from Week 2
**Goal:** 5 indexed articles in first month

**Article ideas:**

| Article | Platform | SEO Target |
|---------|----------|------------|
| "How to Run Multiple Claude Code Agents as a Team" | Dev.to + Blog | Long-tail search |
| "Crewly vs CrewAI: When to Use Each" | Blog | Comparison search |
| "Building AI Dev Teams That Actually Work" | Medium | Thought leadership |
| "Getting Started with Multi-Agent Coding in 5 Minutes" | Dev.to + Blog | Tutorial search |
| "Why We Built Crewly" | Blog | Origin story / brand |

---

## 4. Materials to Prepare (Pre-Launch Checklist)

### Must-Have (P0) - Complete Before Any Public Launch

| Material | Status | Owner | Deadline |
|----------|--------|-------|----------|
| **Demo video (2 min)** | Not started | Engineering | Week 1 |
| **Dashboard screenshots (3-5)** | Not started | Engineering | Week 1 |
| **README with GIF** | Not started | Engineering | Week 1 |
| **Landing page optimization** | Partial (SEO doc exists) | Engineering | Week 1 |
| **`npx crewly start` smoke test on clean machine** | Not tested | Engineering | Week 1 |
| **GitHub releases + changelog** | 0 releases | Engineering | Week 1 |
| **GitHub topics/tags added** | Not done | Engineering | Week 1 |
| **Show HN draft** | See `docs/show-hn-draft.md` | Product | Week 1 |
| **Social preview / OG image** | Not done | Design | Week 1 |

### Should-Have (P1) - Complete in First 2 Weeks

| Material | Status | Owner | Deadline |
|----------|--------|-------|----------|
| **Getting Started docs page** | README only | Engineering | Week 2 |
| **Discord / community channel** | Not created | Product | Week 2 |
| **Blog post: "Why We Built Crewly"** | Not started | Product | Week 2 |
| **Dev.to tutorial article** | Not started | Product | Week 2 |
| **CONTRIBUTING.md + issue templates** | Not done | Engineering | Week 2 |

### Nice-to-Have (P2) - Complete in First Month

| Material | Status | Owner | Deadline |
|----------|--------|-------|----------|
| **Product Hunt listing** | Not started | Product | Week 4 |
| **YouTube deep-dive video** | Not started | Product | Week 3 |
| **Comparison blog (vs CrewAI)** | Not started | Product | Week 3 |
| **Dedicated domain (crewly.dev)** | Not secured | Engineering | Week 3 |

---

## 5. Timeline

```
Week 1 (Prep)
├── Polish README, add GIF/screenshots
├── Record 2-min demo video
├── Smoke-test installation on clean machines (macOS, Linux)
├── Create GitHub release v1.0.4
├── Add GitHub topics and social preview
├── Finalize Show HN draft
├── Set up community channel (Discord or GH Discussions)
└── Prepare FAQ document for expected questions

Week 2 (Launch)
├── DAY 1 (Tue/Wed): Post Show HN
├── DAY 1: Post r/ClaudeAI
├── DAY 2: Post r/LocalLLaMA
├── DAY 3: Post r/singularity
├── DAY 1-7: Active comment engagement on all platforms
├── Publish launch thread on Twitter/X
└── Share in Anthropic Discord + AI dev communities

Week 3 (Amplify)
├── Publish Dev.to tutorial
├── Publish "Why We Built Crewly" blog post
├── Submit to awesome-lists (awesome-ai-agents, awesome-mcp)
├── Engage with anyone who tweeted about Crewly
├── Create "good first issue" labels for contributors
└── Follow up on HN/Reddit with progress updates

Week 4 (Expand)
├── Product Hunt launch
├── LinkedIn posts targeting tech leads
├── YouTube walkthrough video
├── Comparison article (Crewly vs CrewAI)
└── Assess metrics and adjust strategy

Ongoing (Month 2+)
├── 3x/week Twitter content
├── Monthly blog posts
├── Community engagement (Discord, GH Discussions)
├── Contributor onboarding
└── Feature announcements tied to user feedback
```

---

## 6. Success Metrics

### Primary KPIs (30-day targets)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **GitHub stars** | 500 | GitHub API |
| **npm weekly downloads** | 200 | npm stats |
| **Active users (started Crewly at least once)** | 50 | Telemetry (if implemented) or proxy via npm downloads |
| **Community members** | 50 (Discord/GH Discussions) | Community platform |
| **Show HN upvotes** | 100+ | Hacker News |

### Secondary KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| **GitHub forks** | 50 | GitHub |
| **GitHub issues (organic)** | 20 | GitHub |
| **External PRs** | 5 | GitHub |
| **Blog post views** | 2,000 total | Dev.to + blog analytics |
| **Twitter impressions** | 10,000 total | Twitter analytics |

### PMF Validation Signals

These signals indicate product-market fit is emerging:

- Organic GitHub stars growing without promotion (>5/day sustained)
- Users filing feature requests (not just bugs)
- External contributors submitting PRs
- Users sharing Crewly unprompted on social media
- Repeat usage (users coming back after first try)
- Questions about enterprise/team features

---

## 7. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| **Installation friction** (node-pty compile issues) | High | Medium | Pre-launch smoke test on all platforms; FAQ for common issues |
| **"Why not just use CrewAI?"** pushback | Medium | High | Prepare crisp differentiator: "Crewly works with CLIs you already use, no framework required" |
| **Low HN engagement** | Medium | Medium | Invest in demo quality; have a compelling personal story; post at optimal time |
| **Name confusion with crewly.com** | Low | Medium | Secure crewly.dev domain; use "Crewly AI" in all contexts |
| **Website 403 errors** | High | Current | Fix crewly.stevesprompt.com before launch or redirect to GitHub |
| **No demo video** | High | Current | Record before any public launch; agents working in real-time is the killer visual |

---

## 8. Key Differentiators to Emphasize in All Communications

1. **Runtime-agnostic** - Claude Code, Gemini CLI, Codex. Mix and match on the same team.
2. **Zero framework lock-in** - No Python SDK, no custom agents to build. Uses existing CLIs.
3. **Real-time web dashboard** - Watch agents work live in split terminal views.
4. **Runs locally** - Your code never leaves your machine. No cloud dependency.
5. **Two-command setup** - `npm install -g crewly && npx crewly start`. That's it.
6. **Skill system** - Agents communicate through bash skills, fully customizable.
7. **Open source (MIT)** - Fork it, extend it, contribute back.

---

## Appendix: Competitive Positioning One-Liner

> **Crewly is an open-source platform that orchestrates your existing AI coding CLIs (Claude Code, Gemini CLI, Codex) as a coordinated team with a real-time web dashboard. No framework to learn, no SDK to integrate, no cloud required.**

This differentiates from:
- **CrewAI** (Python framework, requires writing agent code)
- **Claude-Flow** (Claude-only, no web dashboard)
- **Intent/Augment** (commercial, closed-source)
- **VS Code multi-agent** (IDE-locked, Microsoft ecosystem)
- **OpenClaw** (personal assistant, not dev team orchestration)
