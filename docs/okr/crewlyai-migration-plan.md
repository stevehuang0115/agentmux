# crewlyai.com Domain Migration + Website Redesign Plan

> **Status:** DRAFT — Pending Steve Approval
> **Author:** Mia (Product Manager, crewly-core-mia-member-1)
> **Date:** 2026-02-27
> **Based on:** crewly-strategy-v1.md (AI Team OS positioning)
> **Scope:** Domain migration + website content redesign (not a full rebuild)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Part 1: Domain Migration](#2-part-1-domain-migration)
3. [Part 2: Website Redesign](#3-part-2-website-redesign)
4. [Part 3: Timeline & Assignments](#4-part-3-timeline--assignments)
5. [Decisions Needed from Steve](#5-decisions-needed-from-steve)

---

## 1. Executive Summary

**What:** Migrate from `crewly.stevesprompt.com` to `crewlyai.com` and update website content to reflect the new "AI Team OS" positioning with 3 clear business models.

**Why:**
- `crewlyai.com` is a proper product domain (vs. subdomain of personal brand)
- Current website messaging ("Orchestrate AI Coding Agents") doesn't match new strategy ("AI Team OS — let one person own a self-driving AI company")
- Three business models (Self-Serve, Marketplace, Custom) need clear representation

**How:**
- Domain migration is a straightforward infrastructure change (~2 hours of Sam's time)
- Website redesign reuses existing design system (dark theme, Tailwind v4, Nunito font) — content and page structure change, not visual rebuild
- Total effort: ~1 week Sam + ~1 week Mia content

---

## 2. Part 1: Domain Migration

### 2.1 Current Infrastructure (Verified)

```
User Browser
    ↓ (HTTPS)
Cloudflare Edge (SSL termination + CDN)
    ↓ (HTTP)
CELB2 (Nginx reverse proxy, least_conn load balancing)
    ↓ (HTTP)
ceappnode1:10014  ←→  ceappnode2:10014
(Docker: crewly-web container, Next.js on port 3000)
```

| Component | Current Value |
|-----------|--------------|
| Domain | `crewly.stevesprompt.com` |
| DNS Provider | Cloudflare (on stevesprompt.com zone) |
| SSL | Cloudflare Full SSL (edge termination) |
| Nginx config | `ce-core/do-provision/nginx-configs/crewly-stevesprompt.conf` |
| Docker image | `dr.careerengine.dev/crewly-web:1.0.15` |
| Host port | 10014 |
| App servers | ceappnode1, ceappnode2 |
| Load balancer | CELB2 |

### 2.2 Migration Steps

#### Step 1: Cloudflare DNS for crewlyai.com

**Pre-requisite:** Steve needs to add `crewlyai.com` to his Cloudflare account (or transfer DNS to Cloudflare if registered elsewhere).

1. Add `crewlyai.com` zone to Cloudflare
2. Create DNS records:
   ```
   Type: A
   Name: @  (crewlyai.com)
   Value: <CELB2 IP address>
   Proxy: ON (orange cloud — enables Cloudflare SSL + CDN)

   Type: A
   Name: www
   Value: <CELB2 IP address>
   Proxy: ON
   ```
3. Set SSL/TLS mode to **Full** in Cloudflare dashboard (same as stevesprompt.com)
4. Enable "Always Use HTTPS" and "Automatic HTTPS Rewrites"

#### Step 2: Nginx Configuration for crewlyai.com

Create new nginx config file:

**File:** `ce-core/do-provision/nginx-configs/crewlyai.conf`

```nginx
# crewlyai.com — Crewly AI Team OS
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

#### Step 3: Old Domain Redirect

Update existing `crewly-stevesprompt.conf` to 301 redirect:

```nginx
# crewly.stevesprompt.com → crewlyai.com (permanent redirect)
server {
    listen 80;
    server_name crewly.stevesprompt.com;
    return 301 https://crewlyai.com$request_uri;
}
```

This ensures:
- All old links/bookmarks still work
- SEO juice transfers to new domain
- No broken links from existing blog posts, social media, etc.

#### Step 4: Update Application Code

In `stevesprompt/apps/crewly/src/lib/constants.ts`:
```typescript
// Before
SITE_URL: 'https://crewly.stevesprompt.com'

// After
SITE_URL: 'https://crewlyai.com'
```

Also update:
- `next.config.ts` — any domain allowlists for images/assets
- `src/app/layout.tsx` — metadata base URL, OpenGraph URLs
- `robots.txt` / `sitemap.xml` — canonical URLs
- Any hardcoded `crewly.stevesprompt.com` references in blog content

#### Step 5: Deploy Sequence

```bash
# 1. Deploy new nginx config to CELB2
sh masterScript.sh CELB2 update-nginx crewlyai

# 2. Deploy redirect config for old domain
sh masterScript.sh CELB2 update-nginx crewly-stevesprompt

# 3. Build and push updated Docker image (with new SITE_URL)
cd /stevesprompt
docker build --platform linux/amd64 -f apps/crewly/Dockerfile \
  -t dr.careerengine.dev/crewly-web:1.0.16 .
docker push dr.careerengine.dev/crewly-web:1.0.16

# 4. Update docker-compose.yml version
# crewly-web image → dr.careerengine.dev/crewly-web:1.0.16

# 5. Deploy to both app nodes
sh masterScript.sh CEAppNode1 restart crewly-web
sh masterScript.sh CEAppNode2 restart crewly-web

# 6. Verify
curl -I https://crewlyai.com              # Should return 200
curl -I https://crewly.stevesprompt.com    # Should return 301 → crewlyai.com
```

#### Step 6: Post-Migration Verification

- [ ] `https://crewlyai.com` loads correctly with SSL
- [ ] `https://www.crewlyai.com` redirects to `crewlyai.com` (or vice versa — pick one)
- [ ] `https://crewly.stevesprompt.com` 301 redirects to `https://crewlyai.com`
- [ ] `https://crewly.stevesprompt.com/blog/xxx` redirects to `https://crewlyai.com/blog/xxx`
- [ ] All internal links use new domain
- [ ] OpenGraph/Twitter cards show correct URL
- [ ] Google Search Console: submit new sitemap, request indexing

### 2.3 SSL Certificate

No manual SSL action needed. Cloudflare automatically provisions and renews certificates for proxied domains. As long as:
- DNS record has orange cloud (proxy ON)
- SSL mode is set to "Full"

Cloudflare issues a Universal SSL cert within minutes of DNS propagation.

### 2.4 Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| DNS propagation delay | Users see old domain for up to 48h | Medium | Keep old domain running with redirect; low TTL |
| SEO ranking drop | Temporary traffic loss | Low | 301 redirects preserve rankings; submit new sitemap |
| Broken external links | Old links stop working | None | 301 redirect handles all paths |
| Cloudflare config error | Site unreachable | Low | Test with `curl` before announcing; rollback is removing DNS record |

**Estimated downtime: Zero.** Old domain stays live with redirect. New domain goes live in parallel.

---

## 3. Part 2: Website Redesign

### 3.1 Design Approach

**Reuse existing design system — change content, not visuals.**

The current site has a solid dark theme (bg `#08090a`, indigo/purple accents, Nunito font, card-based layout). The redesign is a **content and information architecture update**, not a visual overhaul.

What stays:
- Dark theme, color palette, typography
- Card-based layouts, hover animations
- Responsive grid system
- Blog, Marketplace, Docs infrastructure

What changes:
- Homepage messaging and structure
- New `/pricing` page
- Navigation updates
- Content aligned to "AI Team OS" positioning
- Three business models clearly distinguished

### 3.2 New Page Structure

```
crewlyai.com
├── /                    ← Homepage (major rewrite)
├── /pricing             ← NEW: 3-tier pricing + business models
├── /templates           ← NEW: replaces /marketplace focus (AI Team templates)
├── /marketplace         ← Keep: Skills/Roles/Models registry
├── /blog                ← Keep: Update positioning in hero text
├── /docs                ← Keep: Update install URLs
├── /download            ← Keep: Update URLs
└── /enterprise          ← NEW: Custom AI Team landing page (B2B)
```

### 3.3 Homepage Redesign

**Current:** "Orchestrate AI Coding Agents as a Team"
**New:** "Your AI Team, Running Your Company"

#### New Homepage Flow

```
┌─────────────────────────────────────────────┐
│  HERO                                        │
│  "Your AI Team. Running Your Company."       │
│  "One command to launch a self-driving AI    │
│   team that plans, builds, deploys, and      │
│   learns — while you focus on vision."       │
│                                              │
│  [Get Started Free]  [Watch Demo]            │
│  $ npx crewly start                         │
├─────────────────────────────────────────────┤
│  SOCIAL PROOF / METRIC BAR                   │
│  "X AI Teams running this week"              │
│  (aligns with North Star metric)             │
├─────────────────────────────────────────────┤
│  THREE WAYS TO USE CREWLY                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │Self-Serve│ │Templates │ │Enterprise│     │
│  │$0-$29/mo │ │Community │ │Custom AI │     │
│  │Creators, │ │ecosystem │ │Teams for │     │
│  │indie devs│ │of team   │ │your biz  │     │
│  │1-click   │ │templates │ │ops       │     │
│  └──────────┘ └──────────┘ └──────────┘    │
├─────────────────────────────────────────────┤
│  DEMO / HOW IT WORKS                         │
│  Step 1: Set your goal                       │
│  Step 2: AI team plans OKRs                  │
│  Step 3: Agents execute autonomously         │
│  Step 4: System learns and evolves           │
│  (embedded video or animated demo)           │
├─────────────────────────────────────────────┤
│  THE 5-LAYER STACK                           │
│  (Visual diagram of strategy's 5 layers)     │
│  L1: Orchestrator                            │
│  L2: AI Team (PM / Eng / QA / Growth / Ops) │
│  L3: Execution Engine                        │
│  L4: Memory System                           │
│  L5: Self-Evolution                          │
├─────────────────────────────────────────────┤
│  USE CASES                                   │
│  - Indie Hacker: "My AI team ships while    │
│    I sleep"                                  │
│  - Creator: "3 AI agents manage my content   │
│    pipeline"                                 │
│  - SMB: "AI ops team cut our admin by 80%"  │
├─────────────────────────────────────────────┤
│  WHAT MAKES CREWLY DIFFERENT                 │
│  (6 moats from strategy as feature cards)    │
│  System OS | Workflow Lock-in | Data Flywheel│
│  AI Personality | Speed | Founder Distro     │
├─────────────────────────────────────────────┤
│  FAQ (updated for AI Team OS framing)        │
├─────────────────────────────────────────────┤
│  FINAL CTA                                   │
│  "Launch your AI team in 60 seconds"         │
│  $ npx crewly start                         │
└─────────────────────────────────────────────┘
```

#### Key Messaging Changes

| Element | Current | New |
|---------|---------|-----|
| **Headline** | "Orchestrate AI Coding Agents as a Team" | "Your AI Team. Running Your Company." |
| **Subhead** | "One command to launch a team of Claude Code, Gemini CLI, and Codex agents" | "One command to launch a self-driving AI team that plans, builds, deploys, and learns" |
| **Meta description** | "Crewly orchestrates multiple AI coding agents..." | "Crewly is the AI Team Operating System. Launch a full AI team — PM, Engineer, QA, Ops — that runs your company while you focus on vision." |
| **Value prop** | Multi-runtime agent coordination | Self-driving AI company for one person |
| **Target user** | Developers using AI coding tools | Creators, indie hackers, solo founders, small teams |
| **CTA** | "Browse Marketplace" | "Get Started Free" / "Watch Demo" |

### 3.4 New Pricing Page (`/pricing`)

```
┌─────────────────────────────────────────────┐
│  PRICING HERO                                │
│  "Choose How You Work with Your AI Team"     │
├─────────────────────────────────────────────┤
│  THREE TIERS (card layout, center emphasized)│
│                                              │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐│
│  │ Community  │ │ Pro ★      │ │ Custom   ││
│  │ Free       │ │ $29/mo     │ │ Contact  ││
│  │            │ │            │ │          ││
│  │ 2 agents   │ │ 10 agents  │ │ Unlimited││
│  │ 1 team     │ │ 5 teams    │ │ Dedicated││
│  │ Basic      │ │ Full memory│ │ Custom   ││
│  │  memory    │ │ Slack integ│ │  roles   ││
│  │ Community  │ │ All quality│ │ Onboarding││
│  │  support   │ │  gates     │ │ SLA      ││
│  │            │ │ Priority   │ │ Dedicated││
│  │            │ │  support   │ │  support ││
│  │ [Start]    │ │ [Upgrade]  │ │ [Talk]   ││
│  └────────────┘ └────────────┘ └──────────┘│
├─────────────────────────────────────────────┤
│  FEATURE COMPARISON TABLE                    │
│  (Detailed feature-by-feature comparison)    │
├─────────────────────────────────────────────┤
│  CUSTOM AI TEAM SECTION                      │
│  "Need an AI Operations Team for Your Biz?"  │
│  - STEAM Fun case study preview              │
│  - What's included: setup, training, ongoing │
│  - "Starting at $500 setup + $200/mo"        │
│  - [Schedule a Call] CTA                     │
├─────────────────────────────────────────────┤
│  FAQ                                         │
│  - "Do I need my own API key?" → Yes (BYOK) │
│  - "What AI tools are supported?"            │
│  - "Can I cancel anytime?"                   │
│  - etc.                                      │
└─────────────────────────────────────────────┘
```

**Pricing Strategy Note:** Pricing follows `business-model-v2.md` Route A (BYOK) for Self-Serve, and consulting model for Custom. Steve should confirm exact pricing before we build the page.

### 3.5 New Templates Page (`/templates`)

This replaces the current marketplace as the primary discovery experience for new users.

```
┌─────────────────────────────────────────────┐
│  TEMPLATES HERO                              │
│  "Launch a Pre-Built AI Team in Minutes"     │
│  "Pick a template. Customize your team.      │
│   Start executing."                          │
├─────────────────────────────────────────────┤
│  TEMPLATE GRID                               │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐│
│  │ Startup    │ │ Content    │ │ E-commerce││
│  │ Team       │ │ Team       │ │ Team     ││
│  │ PM+Eng+Ops │ │ Writer+    │ │ Catalog+ ││
│  │            │ │ Designer+  │ │ Support+ ││
│  │            │ │ Strategist │ │ Marketing││
│  └────────────┘ └────────────┘ └──────────┘│
│  ┌────────────┐ ┌────────────┐ ┌──────────┐│
│  │ Research   │ │ Education  │ │ Custom   ││
│  │ Team       │ │ Team       │ │ Builder  ││
│  │ Researcher+│ │ Curriculum+│ │ Design   ││
│  │ Analyst+   │ │ Content+   │ │ your own ││
│  │ Writer     │ │ Ops        │ │ team     ││
│  └────────────┘ └────────────┘ └──────────┘│
├─────────────────────────────────────────────┤
│  "Want to share your template?"              │
│  Community contribution CTA                  │
└─────────────────────────────────────────────┘
```

**Note:** Templates don't all need to exist at launch. Start with 2-3 working templates (Startup Team, Content Team) and show others as "Coming Soon" to signal the vision.

### 3.6 New Enterprise Page (`/enterprise`)

Simple landing page for Custom AI Team (B2B):

```
┌─────────────────────────────────────────────┐
│  HERO                                        │
│  "A Custom AI Operations Team for Your       │
│   Business"                                  │
│  "We build, train, and manage an AI team     │
│   tailored to your operations."              │
├─────────────────────────────────────────────┤
│  HOW IT WORKS                                │
│  1. Discovery call — understand your ops     │
│  2. Team design — roles, workflows, skills   │
│  3. Deployment — launch your AI team         │
│  4. Managed ops — ongoing optimization       │
├─────────────────────────────────────────────┤
│  USE CASES                                   │
│  - Education (STEAM Fun) — curriculum,       │
│    communications, scheduling                │
│  - E-commerce — catalog, support, marketing  │
│  - Services — client ops, reporting, billing │
├─────────────────────────────────────────────┤
│  PRICING                                     │
│  Setup: from $500                            │
│  Managed ops: $200-500/mo                    │
│  [Schedule a Call]                            │
└─────────────────────────────────────────────┘
```

### 3.7 Existing Page Updates

| Page | Changes |
|------|---------|
| `/blog` | Update hero text from "agent orchestration" to "AI Team OS". Add category tags: "AI Teams", "Tutorials", "Case Studies", "Behind the Scenes" |
| `/marketplace` | Keep as-is. This stays as the technical skill/role/model registry. Templates page is the user-facing layer on top. |
| `/docs` | Update install URLs to `crewlyai.com`. Add "Quick Start" section emphasizing template-based onboarding. |
| `/download` | Update all URLs. Ensure `curl` install script points to `crewlyai.com/install.sh`. |

### 3.8 Navigation Update

**Current:**
```
Home | Download | Blog | Marketplace | Docs | [GitHub]
```

**New:**
```
Home | Templates | Pricing | Blog | Docs | [GitHub]  [Get Started →]
```

Changes:
- Remove `Download` from primary nav (move install methods to Docs and Homepage)
- Add `Templates` (new primary discovery entry)
- Add `Pricing` (critical for conversion)
- Add `Get Started` CTA button (right-aligned, indigo accent)
- `Marketplace` stays accessible via Templates page and footer, but not in primary nav

### 3.9 Content Strategy

#### Core Messaging Framework

**One-liner:** "Crewly is the AI Team Operating System"

**Elevator pitch:** "Crewly lets one person launch a full AI team — Product Manager, Engineer, QA, Ops — that plans its own OKRs, executes tasks, learns from mistakes, and evolves itself. It's not an AI tool. It's your AI company."

**Key phrases to use consistently:**
- "AI Team OS" (product category)
- "Self-driving AI team" (capability)
- "One person, full AI company" (aspiration)
- "Your AI team learns and evolves" (differentiation)
- "From idea to execution in minutes" (speed)

**Key phrases to retire:**
- ~~"Orchestrate AI Coding Agents"~~ → too technical, too narrow
- ~~"Multi-runtime support"~~ → feature, not benefit
- ~~"Claude Code, Gemini CLI, Codex"~~ → mention in docs, not in hero
- ~~"Open source AI agent framework"~~ → commodity positioning

#### SEO Metadata Updates

```
Title: Crewly — AI Team Operating System
Description: Launch a self-driving AI team that plans, builds, deploys, and learns. One person. Full AI company. Start free.
Keywords: AI team, AI team OS, autonomous AI agents, self-evolving AI, AI company, one-person company
```

---

## 4. Part 3: Timeline & Assignments

### Phase 1: Domain Migration (Week 1, ~2 hours)

| # | Task | Owner | Est. Time | Dependencies |
|---|------|-------|-----------|--------------|
| M1 | Add crewlyai.com to Cloudflare, configure DNS A records | Steve | 15 min | Domain purchased |
| M2 | Create `nginx-configs/crewlyai.conf` | Sam | 15 min | M1 (need CELB2 IP) |
| M3 | Update `crewly-stevesprompt.conf` to 301 redirect | Sam | 10 min | M2 |
| M4 | Deploy nginx configs to CELB2 | Sam | 10 min | M2, M3 |
| M5 | Update `SITE_URL` in constants.ts, layout.tsx, metadata | Sam | 20 min | M4 |
| M6 | Build + push Docker image v1.0.16 | Sam | 15 min | M5 |
| M7 | Update docker-compose.yml version | Sam | 5 min | M6 |
| M8 | Deploy to ceappnode1 + ceappnode2 | Sam | 10 min | M7 |
| M9 | Verify: new domain works, old domain redirects, SSL OK | Sam | 15 min | M8 |
| M10 | Submit new sitemap to Google Search Console | Mia | 15 min | M9 |

**Milestone:** crewlyai.com live, crewly.stevesprompt.com redirecting. Zero downtime.

### Phase 2: Content Preparation (Week 1-2, ~3 days Mia)

| # | Task | Owner | Est. Time | Dependencies |
|---|------|-------|-----------|--------------|
| C1 | Write new homepage copy (hero, sections, CTAs) | Mia | 4 hr | Strategy v1 approved |
| C2 | Write pricing page content (3 tiers + feature table + FAQ) | Mia | 3 hr | Steve confirms pricing |
| C3 | Write templates page content (6 template descriptions) | Mia | 2 hr | — |
| C4 | Write enterprise page content (use cases, process, pricing) | Mia | 2 hr | — |
| C5 | Update blog hero text and category tags | Mia | 30 min | — |
| C6 | Update docs page install URLs and quick start | Mia | 30 min | M9 (need new URLs) |
| C7 | Update SEO metadata across all pages | Mia | 1 hr | C1-C6 |

**Milestone:** All content ready for implementation.

### Phase 3: Website Implementation (Week 2-3, ~3 days Sam)

| # | Task | Owner | Est. Time | Dependencies |
|---|------|-------|-----------|--------------|
| W1 | Implement new homepage sections (rewrite page.tsx + components) | Sam | 6 hr | C1 |
| W2 | Build `/pricing` page (3-tier cards + comparison table + FAQ) | Sam | 4 hr | C2 |
| W3 | Build `/templates` page (template grid + descriptions) | Sam | 3 hr | C3 |
| W4 | Build `/enterprise` page (simple landing page) | Sam | 2 hr | C4 |
| W5 | Update navigation (new links, Get Started CTA button) | Sam | 1 hr | W1-W4 |
| W6 | Update blog hero text and categories | Sam | 30 min | C5 |
| W7 | Update docs + download URLs | Sam | 30 min | C6 |
| W8 | SEO metadata + structured data updates | Sam | 1 hr | C7 |
| W9 | Mobile responsiveness testing | Sam | 1 hr | W1-W8 |
| W10 | Build + deploy to staging (verify all pages) | Sam | 1 hr | W9 |

**Milestone:** Redesigned site on staging for Steve review.

### Phase 4: Launch (Week 3)

| # | Task | Owner | Est. Time | Dependencies |
|---|------|-------|-----------|--------------|
| L1 | Steve reviews staging site | Steve | 30 min | W10 |
| L2 | Apply Steve's feedback | Sam | 2 hr | L1 |
| L3 | Build + push final Docker image | Sam | 15 min | L2 |
| L4 | Deploy to production | Sam | 15 min | L3 |
| L5 | Verify all pages, links, SEO, redirects | Sam+Mia | 30 min | L4 |
| L6 | Announce new domain on social media | Luna | 1 hr | L5 |

**Milestone:** crewlyai.com live with new AI Team OS positioning.

### Full Timeline

```
Week 1  ────────────────────────────────────
  Day 1-2: Domain migration (Sam + Steve)  ← Phase 1
  Day 2-5: Content writing (Mia)           ← Phase 2

Week 2  ────────────────────────────────────
  Day 1-3: Website implementation (Sam)    ← Phase 3 (W1-W5)
  Day 4-5: Polish + testing (Sam)          ← Phase 3 (W6-W10)

Week 3  ────────────────────────────────────
  Day 1: Steve review                      ← Phase 4
  Day 2: Feedback + final deploy           ← Phase 4
  Day 3: Announce                          ← Phase 4
```

**Total effort:**
- **Sam:** ~2.5 days (migration + implementation)
- **Mia:** ~2 days (content + SEO)
- **Steve:** ~1 hour (DNS setup + review)
- **Luna:** ~1 hour (social announcement)

---

## 5. Decisions Needed from Steve

Before execution, Steve needs to confirm:

| # | Decision | Options | My Recommendation |
|---|----------|---------|-------------------|
| 1 | **Where is crewlyai.com registered?** | Cloudflare / Namecheap / GoDaddy / other | Transfer to or proxy through Cloudflare for consistent SSL + CDN |
| 2 | **www vs non-www?** | `crewlyai.com` or `www.crewlyai.com` | `crewlyai.com` (shorter, modern convention) |
| 3 | **Pricing confirmation** | Community: Free / Pro: $29/mo / Custom: from $500 setup | Match business-model-v2.md Route A pricing |
| 4 | **Enterprise pricing visible?** | Show exact pricing / "Contact us" / Range | Show range ("from $500 setup + $200/mo") — transparency builds trust |
| 5 | **Templates page scope** | Show all 6 templates (some "Coming Soon") / Only show working ones | Show all 6 with "Coming Soon" badges — signals vision |
| 6 | **Keep /marketplace in nav?** | In nav / Footer only / Accessible via /templates | Footer + /templates link — reduce nav clutter |
| 7 | **Timeline priority** | Domain first, then redesign / Redesign first, then domain / All at once | Domain first (quick win), redesign follows |

---

## Appendix: File Change Summary

Files that will be created or modified:

### New Files
- `ce-core/do-provision/nginx-configs/crewlyai.conf` — New nginx config
- `stevesprompt/apps/crewly/src/app/pricing/page.tsx` — Pricing page
- `stevesprompt/apps/crewly/src/app/templates/page.tsx` — Templates page
- `stevesprompt/apps/crewly/src/app/enterprise/page.tsx` — Enterprise page
- Supporting components in `src/components/Pricing/`, `Templates/`, `Enterprise/`

### Modified Files
- `ce-core/do-provision/nginx-configs/crewly-stevesprompt.conf` — Add 301 redirect
- `ce-core/do-provision/app-node-templates/docker-compose.yml` — Bump version
- `stevesprompt/apps/crewly/src/lib/constants.ts` — SITE_URL, NAV_LINKS, features
- `stevesprompt/apps/crewly/src/app/layout.tsx` — Metadata, title, description
- `stevesprompt/apps/crewly/src/app/page.tsx` — Homepage rewrite
- `stevesprompt/apps/crewly/src/components/Landing/Hero.tsx` — New hero content
- `stevesprompt/apps/crewly/src/components/Layout/Header.tsx` — New nav links
- `stevesprompt/apps/crewly/src/app/blog/page.tsx` — Updated hero text
- `stevesprompt/apps/crewly/src/app/docs/page.tsx` — Updated URLs
- `stevesprompt/apps/crewly/src/app/download/page.tsx` — Updated URLs
- `stevesprompt/apps/crewly/package.json` — Version bump to 1.0.16
