# Business Layer Implementation Plan

> **For:** Sam (Developer)
> **From:** Mia (Product Manager)
> **Date:** 2026-02-27
> **Spec:** `docs/okr/crewlyai-business-layer-spec.md` (APPROVED by Steve)
> **Codebase:** `/stevesprompt/apps/crewly/`
> **Estimated total:** 8–10 hours (1–2 dev days)

---

## Table of Contents

1. [Overview](#overview)
2. [A. Homepage Changes](#a-homepage-changes)
3. [B. New /business Page](#b-new-business-page)
4. [C. File List](#c-file-list)
5. [D. Task Breakdown](#d-task-breakdown)
6. [E. Design Notes](#e-design-notes)

---

## Overview

We are adding a **business conversion layer** on top of the existing developer-focused site. The existing homepage stays 100% untouched except for adding one CTA button to the navbar and one optional subtle line under the hero.

**What we are building:**
- 1 navbar CTA button ("For Business" → `/business`)
- 1 optional subtitle line on hero
- 1 new page at `/business` with 6 sections + developer crosslink

**What we are NOT touching:**
- Hero section, install command, demo UI, runtimes, features, FAQ, existing CTA
- /blog, /docs, /download, /marketplace pages
- globals.css, layout.tsx (except minor metadata if desired)
- Footer

---

## A. Homepage Changes

### A1. Navbar CTA Button

**File:** `src/components/Layout/Header.tsx`

**Current state (line 20–41):**
```tsx
<nav className="flex items-center gap-6">
  {NAV_LINKS.map((link) => (
    <Link ...>{link.label}</Link>
  ))}
  <a href="https://github.com/..." ...>GitHub</a>
</nav>
```

**Change:** Add a "For Business" CTA button after the GitHub link.

**Exact code to add after the GitHub `<a>` tag (before `</nav>`):**
```tsx
<Link
  href="/business"
  className="ml-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
>
  For Business
</Link>
```

**Why this placement:**
- After all nav links + GitHub = rightmost position = high visibility
- `ml-2` creates visual separation from text links
- Indigo pill button stands out from gray text links
- Matches the existing `bg-indigo-600` pattern used in Hero's "Browse Marketplace" button

**Mobile consideration:** The current navbar has no mobile menu (no hamburger). It renders as a horizontal flex row. The new button will stack naturally. If it overflows on small screens, we may need to add `hidden sm:inline-flex` and add a mobile menu later, but that's out of scope for now.

### A2. Optional Subtle Hero Line

**File:** `src/components/Landing/Hero.tsx`

**Current state (line 47–50):**
```tsx
<p className="text-lg text-gray-400 max-w-xl mx-auto mb-8">
  One command to launch a team of Claude Code, Gemini CLI, and Codex agents
  — coordinated through chat.
</p>
```

**Change:** Add a subtle second line below this `<p>` tag.

**Exact code to add after the closing `</p>` (before the install tabs div):**
```tsx
<p className="text-sm text-gray-500 max-w-md mx-auto mb-6 -mt-4">
  Also used to automate real business workflows beyond coding.{' '}
  <Link href="/business" className="text-indigo-400 hover:text-indigo-300 transition-colors">
    Learn more →
  </Link>
</p>
```

**Design rationale:**
- `text-sm` + `text-gray-500` = subtle, doesn't compete with main subtitle
- `-mt-4` tightens spacing since the previous `<p>` has `mb-8`
- Inline link to `/business` in indigo for discoverability
- This is **optional** per the spec — Sam can include it and Steve can decide to keep or remove

---

## B. New /business Page

### Page File

**File:** `src/app/business/page.tsx`

This is a Next.js App Router page. Following the same pattern as `/download/page.tsx`:
- Export `metadata` for SEO
- Default export the page component
- Import section components

**Page structure:**
```tsx
import type { Metadata } from 'next';
import { BusinessHero } from '@/components/Business/BusinessHero';
import { WhatWeOffer } from '@/components/Business/WhatWeOffer';
import { UseCases } from '@/components/Business/UseCases';
import { PricingRange } from '@/components/Business/PricingRange';
import { CaseStudy } from '@/components/Business/CaseStudy';
import { BookACall } from '@/components/Business/BookACall';
import { DevCrosslink } from '@/components/Business/DevCrosslink';

export const metadata: Metadata = {
  title: 'For Business — AI Workflow Automation',
  description: 'AI-powered workflow systems for your business. Automate operations, content, and outreach using Crewly.',
};

export default function BusinessPage() {
  return (
    <>
      <BusinessHero />
      <WhatWeOffer />
      <UseCases />
      <PricingRange />
      <CaseStudy />
      <BookACall />
      <DevCrosslink />
    </>
  );
}
```

---

### Section 1: BusinessHero

**File:** `src/components/Business/BusinessHero.tsx`

**Content (from spec):**
- Title: "AI-powered workflow systems for your business"
- Subtitle: "We help small and mid-sized teams automate operations, content, and outreach using AI-assisted workflows built on Crewly."
- Primary CTA: "Book a Call" → scrolls to `#book-a-call` anchor

**Layout:**
```
┌──────────────────────────────────────────┐
│  [pill badge: "For Business"]            │
│                                          │
│  AI-powered workflow systems             │
│  for your business                       │
│                                          │
│  subtitle text...                        │
│                                          │
│  [Book a Call]  [See Use Cases ↓]        │
└──────────────────────────────────────────┘
```

**Component spec:**
```tsx
// No props needed — static content
// 'use client' NOT needed (no interactivity)

// Styling pattern:
// - section: py-20 with gradient bg (match Hero.tsx pattern)
// - max-w-4xl mx-auto text-center
// - Badge: bg-indigo-600/10 border-indigo-500/20 rounded-full (same as Hero)
// - h1: text-5xl sm:text-6xl font-bold text-white
// - Subtitle: text-lg text-gray-400 max-w-xl mx-auto
// - Primary CTA: bg-indigo-600 hover:bg-indigo-500 rounded-lg px-8 py-3
//   → <a href="#book-a-call"> (smooth scroll)
// - Secondary link: text-gray-400 hover:text-white
//   → <a href="#use-cases">
```

**Estimated time: 30 min**

---

### Section 2: WhatWeOffer

**File:** `src/components/Business/WhatWeOffer.tsx`

**Content (from spec) — 3 blocks:**

| Block | Title | Description | Icon |
|-------|-------|-------------|------|
| 1 | SMB One-Click Install | Self-hosted Crewly setup, simple onboarding, runs with your own model (BYOM) | `Package` |
| 2 | AI Workflow Templates | LinkedIn lead gen, Xiaohongshu research, CRM follow-up, content ideation | `LayoutTemplate` |
| 3 | Custom Workflow Systems | Tailored automation, integration with your tools, workflow + prompt + pipeline design | `Wrench` |

**Layout:**
```
┌──────────────────────────────────────────┐
│  What We Offer                           │
│                                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│  │ icon    │ │ icon    │ │ icon    │    │
│  │ title   │ │ title   │ │ title   │    │
│  │ desc    │ │ desc    │ │ desc    │    │
│  │ • item  │ │ • item  │ │ • item  │    │
│  │ • item  │ │ • item  │ │ • item  │    │
│  └─────────┘ └─────────┘ └─────────┘    │
└──────────────────────────────────────────┘
```

**Component spec:**
```tsx
// No props — data is inline (only 3 blocks, not worth extracting to constants)
// Static component, no 'use client'

// Data structure:
const OFFERS = [
  {
    icon: 'Package',       // from lucide-react
    title: 'SMB One-Click Install',
    description: 'Get Crewly running on your own infrastructure with a simple setup.',
    bullets: [
      'Self-hosted — your data stays with you',
      'Simple onboarding wizard',
      'Bring Your Own Model (BYOM)',
    ],
  },
  // ... 2 more
];

// Styling: Reuse Features.tsx card pattern exactly
// - section: py-16
// - grid: grid-cols-1 md:grid-cols-3 gap-6
// - card: bg-gray-900/50 border border-gray-800 rounded-xl p-6
// - icon: w-8 h-8 text-indigo-400 mb-4
// - title: text-lg font-semibold text-white mb-2
// - bullets: text-sm text-gray-400, each with a gray-600 bullet dot
```

**Estimated time: 45 min**

---

### Section 3: UseCases

**File:** `src/components/Business/UseCases.tsx`

**Content (from spec) — 3 use cases:**

| Use Case | Input | Output |
|----------|-------|--------|
| LinkedIn Lead Generation | Target roles / companies | Structured lead list, outreach drafts |
| Xiaohongshu Research | Niche keywords | Trending topics, KOL list, content ideas |
| Education Operations | Class schedule + students | Attendance tracking, reports, communication workflows |

**Layout:**
```
┌──────────────────────────────────────────┐
│  Example Use Cases                id="use-cases"
│                                          │
│  ┌──────────────────────────────────┐    │
│  │ LinkedIn Lead Generation         │    │
│  │ Input: ...    →    Output: ...   │    │
│  └──────────────────────────────────┘    │
│  ┌──────────────────────────────────┐    │
│  │ Xiaohongshu Research             │    │
│  │ Input: ...    →    Output: ...   │    │
│  └──────────────────────────────────┘    │
│  ┌──────────────────────────────────┐    │
│  │ Education Operations             │    │
│  │ Input: ...    →    Output: ...   │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

**Component spec:**
```tsx
// Static, no 'use client'
// Add id="use-cases" on the section element for anchor scrolling

// Data structure:
const USE_CASES = [
  {
    title: 'LinkedIn Lead Generation',
    icon: 'Linkedin',   // lucide-react
    input: 'Target roles, companies, and industries',
    output: 'Structured lead list with outreach drafts',
  },
  // ... 2 more
];

// Layout: Stacked cards (not grid — they have input→output flow)
// - section: py-16 id="use-cases"
// - Each card: bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-4
// - Title: text-lg font-semibold text-white
// - Input/Output: two columns on desktop (grid-cols-2)
//   Left: "Input" label (text-xs uppercase text-gray-500) + text
//   Arrow icon between
//   Right: "Output" label + text
// - On mobile: stack vertically
```

**Estimated time: 45 min**

---

### Section 4: PricingRange

**File:** `src/components/Business/PricingRange.tsx`

**Content (from spec):**
- Setup: $500 – $2,000+
- Monthly: $200 – $500+
- Note: "Pricing depends on workflow complexity"

**Layout:**
```
┌──────────────────────────────────────────┐
│  Pricing                                 │
│                                          │
│  ┌──────────────┐  ┌──────────────┐      │
│  │ Setup        │  │ Monthly      │      │
│  │ $500-$2,000+ │  │ $200-$500+   │      │
│  │ one-time     │  │ ongoing      │      │
│  └──────────────┘  └──────────────┘      │
│                                          │
│  "Pricing depends on workflow complexity"│
│  [Book a Call for a Quote]               │
└──────────────────────────────────────────┘
```

**Component spec:**
```tsx
// Static, no 'use client'

// Simple two-card layout
// - section: py-16
// - Heading: text-2xl font-bold text-center text-white
// - Cards container: grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto
// - Each card: bg-gray-900/50 border border-gray-800 rounded-xl p-8 text-center
// - Price: text-3xl font-bold text-white
// - Label: text-sm text-gray-400
// - Note: text-sm text-gray-500 italic text-center mt-6
// - CTA: text link to #book-a-call
```

**Estimated time: 30 min**

---

### Section 5: CaseStudy

**File:** `src/components/Business/CaseStudy.tsx`

**Content (from spec):**
- STEAM Fun (科学奶酪) education project
- 100+ students managed
- Workflows automated: attendance, reports, parent communication
- Result: reduced manual work

**Layout:**
```
┌──────────────────────────────────────────┐
│  Case Study                              │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ gradient card                        ││
│  │                                      ││
│  │ STEAM Fun (科学奶酪)                 ││
│  │ AI-powered education operations      ││
│  │                                      ││
│  │ 100+        5         3              ││
│  │ students    agents    workflows      ││
│  │                                      ││
│  │ "Automated student data management,  ││
│  │  parent communication, teaching      ││
│  │  record archival, and scheduling."   ││
│  └──────────────────────────────────────┘│
└──────────────────────────────────────────┘
```

**Component spec:**
```tsx
// Static, no 'use client'

// Single feature card with gradient background
// - section: py-16
// - Card: bg-gradient-to-br from-indigo-950/40 to-purple-950/20
//   border border-indigo-800/30 rounded-2xl p-8 sm:p-12
//   max-w-3xl mx-auto
// - Eyebrow: text-xs uppercase tracking-wider text-indigo-400 mb-2
// - Title: text-2xl font-bold text-white
// - Metrics row: grid grid-cols-3 gap-4 my-8
//   Each: number (text-3xl font-bold text-white) + label (text-sm text-gray-400)
// - Description: text-gray-300 text-base leading-relaxed
```

**Estimated time: 30 min**

---

### Section 6: BookACall

**File:** `src/components/Business/BookACall.tsx`

**Content (from spec):**
- Pre-qualification form with 4 fields
- After submission → show calendar booking link
- Fields: Business type, Workflow to automate, Team size, Budget range

**Layout:**
```
┌──────────────────────────────────────────┐
│  Book a Call                 id="book-a-call"
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ form card                            ││
│  │                                      ││
│  │ Business type:     [text input     ] ││
│  │ Workflow:          [text input     ] ││
│  │ Team size:         [text input     ] ││
│  │ Budget range:      [dropdown       ] ││
│  │                                      ││
│  │      [Submit & Book a Call]          ││
│  └──────────────────────────────────────┘│
│                                          │
│  (after submit: show Calendly link)      │
└──────────────────────────────────────────┘
```

**Component spec:**
```tsx
// 'use client' — needs state for form + submit toggle
// This is the most complex component

// State:
// - formData: { businessType, workflow, teamSize, budget }
// - submitted: boolean (toggles form → calendar view)

// Pre-submit view: form with 4 fields
// Post-submit view: "Thank you!" + Calendly link button
//   (Calendly link opens in new tab — simplest integration)
//   OR: embed Calendly inline via iframe

// Form fields:
// 1. Business type — <input type="text" placeholder="e.g. Education, E-commerce, SaaS">
// 2. What workflow to automate? — <textarea placeholder="e.g. Lead generation, content publishing">
// 3. Team size — <input type="text" placeholder="e.g. 1-5, 5-20, 20+">
// 4. Budget range — <select> with options:
//      "<$500", "$500–$2k", "$2k+", "Not sure yet"

// On submit:
//   Option A (simple): Open mailto: link with form data in body
//   Option B (Calendly): Set submitted=true, show Calendly link
//   Option C (form service): POST to Formspree/Getform endpoint
//   Recommendation: Option B (Calendly) for now. Form data stored locally
//   and/or sent via a simple Formspree endpoint.

// Styling:
// - section: py-20 id="book-a-call"
// - Card: bg-gray-900/50 border border-gray-800 rounded-2xl p-8 max-w-lg mx-auto
// - Inputs: bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white
//   focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
// - Labels: text-sm font-medium text-gray-300 mb-1.5
// - Submit button: w-full bg-indigo-600 hover:bg-indigo-500 text-white
//   font-medium py-3 rounded-lg
// - Post-submit: centered text with Calendly button

// CALENDLY INTEGRATION:
// Steve needs to create a Calendly account and provide the link.
// For now, use placeholder: https://calendly.com/crewly/discovery
// The link is easily swappable via a constant.
```

**Estimated time: 1.5 hours**

---

### Section 7: DevCrosslink

**File:** `src/components/Business/DevCrosslink.tsx`

**Content (from spec):**
- "Want to explore Crewly as a developer?" → link to /docs and GitHub

**Layout:**
```
┌──────────────────────────────────────────┐
│  centered subtle section                 │
│  "Want to explore Crewly as a developer?"│
│  [Go to Docs]  [View on GitHub]          │
└──────────────────────────────────────────┘
```

**Component spec:**
```tsx
// Static, no 'use client'
// - section: py-12 border-t border-gray-800
// - Text: text-gray-500 text-center
// - Links: text-indigo-400 hover:text-indigo-300
// - Two inline links with arrow icons
```

**Estimated time: 15 min**

---

## C. File List

### Files to CREATE (8 files)

| # | Path | Type | Description |
|---|------|------|-------------|
| 1 | `src/app/business/page.tsx` | Page | /business route — imports 7 section components |
| 2 | `src/components/Business/BusinessHero.tsx` | Component | Hero with title, subtitle, CTA |
| 3 | `src/components/Business/WhatWeOffer.tsx` | Component | 3 offering cards |
| 4 | `src/components/Business/UseCases.tsx` | Component | 3 use case cards with input→output |
| 5 | `src/components/Business/PricingRange.tsx` | Component | 2 pricing cards |
| 6 | `src/components/Business/CaseStudy.tsx` | Component | STEAM Fun case study card |
| 7 | `src/components/Business/BookACall.tsx` | Component | Pre-qual form + Calendly link |
| 8 | `src/components/Business/DevCrosslink.tsx` | Component | Developer crosslink section |

### Files to MODIFY (2 files)

| # | Path | Change |
|---|------|--------|
| 1 | `src/components/Layout/Header.tsx` | Add "For Business" CTA button after GitHub link |
| 2 | `src/components/Landing/Hero.tsx` | **Optional:** Add subtle business line below subtitle |

### Files NOT to touch

Everything else. Specifically:
- `src/app/page.tsx` — homepage composition (NO CHANGES)
- `src/app/layout.tsx` — root layout (NO CHANGES)
- `src/app/globals.css` — styles (NO CHANGES)
- `src/lib/constants.ts` — constants (NO CHANGES needed — Calendly URL goes in BookACall component)
- `src/components/Landing/*` — all 9 landing components except optional Hero.tsx line
- `src/components/Layout/Footer.tsx` — footer (NO CHANGES)
- `src/app/blog/`, `src/app/docs/`, `src/app/download/`, `src/app/marketplace/` — untouched

---

## D. Task Breakdown for Sam

### Task 1: Scaffold `/business` page and component directory (15 min)

1. Create directory: `src/components/Business/`
2. Create `src/app/business/page.tsx` with all imports and metadata
3. Create placeholder components that each render `<section>TODO</section>`
4. Verify: `npm run dev` → navigate to `localhost:4001/business` → see placeholders

### Task 2: Build BusinessHero component (30 min)

1. Implement `src/components/Business/BusinessHero.tsx`
2. Copy styling pattern from `Landing/Hero.tsx` (gradient bg, badge, heading)
3. Add "Book a Call" CTA button (links to `#book-a-call`)
4. Add "See Use Cases" secondary link (links to `#use-cases`)
5. Verify: renders correctly on desktop + mobile widths

### Task 3: Build WhatWeOffer component (45 min)

1. Implement `src/components/Business/WhatWeOffer.tsx`
2. Define `OFFERS` array with 3 items (title, icon, description, bullets)
3. Use `Features.tsx` card pattern: `bg-gray-900/50 border border-gray-800 rounded-xl`
4. Import icons from `lucide-react`: `Package`, `LayoutTemplate`, `Wrench`
5. Verify: 3-column on desktop, 1-column on mobile

### Task 4: Build UseCases component (45 min)

1. Implement `src/components/Business/UseCases.tsx`
2. Add `id="use-cases"` on section element
3. Define `USE_CASES` array with 3 items
4. Each card: title + icon + input/output two-column layout
5. Use `ArrowRight` icon between input and output columns
6. Import icons: `Linkedin`, `Search`, `GraduationCap` from lucide-react
7. Verify: cards stack well on mobile

### Task 5: Build PricingRange component (30 min)

1. Implement `src/components/Business/PricingRange.tsx`
2. Two cards: "Setup" ($500–$2,000+) and "Monthly" ($200–$500+)
3. Add "Pricing depends on workflow complexity" note below
4. Add "Book a Call for a Quote" link to `#book-a-call`
5. Verify: two-column on desktop, stack on mobile

### Task 6: Build CaseStudy component (30 min)

1. Implement `src/components/Business/CaseStudy.tsx`
2. Single gradient card with STEAM Fun details
3. Metrics row: 3 numbers (100+ students, 5 agents, 3 workflows)
4. Description paragraph
5. Verify: looks good on all screen sizes

### Task 7: Build BookACall component (1.5 hours)

1. Implement `src/components/Business/BookACall.tsx` (needs `'use client'`)
2. Add `id="book-a-call"` on section element
3. Build form with 4 fields:
   - Business type (text input)
   - Workflow to automate (textarea)
   - Team size (text input)
   - Budget range (select dropdown: <$500, $500–$2k, $2k+, Not sure yet)
4. On submit: set `submitted = true`, show thank-you message + Calendly button
5. Calendly URL: use constant `CALENDLY_URL = 'https://calendly.com/crewly/discovery'` at top of file (placeholder — Steve will provide real URL)
6. Optional: Also `mailto:` with form data as email body for backup lead capture
7. Verify: form submits, toggles to calendar view, looks good on mobile

### Task 8: Build DevCrosslink component (15 min)

1. Implement `src/components/Business/DevCrosslink.tsx`
2. Simple centered section with two links: Docs + GitHub
3. Verify: renders at bottom of /business page

### Task 9: Add navbar CTA to Header.tsx (15 min)

1. Open `src/components/Layout/Header.tsx`
2. Add "For Business" link after the GitHub `<a>` tag
3. Style as indigo pill button: `bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg`
4. Verify: visible on all pages, correctly links to /business, active state works

### Task 10: Optional — Add subtle hero line (15 min)

1. Open `src/components/Landing/Hero.tsx`
2. Add a `<p>` tag after the subtitle with "Also used to automate real business workflows beyond coding."
3. Include "Learn more →" link to /business
4. Style: `text-sm text-gray-500` (very subtle)
5. Verify: doesn't visually compete with the main hero content

### Task 11: Final QA + build (30 min)

1. Run `npm run build` — verify no TypeScript errors
2. Test all pages: /, /business, /blog, /docs, /download, /marketplace
3. Test responsive: desktop (1440px), tablet (768px), mobile (375px)
4. Test all links: navbar CTA, hero line, #book-a-call anchors, Calendly button
5. Test form submission flow
6. Verify existing pages are completely unchanged

---

## E. Design Notes

### Color Scheme

Use the existing site's color system. Do NOT introduce new colors.

| Element | Color | Tailwind Class |
|---------|-------|---------------|
| Background | #08090a | `bg-[#08090a]` (body, inherited) |
| Card bg | gray-900/50 | `bg-gray-900/50` |
| Card border | gray-800 | `border-gray-800` |
| Card hover | gray-700 | `hover:border-gray-700` |
| Primary text | white | `text-white` |
| Secondary text | gray-400 | `text-gray-400` |
| Muted text | gray-500 | `text-gray-500` |
| Accent/CTA | indigo-600 | `bg-indigo-600` |
| Accent hover | indigo-500 | `hover:bg-indigo-500` |
| Accent text | indigo-400 | `text-indigo-400` |
| Gradient accent | indigo→purple | `from-indigo-950/40 to-purple-950/20` |
| Badge bg | indigo-600/10 | `bg-indigo-600/10 border-indigo-500/20` |

### Typography

| Element | Style |
|---------|-------|
| Page title | `text-5xl sm:text-6xl font-bold text-white` |
| Section heading | `text-2xl sm:text-3xl font-bold text-white` |
| Card title | `text-lg font-semibold text-white` |
| Body text | `text-base text-gray-400` or `text-gray-300` |
| Small text | `text-sm text-gray-400` |
| Labels | `text-sm font-medium text-gray-300` |
| Badges/eyebrows | `text-xs font-medium text-indigo-400 uppercase tracking-wider` |

Font: Nunito (already loaded in layout.tsx via `--font-nunito`).

### Responsive Behavior

| Component | Desktop | Mobile |
|-----------|---------|--------|
| WhatWeOffer | 3 columns | 1 column |
| UseCases | 2-col input→output per card | Stacked |
| PricingRange | 2 columns | 1 column |
| CaseStudy metrics | 3 columns | 3 columns (numbers are small) |
| BookACall form | Centered max-w-lg | Full width with padding |
| Nav CTA | Visible | Hidden if needed (`hidden sm:inline-flex`) |

### Animations

Keep it minimal to match the existing site:
- **No** page transitions, scroll animations, or parallax
- **Yes** hover transitions on buttons/cards (already in Tailwind: `transition-colors`)
- **Optional:** Form submit → calendar view can use a simple fade-in (`opacity` transition)

### Dependencies

**No new npm dependencies needed.**
- Icons: `lucide-react` (already installed, v0.561.0)
- Styling: Tailwind CSS v4 (already configured)
- Routing: Next.js App Router (already configured)
- Form: Pure React state (no form library needed for 4 fields)

### Calendly Integration

For the initial launch, use a **direct link** (not embed):
```tsx
const CALENDLY_URL = 'https://calendly.com/crewly/discovery';
// Steve will provide the real URL — this is a placeholder
```

The link opens in a new tab via `target="_blank"`. This requires zero additional dependencies and is the simplest path. A Calendly embed (iframe) can be added later if desired.

---

## Summary

| Metric | Value |
|--------|-------|
| Files created | 8 |
| Files modified | 2 (Header.tsx + optional Hero.tsx) |
| Files not touched | Everything else |
| New dependencies | 0 |
| Estimated time | 8–10 hours |
| Complexity | Low (static page, simple form) |

**One sentence:** Add a "For Business" button to the navbar and build a single new `/business` page with 7 sections that converts business visitors to qualified leads via a form + Calendly link.
