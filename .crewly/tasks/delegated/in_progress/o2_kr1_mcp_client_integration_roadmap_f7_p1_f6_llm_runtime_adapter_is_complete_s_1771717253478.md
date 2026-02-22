# O2-KR1: MCP Client Integration (Roadmap F7, P1)

F6 LLM Runtime Adapter is complete (saved before session suspended — 359 lines + 419 lines tests, all 3 adapters + factory). Moving to F7.

Read `.crewly/docs/roadmap-v3.md` for the F7 spec, then implement:

1. **Read** the existing MCP server code:
   - `mcp-server/src/` — understand the current MCP server implementation
   - `backend/src/services/` — check how the backend currently interacts with MCP
   - Check `specs/mcp-design.md` for the MCP design spec

2. **Create an MCP Client** (`backend/src/services/mcp-client.ts`):
   - Client that agents can use to call external MCP tools
   - `interface McpClient { connect(serverUrl): Promise<void>; listTools(): Promise<Tool[]>; callTool(name, args): Promise<ToolResult>; disconnect(): Promise<void>; }`
   - Support connecting to external MCP servers (not just our own)
   - This enables agents to use external tools via MCP protocol

3. **Write tests** (`backend/src/services/mcp-client.test.ts`)
4. **Run build** to verify: `npm run build:backend`

Focus on the interface and basic HTTP-based MCP client implementation. The goal is to have the architecture so agents can connect to any MCP server.

After completing, report status.

## Task Information
- **Priority**: high
- **Milestone**: delegated
- **Created at**: 2026-02-21T23:40:53.478Z
- **Status**: In Progress

## Assignment Information
- **Assigned to**: crewly-core-sam-217bfbbf
- **Assigned at**: 2026-02-21T23:40:53.478Z
- **Status**: In Progress

## Task Description

O2-KR1: MCP Client Integration (Roadmap F7, P1)

F6 LLM Runtime Adapter is complete (saved before session suspended — 359 lines + 419 lines tests, all 3 adapters + factory). Moving to F7.

Read `.crewly/docs/roadmap-v3.md` for the F7 spec, then implement:

1. **Read** the existing MCP server code:
   - `mcp-server/src/` — understand the current MCP server implementation
   - `backend/src/services/` — check how the backend currently interacts with MCP
   - Check `specs/mcp-design.md` for the MCP design spec

2. **Create an MCP Client** (`backend/src/services/mcp-client.ts`):
   - Client that agents can use to call external MCP tools
   - `interface McpClient { connect(serverUrl): Promise<void>; listTools(): Promise<Tool[]>; callTool(name, args): Promise<ToolResult>; disconnect(): Promise<void>; }`
   - Support connecting to external MCP servers (not just our own)
   - This enables agents to use external tools via MCP protocol

3. **Write tests** (`backend/src/services/mcp-client.test.ts`)
4. **Run build** to verify: `npm run build:backend`

Focus on the interface and basic HTTP-based MCP client implementation. The goal is to have the architecture so agents can connect to any MCP server.

After completing, report status.
