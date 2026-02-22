# O2-KR1: LLM Runtime Adapter Layer (Roadmap F6, P1)

All P0 items are done! Moving to P1. The competitive gap analysis identified multi-runtime support as a key differentiator — Crewly already supports Claude Code + Gemini CLI + Codex but lacks a clean adapter layer.

Read `.crewly/docs/roadmap-v3.md` for the full F6 spec, then implement:

1. **Read** the current runtime handling code:
   - How does the backend currently start agent sessions? Check `backend/src/services/` for session/agent management
   - Where is `runtimeType` used? (it's stored per team member)
   - How does `cli/src/commands/start.ts` launch processes?

2. **Create a Runtime Adapter interface** (`backend/src/services/runtime-adapter.ts`):
   - `interface RuntimeAdapter { start(config): Promise<Session>; stop(sessionName): Promise<void>; write(sessionName, data): Promise<void>; getOutput(sessionName): Promise<string>; }`
   - Implement `ClaudeCodeAdapter` as the default
   - Implement `GeminiCliAdapter` and `CodexAdapter` as stubs (basic structure, can be fleshed out later)
   - Factory function: `getRuntimeAdapter(runtimeType: string): RuntimeAdapter`

3. **Write tests** for the adapter interface and factory
4. **Run build** to verify

Focus on the interface and Claude Code adapter — the other adapters can be stubs for now. The goal is to have the architecture in place so adding new runtimes is pluggable.

After completing, report status.

## Task Information
- **Priority**: high
- **Milestone**: delegated
- **Created at**: 2026-02-21T23:19:39.286Z
- **Status**: In Progress

## Assignment Information
- **Assigned to**: crewly-core-sam-217bfbbf
- **Assigned at**: 2026-02-21T23:19:39.286Z
- **Status**: In Progress

## Task Description

O2-KR1: LLM Runtime Adapter Layer (Roadmap F6, P1)

All P0 items are done! Moving to P1. The competitive gap analysis identified multi-runtime support as a key differentiator — Crewly already supports Claude Code + Gemini CLI + Codex but lacks a clean adapter layer.

Read `.crewly/docs/roadmap-v3.md` for the full F6 spec, then implement:

1. **Read** the current runtime handling code:
   - How does the backend currently start agent sessions? Check `backend/src/services/` for session/agent management
   - Where is `runtimeType` used? (it's stored per team member)
   - How does `cli/src/commands/start.ts` launch processes?

2. **Create a Runtime Adapter interface** (`backend/src/services/runtime-adapter.ts`):
   - `interface RuntimeAdapter { start(config): Promise<Session>; stop(sessionName): Promise<void>; write(sessionName, data): Promise<void>; getOutput(sessionName): Promise<string>; }`
   - Implement `ClaudeCodeAdapter` as the default
   - Implement `GeminiCliAdapter` and `CodexAdapter` as stubs (basic structure, can be fleshed out later)
   - Factory function: `getRuntimeAdapter(runtimeType: string): RuntimeAdapter`

3. **Write tests** for the adapter interface and factory
4. **Run build** to verify

Focus on the interface and Claude Code adapter — the other adapters can be stubs for now. The goal is to have the architecture in place so adding new runtimes is pluggable.

After completing, report status.
