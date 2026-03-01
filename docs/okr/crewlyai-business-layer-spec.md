# Crewly Website Update — Business Layer (Execution Spec)

> Owner: Steve
> Status: APPROVED — Ready for implementation
> Date: 2026-02-27

## Objective

We are NOT redesigning the existing developer-focused homepage.
We are only adding a business conversion layer on top of the current open-source site.

Goal:
> Keep Crewly as a developer-first open-source project
> while adding a clear path for business users to work with us.

---

## Part 1 — Homepage Changes (Minimal)

### Keep everything as-is

Do NOT change:
- hero section
- install command
- demo UI
- runtime section
- multi-agent features
- FAQ
- existing CTAs

This is our developer credibility layer.

### Add ONE business CTA entry

Add a secondary CTA on homepage:

Location options (pick 1–2):
- top-right navbar
- hero secondary button
- bottom CTA section

CTA text options (choose one):
- For Business
- Business Solutions
- Automate Your Business Workflows

CTA behavior: This button should link to → `/business`

### Optional (small line under hero)

Add one subtle line under hero:
> "Also used to automate real business workflows beyond coding."

Keep it subtle, not salesy.

---

## Part 2 — New Page: `/business`

This page is ONLY for business users / SMB clients.

### Section 1 — Hero

Title:
> AI-powered workflow systems for your business

Subtitle:
> We help small and mid-sized teams automate operations, content, and outreach using AI-assisted workflows built on Crewly.

CTA (primary) → Book a Call

### Section 2 — What We Offer

3 blocks:

1. **SMB One-Click Install**
   - self-hosted Crewly setup
   - simple onboarding
   - runs with your own model (BYOM)

2. **AI Workflow Templates**
   Examples:
   - LinkedIn lead generation workflows
   - Xiaohongshu research systems
   - CRM follow-up automation
   - content ideation pipelines

3. **Custom Workflow Systems**
   - tailored automation for your business
   - integration with your tools
   - workflow + prompt + data pipeline design

### Section 3 — Example Use Cases

Show 3–4 simple examples:

**Example 1 — LinkedIn Lead Generation**
- Input: target roles / companies
- Output: structured lead list, outreach drafts

**Example 2 — Xiaohongshu Research**
- Input: niche keywords
- Output: trending topics, KOL list, content ideas

**Example 3 — Education Operations (STEAM case)**
- Input: class schedule + students
- Output: attendance tracking, reports, communication workflows

### Section 4 — Pricing Range (Simple)

Show simple range (no complicated SaaS pricing):
- Setup: $500 – $2,000+
- Monthly: $200 – $500+

Add note:
> pricing depends on workflow complexity

### Section 5 — Case Study Highlight

Use existing STEAM Fun project. Include:
- size (100+ students)
- workflows automated
- result (reduced manual work)

### Section 6 — Book a Call

Add booking CTA. But require pre-qualification form first.

**Lead Qualification Form fields:**
1. Business type
2. What workflow do you want to automate?
3. Team size
4. Budget range:
   - <$500
   - $500–$2k
   - $2k+

Only after submission → show calendar booking

### Optional: Link back to open source

At bottom:
> Want to explore Crewly as a developer?
> → Go to Docs / GitHub

---

## Out of Scope (Do NOT build now)

- no SaaS login system
- no billing system
- no user accounts
- no cloud hosting UI
- no agent marketplace

Keep everything simple and static.

---

## Success Criteria

After launch:
- homepage remains dev-focused
- business users can discover `/business`
- qualified leads can book calls
- we can close first SMB customers

---

## Final Positioning

Crewly is:
> an open-source AI orchestration system for developers
> and a workflow automation solution for businesses
