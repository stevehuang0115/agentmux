# Social Media Ops — Quick Start

## Overview

An AI team that monitors trends, creates platform-native content, manages posting schedules, and analyzes engagement metrics. Runs a continuous weekly cycle: plan → create → publish → analyze → optimize.

**Target Users**: E-commerce brands, DTC companies, social-first businesses
**Team Size**: 3 agents (Social Manager + Content Creator + Analyst)

## Prerequisites

- Crewly installed and running (`npx crewly start`)
- Gemini API key configured (required for `nano-banana-image` skill)
- (Optional) Xiaohongshu access for `rednote-reader` skill

## Quick Start

```bash
# 1. Create the team from template
npx crewly create-team --template social-media-ops-team

# 2. Start the team
npx crewly start
```

## Required Skills

| Skill | Purpose | Config Required |
|-------|---------|----------------|
| `social-media-post` | Generate platform-optimized social posts | None |
| `nano-banana-image` | Create visual assets and graphics | `GEMINI_API_KEY` |
| `feedback-analyzer` | Analyze audience comments and sentiment | None |
| `daily-standup-report` | Compile daily activity summaries | None |

## Optional Skills

| Skill | Purpose |
|-------|---------|
| `rednote-reader` | Monitor Xiaohongshu trends (China market) |
| `send-pdf-to-slack` | Share weekly reports via Slack |

## Workflow

```
          Monday                    Tue-Thu                  Friday
            │                         │                        │
  Social Manager                Content Creator             Analyst
      │                              │                        │
      ├─ Monitor trends              │                        │
      ├─ Review competitors          │                        │
      ├─ Plan weekly calendar        │                        │
      │         │                    │                        │
      │         └────────────────────▶                        │
      │                              ├─ Create posts          │
      │                              ├─ Generate visuals      │
      │                              ├─ Adapt per platform    │
      │                              │         │              │
      │◀─────────────────────────────┤         │              │
      │                              │         │              │
      ├─ Review & approve            │         │              │
      ├─ Schedule posting            │         │              │
      │                              │         │              │
      │                              │         └──────────────▶
      │                              │                        ├─ Collect metrics
      │                              │                        ├─ Analyze performance
      │                              │                        ├─ Weekly report
      │                              │                        │
      │◀──────────────────────────────────────────────────────┤
      ├─ Adjust next week's          │                        │
      │   strategy                   │                        │
      └──────────────────────────────┘                        │
                              Next cycle                      │
```

## Expected Output Examples

### Weekly Content Calendar (from Social Manager)
```markdown
## Week of March 3, 2026

| Day | Platform | Topic | Format | Status |
|-----|----------|-------|--------|--------|
| Mon | X | Product launch teaser | Thread (5 tweets) | Draft |
| Mon | LinkedIn | Industry insight post | Long-form | Draft |
| Tue | X | Customer testimonial | Quote card | Draft |
| Wed | X | Behind-the-scenes | Photo + caption | Draft |
| Wed | Reddit | r/ecommerce value post | Tutorial | Draft |
| Thu | LinkedIn | Team spotlight | Story post | Draft |
| Fri | X | Weekly roundup | Thread | Draft |

**Theme**: Product launch week
**Hashtags**: #AIteams #ecommerce #automation
**Competitor watch**: [Brand X] launching similar feature — differentiate on pricing
```

### Platform-Native Post (from Content Creator)
```
[X/Twitter — Thread]
1/ We just shipped something wild.

An AI team that runs your entire social media — from trend research
to posting to analytics.

Not a scheduler. Not a chatbot. A full team. Here's how it works 👇

2/ The Social Manager agent monitors trends 24/7.
It watches X, LinkedIn, Reddit, and even Xiaohongshu.

When it spots a trending topic in your niche, it creates a content brief
and assigns it to the Content Creator.

3/ The Content Creator produces platform-native posts.
...
```

### Weekly Analytics Report (from Analyst)
```markdown
## Social Performance — Week of Feb 24, 2026

### Summary
- **Total posts**: 12 across 3 platforms
- **Total impressions**: 45,200 (+18% vs last week)
- **Engagement rate**: 4.2% (benchmark: 2.5%)
- **Top post**: "AI Team ROI Calculator" thread — 12K impressions, 340 engagements

### Platform Breakdown
| Platform | Posts | Impressions | Engagement | Best Day |
|----------|-------|-------------|------------|----------|
| X | 7 | 28,400 | 4.8% | Tuesday |
| LinkedIn | 3 | 12,100 | 3.1% | Monday |
| Reddit | 2 | 4,700 | 5.2% | Wednesday |

### Recommendations
1. **Double down on X threads** — highest engagement format (5.1% avg)
2. **Post LinkedIn content Mon-Tue** — 2x engagement vs Thu-Fri
3. **Reddit tutorials outperform discussions** — 3x upvotes on how-to posts
4. **Test video content next week** — competitor [Brand X] seeing 8% engagement on video
```

## Customization

- **Add platforms**: Add Xiaohongshu by enabling `rednote-reader` in optional skills
- **Change cadence**: Modify Social Manager's prompt for daily vs weekly planning
- **Add team members**: Add a second Content Creator for higher volume
- **Integrate Slack**: Add `send-pdf-to-slack` to auto-share weekly reports with stakeholders
