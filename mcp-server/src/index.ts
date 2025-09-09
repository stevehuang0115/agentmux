#!/usr/bin/env node

import { AgentMuxMCPServer } from './server.js';

async function main() {
  const mcpServer = new AgentMuxMCPServer();
  const port = parseInt(process.env.MCP_PORT || '3001');

  try {
    await mcpServer.startHttpServer(port);
  } catch (error) {
    console.error('Failed to start AgentMux MCP server:', error);
    process.exit(1);
  }
}

// Only start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { AgentMuxMCPServer };