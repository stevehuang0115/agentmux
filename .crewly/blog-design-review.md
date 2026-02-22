# Crewly Blog Design Review & Recommendations

**Prepared by:** Product Manager (Mia)
**Date:** 2026-02-21
**For:** Engineering (Sam) - Implementation Reference
**Blog URL:** crewly.stevesprompt.com/blog
**Source Code:** /Users/yellowsunhy/Desktop/projects/stevesprompt/apps/crewly

---

## Part 1: Current Design Analysis

### Overall Assessment

The Crewly blog follows a **modern dark-theme technical blog** aesthetic. The implementation is solid with good component modularity, but several areas lack the polish seen in best-in-class tech blogs.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4, Markdown with react-markdown, Prism.js syntax highlighting, Nunito font (Google Fonts).

---

### Strengths

| Area | Details |
|------|---------|
| **Dark theme execution** | Gray-950 base with indigo accents creates a cohesive developer-focused identity |
| **Component architecture** | Well-modularized: BlogCard, BlogHeroCard, BlogPost, CodeBlock, TableOfContents, RelatedPosts, ShareButtons, ReadingProgress, BlogCta |
| **Reading experience** | Line-height 1.9, max-w-3xl for articles, scroll-margin for anchored headings - all excellent choices |
| **Code blocks** | Copy button, language label, Prism.js with One Dark theme, good border/radius treatment |
| **Interactive details** | Reading progress bar, hover transitions, TOC with IntersectionObserver active-section tracking |
| **Content features** | Table of contents (auto-generated from headings), related posts by tag overlap, share buttons, CTA section |

### Weaknesses & Issues

#### P0 - Critical Issues

1. **No OG images / social preview cards**
   - Blog posts lack dedicated OG images; social shares look generic
   - Competitor blogs all feature rich visual previews on Twitter/LinkedIn

2. **No dark/light mode toggle**
   - Every top competitor (Tailwind, Linear, Cursor) supports theme switching
   - Forces dark-only experience; alienates readers who prefer light mode

3. **No featured images on posts**
   - Blog cards show text only - no thumbnails or hero images
   - Every competitor uses imagery to create visual variety and draw attention
   - Without images, the listing page looks monotonous and text-heavy

#### P1 - High Priority

4. **Font choice: Nunito feels soft/casual for a developer tool**
   - Nunito is a rounded sans-serif; competes poorly with Inter (Tailwind, Linear), custom typefaces (Cursor's CursorGothic), or system fonts used by Stripe/Vercel
   - Lacks the technical precision expected from a dev-tools brand

5. **No category/tag filtering on the listing page**
   - All posts listed chronologically with no filtering
   - Linear has category pills (Community, News, Craft, AI, Practices)
   - Cursor has filterable categories (product, research, company, customers, news)
   - Vercel uses category tags per post

6. **Narrow grid: max-w-4xl limits visual presence**
   - Blog listing at max-w-4xl (896px) feels cramped on modern wide screens
   - Vercel, Stripe, and Linear all use wider containers (max-w-5xl to max-w-6xl)

7. **No search functionality**
   - Both Tailwind (Cmd+K) and Linear (Cmd+K) offer search
   - As content grows past 5 posts, discoverability becomes a real problem

#### P2 - Medium Priority

8. **Hero card design is oversized but underutilized**
   - The hero card (BlogHeroCard) spans 2 columns but has no image, making it feel like wasted space
   - Should feature a compelling image or visual that differentiates the latest post

9. **Tags lack interactivity**
   - Tags display on cards and post pages but don't link to filtered views
   - Missed opportunity for content discovery

10. **Share buttons are minimal**
    - Only Twitter/X, LinkedIn, and Copy Link
    - Missing: Reddit (crucial for developer audience), Hacker News, email
    - Position at bottom only; no floating/sticky share bar

11. **No author pages or bios**
    - Author shown as a small avatar circle with initials
    - No author page, bio, or link to other posts by the same author
    - Stripe and Linear prominently feature author information

12. **Footer is minimal**
    - Simple copyright line; lacks the organized link groups seen on Linear/Stripe
    - Missed opportunity for newsletter signup, social links, product navigation

#### P3 - Nice to Have

13. **No newsletter/email subscription**
    - Tailwind has a prominent Subscribe CTA at the top
    - No way to capture repeat readers

14. **No estimated reading time on listing page**
    - Reading time shown on post detail page only
    - Cards should preview the time commitment

15. **No RSS feed link prominently displayed**
    - RSS link exists but is small/subtle in the header
    - Developer audiences value RSS highly

16. **Table of contents could be a sticky sidebar**
    - Currently inline at top of post, visible only if 3+ headings
    - Linear/Stripe style: sticky sidebar TOC on desktop for long articles

---

## Part 2: Competitor Design Analysis

### 1. Vercel Blog (vercel.com/blog)

**Design Philosophy:** Minimalist, content-first, enterprise polish

| Element | Details |
|---------|---------|
| **Layout** | Clean card-based layout, consistent columnar format |
| **Typography** | Clear hierarchy - titles as primary focal points, muted dates/metadata |
| **Categories** | Tagged per post (Engineering, Company News, v0) |
| **Key Strength** | Scanability across 515+ posts; metadata clarity |
| **Color** | Professional, neutral palette with strong contrast |

**Worth Borrowing:**
- Consistent metadata format (date + category + author) below each title
- Enterprise-grade restraint - no gratuitous decoration
- Category tagging system that doesn't overwhelm

---

### 2. Linear Blog (linear.app/blog)

**Design Philosophy:** Dark theme done right, content-focused with breathing room

| Element | Details |
|---------|---------|
| **Layout** | Centered column, 3-column grid, 80px section margins |
| **Typography** | Variable weights (title-3 medium), tertiary-colored metadata |
| **Cards** | 16:9 aspect ratio images, 5px border-radius, hover arrows |
| **Colors** | Dark base (#08090a), high contrast, understated palette |
| **Categories** | Filter pills: Community, News, Craft, AI, Practices |
| **Search** | Cmd+K search shortcut |
| **Images** | Responsive with query params (?w=448&q=95&auto=format&dpr=2) |

**Worth Borrowing:**
- Category filter pills at the top of blog listing
- Generous whitespace (80px between sections) creates premium feel
- Progressive disclosure: metadata in tertiary color, titles prominent
- Responsive image optimization via URL parameters
- Dark theme is deeper (#08090a vs our gray-950) - more dramatic

---

### 3. Stripe Blog (stripe.com/blog)

**Design Philosophy:** Sophisticated, multi-layered, design-system driven

| Element | Details |
|---------|---------|
| **Layout** | Multi-column responsive grid with named grid-template-areas |
| **Typography** | Variable font weights (200-500), 15px body at 1.6 line-height, -0.2px letter-spacing |
| **Cards** | Modular with shadow variants (XSmall to XLarge), 8px border-radius |
| **Colors** | White background, navy (#0a2540) text, purple (#533afd) accent |
| **Categories** | Segmented control buttons, color-coded product groups |
| **Visuals** | Diagonal section breaks with skewY(-6deg), frosted glass overlays |
| **CSS Architecture** | 150+ custom properties, semantic naming (--inputErrorAccentColor) |

**Worth Borrowing:**
- CSS custom properties for systematic theming
- Segmented control for category filtering
- Card shadow system (graduated sizes for visual depth)
- Focus states for keyboard navigation accessibility
- Author avatars with proper sizing and borders

---

### 4. Tailwind CSS Blog (tailwindcss.com/blog)

**Design Philosophy:** Ultra-minimal, content is king, dark mode first-class

| Element | Details |
|---------|---------|
| **Layout** | No cards at all - whitespace and typography carry the design |
| **Typography** | Inter (variable) for body, IBM Plex Mono for code, clear date-title-description hierarchy |
| **Colors** | Full dark/light mode via localStorage + system preference, subtle border opacity |
| **Categories** | None - pure chronological list |
| **Visuals** | SVG geometric patterns as decoration (no raster images), gutter borders with repeating-linear-gradient |
| **Interactive** | Cmd+K search, theme switcher (light/dark/system) |
| **Polish** | RSS/Atom/JSON feeds, macOS-specific styling, semantic HTML |

**Worth Borrowing:**
- Dark/light/system theme toggle as a first-class feature
- Extreme minimalism works when content quality is high
- SVG-based decorative elements (performant, crisp at all sizes)
- Subscribe CTA prominently placed
- Feed format support (RSS, Atom, JSON)

---

### 5. Cursor Blog (cursor.com/blog)

**Design Philosophy:** Technical sophistication, developer-culture identity

| Element | Details |
|---------|---------|
| **Layout** | Asymmetric grid (columns 7-25 on md, 9-25 on lg), sticky sidebar navigation |
| **Typography** | Custom fonts: CursorGothic for headings, BerkeleyMono for code |
| **Colors** | Theme variables (--theme-bg, --theme-text, --theme-card-hex), light+dark |
| **Categories** | Filterable: product, research, company, customers, news |
| **Cards** | Title, excerpt, category badge, publication date, expandable |
| **Performance** | Lazy loading, code splitting, progressive enhancement |
| **Identity** | Monospace font signals developer culture |

**Worth Borrowing:**
- Custom brand fonts establish unique identity
- Category filtering with clear taxonomy
- Sticky sidebar navigation for long content
- "Research" as a content category (we could do "Engineering" or "How it Works")
- Customer case studies as a content type

---

## Part 3: Prioritized Improvement Recommendations

### Tier 1: Must-Have (P0) - Do First

#### 1.1 Add Featured Images to Blog Posts and Cards
**Impact:** High | **Effort:** Medium

- Add `image` field to blog post frontmatter
- Display 16:9 images on BlogHeroCard and BlogCard
- Use responsive images with `next/image` and proper sizing
- Fallback: Generate gradient placeholder cards with post title (like Linear's approach when no image)

**Reference:** Linear uses 16:9 aspect ratio images with responsive optimization params

#### 1.2 Implement OG Images for Social Sharing
**Impact:** High | **Effort:** Medium

- Use Next.js `generateMetadata` with `og:image` for each post
- Option A: Static OG images per post (manual, high quality)
- Option B: Dynamic OG images via `next/og` (ImageResponse API) - auto-generated from title + tags
- Include: Post title, Crewly logo, author name, reading time

**Reference:** All 5 competitors have rich social cards

#### 1.3 Add Dark/Light Mode Toggle
**Impact:** High | **Effort:** Medium

- Implement theme switching: dark (default), light, system
- Use CSS custom properties for all colors (already partially done via Tailwind)
- Persist preference in localStorage
- Add toggle button in header

**Reference:** Tailwind's implementation with localStorage + system preference detection is the gold standard

---

### Tier 2: High Priority (P1) - Do Soon

#### 2.1 Upgrade Typography to Inter
**Impact:** Medium | **Effort:** Low

- Replace Nunito with **Inter** (variable font)
- Inter is the de facto standard for developer-facing products (used by Linear, Tailwind, GitHub)
- Alternatively consider **Geist** (Vercel's font) for a more modern feel
- Keep monospace (Fira Code / JetBrains Mono) for code blocks

```css
/* Suggested font stack */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

#### 2.2 Add Category Filtering
**Impact:** Medium | **Effort:** Medium

- Add category filter pills at top of blog listing page
- Categories: Tutorial, Use Cases, Engineering, Comparison, Announcement
- Use URL params for deep-linkable filtered views: `/blog?category=tutorial`
- Style as pills similar to Linear: small rounded buttons, active state in indigo

#### 2.3 Widen Blog Listing Container
**Impact:** Medium | **Effort:** Low

- Change from `max-w-4xl` (896px) to `max-w-5xl` (1024px) or `max-w-6xl` (1152px)
- Allows for 3-column grid on larger screens
- More breathing room for card content + images

#### 2.4 Add Search (Cmd+K)
**Impact:** Medium | **Effort:** Medium-High

- Implement search dialog triggered by Cmd+K
- Search across post titles, descriptions, and content
- Options: Client-side search with Fuse.js (simple), or Algolia DocSearch (full-featured)
- Start simple: Fuse.js with pre-indexed content at build time

---

### Tier 3: Medium Priority (P2) - Next Sprint

#### 3.1 Enhance Blog Card Design
- Add subtle image/gradient header to each card
- Show reading time on listing page (not just detail)
- Add hover animation: slight scale + shadow (like Linear's arrow indicator)
- Consider alternating card sizes for visual rhythm

#### 3.2 Make Tags Interactive
- Link tags to filtered views: `/blog?tag=multi-agent`
- Show tag count on filter page
- Related posts should link by tag

#### 3.3 Upgrade Share Buttons
- Add Reddit, Hacker News (critical for dev audience)
- Consider floating share bar on desktop (sticky on scroll)
- Add "Share on X" with pre-filled tweet text

#### 3.4 Add Author Information
- Author bio section at bottom of posts
- Link to "More posts by [author]"
- Optional: Dedicated author pages

#### 3.5 Sticky Sidebar Table of Contents
- On desktop (lg+), move TOC to a sticky sidebar position
- Highlight active section as user scrolls (already have IntersectionObserver)
- Collapse on mobile to current inline format

#### 3.6 Enhance Footer
- Add organized link sections (Product, Docs, Community, Legal)
- Include newsletter signup form
- Social media links
- "Powered by" attribution

---

### Tier 4: Nice to Have (P3) - Backlog

#### 4.1 Newsletter Subscription
- Add email capture at top of blog listing and bottom of each post
- Integrate with email service (Resend, ConvertKit, or Buttondown)
- Show subscriber count as social proof

#### 4.2 Reading Progress Improvements
- Current progress bar is solid; consider adding:
  - Estimated time remaining
  - "Back to top" button that appears after scrolling past header

#### 4.3 RSS/Feed Improvements
- Make RSS link more prominent (icon in header nav)
- Add JSON Feed format support
- Include full content in feed (not just excerpts)

#### 4.4 Accessibility Audit
- Add skip-to-content link (Stripe has this)
- Verify focus states on all interactive elements
- Test with screen readers
- Add `prefers-reduced-motion` media query support

#### 4.5 Performance Optimizations
- Implement ISR (Incremental Static Regeneration) for blog routes
- Lazy load below-fold content
- Optimize images with blur placeholder data URLs

---

## Quick Reference: Design Token Recommendations

### Recommended Color Palette Updates

```
Background (dark):  #08090a  (deeper than current gray-950, matches Linear)
Background (light): #ffffff
Card (dark):        #111113
Card (light):       #fafafa
Border (dark):      rgba(255,255,255,0.08)
Border (light):     rgba(0,0,0,0.06)
Accent:             #6366f1  (keep indigo - it works well)
Text primary:       #ffffff (dark) / #0a0a0a (light)
Text secondary:     #a1a1aa (dark) / #71717a (light)
Text tertiary:      #52525b (dark) / #a1a1aa (light)
```

### Recommended Typography Scale

```
Hero title:    text-4xl lg:text-5xl, font-bold, -0.02em tracking
Post title:    text-3xl lg:text-4xl, font-bold, -0.02em tracking
Card title:    text-lg, font-semibold
Body:          text-base (16px), leading-relaxed (1.75)
Meta:          text-sm, text-secondary
Tags:          text-xs, uppercase, tracking-wide
```

### Recommended Spacing

```
Section gap:    py-20 (80px) - match Linear's generous spacing
Card gap:       gap-8
Card padding:   p-6 (standard) / p-8 lg:p-10 (hero)
Container:      max-w-5xl (listing) / max-w-3xl (article) - keep article width
```

---

## Implementation Priority Summary

| Priority | Item | Impact | Effort | Owner |
|----------|------|--------|--------|-------|
| P0 | Featured images on posts & cards | High | Medium | Sam |
| P0 | OG images for social sharing | High | Medium | Sam |
| P0 | Dark/light mode toggle | High | Medium | Sam |
| P1 | Upgrade font to Inter | Medium | Low | Sam |
| P1 | Category filtering pills | Medium | Medium | Sam |
| P1 | Widen listing container | Medium | Low | Sam |
| P1 | Cmd+K search | Medium | Medium-High | Sam |
| P2 | Enhanced card design | Medium | Low | Sam |
| P2 | Interactive tags | Low | Low | Sam |
| P2 | Better share buttons | Low | Low | Sam |
| P2 | Author information | Low | Medium | Sam |
| P2 | Sticky sidebar TOC | Medium | Medium | Sam |
| P2 | Enhanced footer | Low | Low | Sam |
| P3 | Newsletter subscription | Low | Medium | - |
| P3 | RSS improvements | Low | Low | - |
| P3 | Accessibility audit | Medium | Medium | - |
| P3 | Performance (ISR, lazy load) | Medium | Medium | - |

---

## Competitor Comparison Matrix

| Feature | Crewly | Vercel | Linear | Stripe | Tailwind | Cursor |
|---------|--------|--------|--------|--------|----------|--------|
| Dark mode | Dark only | Light only | Dark only | Light only | Both + system | Both |
| Post images | None | Yes | Yes (16:9) | Yes | No | No |
| Categories | No | Tags | Filter pills | Segmented | No | Filter pills |
| Search | No | No | Cmd+K | No | Cmd+K | No |
| OG images | No | Yes | Yes | Yes | Yes | Yes |
| TOC | Inline | No | No | No | No | Sticky sidebar |
| Share buttons | Basic | No | No | No | No | No |
| Reading progress | Yes | No | No | No | No | No |
| Code highlighting | Prism.js | Yes | N/A | Yes | Yes | Yes |
| Related posts | Yes | No | Yes | Yes | No | No |
| RSS | Subtle | Yes | No | No | Prominent | No |
| Newsletter | No | No | No | Yes | Prominent | No |
| Author pages | No | No | Yes | Yes | No | No |

---

## Appendix: Visual Analysis from Browser Screenshots

*Screenshots taken 2026-02-21 via Chrome browser (computer-use skill). Files at /tmp/crewly-blog-*.png and /tmp/competitor-*.png*

### Crewly Blog Listing (`/tmp/crewly-blog-listing2.png`, `/tmp/crewly-blog-listing-final.png`)

**What renders well:**
- Dark theme (gray-950 base) looks cohesive and modern
- Hero card with "Latest" badge clearly differentiates the newest post
- Indigo tags (comparison, crewly, multi-agent, orchestration) are legible and well-styled
- Navigation bar is clean: Home, Blog, Marketplace, Docs, GitHub
- RSS icon is present (top right of blog section)
- Reading time metadata visible on each card (9 min read, 4 min read, 10 min read)

**Visible issues from real render:**
- **No images anywhere** - the listing page is a wall of dark text-only cards; compared to Linear (which shows large 16:9 images per card), the page looks flat and monotonous
- **Hero card is text-heavy** - spans full width but has no visual hook; just title + description + tags. Wastes the prominent position
- **Card spacing is tight** - the 2-column standard cards (Getting Started, How to Run Multiple Claude Code Agents) feel cramped compared to the generous breathing room on Linear/Vercel
- **"Blog" heading is plain** - just `text-3xl font-bold text-white` with a gray subtitle. Compare to Tailwind's dramatic serif "Latest Updates" or Vercel's clean category tabs
- **No category filtering** - just a flat list. Vercel has 8 category tabs, Linear has 8 filter pills + search

### Crewly Blog Post Detail (`/tmp/crewly-blog-post-detail.png`)

**What renders well:**
- "Back to Blog" link in top-left is clear navigation
- Tag pills (COMPARISON, CREWAI, MULTI-AGENT, ORCHESTRATION) are uppercase, well-spaced
- Title typography is strong: large, bold, white, good line-height
- Description beneath title provides context
- Author line ("C Crewly Team | February 20, 2026 | 9 min read") is compact
- Share buttons (X, LinkedIn, link) positioned to the right of author
- Table of Contents is well-structured with clear hierarchy (numbered items for "5 Key Differences")

**Visible issues from real render:**
- **Author avatar is just a circle with letter "C"** - looks impersonal compared to Stripe's real author photos with titles (e.g., "Wisam Hirzalla, Product Lead, Billing")
- **TOC takes up significant vertical space** - it's inline, pushing content below the fold. A sticky sidebar would be more efficient
- **No hero image** - the area between navigation and title feels empty. Stripe's detail pages have prominent featured images
- **TOC background** (dark card with border) is visually heavy inline; would work better as a lightweight sidebar element

### Vercel Blog (`/tmp/competitor-vercel.png`)

**Key observations from render:**
- **Light theme with maximum whitespace** - feels spacious and premium
- **Category tab bar** at top: "All Posts | Engineering | Community | Company News | Customers | v0 | Changelog | Press" + search icon - this is exactly what Crewly needs
- **3-column card grid** with generous spacing
- **Each card has:** small icon/graphic at top, date, title, description, author avatars with names at bottom
- **Typography is restrained** - no bold colors, just black text with clear hierarchy
- **Author section** shows small circular avatars + names (e.g., "Eric and Allen") - personal touch
- **Search icon** (magnifying glass) in the category bar - clean integration

**Key takeaway for Crewly:** The category tab bar + search integration is the single highest-impact feature to copy.

### Linear Blog (`/tmp/competitor-linear.png`)

**Key observations from render:**
- **Deep dark theme** (#08090a) - noticeably darker than Crewly's gray-950, creating a more dramatic feel
- **"Now" as the blog name** - single word, distinctive branding
- **Filter pills:** All | Changelog | Community | News | Craft | AI | Practices | Press - compact and scannable
- **Search bar** with "Search..." placeholder and Cmd+K shortcut indicator + RSS icon
- **2-column featured card layout** with large black-and-white hero images (16:9 aspect ratio)
- **Image quality:** Professional photography (e.g., Cursor team working, Dandelion Chocolate factory shots)
- **Card metadata:** "Customer story | Feb 04, 2026" in small muted text above title
- **Card titles** are large, bold, white - immediate visual hierarchy
- **Descriptions** are in gray, truncated to 3 lines

**Key takeaway for Crewly:** The combination of dark theme + high-quality images + filter pills + search is the gold standard for dark-themed tech blogs. This is the closest reference design for Crewly.

### Tailwind Blog (`/tmp/competitor-tailwind.png`)

**Key observations from render:**
- **Light theme** with subtle gradient background (white to light blue-gray)
- **"Latest Updates"** in a dramatic large serif/display font - makes a statement
- **Subscribe section** prominently placed: email input field + "Subscribe" button in dark
- **No cards at all** - pure text list with dates on the left, titles + descriptions on the right
- **Ultra-minimal** - content quality carries the design
- **Subtle background graphic** - faint keyboard/device illustration behind the heading
- **Date format:** "JULY 25, 2025" in caps, muted, left-aligned

**Key takeaway for Crewly:** The prominent Subscribe CTA is high-impact, low-effort. Even without a full newsletter system, capturing emails for future use is valuable.

### Stripe Blog (`/tmp/competitor-stripe.png`)

**Key observations from render:**
- **Light theme with colorful gradient accents** - rainbow gradient at bottom of hero card, premium feel
- **Full-width hero article** spanning entire page width with split layout (text left, brand image right)
- **"Product" category** label in purple on the hero card
- **Author information is prominent:** Real photos in circles, name + title below (e.g., "Wisam Hirzalla, Product Lead, Billing" and "Scott Woody, CEO and Founder, Metronome")
- **"Read more" CTA** with arrow
- **Navigation is comprehensive:** Products, Solutions, Developers, Resources, Pricing + "Sign In" and "Contact sales"
- **"Stripe on X"** link in top right - social presence
- **Featured image** shows brand logos (Metronome + Stripe) on a clean white card background

**Key takeaway for Crewly:** Author information with real photos and titles dramatically increases credibility and trust. The gradient accent backgrounds add premium feel with minimal effort.

### Cursor Blog (`/tmp/competitor-cursor.png`)

**Key observations from render:**
- **Light theme** with very clean, minimal styling
- **Left sidebar categories:** All posts, Product, Research, Company, Undefined, News, Customers
- **No cards** - simple list format with title, description, category + date below
- **Category + date** format: "Research | Feb 18, 2026" in small muted text
- **Custom brand font** ("CURSOR" logo) establishes identity
- **Asymmetric layout** - sidebar (20%) + content (80%)
- **Chinese localization** (cursor.com/cn/blog) - showing multi-language support

**Key takeaway for Crewly:** The sidebar category navigation is an alternative to top-mounted filter pills. For a growing blog (10+ categories), sidebar scales better.

---

### Visual Comparison Summary

| Aspect | Crewly | Best-in-Class Reference |
|--------|--------|------------------------|
| **First impression** | Dense, text-heavy, monotonous | Linear: dramatic dark + images create visual energy |
| **Content discovery** | Scroll to find posts | Vercel: category tabs + search = instant filtering |
| **Card design** | Text-only dark cards, no images | Linear: 16:9 images with metadata overlay |
| **Hero section** | Oversized text card | Stripe: split layout with brand imagery + gradient |
| **Author trust** | Circle with initial letter | Stripe: real photos + name + title |
| **Theme** | Dark only | Tailwind: dark/light/system toggle |
| **Engagement** | No capture mechanism | Tailwind: prominent email subscribe |
| **Typography** | Nunito (casual) | Inter (professional) - used by Linear, Tailwind, GitHub |

### Quick Wins Sam Can Ship Today

1. **Widen container** from `max-w-4xl` to `max-w-5xl` (1 line change)
2. **Show reading time on cards** (data is already computed, just not displayed on listing page)
3. **Add negative letter-spacing** to titles: `tracking-tight` (-0.025em) for sharper look
4. **Deepen background** from `gray-950` to `#08090a` or `#0a0a0b` to match Linear's depth

---

*Note: This document is a living reference. Sam should implement items top-down by priority tier. Each P0 item alone will significantly improve the blog's competitive positioning. Screenshots are saved at /tmp/ for visual reference during implementation.*
