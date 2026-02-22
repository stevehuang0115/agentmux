/**
 * CLI command: crewly mcp-server
 *
 * Starts the Crewly MCP Server on stdio transport so that external AI tools
 * (Claude Code, Cursor, Windsurf, etc.) can manage Crewly teams via MCP.
 *
 * Usage:
 *   crewly mcp-server
 *
 * Claude Code configuration example:
 *   Add to ~/.claude.json or project .mcp.json:
 *   {
 *     "mcpServers": {
 *       "crewly": {
 *         "command": "npx",
 *         "args": ["crewly", "mcp-server"]
 *       }
 *     }
 *   }
 *
 * @module commands/mcp-server
 */

import { CrewlyMcpServer } from '../../../backend/src/services/mcp-server.js';

/**
 * Start the Crewly MCP Server on stdio transport.
 *
 * The server exposes Crewly capabilities as MCP tools:
 * - crewly_get_teams: List all teams
 * - crewly_create_team: Create a new team
 * - crewly_assign_task: Assign task to an agent
 * - crewly_get_status: Get team/agent status
 * - crewly_recall_memory: Search team memory
 * - crewly_send_message: Send message to orchestrator
 *
 * Runs on stdio (stdin/stdout) for MCP protocol communication.
 * The process stays alive until the client disconnects.
 */
export async function mcpServerCommand(): Promise<void> {
  const server = new CrewlyMcpServer();

  // Handle graceful shutdown
  const shutdown = async () => {
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await server.start();
}
