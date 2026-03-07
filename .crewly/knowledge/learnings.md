# Project Learnings: agentmux

This file contains learnings discovered during development.

---

## 2026-02-19

### [product-manager/crewly-dev-mia-member-1] 06:14:06
Crewly web app (crewly.stevesprompt.com) is at /Users/yellowsunhy/Desktop/projects/stevesprompt/apps/crewly. Next.js 16 + React 19 + Tailwind v4. GA already set up (G-E10YJZ65SR). Blog exists at /blog with 1 post. Remotion demo at src/remotion/CrewlyDemo.tsx shows chat-based team creation. Sitemap is static and missing blog routes. SEO schema (FAQ + SoftwareApplication) already in layout.tsx. Strategy doc written to docs/pm-landing-page-strategy.md.

---

## 2026-02-19

### [developer/crewly-dev-sam-217bfbbf] 06:15:43
Crewly marketing page at stevesprompt/apps/crewly uses Next.js 16 + React 19 + Tailwind v4 + Remotion. GA ID is G-E10YJZ65SR (hardcoded in layout.tsx). SEO research by Mia is in content-updates.md and docs/landing-page-research.md — most recommendations already implemented. Remotion demo is at src/remotion/CrewlyDemo.tsx (540 frames @ 30fps). Dev server runs on port 4001.

---

## 2026-02-19

### [developer/crewly-dev-sam-217bfbbf] 07:01:38
Crewly marketing page deployment: Docker build from stevesprompt monorepo root using apps/crewly/Dockerfile. Push to dr.careerengine.dev/crewly-web:<version>. Update version in ce-core/do-provision/app-node-templates/docker-compose.yml. Deploy via masterScript.sh to CEAppNode1 and CEAppNode2. Service runs on port 10014 (maps to container 3000). No deploy:prod script exists - manual docker build/push/tag needed. Version in docker-compose may drift from package.json version.

---

## 2026-02-19

### [product-manager/crewly-dev-mia-member-1] 16:23:47
Remotion demo lives at stevesprompt/apps/crewly/src/remotion/CrewlyDemo.tsx. Single 540-frame composition at 30fps. Uses inline styles only. Embedded via DemoPlayer.tsx with @remotion/player Player component (key prop forces remount on tab switch). Best architecture for multi-scenario: data-driven single component with inputProps, not separate compositions. Design doc written to docs/multi-tab-demo-design.md.

---

## 2026-02-19

### [product-manager/crewly-dev-mia-member-1] 17:23:18
Remotion demo design v3: Pure chat-text demos all look identical across tabs. Need unique visual workspaces per scenario. Architecture: 3-act (Chat 0-165, Workspace 180-450, Summary 465-540) with crossfade transitions. Workspace components are pure React with inline styles — code editors use colored text spans, charts use interpolated widths, typing uses string.slice. Each workspace needs StatusBar showing agent+runtime name for messaging continuity. Estimated 6-8hrs dev work for 4 workspace components.

---

## 2026-02-19

### [developer/crewly-dev-sam-217bfbbf] 17:24:29
Crewly marketing page deployment gotcha: monorepo .dockerignore has stars-stars-slash-star.md which excludes ALL markdown files. Blog posts were invisible during Docker build causing SSG 404s. Fixed by adding exception for apps/crewly/content. Must build with --platform linux/amd64 on Apple Silicon. Version in docker-compose drifts from package.json.

---

## 2026-02-19

### [product-manager/crewly-dev-mia-member-1] 20:17:54
Marketplace page is live with 8 items (5 skills, 2 models, 1 role) at crewly.stevesprompt.com/marketplace. It is NOT empty - has filtering, sorting, item detail pages, 3D model viewer. Content strategy written to docs/marketplace-content-strategy.md with plan to expand from 8 to 20+ items. Multi-tab demo v3 is already implemented with 4 unique workspaces (Dev/Ops/Research/Support) in src/remotion/workspaces/. v4 update doc adds color accents, unique headers, and richer visual details per workspace. Docs at stevesprompt/apps/crewly/docs/.

---

## 2026-02-20

### [developer/crewly-dev-sam-217bfbbf] 06:12:55
Blog optimization for crewly-web: react-markdown, remark-gfm, and rehype-prism-plus are all RSC-compatible - no need for use client. Next.js sitemap.ts and robots.ts generate static files automatically. RSS feed done as route handler at /blog/feed.xml/route.ts. Terminal mobile fix: the TerminalPanel slide-out panel was w-[600px] fixed - changed to w-full sm:w-[600px] for mobile responsive.

---

## 2026-02-20

### [product-manager/crewly-dev-mia-member-1] 06:33:04
Blog audit complete for marketing site at stevesprompt/apps/crewly. 3 posts exist: tutorial (claude-code multi-agent), use-cases (5 scenarios), marketplace intro. SEO infra is solid (JSON-LD, OG, RSS, canonicals). Critical gap: no og:image support (social sharing has no preview images). Medium gap: no sitemap.xml. Blog list title is too generic. Sent full audit + 6 code action items to Sam (crewly-dev-sam-217bfbbf). Proposed 5 new blog topics, top priority: Crewly vs CrewAI comparison post for search capture.

---

## 2026-02-20

### [developer/crewly-dev-sam-217bfbbf] 06:36:11
Blog optimization for crewly-web complete. Key changes: next/font/google replaces CSS @import for Nunito (eliminates render-blocking request). rehype-slug adds IDs to headings for anchor links. BlogPost interface now has optional image field for OG images - frontmatter image field maps to og:image in metadata. CollectionPage and BreadcrumbList JSON-LD added. Blog not-found page at [slug]/not-found.tsx. All builds clean with 13 pages.

---

## 2026-02-20

### [product-manager/crewly-dev-mia-member-1] 06:38:15
Blog content update complete. Added OG images (1200x630 PNGs) to public/blog/og/ using sharp + SVG overlay approach — dark indigo gradient matching site brand. Image field uses absolute URLs (https://crewly.stevesprompt.com/blog/og/...). Keywords expanded: tutorial post +4 terms, use-cases post +3 terms, marketplace post +3 terms. Sam built code infra: sitemap.xml, robots.txt, CollectionPage JSON-LD, BreadcrumbList, og:image in metadata, rehype-slug for heading anchors, blog not-found page.

---

## 2026-02-20

### [product-manager/crewly-dev-mia-member-1] 06:50:14
Designed infographic-template-v2.md for steves_news_project. Root cause of bad infographics: AI image generation (Gemini nano-banana) fundamentally cannot render text/numbers/charts reliably — diffusion model architecture limitation, not a prompt issue. Solution: programmatic SVG generation for text+data, AI image gen only for concept art without text. Template: 5-section structure (header/problem/method/results/impact), 1200x1800px portrait, dark theme with content-type-based accent colors. 3-phase rollout: (1) immediate prompt optimization, (2) SVG gen script as new skill, (3) hybrid SVG+AI approach. Key workflow change: deep content extraction phase before any visual generation.

---

## 2026-02-20

### [product-manager/crewly-dev-mia-member-1] 15:25:47
Crewly vs CrewAI outline complete at .crewly/blog-outlines/crewly-vs-crewai-outline.md. Key positioning: Crewly = platform for dev teams (real coding CLIs, live terminals, local-first, free), CrewAI = Python framework for general-purpose agent orchestration (code-first, cloud platform, $99-120K/yr). 5 differentiators: real coding agents vs API wrappers, zero-config vs code-first, live observability vs after-the-fact, local-first vs cloud-dependent, free vs execution-based pricing. Article should be 2500-3000 words, honest about both tools strengths. Target keywords: crewly vs crewai, multi-agent orchestration, crewai alternative.

---

## 2026-02-20

### [developer/crewly-dev-sam-217bfbbf] 15:28:39
Blog improvements round 2 for crewly-web at stevesprompt/apps/crewly: Added 5 new components - BlogHeroCard (featured latest post, full-width), TableOfContents (client-side with IntersectionObserver active heading tracking, auto-extracts h2/h3 from markdown), ShareButtons (X/LinkedIn/copy-link with clipboard API), BlogCta (get started CTA with install command), RelatedPosts (tag-based relevance scoring). Wired ReadingProgress bar into blog post page (was unused). Blog list now shows hero card for latest post + grid for rest. Build clean at 13 pages.

---

## 2026-02-20

### [product-manager/crewly-dev-mia-member-1] 18:17:30
Blog content sprint complete. Wrote 2 new P0 posts: Post 4 (Crewly vs CrewAI comparison, ~2000 words, TOFU) and Post 5 (Getting Started in 60 Seconds, ~800 words, BOFU). Updated all 3 existing posts with internal cross-links to new posts and added quotable blocks for AI citation. Updated content calendar status in blog-content-strategy.md. Blog now has 5 total posts covering TOFU/MOFU/BOFU funnel. Next priorities: P0 tech SEO (robots.ts AI crawlers, dateModified schema, blog index OG image), then P1 posts (Persistent Memory deep dive, Mixed Runtime tutorial).

---

## 2026-02-20

### [orchestrator/crewly-orc] 18:18:34
Disk full issue: only 412MB/926GB free. Sam hit ENOSPC error during TypeScript build. npm cache clean helped partially. All agents at risk of disk-related failures. Need major disk cleanup.

---

## 2026-02-20

### [orchestrator/crewly-orc] 18:18:37
Heartbeat prompt still appearing in agent terminals. Ella terminal shows: Please run your heartbeat skill now: bash config/skills/agent/heartbeat/execute.sh. This interrupts agent workflow. The idle detection fix by Sam may not have addressed this heartbeat prompt injection issue.

---

## 2026-02-20

### [developer/crewly-dev-sam-217bfbbf] 18:19:44
Crewly marketing app (crewly-web) lives at /Users/yellowsunhy/Desktop/projects/stevesprompt/apps/crewly/. Blog improvements done: CodeBlock component with copy-to-clipboard + language labels, shared formatDate utility in lib/blog.ts (was duplicated in 4 files), aria-labels on ToC nav and ShareButtons. Build uses local next binary at ./node_modules/.bin/next build. Disk space gotcha: npm cache can fill disk — npm cache clean --force freed ~10GB.

---

## 2026-02-20

### [orchestrator/crewly-orc] 18:48:55
Heartbeat issue confirmed: Mia was suspended and terminated while actively receiving task re-delivery. Status went active -> suspended -> inactive. Session destroyed. The agent-suspend system is too aggressive - it kills agents that are still processing task assignments. Sam fix for pty-activity-tracker only fixed a test, did not address the root cause of false idle detection.

---

## 2026-02-20

### [orchestrator/crewly-orc] 22:11:53
System issue: Joe and Zoe did not auto-follow init file instructions. Claude Code treats file-based instructions as potentially untrusted and asks for user confirmation. Ella did follow them. This inconsistency means some agents get stuck on startup. Fix: modify startup to inject init instructions directly as user input.

---

## 2026-02-20

### [orchestrator/crewly-orc] 22:12:02
System issue: CREWLY_SESSION_NAME env var not set in agent sessions. lib.sh line 22 references it, and with set -u (nounset) in execute.sh scripts, this causes unbound variable errors. Ella hit this on first attempt but self-recovered by setting the var manually. All agents may encounter this. Fix: ensure CREWLY_SESSION_NAME is exported in the PTY session environment before agent startup.

---

## 2026-02-20

### [orchestrator/crewly-orc] 22:17:25
Heartbeat prompt confirmed again: Ella just started, registered, and is idle waiting for tasks — already received heartbeat prompt in her terminal. This happens within minutes of starting, even before any task is assigned. Bug 1 still active.

---

## 2026-02-20

### [orchestrator/crewly-orc] 22:19:07
Bug 5: delegate-task and send-message skills return 502 (Failed to deliver message after multiple attempts) even when agent sessions are active and idle. Direct session write via POST /api/sessions/:name/write works fine. The issue is in the message delivery retry logic, not the session itself. Workaround: use direct curl to session write endpoint.

---

## 2026-02-20

### [orchestrator/crewly-orc] 22:20:13
Bug 1 escalation: Heartbeat prompts are injected into terminal INPUT buffer, not just displayed. When a task message arrives via session write, it gets concatenated AFTER the heartbeat prompt in the input line, creating a mixed message like: Please run your heartbeat skill now... Continue your previous work... This prevents agents from processing task assignments. The heartbeat prompt effectively blocks the input queue.

---

## 2026-02-21

### [product-manager/crewly-dev-mia-member-1] 01:54:25
Marketing content resume task complete. Verified all blog work from previous sessions: 5 posts published (3 original + Crewly vs CrewAI 1625 words + Getting Started 566 words). Cross-links and quotable blocks added to all posts. Formalized 4 P0 engineering handover items as clear specs at .crewly/blog-outlines/engineering-handover-tech-seo.md: (1) robots.ts AI crawlers, (2) dateModified JSON-LD schema, (3) blog index OG image, (4) ISR for blog routes. Estimated ~2hrs eng effort. Next content priorities: P1 posts on Persistent Memory and Mixed Runtimes.

---

## 2026-02-21

### [orchestrator/crewly-orc] 01:55:48
5-min check: workingStatus shows idle for all agents even though Sam and Zoe are actively working. Activity detection may not be updating workingStatus to in_progress based on terminal diff.

---

## 2026-02-21

### [developer/crewly-dev-sam-217bfbbf] 03:50:40
Blog styling lives at stevesprompt/apps/crewly. Key files: src/components/Blog/BlogPost.tsx (Tailwind prose classes), src/app/globals.css (custom CSS for tables, code, headings). Deploy: docker build --platform linux/amd64 from stevesprompt root with -f apps/crewly/Dockerfile, push to dr.careerengine.dev/crewly-web:<version>, update ce-core docker-compose.yml, then masterScript.sh restart crewly-web to both CEAppNode1 and CEAppNode2. Service name: crewly-web, port 10014->3000.

---

## 2026-02-21

### [product-manager/crewly-dev-mia-member-1] 06:02:06
Blog design review completed. Key findings: Crewly blog lacks 3 critical features all competitors have: (1) featured images on posts, (2) OG images for social sharing, (3) dark/light mode toggle. Font (Nunito) is too casual for dev-tools - recommend Inter. No category filtering or search. Design doc at .crewly/blog-design-review.md with 17 items across P0-P3 tiers. Competitor best practices: Linear has best dark theme (deeper #08090a), Tailwind has best theme toggle implementation, Stripe has best CSS architecture (150+ custom properties), Cursor uses custom brand fonts for identity.

---

## 2026-02-21

### [product-manager/crewly-dev-mia-member-1] 06:16:49
Computer-use screenshot workflow: Chrome may be on different macOS Space. Use swift CGWindowListCopyWindowInfo to find CGWindowIDs for all Chrome windows, then screencapture -l <windowID> to capture specific window regardless of Space. osascript to navigate Chrome tabs. AppleScript JavaScript execution requires manual Chrome setting enablement (View > Developer > Allow JavaScript from Apple Events). Use keyboard events via System Events for scrolling instead.

---

## 2026-02-21

### [developer/crewly-dev-sam-217bfbbf] 06:27:56
Blog design files for stevesprompt/apps/crewly: BlogCard at src/components/Blog/BlogCard.tsx, BlogHeroCard at src/components/Blog/BlogHeroCard.tsx, listing page at src/app/blog/page.tsx, layout at src/app/layout.tsx. Background color is now #08090a (was bg-gray-950). Cards use #0d0e10 as card bg. Grid pattern uses inline style for backgroundImage with varying gridSize per card. The blog uses Tailwind v4 CSS-first config (no tailwind.config.js, uses @theme in globals.css).

---

## 2026-02-21

### [agent/crewly-dev-sam-217bfbbf] 11:19:03
Decision made: Untitled Decision - CREWLY-WEB DEPLOYMENT PROCESS (crewly.stevesprompt.com): NOT Vercel, deployed via Docker to DigitalOcean. Service: crewly-web. Registry: dr.careerengine.dev/crewly-web. Steps: (1) Bump version in stevesprompt/apps/crewly/package.json. (2) Build from monorepo root: docker build --platform linux/amd64 -f apps/crewly/Dockerfile -t dr.careerengine.dev/crewly-web:VERSION . (3) Push: docker push dr.careerengine.dev/crewly-web:VERSION. (4) Update version in ce-core/do-provision/app-node-templates/docker-compose.yml. (5) Deploy: cd ce-core/do-provision && sh masterScript.sh CEAppNode1 restart crewly-web && sh masterScript.sh CEAppNode2 restart crewly-web. (6) Verify: ssh root@CEAppNode1 docker ps | grep crewly-web (check healthy). (7) Commit+push version bumps in both stevesprompt and ce-core repos. GOTCHAS: Must use --platform linux/amd64 on Apple Silicon. dockerignore excludes all .md but allows apps/crewly/content/**/*.md for blog posts. (Rationale: )
**Type:** decision

---

## 2026-02-21

### [orchestrator/crewly-orc] 16:11:16
Delegated OpenClaw competitive research to Crewly Core team: Mia (product/GTM strategy) + Sam (technical architecture analysis). Goal: produce comprehensive strategy doc to make Crewly as influential as OpenClaw.

---

## 2026-02-21

### [product-manager/crewly-core-mia-member-1] 16:14:34
OpenClaw竞品分析完成。关键发现：(1) OpenClaw=195K stars个人AI助手，Crewly的差异化应定位为多Agent团队协作（no competitor in this niche）。(2) OpenClaw安全问题严重是Crewly机会。(3) GTM建议：Build in Public + Show HN + Demo视频 + 预设团队模板。(4) 商业化路径：开源核心+CrewHub技能市场+Crewly Cloud+企业版。(5) 最小团队：4人（2工程+1DevRel+创始人）。完整报告在.crewly/docs/openclaw-strategy.md

---

## 2026-02-21

### [product-manager/crewly-core-mia-member-1] 16:58:28
竞品研究完成：OpenClaw ~180K stars，ClawHub有3000+ skills，病毒式增长典范。CrewAI 40K stars，10万认证开发者，Fortune 500 60%使用。AutoGen 50K stars正融入Microsoft Agent Framework。LangGraph图结构编排高增长。Crewly差异化在于AI团队编排（非单Agent），核心优势是角色/看板/终端/调度的完整团队体验 + Claude Code深度集成 + Skills生态雏形。Q1 OKR三个方向：产品领先(Marketplace+模板)、社区增长(内容飞轮)、PMF验证(外部用户)。

---

## 2026-02-21

### [orchestrator/crewly-orc] 18:13:57
CRITICAL LESSON: When user sets OKR/goals and says team should execute, orchestrator must proactively assign tasks and keep agents working. Do NOT wait for permission. After OKR is set: (1) break down KRs into tasks, (2) assign first batch, (3) when agents complete, assign next batch. Updated orchestrator prompt.md with Step 4 and Continuous Execution Protocol.

---

## 2026-02-21

### [product-manager/crewly-core-mia-member-1] 18:16:49
O2-KR1 User Acquisition Plan completed. Key findings: (1) Crewly has 61 GitHub stars, npm v1.0.4, 2 contributors - early stage. (2) Website crewly.stevesprompt.com returns 403 - needs fixing before launch. (3) No GitHub Releases, no demo video, no community channel - critical gaps. (4) Main competitors: CrewAI (60K stars, Python SDK), Claude-Flow, Intent/Augment, VS Code multi-agent. (5) Key differentiator: runtime-agnostic CLI orchestration with web dashboard, zero framework lock-in. (6) Recommended launch sequence: prep materials Week 1, Show HN + Reddit Week 2, amplify Week 3, Product Hunt Week 4. (7) Name collision: crewly.com is a construction company - need crewly.dev domain. Deliverables saved to docs/user-acquisition-plan.md and docs/show-hn-draft.md.

---

## 2026-02-21

### [product-manager/crewly-core-mia-member-1] 18:42:09
what you learned

---

## 2026-02-21

### [orchestrator/crewly-orc] 21:42:19
Autonomous Mode activated by user for Crewly Core team. User wants: (1) orchestrator follows up on progress, (2) use OKR/Goals for decisions, (3) hourly reports to Slack D0AC7NF5N7L/1771692660.676259. Phase 1: Mia=O1 gap analysis, Sam=O2 code quality + open source prep.

---

## 2026-02-21

### [product-manager/crewly-core-mia-member-1] 21:51:54
O1-KR1 completed: Deep competitive gap matrix (Crewly vs OpenClaw/CrewAI/AutoGen). Key findings: (1) Crewly unique moat = real-time team dashboard + terminal streaming + Slack integration + quality gates + budget tracking - no competitor has this combo. (2) Top 3 blockers to close: npx crewly init onboarding, MCP protocol support, open source prep (README/LICENSE/docs). (3) OpenClaw has 200K stars and 3000+ skills but is single-agent only. (4) CrewAI is closest competitor in multi-agent space with Flows, guardrails, training/testing, and A2A protocol. (5) AutoGen merging into Microsoft Agent Framework, less direct threat. (6) Roadmap v2 produced with 4 phases over 14 weeks. Sam should start with: R1.1 npx crewly init, R1.6 LLM adapter, R1.9 Docker deployment. Documents at .crewly/docs/competitive-gap-matrix.md and .crewly/docs/roadmap-v2.md

---

## 2026-02-21

### [product-manager/crewly-core-mia-member-1] 22:56:51
O1-KR1 v3.0 completed. Comprehensive gap matrix now covers 4 competitors (OpenClaw, CrewAI, AutoGen, LangGraph). Key updates from v2: (1) Added LangGraph as 4th competitor - 24.9K stars, 30M+ monthly downloads, 400 enterprise customers, LangChain $1.25B unicorn. (2) AutoGen confirmed entering maintenance mode, merging into MS Agent Framework (GA Q1 2026). (3) CrewAI now at v1.9.0 with Unified Memory, A2A protocol, 44.4K stars. (4) OpenClaw security crisis: 40K exposed instances, CVE-2026-25253, 341 malicious skills. (5) Crewly unique moat confirmed: live terminal streaming + runtime-agnostic + team dashboard + budget tracking + Slack integration. Top 5 gaps to close: npx crewly init, open-source readiness, vector memory, community Discord, docs site.

---

## 2026-02-21

### [product-manager/crewly-core-mia-member-1] 23:08:19
O1-KR2 Prioritized Roadmap v3 completed. Key structure: 26 features (F1-F26) across 3 phases. Phase 1 has 14 items for Sam (4 P0, 5 P1, 4 P2). Sam sprint board order: F3 (LICENSE) -> F1 (init) -> F5 (templates) -> F2 (README) -> F6 (LLM adapter) -> F7 (MCP client) -> F8 (Docker) -> F9 (vector memory) -> F10 (docs site) -> F12/F13/F11/F14. Three gaps explicitly deferred: visual workflow builder, Python SDK, durable execution. Document at .crewly/docs/roadmap-v3.md

---

## 2026-02-21

### [product-manager/crewly-core-mia-member-1] 23:13:10
Getting Started guide written at docs/getting-started.md. Key details verified from codebase: 8 CLI commands (onboard, start, stop, status, logs, upgrade, search, install), default port 8787, 14 built-in roles, 22+ agent skills, 4-step onboard wizard, tmux-based sessions. Dashboard has 12 pages (Dashboard, Teams, TeamDetail, Projects, ProjectDetail, Assignments, Marketplace, Knowledge, Factory, Chat, ScheduledCheckins, Settings). Global config at ~/.crewly/, project config at .crewly/.

---

## 2026-02-21

### [product-manager/crewly-core-mia-member-1] 23:20:40
API Reference written at docs/api-reference.md. Crewly has 150+ API endpoints across 20 domains: Teams (21 endpoints), Projects (35+ endpoints incl tickets/git/tasks), Sessions (8), Terminal (9), Chat (15), Orchestrator (10), Memory (14), Knowledge (6), Task Management (12), Messaging (6), Scheduled Messages (7), Event Bus (4), Quality Gates (1), Skills (12), Settings (18 incl roles), Marketplace (8), Slack (9), System (14), Self-Improvement (6), Factory (4). All verified against actual route files.

---

## 2026-02-21

### [developer/crewly-core-sam-217bfbbf] 23:44:49
F7 MCP Client: Created backend/src/services/mcp-client.ts (McpClientService) wrapping @modelcontextprotocol/sdk Client + StdioClientTransport. Key API: connectServer/disconnectServer/connectAll/disconnectAll + listTools/callTool/refreshTools. 44 tests, all passing. SDK v0.5.0 Client constructor takes (Implementation, ClientOptions), connect takes a Transport. StdioClientTransport takes StdioServerParameters {command, args, env, stderr}. callTool returns {content: ContentBlock[], isError: boolean}. Exported from services/index.ts.

---

## 2026-02-22

### [product-manager/crewly-core-mia-member-1] 00:07:35
Phase 1 Assessment completed: O1 (research) 100% done, O2 (dev) ~70% done. Phase 2 trigger: 3+ differentiated features MET (templates F5, runtime adapter F6, MCP client F7). Demo flow MET (onboard->start->dashboard->agents). Two hard blockers remain: (1) LICENSE file missing at repo root (2) 17 files uncommitted. crewly init (F1) not built yet but crewly onboard fills the gap for demos. Phase 2 launch plan drafted with 6-week timeline, HN-first strategy on Tuesday 9am PT. Documents at .crewly/docs/phase1-assessment.md and .crewly/docs/phase2-launch-plan.md.

---

## 2026-02-22

### [product-manager/crewly-core-mia-member-1] 00:11:46
Phase 2 launch content drafted: (1) HN Show post at .crewly/docs/launch-hn-post.md — ~240 words, authentic HN style, title: Show HN: Crewly – Open-source multi-agent orchestration for AI coding teams. Includes posting checklist and tone notes. (2) First blog post at docs/blog/01-introducing-crewly.md — 1113 words, covers Problem/Solution/How It Works/Getting Started/What is Next. Key messaging: runtime-agnostic CLI orchestration, real PTY terminals not API calls, live dashboard, mix runtimes. Differentiation from CrewAI/LangGraph framed as SDK vs CLI orchestrator. Both ready for final review.

---

## 2026-02-22

### [product-manager/crewly-core-mia-member-1] 00:17:53
Phase 2 launch content complete. Full launch content suite now at .crewly/docs/: (1) launch-hn-post.md — HN Show post, (2) launch-social-posts.md — Twitter 7-tweet thread, Reddit r/programming + r/artificial, LinkedIn post, (3) discord-setup-guide.md — 10 channels in 3 categories, welcome message, rules, bot setup, first-week engagement plan, growth milestones, (4) github-templates.md — bug report yml, feature request yml, PR template md, discussion categories, 17 labels, 5 good-first-issues. Plus docs/blog/01-introducing-crewly.md blog post. All copy-pasteable and ready for implementation.

---

## 2026-02-22

### [orchestrator/crewly-orc] 00:30:04
Mia completed 10 tasks in one session before hitting 7% context. PM tasks (docs, analysis, content) consume less context per task than dev tasks (code + tests + builds). Budget ~10 PM tasks or ~5-6 dev tasks per session.

---

## 2026-02-22

### [orchestrator/crewly-orc] 00:44:19
Orchestrator context window can run out during long autonomous sessions. When this happens, user messages go unanswered. Mitigation: save state via remember before context runs out, proactively notify user.

---

## 2026-02-22

### [developer/crewly-core-sam-217bfbbf] 01:38:15
F11 (Crewly as MCP Server) implemented. Created backend/src/services/mcp-server.ts using @modelcontextprotocol/sdk Server + StdioServerTransport. 6 tools: crewly_get_teams, crewly_create_team, crewly_assign_task, crewly_get_status, crewly_recall_memory, crewly_send_message. CLI command: crewly mcp-server (cli/src/commands/mcp-server.ts). 41 tests pass (37 service + 4 CLI). Key gotcha: MCP SDK setRequestHandler type inference requires casting return for CallToolRequestSchema handler. Test gotcha: Map.get uses reference equality - use method string keys not schema objects.

---

## 2026-02-22

### [orchestrator/crewly-orc] 01:54:40
Completed documentation updates after codebase audit incident: (1) Updated developer/prompt.md - added codebase audit as Step 1 before implementation. (2) Updated product-manager/prompt.md - added codebase audit requirement before roadmap proposals. (3) Created ~/.crewly/docs/codebase-audit-sop.md - full SOP with procedures for orchestrator, developers, and PMs. (4) Recorded decision in project knowledge base. Going forward: always include audit existing code first in task delegation messages.

---

## 2026-02-22

### [developer/crewly-core-sam-217bfbbf] 02:04:03
F12 Structured Task Output with Validation implemented. New files: backend/src/types/task-output.types.ts (types+constants), backend/src/services/quality/task-output-validator.service.ts (ajv-based singleton validator). Modified: task-management.controller.ts (createTask embeds outputSchema, completeTask validates output with retry logic, new getTaskOutput endpoint), task-management.routes.ts (get-output route), agent+orchestrator complete-task skills (output param support). 74 total tests passing.

---

## 2026-02-22

### [orchestrator/crewly-orc] 02:11:27
Roadmap corrections confirmed by user (2026-02-22): F6 deleted (already existed), F9 changed to incremental optimization, F10 changed to expand existing marketing /docs. New research tasks assigned to Mia: (1) Marketplace skills ecosystem research, (2) Desktop/mobile app competitive research. Sam assigned F13 (Context Window Management). Note: F13 task includes codebase audit requirement per new SOP.

---

## 2026-02-22

### [product-manager/crewly-core-mia-member-1] 02:20:30
Task 7 complete: Two deep research reports delivered. (1) Marketplace research - Crewly has 62 built-in skills but no community contribution path, no skill creation SDK, no security scanning. OpenClaw ClawHavoc incident (12% malicious skills) is a cautionary tale. MCP bridge is the fastest path to 8600+ tools. Recommended Curated Open contribution model. (2) Desktop/mobile research - Tauri recommended over Electron for companion app (<10MB vs 100+MB, 30MB vs 200+MB memory). PWA recommended for mobile. Do NOT build an IDE. Crewly unique moat is multi-agent team orchestration companion that works alongside any IDE.

---

## 2026-02-22

### [developer/crewly-core-sam-217bfbbf] 02:27:48
F13 Context Window Management implemented. ContextWindowMonitorService (backend/src/services/agent/context-window-monitor.service.ts) follows RuntimeExitMonitorService PTY pattern + AgentHeartbeatMonitorService lifecycle. Subscribes to session.onData(), strips ANSI, regex-matches context %. Thresholds: 70% yellow, 85% red, 95% critical (auto-recovery). New event types: agent:context_warning, agent:context_critical. New ChangedField: contextUsage. Constants in CONTEXT_WINDOW_MONITOR_CONSTANTS. broadcastContextWindowStatus added to TerminalGateway. Wired in backend/src/index.ts (init+shutdown). Hooked into agent lifecycle in agent-registration.service.ts (start on create, stop on terminate). 45 tests passing.

---

## 2026-02-22

### [orchestrator/crewly-orc] 02:39:40
USER FEEDBACK on F13 (Context Window Management): Auto-restart on context exhaustion is too crude. Claude Code, Gemini CLI, and Codex all have built-in context compression/compact mechanisms. F13 should: (1) Research each runtime official docs for compact/compression APIs, (2) Trigger proactive compression instead of restarting, (3) Only restart as last resort. Sam needs to read runtime documentation before iterating on F13. This is another example of the codebase-audit-first principle — research before implementing.

---

## 2026-02-22

### [developer/crewly-core-sam-217bfbbf] 03:10:40
Marketplace install flow debug + publish + skills: (1) Added Toast notification system (useToast hook + ToastContainer component) to frontend/src. Marketplace.tsx handlers now show success/error toasts instead of silently swallowing errors. (2) Created crewly publish command: package-validator.ts validates skill dirs, archive-creator.ts creates tar.gz + checksums + registry entries, publish.ts ties it together with --dry-run support. (3) Created 5 marketplace skills: git-commit-helper, readme-generator, test-runner, env-setup-checker, dep-updater - all passing validation. Frontend esbuild/rollup native module issue is pre-existing (fixed by npm install @rollup/rollup-darwin-x64). All new tests pass: 27 CLI + 49 frontend.

---

## 2026-02-22

### [product-manager/crewly-core-mia-member-1] 04:29:32
GTM strategy document completed at .crewly/docs/gtm-strategy.md. Key decisions: (1) HN as anchor launch event, staggered Reddit/Twitter/Dev.to. (2) 3-week sprint: prep → launch → amplify. (3) Freemium: 2 agents free, Pro $49/mo 10 agents, Team $199/mo 50 agents. (4) 3 existing example templates (web-app, research-project, startup-mvp) serve as preset team templates. (5) Sustainable post-launch: 5 hrs/week combined for 2-person team. (6) Critical blocker: smoke test npx crewly start on clean machines before any public launch.

---

## 2026-02-22

### [developer/crewly-core-sam-217bfbbf] 04:30:52
Marketplace implementation complete (Phases A+B+C). Key architecture: (1) SkillService loads from 3 dirs: builtin (config/skills/), user (~/.crewly/skills/), marketplace (~/.crewly/marketplace/skills/). (2) Post-install refreshSkillRegistrations() reloads SkillService + regenerates SkillCatalog. (3) Submission workflow in marketplace-submission.service.ts: submit->pending->approve/reject. On approve, archive copies to assets dir and entry added to local-registry.json. (4) fetchRegistry() merges remote + local registries, gracefully handles network failures. (5) chalk ESM mock needed in Jest tests. (6) seed-marketplace CLI packages 9 built-in skills. (7) 146 marketplace tests across 9 suites.

---

## 2026-02-22

### [product-manager/crewly-core-mia-member-1] 04:58:45
Business Model v2 completed. Key decisions: (1) Route A (local BYOK) first for fastest revenue with $0 infra cost, Pro tier at $29/mo + consulting at $500 setup + $200-500/mo managed ops. (2) Route C (cloud VM) added at month 3-6, pricing $149-499/mo with API credit caps. (3) Route B (self-built agent) SKIPPED - requires full-time commitment incompatible with Steves day job. (4) Steve 5hrs/week model - AI team handles all execution. (5) API costs: Sonnet $1.80/session, Haiku $0.60/session - Route C must use hard caps + overage billing. (6) Key risk: Claude Code adds native multi-agent, but Crewly shifts to management console role. Report at .crewly/docs/business-model-v2.md

---

## 2026-02-22

### [product-manager/crewly-core-mia-member-1] 05:07:24
Docs deliverables completed. (1) Getting Started guide at .crewly/docs/getting-started-guide.md - covers full npx crewly onboard flow (5-step wizard: provider selection, tool detection, skill install, template selection, scaffolding), crewly start, first team creation, CLI reference, troubleshooting, directory structure. (2) 3 Use Cases at .crewly/docs/use-cases.md - Dev Team Automation (bug fix pipeline with PM+Dev+QA agents, quality gates), SMB Operations (content pipeline with Writer+Strategist+Analyst, Slack integration), Personal Productivity (research team with Researcher+Analyst+Writer). Each has workflow, comparison table, results metrics. (3) Discord plan at .crewly/docs/discord-community-plan.md - 14 channels across 5 categories, roles, welcome flow, bot config (MEE6 + GitHub webhook), moderation plan, growth strategy (3 phases), metrics, launch checklist. Total cost: $0/mo. Note: crewly.stevesprompt.com/docs returned 403 (Cloudflare protection) - could not review existing site content.

---

## 2026-02-22

### [product-manager/crewly-core-mia-member-1] 05:19:36
Phase 1 marketing content completed. All at .crewly/docs/: (1) pricing-page-content.md - Community free ($0, 2 agents, 1 team) vs Pro ($29/mo, 10 agents, 5 teams, Slack, semantic search, all quality gates) vs Enterprise (custom). Full feature comparison table, FAQ (13 questions covering general/pricing/technical/enterprise), CTA sections, design notes, A/B test ideas. (2) competitor-comparison-page.md - 4 comparison pages: Crewly vs CrewAI (price + dashboard advantage), vs Manus (multi-agent + privacy + open source), vs AutoGen (active dev + DX), vs LangGraph (teams vs graphs). Each has quick summary table, feature comparison, where each wins, who should choose what. Cross-comparison summary table at end. (3) demo-video-script.md v2.0 - Updated from 4min to 2min version. 8 scenes: Hook, Install, Dashboard, Terminal Streaming (money shot), Quality Gates, Budget+Slack, Power Moment (3 agents parallel), CTA. Includes social media clip cuts, recording checklist, YouTube metadata.

---

## 2026-02-22

### [developer/crewly-core-sam-217bfbbf] 05:20:18
Marketplace install flow fix: installItem() in marketplace-installer.service.ts previously always downloaded from remote CDN. For locally published/seeded skills, assets exist at ~/.crewly/marketplace/assets/ but were never checked. Fixed by adding local asset check before remote download. Barrel export in controllers/marketplace/index.ts was also missing submission handler exports (handleSubmit, handleListSubmissions, handleGetSubmission, handleReviewSubmission). Full submission path was already implemented end-to-end: CLI publish --submit → backend submitSkill → frontend review UI → approval → local-registry.json → fetchRegistry merges → install from local assets.

---

## 2026-02-22

### [developer/crewly-core-sam-217bfbbf] 05:30:58
F13 Context Window Monitor test fixes: 3 tests failed because AUTO_RECOVERY_ENABLED was changed from true to false but tests still expected recovery. Fixes: (1) compactInProgress timer test needed jest.advanceTimersByTimeAsync in two steps (200ms for internal await + COMPACT_WAIT_MS for clear timer) instead of sync advanceTimersByTime. (2) Two recovery expectation tests updated to assert createAgentSession NOT called when AUTO_RECOVERY_ENABLED=false. Key pattern: when triggerCompact has internal awaits, timer tests must account for microtask flushing between timer advances.

---

## 2026-02-22

### [product-manager/crewly-core-mia-member-1] 05:49:18
Onboarding audit completed. Critical bugs found: (1) Gemini CLI npm package wrong (@anthropic-ai/gemini-cli should be @google/gemini-cli) at onboard.ts:199,203. (2) Template selection during onboard does NOT create team - user arrives at empty dashboard. (3) Skills install requires network with no offline fallback to bundled skills. (4) tmux not checked during onboard but required for agents. (5) No auth verification after tool detection. (6) Research team template uses wrong roles (developer/designer instead of researcher/writer). Docs at .crewly/docs/onboarding-experience-report.md, onboarding-checklist.md, faq.md.

---

## 2026-02-22

### [developer/crewly-core-sam-217bfbbf] 05:53:12
Marketplace skills pattern: each skill in config/skills/agent/<id>/ with execute.sh, skill.json, instructions.md. execute.sh uses _common/lib.sh (api_call, error_exit, require_param). JSON in, JSON out. Key gotcha: set -euo pipefail + grep returns exit 1 on no match — use grep -c with || true to avoid pipefail killing the script. CLI publish validates skill.json and creates tar.gz archives. Categories content and analytics are not in the standard list but validation still passes with a warning.

---

## 2026-02-22

### [product-manager/crewly-core-mia-member-1] 06:00:10
Launch content suite completed. 3 docs at .crewly/docs/: show-hn-post.md (3 title options, full post body, 6 HN Q&As, posting checklist), blog-multi-agent-orchestration.md (1800 words, technical blog with code examples and SEO metadata), twitter-launch-thread.md (10-tweet thread, 3 alt hooks, engagement plan). Key HN pattern: technical depth over polish, honesty about limitations, immediate access via npx.

---

## 2026-02-22

### [product-manager/crewly-core-mia-member-1] 06:09:18
Website content package completed at .crewly/docs/website-content-package.md. Consolidated all marketing content for crewly.stevesprompt.com. Key facts about the site: Next.js 16 App Router, Tailwind v4 (no config file, uses @theme directive), dark-mode-only, Nunito font, Lucide icons. Current pages: /, /download, /blog, /marketplace, /docs. New pages needed: /pricing, /compare, /compare/[slug]. 5 existing blog posts in content/blog/. Nav links defined in src/lib/constants.ts. Card pattern: bg-gray-900/50 border border-gray-800 rounded-xl. Accent: indigo-400/500. Site code at /Users/yellowsunhy/Desktop/projects/stevesprompt/apps/crewly/.

---

## 2026-02-22

### [product-manager/crewly-core-mia-member-1] 06:24:15
Task 9 - SMB Zero-Install Product Design: Created comprehensive product design at .crewly/docs/smb-zero-install-product-design.md. Key findings: (1) Current codebase has NO auth, NO database, NO multi-user - SMB mode requires building all from scratch. (2) Slack integration currently uses manual token paste (Socket Mode) - needs full OAuth flow for SMB. (3) Progressive OAuth permission model recommended - request scopes on-demand not upfront. (4) Content Team template recommended as MVP starting point (least risky, most demonstrable). (5) 12-week development timeline with PostgreSQL, Stripe, Docker containers per customer. (6) Google OAuth verification is critical path risk (2-6 weeks review). (7) Pricing: Free trial 14 days/$15 credit, Starter $99, Team $299, Department $799. (8) Hybrid codebase recommended - shared packages between open-source CLI and cloud platform.

---

## 2026-02-22

### [developer/crewly-core-sam-217bfbbf] 06:37:38
Test coverage improvement session: context-window-monitor.service.ts went from 62.8% to 93.7% lines by adding auto-recovery tests with Object.defineProperty to override as-const AUTO_RECOVERY_ENABLED. Key pattern: Object.defineProperty(CONTEXT_WINDOW_MONITOR_CONSTANTS, "AUTO_RECOVERY_ENABLED", { value: true, writable: true, configurable: true }) in beforeEach, restore in afterEach. triggerCompact returns early before incrementing compactAttempts when backend/session is null — test must assert 0 not 1. seed-marketplace.ts: use jest.spyOn(process, "exit").mockImplementation(() => throw) to test process.exit branches.

---

## 2026-02-22

### [product-manager/crewly-core-mia-member-1] 06:38:42
Docs audit completed. 31 total docs in .crewly/docs/. Key findings: (1) 12 production-ready, 9 need Steve review, 5 superseded (should delete: launch-hn-post.md, launch-social-posts.md, discord-setup-guide.md, roadmap-v2.md, commercialization-research-report.md), 5 internal reference only. (2) Critical pricing inconsistency across docs: v1 said $49/$199, pricing-page says $29, business-model-v2 says $29 BYOK, SMB design says $99-$799 cloud. Resolution: $29 is Route A (open-source), $99-$799 is Route C (cloud) - different products. (3) Phase 1 launch needs 11 P0 blockers resolved: 3 Steve decisions, 6 Sam tasks, 2 Mia tasks. Estimated 5-7 days from Steves green light. (4) Minimum viable launch: LICENSE file + committed code + fixed onboarding + clean README + repo public + HN post approved.

---

## 2026-02-22

### [orchestrator/crewly-orc] 06:45:11
2-hour autonomous session: Sam+Mia produced 19 docs + 36 code files +3005 lines across 7 task cycles. Pattern: ~10 min per cycle, assign immediately on idle. Diminishing returns after 7 cycles without user strategic input.

---

## 2026-02-22

### [orchestrator/crewly-orc] 07:15:27
用户确认 Model C 方向（SMB Zero-Install AI Workforce）。优先级：(1) 稳定 Crewly — marketplace/skills 全链路调通 (2) 为 Model C 打基础 — auth、OAuth、skills/template (3) 测试多 runtime — Gemini CLI、Codex 等非 Claude Code runtime 混合团队。护城河 = 深度绑定客户业务流程。明天白天启动执行。

---

## 2026-02-22

### [developer/crewly-core-sam-217bfbbf] 07:26:41
Computer-use skill v2.0.0 Accessibility API findings: (1) list-apps, focus-app, scroll, screenshot, move, click, type all work WITHOUT Accessibility permission. (2) read-ui and get-text REQUIRE Accessibility permission (AXIsProcessTrusted=true) — they access the AX element tree via System Events. (3) Error -25211 (kAXErrorAPIDisabled) occurs when permission is missing. (4) Added check-accessibility action and require_ax_permission() guard to give clear error messages. (5) iPad apps (discover/rednote/小红书) DO show up in CGWindowList and list-apps, but text content requires AX tree access. (6) To grant permission: System Settings > Privacy & Security > Accessibility > enable Terminal, then restart terminal.

---

## 2026-02-22

### [orchestrator/crewly-orc] 07:32:06
Computer-use skill v2.0 tested by Sam. list-apps, focus-app, scroll all work. read-ui and get-text blocked by Accessibility permission (AXIsProcessTrusted=false, error -25211). Fix: grant Terminal accessibility in System Settings > Privacy & Security > Accessibility, restart Terminal. Sam added check-accessibility action and require_ax_permission guard. iPad app discover (com.xingin.discover) was successfully detected and focused. Once permission is granted, the Accessibility API actions should work — need to verify iPad app AX tree exposure next.

---

## 2026-02-22

### [orchestrator/crewly-orc] 13:03:24
小红书 (RedNote) iPad app on macOS: process name is discover, bundle ID com.xingin.discover. Accessibility API works but UI is deeply nested (25+ levels). Text content is in AXDescription attributes (not AXValue). Feed posts start at position y>=270. Navigation at y<260. Pattern: AXStaticText(title) then AXStaticText(author) then AXButton(likes). Created dedicated rednote-reader skill at config/skills/agent/rednote-reader/.

---

## 2026-02-22

### [orchestrator/crewly-orc] 13:35:43
iPad apps on macOS (like 小红书/discover) have a known issue: when the window is closed, the app process stays running but has 0 windows. Restarting via activate, open -b, Dock click, force kill+relaunch all fail to create a new window. Need manual user intervention (double-click dock icon or Launchpad). Consider adding a window-recovery mechanism to the rednote-reader skill, or deleting ~/Library/Saved Application State/com.xingin.discover.savedState/ before relaunch.

---

## 2026-02-22

### [orchestrator/crewly-orc] 14:28:11
CRITICAL: Never use killall -9 on iPad apps (like rednote/discover) on macOS. It permanently destroys the window and no programmatic method can recreate it. Only physical user interaction restores the window. iPad apps use iOS UIScene lifecycle which macOS cannot trigger programmatically.

---

## 2026-02-22

### [orchestrator/crewly-orc] 15:30:20
Steve new product vision: Crewly as HIRING experience. User gets a phone number, can text/call to assign tasks — like hiring a real human assistant. Key insight: SaaS = user learns your UI; Hiring = AI adapts to user habits (SMS, phone, WeChat). Zero learning curve. Cloud-first SaaS + optional Desktop extension. Provision 1-person team + orchestrator on signup. All tasks via API (OAuth Google Workspace etc). This is a potential pivot from Model C (local install) to cloud-native.

---

## 2026-02-22

### [developer/crewly-core-sam-217bfbbf] 16:01:12
SMB capability audit completed. 34 agent skills + 38 orchestrator skills. Only external API integrations: Slack (bot token), Gemini (API key for images). All content skills (seo-blog-writer, social-media-post, email-responder, feedback-analyzer) are template generators using bash/jq — no actual AI/ML. No OAuth infrastructure for end-users. No email/social/calendar/payment APIs. Strongest value: dev automation + content drafts + Slack ops. Biggest gap: email (critical for any SMB). Quick wins: SendGrid skill (2d), GitHub Issues skill (2d).

---

## 2026-02-22

### [developer/crewly-core-sam-217bfbbf] 16:42:15
Two-layer SMB architecture: Layer 1 (OAuth+API) for services with APIs, Layer 2 (VNC browser actuation with Puppeteer+noVNC+Xvfb in Docker) for services without APIs. Crewly already has Playwright (@playwright/test in devDeps) and Docker pipeline. VNC adds ~500MB to image, ~400-800MB RAM per browser session. DigitalOcean 4GB droplet ($24/mo) handles 2-3 concurrent sessions. User flow: agent sends VNC link → user logs in → cookies saved encrypted → agent uses saved session. noVNC latency: 100-200ms same datacenter (excellent). Security: WSS + one-time tokens + AES-256-GCM cookie encryption. This architecture turns most months-long integrations into weeks.

---

## 2026-02-22

### [developer/crewly-core-sam-217bfbbf] 17:40:20
Marketplace feature implementation: Agent skills (marketplace-search, marketplace-publish) follow standard pattern in config/skills/agent/<name>/ with execute.sh+skill.json+instructions.md. Skills use _common/lib.sh api_call to talk to local backend /api/marketplace endpoints. Remote registry at stevesprompt app uses content/registry.json as source of truth, updated by POST /api/registry/skills route. The fetchRegistry in lib/registry.ts reads static file at SSR time. Marketplace page at /marketplace already has FilterBar, ItemCard, ItemDetail components with search/filter/sort. Pre-existing build error in stevesprompt /_global-error (useContext null) is unrelated to marketplace.

---

## 2026-02-22

### [developer/crewly-core-sam-217bfbbf] 21:01:39
Marketplace architecture design complete. Key findings: (1) Current code is well-structured — service layer properly abstracts registry source, so switching from local file to Git-based registry requires only URL changes in 3 files. (2) marketplace.service.ts fetchRegistry() already has 1hr cache, local+remote merge, and graceful fallback — all stay as-is. (3) marketplace-installer already does checksum verification and local-first asset lookup. (4) CLI has independent marketplace.ts (no backend needed) plus publish.ts + archive-creator.ts for packaging. (5) Frontend talks to backend API only, completely registry-agnostic. (6) Recommended Git-based registry (Homebrew model): crewly-registry repo on GitHub, GitHub Releases for archives, GitHub Actions for CI validation (ShellCheck + banned pattern scan), PR-based submissions via gh CLI. (7) Migration is 4 phases: create repo, update URLs, update publish flow, deprecate old paths. (8) 17 total tasks, most are small/trivial.

---

## 2026-03-01

### [orchestrator/crewly-orc] 05:36:06
Agent restart behavior: after terminating and restarting an agent, Claude Code processes only ONE turn per message input. For multi-step tasks, you need to send follow-up continue messages. The force=true flag on send-message is needed for delivery. Pattern: (1) start agent, (2) wait for active+idle, (3) send task with force=true, (4) when agent goes idle again, send continue with force=true, (5) repeat until task complete.

---

## 2026-03-01

### [developer/crewly-core-sam-217bfbbf] 15:01:20
Proactive notification failure root cause: (1) delegate-task monitor param defaulted to disabled (idleEvent=false, fallbackCheckMinutes=0), so no recurring checks were auto-set-up after delegation — system relied on LLM behavior to manually call schedule-check. (2) QueueProcessor system events had no force-delivery — 5 retries x 120s = 10min delay. Fix: Changed delegate-task defaults to enabled (idleEvent=true, fallbackCheckMinutes=5) using jq null-check to preserve explicit opt-out. Added SYSTEM_EVENT_TIMEOUT=60s and SYSTEM_EVENT_FORCE_DELIVER=true to constants, updated queue-processor to force-deliver system events after shorter timeout.

---

## 2026-03-01

### [developer/crewly-core-sam-217bfbbf] 15:26:40
Event flood fix (Task 2): Implemented 3-layer solution to prevent [EVENT] messages from blocking [CHAT] user messages. (1) EventBusService debounced batching with per-agent deduplication — uses Map keyed by subscriberSession:sessionName with 5s debounce window. Same agent multiple events within window → only final state kept. Multiple agents → batched into single enqueue. (2) MessageQueueService: added WhatsApp to user message priority in dequeue(). (3) QueueProcessorService: added WhatsApp to isUserMessage, system events use SYSTEM_EVENT_TIMEOUT (60s) and SYSTEM_EVENT_FORCE_DELIVER to skip retry loop, skipped post-delivery waitForAgentReady for system events. Testing gotcha: when both user messages and system events force-deliver, the requeue code path is unreachable with any real source. Used jest.mock getter pattern (get SYSTEM_EVENT_FORCE_DELIVER() { return mockVar; }) to make the flag overridable per-test, allowing requeue tests to still exercise that fallback code path.

---

## 2026-03-01

### [orchestrator/crewly-orc] 20:37:27
SteamFun Slides race condition fix (v@68): Root cause was concurrent uploads creating duplicate Slides files because (1) saveStudentSlideId didnt call SpreadsheetApp.flush(), (2) SlidesApp changes werent committed via saveAndClose() before lock release, (3) findExistingSlidesInDrive picked files non-deterministically. Fix: getFreshStudentSlideId() reads directly from sheet cell, presentation.saveAndClose() before lock release, findExistingSlidesInDrive picks most recent file. Video embed requires enabling Slides Advanced API in GCP console (currently uses text card fallback).

---

## 2026-03-01

### [orchestrator/crewly-orc] 21:01:02
SteamFun E2E test successful: race condition fix working (saveAndClose, getFreshStudentSlideId, findExistingSlidesInDrive). Video shows as text card due to Slides API not enabled in GCP. Need to enable Google Slides API in GCP console for proper video embedding. Test function testE2ESlideGeneration() added temporarily and needs cleanup after testing.

---

## 2026-03-01

### [orchestrator/crewly-orc] 21:19:23
IMPORTANT WORKFLOW: When an agent reports task completion, do NOT just forward the done status to the user. Instead: (1) Get the actual deliverables (screenshots, files, etc), (2) Review and analyze them yourself for quality issues, (3) Report to the user WITH your own analysis and any issues found. Always verify agent work before reporting to user.

---

## 2026-03-01

### [agent/crewly-orc] 21:19:26
Discovered pattern: Untitled Pattern - When agents complete visual/design tasks (like Slides, UI, etc): always get screenshots, review them yourself, and report findings WITH analysis to user. Never just say done without verifying the output quality.
**Type:** pattern

---

## 2026-03-01

### [developer/crewly-core-sam-217bfbbf] 21:55:40
Notification bug root cause: report-status calls POST /api/chat/agent-response which stores message in chat DB + emits Socket.IO event but does NOT enqueue to MessageQueueService and does NOT notify orchestrator. ActivityMonitor polls every 2min to detect idle, then EventBus debounces 5s, then QueueProcessor waits up to 60s for orchestrator prompt — total 3-10min delay. Recommended fix: Option C (Hybrid) — modify agentResponse() in chat.controller.ts to detect [DONE] messages and directly send Slack notification + enqueue system_event to MessageQueueService. This eliminates the polling delay entirely.

---

## 2026-03-01

### [generalist/crewly-sales-grace-c90cc95e] 22:08:14
Created Crewly sales playbook with 3 verticals (Content Agency P0, Real Estate P1, Legal P1). Key data points: Content agencies (1-10 ppl) spend $5-20K/mo on freelancers, perfect Crewly fit. Real estate validated by Roofclaw $1.79M. Legal has 72% solo AI adoption but only 8% broad — huge headroom. Cold DM best practices: personalize first line, send Tue-Thu 9-11am, follow up once after 3-4 days. Discovery calls: 15-min format with BANT+Fit qualification. Pricing anchor: $499/mo Pilot vs $4-5K/mo human hire = 80% cost savings.

---

## 2026-03-01

### [orchestrator/crewly-orc] 22:18:49
User asked to monitor Luna and Grace after switching to gemini-cli runtime. Key things to watch: startup/registration, task understanding quality, output format, report-status compatibility, crashes/timeouts. Log issues to GitHub with labels: gemini-cli, runtime-migration.

---

## 2026-03-01

### [orchestrator/crewly-orc] 23:08:01
Nick (steamfun) consistently flags delegated tasks as suspicious prompt injection. Every fresh session requires a follow-up send-message confirming the task is legitimate before he proceeds. Consider adding a verification mechanism or adjusting Nick agent prompt to trust [TASK] messages from the orchestrator queue.

---

## 2026-03-01

### [orchestrator/crewly-orc] 23:11:04
Gemini-cli runtime first issue: Luna hit Gemini API rate limit (quota exceeded) and could not find nano-banana-image skill at config/skills/agent/nano-banana-image/execute.sh. Gemini CLI skill resolution may work differently from Claude Code. Also gemini free tier has strict rate limits. Need to check skill path resolution for gemini-cli agents.

---

## 2026-03-01

### [orchestrator/crewly-orc] 23:20:09
Nick screenshot fix: File > Download > PNG approach works reliably. The Chrome browser skill screenshot command only shows the screen to the model but does not save files. For saving slide PNGs, agents must use File > Download menu in Google Slides, which saves to ~/Downloads/, then cp to target path. Step-by-step explicit instructions critical for complex Chrome automation tasks.

---

## 2026-03-02

### [orchestrator/crewly-orc] 05:12:43
Nick completed SteamFun upload+Slides fix in ~35min. 3 bugs: (1) empty blob MIME validation in processTeacherUpload, (2) REST API createVideo unreliable for new uploads - switched to SlidesApp direct, (3) template logic OK. Deployed v@77. E2E 6/6 passed in 33.3s. Google Drive 97% full caused Page Not Found on new test slides. Nick excels at Apps Script debugging + Chrome browser automation.

---

## 2026-03-02

### [developer/crewly-core-sam-217bfbbf] 05:15:47
IP protection architecture research: Crewly IP layer (AI team playbooks/templates) best protected via 4-layer defense: (1) AES-256-GCM encryption at rest for template files (.enc format with magic header+IV+tag+ciphertext), (2) Closed-source @crewly/template-runtime NPM package with ITemplateProvider interface isolating premium from community templates, (3) License key + machine fingerprint binding with online activation and offline grace period, (4) Ed25519 manifest signing for integrity verification. Key insight: Crewly IP is text content (prompts, SOPs, workflows), not code algorithms — encryption at rest is high value, code obfuscation is low value. Continuous template updates are the best moat. Architecture changes needed: SkillService, PromptBuilderService, KnowledgeService must accept ITemplateProvider injection. ~17.5 days total implementation across 3 phases.

---

## 2026-03-02

### [orchestrator/crewly-orc] 05:16:50
Sam completed IP protection technical analysis in ~10min. Key insight: Crewly IP is text content (prompts, SOPs, workflows), not code algorithms. Recommended: encrypted templates + closed-source runtime NPM package (@crewly/template-runtime) + online license verification + signature anti-tampering. Architecture: ITemplateProvider interface to isolate open-source Engine from premium templates. 9 components need changes. ~17.5 days across 3 phases (6-8 weeks). Continuous updates are the strongest moat.

---

## 2026-03-02

### [orchestrator/crewly-orc] 05:23:10
Ethan completed 7 strategy tasks in ~15min: updated 4 docs (monetization plan, OKRs, fast monetization, strategy recommendations) + created 3 new docs (positioning.md, sales-pitch-guide.md with PVA framework/objection handling/demo script/cold DM templates, ip-protection-research.md 509 lines covering 6 competitors IP practices/legal framework/vibe coding challenge). Conclusion: legal+technical+commercial trinity protection. Ethan excels at comprehensive strategy research and document creation.

---

## 2026-03-02

### [developer/crewly-core-sam-217bfbbf] 05:44:36
Completed full codebase audit 2026-03-02. Key findings: 34 fully implemented features, 8 partial, 6 not implemented. Biggest gaps: Credential Store (design done, no code), Template Backend Service (static JSON only), WhatsApp Settings UI (backend exists, no frontend). Codebase has 134 backend services, 64 controllers, 14 frontend pages, 86 skills, 19 MCP tools, 11 CLI commands. Version 1.2.3.

---

## 2026-03-02

### [orchestrator/crewly-orc] 05:50:01
Session continuity: Sam completed codebase audit (34 features done, 8 partial, 6 not started). Key finding: existing templates are static JSON only, no backend service. Template Backend Service is top priority for template system. Now delegated template schema v0.1 design to Sam. Nick deployed v@79 multi-photo fix, testing in browser.

---

## 2026-03-02

### [developer/crewly-core-sam-217bfbbf] 05:54:15
Template Schema v0.1 design: 7-layer template system (Team Config, Role Personas, Skills, Workflows, Quality Gates, Domain Knowledge, Learned Patterns). Key design decisions: (1) Directory-based templates with template.json as manifest, (2) YAML for workflows and quality gates, JSON for everything else, (3) PromptSource type with 4 resolution strategies (inline, template, global, custom), (4) Workflow steps use dependsOn DAG with ISO 8601 SLA durations, (5) Quality gates reuse existing QualityGate types from quality-gate.types.ts, (6) Knowledge layer reuses existing KnowledgeService index+docs format, (7) Backward-compatible loader that supports both legacy flat JSON and new directory format. Implementation starts with template.types.ts + template-loader.service.ts.

---

## 2026-03-02

### [developer/crewly-core-sam-217bfbbf] 06:01:24
Product Roadmap v1 key insights: (1) 3 critical user journey drop-off points: Init→BYOM Setup(no API key config), Browse→AutoTeam(no template marketplace), FirstRun→Delegate(no onboarding). (2) P0 gap is Template Service + Credential Store — blocks the entire template-to-team flow. (3) crewly init already has createTeamFromTemplate() in CLI but no backend API endpoint. (4) Existing OKR KR3(reusable templates) requires KR9(Template Service) as prerequisite. (5) KR9+KR10 should be prioritized over KR6(CWU)+KR8(TikHub) because they unblock core user journey.

---

## 2026-03-02

### [orchestrator/crewly-orc] 06:23:14
User signed off for the night. Active work: (1) Nick testing makeup class system 3 scenarios in SteamFun. (2) Sam doing 3 research tasks: X tweet, Superpowers GitHub repo, YouTube video. Today completed: codebase audit, template schema v0.1, product roadmap v1, multi-photo fix v@80, 7 strategy docs. Report results to Slack thread 1772432563.612609 when done.

---

## 2026-03-02

### [developer/crewly-core-sam-217bfbbf] 12:47:34
Implemented OAuthReloginMonitorService following the ContextWindowMonitorService singleton pattern. Key implementation details: (1) Uses string matching (indexOf) not regex to prevent ReDoS. (2) Subscribes to PTY session.onData() for real-time output monitoring. (3) For async timer tests with Jest fake timers, use jest.advanceTimersByTimeAsync() instead of setImmediate-based flushMicrotasks - setImmediate can hang with fake timers. (4) Wired into 5 locations in agent-registration.service.ts (3 startMonitoring, 1 stopMonitoring, 1 recovery). (5) Constants in OAUTH_RELOGIN_CONSTANTS and OAUTH_ERROR_PATTERN_SETS in backend/src/constants.ts.

---

## 2026-03-02

### [orchestrator/crewly-orc] 12:49:29
Sam implemented OAuth auto-relogin monitor in ~21min. Service detects authentication_error+OAuth token expired in PTY output, auto-sends /login. Includes cooldown (2min), max attempts (3/10min), startup grace period (30s). Handles Claude Code (Escape+/login) and Gemini CLI (/login only) differently. 21 tests, build passes. Files: oauth-relogin-monitor.service.ts + test.

---

## 2026-03-02

### [developer/crewly-core-sam-217bfbbf] 14:24:09
OAuth auto-relogin feature (Steps 1-4) fully implemented. Service: OAuthReloginMonitorService (singleton at backend/src/services/agent/). Pattern: subscribes to PTY onData, strips ANSI, accumulates in rolling buffer, string-matches error patterns (no regex for ReDoS safety). After detecting 401+OAuth expired, sends Escape+/login to PTY, then enters URL capture mode. Captures OAuth URL from output (string scanning for https:// + OAuth path indicators). Emits agent:oauth_url event via EventBus. API endpoint POST /api/sessions/:name/oauth-callback writes auth code to PTY. Constants in OAUTH_RELOGIN_CONSTANTS and OAUTH_ERROR_PATTERN_SETS in backend/src/constants.ts. Wired in agent-registration.service.ts (4 start locations + 1 stop) and index.ts (EventBus + shutdown). 35 tests all pass. Key test pattern: use jest.advanceTimersByTimeAsync() for async functions with internal setTimeout.

---

## 2026-03-02

### [orchestrator/crewly-orc] 15:07:42
Restaurant marketing client (7 Japanese restaurants: Hanami/Tsuru/Weymouth dine-in + Melrose/Arlington/Belmont/Watertown takeout). Proposals sent (CN+EN PDF). User prefers browser automation over API for Phase 2 (Playwright instead of IG/FB/TikTok/Google APIs). Waiting for client response before proceeding with technical implementation plan.

---

## 2026-03-02

### [orchestrator/crewly-orc] 17:30:17
Luna (Gemini CLI) cannot read files from /tmp — workspace restriction blocks paths outside steves_think_tanks project. Must copy files to project dir or ~/.crewly/ before delegating to Gemini CLI agents. Claude Code agents have no such restriction.

---

## 2026-03-02

### [orchestrator/crewly-orc] 21:23:36
用户朋友做parenting课后班SMB项目，转型general agent并拿到VC funding。验证SMB empowerment方向正确。用户决定更激进——餐厅先行策略：push pilot落地→referral chain→模板化。竞争焦虑中30%是真实压力，核心问题是速度不够快。

---

## 2026-03-02

### [orchestrator/crewly-orc] 21:27:07
用户有国内朋友需要海外引流（Reddit/Instagram），这是潜在第二个垂直客户。Joe之前用用户自己的账号在Reddit/IG发内容已验证能拿到impressions。关键风险：平台风控（Reddit养号、IG频率控制）、账号授权信任。这是「跨境SMB内容分发」模板机会，和餐厅本地营销并列。

---

## 2026-03-02

### [orchestrator/crewly-orc] 22:28:21
delegate-task skill script can fail silently (exit code 1 with no error message). Workaround: use direct API call curl -s -X POST http://localhost:8787/api/sessions/{sessionName}/write with JSON body {"data":"message"} to send tasks to agents. This bypasses whatever issue delegate-task has.

---

## 2026-03-02

### [developer/crewly-core-sam-217bfbbf] 22:33:25
agent-browser (vercel-labs): Browser+desktop automation CLI for AI agents. Architecture: Rust CLI (parsing <1ms) + Node.js daemon (Playwright, persistent). Electron control via CDP --remote-debugging-port. Key innovation: accessibility snapshot + ref system (@e1, @e2) replaces CSS selectors. Token efficiency: 82.5% less than Playwright MCP (280 chars vs 8247 for homepage snapshot). 4 skills: agent-browser, electron, slack, dogfood. Install: npx skills add vercel-labs/agent-browser --skill electron. Crewly integration: can be wrapped as native skill in config/skills/agent/desktop-app-control/. Crewly already has 4 browser skills (chrome-browser MCP, playwright-chrome-browser MCP, browse-stealth CDP+Patchright, vnc-browser). agent-browser fills the missing desktop app control gap.

---

## 2026-03-02

### [orchestrator/crewly-orc] 23:22:18
Gemini CLI agents (Ella, Mila, Ethan) all failed to execute delegated tasks in this session (2026-03-02). Pattern: agents register, recall context, receive task text in terminal, but go idle without producing output. Ethan showed 1 error in status bar. Restart did not help. Only Ella produced output during initialization (not from delegated tasks). Consider switching critical/urgent tasks to Claude Code runtime agents for reliability.

---

## 2026-03-02

### [developer/crewly-core-sam-217bfbbf] 23:51:20
delegate-task fix: Root cause was (1) waitForReady timeout 120s causing 2-min hangs when agent busy, (2) api_call errors go to stderr only but orchestrator captures only stdout, so it sees empty output + exit 1. Fix: reduced waitTimeout to 15s, added force-mode fallback (direct PTY write if waitForReady times out), output errors to stdout on final failure. Also guarded SCHED_BODY jq with 2>/dev/null || true to prevent monitoring jq failures from killing the script under set -e. Pattern: use || VAR=false to catch api_call failures under set -e without killing the script.

---

## 2026-03-03

### [orchestrator/crewly-orc] 04:18:05
森先生你好 小红书账号数据分析（67篇/1670粉）：图文>>视频（播客口播视频平均12赞，图文爆款1066赞）。具体工具名>>抽象概念（Vibe Coding 1066赞 vs AI护城河 15赞）。暗色Crewly品牌封面=算法判定营销=低流量。大字报+个人叙事=高流量。同一选题「自我进化」：品牌封面14赞，个人叙事封面113赞。

---

## 2026-03-04

### [orchestrator/crewly-orc] 15:50:43
Gemini CLI agents go inactive/suspended if they finish initialization and are not immediately given a task. Must delegate-task IMMEDIATELY after agent shows idle post-init (within seconds, not minutes). Luna survived because she auto-found work from recalled context. Mia and Iris had no recalled tasks and timed out.

---

## 2026-03-04

### [orchestrator/crewly-orc] 15:54:37
Gemini CLI agents have ~10-15 minute idle timeout. After completing work and going idle, they automatically suspend/exit if no new task arrives. All 5 Gemini CLI agents (Mia, Iris, Luna, Ethan, Ella) exhibited this behavior. Luna lasted longest because she auto-found work from recalled context, but still suspended after ~15 min idle. Must either: (1) immediately delegate next task when agent goes idle, or (2) investigate Gemini CLI keepalive/timeout settings, or (3) switch critical agents to claude-code runtime.

---

## 2026-03-04

### [orchestrator/crewly-orc] 16:06:17
Gemini CLI agent reliability fix confirmed: START + IMMEDIATE DELEGATE pattern works. All 5 agents (Mia, Iris, Luna, Ethan, Ella) successfully completed tasks when delegate-task was called right after start-agent, without waiting for idle confirmation. Previous failures were caused by agents timing out during idle wait. Key: use delegate-task with monitor auto-config immediately after start-agent.

---

## 2026-03-04

### [orchestrator/crewly-orc] 19:31:02
Gemini CLI agents sustained velocity record: 3 agents (Mia, Iris, Luna) completed 13 deliverables in a single session with zero Claude usage. Each agent averaged 4-5 tasks. Key: immediate task delegation after completion (no idle gaps), well-structured task descriptions with clear output paths, and monitor auto-cleanup after each completion. Gemini CLI excels at research, strategy docs, and content writing tasks. Code tasks still need Claude Code (Sam).

---

## 2026-03-04

### [orchestrator/crewly-orc] 20:11:27
2026-03-04 record day: 34 deliverables in one session using 4 Gemini CLI agents (Mia/Iris/Luna/Ethan), zero Claude usage. Assembly line pattern: as soon as one agent completes, cancel fallback schedule + delegate next task immediately. All agents ran gemini-3-flash-preview runtime. Task types: strategy research, blog writing, template design, UI specs, investor narrative, competitive analysis, OKR review. Average completion time per task: ~5-10 minutes. Key: detailed task descriptions with specific file paths and structure requirements produce higher quality outputs.

---

## 2026-03-04

### [orchestrator/crewly-orc] 20:18:11
Performed manager-level output review of 34 deliverables (2026-03-04). Key findings: (1) Positioning consistency is excellent across all docs, (2) 92% savings claim needs TCO caveats, (3) SteamFun pilot referenced as validation but barely started, (4) Solo developer bottleneck - roadmap needs 20+ weeks but targets 8, (5) Open Source vs Closed Source boundary undefined across docs, (6) All 34 deliverables are strategy/content with zero code written. Top recommendation: shift from strategy production to shipping code - specifically Credential Store + crewly init v2.0 + one vertical template.

---

## 2026-03-04

### [orchestrator/crewly-orc] 23:42:05
Completed 2-round peer review with 9 agents. Key findings: (1) Mia 8/8 unanimous for Product Lead, (2) Ethan 7/8 for Strategy Lead, (3) Luna 5 votes for GTM but does not want the role - recommends Ella who accepted, (4) Sam most honest self-reviewer (8.0/10, 82 commits) and universally recognized as single point of failure (7/9 mentioned), (5) Nick most humble (7.5/10), (6) Sam proposes need-freeze windows 2-3 days/week, (7) Recommended org: Mia(PM Lead)+Sam(Tech Lead) / Ethan+Iris / Ella(GTM Lead)+Luna(Chief Storyteller)+Grace(Sales Lead)+Mila

---

## 2026-03-06

### [developer/crewly-core-sam-217bfbbf] 17:24:57
Hierarchical architecture design completed. Key decisions: (1) Flat storage with hierarchy fields (parentMemberId + hierarchyLevel) on TeamMember, not nested JSON. (2) Do NOT fully adopt A2A — too expensive (10-15 weeks) for a local system. Borrow 3 concepts: Task state machine, Artifacts, Message standardization (~2-3 weeks). (3) Team Leader gets subset of orchestrator skills (delegate-task, verify-output, aggregate-results). (4) EventBus needs new event types (task:submitted/completed/failed + hierarchy:escalation/delegation/report_up). (5) Report chain: Worker→TL→Orc with TL aggregation (not passthrough). (6) Escalation when TL unresponsive (15min timeout) or TL session inactive. Total estimated effort: 17-27 days across 5 phases.

---

## 2026-03-06

### [orchestrator/crewly-orc] 17:29:03
Hierarchical architecture design completed by Sam+Mia. Key decisions: 3-tier (Orc→TL→Worker), selective A2A borrowing (3 concepts in 2-3 weeks vs full adopt 10-15 weeks), TL=Planner+Verifier+Reporter, aggregated reporting. Implementation: 17-27 days in 5 phases. Docs at docs/roadmap/hierarchical-architecture-design.md and hierarchical-workflow-design.md. Delivered to Steve 2026-03-06, awaiting his review.

---

## 2026-03-06

### [developer/crewly-core-sam-217bfbbf] 19:39:05
Updated hierarchical architecture design per Steve feedback: (1) Added section 2.6 multi-level hierarchy compatibility - parentMemberId+hierarchyLevel supports N-level depth without data model changes, code should use relationship-based logic not hardcoded level checks. (2) Replaced HierarchyTask with InProgressTask extensions in task-tracking.types.ts - added delegatedBy, parentTaskId, childTaskIds, artifacts, statusHistory, verificationResult, assigneeHierarchyLevel, extended status enum with A2A states (submitted/working/verifying/failed/cancelled). All new fields optional for backward compat. (3) Added Part 5 Team Template system - TeamTemplate type with VerificationPipeline (steps+passPolicy+maxRetries), 3 preset templates (dev/content/research), Team.templateId references template. TL verify-output skill loads pipeline from template. (4) Phase 6 added to roadmap (5-7 days). Total effort now 22-34 days.

---

## 2026-03-06

### [developer/crewly-core-sam-217bfbbf] 20:08:58
Phase 1 Data Model Foundation completed. Key implementation notes: (1) TeamMemberRole is now a named exported type in types/index.ts — all Record<> uses must reference it. (2) uuid mock in team.controller.test.ts returns same value by default (mock-uuid-123) — hierarchy tests need custom uuid mock with unique sequential IDs. (3) InProgressTask extended with 11 statuses, TaskArtifact, TaskStatusEntry, TaskVerificationResult types — all in task-tracking.types.ts. (4) Team controller createTeam validates hierarchical teams require team-leader or canDelegate member, auto-wires parent-child via subordinateIds/parentMemberId. (5) team-leader role config at config/roles/team-leader/ with prompt.md using {{WORKER_LIST}} template var.

---

## 2026-03-06

### [orchestrator/crewly-orc] 20:10:56
Phase 1 Data Model Foundation completed by Sam in ~14 min. 78 tests pass (16 task-tracking + 11 types + 51 controller). All 6 subtasks done cleanly. Backward compatible. Phase 2 TL Skills immediately assigned. Mia Phase 2 prep was ready in parallel — good pipeline efficiency.

---

## 2026-03-06

### [developer/crewly-core-sam-217bfbbf] 20:17:32
Phase 2 TL Skills complete. Key patterns: (1) TL skills at config/skills/team-leader/ use _common/lib.sh which delegates to shared config/skills/_common/lib.sh. (2) Skill IDs prefixed with tl- (tl-decompose-goal, tl-delegate-task, etc). (3) delegate-task TL version validates hierarchy via GET /teams/{id} API checking worker.parentMemberId == tlMemberId. (4) verify-output supports command checks (run shell cmd) and content-scan checks (regex on task output). (5) handle-failure decision: retries<2 retry, skill_mismatch reassign, resource/permission/budget escalate, retries>=2 reassign then escalate. (6) aggregate-results writes [TL_REPORT] tagged markdown to /tmp/ file. (7) TL prompt uses {{TL_SKILLS_PATH}}, {{TEAM_ID}}, {{MEMBER_ID}}, {{PROJECT_PATH}} template vars.

---

## 2026-03-06

### [orchestrator/crewly-orc] 20:19:14
Phase 2 TL Skills completed by Sam. 5 skills totaling 655 lines of bash + instructions + JSON configs. TL prompt updated to 145 lines. Context compaction happened mid-Phase-2 requiring a nudge, but Sam recovered cleanly. Phase 1+2 done in same session — good velocity.

---

## 2026-03-06

### [developer/crewly-core-sam-217bfbbf] 20:25:23
Phase 3 Message Standardization: Created 4 structured message types (TaskAssignment, StatusReport, VerificationRequest, VerificationResult) in hierarchy-message.types.ts. Built message-serializer.ts with roundtrip serialize/parse using markdown format with [TYPE] header blocks between --- delimiters and ## Section bodies. Updated 3 shell skills (delegate-task, report-status, complete-task) with structured=true flag for backwards-compatible activation. All use same pattern: parse extra JSON fields, conditional format generation, legacy format as default. 37 tests cover types, serialization, roundtrip, and backwards compat.

---

## 2026-03-06

### [developer/crewly-core-sam-217bfbbf] 20:36:55
Phase 4 EventBus & Reporting: Added 11 new event types to EVENT_TYPES (8 task:* + 3 hierarchy:*). Extended EventFilter with taskId/hierarchyLevel/parentMemberId and updated matchesSubscription in event-bus.service.ts. Extended AgentEvent with optional taskId/hierarchyLevel/parentMemberId metadata. Extended ChangedField with taskStatus/hierarchyAction. Created HierarchyReportingService (singleton) at backend/src/services/hierarchy/ with AggregatedReport type, worker report storage, aggregation logic (computeSubtaskSummary, computeOverallState, collectKeyArtifacts, assessQuality), and markdown serialization. Created HierarchyEscalationService (singleton) with escalation condition checking (TL inactive/unresponsive/security), parent routing via parentMemberId chain, TL response time tracking, and hierarchy:escalation event emission. Testing gotcha: isTLUnresponsive uses Date.now() — must use jest.useFakeTimers() + advanceTimersByTime() in tests, not setUnresponsiveTimeout(1) which causes race conditions.

---

## 2026-03-06

### [orchestrator/crewly-orc] 20:38:32
Phase 4 completed: Sam created hierarchy-reporting.service.ts (387 lines), hierarchy-escalation.service.ts (374 lines), 11 new event types, enhanced EventFilter. 67 tests across 4 files. Sam experienced 3 context compactions during Phase 4 — each time needed a focused nudge to continue. Pattern: keep nudge messages short and specific (exact file + line number).

---

## 2026-03-06

### [developer/crewly-core-sam-217bfbbf] 20:52:03
Phase 5 Frontend Hierarchy: Created 4 components in frontend/src/components/Hierarchy/. Key learnings: (1) Frontend tests must run from frontend/ directory (cd frontend && npx vitest run) not from root. (2) Lucide React icons have size prop typed as string|number - use React.FC<{className?: string; size?: string | number}> for icon prop types. (3) Frontend types at frontend/src/types/index.ts now mirror backend hierarchy fields (parentMemberId, hierarchyLevel, subordinateIds, canDelegate, maxConcurrentTasks on TeamMember; hierarchical, leaderId, templateId on Team).

---

## 2026-03-06

### [developer/crewly-core-sam-217bfbbf] 21:13:31
Phase 6 Team Template System completed. New files: backend/src/types/team-template.types.ts (types+validators), backend/src/services/template/template.service.ts (singleton, loads from config/templates/), backend/src/controllers/template/ (REST API: GET /api/templates, GET /:id, POST /:id/create-team). 3 preset templates in config/templates/{dev-fullstack,social-media-ops,research-analysis}/template.json. Upgraded verify-output skill with templateId support, passPolicy (all/majority/critical_only), critical flag tracking. Updated CLI templates.ts to load new-format templates from subdirectories. 138 total Phase 6 tests pass. Key patterns: TemplateService uses two-pass algorithm for hierarchy wiring (create members first, then wire parentMemberId/subordinateIds). CLI convertNewFormatTemplate maps roles[] to members[] for backward compat.

---

## 2026-03-06

### [orchestrator/crewly-orc] 21:16:54
Hierarchical Architecture 6-phase implementation COMPLETE (2026-03-06). Sam delivered all 6 phases in one session: Data Model → TL Skills → Message Standardization → EventBus+Reporting → Frontend+UX → Team Templates. 300+ tests, build clean. Key challenge: Sam experienced ~8 context compactions total, each requiring a focused nudge. Pattern: keep nudge messages short with exact file/line references. Total effort: ~4 hours of active agent work across 6 phases.

---

## 2026-03-07

### [developer/crewly-core-sam-217bfbbf] 02:10:37
Crewly Pro Phase 1 completed. Key learnings: (1) LicenseService.getInstance() changed to optional publicKey (returns existing instance after first init). (2) ActivationResult has license?: LicensePayload, not tier/features/expiresAt directly. (3) jest moduleNameMapper for cross-repo imports needs both patterns for .js stripping. (4) Premium templates use same format as OSS with added tier field and promptAdditions. (5) All 113 tests pass across both repos.

---

## 2026-03-07

### [developer/crewly-core-sam-217bfbbf] 02:55:30
Crewly Pro MVP completed: 240 tests (17 suites) all passing. Phase 1 had 89 tests (8 suites). MVP added 151 tests (9 suites). Key modules: (1) desktop-installer: OS detection, Node.js/Claude Code checks, project init, license activation — 33 tests. (2) runtime: RuntimeManager singleton with Claude Code detection, OAuth monitoring, exponential backoff (1s->2s->4s->...->30s cap), port management, health endpoint — 53 tests. (3) template-system: list/preview/apply premium templates (pro-dev-fullstack, pro-research-analysis, pro-social-media-ops) with REST routes — 42 tests. (4) integration: Full E2E flow (init->health->license->list->preview->apply) + edge cases — 23 tests. All modules follow existing patterns: singleton services, co-located test files, JSDoc, Express routers, semver for version checks.

---

## 2026-03-07

### [orchestrator/crewly-orc] 02:56:14
Crewly Pro MVP completed by Sam in one session. Phase 1 (89 tests) + MVP (151 tests) = 240 total. Covers: CLI installer, RuntimeManager (OAuth/version/process with exponential backoff), Template E2E (list/preview/apply), integration tests. Sam needed a session restart mid-way (got stuck after Phase 1 completion, session unresponsive to new tasks). After restart, completed MVP in ~20min.

---

## 2026-03-07

### [developer/crewly-core-sam-217bfbbf] 03:09:20
Crewly Pro Phase 2 complete. CLI entry point uses Commander.js (crewly-pro init/start/status/stop/update/templates). Server state persisted at ~/.crewly/server.state.json. Install script supports curl|sh pattern with --license-key, CREWLY_INSTALL_DIR, CREWLY_VERSION env vars. Build scripts use @yao-pkg/pkg for standalone binaries (node18-macos-x64/arm64, node18-win-x64). All 297 tests passing across 21 suites.

---

## 2026-03-07

### [orchestrator/crewly-orc] 03:09:42
Sam completed Crewly Pro Phase 2 in one session: CLI entry point (Commander.js, 5 subcommands), CLI service (server state mgmt), shell install script (272 lines, curl|sh pattern), macOS+Windows build scripts using @yao-pkg/pkg. 297 tests across 21 suites. Phase 1→MVP→Phase 2 all delivered back-to-back with high quality.

---

## 2026-03-07

### [orchestrator/crewly-orc] 03:14:11
Google Chrome cookies are encrypted per-instance — copying Chrome profile directory does NOT transfer auth cookies to Playwright. Solution: use chromium.connectOverCDP("http://127.0.0.1:9222") to connect Playwright to an already-running Chrome with --remote-debugging-port=9222. This preserves all auth state including Google login.

---

## 2026-03-07

### [developer/crewly-core-sam-217bfbbf] 03:25:36
Built computer-use skill at config/skills/agent/computer-use/ with 4-layer architecture: discover.sh (app listing + method detection), applescript.sh (custom code + 6 presets), accessibility.sh (ui-tree, click by role:name, type, get-text, scroll, focus), playwright.sh (Chrome CDP via WebSocket). Key gotcha: tr newline escaping in bash — use printf %s and tr newline to space, not tr newline to backslash-n (tr maps char-by-char, second set truncated). Audit logging to ~/.crewly/logs/computer-use.log. 41 tests all passing.

---

## 2026-03-07

### [developer/crewly-core-sam-217bfbbf] 03:34:28
agent-browser (Vercel Labs) v0.16.3 installed and wrapped as Crewly skill at config/skills/agent/desktop-app-control/. Key architecture: Rust CLI + Node.js daemon + Playwright, uses accessibility snapshot + ref system (@e1, @e2). Electron apps controllable via CDP --remote-debugging-port flag. Machine has 9 Electron apps + Chrome = 10 controllable. Gotchas: (1) bash associative arrays (declare -A) fail with set -u when keys have spaces — use here-strings with while read instead. (2) pipe creates subshell so variables set inside are lost — use here-string (<<<) instead. (3) Apps must be quit first then relaunched with --remote-debugging-port to enable CDP. (4) agent-browser --auto-connect checks Chrome DevToolsActivePort file.

---

## 2026-03-07

### [orchestrator/crewly-orc] 03:34:41
desktop-app-control skill completed by Sam. Location: config/skills/agent/desktop-app-control/. Based on agent-browser v0.16.3 (Vercel Labs). 16 subcommands, 29 tests. Controls Electron apps + Chrome via CDP. Apps need to be relaunched with --remote-debugging-port flag. Machine has 10 controllable apps: Slack, VS Code, Notion, Chrome (running), Discord, Figma, Spotify, Postman, MongoDB Compass, Termius, FloPost, Antigravity (installed).

---

## 2026-03-07

### [developer/crewly-core-sam-217bfbbf] 04:41:39
Hierarchy frontend integration completed. Key integration points: (1) HierarchyDashboard added to TeamDetail.tsx above TeamOverview, shown when team.hierarchical===true. (2) HierarchyModeConfig added to TeamModal.tsx between project assignment and team members sections, with hierarchyConfig state managing hierarchical+leaderId. (3) TaskFlowView added to ProjectDetail.tsx tasks tab, fetches in-progress tasks via inProgressTasksService and maps them to TaskFlowItem. Shown as collapsible section above kanban board. (4) Backend UpdateTeamRequestBody extended with hierarchical+leaderId fields. updateTeam controller now handles toggling hierarchy on/off and wiring parent-child relationships. (5) Barrel export created at frontend/src/components/Hierarchy/index.ts. (6) Type compatibility: TeamModal local TeamMember cast as unknown as AppTeamMember since HierarchyModeConfig only reads id/name/role.

---

## 2026-03-07

### [developer/crewly-core-sam-217bfbbf] 05:30:38
Graceful Restart implementation: (1) Added PROCESS_EXIT_CODES.RESTART_REQUESTED=120 to config/constants.ts. (2) restartServer in system.controller.ts now exits with code 120 instead of 0. (3) CLI start.ts detects exit code 120 and respawns the backend in a while loop. Uses a mutable activeProcesses array so shutdown handlers always reference the current process. (4) Port delay of 1.5s between respawns lets OS reclaim the port. (5) setupShutdownHandlers only called once — mutable array reference prevents duplicate listeners.

---

## 2026-03-07

### [orchestrator/crewly-orc] 05:31:11
Sam completed graceful restart: PROCESS_EXIT_CODES.RESTART_REQUESTED=120 in config/constants.ts. CLI start.ts detects exit 120 and respawns backend with 1.5s delay. restartServer() in system.controller.ts uses this code. Also confirmed TeamModel bug was already fixed — hierarchical/leaderId/templateId in constructor (L22-24) and toJSON (L79-81).

---

## 2026-03-07

### [orchestrator/crewly-orc] 05:44:39
Ethan (Gemini CLI) excels at strategic analysis — completed both the Action Plan and Competitor Deep Analysis quickly with well-structured reports, data citations, and actionable recommendations. Revised 90% demo claim to 10/30/60 split with Deloitte data and OpenClaw CVE evidence. Identified Mastra as underrated TS-ecosystem threat.

---

## 2026-03-07

### [product-manager/crewly-core-mia-member-1] 05:51:53
Revised Core Team OKRs to align with Steve's dual-track strategy (OS for lead gen, Pro for revenue). Identified key gaps: WeChat requires a new adapter (Wechaty), Screen Recording Learning requires a new observation service, and Ad APIs need MCP server wrappers. Onboarding bugs (npx crewly init) are the top P0 blocker for OS growth.

---

## 2026-03-07

### [orchestrator/crewly-orc] 05:54:22
TL OKR revision meeting conducted successfully with 3 TLs (Mia, Ethan, Ella) working in parallel. All 3 completed within ~10 minutes. Key consensus: 1-click install is P0, Screen Recording Learning is the Pro killer feature, SteamFun is Beta 1 customer, A2A deprioritized to P2. Steve dual-track strategy: OS for acquisition, Pro for revenue (outcome delivery not tool sales).

---

## 2026-03-07

### [orchestrator/crewly-orc] 06:23:53
Session continuation after context compaction: all overnight tasks completed successfully. 3 Marketing handbooks (Luna content, Ella visual, Mila growth analytics) + Ethan OpenClaw analysis all delivered. Steve woke up and immediately shared new task (Seedance video capability) — delegated to Ella within 2 minutes. Morning summary sent to main strategy thread.

---

## 2026-03-07

### [orchestrator/crewly-orc] 07:39:57
Stale scheduled checks can flood the orchestrator for 30+ minutes after tasks complete. Root cause: old recurring schedules with queued instances continue firing even after cancel-schedule is called (cancel only prevents NEW instances, already-queued ones still execute). Future fix: (1) implement a schedule purge API that clears queued instances, (2) add task-completion-aware guards in the scheduler so checks auto-skip if the associated task is already done, (3) consider maxOccurrences param when creating recurring schedules to limit total fires.

---

## 2026-03-07

### [orchestrator/crewly-orc] 15:13:22
成功用 Slack API files.info + url_private_download 下载了之前无法获取的 PDF。方法：SLACK_TOKEN=$(grep SLACK_BOT_TOKEN .env | cut -d= -f2) → curl files.info → extract url_private_download → curl with auth header。之前失败是因为 env var 没正确 source。

---

## 2026-03-07

### [developer/crewly-core-sam-217bfbbf] 16:08:30
Crewly Pro self-test completed (2026-03-07). Package at /Users/yellowsunhy/Desktop/projects/crewly-pro v0.1.0. All 297 tests pass across 21 suites. TypeScript compiles cleanly. 3 premium templates (pro-dev-fullstack, pro-research-analysis, pro-social-media-ops) all valid. Full E2E flow works: init -> license activation -> runtime health -> template apply. Coverage: 79.3% stmts, 87.2% funcs. Minor: ts-jest TS151002 warning (cosmetic), empty docker/ and placeholder packages (premium-skills, apprentice-recorder). install.sh works but references unpublished npm package @crewly/pro. Build scripts (pkg binary) not tested (requires @yao-pkg/pkg install). No blocking issues.

---

## 2026-03-07

### [developer/crewly-core-sam-217bfbbf] 16:23:31
P0 stability fixes PAUSED per orchestrator (2026-03-07). Work done so far: Read all 3 issues (#130 Gemini PTY write, #129 agent failure recovery, #124 notification delay). Completed deep-dive on PTY write mechanism via Explore agent — full understanding of sendMessageWithRetry() runtime differences (Claude Code vs Gemini CLI), session-command-helper two-step write pattern, shell mode guards, focus recovery strategies. Key finding for #130: PTY write itself is identical for both runtimes, the issue is in delivery/recovery layer (Tab+Enter focus, shell mode escape, Ctrl+C is destructive for Gemini). For #124: Option C (hybrid direct notification + orchestrator awareness) is recommended. For #129: need agent failure classification (transient/persistent) + retry protocol. No code changes made yet. RESUMING AFTER multi-TL team model feature.

---

## 2026-03-07

### [developer/crewly-core-sam-217bfbbf] 16:47:57
Multi-TL team model implementation complete (all 4 phases). Key files modified: backend/src/types/index.ts (leaderIds on Team), backend/src/models/Team.ts (fromJSON migration logic), backend/src/controllers/team/team.controller.ts (create+update multi-TL wiring), backend/src/controllers/request-types.ts (leaderIds field), frontend/src/types/index.ts (leaderIds), frontend/src/components/Hierarchy/HierarchyModeConfig.tsx (multi-select toggle buttons), frontend/src/components/Modals/TeamModal.tsx (leaderIds init+submit). Design pattern: leaderIds[] is source of truth, leaderId deprecated = leaderIds[0]. fromJSON auto-migrates legacy single leaderId to leaderIds array. Frontend uses toggle button group (not dropdown) for multi-select. Pre-existing test issues: messaging.types.test needs WhatsApp MESSAGE_SOURCE update, frontend vitest needs jsdom package installed.

---

## 2026-03-07

### [developer/crewly-core-sam-217bfbbf] 17:19:15
Bug #130 fix: Gemini CLI agents not processing PTY writes. Root causes: (1) matchTuiPromptLine only matched > but not ! (shell mode prompt). Added 0x21 to prompt char check. (2) Force delivery in terminal.controller.ts did session.write(msg+CR) which bundles into bracketed paste. Changed to two-step write for TUI runtimes. (3) MCP error overlay steals focus. Added error state detection and Enter dismissal plus double-Tab focus cycling in sendMessageWithRetry. Files changed: terminal-string-ops.ts, terminal.controller.ts, agent-registration.service.ts.

---

## 2026-03-07

### [orchestrator/crewly-orc] 17:29:13
Steve corrected: task assignment to subordinates should go through TLs, not directly from orchestrator. When Sam is Dev TL, orchestrator gives Sam the requirements and Sam decides how to assign to Leo. Orchestrator -> TL -> Dev, not Orchestrator -> Dev directly.

---

## 2026-03-07

### [developer/crewly-core-leo-member-n] 17:35:04
Implemented CrewlyAI Cloud integration (Phase 1-3): CloudClientService (singleton, fetch-based API client with connect/disconnect/getTemplates/getTemplateDetail/getStatus), CloudAuthMiddleware (requireCloudConnection, requireTier with tier hierarchy), Cloud controller+routes (POST connect/disconnect, GET status/templates). Added CLOUD_CONSTANTS to backend/src/constants.ts. Registered routes at /api/cloud/* in api.routes.ts. All 44 tests pass, build compiles clean. Files: backend/src/services/cloud/{cloud-client.service,cloud-auth.middleware}.ts, backend/src/controllers/cloud/{cloud.controller,cloud.routes,index}.ts

---

## 2026-03-07

### [developer/crewly-core-sam-217bfbbf] 17:35:10
Bug #129 fix: Orchestrator goes silent when agent fails. Root cause: RuntimeExitMonitorService (runtime-exit-monitor.service.ts) updates agent status to inactive + broadcasts WebSocket BUT does NOT publish agent:inactive event to EventBus. Orchestrator subscribes to agent:inactive via EventBus (team.controller.ts ensureOrchestratorSubscriptions) but never receives it. Fix: Import EventBusService (type-only), add setEventBusService setter, add publishInactiveEvent private method that creates AgentEvent with team/member names from StorageService.findMemberBySessionName. Wire in index.ts. Pattern: TeamsJsonWatcherService publishes both agent:status_changed and agent:inactive events — must mirror this pattern. Test gotcha: Gemini failure tests override mockGetExitPatterns and mockCapturePane — must restore defaults in subsequent describe beforeEach.

---

## 2026-03-07

### [orchestrator/crewly-orc] 17:35:44
Leo (new Claude Code dev) completed Cloud integration (3 phases, 44 tests) in a single session on his first task. Fast and reliable. Good for service-layer work.

---

## 2026-03-07

### [developer/crewly-core-sam-217bfbbf] 17:48:09
Bug #124 fix: Agent completion notification delay (3-10min → seconds). Three changes: (1) SYSTEM_EVENT_TIMEOUT reduced from 60000 to 15000ms in constants.ts — system events now wait max 15s for orchestrator prompt before force-delivering. (2) ActivityMonitor POLLING_INTERVAL reduced from 120s to 30s — moved to ACTIVITY_MONITOR_CONSTANTS in constants.ts, cuts idle detection delay from 2min to 30s. (3) agentResponse handler in chat.controller.ts broadened from only [DONE] to [DONE]+[IDLE]+[STATUS REPORT] — all agent status reports now enqueue to MessageQueueService for orchestrator. Slack notification only sent for [DONE]. Test for activity-monitor updated: polling interval expectation 120000→30000, timer advance 120000→30000, log message made dynamic. Pre-existing: chat.controller.test.ts fails due to node-pty architecture issue (not related to changes).

---

## 2026-03-07

### [developer/crewly-core-sam-217bfbbf] 18:32:17
Bug #128 fix: (1) Message dedup guard in sendMessageWithRetry - on retry attempts, skip re-write if spinner is visible OR if agent is not at prompt and message text is NOT stuck at bottom. Prevents false-negative verification from causing duplicate PTY writes. (2) Gemini CLI auto-update suppression - set disableAutoUpdate=true in .gemini/settings.json during ensureGeminiMcpConfig. Both fixes have tests. Pre-existing test failures in gemini-runtime.service.test.ts (9 tests) due to GOOGLE_GENAI_API_KEY vs GEMINI_API_KEY rename - not related to these changes.

---

## 2026-03-07

### [orchestrator/crewly-orc] 18:36:21
TL agents may try manual curl to wrong port (3000) instead of using skill scripts that have correct port (8787). Root cause: Sam tried curl localhost:3000/health, got connection refused, thought backend was down. Fix: TL prompt should say always use skill scripts never manual curl. Or set CREWLY_API_URL env var in agent sessions.

---

## 2026-03-07

### [orchestrator/crewly-orc] 18:55:38
Sam completed monorepo evaluation: crewly-projects/ structure is sound, ~2-3 days, main risk is Docker deploy pipeline. Recommended phased: OSS+web first, then Pro+services. crewly-pro file: dep needs workspace tooling.

---

## 2026-03-07

### [developer/crewly-core-leo-member-n] 19:06:19
Implemented WebSocket Relay for Cloud Hub (双机互联). Key files: relay.types.ts (wire protocol types + guards), relay-crypto.service.ts (AES-256-GCM E2EE with PBKDF2 key derivation), relay-server.service.ts (WS server with registration/pairing/forwarding), relay-client.service.ts (WS client with auto-reconnect/heartbeat), relay.controller.ts + relay.routes.ts (REST API for registration/status). All in backend/src/services/cloud/ and controllers/cloud/. Constants added to CLOUD_CONSTANTS.RELAY and CLOUD_CONSTANTS.RELAY_ENDPOINTS. Routes mounted at /api/relay in api.routes.ts. 85 tests across 6 test files. Key gotcha: WebSocket test timing — must set up ALL message listeners BEFORE triggering the event that produces them (e.g., set up paired listeners on both ws1 and ws2 before ws2 registers).

---

## 2026-03-07

### [developer/crewly-core-sam-217bfbbf] 19:11:07
Monorepo restructure Phase 1+2 done. Crewly OSS moved to /Users/yellowsunhy/Desktop/projects/crewly-projects/crewly/ with symlink at old path /Users/yellowsunhy/Desktop/projects/crewly for backward compat (running backend, agent sessions, skill paths all still resolve). Web/marketing copied (not moved) to crewly-projects/web/. services/ and ops/ skeleton dirs created. CRITICAL LESSON: Moving the project directory while running inside it breaks bash sandbox (CWD validation fails). Fix: create symlink at old path pointing to new location. The web Dockerfile still references apps/crewly/ COPY paths from stevesprompt monorepo context — needs updating when Docker deploy pipeline migrates. Pre-existing Next.js build error (useContext null in static export) is NOT related to the move.

---

## 2026-03-07

### [developer/crewly-core-sam-217bfbbf] 19:21:08
Monorepo restructure FULLY COMPLETE. Final structure at /Users/yellowsunhy/Desktop/projects/crewly-projects/: crewly/ (OSS core), web/ (marketing site copy from stevesprompt/apps/crewly), desktop/ (was crewly-pro, file:../crewly dep still works as sibling), services/ (empty skeleton), ops/strategy/ (was crewly-strategy docs). Symlink at old /projects/crewly path REMOVED — clean structure, no symlinks. Old stevesprompt/apps/crewly still preserved as backup. Neither crewly-pro nor crewly-strategy had git remotes. The crewly OSS git remote (github.com/stevehuang0115/crewly.git) is intact. npm run build passes. Key gotcha: after removing the symlink, the old CWD path is invalid — bash sandbox breaks and subagents are needed for remaining commands.

---

## 2026-03-07

### [orchestrator/crewly-orc] 19:47:59
Gemini CLI shows folder trust prompt when starting in a new/moved folder. Options: 1=Trust folder, 2=Trust parent folder, 3=Dont trust. send-key cannot send number keys (only special keys). send-message also fails if session isnt fully initialized. Need a pre-trust mechanism (write .gemini/settings.json) or post-startup auto-detection in the backend terminal monitor. Filed as Crewly Pro blocker.

---

## 2026-03-07

### [developer/crewly-core-sam-217bfbbf] 19:56:42
Teams.test.tsx was using global.fetch mocks but the Teams component uses apiService (axios) for data fetching. All other frontend test files (Dashboard, ProjectDetail, Knowledge, etc.) correctly mock apiService via vi.mock. When writing/updating frontend tests, always mock apiService not global.fetch. The only exception is handleCreateTeam which still uses raw fetch. Pattern: vi.mock("../services/api.service", () => ({ apiService: { getTeams: vi.fn(), getProjects: vi.fn(), deleteTeam: vi.fn() } })). Also mock websocket.service, UI/Dialog useAlert, and @/utils/error-handling.

---

## 2026-03-07

### [orchestrator/crewly-orc] 19:59:21
Sam completed Team Organization hierarchy (parentTeamId) in ~18 min. Included backend types, controller, frontend grouping, and 100 tests passing. Also fixed stale Teams.test.tsx mocks (global.fetch→apiService). Mia completed Roadmap review with 74-line doc covering P0-P3 priorities and 8-week sprint plan.

---

## 2026-03-07

### [developer/crewly-core-sam-217bfbbf] 20:07:34
Node.js os.homedir is a non-configurable property — cannot be overridden via direct assignment or jest.spyOn. For testing code that uses os.homedir(), add an optional path override parameter to the function rather than trying to mock the OS module. This pattern works cleanly with Jest+ts-jest CJS setup. Example: addGeminiTrustedFolders(paths, logger?, trustedFoldersPath?) where trustedFoldersPath defaults to os.homedir()-based path in production but can be set to a temp dir in tests.

---

## 2026-03-07

### [orchestrator/crewly-orc] 20:15:29
SteamFun delivery decision: Use client Google account to login and manage the system (master sheet + slide template + Apps Script). Single client only, other users (parents, teachers) access via web app. Future maintenance also through client account. Nick to handle migration when account is provided.

---

