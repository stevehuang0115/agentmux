# Content Generation Studio — Quick Start

## Overview

An AI team that automatically produces SEO-optimized blog posts, social media content, and cover images. The team follows a structured pipeline: research → draft → review → publish.

**Target Users**: Content agencies, solo creators, marketing teams
**Team Size**: 3 agents (Content Strategist + Writer + Editor)

## Prerequisites

- Crewly installed and running (`npx crewly start`)
- Gemini API key configured (required for `nano-banana-image` skill)

## Quick Start

```bash
# 1. Create the team from template
npx crewly create-team --template content-generation-team

# 2. Start the team
npx crewly start
```

## Required Skills

| Skill | Purpose | Config Required |
|-------|---------|----------------|
| `seo-blog-writer` | Generate SEO-optimized blog structures | None |
| `social-media-post` | Create platform-optimized social posts (X, LinkedIn, Reddit) | None |
| `nano-banana-image` | Generate cover images and visuals | `GEMINI_API_KEY` |
| `feedback-analyzer` | Analyze audience feedback for content improvement | None |

## Optional Skills

| Skill | Purpose |
|-------|---------|
| `send-pdf-to-slack` | Share formatted content reports via Slack |
| `daily-standup-report` | Daily team activity summary |

## Workflow

```
Content Strategist          Writer              Editor
      │                       │                   │
      ├─ Research topics       │                   │
      ├─ Keyword analysis      │                   │
      ├─ Create content brief  │                   │
      │         │              │                   │
      │         └──────────────▶                   │
      │                        ├─ Write blog post  │
      │                        ├─ Create social    │
      │                        │   posts           │
      │                        ├─ Generate images  │
      │                        │         │         │
      │                        │         └─────────▶
      │                        │                   ├─ Review quality
      │                        │                   ├─ Check SEO
      │                        │                   ├─ Verify accuracy
      │                        │                   │
      │                        │◀── Approved ──────┤
      │                        │  or revisions     │
      │                        ├─ Publish content  │
      │                        └───────────────────┘
```

## Expected Output Examples

### Blog Post (from Writer)
```markdown
# 10 Ways AI Is Transforming Small Business Operations in 2026

*Meta: Discover how AI automation is helping SMBs reduce costs by 40%...*

## Introduction
...

## 1. Automated Customer Support
...

## Conclusion
...

**Keywords**: AI small business, AI automation, SMB operations
**Word count**: ~1,500
**Reading time**: 7 min
```

### Social Media Posts (from Writer)
```
[X/Twitter]
AI is quietly transforming how small businesses operate.

We analyzed 10 real use cases where SMBs cut costs by 40%+ using AI teams.

The surprising part? Most started in under a week.

Thread 🧵👇

---

[LinkedIn]
I've been watching a quiet revolution in small business operations.

AI teams — not single chatbots, but coordinated groups of AI agents —
are now handling tasks that used to require 3-5 employees...
```

### Content Brief (from Strategist)
```markdown
## Content Brief: AI for SMB Operations

**Target keyword**: "AI small business automation"
**Search volume**: 2,400/mo | **Difficulty**: Medium
**Target audience**: SMB owners, ops managers
**Content type**: Listicle (10 items)
**Word count target**: 1,200-1,800
**Tone**: Practical, data-driven, accessible
**CTA**: Free trial signup
**Competitor gaps**: Most articles are theoretical — we add real ROI data
```

## Customization

- **Add platforms**: Modify Writer's `systemPrompt` to include additional platforms
- **Change tone**: Adjust Strategist's brief template for different brand voices
- **Scale up**: Add a second Writer agent for higher content volume
- **Add distribution**: Include `send-pdf-to-slack` for team notification on publish
