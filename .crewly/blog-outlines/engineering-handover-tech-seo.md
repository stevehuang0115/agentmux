# Engineering Handover: P0 Tech SEO Items for Blog

> **Created by:** product-manager (crewly-dev-mia-member-1)
> **Date:** 2026-02-20
> **Priority:** P0 (blocks search visibility and social sharing)
> **Codebase:** stevesprompt/apps/crewly (Next.js marketing site)

---

## Background

Blog content sprint is complete: 5 published posts covering the full marketing funnel. The blog infrastructure (markdown rendering, JSON-LD, OG tags, RSS feed, components) is solid. However, 4 tech SEO improvements were identified during the comprehensive blog audit that need engineering implementation before the content can reach its full potential.

## Item 1: Update robots.ts for AI Crawlers

**File:** `src/app/robots.ts`

**Current state:** Standard robots.txt with basic Googlebot rules only.

**Required changes:**
- Add explicit `allow` rules for AI search crawlers: `GPTBot`, `ChatGPT-User`, `Google-Extended`, `CCBot`, `anthropic-ai`, `ClaudeBot`
- These bots drive AI citation traffic (ChatGPT, Google AI Overview, Claude, Perplexity)
- Without explicit allow rules, some AI bots default to not crawling

**Example:**
```typescript
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'CCBot', allow: '/' },
      { userAgent: 'anthropic-ai', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
    ],
    sitemap: 'https://crewly.stevesprompt.com/sitemap.xml',
  };
}
```

**Acceptance criteria:**
- [ ] AI crawler bots explicitly allowed in robots.txt output
- [ ] Sitemap URL included
- [ ] Build passes cleanly

---

## Item 2: Add dateModified to JSON-LD Article Schema

**File:** `src/app/blog/[slug]/page.tsx`

**Current state:** JSON-LD Article schema has `datePublished` but no `dateModified`. Google Search Console may flag this as a structured data warning.

**Required changes:**
- Add optional `dateModified` field to the `BlogPost` interface in `src/lib/blog.ts`
- Parse it from frontmatter YAML (field name: `dateModified`)
- Include `dateModified` in the JSON-LD Article schema on blog post pages
- If `dateModified` is not set in frontmatter, default to `datePublished`

**Frontmatter example:**
```yaml
---
title: "My Post"
date: "2026-02-20"
dateModified: "2026-02-21"
---
```

**JSON-LD output:**
```json
{
  "@type": "Article",
  "datePublished": "2026-02-20",
  "dateModified": "2026-02-21"
}
```

**Acceptance criteria:**
- [ ] `dateModified` appears in JSON-LD Article schema
- [ ] Falls back to `datePublished` when not specified
- [ ] Validates with Google Rich Results Test
- [ ] BlogPost TypeScript interface updated

---

## Item 3: Create Blog Index OG Image

**File:** `src/app/blog/page.tsx` + `public/blog/og/`

**Current state:** Individual blog posts have OG images (1200x630 PNGs with dark indigo gradient). The blog index page (`/blog`) has no dedicated OG image, so social sharing of the blog homepage shows a generic or missing preview.

**Required changes:**
- Create a `blog-index.png` (1200x630) matching the existing brand style:
  - Dark indigo gradient background (matching site brand)
  - Text: "Crewly Blog" or "Crewly Engineering Blog"
  - Subtitle: "Multi-Agent AI for Dev Teams"
  - Crewly logo or icon
- Add OG image metadata to the blog index page's `generateMetadata`

**Reference:** See existing OG images at `public/blog/og/` for style matching.

**Acceptance criteria:**
- [ ] Blog index OG image exists at `public/blog/og/blog-index.png`
- [ ] `/blog` page metadata includes `og:image` pointing to the image
- [ ] Image is 1200x630 pixels
- [ ] Style matches existing OG images

---

## Item 4: Implement ISR (Incremental Static Regeneration) for Blog Routes

**File:** `src/app/blog/page.tsx` and `src/app/blog/[slug]/page.tsx`

**Current state:** Blog pages are statically generated at build time via `generateStaticParams`. No `revalidate` period is configured, meaning content updates require a full rebuild/redeploy.

**Required changes:**
- Add `export const revalidate = 3600` (1 hour) to both blog routes
- This allows Next.js to regenerate pages in the background when they're accessed after the revalidation window
- New blog posts will appear within 1 hour without needing a redeploy

**Example:**
```typescript
// At the top of the page component file
export const revalidate = 3600; // Revalidate every hour
```

**Acceptance criteria:**
- [ ] Both `/blog` and `/blog/[slug]` routes have `revalidate` configured
- [ ] Pages still work with `generateStaticParams`
- [ ] Build passes cleanly
- [ ] New content appears within revalidation window

---

## Summary Table

| # | Item | Files | Effort | Impact |
|---|------|-------|--------|--------|
| 1 | AI crawler robots.ts | robots.ts | 15 min | High (AI citation traffic) |
| 2 | dateModified schema | blog.ts, [slug]/page.tsx | 30 min | Medium (SEO structured data) |
| 3 | Blog index OG image | blog/page.tsx, public/blog/og/ | 45 min | Medium (social sharing) |
| 4 | ISR for blog routes | blog/page.tsx, [slug]/page.tsx | 15 min | Medium (content freshness) |

**Total estimated effort:** ~2 hours of engineering time

## Next Steps After These Items

Once P0 tech SEO is complete, the content pipeline is ready for P1 blog posts:
- "How Crewly's Persistent Memory Works" (MOFU, technical deep dive)
- "Using Mixed AI Runtimes with Crewly" (MOFU, tutorial)
