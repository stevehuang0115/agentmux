---
title: "Marketplace & Skills Ecosystem Research"
category: "Research"
tags: ["marketplace", "skills", "ecosystem", "competitive-analysis", "phase-2"]
author: "Mia (Product Manager)"
version: "1.0"
date: "2026-02-21"
status: "Complete"
---

# Marketplace & Skills Ecosystem Research

## Executive Summary

This report combines a deep dive into Crewly's current marketplace/skills architecture with competitive intelligence from OpenClaw, CrewAI, LangChain, and the MCP ecosystem. The goal: identify where Crewly stands, what gaps exist, and propose a marketplace roadmap that turns the skills system into a growth flywheel.

**Key finding:** Crewly has a functional marketplace with 62 built-in skills, a registry, and install/uninstall lifecycle — but no community contribution path, no skill creation SDK, and no security scanning. Competitors range from OpenClaw's 3,286 community skills (simple but plagued by security issues) to MCP's 8,600+ protocol-standardized servers. Crewly's opportunity is to build a curated, secure marketplace that avoids OpenClaw's trust problems while being more accessible than LangChain's PR-based contribution model.

---

## Part 1: Crewly's Current Marketplace Architecture

### 1.1 Skills Inventory

| Type | Count | Location |
|------|-------|----------|
| Agent skills | 22 | `config/skills/agent/` |
| Orchestrator skills | 40 | `config/skills/orchestrator/` |
| **Total built-in** | **62** | |

Each skill has exactly 3 files:
- **`skill.json`** — Metadata: id, name, description, category, assignableRoles, triggers, tags, version, execution config
- **`execute.sh`** — Bash script sourcing `_common/lib.sh`, accepting JSON input via `$1`, calling backend API via `api_call`
- **`instructions.md`** — User-facing documentation

### 1.2 Skill Categories

Agent skills cover: task-management (accept/block/complete/read-task), communication (send-message, send-chat-response), memory (recall, remember, record-learning), knowledge (query-knowledge, manage-knowledge), monitoring (heartbeat, report-status, report-progress), and specialized tools (computer-use, nano-banana-image, send-pdf-to-slack).

Orchestrator skills cover: team management (create/update/start/stop-team), agent lifecycle (start/stop/terminate-agent, resume-session), task management (delegate/assign/complete-task, get-tasks), communication (broadcast, reply-slack, send-message), scheduling (schedule-check, cancel-schedule), events (subscribe/unsubscribe/list-subscriptions), system (restart-crewly, set-goal, update-focus).

### 1.3 Execution Model

```
User/Orchestrator triggers skill
  → bash execute.sh '{"param":"value"}'
    → source _common/lib.sh (provides api_call, require_param, error_exit)
    → Parse JSON with jq
    → Validate required params
    → Call backend REST API
    → Return JSON result
```

All skills are language-agnostic at the interface level (JSON in, JSON out via bash), though the implementation is bash+jq.

### 1.4 Marketplace Service Architecture

**Registry**: Hosted at `https://crewly.stevesprompt.com/api/registry`
- JSON format with schema version, items array, CDN base URL
- 1-hour in-memory TTL cache on backend
- Assets served from `https://crewly.stevesprompt.com/api/assets/`

**Type System** (`backend/src/types/marketplace.types.ts`):
- Item types: `skill`, `model`, `role`
- 11 categories: development, design, communication, research, content-creation, automation, analysis, integration, quality, security, 3d-model
- Install statuses: `not_installed`, `installed`, `update_available`
- Items include: id, name, description, author, version, category, tags, license, downloads, rating, assets (archive URL, SHA-256 checksum, size)

**Backend Services** (`backend/src/services/marketplace/`):
- `marketplace.service.ts` — Registry fetching, manifest management, filtering/sorting, search
- `marketplace-installer.service.ts` — Download, checksum verification (SHA-256), tar.gz extraction, manifest updates, common lib copying

**REST API** (`/api/marketplace`):
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/marketplace` | GET | List items (filter by type, search, sort) |
| `/api/marketplace/installed` | GET | List installed items |
| `/api/marketplace/updates` | GET | Check for updates |
| `/api/marketplace/:id` | GET | Get item detail |
| `/api/marketplace/refresh` | POST | Force registry refresh |
| `/api/marketplace/:id/install` | POST | Install item |
| `/api/marketplace/:id/uninstall` | POST | Uninstall item |
| `/api/marketplace/:id/update` | POST | Update item |

**CLI Commands**:
- `crewly install <id>` / `crewly install --all` — Install from marketplace
- `crewly search [query]` — Search/list marketplace items

**Local Storage**: `~/.crewly/marketplace/manifest.json` tracks installed items with version, install path, checksum, and timestamp.

### 1.5 What's Missing

| Gap | Impact | Priority |
|-----|--------|----------|
| No skill creation SDK/CLI | Developers can't easily create custom skills | High |
| No community submission path | Only Crewly team can publish to registry | High |
| No security scanning | Installed skills run with full system access | Critical |
| No skill versioning/changelog | Users can't see what changed between versions | Medium |
| No skill ratings/reviews from users | No community quality signal | Medium |
| No skill testing framework | No way to validate skills work correctly | Medium |
| No skill dependency system | Skills can't declare dependencies on other skills | Low |
| Single registry source | No federated/private registries for enterprises | Low |

---

## Part 2: Competitive Landscape

### 2.1 OpenClaw / ClawHub

**Scale**: 3,286+ skills on ClawHub, 5,700+ community-built total.

**Skill Format**: Single `SKILL.md` file per skill — YAML frontmatter (name, description, emoji) + markdown body (behavior instructions). The simplest possible format, which drove explosive adoption but also enabled abuse.

**Categories (11)**: AI/ML (48%), Utility (46%), Development (30%), Productivity (25%), Web (19%), Science (18%), Media (11%), Social (11%), Finance (10%), Location (5%), Business (5%).

**Contribution model**: Open by default. Anyone with a GitHub account (1+ week old) can upload. Community feedback via stars/comments. Admin/moderator curation.

**Security incident — ClawHavoc (Jan 2026)**:
- Audit found **341 malicious skills (12% of total)** delivering AMOS macOS infostealer
- 335/341 from a single campaign targeting crypto wallets, SSH credentials, browser passwords
- Additional 283 skills (7.1%) had critical security flaws
- Response: 2,419 suspicious skills removed, VirusTotal integration for automated scanning
- Post-incident: "benign" auto-approved, suspicious get warnings, malicious blocked

**Key lesson for Crewly**: Open-by-default without pre-publication review is dangerous. The simplest format (markdown) is great for adoption but provides zero security guarantees.

### 2.2 CrewAI

**Scale**: ~40+ built-in tools across 8 categories.

**Categories**: File/Document (10 tools), Web Scraping (7), Search/Research (6), Database (6), Vector DB (3), AI/ML (5), Cloud/Storage (2), Automation/Integration (2+).

**Custom tool creation**: Two approaches:
1. `@tool` decorator for simple functions
2. `BaseTool` subclass for complex tools with state management

**MCP integration**: CrewAI supports MCP, giving access to thousands of external tools.

**Enterprise marketplace (AMP)**: Curated tool/agent repositories with approval workflows, per-crew enablement, environment variable configuration. Pricing: $49.99-$120K/year tiers.

**Key lesson for Crewly**: CrewAI compensates for a small built-in tool set with easy custom creation + MCP bridge. The enterprise marketplace adds governance that matters for organizational adoption.

### 2.3 LangChain

**Scale**: 1,000+ total integrations, 180+ tools and toolkits, 43 major providers.

**Categories (7)**: Search (15+), Code Interpreter (4), Productivity (7+), Web Browsing (8), Database (6), Finance (3), Integration Platforms (1+).

**Contribution model**: Standard GitHub PR to `langchain-community` repo. Tests required. Standalone `langchain-*` packages recommended for new integrations.

**Key lesson for Crewly**: The deepest integration ecosystem is a developer library with PR-based contribution. No marketplace UI, no security scanning, but quality maintained through code review.

### 2.4 MCP Ecosystem

**Scale**: 8,610+ servers on PulseMCP, 7,300+ on Smithery.ai, 16,000+ publicly available.

**Major directories**: PulseMCP, Smithery.ai, MCP.so, mcp.run, MCPCentral, official GitHub registry.

**Publishing model**: Publish server code to npm/PyPI/Docker Hub, then register metadata in MCP registry. Namespace ownership validated via GitHub user proof or DNS/HTTP challenge.

**Key lesson for Crewly**: MCP is the universal interop layer. Crewly already has an MCP client (`backend/src/services/mcp-client.ts`). Deeply integrating MCP as a skill source would give Crewly access to thousands of tools without building them.

### 2.5 Comparison Matrix

| Dimension | Crewly | OpenClaw | CrewAI | LangChain | MCP |
|-----------|--------|----------|--------|-----------|-----|
| **Total skills/tools** | 62 built-in | 3,286+ | ~40+ | 180+ | 8,610+ servers |
| **Skill format** | JSON + bash + markdown | Single markdown file | Python class/decorator | Python package | JSON-RPC server |
| **Contribution model** | None (team only) | Open upload | GitHub PR / Enterprise marketplace | GitHub PR | Registry + npm/PyPI publish |
| **Security** | None | VirusTotal (post-incident) | Enterprise governance | PR review | Namespace verification |
| **Custom creation** | Manual (no SDK) | Write SKILL.md | `@tool` decorator / BaseTool | Implement interface | Build MCP server |
| **Unique strength** | Real-time dashboard + orchestration | Simplest format, massive adoption | Multi-agent + enterprise governance | Broadest integrations | Universal protocol |

---

## Part 3: Proposed Marketplace Roadmap

### Phase 1: Foundation (Weeks 1-4)

**M1.1: Skill Creation SDK** — `crewly create-skill <name>`
- Scaffold skill directory with `skill.json`, `execute.sh`, `instructions.md` templates
- Interactive wizard: name, description, category, assignable roles, triggers
- Generate test harness for local validation
- Documentation: "Building Your First Skill" guide

**M1.2: Local Skill Development Workflow**
- `crewly test-skill <path>` — Run skill locally with mock API
- `crewly validate-skill <path>` — Validate skill.json schema, check execute.sh syntax, verify instructions.md exists
- Hot-reload: detect skill file changes, reload without restart

**M1.3: Skill Versioning**
- Add `changelog` field to `skill.json`
- Version comparison in marketplace UI (show what changed)
- Semantic versioning enforcement

### Phase 2: Community (Weeks 5-8)

**M2.1: Community Submission Pipeline**
- `crewly publish <path>` — Package and submit skill to registry
- GitHub OAuth for identity verification
- Automated validation: schema check, bash syntax, required files
- Review queue: auto-approve if passes validation, manual review for flagged items

**M2.2: Security Scanning**
- Static analysis of `execute.sh` for dangerous patterns (curl piping to bash, credential access, outbound data exfiltration)
- Sandboxed test execution before approval
- Learn from ClawHavoc: pre-publication scanning, not post-incident reaction

**M2.3: Ratings and Reviews**
- Star rating (1-5) per skill
- Text reviews with upvotes
- Download counts (already in the type system)
- "Verified" badge for Crewly-team-reviewed skills

### Phase 3: Ecosystem (Weeks 9-12)

**M3.1: MCP as Skill Source**
- Bridge MCP servers as Crewly skills automatically
- `crewly install-mcp <server-name>` — Install an MCP server and wrap it as a Crewly skill
- Marketplace UI tab: "MCP Tools" showing available MCP servers
- This gives Crewly instant access to 8,600+ tools

**M3.2: Multi-Language Skills**
- Support Python and Node.js skill scripts alongside bash
- Execution config in `skill.json` already supports `interpreter` field
- Add runtime detection and dependency installation

**M3.3: Private/Enterprise Registries**
- Allow organizations to host their own registry
- `crewly config set registry <url>` — Point to private registry
- Support multiple registries with priority ordering

### Phase 4: Growth (Ongoing)

**M4.1: Skill Analytics**
- Track usage: which skills are called most, by which roles, success/failure rates
- Surface popular skills on marketplace homepage
- Recommend skills based on team composition and project type

**M4.2: Skill Bundles**
- Pre-packaged sets of skills for common workflows (e.g., "CI/CD Bundle", "Content Creation Bundle")
- One-click install of bundles during onboarding

**M4.3: Bounty Program**
- Identify high-demand skills from user requests
- Offer bounties for community contributors to build them
- Feature contributed skills on blog/social media

---

## Part 4: Community Contribution Model Recommendation

### Recommended Approach: "Curated Open"

A middle ground between OpenClaw's open-by-default (which led to ClawHavoc) and LangChain's PR-only model (which limits contribution velocity).

**How it works:**
1. **Anyone can create skills** locally using `crewly create-skill`
2. **Publishing requires GitHub OAuth** (identity verification)
3. **Automated validation gate** catches structural issues and security red flags
4. **All submissions enter a review queue** visible to the community
5. **Crewly team reviews and approves** (initially); trusted contributors can earn reviewer status over time
6. **Post-publish monitoring**: download spikes, community reports, periodic re-scanning

**Trust levels:**
| Level | Requirements | Privileges |
|-------|-------------|------------|
| New contributor | GitHub account, published 0 skills | Skills enter full review queue |
| Trusted contributor | 3+ approved skills, 6+ months, no violations | Skills fast-tracked (automated checks only) |
| Reviewer | Invited by Crewly team | Can approve others' submissions |
| Crewly team | Core maintainers | Full publish/remove rights, policy changes |

**Security baseline (non-negotiable):**
- No `curl | bash` patterns in execute.sh
- No credential file access outside `~/.crewly/`
- No outbound network calls unless declared in skill.json
- No `rm -rf` or destructive file operations without sandboxing
- Static analysis + sandboxed test execution before approval

---

## Part 5: Key Metrics

| Metric | Target (6 months) | Target (12 months) |
|--------|-------------------|---------------------|
| Total skills in marketplace | 100+ | 300+ |
| Community-contributed skills | 20+ | 100+ |
| Active skill contributors | 10+ | 50+ |
| MCP tools accessible via bridge | 500+ | 2,000+ |
| Average skill rating | 4.0+ | 4.2+ |
| Security incidents | 0 | 0 |

---

## Appendix: Source References

### Codebase
- `config/skills/agent/` — 22 agent skills
- `config/skills/orchestrator/` — 40 orchestrator skills
- `config/skills/_common/lib.sh` — Shared bash library
- `backend/src/services/marketplace/` — Registry and installer services
- `backend/src/types/marketplace.types.ts` — Type definitions
- `backend/src/controllers/marketplace/` — REST API endpoints
- `cli/src/commands/install.ts`, `search.ts` — CLI marketplace commands
- `cli/src/utils/marketplace.ts` — CLI marketplace utilities
- `frontend/src/services/marketplace.service.ts` — Frontend API client

### External
- [OpenClaw Skills Docs](https://docs.openclaw.ai/tools/skills)
- [ClawHavoc: 341 Malicious Skills](https://www.koi.ai/blog/clawhavoc-341-malicious-clawedbot-skills-found-by-the-bot-they-were-targeting)
- [OpenClaw VirusTotal Integration](https://www.csoonline.com/article/4129393/openclaw-integrates-virustotal-malware-scanning-as-security-firms-flag-enterprise-risks.html)
- [CrewAI Tools Documentation](https://docs.crewai.com/en/concepts/tools)
- [CrewAI Enterprise Marketplace](https://docs.crewai.com/en/enterprise/features/marketplace)
- [LangChain Tools Integration](https://docs.langchain.com/oss/python/integrations/tools)
- [PulseMCP Server Directory (8,610+)](https://www.pulsemcp.com/servers)
- [MCP Registry Publishing Guide](https://github.com/modelcontextprotocol/registry/blob/main/docs/guides/publishing/publish-server.md)
- [OpenAI Acquires OpenClaw](https://www.leanware.co/insights/openai-openclaw-acquisition)

---

*Document Version: 1.0 | Date: 2026-02-21 | Author: Mia (Product Manager, crewly-core-mia-member-1)*
