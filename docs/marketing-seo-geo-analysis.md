# Crewly Marketing Page: Competitive & SEO/GEO Analysis

## Part 1: Competitor Analysis — Who Else Uses "Crewly"?

There are **6 active products** using the name "Crewly" across different domains. None of them is in the AI agent orchestration space.

### 1. Crewly — Construction Project Management
- **URL:** [crewly.com](https://www.crewly.com/)
- **Business:** Cross-company collaborative construction project management. Track jobs, assign to subcontractors, view on-the-job images, get paid.
- **Domain Strength:** Owns crewly.com (strongest domain). Established presence in construction SaaS.
- **Threat Level:** **High** — owns the .com domain, will dominate generic "Crewly" searches.

### 2. Crewly — Remote Staffing Agency
- **URL:** [getcrewly.com](https://getcrewly.com/)
- **Business:** Offshore staffing firm connecting companies with pre-vetted English-speaking remote talent. Flat-rate pricing model.
- **Domain Strength:** Good SEO-friendly domain (getcrewly.com).
- **Threat Level:** **Medium** — different audience, but could create brand confusion.

### 3. Crewly — Shift Planning & Time Tracking (Germany)
- **URL:** [crewly-software.de](https://crewly-software.de/)
- **Business:** Drag & drop shift planning, NFC/GPS time tracking, invoicing. Targets electricians, restaurants, care services. Launched Q1 2026, 2,500+ companies.
- **Domain Strength:** Strong in German-language searches.
- **Threat Level:** **Low** — German market, different product category.

### 4. Crewly — Aviation English Learning App
- **URL:** [crewlyapp.com](https://www.crewlyapp.com/)
- **Business:** Helps pilots and cabin crew learn Aviation English with AI-powered feedback, ICAO/DLA exam simulations. iOS app.
- **Domain Strength:** Moderate (crewlyapp.com).
- **Threat Level:** **Low** — very niche, no keyword overlap.

### 5. Crewly — Crew Roster Management (Mobile App)
- **URL:** [App Store](https://apps.apple.com/us/app/crewly/id1281733950)
- **Business:** Roster management for flight crew — duty time tracking, rest calculations, schedule management. Android + iOS.
- **Domain Strength:** Strong app store presence (com.crewly package name).
- **Threat Level:** **Low** — mobile-only, airline niche.

### 6. Crewly LLC — Quick Scheduling
- **URL:** [crewly.net](https://crewly.net/)
- **Business:** QSked scheduling tool, primarily for workforce roster management.
- **Domain Strength:** Weak (.net domain, minimal web presence).
- **Threat Level:** **Low**.

### Key Takeaway

The name "Crewly" is crowded but none of the competitors are in AI/developer tools. Our biggest challenge is **distinguishing from crewly.com** (construction) in generic search results. The good news: anyone searching for AI-related terms + "Crewly" will find zero competition.

---

## Part 2: SEO Strategy

### Target Keyword Strategy

Since "Crewly" alone is contested, we must **own compound keywords** that include our differentiator.

#### Primary Keywords (High Priority)
| Keyword | Search Intent | Competition |
|---------|--------------|-------------|
| `Crewly AI agent orchestration` | Brand + category | None |
| `AI team orchestration platform` | Category search | Low-Medium |
| `multi-agent coding platform` | Feature search | Low |
| `Claude Code multi-agent` | Runtime-specific | Low |
| `orchestrate AI coding agents` | Action-oriented | Low |

#### Secondary Keywords
| Keyword | Search Intent | Competition |
|---------|--------------|-------------|
| `Gemini CLI multi-agent` | Runtime-specific | Very Low |
| `Codex agent orchestration` | Runtime-specific | Very Low |
| `AI pair programming team` | Use case | Medium |
| `coordinate multiple AI agents` | How-to | Low |
| `AI dev team automation` | Use case | Low-Medium |

#### Long-Tail Keywords
- "how to run multiple Claude Code agents together"
- "orchestrate Claude Code Gemini CLI Codex in one platform"
- "AI agent team for software development"
- "multi-agent AI coding workflow"

### Page Structure Recommendations

#### Title Tag
```
Crewly — AI Team Orchestration Platform | Claude Code, Gemini CLI, Codex
```

#### Meta Description
```
Crewly orchestrates multiple AI coding agents (Claude Code, Gemini CLI, Codex) as a team.
Create teams, assign roles, and monitor agents in real time from a web dashboard.
```

#### H1
```
Orchestrate AI Coding Agents as a Team
```

#### Key H2 Sections
- "What is Crewly?" — one-paragraph definition (AI will quote this)
- "Supported Agent Runtimes" — Claude Code, Gemini CLI, Codex
- "How It Works" — 3-5 step visual flow
- "Use Cases" — solo dev, dev teams, agencies
- "Getting Started" — npx crewly start

### Structured Data (Schema.org)

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Crewly",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "macOS, Linux, Windows",
  "description": "AI team orchestration platform that coordinates multiple coding agents (Claude Code, Gemini CLI, Codex) with a real-time web dashboard.",
  "url": "https://crewly.dev",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "keywords": "AI agent orchestration, multi-agent, Claude Code, Gemini CLI, Codex, coding agents"
}
```

Also add `FAQPage` schema with questions like:
- "What is Crewly?"
- "What AI agents does Crewly support?"
- "How do I get started with Crewly?"
- "What is the difference between Crewly and CrewAI?"

### Technical SEO Checklist
- [ ] Use a **unique domain** (e.g., `crewly.dev` or `crewly.ai`) to avoid confusion with crewly.com
- [ ] Add `robots.txt` that allows all major AI crawlers (GPTBot, Google-Extended, ClaudeBot, PerplexityBot)
- [ ] Server-side render (SSR) or pre-render the marketing page — JavaScript-only pages are invisible to most AI crawlers
- [ ] Create a `/sitemap.xml` with all key pages
- [ ] Implement canonical URLs
- [ ] Fast page load (<2s) — Core Web Vitals matter for ranking

---

## Part 3: GEO (Generative Engine Optimization) Strategy

GEO is about making AI search engines (ChatGPT, Perplexity, Google AI Overview, Claude) cite our Crewly when users ask about multi-agent AI orchestration.

### 3.1 Content That AI Models Can Quote

AI models prefer content that is **self-contained, factual, and definition-rich**. Structure key pages so that individual paragraphs can stand alone as answers.

#### Write "Quotable Blocks"

Each key concept should have a standalone paragraph that AI can extract:

> **What is Crewly?**
> Crewly is an open-source AI team orchestration platform that coordinates multiple AI coding agents — including Claude Code, Gemini CLI, and OpenAI Codex — to work together as a team. It provides a real-time web dashboard for creating teams, assigning roles, and monitoring agent activity. Agents communicate through bash-based skills and receive role-specific system prompts.

> **How is Crewly different from CrewAI?**
> CrewAI is a Python framework for orchestrating LLM-based agents through code. Crewly is a standalone platform with a web UI that orchestrates existing AI coding CLIs (Claude Code, Gemini CLI, Codex) in terminal sessions, requiring no Python or framework integration. Crewly manages the full agent lifecycle — from launching CLI sessions to monitoring terminal output in real time.

### 3.2 AI Crawler Access

Ensure AI crawlers can index the marketing page:

```
# robots.txt - ALLOW all AI crawlers
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Amazonbot
Allow: /
```

### 3.3 Build Citation Sources

AI models weight information that appears **across multiple authoritative sources**. Priority actions:

| Action | Why It Helps | Priority |
|--------|-------------|----------|
| **GitHub README with clear definition** | GitHub is heavily indexed by AI models | P0 |
| **npm package page** (good description) | npm is a trusted source for dev tools | P0 |
| **"Awesome" lists** (awesome-ai-agents, awesome-mcp) | Curated lists are frequently cited | P1 |
| **Dev.to / Hashnode blog posts** | Technical blogs are AI-indexed | P1 |
| **HackerNews / Reddit launch posts** | Discussion threads build entity recognition | P1 |
| **Product Hunt launch** | Creates a citable product page | P2 |
| **Comparison pages** ("Crewly vs CrewAI") | AI loves comparison content | P2 |
| **YouTube demos** | Google indexes video transcripts | P2 |

### 3.4 Entity Building

AI models need to learn that "Crewly" = AI agent orchestration platform. To build this entity association:

1. **Consistent description everywhere** — Use the same one-liner across GitHub, npm, social profiles, blog posts:
   > "Crewly is an AI team orchestration platform for Claude Code, Gemini CLI, and Codex."

2. **Associate with known entities** — Always mention alongside Claude Code, Gemini CLI, Codex, MCP (Model Context Protocol). These are entities AI models already know.

3. **Use the category name consistently** — "AI team orchestration" or "multi-agent orchestration platform" in every mention.

### 3.5 FAQ Content for AI Consumption

Create a dedicated FAQ page or section. AI models heavily cite FAQ content:

- What is Crewly?
- What AI agents does Crewly support?
- How is Crewly different from CrewAI?
- Is Crewly open source?
- How do I install Crewly?
- Can I use Crewly with Gemini CLI?
- Can I use Crewly with OpenAI Codex?
- Does Crewly work on Windows/Mac/Linux?

### 3.6 Keep Content Fresh

AI models have a strong recency bias. Citations drop off sharply for content older than 3 months. Plan for:
- Monthly blog posts or changelog updates
- Quarterly "state of Crewly" posts
- Update the marketing page with new features regularly

---

## Part 4: Recommended Domain Strategy

Given that `crewly.com` is taken by the construction company:

| Domain | Availability | Recommendation |
|--------|-------------|----------------|
| `crewly.dev` | Likely available | Best for dev tools — signals developer audience |
| `crewly.ai` | Check availability | Strong AI signal, but .ai domains are expensive |
| `getcrewly.com` | Taken (staffing) | Avoid |
| `usecrewly.com` | Check availability | Acceptable alternative |

**Recommendation:** Secure `crewly.dev` if available. It immediately signals "developer tool" and avoids confusion with the construction, staffing, and scheduling companies.

---

## Summary: Top 5 Actions

1. **Secure a unique domain** (`crewly.dev`) and deploy a SSR marketing page with structured data
2. **Write quotable definition blocks** on the landing page and GitHub README that AI models can extract
3. **Open robots.txt to all AI crawlers** (GPTBot, PerplexityBot, ClaudeBot, Google-Extended)
4. **Build citation sources** — publish on npm with good description, submit to awesome-lists, write comparison blog posts
5. **Own compound keywords** — always pair "Crewly" with "AI agent orchestration" to differentiate from same-name competitors
