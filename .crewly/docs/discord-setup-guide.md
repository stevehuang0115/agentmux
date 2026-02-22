---
title: "Discord Community Setup Guide"
category: "Community"
tags: ["discord", "community", "phase-2", "launch"]
author: "Mia (Product Manager)"
version: "1.0"
date: "2026-02-21"
status: "Ready for implementation"
---

# Discord Community Setup Guide

## Server Identity

| Field | Value |
|-------|-------|
| **Server Name** | Crewly |
| **Description** | Open-source multi-agent orchestration for AI coding teams. Get help, share what you've built, and shape the roadmap. |
| **Icon** | Crewly logo (the terminal-style icon from the website). If not available, use a simple "Cr" monogram in a rounded square with the brand color (#3B82F6 blue). |
| **Banner** | Dashboard screenshot showing agents working with terminal streams visible. |
| **Invite Link** | `discord.gg/crewly` (vanity URL -- apply after 50 members) |

---

## Channel Structure

### Category: INFO

| Channel | Type | Purpose | Permissions |
|---------|------|---------|-------------|
| **#welcome** | Text | Auto-greeting with quickstart links. First thing new members see. | Read-only for members |
| **#announcements** | Text | Releases, major features, blog posts, events. | Read-only for members, post by admins only |
| **#rules** | Text | Code of conduct and server rules. | Read-only for members |

### Category: COMMUNITY

| Channel | Type | Purpose | Permissions |
|---------|------|---------|-------------|
| **#general** | Text | General discussion about Crewly, AI agents, multi-agent workflows. | Open |
| **#help** | Forum | Installation issues, usage questions, troubleshooting. Forum format so threads stay organized. | Open |
| **#showcase** | Text | Share what you've built with Crewly. Screenshots, workflows, team configs. | Open |
| **#feature-requests** | Forum | Propose and discuss new features. Forum format for voting/discussion on each idea. | Open |

### Category: DEVELOPMENT

| Channel | Type | Purpose | Permissions |
|---------|------|---------|-------------|
| **#contributing** | Text | For contributors: PR discussion, development setup, architecture questions. | Open |
| **#github-feed** | Text | Automated feed of GitHub activity (releases, notable PRs, issues). | Read-only, bot posts |
| **#roadmap** | Text | Current roadmap discussion and priority feedback. | Open |

---

## Welcome Message

Post in #welcome, pinned:

```markdown
**Welcome to the Crewly community!** 👋

Crewly is an open-source platform that coordinates AI coding agents (Claude Code, Gemini CLI, Codex) to work as a team. A web dashboard lets you watch them collaborate in real time.

**Get started in 60 seconds:**
```
npm install -g crewly
crewly onboard
crewly start
```

**Useful links:**
- GitHub: https://github.com/stevehuang0115/crewly
- Getting Started Guide: [link]
- API Reference: [link]
- Blog: [link]

**Where to go:**
- Need help? → #help
- Want to show off? → #showcase
- Have an idea? → #feature-requests
- Want to contribute? → #contributing

**Rules:** Be respectful, stay on topic, no spam. Full details in #rules.
```

---

## Rules (#rules)

Post in #rules, pinned:

```markdown
**Server Rules**

1. **Be respectful.** Treat everyone with courtesy. No harassment, discrimination, or personal attacks.

2. **Stay on topic.** This server is about Crewly and AI agent workflows. Off-topic chat is fine in #general but keep it reasonable.

3. **No spam or self-promotion.** Sharing relevant tools or projects in context is fine. Posting ads or unsolicited links is not.

4. **Search before asking.** Check #help threads and GitHub Issues before posting a new question. Your problem may already be solved.

5. **Use the right channel.** Bug reports go to GitHub Issues. Feature ideas go to #feature-requests. Usage questions go to #help.

6. **No piracy or abuse.** Don't share API keys, circumvention methods, or anything that violates provider terms of service.

7. **English only.** To keep the community accessible to all maintainers and members.

Violations: First offense = warning. Repeated = mute or ban at moderator discretion.

Based on the Contributor Covenant Code of Conduct. Full text: https://github.com/stevehuang0115/crewly/blob/main/CODE_OF_CONDUCT.md
```

---

## Bot Setup

### 1. GitHub Bot (notifications)

**Recommended:** [GitHub Bot](https://discord.com/application-directory/1268553929898614784) or webhook-based approach.

**Setup:**
- Create a webhook for #github-feed channel
- In GitHub repo settings > Webhooks, add Discord webhook URL with `/github` suffix
- Events to subscribe: Releases, Issues (opened), Pull Requests (opened, merged), Stars milestones

**Alternative:** Use `/github subscribe stevehuang0115/crewly` with the official GitHub bot.

### 2. Welcome Bot

**Recommended:** Discord's built-in Community Welcome Screen or MEE6 (free tier).

**Config:**
- Welcome DM disabled (use channel greeting instead)
- Auto-assign "Member" role on join
- Welcome screen points to: #welcome, #help, #showcase

### 3. Moderation

**Recommended:** Discord AutoMod (built-in).

**Rules:**
- Block commonly flagged words
- Block excessive mentions (5+ in one message)
- Block excessive caps (70%+ caps in messages over 10 chars)
- Timeout for spam detection (3+ identical messages in 10 seconds)

---

## Role Structure

| Role | Color | Permissions | Who Gets It |
|------|-------|-------------|-------------|
| **Admin** | Red (#EF4444) | Full admin | Steve, core team |
| **Maintainer** | Orange (#F97316) | Manage messages, threads, pins | Active contributors with merge access |
| **Contributor** | Green (#22C55E) | Highlighted in member list | Anyone with a merged PR |
| **Member** | Default | Standard read/write | Everyone on join |

---

## Server Settings

| Setting | Value |
|---------|-------|
| Verification Level | Medium (must have verified email + be on Discord 5+ min) |
| Explicit Content Filter | Scan messages from all members |
| Default Notification | Only @mentions |
| Community Features | Enable (required for Forum channels and Welcome Screen) |
| Discovery | Enable after 500 members |

---

## First-Week Engagement Plan

### Day 0 (Launch Day — Tuesday)

| Time | Action | Channel |
|------|--------|---------|
| 9:00 AM | Post in #announcements: "Crewly is live! We just posted on HN/PH. Link + summary." | #announcements |
| 9:15 AM | Pin welcome message in #welcome | #welcome |
| 10:00 AM | Start a thread in #general: "What would you build with Crewly? Tell us your dream AI team setup." | #general |
| All day | Monitor #help for install issues. Respond within 30 min. | #help |
| All day | Share notable HN/Reddit comments in #general for discussion | #general |

### Day 1 (Wednesday)

| Time | Action | Channel |
|------|--------|---------|
| Morning | Post first showcase: our own example project (todo app with web-dev team) with screenshot | #showcase |
| Afternoon | Create 2-3 feature request threads based on launch feedback | #feature-requests |
| Evening | Summarize Day 1 feedback in #announcements | #announcements |

### Day 2 (Thursday)

| Time | Action | Channel |
|------|--------|---------|
| Morning | Post blog cross-link: "Introducing Crewly" blog post | #announcements |
| Afternoon | Start discussion: "What AI runtimes do you use? Claude / Gemini / Codex / other?" | #general |
| Evening | Respond to all open #help threads | #help |

### Day 3-4 (Friday-Saturday)

| Action | Channel |
|--------|---------|
| Share 2nd showcase (research team example) | #showcase |
| Create "good-first-issue" thread in #contributing linking to GitHub | #contributing |
| Post roadmap summary and ask for priority feedback | #roadmap |

### Day 5-7 (Sunday-Tuesday)

| Action | Channel |
|--------|---------|
| Week 1 recap in #announcements (stats: members, stars, downloads, issues) | #announcements |
| First "community spotlight" if someone shares a cool use case | #showcase |
| Plan Week 2 content based on what topics got the most engagement | Internal |

---

## Growth Milestones

| Members | Action |
|---------|--------|
| 20 | Apply for vanity URL (discord.gg/crewly) |
| 50 | Add "Contributor" role ceremony (announce when someone gets their first PR merged) |
| 100 | Recruit first community moderator |
| 200 | Enable Server Discovery |
| 500 | Consider community events (AMAs, office hours) |

---

## Moderation Staffing

| Phase | Moderators | Coverage |
|-------|-----------|----------|
| Launch week | Steve + Mia (PM agent provides suggested responses) | 8am-10pm PT |
| Month 1 | Steve + 1 community mod | Best-effort, aim for <4hr response in #help |
| Month 3+ | Steve + 2-3 community mods | 24hr coverage across time zones |

---

*Document Version: 1.0 | Date: 2026-02-21 | Author: Mia (Product Manager, crewly-core-mia-member-1)*
