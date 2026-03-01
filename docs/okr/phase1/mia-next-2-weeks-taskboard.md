# Next 2 Weeks Execution Board (Feb 24 – Mar 10, 2026)

> **Owner**: Mia (Product Manager) | **Date**: 2026-02-24 | **Source**: roadmap-v3.md + mia-phase1-review.md

---

## Week 1 (Feb 24–28): Foundation Sprint

### Day 1-2

| # | Task | Owner | Priority | Depends On | Status |
|---|------|-------|----------|------------|--------|
| T1 | **Commit current changes** — 33 files, 1717+ lines uncommitted on main. Risk of work loss. | Sam | P0 | — | NOT STARTED |
| T2 | **F3: Add MIT LICENSE** — LICENSE file at repo root, update package.json `"license": "MIT"` | Sam | P0 | — | NOT STARTED |
| T3 | **F1: `npx crewly init` scaffold** — interactive wizard: detect tools, pick template, create team config, print next steps | Sam | P0 | — | NOT STARTED |

**T1 Acceptance Criteria**:
- [ ] All 33 modified files committed with descriptive message
- [ ] `npm run build` passes after commit
- [ ] No uncommitted changes in `git status`

**T2 Acceptance Criteria**:
- [ ] `/LICENSE` file exists with MIT text and correct year/copyright
- [ ] `package.json` has `"license": "MIT"`
- [ ] GitHub UI detects and shows license badge

**T3 Acceptance Criteria**:
- [ ] `npx crewly init` runs without errors on macOS
- [ ] Detects installed tools (Claude CLI, Gemini CLI, tmux, Node version)
- [ ] Prompts for project name, directory, team template
- [ ] Generates `.crewly/` directory + team config
- [ ] Prints "next steps" with `crewly start` command
- [ ] `--yes` flag for non-interactive mode
- [ ] Max 5 interactive prompts

### Day 3-4

| # | Task | Owner | Priority | Depends On | Status |
|---|------|-------|----------|------------|--------|
| T4 | **F5: 3 team templates** — `startup-dev` (orc+dev+QA), `content-team` (PM+writer+designer), `solo-dev` (single agent) | Sam | P0 | T3 (init wires templates) | NOT STARTED |
| T5 | **Fix onboarding bugs** — Gemini package name wrong, template doesn't create team, missing tmux check | Sam | P0 | — | NOT STARTED |
| T6 | **F4: CONTRIBUTING.md** — dev setup guide, PR process, code standards, issue templates | Mia | P0 | — | NOT STARTED |

**T4 Acceptance Criteria**:
- [ ] 3 template dirs at `config/templates/{startup-dev,content-team,solo-dev}/`
- [ ] Each has: team.json, role prompts, skill assignments, example first task
- [ ] `crewly init --template startup-dev` creates working team
- [ ] Templates discoverable in `crewly init` interactive prompt
- [ ] Agents start and begin working within 60s

**T5 Acceptance Criteria**:
- [ ] `@anthropic-ai/gemini-cli` → `@google/gemini-cli` in `cli/src/commands/onboard.ts:199,203`
- [ ] Template selection during onboard creates the team (not just selects it)
- [ ] tmux presence checked during onboard, warning shown if missing
- [ ] All 3 bugs verified fixed with manual test

**T6 Acceptance Criteria**:
- [ ] New contributor can set up dev environment following the guide
- [ ] PR process documented (branch naming, commit format, review)
- [ ] Code standards summary (TS strict, co-located tests, JSDoc)
- [ ] Bug report + feature request issue templates in `.github/ISSUE_TEMPLATE/`

### Day 5

| # | Task | Owner | Priority | Depends On | Status |
|---|------|-------|----------|------------|--------|
| T7 | **F2: README.md overhaul** — hero section, 3-step quickstart, architecture diagram, feature table, badges | Sam (code) + Mia (copy) | P0 | T3 (needs init command for quickstart) | NOT STARTED |
| T8 | **Discord server setup** — channels (#general, #help, #showcase, #dev, #contributing), invite link in README | Mia | P0 | — | NOT STARTED |

**T7 Acceptance Criteria**:
- [ ] README renders correctly on GitHub
- [ ] 3-step quickstart (`npm install -g crewly` → `crewly init` → `crewly start`) actually works end-to-end
- [ ] Feature comparison table (vs CrewAI, LangGraph) factually accurate
- [ ] Badges: npm version, MIT license, stars, CI status
- [ ] Links to docs, Discord, CONTRIBUTING.md

**T8 Acceptance Criteria**:
- [ ] Discord server created with 5 channels
- [ ] Welcome message with quickstart link
- [ ] Invite link added to README

---

## Week 2 (Mar 3–7): Core Gaps Sprint

### Day 6-7

| # | Task | Owner | Priority | Depends On | Status |
|---|------|-------|----------|------------|--------|
| T9 | **F6: LLM adapter layer** — abstract `LLMProvider` interface, Claude + OpenAI + Ollama implementations | Sam | P1 | — | NOT STARTED |
| T10 | **F13 GAP-1 fix: Gemini context detection** — add token-count regex patterns for Gemini CLI status bar | Sam | P1 | — | NOT STARTED |

**T9 Acceptance Criteria**:
- [ ] `LLMProvider` interface: `chat(messages, options) -> Response` with streaming
- [ ] 3 working implementations: ClaudeProvider, OpenAIProvider, OllamaProvider
- [ ] Per-agent model selection in team config YAML
- [ ] Config documented with examples
- [ ] Existing CLI runtime mode still works (non-breaking)
- [ ] Tests for each provider (mock-based unit tests)

**T10 Acceptance Criteria**:
- [ ] New regex pattern matches Gemini's `"1M context left)"` format
- [ ] Threshold-based compaction (70/85/95%) fires for Gemini sessions
- [ ] Tests added for Gemini token-count pattern matching
- [ ] Existing Claude/Codex patterns unaffected

### Day 8-9

| # | Task | Owner | Priority | Depends On | Status |
|---|------|-------|----------|------------|--------|
| T11 | **F7: MCP client in agents** — agents connect to external MCP servers, discover tools, use alongside bash skills | Sam | P1 | — | NOT STARTED |
| T12 | **F13 GAP-2+5 fix: post-compact verification + timeout cleanup** | Sam | P1 | T10 | NOT STARTED |
| T13 | **Docs site content: Getting Started guide** — install, init, first team, first task | Mia | P1 | T3, T4 (needs init+templates working) | NOT STARTED |

**T11 Acceptance Criteria**:
- [ ] MCP server config in `crewly.config.ts` (`mcpServers: { name: { command, args } }`)
- [ ] Agent discovers tools from configured MCP servers at startup
- [ ] Successfully calls a tool from MCP filesystem server
- [ ] 3+ MCP servers tested (filesystem, GitHub, database)
- [ ] Dashboard shows MCP tools per agent
- [ ] Graceful degradation if MCP server unavailable

**T12 Acceptance Criteria**:
- [ ] After `COMPACT_WAIT_MS`, checks if context% dropped below threshold
- [ ] If compact failed silently, resets tracking for immediate retry
- [ ] Timeout handles stored and cleared in `stopSessionMonitoring()`
- [ ] Tests for both verification and cleanup paths

**T13 Acceptance Criteria**:
- [ ] Step-by-step guide that a new user can follow end-to-end
- [ ] Includes prerequisites, install, init, start, verify agents working
- [ ] Screenshots or terminal output examples
- [ ] Ready for docs site (VitePress markdown format)

### Day 10

| # | Task | Owner | Priority | Depends On | Status |
|---|------|-------|----------|------------|--------|
| T14 | **Sprint retrospective + roadmap update** — review what shipped, update roadmap-v3, plan Sprint 2 details | Mia | P0 | All above | NOT STARTED |
| T15 | **O1-KR3: Bi-weekly competitor update** — check CrewAI/LangGraph/AutoGen for new releases since Feb 24 | Mia | P1 | — | NOT STARTED |

**T14 Acceptance Criteria**:
- [ ] List of shipped vs not-shipped items
- [ ] Updated roadmap-v3.md status column
- [ ] Sprint 2 detailed task breakdown written
- [ ] Blockers documented and escalated

**T15 Acceptance Criteria**:
- [ ] Version numbers checked for all 4 competitors
- [ ] Any new features or pricing changes noted
- [ ] Gap matrix updated if competitive landscape shifted
- [ ] Summary posted to team

---

## Dependency Graph

```
T1 (commit) ──→ T2 (LICENSE) ──→ T7 (README)
                                      ↑
T3 (crewly init) ──→ T4 (templates) ─┘
                          ↑
T5 (bug fixes) ──────────┘

T6 (CONTRIBUTING) ──→ T7 (README links to it)
T8 (Discord) ──→ T7 (README links to it)

T9 (LLM adapter) — independent
T10 (Gemini fix) ──→ T12 (compact verify)
T11 (MCP client) — independent
T13 (docs content) ──→ depends on T3+T4

T14 (retro) ──→ depends on all above
T15 (competitor update) — independent
```

---

## Resource Allocation

| Person | Week 1 Tasks | Week 2 Tasks | Total Load |
|--------|-------------|-------------|------------|
| **Sam** | T1, T2, T3, T4, T5, T7 (code) | T9, T10, T11, T12 | FULL (10d) |
| **Mia** | T6, T7 (copy), T8 | T13, T14, T15 | FULL (10d) |

### Sam's Critical Path
`T1 → T2 → T3 → T5 → T4 → T7 → T9 → T10 → T11 → T12`

### Parallelization
- **Week 1**: T5 (bug fixes) can run parallel with T3 (init) since they touch different files
- **Week 1**: T6 (Mia: CONTRIBUTING) + T8 (Mia: Discord) parallel with Sam's work
- **Week 2**: T9 (LLM adapter) + T11 (MCP client) are independent, but Sam is single-threaded — sequential
- **Week 2**: T13 (Mia: docs content) parallel with Sam's T9-T12

---

## Risk Register (2-Week Horizon)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `npx crewly init` (T3) takes >2 days | MEDIUM | Delays T4, T7 | Scope to minimum: 5 prompts, 1 template working, no custom config |
| LLM adapter (T9) scope creep | HIGH | Eats into MCP time | Claude + OpenAI only in Week 2. Ollama deferred to Sprint 2 if needed. |
| MCP client (T11) SDK issues | MEDIUM | Feature incomplete | Test with filesystem server first. If blocked, ship without MCP and escalate. |
| Sam's uncommitted work conflicts on commit (T1) | LOW | Merge issues | Commit early Day 1 before any new work starts. |

---

## Sprint Success Metrics

### Week 1 Exit Criteria
- [ ] All current changes committed
- [ ] `npx crewly init` works end-to-end
- [ ] 3 templates available and functional
- [ ] LICENSE + CONTRIBUTING.md + README in repo
- [ ] Discord server live
- [ ] All known onboarding bugs fixed

### Week 2 Exit Criteria
- [ ] 2+ LLM providers working via adapter (Claude + OpenAI minimum)
- [ ] Gemini context detection fixed (GAP-1)
- [ ] MCP client connects to at least 1 external server
- [ ] Getting Started guide written and ready for docs site
- [ ] Sprint retro completed, Sprint 2 planned

---

*Next review: 2026-03-10 (Sprint retro, T14)*
