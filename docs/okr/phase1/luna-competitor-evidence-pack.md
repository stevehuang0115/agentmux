# Luna Competitor Evidence Pack (Phase 1)

Last updated: 2026-02-24 (UTC)
Scope: OpenClaw, CrewAI, AutoGen
Method: public-source verification (GitHub API + official docs/README URLs + HTTP status checks)

## 1) OpenClaw Evidence

| Claim | Evidence type | Source URL | URL verification | Confidence |
|---|---|---|---|---|
| OpenClaw positions itself as a cross-platform personal AI assistant. | Product messaging (repo description + README hero copy) | https://github.com/openclaw/openclaw and https://raw.githubusercontent.com/openclaw/openclaw/main/README.md | Verified (`200`) | High |
| OpenClaw emphasizes multi-channel messaging coverage (WhatsApp, Telegram, Slack, Discord, Teams, etc.). | Feature list in README + channel docs | https://raw.githubusercontent.com/openclaw/openclaw/main/README.md and https://docs.openclaw.ai/channels | Verified (`200`) | High |
| OpenClaw onboarding is wizard-first (`openclaw onboard`) and recommended for setup. | README onboarding section + wizard docs | https://raw.githubusercontent.com/openclaw/openclaw/main/README.md and https://docs.openclaw.ai/start/wizard | Verified (`200`) | High |
| OpenClaw highlights local-first gateway/control-plane architecture. | Architecture/positioning language | https://raw.githubusercontent.com/openclaw/openclaw/main/README.md and https://docs.openclaw.ai/gateway | Verified (`200`) | Medium-High |
| Visual asset exists for product identity; direct screenshot-style artifact available. | Image asset link | https://raw.githubusercontent.com/openclaw/openclaw/main/docs/assets/openclaw-logo-text.png | Verified (`200`) | High |

## 2) CrewAI Evidence

| Claim | Evidence type | Source URL | URL verification | Confidence |
|---|---|---|---|---|
| CrewAI messaging centers on “Crews” (autonomy) and “Flows” (production/event-driven control). | README positioning sections | https://raw.githubusercontent.com/crewAIInc/crewAI/main/README.md | Verified (`200`) | High |
| CrewAI positions as standalone/independent (not coupled to LangChain). | README differentiation copy | https://raw.githubusercontent.com/crewAIInc/crewAI/main/README.md | Verified (`200`) | High |
| CrewAI markets enterprise readiness via AMP (security, integrations, observability, support). | README enterprise section | https://raw.githubusercontent.com/crewAIInc/crewAI/main/README.md and https://docs.crewai.com | Verified (`200`) | High |
| CrewAI provides cloud product entrypoint beyond OSS docs. | App URL presence | https://app.crewai.com | Verified (`200`) | Medium-High |
| CrewAI has screenshot/visual proof in repo docs. | Image asset link | https://raw.githubusercontent.com/crewAIInc/crewAI/main/docs/images/asset.png | Verified (`200`) | High |

## 3) AutoGen Evidence

| Claim | Evidence type | Source URL | URL verification | Confidence |
|---|---|---|---|---|
| AutoGen positions as a framework for multi-agent AI applications. | Repo description + README statement | https://github.com/microsoft/autogen and https://raw.githubusercontent.com/microsoft/autogen/main/README.md | Verified (`200`) | High |
| AutoGen presents a layered architecture (Core API, AgentChat API, Extensions API). | README architecture section | https://raw.githubusercontent.com/microsoft/autogen/main/README.md | Verified (`200`) | High |
| AutoGen includes no-code GUI positioning via AutoGen Studio. | README + Studio docs/image | https://raw.githubusercontent.com/microsoft/autogen/main/README.md and https://media.githubusercontent.com/media/microsoft/autogen/refs/heads/main/python/packages/autogen-studio/docs/ags_screen.png | Verified (`200`) | High |
| AutoGen explicitly redirects new users to Microsoft Agent Framework (strategy transition signal). | README announcement/discussion link | https://github.com/microsoft/autogen/discussions/7066 | Verified (`200`) | High |
| AutoGen has structured official docs for installation/tutorial/reference. | Docs hub + AgentChat guide | https://microsoft.github.io/autogen/ and https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/index.html | Verified (`200`) | High |

## 4) GTM Messaging Patterns (Cross-Competitor)

| Pattern | Evidence across competitors | Why it matters for Crewly | Confidence |
|---|---|---|---|
| Dual-track messaging: builder speed + production control | CrewAI (Crews + Flows), AutoGen (rapid prototyping + layered APIs), OpenClaw (wizard setup + ops/control plane) | Crewly should balance “ship fast” and “operate safely at scale” in every top-level narrative. | High |
| Multi-channel / multi-surface ubiquity | OpenClaw strongly emphasizes channels and device surfaces; others emphasize multi-agent extensibility | Messaging should frame Crewly as meeting users where work already happens, not forcing workflow migration. | High |
| Enterprise trust overlays OSS momentum | CrewAI AMP enterprise language; AutoGen Microsoft ecosystem + docs maturity | Crewly should pair open evidence with trust primitives (security, reliability, governance). | Medium-High |
| Docs-led conversion | All three rely heavily on docs hubs and README as acquisition entry points | Crewly content needs stronger docs-to-product conversion loops and role-specific paths. | High |
| Community as proof layer | Discord/Discussions signals present across competitors | Crewly should operationalize public proof (responses, showcases, community artifacts) as marketing surface. | Medium-High |

## 5) Community Traction Signals (Source-Verified)

Metrics snapshot date: 2026-02-24 UTC (GitHub API)

| Project | Stars | Forks | Watchers/Subscribers | Open issues | Created | Last push | Source | URL verification | Confidence |
|---|---:|---:|---:|---:|---|---|---|---|---|
| OpenClaw | 224,189 | 42,835 | 1,234 | 7,445 | 2025-11-24 | 2026-02-24 | GitHub API repo endpoint | Verified (`200`) | High |
| CrewAI | 44,542 | 5,970 | 342 | 322 | 2023-10-27 | 2026-02-24 | GitHub API repo endpoint | Verified (`200`) | High |
| AutoGen | 54,778 | 8,248 | 514 | 606 | 2023-08-18 | 2026-01-22 | GitHub API repo endpoint | Verified (`200`) | High |

API sources:
- https://api.github.com/repos/openclaw/openclaw
- https://api.github.com/repos/crewAIInc/crewAI
- https://api.github.com/repos/microsoft/autogen

## 6) Five Immediate Content Angles for Crewly

| Angle | Hook | Fast asset to ship this week | Evidence basis | Confidence |
|---|---|---|---|---|
| 1. “Autonomy vs Control” Decision Guide | Buyers are choosing architecture models, not just frameworks. | Comparison page + short checklist mapping use cases to control model. | CrewAI/AutoGen both center this split explicitly. | High |
| 2. “Channel-First Agent Ops” Playbook | Teams want agents inside existing comms surfaces. | Practical guide: routing, guardrails, and rollout templates by channel. | OpenClaw’s strongest repeated narrative is channel ubiquity. | High |
| 3. “From README to Production in 7 Days” Series | Competitors convert via docs-heavy onboarding paths. | 3-part content sequence: quickstart, hardening, monitoring. | All three emphasize docs-driven adoption. | High |
| 4. “Community Proof Radar” Monthly | Social proof is now core GTM infrastructure. | Recurring post summarizing releases, issue velocity, adoption patterns. | Competitors maintain visible community touchpoints. | Medium-High |
| 5. “Enterprise Readiness Without Platform Lock-In” Narrative | Teams want governance + flexibility without heavy coupling. | Landing page + technical brief on security/reliability/integration stance. | CrewAI AMP + AutoGen ecosystem framing show demand for this. | Medium-High |

## 7) URL Verification Ledger

All URLs listed below returned `HTTP 200` on 2026-02-24 UTC:

- https://github.com/openclaw/openclaw
- https://raw.githubusercontent.com/openclaw/openclaw/main/README.md
- https://docs.openclaw.ai/start/getting-started
- https://docs.openclaw.ai/channels
- https://raw.githubusercontent.com/openclaw/openclaw/main/docs/assets/openclaw-logo-text.png
- https://github.com/crewAIInc/crewAI
- https://raw.githubusercontent.com/crewAIInc/crewAI/main/README.md
- https://docs.crewai.com
- https://app.crewai.com
- https://raw.githubusercontent.com/crewAIInc/crewAI/main/docs/images/asset.png
- https://github.com/microsoft/autogen
- https://raw.githubusercontent.com/microsoft/autogen/main/README.md
- https://microsoft.github.io/autogen/
- https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/index.html
- https://media.githubusercontent.com/media/microsoft/autogen/refs/heads/main/python/packages/autogen-studio/docs/ags_screen.png
- https://github.com/microsoft/autogen/discussions/7066

## 8) Notes on Confidence

- `High`: direct, explicit claim in official README/docs/API data.
- `Medium-High`: claim is directly supported but includes light interpretation (e.g., GTM implication).
- `Medium`: directional inference from multiple signals, not a single explicit statement.
