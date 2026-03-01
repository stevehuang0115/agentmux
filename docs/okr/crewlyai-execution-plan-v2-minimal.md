# crewlyai.com Execution Plan v2 — Minimal Changes

> **Status:** DRAFT — Pending Steve Approval
> **Author:** Mia (Product Manager)
> **Date:** 2026-02-27
> **Core principle:** Keep everything that works. Only ADD business conversion layer.

---

## Scope Summary

| Category | Items |
|----------|-------|
| **Files modified** | 3 (page.tsx, Header.tsx, constants.ts) |
| **New components** | 3 (WhatWeBuild.tsx, CaseStudyPreview.tsx, BookACall.tsx) |
| **New pages** | 2 (/enterprise, /case) |
| **Files deleted** | 0 |
| **Existing sections changed** | 0 |

**Total estimated work: ~8 hours (1 developer day)**

---

## Part 1: Homepage — Add 3 Sections (no changes to existing)

### Current homepage section order (KEEP ALL):
1. Hero ✅ keep
2. DemoPlayer ✅ keep
3. SocialProof ✅ keep
4. WhatIsCrewly ✅ keep
5. Runtimes ✅ keep
6. Features ✅ keep
7. HowItWorks ✅ keep
8. FAQ ✅ keep
9. CTA ✅ keep

### New section order (INSERT 3 sections before FAQ):
1. Hero
2. DemoPlayer
3. SocialProof
4. WhatIsCrewly
5. Runtimes
6. Features
7. HowItWorks
8. **→ NEW: WhatWeBuild** (What We Build for Businesses)
9. **→ NEW: CaseStudyPreview** (STEAM Fun case teaser)
10. FAQ
11. **→ REPLACE CTA with: BookACall** (Book a Call CTA)

### Section A: WhatWeBuild

**File:** `/stevesprompt/apps/crewly/src/components/Landing/WhatWeBuild.tsx`

**Layout:** 3-card grid (same pattern as `Runtimes.tsx` and `Features.tsx`)

**Content:**

```
Section heading: "What We Build for Businesses"
Subheading: "Custom AI teams tailored to your operations"

Card 1: AI Content Teams
Icon: PenTool (from lucide-react)
"Writing, editing, publishing, and distribution — handled by your AI content team."

Card 2: AI Operations Teams
Icon: Settings (from lucide-react)
"Customer communication, scheduling, reporting, and archiving — automated."

Card 3: AI Workflow Automation
Icon: Workflow (from lucide-react)
"Cross-tool integrations, data processing, notifications — connected."

Bottom CTA: "See it in action →" (links to /case)
```

**Styling:** Match existing card pattern from `Features.tsx`:
- `bg-gray-900/50 border border-gray-800 rounded-xl p-6`
- Section wrapper: `py-16` with max-w-6xl container
- Dark theme consistent with rest of site

**Estimated time: 1 hour**

### Section B: CaseStudyPreview

**File:** `/stevesprompt/apps/crewly/src/components/Landing/CaseStudyPreview.tsx`

**Layout:** Single card with left text / right visual (or stacked on mobile)

**Content:**

```
Eyebrow: "Case Study"
Heading: "STEAM Fun (科学奶酪) — AI-Powered Education Operations"
Body: "A STEM education company with 100+ students automated their
entire operations with a custom Crewly AI team: student data management,
parent communication, teaching record archival, and scheduling."

Results (3 metrics):
- "5 AI agents" — running daily operations
- "100+ students" — managed automatically
- "3 workflows" — fully automated

CTA button: "Read Full Case Study →" (links to /case)
```

**Styling:**
- Full-width card: `bg-gradient-to-r from-indigo-900/20 to-purple-900/20 border border-indigo-800/30 rounded-2xl p-8`
- Section wrapper: `py-16`

**Estimated time: 1 hour**

### Section C: BookACall (replaces existing CTA)

**File:** `/stevesprompt/apps/crewly/src/components/Landing/BookACall.tsx`

**Layout:** Centered text block with prominent button (similar to existing CTA.tsx pattern)

**Content:**

```
Heading: "Ready to build your AI team?"
Subheading: "Tell us about your business and we'll design a custom AI operations team for you."

Primary CTA: [Book a Call] → links to Calendly or Cal.com booking page
Secondary text: "Or install the open-source framework: curl -fsSL https://crewlyai.com/install | bash"
```

**Styling:** Match existing `CTA.tsx` pattern but replace install command focus with booking CTA.

**Estimated time: 30 minutes**

---

## Part 2: Navigation — Add 2 Items

### File to modify: `/stevesprompt/apps/crewly/src/components/Layout/Header.tsx`

### Current nav (KEEP ALL):
```
Home | Download | Blog | Marketplace | Docs | GitHub
```

### New nav:
```
Home | Download | Blog | Marketplace | Docs | GitHub | For Business | [Book a Call]
```

### Changes:

1. **Add "For Business" link** — regular nav link pointing to `/enterprise`
2. **Add "Book a Call" button** — styled as primary CTA button (indigo bg, white text, rounded-full)

### Implementation:

**In constants.ts** (`/stevesprompt/apps/crewly/src/lib/constants.ts`):
```typescript
// Add to NAV_LINKS array:
{ label: 'For Business', href: '/enterprise' },
```

**In Header.tsx**:
- Add "Book a Call" as a separate styled button (not in NAV_LINKS array, since it needs different styling)
- Button links to Calendly/Cal.com URL (or /enterprise#book-a-call as interim)
- Style: `bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-full text-sm font-medium`
- Position: After nav links, before mobile menu toggle

**Estimated time: 30 minutes**

---

## Part 3: New Page — /enterprise

### File: `/stevesprompt/apps/crewly/src/app/enterprise/page.tsx`

### Purpose: Core B2B conversion page — "Get a custom AI team for your business"

### Layout (single page, 5 sections):

**Section 1: Hero**
```
Heading: "A custom AI operations team for your business"
Subheading: "We design, deploy, and optimize AI agent teams
tailored to your specific workflows and operations."
CTA: [Schedule a Call]
```

**Section 2: Use Cases (4 cards)**
```
Education — Student management, parent communication, scheduling
E-commerce — Inventory, customer support, order processing
Content Teams — Writing, editing, publishing, distribution
Service Businesses — Booking, invoicing, client communication
```

**Section 3: How We Work (4 steps)**
```
1. Discovery — We learn your business, workflows, and goals
2. Team Design — We architect AI agent roles and processes
3. Deployment — We set up and configure your AI team (local or hybrid)
4. Optimization — We continuously improve based on results
```

**Section 4: Pricing Range**
```
Heading: "Investment"
Setup: $500 – $2,000+ (one-time, based on complexity)
Monthly Support: $200 – $500+ (ongoing optimization)
Note: "Every engagement starts with a free discovery call."
```

**Section 5: Book a Call CTA**
```
Heading: "Let's build your AI team"
Subheading: "Start with a free 30-minute discovery call."
CTA: [Book a Call] → Calendly embed or link

Qualification form fields (below CTA):
- Industry / business type
- 1-2 core problems to solve
- Current team size
- Budget range (dropdown: <$1k, $1-3k, $3-5k, $5k+)
```

**Styling:** Same dark theme as rest of site. Reuse card patterns from Landing components.

**Estimated time: 3 hours**

---

## Part 4: New Page — /case

### File: `/stevesprompt/apps/crewly/src/app/case/page.tsx`

### Purpose: Detailed STEAM Fun case study

### Layout (single page, 6 sections):

**Section 1: Hero**
```
Eyebrow: "Case Study"
Heading: "How STEAM Fun Automated Their Education Operations with AI"
Subheading: "A STEM education company serving 100+ students
replaced manual operations with a 5-agent AI team."
```

**Section 2: The Challenge**
```
- Managing student and class data across spreadsheets
- Manual parent communication for attendance, makeup classes, portfolio
- Time-consuming teaching record documentation
- Scheduling conflicts for makeup classes (到班 vs 在家)
```

**Section 3: The Solution**
```
"We built a custom Crewly AI team with 5 specialized agents:"
Agent 1: Operations Manager — scheduling, attendance, class management
Agent 2: Content Curator — teaching record archival, portfolio generation
Agent 3: Parent Liaison — automated parent communication and updates
Agent 4: Quality Reviewer — AI-powered class review and feedback
Agent 5: Data Analyst — student progress tracking and reporting
```

**Section 4: Results**
```
3 metrics cards:
- "5 AI agents" running daily
- "100+ students" managed
- "3 core workflows" fully automated (communication, records, scheduling)
```

**Section 5: Tech Stack (brief)**
```
"Built with Crewly's open-source orchestration framework"
- Multi-agent coordination
- Persistent memory across sessions
- Custom skills for education workflows
```

**Section 6: CTA**
```
"Want similar results for your business?"
[Book a Call]
```

**Estimated time: 2 hours**

---

## Part 5: Domain Migration

### Prerequisite: Steve provides Cloudflare access or DNS delegation

**Step 1: Cloudflare DNS** (~15 min)
- Add A record: `crewlyai.com` → CELB2 IP (same as crewly.stevesprompt.com)
- Add A record: `www.crewlyai.com` → CELB2 IP
- Cloudflare handles SSL automatically (Full/Strict mode)

**Step 2: Nginx config on CELB2** (~15 min)
- Create `/etc/nginx/sites-available/crewlyai.conf`
- Same upstream config as crewly.stevesprompt.com: proxy to ceappnode1/2:10014
- Enable: `ln -s ../sites-available/crewlyai.conf ../sites-enabled/`
- Test + reload: `nginx -t && systemctl reload nginx`

**Step 3: 301 redirect from old domain** (~10 min)
- Update crewly.stevesprompt.com nginx config to:
  ```nginx
  return 301 https://crewlyai.com$request_uri;
  ```

**Step 4: Update app code** (~15 min)
- Update `SITE_URL` in constants.ts: `https://crewlyai.com`
- Update any hardcoded references to crewly.stevesprompt.com
- Bump version in package.json (1.0.15 → 1.0.16)

**Step 5: Build & deploy** (~15 min)
```bash
# From /stevesprompt root
docker build --platform linux/amd64 -f apps/crewly/Dockerfile \
  -t dr.careerengine.dev/crewly-web:1.0.16 .
docker push dr.careerengine.dev/crewly-web:1.0.16

# Update docker-compose.yml in ce-core
# Deploy to both nodes
cd ce-core/do-provision
sh masterScript.sh CEAppNode1 restart crewly-web
sh masterScript.sh CEAppNode2 restart crewly-web
```

**Step 6: Verify** (~10 min)
- `curl -I https://crewlyai.com` → 200
- `curl -I https://crewly.stevesprompt.com` → 301 → crewlyai.com
- Check all pages render correctly

**Estimated time: 1.5 hours**

---

## Part 6: Book a Call Integration

### Recommended: Cal.com (open-source) or Calendly

**Option A: Cal.com (Recommended)**
- Free tier available
- Open-source alignment with Crewly brand
- Embed via iframe or popup
- Custom qualification form built-in

**Option B: Calendly**
- More polished UX
- Free tier: 1 event type
- Easy embed

### Implementation:
1. Create account + configure 30-min "Discovery Call" event
2. Add embed script to /enterprise page
3. Use direct link for "Book a Call" buttons across site
4. Qualification form: either use Cal.com's built-in form or add pre-booking form on /enterprise

**Estimated time: 30 minutes** (after account setup)

---

## Timeline

### P0 — This Week (~8 hours total)

| Task | File(s) | Est. |
|------|---------|------|
| Create WhatWeBuild.tsx component | New file | 1h |
| Create CaseStudyPreview.tsx component | New file | 1h |
| Create BookACall.tsx component | New file | 30m |
| Add 3 sections to page.tsx | Modify page.tsx (3 imports + 3 lines) | 15m |
| Add nav items to Header.tsx | Modify Header.tsx | 30m |
| Add constant to constants.ts | Modify constants.ts (1 line) | 5m |
| Create /enterprise page | New file | 3h |
| Create /case page | New file | 2h |
| **Total** | | **~8h** |

### P1 — Next Week (~2 hours)

| Task | Est. |
|------|------|
| Domain migration (Cloudflare + Nginx + deploy) | 1.5h |
| Cal.com / Calendly setup + embed | 30m |
| **Total** | **~2h** |

### P2 — Later

| Task | Est. |
|------|------|
| Add 2nd case study (when available) | 2h |
| Refine enterprise page copy based on first calls | 1h |
| Add qualification form if not using Cal.com's | 1h |

---

## Files Changed — Complete List

### Modified (3 files):
1. `/stevesprompt/apps/crewly/src/app/page.tsx` — Add 3 imports + insert 3 components (6 lines changed)
2. `/stevesprompt/apps/crewly/src/components/Layout/Header.tsx` — Add "For Business" link + "Book a Call" button
3. `/stevesprompt/apps/crewly/src/lib/constants.ts` — Add 1 nav link entry + update SITE_URL

### New (5 files):
4. `/stevesprompt/apps/crewly/src/components/Landing/WhatWeBuild.tsx` — New component
5. `/stevesprompt/apps/crewly/src/components/Landing/CaseStudyPreview.tsx` — New component
6. `/stevesprompt/apps/crewly/src/components/Landing/BookACall.tsx` — New component
7. `/stevesprompt/apps/crewly/src/app/enterprise/page.tsx` — New page
8. `/stevesprompt/apps/crewly/src/app/case/page.tsx` — New page

### Not touched:
- Hero.tsx ❌
- DemoPlayer.tsx ❌
- Features.tsx ❌
- Runtimes.tsx ❌
- WhatIsCrewly.tsx ❌
- SocialProof.tsx ❌
- HowItWorks.tsx ❌
- FAQ.tsx ❌
- Footer.tsx ❌
- /blog ❌
- /docs ❌
- /download ❌
- /marketplace ❌
- globals.css ❌

---

## Decision Points for Steve

1. **Booking tool**: Cal.com (free, open-source) vs Calendly (polished)?
2. **Booking link**: Use direct external link or embed on /enterprise?
3. **Domain**: When is Cloudflare DNS access available for crewlyai.com?
4. **CTA section**: Replace existing curl-install CTA entirely, or keep both (install + book a call)?

---

**一句话总结：**
修改 3 个文件，新建 5 个文件，保留现有所有内容不动。1 天搞定。
