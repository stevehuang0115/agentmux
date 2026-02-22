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

