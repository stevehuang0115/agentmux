---
title: "Phase 2 Launch Plan — Go-to-Market Strategy"
category: "Strategy"
tags: ["phase-2", "GTM", "launch", "marketing", "community"]
author: "Mia (Product Manager)"
version: "1.0"
date: "2026-02-21"
---

# Phase 2 Launch Plan — Go-to-Market Strategy

> **Phase 2 Goal**: External developers can discover, try, and share Crewly.
>
> **Team**: Mia (PM) + Sam (Dev) + Marketing/Creative member (new hire)
>
> **Estimated Duration**: 4-6 weeks

---

## 1. Pre-Launch Checklist (Week 1-2)

Everything that must be true before going public. Divided into **hard blockers** (launch cannot happen without these) and **strong-to-haves** (significantly improve first impression).

### Hard Blockers

| # | Item | Owner | Est. | Status |
|---|------|-------|------|--------|
| 1 | **LICENSE file** (MIT) at repo root | Sam | 10 min | Missing |
| 2 | **Commit & push** all uncommitted work (17 files) | Sam | 30 min | Pending |
| 3 | **GitHub repo set to public** | Owner | 5 min | Private |
| 4 | **GitHub Actions CI** — build + test on PR | Sam | 1 day | Not started |
| 5 | **npm publish** — ensure `npx crewly onboard` works from clean install | Sam | 2 hrs | Needs verification |
| 6 | **End-to-end smoke test** — fresh machine, `npm i -g crewly` -> `crewly onboard` -> `crewly start` -> agents work | Sam + Mia | 2 hrs | Not done |

### Strong-to-Haves

| # | Item | Owner | Est. | Impact |
|---|------|-------|------|--------|
| 7 | **Demo video** (2 min) — install -> onboard -> start -> dashboard -> agents working | Marketing | 1-2 days | Massive — HN posts with videos get 3x engagement |
| 8 | **`crewly init`** (F1) — project-level scaffolding | Sam | 2-3 days | High — makes quickstart smoother |
| 9 | **Docker Compose** (F8) — `docker compose up` alternative | Sam | 2 days | Medium — some devs prefer Docker |
| 10 | **Docs site on VitePress** (F10) — hosted at crewly.stevesprompt.com/docs | Sam | 2 days | High — credibility signal |

### Nice-to-Haves for Launch

| # | Item | Owner | Est. |
|---|------|-------|------|
| 11 | GIF in README showing dashboard with agents | Marketing | 4 hrs |
| 12 | GitHub issue templates (bug report, feature request) | Sam | 1 hr |
| 13 | GitHub Discussions enabled | Owner | 5 min |
| 14 | `good-first-issue` labels on 5+ issues | Mia | 2 hrs |

---

## 2. Launch Strategy

### Target Channels (Ordered by Priority)

| # | Channel | Timing | Expected Impact | Owner |
|---|---------|--------|----------------|-------|
| 1 | **Hacker News** (Show HN) | Day 1 (Tuesday 9am PT) | 200-500 upvotes if well-received. TypeScript + open-source + AI agent combo is HN gold | Mia |
| 2 | **Product Hunt** | Day 1 or Day 2 | Top 5 Product of the Day target. AI tools category is competitive | Marketing |
| 3 | **Twitter/X** | Day 1 thread + ongoing | Thread showing demo video. Tag AI dev influencers | Marketing |
| 4 | **Reddit** (r/LocalLLaMA, r/ClaudeAI, r/programming) | Day 1-2 | Cross-post with tailored angle per sub | Mia |
| 5 | **LinkedIn** | Day 1 | Professional angle: "building AI teams, not just AI agents" | Owner |
| 6 | **Dev.to / Hashnode** | Week 1 | Longer-form blog post version | Marketing |
| 7 | **YouTube** | Week 1-2 | Full demo walkthrough (5-10 min) | Marketing |

### Show HN Strategy

Draft exists at `docs/show-hn-draft.md`. Key elements:

- **Title**: "Show HN: Crewly -- Orchestrate Claude Code, Gemini CLI, and Codex as a dev team"
- **Angle**: Personal story (tired of managing AI agents one at a time)
- **Differentiator**: Not an SDK -- it's a platform with a live dashboard where you watch agents work
- **Call to action**: `npx crewly onboard` (zero-commitment tryout)
- **Timing**: Tuesday 9am PT (highest HN front page probability per HN analytics)

### Prepared Responses

Must have answers ready for:

| Question | Prepared Answer |
|----------|----------------|
| "How is this different from CrewAI?" | Runtime-agnostic (spawns actual CLI tools), live terminal streaming, TypeScript-native, no vendor lock-in |
| "Why not just use LangGraph?" | Crewly is higher-level: you define teams, not graphs. Dashboard-first, not code-first |
| "Does this work with local models?" | Yes — Ollama via Codex CLI, or any runtime that has a CLI interface |
| "Is this production-ready?" | Alpha — great for dev teams and prototyping, not yet for mission-critical workloads |
| "What about security?" | Local-first, nothing leaves your machine, PTY sessions sandboxed per agent |

---

## 3. Content Calendar

### Pre-Launch (Week 1-2)

| Day | Content | Channel | Owner |
|-----|---------|---------|-------|
| W1 D1 | Demo video recorded | Internal | Marketing |
| W1 D2 | Demo video edited + uploaded | YouTube (unlisted) | Marketing |
| W1 D3 | README GIF created | GitHub | Marketing |
| W1 D4 | Blog post: "Why We Built Crewly" | Blog site | Marketing + Mia |
| W2 D1 | Discord server setup | Discord | Marketing |
| W2 D2 | Social media accounts created (X, LinkedIn) | X, LinkedIn | Marketing |
| W2 D3 | Launch day materials finalized | All | All |

### Launch Week (Week 3)

| Day | Content | Channel | Owner |
|-----|---------|---------|-------|
| Tuesday 9am PT | Show HN post | Hacker News | Mia |
| Tuesday 10am PT | Product Hunt listing | Product Hunt | Marketing |
| Tuesday 11am PT | Twitter/X thread with video | X | Marketing |
| Tuesday | Reddit cross-posts | Reddit (3 subs) | Mia |
| Tuesday | LinkedIn post | LinkedIn | Owner |
| Wednesday | Respond to all HN/Reddit/PH comments | All | Mia + Marketing |
| Thursday | Blog: "Getting Started with Crewly: Your First AI Team in 5 Minutes" | Blog + Dev.to | Marketing |
| Friday | Week 1 metrics review | Internal | Mia |

### Post-Launch (Week 4-6)

| Week | Content | Channel | Owner |
|------|---------|---------|-------|
| W4 | Blog: "How Crewly's Terminal Streaming Works (and Why It Matters)" | Blog | Marketing |
| W4 | YouTube full tutorial (10 min) | YouTube | Marketing |
| W5 | Blog: "Connecting Crewly to Any Tool via MCP" | Blog | Marketing |
| W5 | "How I Built X with Crewly" showcase post | Twitter/X | Marketing |
| W6 | Blog: "Crewly vs CrewAI vs LangGraph: An Honest Comparison" | Blog | Mia |
| W6 | Community call / AMA | Discord | All |

---

## 4. Community Setup

### Discord Server

| Channel | Purpose |
|---------|---------|
| #welcome | Auto-greeting with quickstart link |
| #general | General discussion |
| #help | Installation and usage support |
| #showcase | Users share what they built |
| #feature-requests | Feature ideas and voting |
| #contributing | For contributors and PRs |
| #announcements | Releases and news (read-only) |

**Bots**:
- Welcome bot linking to docs
- GitHub bot for release notifications
- Stargazer milestone bot (100, 200, 500, 1K stars)

**Moderation**: Code of conduct from CONTRIBUTING.md. Start with Mia moderating, add community mods at 100+ members.

### GitHub Community

- **Discussions** enabled (categories: Q&A, Ideas, Show and Tell, General)
- **Issue templates**: Bug report, Feature request, Question
- **Labels**: `good-first-issue` (5+), `help-wanted`, `bug`, `enhancement`, `documentation`
- **CODEOWNERS**: Sam for `/backend`, `/cli`, `/mcp-server`; Mia for `/docs`, `/config/templates`
- **Branch protection**: Require PR reviews, CI pass, no direct push to main

### npm Presence

- Package description updated
- Keywords: `ai-agents`, `multi-agent`, `orchestration`, `claude-code`, `gemini-cli`, `team-coordination`
- Homepage link to docs site
- Repository link to GitHub

---

## 5. Success Metrics

### Week 1 (Launch Week)

| Metric | Target | Stretch |
|--------|--------|---------|
| GitHub stars | 100 | 300 |
| npm weekly downloads | 50 | 200 |
| Discord members | 20 | 50 |
| HN upvotes | 50 | 200 |
| Product Hunt rank | Top 10 | Top 3 |

### Month 1

| Metric | Target | Stretch |
|--------|--------|---------|
| GitHub stars | 300 | 1,000 |
| npm weekly downloads | 200 | 500 |
| Discord members | 50 | 150 |
| External PRs | 3 | 10 |
| Blog post views | 2,000 | 10,000 |

### Month 3 (Phase 2 Exit Trigger)

| Metric | Target |
|--------|--------|
| GitHub stars | 500+ |
| npm weekly downloads | 500+ |
| Discord members | 100+ |
| External contributors | 5+ |
| Blog posts published | 8+ |

---

## 6. Timeline

```
Week 1-2: PRE-LAUNCH
├── Sam: LICENSE, commit, CI, npm verify, crewly init, Docker
├── Marketing: Demo video, blog, Discord, social accounts
└── Mia: Phase 1 assessment, launch materials, issue curation

Week 3: LAUNCH
├── Tuesday: HN + PH + Twitter + Reddit + LinkedIn
├── Wed-Fri: Respond to feedback, fix reported issues
└── Mia: Coordinate responses, triage issues

Week 4-6: POST-LAUNCH
├── Marketing: Weekly blog, YouTube tutorial, community engagement
├── Sam: Bug fixes from user feedback, Docker, docs site
└── Mia: Feature prioritization from user feedback, roadmap update
```

---

## 7. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| HN post gets flagged/buried | Medium | High | Have Reddit/PH as backup channels. Ensure title is factual, not clickbait |
| Critical bug reported on launch day | High | High | Sam on standby all launch day. Hot-fix pipeline via CI. Pre-test on clean machine |
| "Just use CrewAI" pushback | High | Medium | Prepared comparison response emphasizing runtime-agnostic approach and live dashboard |
| npm install fails on some systems | Medium | High | Test on macOS, Ubuntu, Windows (WSL). Document known issues |
| Low engagement / no traction | Medium | High | Iterate on messaging. Try different angles. Consider video-first strategy on YouTube/Twitter |

---

## 8. Resource Requirements

### Team

| Role | Who | Time Commitment |
|------|-----|----------------|
| PM / Strategy | Mia | Full-time during Phase 2 |
| Engineering | Sam | 60% features, 40% bug fixes and infra |
| Marketing / Creative | **New hire needed** | Full-time content + community |

### Tools

| Tool | Purpose | Cost |
|------|---------|------|
| Discord (free) | Community | $0 |
| GitHub (free for public) | Code + Discussions + CI | $0 |
| Product Hunt (free) | Launch | $0 |
| Screen recording tool | Demo video | $0 (OBS) or $10/mo (ScreenStudio) |
| Social media scheduling | Consistent posting | $0 (manual) or $15/mo (Buffer) |
| Analytics | Track adoption | $0 (npm stats, GitHub insights, Plausible) |

**Total additional cost**: $0-25/month. Phase 2 is almost entirely labor, not spend.

---

## 9. Immediate Next Steps

**For user approval — the minimum viable launch path:**

1. Sam: Add LICENSE file (10 min)
2. Sam: Commit all 17 uncommitted files (30 min)
3. Sam: Set up GitHub Actions CI (1 day)
4. Smoke test: Fresh install -> onboard -> start -> agents work (2 hrs)
5. Mia: Curate 5 `good-first-issue` issues (2 hrs)
6. Marketing hire: Record demo video (1-2 days)
7. Set repo to public
8. **Launch on Hacker News**

Total time to minimum launch: **~1 week** with Sam and Marketing working in parallel.

---

*Document Version: 1.0 | Date: 2026-02-21 | Author: Mia (Product Manager, crewly-core-mia-member-1)*
*References: roadmap-v3.md, competitive-gap-matrix.md, phase1-assessment.md, show-hn-draft.md*
